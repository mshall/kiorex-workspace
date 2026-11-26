# Clinic first AWS deploy: dry run (launch row LG-COM-16)

Date: 26 November 2026. Scope: `clinics-management`, branch `kiorex`, the 9 migrations added since commit `3de69ba5` (the code the live Clinic runs). Nothing was pushed, deployed or touched on AWS. All database work ran on private local databases (`cms_dryrun_a` to `cms_dryrun_d`, PostgreSQL 18.3 on port 5433), now dropped; the API smoke ran on private port 3151.

**Verdict: do not push yet.** The dry run found two blockers that would have stopped the deploy before any migration ran (the API Docker image cannot build; two CI gates fail). Both are fixed in the working tree on this branch (commits listed at the end). With them in, the migrations themselves are low risk (about 50 ms in total on a 5,000 organisation, 100,000 appointment copy). The remaining risk is operational: how a failed migration behaves in the App Runner boot path, and first-boot behaviour changes for live organisations.

## 1. Risks, ranked

| # | Risk | Severity | Status |
|---|------|----------|--------|
| R1 | **The API image does not build.** `apps/api/package.json` now depends on `@kiorex/pay-contract` as `file:../../vendor/kiorex-pay-contract-0.1.0.tgz`, but `apps/api/Dockerfile` (all three stages) and `apps/api/Dockerfile.seed` copy only `package.json` files before `npm ci`. Reproduced with `docker build --target deps`: `npm error enoent ... /repo/vendor/kiorex-pay-contract-0.1.0.tgz`, exit 254. The deploy job would fail at `cdk deploy` (image asset build) after an otherwise green CI. | Blocker | **Fixed** (`COPY vendor ./vendor` before each `npm ci`). Verified: the full API image now builds (deps, build, runner); the container booted. The seed (Lambda) image has the same one-line fix but was not built here because its base image comes from public ECR (kept out of this dry run). |
| R2 | **Two CI gates fail on the branch**, and `deploy` needs `ci_test` green. (a) `npm run typecheck -w web`: `TS6133` unused `t` in `PlatformSubscriptionsTab.tsx`. (b) The new "OpenAPI document is current" step: `openapi/openapi.json` is stale by 782 added lines (COM-1 `/billing/kiorex-commissions/*`, Pay `/billing/pay/*`, `/public/pay/l/{token}`, claims moves). | Blocker | **Fixed** (unused hook removed; `openapi.json` regenerated, deterministic on a second run). Not run here: the Redocly lint of the new document (needs a package download) and the Playwright e2e suite (`run_e2e` is true for this scope). `apps/web/src/lib/openapi-types.gen.ts` was not regenerated (not CI gated; the regeneration produced a 10k-line reorder, so it is a separate commit). |
| R3 | **A failed migration is not self-healing and the health probe hides it.** The entrypoint (`docker-entrypoint.mjs`) binds the port first and answers `/api/v1/health/live` itself, then runs `prisma migrate deploy` in an endless retry loop, and only then starts Nest. App Runner's health check is that same `live` path (interval 10 s, 20 failures allowed). So if a migration fails, the new revision still looks healthy, takes traffic, and answers `503 {"status":"starting"}` to everything; App Runner does not roll back. Reproduced the database side: Prisma applied the first statement of a bad migration and kept it (**migrations are not atomic**), then every retry stops with `P3009 migrate found failed migrations`, so the loop never recovers without an operator running `prisma migrate resolve`. | High (likelihood low, impact full API outage) | Open. Mitigation: section 3 (snapshot first, watch the log, abort and roll the image back, never wait for the retry loop). The migrations below passed on realistic data, which is what lowers the likelihood. |
| R4 | **First-boot behaviour changes for live organisations** (not migration errors). On boot every schedule runs once immediately: `DunningScheduler` (all tenants), `SubscriptionLifecycleScheduler` (SUB-01), `SettlementScheduler`, `CreditWalletScheduler`. SUB-01 sets `autoRenew = false` for every subscription with `cancelAtPeriodEnd = true`; any ACTIVE subscription whose `currentPeriodEnd` is already past is then renewed (auto-renew on) or downgraded to Lite (auto-renew off) on that first run. The default lapse rule changes from READ_ONLY at D+15 and SUSPENDED at D+45 to "downgrade to Lite at D+15, never lockout". | High (business, not technical) | Open. Run the preview queries in section 3 on production before the push and decide if the first-run set is acceptable. |
| R5 | **No pre-deploy backup.** `cicd-pre-deploy-backup.sh` is a no-op ("disabled"). RDS has 35 days of automated backups and `deletionProtection`, but the migrations are applied by the app container with no pause point and there are no down migrations. | Medium | Open. Take a manual RDS snapshot before the push (operator step). |
| R6 | **The post-deploy seed runs against the production database.** `DbSeedFn` runs the incremental seed with `PRISMA_SEED_ENSURE_DEMO_PASSWORDS=true` on every deploy, and the smoke script logs in as `admin@drahmedshall.com` with password `demo`. On an existing database the seed adds missing demo records only (no deletes, no password or role overwrite, verified on the migrated copy, and a second run is a no-op), but it adds the demo group, the Kiorex dev marketplace tenant and pilot tenants if they are missing. This is existing behaviour, listed here so it is a decision and not a surprise. | Medium | Open. Decide whether the live database should hold demo tenants; if not, the seed step and the demo-login smoke need a production variant. |
| R7 | **One push does everything, and a second push cancels it.** `deploy-aws.yml` has `cancel-in-progress: true`; the scope for this change is `full` (see section 4). A follow-up push during the 60 to 90 minute run cancels the deploy mid CDK update. | Medium | Open. One push, then no further pushes to `main` until the smoke job finishes. |
| R8 | **Local PostgreSQL 18 versus RDS PostgreSQL 16.** The migrations use only standard DDL (enum `ADD VALUE IF NOT EXISTS`, `DO` blocks, constraint triggers, `ALTER ... ADD COLUMN ... DEFAULT <constant>`, which does not rewrite the table on 11 and later), so 16 behaves the same, but it was not run on a 16 server. | Low | Open. Re-run on a restored snapshot copy of production when one exists (the plan asked for a production copy; none was available locally). |
| R9 | **Old code on the new schema.** Rolling the image back after the migrations ran is safe as long as no row uses the new optional shapes: `migrate diff` of the migrated schema against the old schema shows only additions plus `KiorexCommissionCharge.rateId` becoming nullable. Charges priced by the Kiorex org rate (COM-2) have `rateId` null; the old code reads `rateId` as required. | Low to medium | Open. Section 5 has the check to run before a rollback. |
| R10 | Cosmetic schema drift: `migrate diff` against `schema.prisma` shows two foreign key names that differ (`CreditReservation_wallet_fkey`, `UsageUnitLedger_tenant_fkey`). They come from older migrations already live. No data effect. | Info | Leave. |

