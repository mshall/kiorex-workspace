# KX10 — Platform, DevOps & Security Engineering

Source: 14qj8qS2R5Q4rtAJyhIs-fajHPKSKA9-0
Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (first issued 20 November 2026; previous text was Rev 2.2, 19 Nov 2026; this update adds provider and mobile security; Growth update 24 Nov 2026 added at the end, status-labelled)

How every Kiorex and Kiorly product is built, shipped, observed and defended — controls already in Kiorly become the standard for the whole ecosystem.

Authored in the role of Chief Information Security Officer. Also acting Head of Platform: CI/CD, infrastructure, observability, resilience and security controls.

Tags: OpenTofu IaC · CI/CD gates · Observability & on-call · Security controls · Flag operations · Backup & DR

| Field | Value |
|---|---|
| DOCUMENT | KX10 (03 — Technical documents) |
| REVISION | Rev 2.3 · Reference Edition (updated 23 Nov 2026) |
| DATE | 23 November 2026 (first issued 20 November 2026) |
| STATUS | Approved reference |
| AUDIENCE | Engineering, security reviewers, auditors, enterprise customers |
| OWNER ROLE | Chief Information Security Officer |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026 |

## Contents

01 Platform baseline · 02 Delivery pipeline · 03 Observability and on-call · 04 Security control framework · 05 Threat model highlights (STRIDE) · 06 Feature-flag operations · 07 Resilience targets

## 01 Platform baseline

One reference stack, cloned per product (from infra/src/kiorly-clinics-management-stack.ts).

Key figures: Single cloud AWS (eu-central-1 cell for Egypt) · NAT gateways: 0 (VPC endpoints instead) · Operational alerts: 7 (money + booking paths) · Restore drill: Quarterly (RPO/RTO recorded).

NOTE: Full AWS detail — accounts, network, request path, every component, ecosystem stacks, DR, cost and the hardening backlog — is in KX21 AWS Cloud Hosting & Infrastructure Reference.

