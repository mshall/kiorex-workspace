# AWS DEV/TEST environment plan for the other products

Written 27 Nov 2026 from read-only AWS CLI calls (account 990597228737, eu-central-1, IAM user `kiorly_clinics`) and the repo code. Nothing was created, changed, deployed or pushed. No secret value was read (names only). Estimates are eu-central-1 list prices, rounded; verify in the Billing console.

Goal: a cheap, fast, disposable DEV/TEST environment for kiorex-platform (API, patient web, ops console), kiorex-account (Passport), kiorly-pharmacy and kiorly-lab (plus a DEV copy of Clinic so the booking-to-commission flow can be tested), using the Clinic deployment pattern. A later, separate full cloud infrastructure follows, so nothing here is meant to be permanent.

---

> **Update 27 Nov 2026: code gaps closed (local commits, host-agnostic).** Passport: Dockerfile, client URI env override, hardened public DEV mode, kiorly-home dev tier (kiorex-account 3b7d8fb). Pharmacy and Lab: runtime API and web Dockerfiles, bounded migration retry, configurable prefix/CORS, storage warning (19f1511, 93d6a11). Platform: Dockerfile built and booted, OIDC build args and `scripts/build-frontends.sh`, in-process job scheduler hardened (run on start, tick log, disable switch; run exactly ONE container with jobs on), growth-admin overview bug fixed (9337344). Still open: infra code (CDK/EC2), URL registry in SSM, workflows, secrets, two-pass bootstrap, founder decisions D1-D3.

## 1. What exists today in the account

| Resource | Detail | Est. USD / month |
|---|---|---|
| CloudFormation stacks | `kiorly-clinics-management` (UPDATE_COMPLETE), `CDKToolkit` (bootstrap) | 0 |
| VPC `vpc-04e55af5fac8a835b` | 10.0.0.0/16, 2 AZ, 2 public + 2 isolated /18 subnets, no NAT, S3 gateway endpoint. Default VPC `vpc-0183d7eebbc130412` exists, unused | 0 |
| VPC interface endpoints | Secrets Manager, KMS, STS, each in 2 AZs (6 endpoint ENIs) | 50 to 55 |
| RDS | `kiorly-clinics-management-postgres...` db.t4g.micro, PostgreSQL 16.13, 20 GB, **Multi-AZ**, private, 35-day backups, deletion protection (holds the LIVE Clinic tenant data) | 30 to 33 |
| App Runner | service `kiorly-api-nagement` RUNNING (1 vCPU / 2 GB, min 1, max 25), VPC connector `kiorly-clinic-connector` | 20 to 30 |
| CloudFront | `E1DE0H2K3M17YL` = d92iz83i79c05.cloudfront.net, PriceClass_100, SPA from S3 + `/api/*` to App Runner | 0 to 2 |
| S3 | web bucket, API uploads bucket (retained, versioned), CDK assets bucket, **6 old `dbbackupbucket` buckets (Jun 2026, left over from earlier stack versions)** | 1 |
| Lambdas | DbSeedFn (Docker, in VPC) plus CDK helper functions | 0 |
| ECR | CDK container-assets repo (image per deploy; old images accumulate) | 1 to 2 |
| Secrets Manager | 3 names: JWT secret, RDS-generated secret, `kiorly-clinics-management/openai-api-key` | 1.2 |
| IAM | OIDC provider `token.actions.githubusercontent.com`; role `GitHubAction-AssumeRole` (AdministratorAccess) | 0 |
| Logs / misc | CloudWatch logs, RDS PG log export | 2 to 4 |
| **Total** | | **about 110 to 130** |

Findings that matter for the new environment:

1. **The OIDC role is already reusable by every repo.** Its trust policy allows `repo:mshall/*` with audience `sts.amazonaws.com`, so kiorex-platform, kiorex-account, kiorly-pharmacy and kiorly-lab can assume `GitHubAction-AssumeRole` today by setting the same `AWS_DEPLOY_ROLE_ARN` secret. No IAM change is needed. It is AdministratorAccess: acceptable for dev, replace in the full infrastructure.
2. **The second account is not usable.** The profile `aws-kiorex-profile` resolves to 599243104052 (user `cursor-admin`, the account all the OpenTofu staging tfvars point at), but a Service Control Policy denies CloudFormation, RDS and App Runner there. Deploy the dev environment in 990597228737 and keep it separated by name prefix (`kxdev-`) and tags (`Env=dev`).
3. **Do not share the Clinic RDS or VPC.** It holds live tenant data (Dr Ahmed Shall Group), is Multi-AZ with 35-day backups and deletion protection, and a Clinic push to `main` deploys. A dev database next to it would add blast radius for no saving.
4. **The 3 interface endpoints cost more than the database.** They exist only because the Clinic App Runner uses a VPC connector without NAT. The dev design below avoids them (section 4).
5. The OpenTofu stacks under `infra/tofu/live/staging` in every repo are complete but **never applied** and are not the right tool for this: one VPC, one RDS and KMS keys per product, Cognito for Passport, custom domains (`*.staging.kiorex.com`, not owned or delegated yet), target account 599243104052 (blocked). They stay as the blueprint for the later full infrastructure.

---

## 2. The Clinic stack pattern (what is reusable)

Source: `clinics-management/infra/src/kiorly-clinics-management-stack.ts` (CDK, one stack), deployed by `.github/workflows/deploy-aws.yml` and `scripts/cicd-deploy.sh`.

Pattern in one picture:
`GitHub push -> OIDC role -> docker build (asset) -> ECR -> App Runner (port 3000, health /api/v1/health/live, env + Secrets Manager refs) <- CloudFront (/api/* origin) -> S3 SPA`. The SPA calls relative `/api`, so there is no CORS and no `VITE_API_URL`. Migrations run on boot (`PRISMA_MIGRATE_ON_BOOT=true`, entrypoint also builds `DATABASE_URL` from the RDS secret). Demo seed runs from a seed Lambda after deploy. A post-deploy smoke script curls `/api/v1/health/ready` then logs in.

Parameters and knobs worth copying (all in the stack and `main.ts`):