## 2. Migration-by-migration record

Method: the `3de69ba5` migration set (197 migrations) was applied to `cms_dryrun_a` with `prisma migrate deploy`; representative data was loaded (5,000 organisations and clinics, 100,000 patients and appointments, 100,000 `KiorexCommissionDecision`, 50,000 `KiorexCommissionCharge`, 20,000 `KiorexPayout`, 20,000 invoices with 40,000 lines, 5,000 subscriptions, wallets, 20,000 credit ledger rows, 5,000 care plan requests); then the 9 new migrations were applied together with `prisma migrate deploy` exactly as the entrypoint does (whole run 0.57 s wall, the CLI start-up included). Per-migration times are from `_prisma_migrations`. "Replay" means the migration SQL was run a second time on the migrated database. Prisma runs a migration without wrapping it in a transaction (verified), so "atomic" is not assumed anywhere below.

| Migration | Time | What it does and what it locks | Idempotent (replay) | Rollback |
|---|---|---|---|---|
| `20270107120000_growth_sponsored_promotions` | 14 ms | `ALTER TYPE "KiorlyLineType" ADD VALUE IF NOT EXISTS 'PROMOTION_EXPENSE'` (new value not used in the same migration); 7 `CREATE TYPE` in guarded `DO` blocks; 3 nullable `ADD COLUMN` on `KiorexCommissionDecision` (metadata only, brief ACCESS EXCLUSIVE); 7 new empty tables, indexes, CHECKs, append-only and cap triggers; foreign keys to `Tenant` (momentary SHARE ROW EXCLUSIVE on `Tenant`). No rewrite, no destructive step. | Yes (notices only) | Drop the new tables, types, functions and 3 columns. The enum value cannot be removed (harmless). |
| `20270128100000_growth_corporate_b2b` | 3 ms | New table `ProviderB2BReferral` with indexes, CHECK, FKs to `Tenant` and `Clinic` (momentary lock on both). | Yes | `DROP TABLE` (no other table depends on it). |
| `20270129090000_care_plan_request_acquisition` | 1 ms | `ADD COLUMN "acquisition" JSONB` nullable on `CarePlanRequest` (metadata only). | **No** (plain `ADD COLUMN`; replay errors "already exists") | `DROP COLUMN` (loses that column only). |
| `20270201100000_sub01_auto_renew_lite_downgrade` | 11 ms (5,000 subscriptions) | One `ALTER TABLE "Subscription"` with 11 `ADD COLUMN`, including `"autoRenew" BOOLEAN NOT NULL DEFAULT true` (constant default: no table rewrite on 11 and later); `UPDATE "Subscription" SET "autoRenew" = false WHERE "cancelAtPeriodEnd"` (row locks on those rows only, 714 here); 2 non-concurrent `CREATE INDEX` on `Subscription` (blocks writes to that table while building: milliseconds here, about a second per million rows); new enum and table `SubscriptionPolicyChange` with an FK to `Market`. | **No** (no `IF NOT EXISTS`; replay errors on the first column) | `DROP` the 11 columns, 2 indexes, the table and the enum. Lossless for the old behaviour: `cancelAtPeriodEnd` is untouched. |
| `20270226090000_msg_real_whatsapp_window_events` | 3 ms | Two new tables with indexes. | **No** (plain `CREATE TABLE`) | `DROP TABLE` both. |
| `20270302100000_com1_kiorex_commission_collection` | 2 ms | `ADD COLUMN "commissionDeducted" DECIMAL(14,2) NOT NULL DEFAULT 0` on `KiorexPayout` (constant default, no rewrite); new table `KiorexCommissionCollection` with FK to `Tenant`. | Yes | Drop the table and the column. |
| `20270303090000_pay_unified_collections` | 3 ms | New tables `ClinicPayMatch` and `ClinicPayLink` with indexes and CHECKs (no FKs). | Yes | `DROP TABLE` both. |
| `20270304090000_com2_kiorex_commission_rate_view` | 2 ms | New table `KiorexCommissionRateView`, unique index, FK to `Tenant`. | Yes | `DROP TABLE`. |
| `20270304100000_com2_charge_rate_source` | 9 ms | `ALTER COLUMN "rateId" DROP NOT NULL` (instant); 3 nullable `ADD COLUMN`; `DROP CONSTRAINT IF EXISTS` then `ADD CONSTRAINT ... CHECK` on `KiorexCommissionDecision`. **This is the only statement that scans a large table under a heavy lock**: adding the CHECK validates every row while holding ACCESS EXCLUSIVE on `KiorexCommissionDecision` (reads and writes of the decision table wait). 100,000 rows took single-digit milliseconds, so even millions of decisions stay in seconds; if the table is far larger, add it `NOT VALID` then `VALIDATE CONSTRAINT`. | Yes (drop then add) | `SET NOT NULL` on `rateId` fails if any charge was priced by the Kiorex rate (null `rateId`); drop the columns after. Treat this one as forward-fix only. |

