# KX21 · AWS Cloud Hosting & Infrastructure Reference
Source: 1CzIULGNBy-wQ5jVikoHy7JqHHv4K7QKW
Revision: Rev 2.8 · Reference Edition, updated 27 November 2026 (previous: Rev 2.4; ADR-059 accepted; DNS delegation and certificates; Huawei Cloud production option; OpenTofu provider switch; kx-test plan; Clinic deployed)

WHAT CHANGED IN REV 2.8: ADR-059 accepted. New: DNS delegation and certificate flow, the OpenTofu provider switch with the Huawei Cloud production option (initial founder decision, verification open), the kx-test infrastructure plan, and the Clinic deployment status (24, 25 and 27 Nov 2026).


> Extraction note: symbols (≥, ≤, ≈, →, ×, ·) and some chart values lost in the PDF text layer were restored by inference where obvious. Page headers/footers removed.

Section 03 — TECHNICAL DOCUMENTS.

Every AWS component behind Kiorex and Kiorly — what runs where, how it is configured today, how it scales, how it is secured, backed up, deployed, observed and paid for — and what to harden before general availability.

- Authored in the role of Principal Cloud Architect. Owns the AWS estate: accounts, network, compute, data, security baseline, cost and resilience.
- Topics: OpenTofu IaC (cloud-portable) · As-built stack · Network & request path · Component reference · Ecosystem stacks · Backup & DR · Cost · Hardening backlog

| Field | Value |
|---|---|
| DOCUMENT | KX21 |
| REVISION | Rev 2.8 · Reference Edition (27 Nov 2026) |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Engineering, DevOps, security reviewers, technical due diligence |
| OWNER ROLE | Principal Cloud Architect |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 Infrastructure as code with OpenTofu (ADR-028)
02 Summary
03 Accounts, organization and identity (target)
04 Regions and data cells
05 Network architecture
06 Request path
07 Component reference
08 Ecosystem stacks
09 Compute, boot sequence and scaling
10 Data, storage and encryption
11 Security baseline
12 Deployment pipeline
13 Observability and alarms
14 Backup, restore and disaster recovery
15 Environments
16 Cost profile (indicative)
17 Hardening backlog before GA
18 Operations quick reference
19 Sources & evidence

**EVIDENCE:** Source of truth for the as-built sections: `infra/src/kiorly-clinics-management-stack.ts`, `platform/data-cells.json`, `platform/waf-rules.json`, `scripts/cicd-*.sh`, `scripts/backup-restore-drill.sh` and `Docs/AWS_Cloud_Deployment_Guide.md` in mshall/clinics-management (commit 6b24a79, 19 Nov 2026). Where the deployment guide and the CDK code differ, the code wins. Section 01 sets the target: OpenTofu replaces CDK (ADR-028); later sections describe the AWS resources, which stay the same — only the tool that creates them changes.

## 01 Infrastructure as code with OpenTofu (ADR-028)

We run on AWS, but every resource is described in OpenTofu through cloud-neutral modules, so a move to another cloud is a planned module swap — not a rewrite. This section replaces AWS CDK as the standard for every repository.

Key facts: IaC TOOL — OpenTofu; LICENCE — MPL-2.0, Linux Foundation, no HashiCorp dependency; TOOL COST — USD 0; ENCRYPTED REMOTE STATE — S3 + KMS, native S3 locking; PORTABLE MODULE CONTRACTS — 10, one AWS implementation each.

**DECISION:** OpenTofu (pin ≥1.10) with the hashicorp/aws provider replaces AWS CDK for Kiorly Clinic and every new repository (Kiorex, Kiorex Account, Pharmacy, Lab). State lives in an encrypted S3 bucket in the same region as the cell, with client-side state encryption via AWS KMS. No HCP Terraform / paid hosted service is used.

### Why OpenTofu, and what 'portable' really means