| Parameter | Clinic value | Dev value to use |
|---|---|---|
| Region / cell | `frankfurt` / eu-central-1, TZ Europe/Berlin | same region; TZ per product (`Africa/Cairo` for Egypt market) |
| VPC | new, 2 AZ, no NAT | default VPC (RDS only) |
| RDS | PG 16, t4g.micro, 20 GB (max 100), Multi-AZ, 35d backups, deletion protection, SNAPSHOT removal | PG 16, t4g.micro (t4g.small if slow), 20 GB, **single AZ**, 1d backup, no deletion protection, DESTROY |
| App Runner size | 1 vCPU / 2 GB, min 1, max 25, concurrency 100 | 1 vCPU / 2 GB (Nest + Prisma migrate on boot needs it), min 1, max 2 |
| Health | `/api/v1/health/live` (10 s interval, unhealthy threshold 20) | same; smoke on `/health/ready` |
| Image | `DockerImageAsset`, linux/amd64, GHA buildx cache | same |
| Web | S3 (OAC) + CloudFront, PriceClass_100, SPA rewrite function skipping `/api` | same, one per web app |
| Secrets | JWT in Secrets Manager (`secretName:jwt::` JSON-key reference), DB secret | one JSON secret per product (`kxdev/<product>`), DB URL as a secret |
| Deploy scope | auto `web | api | full` by changed paths (`scripts/detect-deploy-scope.sh`) | keep only `full` and `web` |

Reusable verbatim: the CloudFront function, the origin-host parser custom resource (App Runner URL to CloudFront origin), the `web | api | full` split, the wait-for-App-Runner script, the smoke script shape. Not reusable as is: the stack bundles its own VPC, RDS, endpoints and seed Lambda, fixed physical names (`appRunnerPhysicalNames`), `stackId` from the cell config, and `KiorlyClinics`-specific tags, so a second copy in the same account collides on names. Do not parameterise the Clinic stack for this; add a small separate dev app (section 5).

---

## 3. Per-product inventory and gaps

Common facts (all four plus Clinic): NestJS 11 + Prisma 7 (Passport uses plain `pg`), PostgreSQL 16, Node 26, `@kiorex/contracts` from `vendor/*.tgz` (Dockerfiles must `COPY vendor`), HMAC-signed partner calls, outbox webhooks, **no Redis anywhere** (platform tofu has `enable_redis=false`, no code dependency), no queue service (outbox tables + in-process timers), no OpenSearch needed. Local ports and prefixes are in `INTEGRATION.md`.

### 3.1 kiorex-platform (API, patient web, ops console, widget)

- **Runtime pieces:** `apps/api` (Nest, port 4000, prefix `/api/v1`, also serves the SSR public site and the widget when `SITE_ROLE=all`); `apps/web` (patient SPA, Vite); `apps/ops` (ops console / super admin SPA, Vite); `apps/widget` (served by the API from `WIDGET_DIST`); `apps/mobile` (Expo, not deployed). Background work (`JOBS_ENABLED`, outbox poll, flags, dunning, commission statement) runs **in-process**; there is no job runner.
- **Dockerfile:** `apps/api/Dockerfile` exists (new, marked PROPOSED, never built in CI; has `HEALTHCHECK`, entrypoint `docker-entrypoint.mjs`: DB secret to `DATABASE_URL`, optional `prisma migrate deploy`, then `dist/main.js`). `Dockerfile.seed` (Lambda image) exists.
- **Health:** `GET /api/v1/health/live`, `/providers` (internal only), `/ready` (DB).
- **Migrations / seed:** `npm run db:deploy -w apps/api`; seeds `db:seed`, `db:sync:providers`, `db:seed:demo` (needs `DEMO_SEED_ALLOWED=true`, `KIORLY_ENV=dev`, a DATABASE_URL whose name does not look like prod). Order matters (provider sync pulls from Clinic/Pharmacy/Lab).
- **Env (names only):**
  - Required in `NODE_ENV=production` (refuses to boot on published dev values unless `ALLOW_INSECURE_DEFAULT_SECRETS=true`): `FIELD_ENCRYPTION_KEY`, `KIORLY_CLIENT_SECRET`, `KIORLY_WEBHOOK_SECRET`, `PSP_FAKE_WEBHOOK_SECRET`, `WHATSAPP_WEBHOOK_SECRET`, `KIOREX_RECORD_SHARE_HMAC_SECRET`, `RX_VERIFY_HMAC_SECRET`, `KIORLY_PHARMACY_*` / `KIORLY_LAB_*` / `KIORLY_LAB_NURSE_*` client key, secrets and webhook secrets, plus `PAY_LINK_SECRET`, `PAYMENT_FINGERPRINT_PEPPER`, `LINK_TOUCH_SIGNING_SECRET`, `GROWTH_LINK_TOKEN_SECRET`, `PARTNER_LEAD_SIGNING_SECRET`.
  - URLs and wiring: `DATABASE_URL` (or `DB_SECRET_ARN`), `PORT=4000`, `OIDC_ISSUER`, `OIDC_AUDIENCE=kiorex-api`, `PUBLIC_BASE_URL`, `WEB_BASE_URL`, `OPS_BASE_URL`, `PUBLIC_APP_URL`, `CORS_ORIGINS`, `KIORLY_BASE_URL` (Clinic marketplace base, path `/marketplace/v1`), partner `*_BASE_URL` (host only), `RX_VERIFY_BASE_URL`, `KIOREX_PAY_LINK_BASE_URL`, `PAY_RETURN_URL_HOSTS`, `PROVIDER_LINK_BASE_URL`, `SITE_ENVIRONMENT` (leave non-`production` so robots/sitemaps block indexing), `TRUSTED_PROXY_HOPS` (set 2: CloudFront + App Runner), `DEFAULT_MARKET=EG`.
  - Mock switches: `PSP_MODE=sandbox-fake`, `MESSAGING_MODE=log`, `AI_PROVIDER=fake`, `SANDBOX_PAYMENTS_ALLOWED=true`, `PUSH_MODE`, `MAPS_MODE=mock`, `STORAGE_MODE=local` (S3 mode available: set `s3` plus bucket env if vault files must survive restarts).
  - Web build env: `VITE_OIDC_AUTHORITY` (**must be set, a production build has no fallback and throws**), `VITE_OIDC_CLIENT_ID`, `VITE_MAP_PROVIDER=mock`, `VITE_MOCK` unset.