Total: about 48 ms of migration time. No destructive `DROP` of data, no `ALTER TYPE` of an existing column type, no table rewrite, no `CREATE INDEX CONCURRENTLY` needed at current sizes.

## 3. Data integrity and boot checks (all passed)

- Row counts of 14 tables (organisations, clinics, patients, appointments, subscriptions, charges, decisions, payouts, invoices, invoice lines, wallets, ledger entries, care plan requests, rates) identical before and after.
- A checksum over the unchanged columns of all 100,000 decisions is stable; no charge got a `rateSource`; the new CHECK on `KiorexCommissionDecision` is present and validated; no constraint is left unvalidated (`pg_constraint.convalidated`).
- SUB-01 data rule: 714 subscriptions with `cancelAtPeriodEnd = true` became `autoRenew = false`; the other 4,286 are `true`.
- `prisma migrate diff` migrated database versus `schema.prisma`: only the two cosmetic foreign key names (R10). Versus the old schema: only additions, plus the `rateId` nullability.
- API: `tsc --noEmit` clean; `nest build` clean; booted from `dist` against the migrated database on port 3151: `/api/v1/health/ready` returned `database: ok`, startup schedulers ran against the migrated data (3,750 tenants through dunning) without a database error.
- The real image (`docker build`, runner stage) was started with `PRISMA_MIGRATE_ON_BOOT=true` against a database at the `3de69ba5` state: it applied the 9 migrations, started Nest and answered `health/ready` with `database: ok` in about 3 seconds after start. This is the production path (entrypoint, `npx prisma migrate deploy`, then Nest).
- The incremental seed (what `DbSeedFn` runs) ran twice on the migrated copy: second run changed nothing.
- Tests on a private database after the Part 2 change: API unit suite 1,466 of 1,466; API integration suite 580 passed, 0 failed, 1 skipped (of 581); web unit 200 of 200; money-path coverage gate 269 of 269 and above 85 percent; web typecheck clean.