| Layer | Service | Configuration standard |
|---|---|---|
| Edge | CloudFront + AWS WAF (before launch) | Single hostname per product; /api/* to API origin; WAF rule intent in platform/waf-rules.json → WebACL to attach (KX21 HB01) |
| Compute | AWS App Runner | Container from ECR; VPC connector; 1 vCPU/2 GB; autoscale 1–25 (min 2 in prod, HB04); health /api/v1/health/live, readiness /api/v1/health/ready |
| Data | RDS PostgreSQL 16 | Isolated subnets; Multi-AZ; 35-day PITR; deletion protection; encrypted at rest (KMS) |
| Files | S3 | Block public access, SSE-S3, TLS enforced, presigned URLs; versioning + customer-managed KMS planned (HB03); audio purged after scribe sign-off by default |
| Secrets | Secrets Manager + KMS | Via interface VPC endpoints; rotation 90 days; no secrets in git (CI check) |
| Email | SES (eu-central-1) | DKIM/SPF/DMARC before enabling sends (NH016) |
| IaC | OpenTofu (replacing AWS CDK, ADR-028) | Every resource in code via cloud-neutral modules; encrypted S3 state; plan on PR, approved apply, nightly drift (KX21 §01) |

## 02 Delivery pipeline

Seven stages:

1. PR — lint · typecheck
2. Unit + integration — money coverage ≥ 85%
3. Contracts — E2E golden flow · OpenAPI drift · EN/AR · Lite · fails Kiorex
4. (as above)
5. tofu apply — OIDC role
6. Seed + smoke — ready + login
7. Observe — alarms 30 min

| Gate | Tooling | Blocks merge/deploy when |
|---|---|---|
| Static | ESLint, TypeScript strict, module-boundary test | Cross-context import not in allow-list |
| Money path | QA02 coverage gate on billing, billing-platform, credits | < 85% line coverage |
| Settlement invariants | QA03 fast-check 10k runs | payable < 0 or > max(S,C)+add-ons; wallet ≠ ledger |
| Contracts | OpenAPI export + consumer contract test | Breaking change to marketplace API |
| Golden flow | Playwright EN/AR | Book → check-in → visit + Rx → split pay → cash close fails |
| Feature flags | All-ON golden flows + per-flag OFF contract tests | Any flag breaks the universal OFF contract or the dependency graph |
| Supply chain | npm audit (prod), lockfile, SBOM | High vulnerabilities in prod deps |
| Performance budget | k6 slots/bookings, Lighthouse mobile-4G | p95 slots > 150 ms @ 50 rps; TTI > 4 s (staging, NH020) |

Deploys run on push to main with cancel-in-progress concurrency; migrations run on boot (expand-contract only); seeds run post-deploy via Lambda, never on boot.

## 03 Observability and on-call

| Alert | Signal | Runbook |
|---|---|---|
| OUTBOX_PENDING_LAG | Oldest PENDING outbox > 2 min | runbooks/OUTBOX_PENDING_LAG.md |
| SETTLEMENT_JOB_FAILED | Monthly settlement errors | SETTLEMENT_JOB_FAILED.md |
| KIORLY_PAYMENT_WEBHOOK_FAILED | PSP webhook failures | KIORLY_PAYMENT_WEBHOOK.md |
| WHATSAPP_DELIVERY_FAILURE_SPIKE | Template sends failing | WHATSAPP_DELIVERY_FAILURE_SPIKE.md |
| SIGNUP_FUNNEL_DROP | Signup completion falls | SIGNUP_FUNNEL_DROP.md |
| INTEGRATION_FAILURE_SPIKE | Integration client errors | INTEGRATION_FAILURE_SPIKE.md |
| PDPC breach procedure | Suspected personal-data breach | PDPC_DATA_BREACH.md (72 h regulator / 3 days subjects) |

- Errors and traces: Sentry (SENTRY_DSN) and OpenTelemetry (OTEL_EXPORTER_OTLP_ENDPOINT), service name per product.
- On-call: Slack and WhatsApp webhooks via notifyOnCall(); founders on rotation until hires (KX18).
- Logs: structured JSON, request/trace IDs, no PHI — patient identifiers hashed; clinical text never logged.
- SLOs: booking API 99.5%, Kiorly API 99.9% business hours, settlement completes by 06:00 Cairo on day 1.

## 04 Security control framework

| Domain | Control | Status (Kiorly) | Ecosystem standard |
|---|---|---|---|
| Identity | Privileged MFA (owner/admin/finance) enforced on AWS prod; disable flag ignored and audited | Shipped (SC04) | Required for all products |
| Sessions | Refresh rotation 30 d, session revoke, OTP rate limits | Shipped (ON02) | Kiorex Account parity |
| Authorization | Role + clinic privilege grants + money visibility + plan entitlements | Shipped | Per-product; never from identity |
| Tenant isolation | tenantId on every row; cross-tenant tests; support access needs consent | Shipped (PA04) | Mandatory test suite |
| API abuse | Rate limits, WAF intent, HMAC with skew + nonce | Shipped (SC06) | Same |
| Data protection | KMS at rest, TLS 1.2+, presigned files, export & offboarding | Shipped (SC05) | Same |
| Secrets | No secrets in git (CI script), Secrets Manager | Shipped | Same |
| Consent | AI, marketplace, messaging consents enforced in code | Shipped (SC03) | Same |
| Pen test | External test before public launch; fix all High | Needs human (NH017) | Annual + major release |
| Backup/DR | Quarterly RDS restore drill in eu-central-1 | Needs human (NH018) | Every product |

## 05 Threat model highlights (STRIDE)

| Threat | Example | Mitigation |
|---|---|---|
| Spoofing | Forged marketplace call books fake appointments | HMAC + nonce + skew; IP allow-list; client revoke |
| Tampering | Commission amount edited after check-in | Frozen snapshot; immutable charges; audit |
| Repudiation | Clinic denies a patient attended | Check-in audit trail; dispute workflow with evidence |
| Information disclosure | PHI in logs or AI prompts | Redaction per market; log scrubbing; consent gates |
| Denial of service | Slot scraping | Rate limits, WAF, cache, per-client quotas |
| Elevation of privilege | Receptionist sees doctor revenue | Money visibility grants; MFA step-up for finance |

## 06 Feature-flag operations

Flags are production controls. They are tested, audited and owned like code.

| Practice | Standard |
|---|---|
| Ownership | Each flag has an owning squad, an off-behaviour description and a runbook line |
| Testing | CI runs the golden flows with all flags ON (production default) and a per-flag OFF contract test proving the universal OFF contract; a nightly 'all optional flags OFF' smoke run |
| Dependency check | CI fails if a flag references an unknown parent or creates a cycle |
| Change process | Reason required; ticket link; two-person rule for global/market money-path OFF; on-call notified in Slack/WhatsApp |
| Incident use | First response to a misbehaving module is OFF at the narrowest scope that contains the blast radius (organization → market → global) |
| Review | Monthly: flags OFF for > 30 days are reviewed (fix and re-enable, or retire the capability) |
| Access | Super admin panel behind Kiorex Account SSO, MFA step-up, IP allow-list; all actions audited |

## 07 Resilience targets

| Product | RPO | RTO | Degradation mode |
|---|---|---|---|
| Kiorly Clinic | ≤ 5 min (PITR) | ≤ 4 h | PWA offline 'today' view; print schedule |
| Kiorex | ≤ 15 min | ≤ 8 h | Hide booking, show clinic phone |
| Kiorly Pharmacy | ≤ 5 min | ≤ 4 h | Offline POS with queued sync |
| Kiorly Lab | ≤ 5 min | ≤ 4 h | Manual result release with dual control |

## 08 Provider security, secrets and mobile (23 Nov 2026)
| Control | Design | Status |
|---|---|---|
| Webhook authenticity | HMAC-SHA256 over the raw body, 5 min timestamp tolerance, de-duplication by event id, forward-only statuses; per-kind secret `<KIND>_WEBHOOK_SECRET` (16 characters or more) | Done in all five backends (tested against a local fake vendor) |
| Secrets | Never in code, logs, audit or git; `.env` and build output ignored; gitleaks in each repo's CI; on AWS from Secrets Manager or SSM (documented, nothing created) | Done in code; injection on AWS Open |
| Startup validation | `MODE=real` with a missing or invalid URL, key, sender id or secret refuses to start and names the variable, never the value; mock in production starts with a warning | Done |
| Retries and idempotency | Timeouts, backoff on network, timeout, 429 and 5xx, never on 4xx; the same `Idempotency-Key` on every attempt (message id, `checkout:<paymentId>`, `refund:<refundId>`) | Done |
| Error hygiene | Vendor body, URL, key and recipient never stored or logged; real mode stores no message body and a masked recipient (platform) | Done |
| Dev simulators | Inbox, sample sends, webhook simulation and demo runs answer 404 in production and in real mode | Done |
| PHI in messages | Declared parameters plus pattern scan on SMS, push and WhatsApp (`PHI_BLOCKED`); audit holds no body or raw address | Done in the layer; pattern list needs DPO review |
| Consent | Pharmacy consent registry blocks dispensing on revoke; platform consent centre; marketing opt-in | Done (registry wire format assumed) |
| Seeds and demo data | Seeds refuse to run in production (`DEMO_SEED_ALLOWED`, non-production check); demo secrets are DEV ONLY and must be rotated for staging and production | Done |
| Mobile sessions | Per-product session, remote sign-out by an administrator kills tokens (e2e 16), sign-out removes the device's push registration | Done (dev) |
| Mobile device hardening | Encrypted minimal cache with wipe, screenshot protection, app lock policy, jailbreak posture, remote wipe (ADR-033) | Planned; biometric lock and secure-store sessions exist in the app but are not verified on a device |
| Staff push payloads | No patient data in push bodies; payload carries ids and a route only | Done in fixtures; real delivery unverified |
| TLS to Postgres | Kiorex DB client honours `sslrootcert`, `DATABASE_SSL_CA`, `PGSSLROOTCERT` | Done |

> **Warning** `AI_DAILY_TOKEN_BUDGET` is counted per API instance; use a shared counter before scaling out. The consent registry wire format is an assumption until the real service exists.

> **Risk** The Passport Cognito Lambda reads secrets from environment variables, and tfvars still hold `TODO_NEEDS_HUMAN` placeholders for `PSP_MODE` and `MESSAGING_MODE` (to be mapped to `<KIND>_MODE`). Nothing can go live on AWS until secret injection is defined.

STRIDE additions: spoofed vendor receipt (HMAC plus timestamp), replayed receipt (event id de-duplication), information disclosure through a message body (declared params plus PHI guard), repudiation (one audit record per attempt).

## 09 Document processing pipeline and job queue (Proposed, 23 Nov 2026)
New worker inside the existing API process, no new infrastructure: a database table `StorageJob` read with `FOR UPDATE SKIP LOCKED` (kinds PROCESS_DOCUMENT, PURGE, RECONCILE, BACKFILL), `sharp` for images, `qpdf` for lossless PDF optimisation in a sandboxed child process with a 60 s timeout and memory limit, magic-byte validation, EXIF and GPS removal, and a malware-scan extension point (GuardDuty for S3). Observability: queue depth, oldest job age, savings percent, quota rejections, presign issues. Flags default to off in production. Detail: KX-25 §06.

## What changed in this revision (23 Nov 2026)
- Revision header moved from Rev 2.2 (not re-issued on 20 Nov) to the 23 Nov 2026 update; added §08 provider security, secrets and mobile.
- Platform baseline, delivery pipeline, observability, resilience and the pen-test and restore-drill items (NH017, NH018) are unchanged and still open.
- Not verified: AWS secret injection, real-vendor webhook signature formats, device hardening.
- Added §09: document processing pipeline and job queue (Proposed, KX-25).

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built.

- **Threat model (section 05)**: growth adds forged provider tokens, provider gaming of attribution, open redirects on `kiorly.link`, widget clickjacking and SDK supply chain, cache poisoning on SSR, private-page indexing, reward farming (Roadmap), consent forgery, WhatsApp prompt injection (Roadmap) and PII in UTM parameters. Mitigations in KX-28 section 09 (Proposed).
- **Controls (Proposed)**: HMAC-signed `lt` tokens with expiry; append-only evidence tables with database triggers; `secretRef`-only integration config; SRI and immutable URLs for the SDK; exact-origin CSP per organisation; rate limiting on the shared Postgres limiter; guard tests `no-health-targeting` and `growth-no-phi`.
- **Flag operations (section 06)**: `growth.*` flags ship ON except launch-locked ones (`growth.analytics_visitor`, `growth.marketing_messaging`, `growth.patient_referral`, `growth.rewards`, `kiorex.whatsapp_ai_assistant`); OFF returns `403 FEATURE_DISABLED`. Safety messaging is never a flag (ADR-025).
- **Observability (section 03)**: growth SLIs and SLOs in KX-28 section 11 (decision determinism 100 percent, public availability 99.9 percent, consent propagation 60 s); runbooks RB-G1 to RB-G8.
- **Secrets**: ad-platform and Search Console credentials are stored only as Secrets Manager references; real integrations wait for the pre-launch pass (FD-04).
- Not verified: any control implemented.