- **Gaps:**
  1. `Dockerfile` was never built in CI; first build may fail (needs a dry run, `docker build -f apps/api/Dockerfile .`). The runner stage installs `--workspace apps/api` only; check `dist-public` SSR copy.
  2. **No job trigger endpoint.** tofu `scheduled_jobs` points at `/api/v1/internal/jobs/*` which does not exist in the code (marked PLACEHOLDER). Jobs rely on in-process timers; see risk R3 (App Runner CPU throttling).
  3. Seeds are `ts-node` scripts; the runner image is `--omit=dev`, so seeds cannot run inside App Runner. Run them from CI (section 5) or use the existing seed Lambda image.
  4. The ops and patient webs need `/api/*` same-origin through CloudFront (they use relative `/api`); the SSR routes (`/ar/*`, `/en/*`, `robots.txt`, `sitemap.xml`, `/_p/*`, `/_site/*`) are only proxied by the Vite dev server. For DEV skip the SEO site (SPA only), or add those behaviours to the patient CloudFront.
  5. Passport clients `kiorex-web`, `kiorex-ops`, `kiorex-widget`, `kiorex-mobile` have only localhost / staging redirect URIs (gap G1 below).
  6. Mobile (Expo) is out of scope.

### 3.2 kiorex-account (Passport)

- **Runtime pieces:** one process: `apps/dev-idp` (oidc-provider 9 on a raw Node HTTP server, Postgres adapter via `pg`, port 4400). It also serves the Passport self-service UI at `/account` (esbuild bundle built in memory at start-up, so `esbuild` and `tsx` must exist at runtime). Separate SPA `apps/kiorly-home` (Kiorly Home sign-in, static, tiers `local|staging|production` baked at build). Packages `backchannel`, `otp-sender`. No Redis; sessions and OTP in Postgres. A fake upstream IdP on 4401 is optional (`account.provider_sso` flag off).
- **Production IdP is Cognito (tofu), the dev IdP is a dev tool:** `assertNotProduction()` makes `dev-idp` **refuse to start when `NODE_ENV`, `KX_ENV` or `APP_ENV` is `production`/`prod`**. For a DEV environment this is the intended use (OTP `000000` for the seeded numbers, `/dev/inbox`). It is a public URL with known demo numbers, including the ops super admin `+201000000099`: acceptable for synthetic data only, never reuse for real people (risk R5).
- **Dockerfile:** **none** (gap). Needs a new `apps/dev-idp/Dockerfile`-style image at repo root: `npm ci` (workspaces), run `tsx apps/dev-idp/src/index.ts`; `NODE_ENV=development`.
- **Health:** `GET /healthz` (not under `/api/v1`), plus `/.well-known/openid-configuration`.
- **Migrations / seed:** schema auto-created by `migrate()` at start (`CREATE TABLE IF NOT EXISTS`); `npm run db:seed:demo` (`DEMO_SEED_ALLOWED=true tsx scripts/seed-demo.ts`, also applies `config/seed-users.json`); the process must be restarted after the first seed so the OTP test-number list is reloaded.
- **Env:** `PORT=4400`, `ISSUER` (public https URL; defaults to localhost), `DATABASE_URL`, `KX_DB_SCHEMA`, `KX_TRUST_PROXY=true` (behind App Runner), `KX_ENV` (tier for workspace URLs; must not be `production`), `KX_WORKSPACE_URL_CLINIC|NURSE|PHARMACY|LAB`, `KX_FLAG_ACCOUNT_PASSKEYS`, `KX_FLAG_ACCOUNT_PROVIDER_SSO`, `KX_DEV_TEST_USERS`, `OTP_TEST_NUMBERS`, `MESSAGING_MODE`, `PSP_MODE`, `PAYMENT_PROVIDER`, `WHATSAPP_*`, `DB_POOL_MAX`.
- **Gaps:**
  - **G1 (blocking): client redirect URIs, post-logout URIs and back-channel logout URIs are read only from `config/idp.json` `environments.local` (hard-coded localhost ports).** `provider.ts`, `logout.ts` and `app.ts` use `.environments.local` only; `staging`/`production` blocks exist but are not selectable by the dev IdP. Needs one small change: an env override (for example `KX_CLIENTS_OVERRIDE_JSON`, or a `dev` block in `idp.json` plus `KX_CLIENT_ENV=dev` that reads it, with the URLs filled from env). Tests in `apps/dev-idp/test/domains.test.ts` assert `idp.json` against `config/domains.json`; add a `dev` tier to `domains.json` or a parallel override so they stay green.
  - **G2:** `kiorly-home` needs an equivalent tier (`KX_ENV=dev` with explicit `issuer`/`home` values) so the bundle has no localhost; its `__KX_HOME__` is built from `domains.json`.
  - **G3:** `tierFromEnv(KX_ENV)` for `GET /api/workspaces` only knows the three tiers; set `KX_WORKSPACE_URL_*` overrides.
  - **G4:** the OIDC issuer is also the token `iss` and the discovery URL every product validates. It must be the final public https URL and never change after products are configured (use the stable App Runner URL or a CloudFront in front).
  - No Dockerfile, no CI image build, `deploy.yml` targets the Cognito tofu stack.

### 3.3 kiorly-pharmacy