Pre-push preview queries to run on the production database (read-only), for R4:

```sql
-- first-run SUB-01 set: ACTIVE and past period end, split by what will happen
SELECT p.key, s."cancelAtPeriodEnd", count(*) FROM "Subscription" s JOIN "Plan" p ON p.id = s."planId"
 WHERE s.status = 'ACTIVE' AND s."currentPeriodEnd" <= now() GROUP BY 1, 2;
-- tenants with an unpaid invoice (the dunning pass will act on them at first boot)
SELECT count(DISTINCT "tenantId") FROM "KiorlyInvoice" WHERE status IN ('ISSUED','PARTIALLY_PAID') AND "dueAt" < now();
-- tenants carrying the old commission listing pause flag (the Part 2 change clears it once at first boot)
SELECT count(*) FROM "Tenant" WHERE "kiorexBillingPausedAt" IS NOT NULL;
```

## 4. What a push of this size triggers

`scripts/detect-deploy-scope.sh 3de69ba5 HEAD` returns `scope=full api=true web=true infra=true deploy=true integration=true e2e=true web_build=true`. The reasons: `apps/api/*`, `apps/web/*`, `package-lock.json` and `package.json` changes (`@kiorex/pay-contract` added), the vendored tarball (falls in the catch-all `OTHER`), `infra/src/*`, `scripts/cicd-*.sh`, `.github/workflows/*`. Any one of the last three already forces `full`. There is no way to make this a web-only or api-only deploy.

Sequence on a push to `main` (without `[skip ci]`):

1. `changes`: scope detection (above).
2. `ci_test` (reusable): Prisma generate, migrate and seed on a CI Postgres, `npm run typecheck` (api and web), web unit, API unit, API integration, the new OpenAPI drift and Redocly lint step, money-path coverage gate, Playwright e2e. All must pass; `deploy` is skipped otherwise.
3. `deploy` (90 minute limit): `cicd-deploy.sh` with `DEPLOY_SCOPE=full`: `npm ci`, `npm run build -w web`, `check-boot-proxy-order.mjs`, CDK synth (ASCII checks), `cleanup-orphan-vpc-connectors`, `cdk deploy`. CDK builds two Docker images from the repo root (`ApiImage` from `apps/api/Dockerfile`, `DbSeedFn` from `apps/api/Dockerfile.seed`; both needed the R1 fix), updates App Runner (`autoDeploymentsEnabled: false`, so only this CDK update rolls it), the Lambda, S3 and CloudFront.
4. `cicd-wait-apprunner-deploy.sh`: polls the App Runner `UPDATE_SERVICE` operation up to 600 s. It sees `SUCCEEDED` as soon as the proxy answers `health/live`, which is before the migrations finish (R3). Only a crash or port failure shows as `ROLLBACK_SUCCEEDED`.
5. `cicd-post-deploy-seed.sh`: invokes `DbSeedFn` (15 minute limit, incremental seed, R6). It can run while the API container is still migrating; both are idempotent and Prisma holds an advisory lock for concurrent `migrate deploy`.
6. `cicd-post-deploy-smoke.sh`: up to 360 s for `health/ready` with `database: ok` (this is the real readiness test, it fails when Nest never starts), then demo login, assistant context and chat, admin users list (at least 3). It does not touch the new features, and it has no rollback.
7. On failure: `post_deploy_diagnostics` (CloudFormation and CloudWatch log bundle) and an optional Cursor agent that opens a fix PR. Neither reverts anything.

What can fail that nothing catches today: a migration failure after the proxy is healthy (R3); the smoke checks login and health only, so a broken Kiorex, Pay or commission path would pass; the seed Lambda runs against production (R6).

## 5. Feature flags and switches for the first deploy

No flag key was added since `3de69ba5` (checked against the registry). The new code is gated by existing keys. Recommended state for the first deploy, set in the control plane or the market defaults before the push (a flag set while the deploy runs applies at once):

