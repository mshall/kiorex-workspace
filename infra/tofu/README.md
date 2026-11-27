# Kiorex infrastructure as code (OpenTofu), multi-cloud by one variable

Written 27 Nov 2026 from the founder decisions of the same day. **Nothing here has been applied.** No AWS or Huawei resource was created, no DNS was touched, the live Clinic was not touched. Read `docs/RUNBOOK.md` before the first apply.

## What the founder decided (27 Nov 2026)

| Tag | Id | Data | Default cloud | Scale |
|---|---|---|---|---|
| kx-test | `test` | REAL, small: the real clinic organisation on the existing AWS Clinic plus tagged dummy data | AWS (account 990597228737, eu-central-1) | small |
| kx-pilot | `pilot` | REAL, same design as test | AWS (separate production account, to be created) | larger |
| kx-pro | `prod` | REAL, the major release for Egypt | **Huawei Cloud** (initial decision) | HA-capable |

Test or pilot may move to Huawei at any time, so every capability is a module with an identical interface on both clouds and each environment has one switch, `provider_name = "aws" | "huawei"`.

**The live Clinic is out of scope and untouched.** Account 990597228737, distribution `E1DE0H2K3M17YL` (https://d92iz83i79c05.cloudfront.net/) is managed by its own CDK stack. This tree only READS it through one data source (`clinic_distribution_id`), prints it as `clinic_reference`, and never imports, modifies or destroys it. There is no dev copy of the Clinic.

> The Huawei Cloud Egypt region availability, the Central Bank of Egypt (CBE) requirements and Egyptian data residency must be verified by the founder (and counsel). Nothing in this repository asserts any of them. The Huawei region variable is a deliberate placeholder (`REPLACE_AFTER_REGION_VERIFICATION`) so a plan cannot run by accident.

## Layout

```
infra/tofu/
  bootstrap/            remote-state bucket (S3 with lock file, or OBS), run once, local state
  modules/
    registry/           yamldecode of _docs/registry/service-url-registry.yaml -> hosts, zones, certificate names
    network/            {aws,huawei}/ + README
    compute_host/       single host running docker compose (ARM, SSM only, no SSH)
    database/           PostgreSQL private: on the host (encrypted volume + snapshots) or managed; backups bucket
    static_site/        web apps: object storage + CDN (+ same-origin /api/*)
    cdn_api_edge/       APIs behind the CDN: origin-secret header, host security group = CDN only
    dns_zone/           child zones (test, pilot), apex zones (prod), records from the registry
    certificate/        per environment and domain (never a shared wildcard)
    secrets/            containers only; values never in tfvars or state
    container_registry/ ECR or SWR (+ GitHub OIDC role on AWS)
    budget_alarm/       monthly budget, e-mail thresholds
    monitoring_alarms/  host, backup freshness, CDN 5xx, database storage
    stack/              the composition and THE provider switch
  envs/{test,pilot,prod}/   thin roots: providers, backend, terraform.tfvars (sizing), example var files for the other cloud
  deploy/
    host/               scripts and systemd units that run ON the host (shipped through cloud-init)
    compose/            docker-compose.yml, Caddyfile, <env>/docker-compose.override.yml
    scripts/deploy.sh   build a release bundle, upload, trigger the host (SSM push or pull timer)
    github/             reusable GitHub Actions workflows (templates) and an example caller
  scripts/validate-all.sh   fmt + init -backend=false + validate for every module and both providers
  docs/RUNBOOK.md, docs/COSTS.md
```

## Architecture (one environment)

```
 browser --> CDN (CloudFront | Huawei CDN) --> host :80 (Caddy)  --routes by X-Kx-Service-->  platform-api | platform-jobs (1) | passport | pharmacy-api | lab-api
              |  adds X-Origin-Secret, X-Kx-Service                                                                                    |
              |  static apps from object storage (+ /api/* to the host)                                                         postgres (container, private network only)
 host security group: origin port from the CDN only. No SSH, no database port.           data on its own encrypted volume, daily snapshot + daily dump to object storage
 access: SSM Session Manager (AWS) | console (Huawei).  deploy: SSM Run Command (AWS) | the host polls object storage (any cloud)
```

Hosts, certificates and DNS records are generated from `_docs/registry/service-url-registry.yaml` (one place, `modules/registry`). To add a service to an environment you add its registry id to `services` in the tfvars; you never type a host name.

## Quick start, kx-test on AWS (nothing below is done yet)

Prerequisites: OpenTofu >= 1.10, AWS credentials for account 990597228737 with permission to create the listed resources (the local `kiorly_clinics` user can plan; it is not an apply decision), the founder's go-ahead.

1. **State bucket** (once): `cd bootstrap && tofu init && tofu apply -var aws_account_id=990597228737`. Copy the `state_bucket` output.
2. **Backend**: `cd envs/test && cp backend.hcl.example backend.hcl`, put the bucket in, `tofu init -backend-config=backend.hcl`.
3. **Plan, review, apply**: `tofu plan -out=plan.tfplan`, read it (no change, no destroy of anything existing; about 90 creates), then `tofu apply plan.tfplan` (founder).
4. **Secrets**: set the founder-owned secret bags (RUNBOOK section 4). Database passwords are generated on the host.
5. **First deploy**: GitHub Environments and variables (RUNBOOK section 11), then run the workflow or `deploy/scripts/deploy.sh test --tag platform=<sha> ...`.
6. **Custom domains** (phase 2): see below.

### Custom domains, two phases

`enable_custom_domains = false` (default) runs everything on default CDN host names (`d....cloudfront.net`): infrastructure, deploys and health can be proven before any DNS exists. Note that registry-derived URL variables (issuer, CORS, redirect URIs) already name the final hosts, so full sign-in flows need phase 2.

1. Apply with `create_dns_zones = true` (default). Read `tofu output name_servers`.
2. **Founder**: at each registrar (domain.com, namecheap.com) add the NS records for the child zones (`test.kiorex.com`, `test.kiorly.com`). Nothing else at the registrar changes.
3. Set `enable_custom_domains = true`, plan and apply. ACM certificates validate through the new zones, aliases and A/AAAA records are created. The Clinic's own hostname change is NOT part of this stack (it belongs to the Clinic CDK stack and is a separate founder decision).

## Switching an environment from AWS to Huawei (plug and play)

The module interface does not change; only the variable file does.

1. Verify Huawei: region (and that it serves Egypt), residency, CBE position, quotas, ARM (Kunpeng) flavors, CDN service area, SCM, the RDS flavors. Founder and counsel.
2. Credentials: `export HW_ACCESS_KEY=... HW_SECRET_KEY=...` (never in a file). Create in the console: an SCM certificate named `<tag>-<domain key>` (for example `kx-test-kiorex`, `kx-test-kiorly`), a key pair (optional), the SWR and CSMS access you need, and for managed databases a CSMS secret for the master password.
3. `cd envs/<env> && cp huawei.tfvars.example huawei.tfvars`, fill `huawei_region`, `origin_allow_cidrs` (Huawei CDN back-to-origin ranges), flavors.
4. **Data**: this is a migration, not a rename. The AWS stack keeps running until the Huawei one is healthy. Dump each database (`kx-backup.sh` output or `pg_dump`), restore it into the new database, move object data, then repoint DNS (lower the TTL first). Plan the cut-over window and keep the AWS stack until rollback is no longer needed.
5. Use a SEPARATE state key for the new cloud (copy `backend.hcl` and change `key`), or `tofu state` surgery is needed. Run `tofu plan -var-file=huawei.tfvars` and review: every resource is a create.
6. Apply, then repeat the secrets step (CSMS names are `<prefix>-<name>`, for example `kx-test-passport`), deploy (pull-based: upload the release, the host applies it within a minute), smoke test, then switch DNS.
7. Decommission the AWS stack only on the founder's word (`prevent_destroy` on the data volume forces a deliberate edit, RUNBOOK section 9).

Differences you must expect on Huawei (all listed so none is a surprise): the CDN cannot exist without a custom domain; the apex host (`test.kiorex.com`) cannot be a CNAME; static buckets are public-read (assets only); no budget resource in the provider (manual step); WAF is not wired; GitHub federation is not created (interim IAM user keys); host scripts use `hcloud` and `obsutil`. See `modules/*/README.md`.

## Real-data hygiene (applies from test upward, at the cheapest viable cost)

| Control | How | Where |
|---|---|---|
| Encryption at rest | encrypted gp3 root and data volumes, SSE on every bucket, encrypted RDS | compute_host, database, static_site |
| Database never public | container on the compose network with no published port, or a managed instance in isolated subnets; host security group has no database rule | database, compute_host |
| Only the CDN reaches the origin | security group = CloudFront prefix list, plus a shared origin-secret header checked by Caddy | compute_host, cdn_api_edge, Caddyfile |
| No SSH | no key pair, no port 22; access by SSM Session Manager, IMDSv2 only, hop limit 1 | compute_host |
| Backups | daily `pg_dump` per database to a versioned, encrypted bucket with expiry, plus a daily disk snapshot policy (7 days test, 14 pilot); `BackupOk` metric alarm if a day is missed | database, monitoring_alarms |
| Separate database and role per product | `kx-pg-reconcile.sh`, each role owns only its database, `PUBLIC` revoked | host scripts |
| Secrets | containers only; DB passwords generated on the host; founder secrets set by CLI; never in tfvars or state (one documented exception below) | secrets |
| TLS | CDN terminates TLS 1.2+; HSTS on sites; bucket policies deny non-TLS | static_site, cdn_api_edge |
| Cost guard | monthly budget with thresholds (tag-scoped on the shared account) | budget_alarm |
| Jobs run once | `platform-jobs` has a fixed container name, `replicas: 1`, a compose profile enabled on one host only, and the API container runs with `JOBS_ENABLED=false` | compose |
| Audit | CloudTrail is not created here (the account already has its own decisions); recommended before pilot | risks |

## One-time codes in logs (kx-test only)

Passport in mock messaging mode (`SMS_MODE` / `WHATSAPP_MODE` unset or `mock`) writes every one-time code to its container stdout (`[otp-sender:log] to=<phone> ... code=<code> (dev only)`). On kx-test this is deliberate: the live e2e suite (`e2e/kx-test`) reads the code with a read-only `docker logs` over SSM, because the environment holds synthetic and tagged-dummy data and no SMS provider is paid for. In **pilot and prod it must be impossible**: a code in a log is an account takeover for anyone who can read logs.

* Guard: the one-shot compose service `otp-guard` (`deploy/compose/kx-guard-otp.sh`, ships inside every release bundle, runs in the caddy image already on the host) is a hard dependency of `passport` (`service_completed_successfully`). For `pilot` and `prod` it refuses (exit 78, `docker compose up` fails with "release unhealthy", Passport never starts) unless `SMS_MODE=real` **and** `WHATSAPP_MODE=real` are in `/opt/kx/env/passport.env`, `KX_DEV_OTP_BYPASS` and `KX_DEV_ENDPOINTS` (the dev inbox lists codes too) are not `true`, and `KX_ENV` there is not `test`/`dev`. Any environment other than `test`, `pilot`, `prod` is refused. On `test` it only prints a notice.
* Why it ships in the release and not in the host bootstrap: host scripts are delivered once by cloud-init and `user_data` changes never replace a running host (`ignore_changes`), so a guard there would never reach kx-test.
* Test: `deploy/scripts/test-otp-guard.sh` (15 cases, also inside the compose image; run by `scripts/validate-all.sh`).
* Not in this repo: the dev Passport itself still refuses `KX_ENV=prod` (`assertNotProduction`) and a production-capable IdP is a separate decision. Handoff for the Passport owner: Passport could stop writing the code line unless a `KX_LOG_OTP=true` is set explicitly (default off outside local runs); until then this guard plus the SSM-only access to the host is the control.

## Variables you will touch

All sizing lives in `envs/<env>/terraform.tfvars`: `services` (which registry ids are deployed), `compute` (instance, vcpus, memory, disk), `database` (mode host | managed, volume size, retention), `edge` (WAF, noindex), `alert_emails`, `monthly_budget_usd`, `github_repos`, `enable_custom_domains`. Provider: `provider_name`. Safety lock: `aws_account_id`.

| Env | Default cloud | Host | Database | Edge | Notes |
|---|---|---|---|---|---|
| test | aws | t4g.medium (2 vCPU, 4 GB) | host mode, 20 GB volume, 7-day snapshots, 30-day dumps | no WAF, noindex | cheapest viable with real-data hygiene |
| pilot | aws | t4g.large (2 vCPU, 8 GB) | host mode, 60 GB, 14-day snapshots, 60-day dumps | WAF on, noindex until GA | separate account |
| prod | huawei | 4 vCPU, 16 GB, flavor chosen by size | managed, multi-AZ, 100 GB | noindex off | stateless host; AWS fallback in `aws.tfvars.example` |

### High availability (honest scope)

"HA-capable" here means: with `database.mode = managed` and `managed_multi_az = true` the host holds no data, so a failed host is replaced in minutes (`tofu apply -replace`, RUNBOOK section 8), the EIP and security group stay, and the database fails over by itself. A second host with a load balancer is NOT built (`host_count` is capped at 1 by a check); CloudFront origin groups only cover GET and HEAD, so they cannot front APIs. Adding an ALB (or Huawei ELB) module is the next step if the recovery time above is not acceptable.

## Cost (monthly, USD, estimates)

List prices of eu-central-1 from memory, rounded, 730 hours, no discounts, low traffic. **Verify in the AWS Pricing Calculator and the Billing console before committing**; the plan itself does not price anything. Details in `docs/COSTS.md`.

| Line | kx-test (AWS) | kx-pilot (AWS) | kx-pro (AWS fallback) |
|---|---|---|---|
| Host (t4g.medium / large / xlarge) | 28 | 56 | 112 |
| Managed PostgreSQL | 0 | 0 | 125 to 150 (db.t4g.medium Multi-AZ + 100 GB) |
| Disks (root, data, snapshots) | 6 | 13 | 10 |
| Public IPv4 (Elastic IP) | 4 | 4 | 4 |
| CDN (7 distributions; free tier covers small traffic) | 0 to 2 | 2 to 10 | 10 to 40 |
| WAF | 0 | 8 to 10 | 8 to 10 |
| Object storage (sites, backups, deploy) | 1 | 2 | 3 |
| Container registry | 1 to 2 | 2 | 2 |
| DNS zones | 1 | 1 | 1 |
| Secrets (6 x 0.40) | 2.4 | 2.4 | 2.4 |
| Alarms, budget, SNS | 1 | 2 | 3 |
| **Total (rounded)** | **about 45 (range 42 to 52)** | **about 95 (range 90 to 115)** | **about 320 (range 300 to 360)** |

kx-pro on Huawei is deliberately not priced here: use the Huawei price calculator for the chosen region and flavors (ECS, RDS HA, EIP and bandwidth, CDN traffic, OBS, SWR, SMN, CSMS, CBR). Savings for test: `t4g.small` (about 14 less, needs swap and tighter limits), a 1-year Savings Plan or reserved instance (about 30 to 40 percent on the host).

## What is verified, and what is not

Verified in this work: `tofu fmt`, `tofu init -backend=false` and `tofu validate` pass for every module on both providers, the stack, the bootstrap stack and the three roots (`scripts/validate-all.sh`). `tofu plan` for `envs/test` on AWS against the local credentials (read-only data sources only) shows 90 creates, 0 changes, 0 destroys; with `enable_custom_domains=true` 112 creates. `bootstrap` plans 6 creates. `deploy.sh` was run offline (`--dry-run`, `KX_OFFLINE=1`).

NOT verified: any apply; the host bootstrap and scripts on a real host (they were syntax-checked with `bash -n` only; install `shellcheck` and run them on a throw-away host first); anything Huawei at runtime (provider argument names validated, behaviour not; CDN, RDS, CBR, SCM, CSMS, agency role names, `hcloud` and `obsutil` commands are from documentation); GitHub workflows (YAML parsed, never run); the exact environment variable names the products expect (`DATABASE_URL` and `JOBS_ENABLED` are taken from the platform code and Dockerfile, the other products' variables must be checked against each `.env.example`).

## Risks and open items

1. **Origin secret is in state.** CloudFront and Huawei CDN need the header value in their configuration, so it exists in state (encrypted bucket, restricted). It is a routing guard, not a data credential. Rotation: RUNBOOK section 10. The strongest alternative on AWS is a CloudFront VPC origin (no public origin at all); not built.
2. **HTTP between the CDN and the origin.** TLS ends at the CDN; the leg to the host is plain HTTP, protected by the prefix list and the secret header, but not encrypted in transit. For real patient data before pilot, add origin TLS (a certificate on Caddy for an origin host name, then `https-only`) or a VPC origin. Decision for the founder and counsel.
3. **Single host.** One host is a single point of failure for the application tier (recovery by replacement). Test accepts this. Pilot and prod need the ALB step or at minimum the replacement drill rehearsed.
4. **Pilot and the ADR.** ADR-059 puts pilot on the production data plane (no migration from pilot to prod). The founder's decision here makes pilot its own stack. Moving pilot customers to prod then needs a data migration or a decision to run pilot hostnames on the prod stack. Flagged, not resolved.
5. **No disk-space alarm** (needs the CloudWatch agent). The data volume is 20 GB in test: check `df` weekly or add the agent.
6. **Huawei specifics** listed in the switching section, plus unverified runtime scripts. Treat the first Huawei apply as a rehearsal in a scratch project.
7. **The shared account.** Test lives next to the live Clinic. Everything here is tagged `Env=test, EnvTag=kx-test` and prefixed `kx-test-`, names never collide with the CDK stack, the existing GitHub OIDC provider is only referenced, and the IAM role is new and narrow. The budget for test is tag-scoped: it shows zero until the founder activates the `EnvTag` cost allocation tag in Billing.
8. **IAM permissions of the applier.** Apply needs broad create rights in the account (EC2, S3, CloudFront, ACM, Route 53, IAM roles, ECR, SSM, Secrets Manager, DLM, CloudWatch, SNS, Budgets). Use a short-lived admin session for the first apply, not the standing `kiorly_clinics` user.
9. **Backups are untested until the restore drill is done** (`deploy/host/kx-restore-drill.md`). Do it once after the first apply and then quarterly.
10. **Pilot and prod account IDs** are placeholders on purpose; the account lock refuses to run until they are filled.
11. **File storage.** The platform's local vault (`STORAGE_MODE=local`) is mapped to `/srv/kx/vault`. In host database mode that is the encrypted data volume (snapshotted); in managed mode it is the root disk (not durable, not snapshotted by the policy). Use the product's object storage mode for real documents in pilot and prod, and add a bucket module for it (not built, no product variable names verified).
12. **Rollback promotes `releases/previous` to `releases/current`** in object storage (needed so pull-mode hosts do not flip back); migrations are not reversed.