- **Runtime pieces:** `apps/api` (Nest, port 3100, prefix `/api/v1`; **the Kiorex machine API lives at `/marketplace/v1`, outside the prefix**, so CloudFront `/api/*` does not reach it: Kiorex must call the App Runner URL directly), `apps/web` (SPA, Vite, relative `/api`), `packages/shared`. In-process pollers (`OUTBOX_POLL_*`, `FLAGS_POLL_*`, `JOBS_ENABLED`). No Redis. Offline POS sync endpoint is in the API.
- **Dockerfile:** **only `apps/api/Dockerfile.seed`** (Lambda image, Node 26). The runtime image is missing (gap). Model it on the platform `Dockerfile` (copy `packages`, `vendor`, `prisma`, `prisma.config.ts`; `npm ci --omit=dev` plus global `prisma@7.10.1`; `node dist/main.js`). There is **no entrypoint** that builds `DATABASE_URL` or runs `prisma migrate deploy`; either copy the platform `docker-entrypoint.mjs` or run migrations from CI (recommended below).
- **Health:** `GET /api/v1/health/live`, `/ready` (DB), `/providers` (internal).
- **Migrations / seed:** `npm run db:deploy -w api` (30 migrations); seeds `seed`, `seed:demo`, `seed:suite`, `seed:mobile` (`seed:all`), `DEMO_SEED_ALLOWED=true`.
- **Env:** `PORT=3100`, `LISTEN_HOST`, `DATABASE_URL`, `DB_POOL_MAX`, `NODE_ENV`, `JWT_SECRET` or `AUTH_JWT_SECRET` (**required in production**), `AUTH_MODE` (`oidc` | `local` | `dev`), `OIDC_ISSUER`, `OIDC_WEB_CLIENT_ID=kiorly-pharmacy-web`, `OIDC_SESSION_MAX_AGE_SECONDS`, `AUTH_ACCEPT_PASSPORT`, `OIDC_PHONE_LINK`, `OIDC_ALLOWED_CLIENTS`, `CORS_ORIGINS`, `KIORLY_HOME_ORIGINS`, `WEB_APP_URL`, `KIOREX_MODE`, `KIOREX_BASE_URL`, `KIOREX_API_BASE_URL`, `KIOREX_WEBHOOK_URL`, `KIOREX_WEBHOOK_SECRET`, `KIOREX_PRODUCT_KEY`, `KIOREX_PRODUCT_SECRET`, `KIOREX_FLAGS_URL`, `KIOREX_FLAGS_WEBHOOK_SECRET`, `KIOREX_LEAD_SIGNING_SECRET`, `INTEGRATION_KEK`, `NATIONAL_ID_PEPPER`, `PSP_MODE`, `MESSAGING_MODE`, `WHATSAPP_VERIFY_TOKEN`, `PAYMENT_*`, `MARKET_TZ`, per-provider `<KIND>_MODE` (`mock`; `real` is blocked without approval).
- **Gaps:** no runtime Dockerfile or entrypoint; CORS defaults to localhost ports (set `CORS_ORIGINS` or rely on same-origin via CloudFront); `VITE_KIORLY_HOME_URL` must be set at web build time; Passport client `kiorly-pharmacy-web` and `kiorly` need the deployed redirect URIs (G1); `KIOREX_*` URLs point at the platform; marketplace HMAC client for Kiorex is an `IntegrationClient` row (seeded for dev with the published dev secrets, which production mode refuses, so re-register through the partner flow or keep `NODE_ENV` as in section 4); in production mode with `AUTH_MODE=local` demo password login is expected to be refused (confirm in `auth/passport.ts`), so either use `AUTH_MODE=oidc` plus Passport OTP, or run dev with `NODE_ENV=development`.

### 3.4 kiorly-lab

- **Runtime pieces:** `apps/api` (port 3200, prefix `/api/v1`; Kiorex machine API at `/api/v1/integration/v1`, so it **is** reachable through CloudFront `/api/*`), `apps/web` (SPA), `packages/shared`. In-process timers (`TIMERS_ENABLED`, `JOBS_ENABLED`, outbox, flags, critical-result and field-safety services). No Redis. Analyzer bridge is an on-prem agent calling the API (not deployed).
- **Dockerfile:** only `Dockerfile.seed` (same gap as Pharmacy).
- **Health:** `GET /api/v1/health/live`, `/ready`, `/providers`.
- **Migrations / seed:** `db:deploy -w api` (31 migrations); seeds `db:seed`, `db:seed:demo`, `db:seed:mobile`, `db:seed:lis`; the demo seed writes a hand-off file (`DEMO_HANDOFF_FILE`) consumed by the platform demo seed (KNLAB01 nurse samples).
- **Env:** as Pharmacy plus `KIOREX_OIDC_ISSUER`, `KIOREX_OIDC_AUDIENCE`, `PUBLIC_BASE_URL` (used in report links), `STORAGE_DIR` (**local disk: lost on every App Runner deploy and restart**; fine for DEV, reports and scans are synthetic), `REPORT_LINK_TTL_DAYS`, `ANALYZER_MODE=mock`, `LAB_TIMEZONE`, `LAB_HOME_COLLECTION_FEE_MINOR`, `FORCE_PRIVILEGED_MFA`, `TIMERS_ENABLED`.
- **Gaps:** same as Pharmacy, plus local-disk storage (S3 mode is not wired in Lab; the tofu notes an uploads bucket but the env list above has no bucket variable).

### 3.5 Clinic DEV copy (needed for the booking-to-commission flow; branch `kiorex`, not `main`)

The live Clinic (`main`) must stay untouched: HANDOFF section 8 says a push to `main` deploys to production data, and first deploy of the merged `main` is held by the founder. For end-to-end tests a **separate DEV Clinic** is deployed from branch `kiorex`: image from `apps/api/Dockerfile` (exists, handles `DB_SECRET_ARN`, migrate on boot), port 3000, same health path, same web build. Extra env for the Kiorex link: `KIOREX_OUTBOX_WEBHOOK_URL`, `KIOREX_OUTBOX_WEBHOOK_SECRET`, `KIOREX_MARKETPLACE_CLIENT_KEY`, `KIOREX_FLAGS_SECRET` / `KIOREX_FLAGS_WEBHOOK_SECRET`, `KIOREX_OIDC_ISSUER`, `KIOREX_OIDC_ACCEPT_BEARER`, `KIOREX_STATEMENT_MODE`, `KIORLY_HOME_ORIGINS`, `WEB_PUBLIC_ORIGIN`, `APP_WEB_URL`, `KIOREX_WIDGET_BASE_URL`. Do not add a workflow to Clinic `main`; add the dev files on `kiorex` only.

### 3.6 Cross-product URL map (every URL is configuration, no code hard-codes a host, per the 23 Nov audit)