| Concern | Answer |
|---|---|
| Licence and cost | Open source (MPL-2.0), governed by the Linux Foundation, free for any use. Our only cost is a few dollars a month for the S3 state bucket and KMS key. |
| Portability | OpenTofu itself works with AWS, Azure, GCP and others. Portability comes from our module contracts: the product stack calls `network`, `database`, `container_service` … — never an AWS resource directly. Switching cloud = writing a new implementation of each contract, keeping the product stack and app unchanged. |
| What it does not do | It does not make AWS services run elsewhere. App Runner, CloudFront, SES etc. have equivalents, not identical twins — each needs a new module implementation and testing. Expect weeks of work for a switch, not a rewrite of months. |
| Security extras | Client-side state encryption (state and plan files encrypted with a KMS key) — important because state describes health-data infrastructure. |
| Lock-in we avoid | No CloudFormation, no CDK constructs, no AWS-only custom resources (the CDK 'origin host parser' Lambda disappears: App Runner's service URL is a plain attribute). |

### Two layers of portability

- **Application (portable now):** OCI container images · PostgreSQL via Prisma · Config via env vars · Storage adapter · Secrets adapter · Email adapter
- **Product stack (cloud-neutral):** `product-stack` module: one product in one cell. Inputs: sizes, domains, image, cell. Outputs: app URL, API origin, DB ref.
- **Module contracts:** network · database · container_service · object_storage · cdn_edge · secrets · email · dns_certs · waf · observability
- **Cloud implementation:** `modules/aws/*` (in use) · `modules/azure/*` (when needed) · `modules/gcp/*` (when needed)

Figure 0.1 — The product stack depends on contracts; only the bottom layer knows which cloud it is on.

| Module contract | AWS implementation (now) | Azure equivalent | GCP equivalent |
|---|---|---|---|
| network | VPC, 2 AZ, public + isolated subnets, S3 gateway + interface endpoints, SGs | VNet, subnets, private endpoints, NSGs | VPC, subnets, Private Service Connect, firewall rules |
| database | RDS PostgreSQL 16 Multi-AZ, PITR, `manage_master_user_password` | Azure Database for PostgreSQL Flexible Server (zone-redundant HA) | Cloud SQL for PostgreSQL (regional HA) |
| container_service | App Runner service + VPC connector + autoscaling config | Azure Container Apps | Cloud Run |
| object_storage | S3 buckets (uploads, web), block public, TLS, versioning, KMS | Blob Storage | Cloud Storage |
| cdn_edge | CloudFront, OAC, Function (SPA rewrite), /api/* behaviour | Azure Front Door | Cloud CDN + external HTTPS load balancer |
| secrets | Secrets Manager + KMS | Key Vault | Secret Manager + Cloud KMS |
| email | SES domain identity, DKIM/SPF/DMARC records | Azure Communication Services Email | Third-party (e.g. SendGrid) — GCP has no native SES |
| dns_certs | Route 53 zones, ACM certificates (us-east-1 for CloudFront) | Azure DNS + managed certificates | Cloud DNS + Certificate Manager |
| waf | WAFv2 WebACL (CLOUDFRONT scope, us-east-1) from `platform/waf-rules.json` | Front Door WAF policy | Cloud Armor |
| observability | CloudWatch log groups, alarms, dashboards; SNS → on-call webhooks | Azure Monitor + alerts | Cloud Monitoring + alerting |

### Application adapters (rules for code)

| Adapter | Interface in app | AWS today | Status in Kiorly |
|---|---|---|---|
| Object storage | put/get/presign/delete | S3 | Exists (`UPLOAD_STORAGE=local|s3`) — add azure|gcs when needed |
| Secrets | `getSecret(ref)` at boot | Secrets Manager via VPC endpoint | Refactor — entrypoint resolves `DB_SECRET_ARN` with the AWS SDK; move behind adapter |
| Email | `send(template, to, vars)` | SES | Refactor — isolate SES client |
| Database | Prisma | PostgreSQL (RDS) | Portable — PostgreSQL only, no AWS extensions |
| Compute | OCI image, `PORT`, health endpoints | App Runner | Portable |
| Edge | Same-origin `/api/*` routing | CloudFront | Portable — no CloudFront-specific headers in app logic |

**RULE:** Code rule: no AWS SDK import outside `src/platform/adapters/*`. CI fails if `@aws-sdk/*` is imported elsewhere. This one rule is what keeps a cloud switch cheap.

### Repository layout (every repo)

```
infra/tofu/
  .opentofu-version        # e.g. 1.13.x — pinned, same in CI and laptops
  .tflint.hcl              # lint rules (aws ruleset)
  bootstrap/               # one-time per AWS account: state bucket, KMS key, GitHub OIDC roles
  modules/
    contracts/README.md    # inputs/outputs every implementation must honour
    aws/network/  aws/database/  aws/container-service/  aws/object-storage/
    aws/cdn-edge/ aws/secrets/   aws/email/  aws/dns-certs/  aws/waf/
    aws/observability/  aws/ci-oidc/
    product-stack/         # composition: one product in one cell (calls the contracts)
  live/
    staging/frankfurt/kiorly-clinic/   backend.tf main.tf terraform.tfvars
    prod/frankfurt/kiorly-clinic/      backend.tf main.tf terraform.tfvars
    prod/frankfurt/kiorex-platform/ ...
    prod/global/dns/       # Route 53 zones, shared certificates
```

### State backend and encryption

```hcl
terraform {
  required_version = ">= 1.10.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 6.0" }
  }
  backend "s3" {
    bucket       = "kiorex-tofu-state-prod-euc1"   # created by bootstrap/
    key          = "prod/frankfurt/kiorly-clinic/terraform.tfstate"
    region       = "eu-central-1"                  # same region as the cell
    encrypt      = true                            # SSE on the bucket
    use_lockfile = true                            # native S3 locking, no DynamoDB table
  }
  encryption {                                     # OpenTofu client-side state encryption
    key_provider "aws_kms" "state" {
      kms_key_id = "alias/kiorex-tofu-state"
      region     = "eu-central-1"
      key_spec   = "AES_256"
    }
    method "aes_gcm" "default" { keys = key_provider.aws_kms.state }
    state { method = method.aes_gcm.default
            enforced = true }
    plan  { method = method.aes_gcm.default
            enforced = true }
  }
}
```

- State bucket: versioning on, public access blocked, TLS-only policy, lifecycle keeps 90 days of non-current versions; access limited to the CI roles and the platform admin permission set.
- One state file per product per environment per cell — a mistake in one never touches another.
- RDS master password never enters state: `manage_master_user_password = true` keeps it in Secrets Manager (the app reads host/port from outputs passed as env vars, and username/password from the managed secret).

### Product stack — how a product is declared

```hcl
# infra/tofu/live/prod/frankfurt/kiorly-clinic/main.tf
locals { cells = jsondecode(file("${path.root}/../../../../../../platform/data-cells.json")).cells }

provider "aws" { region = local.cells["frankfurt"].awsRegion }
provider "aws" {  # CloudFront certificates + WAF must live in us-east-1
  alias  = "us_east_1"
  region = "us-east-1"
}

module "kiorly_clinic" {
  source    = "../../../../modules/product-stack"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }

  product   = "kiorly-clinic"
  env       = "prod"
  cell      = "frankfurt"          # precondition: region must equal data-cells.json
  domain    = "app.kiorly.com"
  api_image = "${var.ecr_repository_url}:${var.git_sha}"

  api = { cpu = "1024", memory = "2048", min = 2, max = 25, max_concurrency = 100,
          health_path = "/api/v1/health/live" }
  db  = { engine_version = "16", instance_class = "db.t4g.medium", multi_az = true,
          backup_days = 35, deletion_protection = true, storage_gb = 20, max_storage_gb = 100 }
  uploads   = { versioning = true, kms = true }
  waf_rules = jsondecode(file("${path.root}/../../../../../../platform/waf-rules.json"))
  env_vars  = { NODE_ENV = "production", UPLOAD_STORAGE = "s3", PRISMA_MIGRATE_ON_BOOT = "true",
                PRISMA_SEED_ON_BOOT = "false", WEB_BUILD_ID = var.git_sha }
  tags      = { Product = "kiorly-clinic", Env = "prod", KiorlyHostCell = "frankfurt" }
}
```

### CDK → OpenTofu resource mapping (Kiorly Clinic)

| CDK construct (today) | OpenTofu resource(s) | Module |
|---|---|---|
| `ec2.Vpc` + gateway/interface endpoints + SGs | `aws_vpc`, `aws_subnet`, `aws_route_table`, `aws_vpc_endpoint` (s3 gateway; secretsmanager, kms, sts interface), `aws_security_group` | aws/network |
| `rds.DatabaseInstance` + parameter group | `aws_db_instance` (`manage_master_user_password`), `aws_db_subnet_group`, `aws_db_parameter_group` (timezone) | aws/database |
| `CfnService`, `CfnVpcConnector`, `CfnAutoScalingConfiguration`, observability config | `aws_apprunner_service`, `aws_apprunner_vpc_connector`, `aws_apprunner_auto_scaling_configuration_version`, `aws_apprunner_observability_configuration`, IAM access + instance roles | aws/container-service |
| CDK Docker image asset | `aws_ecr_repository` (+ lifecycle, scan on push); image built and pushed by CI, tag passed as `git_sha` | aws/container-service |
| `s3.Bucket` (uploads, web) + `BucketDeployment` | `aws_s3_bucket` + versioning/encryption/public-access-block/policy; web files uploaded by CI (`aws s3 sync`) instead of a deployment Lambda | aws/object-storage |
| `cloudfront.Distribution`, Function, OAC, origin-host-parser Lambda | `aws_cloudfront_distribution`, `aws_cloudfront_function`, `aws_cloudfront_origin_access_control`; origin host = `aws_apprunner_service.service_url` (no Lambda) | aws/cdn-edge |
| `secretsmanager.Secret` (JWT, imported OpenAI secret) | `aws_secretsmanager_secret` + `random_password` (JWT); data source for OpenAI secret | aws/secrets |
| `DockerImageFunction` DbSeedFn | `aws_lambda_function` (package_type Image) in isolated subnets — non-production only | product-stack (optional) |
| (not in CDK) WAF, ACM, Route 53, alarms | `aws_wafv2_web_acl` (us-east-1), `aws_acm_certificate`, `aws_route53_record`, `aws_cloudwatch_metric_alarm`, `aws_sns_topic` | aws/waf · dns-certs · observability |

### Day-to-day usage

```sh
# First time in an AWS account (platform admin, once)
cd infra/tofu/bootstrap && tofu init && tofu apply     # state bucket, KMS key, GitHub OIDC roles

# Any environment
cd infra/tofu/live/staging/frankfurt/kiorly-clinic
tofu init                                              # downloads providers, connects encrypted state
tofu fmt -check -recursive && tofu validate            # style + syntax
tflint --recursive && trivy config .                   # lint + security misconfiguration scan
tofu plan -var "git_sha=$GIT_SHA" -out plan.tfplan     # what will change (encrypted plan file)
tofu apply plan.tfplan                                 # apply exactly that plan
tofu output -json > outputs.json                       # AppUrl, ApiOrigin, DbSecretRef, … for smoke tests

# Adopt an existing resource instead of recreating it
import {
  to = module.kiorly_clinic.module.database.aws_db_instance.this
  id = "<existing-rds-identifier>"
}
# then: tofu plan → expect 0 changes
```

### CI/CD with GitHub Actions (OIDC, no keys)

Pipeline steps: 01 Pull request: fmt · validate · tflint · trivy → 02 Plan (read-only OIDC role; plan posted on PR) → 03 Merge to main: build & push image to ECR → 04 Apply staging (auto) → 05 Smoke (health/ready · login) → 06 Release tag + approval in GitHub Environment → 07 Apply prod (same plan path) → 08 Nightly drift (plan -detailed-exitcode → alert).

Figure 0.2 — Infrastructure pipeline. Nobody runs `tofu apply` against production from a laptop except documented break-glass.

| Workflow | Trigger | Role | Does |
|---|---|---|---|
| infra-plan.yml | PR touching `infra/tofu/**` | tofu-plan (read-only) | fmt, validate, tflint, trivy, `tofu plan`, comment summary |
| deploy.yml | Push to main | tofu-apply-staging | Build/push images, web sync, `tofu apply` staging, smoke |
| release.yml | Tag `v*` + approval | tofu-apply-prod | Same as staging against prod; migrations on boot; smoke |
| drift.yml | Nightly | tofu-plan | `tofu plan -detailed-exitcode`; exit 2 → on-call alert |

### Migration plan: CDK → OpenTofu for Kiorly Clinic

| Step | Action | Done when |
|---|---|---|
| T1 | Bootstrap state bucket, KMS key and GitHub OIDC roles in the target accounts (with HB05 multi-account setup) | `tofu init` works from CI |
| T2 | Write `modules/aws/*` and `product-stack`; add app adapters for secrets and email | Unit `tofu validate`; app tests green |
| T3 | Deploy staging greenfield with OpenTofu; run smoke, golden flows, load test | Staging parity with CDK stack |
| T4 | Production: Kiorly has no live tenants yet, so deploy production greenfield in the new prod account, restoring an RDS snapshot only if any data must be kept | Smoke green on new AppUrl |
| T4-alt | If real tenant data exists by then: set CDK removal policies to RETAIN, import VPC/RDS/S3 into OpenTofu, `cdk destroy` the rest, recreate stateless parts with OpenTofu | `tofu plan` shows 0 changes |
| T5 | Point domains (HB08) at the OpenTofu CloudFront; destroy the CDK stack; delete `infra/src` CDK code and deploy-aws.yml CDK steps | No CDK in repo; restore drill passes on new stack |

**WATCH:** Do T1–T5 before the Kiorly pilot starts (KX17) — it is the cheapest moment: no real patient data, no custom domains yet. After the pilot, the same migration needs the T4-alt import path and a maintenance window.

### If we ever switch cloud — the exit plan

1. Write `modules/<cloud>/*` implementations of the ten contracts; keep product-stack and every `live/*` file unchanged except the provider block and module source path.
2. Add the matching app adapters (storage, secrets, email) — the rest of the app is already portable.
3. Stand up staging on the new cloud; replicate data with PostgreSQL logical replication or dump/restore; sync object storage.
4. Cut over per product and per market cell during a maintenance window; keep the AWS stack read-only for rollback for 30 days.
5. Re-certify the market pack (hosting region, sub-processors, approvals) for the new provider before moving any real patient data.

## 02 Summary

A deliberately lean, serverless-leaning AWS footprint: no NAT gateways, no load balancers, no servers to patch — one infrastructure stack per product per data cell, defined in OpenTofu.

| Metric | Value |
|---|---|
| PRIMARY REGION | eu-central-1 (Frankfurt cell) |
| PER PRODUCT PER CELL | 1 stack — OpenTofu (migrating from CDK) |
| DATABASE | VPC + RDS Multi-AZ |
| APP RUNNER INSTANCES | 2 AZ, 1–25, 100 concurrent req/instance |
| RDS AUTOMATED BACKUPS | 35 days, PITR + deletion protection |
| NAT GATEWAYS / ALBS | 0 (VPC endpoints instead) |
| EDGE & ORIGIN | TLS 1.2, HTTP/2 + HTTP/3 |
| CI → AWS | OIDC, no long-lived keys |

### Hosting principles

| # | Principle | Consequence |
|---|---|---|
| H1 | Managed services first | App Runner, RDS, S3, CloudFront, Secrets Manager, Lambda — no EC2 fleet, no Kubernetes |
| H2 | Everything as code, cloud-portable | All resources in OpenTofu via cloud-neutral module contracts (§01); PRs run fmt/validate/plan; nightly drift detection; drift fixed in code, never in console |
| H3 | One stack per product per cell | Kiorly Clinic, Kiorex, Pharmacy, Lab each deploy independently; a cell = one AWS region with its own data stores |
| H4 | Private data plane | Databases in isolated subnets with no internet route; AWS APIs reached through VPC endpoints |
| H5 | Single public hostname per product | CloudFront serves the web app and proxies `/api/*` to the API origin — same-origin, no CORS |
| H6 | Cost-aware by default | No NAT, no ALB, CloudFront price class 100, small instances that scale out on demand |

## 03 Accounts, organization and identity (target)

Today Kiorly runs in a single AWS account. Before GA, move to an AWS Organization so production, staging and security tooling are isolated.

Figure 1 — Target multi-account layout (AWS Organizations + IAM Identity Center). Prod accounts separated by blast radius:
- Management account: Organizations · billing · SSO
- Security / Log archive: CloudTrail org trail · GuardDuty · Security Hub
- Shared services: ECR · Route 53 · CI roles
- Staging: all product stacks
- Sandbox / dev: engineer experiments
- Prod — Kiorly: Clinic · Pharmacy · Lab stacks
- Prod — Kiorex: marketplace · control plane
- Prod — Identity: Kiorex Account IdP

| Control | Standard |
|---|---|
| Human access | IAM Identity Center SSO with MFA; permission sets ReadOnly / Developer / Admin; no IAM users with console passwords |
| Break-glass | Root accounts with hardware MFA, credentials sealed; break-glass role alarmed on use |
| CI access | GitHub Actions OIDC → `AWS_DEPLOY_ROLE_ARN` per account (trust limited to repo and main branch); no access keys in GitHub |
| Guardrails (SCPs) | Deny leaving the organization, disabling CloudTrail/GuardDuty, creating IAM users with keys, and using regions outside the approved cell list |
| Tagging | `KiorlyHostCell`, `KiorlyDataRegion`, `KiorlyStackRole`, `KiorlyDataClass` (already applied to VPC, RDS, S3) + `Product`, `Env`, `Owner`, `CostCenter` |

## 04 Regions and data cells

A cell is a self-contained deployment of a product in one AWS region. Tenants are pinned to a cell by their market.

| Cell | AWS region | Runtime TZ | Stack ID | Status |
|---|---|---|---|---|
| frankfurt | eu-central-1 | Europe/Berlin | kiorly-clinics-management | Production |
| cairo | me-south-1 | Africa/Cairo | kiorly-cell-cairo | Prepared, not deployed |

- The cell registry lives in `platform/data-cells.json`; the infrastructure code refuses to deploy a cell to a region other than the registered one (CDK `resolveCellDeployConfig` today; an OpenTofu `precondition` on data-cells.json in the target).
- Every data store of a cell (RDS, automated backups, upload bucket, web bucket) is in the cell's region; stack outputs `HostCell` and `DataRegion` record it.
- Markets bind to a cell in `marketProductionBinding` (Egypt → frankfurt). A new market either reuses a cell or adds one — a configuration change plus a new stack, not a code fork.

## 05 Network architecture

One VPC per cell stack, two Availability Zones, public and isolated subnets only.

Figure 2 — Cell network. Isolated subnets have no route to the internet; AWS APIs are reached privately. Flow: Internet users → CloudFront (edge, TLS, cache) → HTTPS /api/* → App Runner service (AWS-managed network) → egress via VPC connector (public subnets, SG) → port 5432 → RDS PostgreSQL 16 (primary + standby); port 443 → interface endpoints (Secrets Manager · KMS · STS); S3 gateway endpoint; DbSeedFn Lambda in VPC. VPC · 2 AZs · public subnets (connector ENIs) + isolated subnets (RDS, endpoints, Lambda) · no NAT.

| Element | Configuration (as built) | Why |
|---|---|---|
| VPC | `maxAzs: 2`, `natGateways: 0`, default security group locked (`restrictDefaultSecurityGroup`) | HA across two AZs at the lowest fixed cost |
| Subnets | Public (App Runner connector ENIs) + PRIVATE_ISOLATED 'Database' (RDS, endpoints, seed Lambda) | Data plane unreachable from the internet |
| S3 gateway endpoint | Free gateway endpoint for S3 | Uploads and assets without NAT |
| Interface endpoints | Secrets Manager, KMS, STS in isolated subnets; hostnames injected as `*_VPCE_HOST` env vars | Secrets and credentials without internet egress |
| Security groups | Connector SG → RDS 5432; seed-Lambda SG → RDS 5432; endpoint SGs allow 443 from connector/Lambda | Least-privilege east-west traffic |
| Egress | App Runner `egressType: VPC` through the connector | API reaches RDS privately; external APIs (Meta, PSPs, OpenAI) — see note |

**WATCH:** Outbound internet from the API. With `egressType: VPC` and no NAT gateway, calls from the API to public endpoints (WhatsApp Cloud API, Paymob/Fawry, OpenAI EU, SES) need a path. Verify in staging that each integration works; if not, add a single NAT gateway (≈USD 35–45/month + data) or route those calls through a small egress proxy. Track as hardening item HB07.

## 06 Request path

How a page load and an API call travel through the stack. Participants: Browser/PWA · CloudFront · S3 web bucket · App Runner (Nest) · RDS / S3 uploads.

1. GET /clinic/today
2. SPA rewrite → /index.html
3. fetch index.html (no cache)
4. html
5. html + hashed /assets/* (cached)
6. GET /api/v1/appointments
7. origin HTTPS (no cache, viewer headers)
8. Prisma query / presigned URL
9. rows
10. JSON

Figure 3 — Same-origin model: no separate API hostname, no CORS.

| CloudFront behaviour | Origin | Cache policy | Notes |
|---|---|---|---|
| Default (`*`) | S3 web bucket (OAC, read-only) | CachingOptimized | Viewer-request Function rewrites extension-less paths to /index.html |
| `/index.html`, `/build-id.json` | S3 | CachingDisabled | New deploys visible immediately; build id drives client refresh |
| `/api/*` | App Runner (HTTPS, TLS 1.2) | CachingDisabled | All methods; AllViewerExceptHostHeader origin request policy |
| Distribution | — | — | Price class 100, TLS 1.2_2021 minimum, HTTP/2 + HTTP/3, compression on |

## 07 Component reference

Every AWS service in use or planned, with today's configuration and the production target.

| Service | Role | As built (Kiorly Clinic) | Production target / note |
|---|---|---|---|
| Amazon CloudFront | Edge delivery, TLS, SPA, API proxy | 1 distribution; price class 100; OAC to S3; Function for SPA routing | Custom domains (app.kiorly.com) with ACM cert in us-east-1; WAF attached |
| AWS WAF | Layer-7 protection | Rule intent in `platform/waf-rules.json` (rate limit on auth/signup, AWS Common + Known Bad Inputs); WebACL not found in the stack file | Attach CloudFront-scope WebACL before public launch (HB01) |
| AWS App Runner | API compute (NestJS container) | 1 vCPU / 2 GB; autoscale min 1, max 25, 100 concurrent requests per instance; health /api/v1/health/live every 10 s; observability configuration | Min 2 instances in production for zero-downtime and AZ resilience (HB04) |
| App Runner VPC connector | Private egress to RDS/endpoints | Public subnets, dedicated SG | — |
| Amazon ECR | Container images | CDK image asset (linux/amd64 built in CI) | Image scanning on push; lifecycle to keep last 30 images |
| Amazon RDS for PostgreSQL 16 | Primary database | db.t4g.micro; gp3 20 GB (autoscale 100 GB); encrypted; Multi-AZ; 35-day backups; deletion protection; snapshot on stack delete; postgresql logs to CloudWatch; TZ parameter group | Right-size to db.t4g.medium (or m7g.large) at GA; Performance Insights; RDS Proxy when connections grow (HB02) |
| Amazon S3 — uploads | Patient documents, encounter files, expense proofs | Block public access; SSE-S3; TLS enforced; RETAIN on delete; tagged tenant-uploads | Versioning + SSE-KMS with customer-managed key; lifecycle for audio purge (HB03) |
| Amazon S3 — web | SPA assets | Block public access; SSE-S3; TLS enforced; replaced each deploy (BucketDeployment, prune) | — |
| AWS Secrets Manager | DB credentials, JWT secret, OpenAI key | RDS-generated secret; JwtSecret (48 chars); OpenAI secret imported by name; injected as App Runner runtime secrets | Rotation: DB 90 days (managed rotation), JWT with session-logout plan |
| AWS KMS | Encryption keys | AWS-managed keys (RDS storage); KMS endpoint for API | Customer-managed keys for RDS and uploads in production |
| AWS Lambda — DbSeedFn | Idempotent post-deploy migrate + seed | Container image (Node 22, 3,008 MB, 15 min, in isolated subnets) | Disable demo seeding in production accounts; keep migrate-only |
| AWS Lambda — origin host parser | Custom resource for CloudFront origin | 30 s utility function | — (retired with OpenTofu) |
| Amazon CloudWatch | Logs, metrics, alarms | App Runner/Lambda logs; RDS PostgreSQL logs | Alarm set in §13; log retention 90 days (app) / 1 year (audit) |
| Amazon SES (eu-central-1) | Transactional email | Code ready (MS05) | Verify mail.kiorly.com DKIM/SPF/DMARC (NH-016); production access |
| AWS CloudFormation / CDK → OpenTofu | Provisioning | CDK stack `kiorly-clinics-management`; outputs AppUrl, AppRunnerServiceUrl, DbSecretArn, DbSeedFunctionName, HostCell, DataRegion | Retired: OpenTofu state per product/env/cell with the same outputs (§01) |
| IAM | Roles | App Runner instance role (S3, Secrets); access role for ECR; Lambda roles; GitHub OIDC deploy role | Permission boundaries; Access Analyzer |
| Route 53 + ACM | DNS, certificates | CloudFront default domain today | Hosted zones for kiorly.com / kiorex.com; DNSSEC; CAA (KX19) |

## 08 Ecosystem stacks

Every product reuses the Kiorly stack pattern; differences are listed per product.

Figure 4 — Ecosystem on AWS: identical building blocks, separate stacks and databases per product.
- Edge: CloudFront + WAF per product · Route 53 · ACM
- Kiorly Clinic: App Runner API · RDS PG16 · S3 uploads · Seed/migrate Lambda
- Kiorex: App Runner API · RDS PG16 · Flag control plane · OpenSearch (M9) · SNS/FCM push
- Kiorly Pharmacy · Lab: App Runner API each · RDS PG16 each · S3 (reports, scans) · Analyzer bridge (Lab)
- Identity: Managed IdP (e.g. Cognito) · OTP sender Lambda · WhatsApp/SMS providers
- Shared: ECR · CloudTrail · GuardDuty · Security Hub · AWS Backup · Budgets

| Stack | Account (target) | Compute | Data | Extra components | When |
|---|---|---|---|---|---|
| kiorly-clinics-management | Prod — Kiorly | App Runner 1–25 | RDS PG16 Multi-AZ, S3 | DbSeedFn | Live |
| kiorex-platform | Prod — Kiorex | App Runner 2–25 | RDS PG16 Multi-AZ, S3 | Flag control plane module, scheduled jobs (EventBridge Scheduler), OpenSearch from M9, ElastiCache Redis when slot cache needs it | M1–M6 |
| kiorex-account | Prod — Identity | Managed IdP + Lambda triggers | IdP user store | OTP sender Lambda, custom domain account.kiorex.com | M1–M6 |
| kiorly-pharmacy | Prod — Kiorly | App Runner | RDS PG16, S3 | Offline POS sync endpoint | M9–M13 |
| kiorly-lab | Prod — Kiorly | App Runner | RDS PG16, S3 (reports) | Analyzer bridge: on-premise agent → HTTPS API (no inbound to lab LAN) | M15–M19 |
| kiorex-contracts | — (CI only) | — | — | Published as npm packages; no runtime | M1 |

**NOTE:** Products talk to each other only over HTTPS (HMAC APIs and webhooks, KX09) — never through shared databases or VPC peering. This keeps each stack independently deployable and each account a separate blast radius.

## 09 Compute, boot sequence and scaling

Figure 5 — App Runner boot: migrations run on boot; seeding never does. Steps: 01 Container start (entrypoint binds 3000; interim health = starting) → 02 Resolve DB secret via VPC endpoint → 03 `prisma migrate deploy` (expand-contract) → 04 Nest boots (3001 proxied) → 05 / 06 Ready: `/health/ready` db ok.

| Setting | Value | Rationale |
|---|---|---|
| Instance size | 1 vCPU / 2 GB | Cold Nest + Prisma migrate needs ≥0.5 vCPU to stabilise inside App Runner health windows |
| Autoscaling | min 1 · max 25 · 100 concurrent requests/instance | Up to 2,500 concurrent requests per cell before raising limits |
| Health check | HTTP `/api/v1/health/live`, interval 10 s, timeout 10 s, healthy 1, unhealthy 20 | Tolerates long migrations; readiness checked separately by smoke tests |
| Readiness | `/api/v1/health/ready` returns `database: ok` | Gate for post-deploy smoke and load tests |
| Load SLO smoke | `npm run test:perf`: 2,000 concurrent health calls, ≥99.9% success | Regression guard |
| Scale-out path | Raise max size → RDS Proxy → read replica → extract hot module (KX08) | No re-platforming needed to ≈10× |

## 10 Data, storage and encryption

| Store | Contents | Encryption | Retention / lifecycle | Deletion safety |
|---|---|---|---|---|
| RDS PostgreSQL | All tenant business and clinical data | At rest KMS, TLS in transit | 35-day automated backups (PITR); long-term retention via snapshot/export runbook | Deletion protection; snapshot on stack delete |
| S3 uploads | Documents, scans, scribe audio | SSE-S3; TLS enforced | Audio purged on sign-off unless retention opted in (app logic) | Bucket retained if stack deleted |
| S3 web | Built SPA | SSE-S3 | Replaced each deploy | Destroyable |
| Secrets Manager | Credentials | KMS | Versioned | Recovery window |
| CloudWatch Logs | App and DB logs (no PHI) | Service-managed | Set explicit retention (HB06) | — |

## 11 Security baseline

| Layer | Control | Status |
|---|---|---|
| Edge | HTTPS only, TLS 1.2, HTTP/3; OAC so S3 is never public | Built |
| Edge | WAF WebACL with rate limits and AWS managed rules | HB01 |
| Network | Isolated DB subnets, no NAT, endpoint-only AWS API access, restricted default SG | Built |
| Data | RDS encryption, S3 TLS enforcement and public-access block | Built |
| Data | Customer-managed KMS keys for RDS and uploads; S3 versioning | HB03 |
| Identity | GitHub OIDC deploy role; App Runner instance role scoped to its buckets/secrets | Built |
| Identity | IAM Identity Center + SCP guardrails across an AWS Organization | HB05 |
| Detection | CloudTrail (org trail), GuardDuty, Security Hub (AWS Foundational), IAM Access Analyzer, AWS Config | HB05 |
| Application | Rate limits, HMAC, MFA, tenant isolation, audit (KX10) | Built |
| Testing | External penetration test | NH-017 |

## 12 Deployment pipeline

Figure 6 — `.github/workflows/deploy-aws.yml` with `scripts/cicd-deploy.sh`, `cicd-post-deploy-seed.sh`, `cicd-post-deploy-smoke.sh`. Steps: 01 Push to main (concurrency: latest wins) → 02 CI tests (typecheck · unit · integration; fail fast) → 03 Web build → `cdk deploy` (OIDC role) → 04 Wait App Runner rollout done → 05 Post-deploy seed (migrate · DbSeedFn) → 06/07 Smoke (ready + login + assistant).

**NOTE:** This is the current CDK pipeline. The target OpenTofu pipeline (plan on PR, apply to staging on merge, approved apply to production, nightly drift) is in §01.

- PR validation: `pr-synth-build.yml` runs `cdk synth` without credentials, plus App Runner connector name checks (prevents the known AlreadyExists replacement failure).
- Rollback: redeploy the previous commit (images are immutable); migrations are expand-contract only, so the previous API version runs against the new schema.
- Promotion (target): main → staging account automatically; production on a tagged release with manual approval in GitHub Environments.
- Troubleshooting: the deployment guide §16 lists known failure modes (connector replacement, seed image missing files, entrypoint path, slow migrations, `ROLLBACK_COMPLETE`).

## 13 Observability and alarms

| Alarm (CloudWatch) | Threshold (starting point) | Route |
|---|---|---|
| App Runner 5xx rate | >2% for 5 min | On-call (Slack + WhatsApp) |
| App Runner p95 latency | >1.5 s for 10 min | On-call |
| Active instances at max | = max size for 15 min | Raise limit / investigate |
| RDS CPU | >80% for 15 min | On-call |
| RDS free storage | <20% | On-call |
| RDS connections | >80% of max | Plan RDS Proxy |
| RDS replica lag / failover event | Any | Notify |
| Lambda DbSeedFn errors | Any in deploy window | Block release |
| Application alerts | Outbox lag, settlement failure, payment webhooks, WhatsApp failures, signup drop (KX10) | Runbooks |
| Budget | 80% / 100% of monthly budget; Cost Anomaly Detection | Founders |

Traces and errors: App Runner observability configuration + OpenTelemetry exporter (`OTEL_EXPORTER_OTLP_ENDPOINT`) and Sentry. Dashboards per product: golden signals (traffic, errors, latency, saturation) and business signals (bookings, check-ins, settlement status).

## 14 Backup, restore and disaster recovery

| Scenario | Mechanism | RPO | RTO |
|---|---|---|---|
| Bad deploy | Redeploy previous image; feature flag OFF (ADR-023) | 0 | ≤30 min |
| Accidental data change | RDS point-in-time restore to new instance, copy back affected rows | ≤5 min | ≤4 h |
| AZ failure | RDS Multi-AZ automatic failover; App Runner multi-AZ | 0 | Minutes |
| Database lost/corrupted | Restore latest snapshot / PITR in the cell's region | ≤5 min | ≤4 h |
| Region outage | Redeploy stack from code in the same cell once the region recovers; customers use PWA offline 'today' view and printed schedules | ≤5 min | Region-dependent |
| Uploads deleted | S3 versioning (HB03) | 0 | ≤1 h |

**NEEDS HUMAN:** Quarterly restore drill with `scripts/backup-restore-drill.sh --mode aws` (restores the latest snapshot to a temporary instance in eu-central-1, records RPO/RTO in `Docs/SC08_BACKUP_RESTORE_DRILL_REPORT.md`). First drill is a GA blocker (NH-018).

## 15 Environments

| Environment | Account | Purpose | Data | Deploy |
|---|---|---|---|---|
| Local | Developer | Docker Postgres, local uploads | Synthetic seed | Manual (laptop) |
| Staging | Staging (target) | Rehearsal, WhatsApp/PSP sandboxes, load tests (NH-020) | Synthetic; demo:reset | Every merge to main (≤60 s smoke) |
| Production | Prod — per product | Live tenants | Real | Tagged release + approval |

## 16 Cost profile (indicative)

Planning ranges only — confirm with the AWS Pricing Calculator for eu-central-1 and actual usage. Excludes data transfer spikes and third-party services (WhatsApp, PSPs, OpenAI).

Figure 7 — Indicative AWS run cost by stage (stacked: App Runner; RDS Multi-AZ; VPC endpoints / NAT; CloudFront + WAF + S3; Observability & security; Other (Lambda, Secrets, SES, OpenSearch)). Totals shown per stage:

| Stage | Indicative total (USD/month) |
|---|---|
| Pilot | ≈200 |
| Egypt GA (Kiorly only) | ≈940 |
| M18 (Kiorly + Kiorex) | ≈2,440 |
| M36 (4 products, 2 cells) | ≈7,020 |

(Pilot/GA/M18/M36 stage labels mapped by order of appearance; stage-to-value pairing inferred from ascending order.) KX13 budgets USD 2.5k–15k/month for cloud, which covers these ranges with headroom.

| Cost lever | Effect |
|---|---|
| No NAT / no ALB | Saves ≈USD 50–100/month per stack at small scale |
| Interface endpoints | Fixed ≈USD 8–10/month per endpoint per AZ — share via a central endpoint VPC when stacks multiply |
| App Runner idle | Provisioned instances bill memory only when idle |
| RDS Savings Plans / reserved | ≈30–40% off once instance sizes stabilise (after M12) |
| Graviton (t4g/m7g) | Better price-performance than x86 |
| Budgets + anomaly detection | Alert at 80% and on unexpected spend |

## 17 Hardening backlog before GA

Items found by comparing the as-built stack with production best practice. Owners and timing feed KX17.

| ID | Item | Priority | Effort |
|---|---|---|---|
| HB01 | Attach CloudFront-scope WAF WebACL implementing `platform/waf-rules.json` (rate limits on auth/signup, AWS managed rules) | GA blocker | S |
| HB02 | Right-size RDS from db.t4g.micro to db.t4g.medium (or m7g.large); enable Performance Insights | GA blocker | S |
| HB03 | S3 uploads: versioning, SSE-KMS with customer-managed key, lifecycle rules | Before GA | S |
| HB04 | App Runner min instances 2 in production | Before GA | XS |
| HB05 | AWS Organization: separate prod/staging/security accounts, IAM Identity Center, CloudTrail org trail, GuardDuty, Security Hub, SCPs | Before GA | M |
| HB06 | CloudWatch alarm set (§13) and explicit log retention | GA blocker | S |
| HB07 | Verify outbound internet path for third-party APIs from VPC egress (add NAT or egress proxy if needed) | GA blocker | S |
| HB08 | Custom domains + ACM (us-east-1) + Route 53 for kiorly.com/kiorex.com; DNSSEC, CAA | GA blocker | S |
| HB09 | Disable demo seeding in production; keep migrate-only Lambda | Before GA | XS |
| HB10 | Secrets rotation (DB managed rotation; JWT rotation runbook) | After GA | S |
| HB11 | RDS Proxy and read replica when connections/CPU trends require | Trigger-based | M |
| HB12 | AWS Backup plan for RDS snapshots with vault lock (same region) | After GA | S |

## 18 Operations quick reference

```sh
# Deploy (cell frankfurt)
KIORLY_HOST_CELL=frankfurt AWS_REGION=eu-central-1 bash scripts/deploy-aws.sh
# Post-deploy smoke
npm run sync:aws:smoke
# Re-run idempotent seed (non-prod)
aws lambda invoke --function-name <DbSeedFunctionName> /tmp/seed-out.json
# Restore drill (dry run / real)
bash scripts/backup-restore-drill.sh --mode dry-run | --mode aws --source-instance <id> --restore-instance-id <tmp>
# API logs: CloudWatch /aws/apprunner/<service>/.../application (search "[boot]", "Nest exited")
# Stack outputs: AppUrl · AppRunnerServiceUrl · DbSecretArn · DbSeedFunctionName · HostCell · DataRegion
```

## 19 Sources & evidence

Every external figure in this document traces to one of these sources; internal facts trace to the Kiorly repository (mshall/clinics-management, commit 6b24a79, 19 Nov 2026) or to founder decisions recorded in KX01.

- mshall/clinics-management: `infra/src/kiorly-clinics-management-stack.ts`, `infra/src/data-cells.ts`, `platform/data-cells.json`, `platform/waf-rules.json`, `scripts/backup-restore-drill.sh`, `Docs/AWS_Cloud_Deployment_Guide.md` (commit 6b24a79).
- Cost ranges are planning estimates by the author; validate with the AWS Pricing Calculator (eu-central-1) before budgeting.

## 20 Storage lifecycle and cost model (Proposed, 23 Nov 2026)
| Rule on the uploads bucket | Default |
|---|---|
| Abort incomplete multipart uploads | 7 days |
| Expire non-current versions (keep newest 3) | 90 days |
| Tier medical prefixes to Intelligent-Tiering (objects of 128 KB or more) | 30 days |
| Expire `imports/` staging objects | 30 days |
| Current medical documents | never expired by lifecycle |

Also: CORS driven by an allowed-origins variable (needed for presigned uploads), a CloudWatch alarm when stored bytes grow more than 30 percent in 7 days, optional S3 inventory. Cost example: 1,000 clinics at 5 GB each is 5 TB; Standard storage is roughly USD 115 a month, and with tiering plus image compression the estate trends toward USD 40 to 60 a month. Assumptions and prices must be re-checked against the current AWS price list. Detail: KX-25 §04 and §09.

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built. Rev 2.4: where this section differs from the Rev 2.4 as-built update at the end of the volume, the end section wins.

- **Request path and component reference (sections 06, 07)**: Proposed CloudFront behaviours for the public site role (`/{ar,en}/*`, sitemaps, `robots.txt`, `/.well-known/*`) with HTML `s-maxage=300` and stale-while-revalidate 3600, path-only cache key and purge on `LISTING_STATUS_CHANGED` and `PROVIDER_PROFILE_UPDATED`; module `modules/aws/cdn-edge` and `product-stack` get a role variable. A widget host with a per-request CSP. Validate only; nothing applied (FD-17).
- **Sizing (section 09 and 16)**: SSR runs as a role of the Kiorex API image; whether it is a separate App Runner service from day one is an Open decision (cost and sizing).
- **Data cells (section 04)**: growth data lives in the Kiorex cell (`frankfurt`); no cross-cell routing until a second cell exists.
- **Observability (section 13)**: growth alarms: decision replay mismatch, public 5xx, sitemap freshness, outbox lag p95 over 60 s (KX-28 section 11).
- **Storage**: no new storage tier; touch and event tables use the product database and its backups (section 14).

## Rev 2.4 as-built update (24 Nov 2026)
Rev 2.4 verification (24 Nov 2026): checked against the repositories, with the suites re-run the same day (counts in KX-33 section 04). As-built means in code with a passing test on the local stack; that verification deployed and pushed nothing, and every provider is mocked. This section wins over the Growth Engine update above wherever they differ.

- **Infrastructure as built.** No new OpenTofu module was added in Rev 2.4. The growth work extended two existing modules and validated them with `tofu fmt` and `tofu validate` only; nothing was applied. `modules/aws/cdn-edge` gained `site_enabled`, `site_origin_domain` and `spa_noindex_header` (default off); `modules/product-stack` gained the same site variables plus two Secrets Manager containers created empty, `lead_signing_secret` and `growth_link_token_secret`, each with an `_inject` switch that must stay false until a value has been written (App Runner cannot start an instance whose secret has no value). Prod and staging `kiorex-platform` live roots wire them.
- **SSR and widget hosts.** The public site and the widget host are roles of the same Kiorex API image (`SITE_ROLE`, `WIDGET_HOST`); a second App Runner service is an Open decision (FD-26) and is not created. `apps/api/Dockerfile` (new) builds the API, the SSR bundle and the widget; `Dockerfile.seed` seeds. CDN behaviours for `/{ar,en}/*`, `/sitemap*.xml`, `/robots.txt` and `/.well-known/*` are designed, not applied; the CDN purge adapter is a mock.
- **Secrets (values NEEDS_HUMAN).** `/kiorex-platform/<env>/growth-link-token`, `/kiorex-platform/<env>/partner-lead-signing`, and in each product `/kiorly-<product>/<env>/kiorex-lead-signing` (the same value as the Kiorex one). The staging tfvars set `SANDBOX_PAYMENTS_ALLOWED` and `ALLOW_INSECURE_DEFAULT_SECRETS` to true for bring-up only; production must not. `TRUSTED_PROXY_HOPS=2` and `CORS_ORIGINS` must be set in production (pentest). The WAF rule files are intent only.
- **Docker.** The API image build passes (contracts lockfile integrity fixed); the final image was not run in a cloud environment.
- Not verified: any apply, any DNS, CloudFront behaviour, WAF attachment, sizing under SSR load (the in-memory SSR index suits thousands of providers, not 50,000).

## Rev 2.8: environments, DNS, certificates and the Huawei Cloud option (27 Nov 2026, ADR-059 Accepted)

> **Status** Deployment, 27 Nov 2026. Only Kiorly Clinic is deployed, on AWS (account 990597228737, eu-central-1, environment kx-test): it was deployed on 24 and 25 Nov 2026 and the deploy of `main` succeeded on 27 Nov 2026. Kiorex, Passport, Pharmacy and Lab are not deployed. Where this volume says "nothing is deployed", it describes the date it was written and those four products.

HB08 (custom domains, ACM, Route 53) is refined: Route 53 is introduced first by delegating the `test.kiorex.com` and `test.kiorly.com` child zones (two NS record sets at the registrars), then the apex zones before pilot; certificates are per environment and domain (`<env>.<domain>` plus one wildcard level); the pilot environment runs on the production plane; hostnames come from `_docs/registry/service-url-registry.yaml`. No new-environment AWS resource has been created.

<!-- kx-diagram: dns-cert-flow -->

> **Decision** The founder's initial production hosting decision is Huawei Cloud (Egypt data residency). AWS remains the cloud of kx-test. Every environment is configurable through OpenTofu behind `provider_name = aws | huawei`, so the choice is reversible per environment. This volume documents the AWS reference; the Huawei modules mirror it (ECS, EVS, OBS, CDN, SWR, DNS, SCM, CSMS) and are validated only.

> **Risk** Not asserted: Huawei Cloud region availability for Egypt, Egyptian data residency, CBE requirements, ARM flavours, CDN service area, managed PostgreSQL flavours. The founder and counsel verify each before any apply.

<!-- kx-diagram: cicd-provider-switch -->

| Component | AWS (kx-test) | Huawei Cloud (option) |
|---|---|---|
| Compute | one ARM host, SSM access, no SSH | ECS and EIP, console access, pull deploy |
| Database | private PostgreSQL, encrypted data volume, snapshots | EVS volume with KMS, CBR vault; or managed RDS for PostgreSQL |
| Object storage and backups | S3 with SSE, versioning, lifecycle | OBS with KMS and lifecycle |
| CDN and certificates | CloudFront and ACM | Huawei CDN and SCM (needs a custom domain) |
| DNS | Route 53 child zones | Huawei DNS zones |
| Registry and secrets | ECR, Secrets Manager (containers only) | SWR, CSMS |

| kx-test cost line | Estimate |
|---|---|
| Planned resources of the single-host design | about USD 45 per month (42 to 52), an estimate to verify in Billing, not a quote |
| Domain layer (two Route 53 child zones, certificates, aliases) | about USD 1 to 3 per month, estimate |
| Huawei Cloud production | not priced; use the provider's calculator for the chosen region |

> **Action needed** Founder: state bucket, plan review and apply per environment; NS records at the registrars; GitHub Environments test, pilot and prod; least-privilege deploy roles before pilot; a separate production account before pilot.