| Flag or switch | First deploy | Why |
|---|---|---|
| `clinic.provider_credit_v2` | **Off** | Gates the credit v2 module and the sponsored promotions API (`PromotionsController`) and the promotion budget service. Promotions are ADR-048 Proposed. |
| `growth.provider_marketing_v2` | **Off** | Gates marketing v2 and the corporate B2B referral endpoints. |
| `clinic.usage_bundles` | **Off** | Skeleton only. |
| `clinic.commission_settlement` | Keep its current live value | Creates the commission charges; COM-1 collection and the COM-2 rate view are Kiorex driven and need the Kiorex side configured. |
| `clinic.kiorly_pay_deposits`, `card_payments`, `fawry`, `instapay` | Keep the current live values | Pay unified collections adds tables and endpoints; real PSP adapters stay in mock mode until the human gate (`NEEDS_HUMAN_REAL_MODE_NOT_APPROVED`) is recorded. |
| `whatsapp_reminders`, `clinic.whatsapp_inbound` | Keep the current live values | MSG-REAL adds the 24 hour window tables; real mode stays off until template approvals. |
| Launch-locked keys (`clinic.home_visits`, `clinic.whatsapp_ai_receptionist`, specialty templates, `nurse.care_plans`, `nurse.mar`, `nurse.individual_kiorex_listing`) | Stay locked | Their human gates are not recorded. |

Not flags, by design (ADR-025): the SB-05 decision of 26 Nov 2026 (collection never pauses listing) is a code rule; there is no switch to turn the old D+30 pause back on.

## 6. Recommended deploy steps

1. Commit the R1 and R2 fixes (done in this branch, see below) and let the full CI suite run on a branch or pull request first; the two items not run here (Redocly lint, Playwright) must be green.
2. On production (read-only): run the section 3 preview queries and decide R4. Decide R6.
3. Set the flags of section 5. Confirm provider modes (email, WhatsApp, SMS, PSP) are still the intended ones.
4. Operator: take a manual RDS snapshot (R5); note the current App Runner image tag (the rollback target).
5. Merge to `main` without `[skip ci]` as one push; no further pushes to `main` until the smoke job is green (R7).
6. While the deploy runs, watch the App Runner log for `[boot] prisma migrate deploy` and `completed OK`; a `migrate failed with status ... retrying` line means stop and use section 7.
7. After the smoke: check `health/ready`; check one Lite organisation with an unpaid invoice still has its Kiorex listing (Part 2); check a subscription renewal and a downgrade audit entry; check the unpaid-invoice and flag counts against the preview.

## 7. Rollback plan

- **Application image.** Re-point App Runner to the previous image (the tag noted in step 4), or revert the merge on `main` and push (a second full deploy, 60 to 90 minutes). The old code runs on the new schema (R9): before doing so run `SELECT count(*) FROM "KiorexCommissionCharge" WHERE "rateId" IS NULL;`. If it is above zero the old code can fail to read those charges (fix forward, or leave COM-2 org-rate pricing unused until then).
- **Database.** There are no down migrations and none are needed for a code rollback: every change is additive. Do not run the reverse SQL of section 2 on production except under an incident with a snapshot taken. The recovery for a data problem is the snapshot or point in time restore (35 days).
- **A migration that fails in production.** (1) Stop the retry loop (it cannot heal: `P3009`). (2) From an operator host inside the VPC run `prisma migrate status`. (3) If the failed migration is one of the idempotent ones (section 2), `prisma migrate resolve --rolled-back <name>` and redeploy. (4) If it is one of the four non-idempotent ones (`care_plan_request_acquisition`, `sub01_auto_renew_lite_downgrade`, `msg_real_whatsapp_window_events`, and partially `sponsored_promotions` for its enum value), first remove what it created (the reverse SQL in section 2), then `resolve --rolled-back`, then redeploy. (5) Meanwhile roll the App Runner image back so the old revision serves traffic.
- **Behaviour (not code).** The SB-05 listing change is reversible only by a code change. The first-boot SUB-01 and dunning effects (R4) cannot be undone by a rollback of the image: renewals and Lite downgrades already written stay; the audit and `SubscriptionEvent` rows identify them.

## 8. Items not done in this dry run

No copy of the real production database was available locally, so sizes are synthetic. Nothing was run against PostgreSQL 16, the seed Lambda image, Redocly, or Playwright. `cdk synth` was not run (it needs the AWS account lookup). The shared development database `kiorly` was not used on purpose; one command in this session (the money-path coverage gate run without its database set) ran test files against the default database in `apps/api/.env`, which is the shared `kiorly` database. It was a single run of test files that create their own uniquely named test tenants, and it was reported to the coordinator for cleanup.