| Who calls | Calls | Config | Notes |
|---|---|---|---|
| All browsers | Passport (issuer) | `VITE_OIDC_AUTHORITY` (platform web/ops), `OIDC_ISSUER` / `KIOREX_OIDC_ISSUER` (APIs), `ISSUER` (Passport) | One exact https string everywhere |
| Passport | each product (back-channel logout) | `idp.json` client `backchannelLogoutUri` (G1) | Clinic `/api/v1/auth/kiorex/backchannel-logout`, Pharmacy/Lab `/api/v1/auth/oidc/backchannel-logout`, platform `/api/v1/auth/backchannel-logout` |
| Platform | Clinic marketplace | `KIORLY_BASE_URL` = `<clinic-app-runner-url>/marketplace/v1` (not via CloudFront) | HMAC key/secret per partner, `PartnerRegistration` rows editable at `/api/v1/admin/partners` |
| Platform | Pharmacy | partner base URL = `<pharmacy-app-runner-url>` (path `/marketplace/v1` appended) | direct App Runner URL |
| Platform | Lab | partner base URL = `<lab-cloudfront-or-app-runner-url>` (path `/api/v1/integration/v1` appended) | either works |
| Clinic, Pharmacy, Lab | Platform webhooks | `KIOREX_OUTBOX_WEBHOOK_URL` / `KIOREX_WEBHOOK_URL` = `<platform>/api/v1/webhooks/kiorly|pharmacy|lab` | HMAC webhook secret per product |
| Products | Platform flags | `KIOREX_FLAGS_URL`, product key + secret; platform pushes `flag.changed` to each product | missing snapshot means code defaults |
| Clinic, Pharmacy, Lab | Platform commission statement | signed partner route (`COMMISSION_STATEMENT_*`) | counsel gate keeps real money blocked |
| Product webs | Kiorly Home | `VITE_KIORLY_HOME_URL`, `KIORLY_HOME_ORIGINS` (API CORS and handoff) | optional for DEV |
| Products | each other's CORS | `CORS_ORIGINS` | needed only for direct browser calls; same-origin `/api` avoids it |

**The chicken-and-egg problem:** CloudFront and App Runner hostnames are random and only known after first creation, but Passport clients, CORS, issuer and partner URLs need them. Solutions: (a) two-pass bootstrap (deploy all once, store URLs in SSM Parameter Store `/kxdev/url/<product>`, deploy again; the hostnames never change afterwards), or (b) buy one domain and use Route 53 + ACM so every URL is known up front (needed anyway for the full infrastructure). Recommended now: (a).

---

## 4. Recommended design (simplest, cheapest, fastest)

One new CDK app `kxdev` (TypeScript, same toolchain as the Clinic) in the workspace repo, **plus one tiny per-product deploy stack**, all in 990597228737 / eu-central-1, name prefix `kxdev-`, tag `Env=dev`.

```
                     GitHub Actions (OIDC -> GitHubAction-AssumeRole, existing)
                                      |
  per product:  docker build -> ECR (CDK asset) -> App Runner service (public egress, no VPC connector)
                web build -> S3 + CloudFront (/api/* -> that App Runner)           [no ALB, no NAT, no endpoints]
                                      |
        shared:  ONE RDS PostgreSQL 16 db.t4g.micro (single AZ, default VPC, public subnets, SSL forced,
                 strong random master password in Secrets Manager `kxdev/rds-master`)
                 one database per product: kxdev_platform, kxdev_account, kxdev_pharmacy, kxdev_lab, kxdev_clinic
```

Why this and not "copy the Clinic stack five times":

1. **No VPC connector, no NAT, no interface endpoints.** App Runner keeps default public egress. This is mandatory here because the products call each other over public HTTPS (JWKS from Passport, partner HMAC calls, webhooks, flag polling). With the Clinic's no-NAT VPC connector those calls could not leave the VPC; fixing that needs a NAT gateway (about 33 USD/month plus data) or three endpoints (about 53 USD/month). Saving: roughly 50 to 55 USD/month versus the Clinic pattern.
2. **RDS is reachable by App Runner without a connector only if it is public.** The shared RDS is `publiclyAccessible`, security group 5432 open to 0.0.0.0/0, `rds.force_ssl` on (default for PG16), 32+ character random master password, synthetic data only. This is the explicit trade-off of the simplest design (risk R1). A later hardening step (VPC connector + one NAT instance or the full infrastructure) does not change the apps: they only read `DATABASE_URL`.
3. **`DATABASE_URL` is injected as an App Runner runtime secret** (a Secrets Manager reference resolved by App Runner, not by the container), so no Secrets Manager SDK call, no endpoint and no entrypoint change is required. The platform entrypoint already skips the SDK when `DATABASE_URL` is set; Pharmacy/Lab/Passport do not need an entrypoint if migrations run from CI.
4. **Migrations and seeds run from GitHub Actions** against the public RDS endpoint (`prisma migrate deploy`, `db:seed:demo` with `DEMO_SEED_ALLOWED=true`, `KIORLY_ENV=dev`), instead of seed Lambdas in a VPC with endpoints. The existing `Dockerfile.seed` images are not needed for DEV. Database creation (`CREATE DATABASE kxdev_<product>`) is one `psql` line in the same job (idempotent `SELECT ... \gexec`).
5. **One RDS instance for everything**, one database per product (products never share a database, per the architecture rule; they only share the server). Per-product `DB_POOL_MAX=5` keeps 6 services under about 110 connections of a t4g.micro (1 GB). If tests get slow or the DB OOMs, resize to t4g.small (+13 USD) with one parameter.
6. **Mock everything external:** `PSP_MODE=sandbox-fake`, `MESSAGING_MODE=log` (WhatsApp, SMS, email, push), `AI_PROVIDER=fake`, `MAPS_MODE=mock`, `ANALYZER_MODE=mock`, no `<KIND>_MODE=real`, `INTEGRATION_MODES` not approved, counsel sign-off stays NOT_REVIEWED so real-money modes remain blocked. OTP comes from Passport `/dev/inbox` or `000000`.

Services and URLs:

| Service | Compute | Web | Public URL (random until a domain exists) |
|---|---|---|---|
| Passport (`kxdev-passport`) | App Runner 0.5 vCPU / 1 GB, port 4400, health `/healthz` | `kiorly-home` SPA on S3 + CloudFront (optional) | App Runner URL is the issuer (no CloudFront in front, so `/account`, `/interaction`, `/oidc` all work) |
| Platform (`kxdev-platform`) | App Runner 1 vCPU / 2 GB, port 4000 | patient web CF, ops CF (`/api/*` to platform) | two CloudFront URLs |
| Pharmacy (`kxdev-pharmacy`) | App Runner 1 vCPU / 2 GB, port 3100 | web CF | CloudFront + direct App Runner URL for `/marketplace/v1` |
| Lab (`kxdev-lab`) | App Runner 1 vCPU / 2 GB, port 3200 | web CF | CloudFront |
| Clinic DEV (`kxdev-clinic`) | App Runner 1 vCPU / 2 GB, port 3000 | web CF | CloudFront + direct App Runner URL |

Secrets (Secrets Manager, one JSON secret per product `kxdev/<product>`, about 0.40 USD each): generated at first deploy by a one-off script (random values; never the published `kx_dev_*` values, so `NODE_ENV=production` hardening stays on and `ALLOW_INSECURE_DEFAULT_SECRETS` is not needed). Cross-product shared secrets (HMAC client secrets, webhook secrets, flags secrets) are generated once into `kxdev/shared` and referenced by both sides. `NODE_ENV`: use `production` for APIs (HSTS, hardened CORS, refuses dev routes) with `KIORLY_ENV=dev` so demo seeding is allowed; Passport must be `NODE_ENV=development` with `KX_ENV=dev` (it refuses `production`). If a product refuses password demo login in production mode, use Passport OTP login (planned path, `AUTH_MODE=oidc`).

### Monthly cost estimate (new environment)

| Item | USD / month |
|---|---|
| RDS db.t4g.micro single AZ + 20 GB gp3 | 15 to 17 |
| App Runner x5 (idle provisioned memory about 7 to 13 each + active CPU for test traffic) | 55 to 75 |
| CloudFront (6 distributions, low traffic, mostly free tier) + S3 | 1 to 3 |
| Secrets Manager (6 secrets) | 2.5 |
| ECR (5 repos, keep last 5 images via lifecycle rule) + CloudWatch logs | 3 to 5 |
| Data transfer, misc | 1 to 3 |
| **Total, always on** | **about 80 to 105** |
| Optional: pause App Runner outside working hours (`aws apprunner pause-service` / `resume-service` by a scheduled workflow; paused = no compute charge) | about 45 to 65 total |

Tear-down is one `cdk destroy` per stack (RDS removal policy DESTROY, no deletion protection, buckets `autoDeleteObjects`).

What is mocked: WhatsApp (Meta Cloud), SMS, email (SES/SNS), push (APNs/FCM/Expo), payments (Paymob, Fawry, InstaPay, card gateway, bank IPN: `sandbox-fake` PSP page served by the platform), AI (`fake`), maps (`mock`), analyzers, ZATCA/ETA (never integrated). Real vendor sandboxes can be switched on one at a time later through the Integrations Control Center, which needs founder approval and secrets by reference.

---

## 5. Ordered implementation checklist

### 5.0 Founder decisions first (5 minutes)

- D1. Confirm: deploy DEV in 990597228737 (the only usable account) next to the live Clinic, separated by prefix and tags. If a clean account is preferred, someone must lift the SCP on 599243104052 first.
- D2. Accept the public (SSL-only, password-protected, synthetic-data) RDS for DEV. Alternative with +35 to 55 USD/month: VPC connector + NAT gateway (or endpoints).
- D3. Include the DEV Clinic copy (+15 to 20 USD/month) so the booking flow can be tested end to end. Without it only platform-to-Pharmacy and platform-to-Lab flows are testable.
- D4. Keep the 6 leftover `dbbackupbucket` S3 buckets and old ECR images for now (no action; they are tiny). Do not delete anything in the live stack.

### 5.1 One-time manual AWS / GitHub steps (founder)

1. GitHub: for each of `kiorex-platform`, `kiorex-account`, `kiorly-pharmacy`, `kiorly-lab` add repository secret **`AWS_DEPLOY_ROLE_ARN` = `arn:aws:iam::990597228737:role/GitHubAction-AssumeRole`** (same value Clinic uses; trust already covers `repo:mshall/*`). Clinic repo already has it. No new IAM role, no new OIDC provider.
2. GitHub: for `kiorex-workspace` add the same secret (it hosts the base stack workflow). Optionally add a repository variable `KXDEV_ENABLED=true` so no workflow runs until you flip it.
3. AWS: confirm CDK bootstrap exists in the account (it does: `CDKToolkit`, qualifier `hnb659fds`). No new bootstrap is needed.
4. AWS billing: set a budget alert (for example 120 USD/month) in Billing > Budgets. The role is AdministratorAccess, so a runaway stack is only stopped by this.
5. Run the base deploy (below) from the workflow's manual trigger; no local AWS credentials are required.
6. After the first full pass, run the second pass once (publishes the final URLs, see 5.4).
7. Create Ops super admin approvals: platform config changes need two super admins (maker-checker); the seed creates the demo ones.

### 5.2 Files to add per repo

**kiorex-workspace (branch `main`, repo `kiorex-workspace`)** — base and shared pieces:
- `infra/dev/package.json`, `tsconfig.json`, `cdk.json`, `bin/kxdev.ts`: CDK app.
- `infra/dev/lib/base-stack.ts` (`kxdev-base`): shared RDS (default VPC, public subnets, SG 5432 open, SSL forced, single AZ, master secret `kxdev/rds-master`, generated); SSM parameters `/kxdev/rds/endpoint`, `/kxdev/rds/master-secret-arn`; shared secret `kxdev/shared` (HMAC and webhook secrets); S3-only helper outputs.
- `infra/dev/lib/service-construct.ts`: reusable construct used by every product stack: `DockerImageAsset`, App Runner service (public egress, `DATABASE_URL` and app secrets as `runtimeEnvironmentSecrets`, health path, port, size), instance role, auto-scaling (1 to 2), optional web `Bucket` + `Distribution` (copied from the Clinic stack: OAC S3 origin, SPA rewrite function, `/api/*` behaviour, origin-host parser custom resource), outputs `AppUrl`, `ServiceUrl`, SSM `/kxdev/url/<product>`.
- `.github/workflows/dev-base.yml`: `workflow_dispatch`: `cdk deploy kxdev-base`.
- `scripts/kxdev-bootstrap.sh`: creates databases (`CREATE DATABASE`), generates secrets, writes SSM URLs, prints the order of section 5.4; `scripts/kxdev-smoke.sh`: the smoke tests of section 6.
- Keep it out of the Clinic repo and out of `infra/tofu`.

**kiorex-account (`main`)**:
- `apps/dev-idp/Dockerfile` (or root `Dockerfile.dev-idp`): Node 26, `npm ci`, copy `config/` and `apps/`, `CMD ["npx","tsx","apps/dev-idp/src/index.ts"]`, `ENV NODE_ENV=development PORT=4400`, `HEALTHCHECK` on `/healthz`.
- Code change G1 (`config.ts`/`provider.ts`/`logout.ts`/`app.ts`): client redirect, post-logout and back-channel URIs from an env override or a `dev` tier; update `domains.json` tests. Code change G2 for `kiorly-home` (`KX_ENV=dev` plus explicit URLs).
- `infra/dev/bin/app.ts`, `infra/dev/lib/passport-dev-stack.ts` (uses the construct above; no web CloudFront for the IdP; `kiorly-home` SPA optional): about 80 lines.
- `.github/workflows/deploy-dev.yml`: `workflow_dispatch` (and later push to `main`), OIDC, `npm ci`, `psql CREATE DATABASE kxdev_account`, `cdk deploy`, `npm run db:seed:demo` against the RDS URL, restart service (`aws apprunner start-deployment`), smoke.

**kiorex-platform (`main`)**:
- Fix and dry-run the existing `apps/api/Dockerfile` (never built in CI).
- `infra/dev/bin/app.ts`, `infra/dev/lib/platform-dev-stack.ts`: API service (port 4000, env of section 3.1), patient web CF and ops CF with build env `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID`.
- `.github/workflows/deploy-dev.yml`: build `apps/web` and `apps/ops` with the Passport URL from SSM, CDK deploy, migrate (`db:deploy`), `db:seed`, then (after partners are up) `db:sync:providers` and `db:seed:demo`, smoke.
- Optional later: add the missing `/api/v1/internal/jobs/*` endpoints (or a keep-alive loop) for job triggering.

**kiorly-pharmacy and kiorly-lab (`main`)**:
- `apps/api/Dockerfile` (new runtime image, copy of the platform one adapted: `packages`, `vendor`, `prisma`, `prisma.config.ts`, `dist`), plus `docker-entrypoint.mjs` only if migrate-on-boot is preferred over migrating from CI.
- `infra/dev/bin/app.ts`, `infra/dev/lib/<product>-dev-stack.ts`, `.github/workflows/deploy-dev.yml` (same shape as platform; Pharmacy exports the App Runner URL for `/marketplace/v1`).
- Passport clients `kiorly-pharmacy-web` / `kiorly-lab-web` redirect URIs come from G1.

**clinics-management (branch `kiorex` only)**:
- `infra/dev/` (same construct) and `.github/workflows/deploy-dev.yml` triggered **only** by `workflow_dispatch` from the `kiorex` branch. Do not touch `deploy-aws.yml`, `infra/src/*` or any file on `main`; remember `[skip ci]` on every merge to `main` (HANDOFF rule).
- Reuse `apps/api/Dockerfile` and `apps/web` build as is.

(Construct duplication: copy `service-construct.ts` into each repo's `infra/dev/lib` rather than importing across repos; the repos never import each other, and it is about 250 lines.)

### 5.3 Per-service workflow shape (identical across repos)

1. `permissions: id-token: write`; `aws-actions/configure-aws-credentials` with `AWS_DEPLOY_ROLE_ARN`; region eu-central-1.
2. Read `/kxdev/rds/endpoint`, `/kxdev/url/*` from SSM; compose `DATABASE_URL` into the product secret on first run only.
3. `psql` create database if missing; `prisma migrate deploy` (or Passport auto-migrate).
4. Build web with the URLs; `cdk deploy kxdev-<product> --require-approval never`.
5. Seed with `DEMO_SEED_ALLOWED=true KIORLY_ENV=dev` (idempotent), only on `workflow_dispatch` input `seed=true`.
6. Smoke: `GET /api/v1/health/ready` must show `"database":"ok"` (the entrypoint answers `/health/live` while still booting, so never gate on live alone, a lesson already encoded in the Clinic script).

### 5.4 Bootstrap order (first time)

1. `kiorex-workspace` workflow `dev-base` (RDS, shared secrets). Wait about 10 minutes for RDS.
2. Passport: deploy with a placeholder issuer, read its App Runner URL, then redeploy with `ISSUER` set to it (the URL is stable). Seed demo accounts, restart (OTP list reload).
3. Platform, Pharmacy, Lab, Clinic DEV: first deploy (get their CloudFront/App Runner URLs, written to SSM).
4. **Second pass**: redeploy Passport (client redirect/logout URIs for every web), then every product (issuer, CORS, KIOREX_* URLs, partner base URLs). Then register partners in the platform (`PartnerRegistration` rows via ops `/admin/partners` or seed) and the Kiorex `IntegrationClient` on each provider (the demo seeds create them with dev values; replace with the generated shared secrets).
5. Seed order (same as `scripts/seed-all.sh`): Passport, Clinic, Pharmacy, Lab, platform `db:sync:providers`, platform `db:seed:demo` (needs the Lab hand-off file or `DEMO_HANDOFF_JSON`).
6. Switch on feature flags in ops (launch-locked ones need gate evidence; keep `clinic.provider_credit_v2`, `growth.provider_marketing_v2`, `clinic.usage_bundles` off).

Effort: about 1.5 to 2 working days for Claude agents (Dockerfiles, CDK construct, workflows, Passport G1/G2) plus about 1 hour of founder time (secrets, approvals, two passes).

### 5.5 Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Public RDS endpoint (password + SSL only), shared by five products: one compromise or runaway migration affects all dev data | Synthetic data only; 32+ char password; SG can be narrowed to the founder IP later (CI then seeds through a Lambda); snapshot before big migrations; one DB per product so a drop is scoped; do not put real patients or real phone numbers anywhere in DEV |
| R2 | Cost creep (App Runner min 1 per service, left on) and AdministratorAccess role | Budget alert 120 USD; pause schedule; `cdk destroy` documented; ECR lifecycle (keep 5) |
| R3 | App Runner throttles CPU between requests, so in-process timers (outbox sweep, flag poll, jobs, dunning, commission statements) can stall when idle; the platform's `/internal/jobs/*` triggers do not exist | Verify on first deploy by checking outbox lag after 10 idle minutes; mitigate with a 1-minute EventBridge ping to `/health/ready` per service, or add job endpoints; for DEV, stalls are tolerable and tests can trigger sweeps by calling an API |
| R4 | Random hostnames change if a stack is destroyed and recreated, invalidating Passport clients and partner URLs | Keep stacks alive; script the second pass; buy one domain for the full infrastructure |
| R5 | Passport dev IdP is public with known OTP `000000` for demo numbers, including a super admin | Never real data; do not publish URLs; if exposure matters, put CloudFront in front with a WAF IP allow-list (about 6 to 8 USD/month) or restrict the seeded test-number list (`OTP_TEST_NUMBERS`) |
| R6 | Dockerfiles for platform never built in CI; Pharmacy, Lab, Passport have none; Node 26 image availability and `prisma` install in the runner stage | Dry-run `docker build` locally first (HANDOFF rule: no deploy without the founder's go-ahead; building is fine) |
| R7 | Production-mode refusals: published dev secrets (`kx_dev_*`) rejected, demo password login possibly disabled, HSTS/CORS strict | Generated secrets (already planned); use Passport OTP login; `NODE_ENV=development` fallback for a product if needed (never for the platform API) |
| R8 | Pharmacy `/marketplace/v1` is not under `/api`; CloudFront would not route it | Platform partner base URL = App Runner URL (already in the design) |
| R9 | Lab report files on local disk are lost on redeploy | Acceptable for DEV; note in the test guide |
| R10 | A Clinic `main` push deploys to the live tenant | Dev Clinic files only on branch `kiorex`, workflow dispatch only; always `[skip ci]` on `main` merges |
| R11 | Migrations run from CI against RDS without the atomic-failure protection the Clinic entrypoint added | Run `prisma migrate deploy` as a failing CI step before `cdk deploy`; a failure stops the deploy |

---

## 6. Verification (smoke tests and end-to-end)

Script `scripts/kxdev-smoke.sh` (curl only, no secrets printed), run after each deploy and after the second pass:

1. **Per service health:** `GET <url>/api/v1/health/live` = 200 and `/health/ready` = `{"status":"ok","database":"ok"}` for platform, pharmacy, lab, clinic-dev; Passport `GET <issuer>/healthz` = 200 and `/.well-known/openid-configuration` returns `issuer` equal to the configured string and a reachable `jwks_uri`.
2. **Web:** each CloudFront URL returns the SPA (200, `index.html`) and a deep link (`/login`) also returns 200; `GET <cf>/api/v1/health/live` proves the `/api/*` behaviour; response headers contain no localhost origin.
3. **CORS / config:** `curl -H 'Origin: <web-url>' -I <api>/api/v1/health/live` shows the origin allowed (or same-origin path works); bundle grep for `localhost` and `127.0.0.1` in each built web (`npm run check:bundles` already exists in the platform).
4. **Cross-product login:** open Pharmacy web, "Sign in with Kiorex Passport", phone `+201000002004`, OTP `000000` (seeded link `pharmacist@demo.kiorly.local`); repeat Lab (`+201000002005`), Clinic DEV (`+201000002001`), ops console (`+201000000099`), patient web (`+201000000001`). Then sign out in one product and confirm the back-channel logout revokes the others (e2e suite 09/21 describe this).
5. **Partner HMAC:** platform ops > Partners shows Clinic, Pharmacy, Lab as connected; platform to Clinic `GET /marketplace/v1/...` signed call returns 200; a wrong secret returns 401.
6. **Flags:** `GET <platform>/api/v1/control/v1/flags/snapshot?product=kiorly-pharmacy` (signed) returns a snapshot, and flipping a flag in ops reaches the product (`flag.changed` push or the 30 s poll).
7. **Booking-to-commission flow in mock mode (the main acceptance test):**
   1. Ops console (two super admins, maker-checker): set a commission rate for the Clinic organisation type and collection mode `NET_FROM_PAYOUT`; leave counsel sign-off `NOT_REVIEWED` (real money stays blocked, by design).
   2. Run the platform provider sync (`db:sync:providers`) so Clinic doctors and slots appear in patient search.
   3. Patient web (`+201000000001`, OTP 000000): search, pick a slot, book with a deposit using the `sandbox-fake` PSP checkout (`/api/v1/pay/fake-checkout/:intentId`).
   4. Clinic DEV: the booking appears (marketplace HMAC create), check in and complete the visit, record cash or card tender.
   5. Platform: outbox webhook delivered (no DEAD rows), commission accrual appears with status timeline; Clinic and Ops both show the same commission statement (two-way visibility, signed statement route).
   6. Cancellation path: cancel before the visit and confirm the full automatic refund and the commission reversal.
   7. Pharmacy and Lab: place a pharmacy order with `rx` validation and a lab booking, follow the status events to `DispenseCompleted` / `LabResultReleased`, confirm the record vault entry (signed link only, no values).
   8. Negative checks: a commission never pauses a listing (SB-05), daily marketplace cap returns 409 `MARKETPLACE_DAILY_CAP_REACHED` when exceeded.
8. **Regression pack against the deployed URLs:** the cross-product e2e suites accept `E2E_KIOREX_URL`, `E2E_KIORLY_URL`, `E2E_PHARMACY_URL`, `E2E_LAB_URL`, `E2E_PASSPORT_URL`. Suites that need direct DB access (`E2E_DB_MAP`) can run only if the public RDS is reachable from the runner (it is, in this design); run suites 01, 03, 04, 05, 08, 09, 20 first. Do not run destructive suites (30 security fuzz, 49) against the shared dev RDS without a snapshot.
9. **Post-incident checks:** CloudWatch log group per App Runner service; `aws apprunner list-operations`; RDS Performance Insights is off (cost), enable temporarily if needed.

---

## 7. Decision summary

- Same account, new `kxdev` stacks, no change to the live Clinic.
- Reuse: GitHub OIDC role (works for all `mshall/*` repos), CDK bootstrap, the Clinic's CloudFront + App Runner + S3 construct pieces, health and smoke conventions.
- Change vs the Clinic: no VPC connector, no endpoints, no NAT, no Multi-AZ, no seed Lambdas; one shared small public-SSL RDS with a database per product; secrets via App Runner runtime secrets; migrations and seeds run from CI.
- Code work required: Passport client-URL override (G1) and Kiorly Home dev tier (G2); runtime Dockerfiles for Passport, Pharmacy, Lab; dry-run of the platform Dockerfile; per-repo `infra/dev` + `deploy-dev.yml`.
- Estimated run cost 80 to 105 USD/month always on, about 45 to 65 with a pause schedule, versus about 110 to 130 for today's single Clinic stack.
