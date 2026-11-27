# kx-test release: final whole-ecosystem sweep (27 Nov 2026, evening)

No secret values here. The AWS Clinic stack (E1DE0H2K3M17YL, its RDS and App Runner) was not touched by tofu; the Clinic was changed only through its normal `main` deploy (see the last section). No tofu was applied.

## What was compared (live image tag versus origin/main, 27 Nov 2026 evening)

| Service | Live before | origin/main | Action |
|---|---|---|---|
| platform-api and jobs | `0495e900` | `0495e900` | none |
| pharmacy-api | `c05e9cbb` (already carries ADR-060: `20270312090000_tenant_market_immutable` applied, trigger present) | `c05e9cbb` | none |
| lab-api | `fab6d47f` (migration `20270312090000` NOT applied) | `85ce4a97` (ADR-060 market immutability) | released, below |
| passport | `04ca9f7f` | code identical for the service; later commits only touch the Kiorly site and docs | see the Passport section |
| Pharmacy and Lab web (static) | MFA friendly screen already synced (release of the MFA log) | unchanged since | none |

## Lab release (ADR-060 market immutability)

1. Safety check of the migration: it only creates the function `kx_tenant_market_immutable()` and the trigger `Tenant_marketCode_immutable` (BEFORE UPDATE OF "marketCode" ON "Tenant"); no row is read or written; kx-test holds one Lab tenant (market `EG`), so the trigger cannot fire on existing data.
2. Backup first: `pg_dump -Fc lab` to `/srv/kx/backups/lab-pre-market-immutable-20261127T145841Z.dump` on the host (about 1.6 MB).
3. Image `kx-test/lab-api:85ce4a97` built from the merged head (`docker build -f apps/api/Dockerfile`), pushed, released with `deploy.sh test --tag lab-api=85ce4a97` (release `20261127T145933Z-397254ef`; only `LAB_API_TAG` changed, the other three tags were read from the live `release.env` first).
4. Verified: container healthy, `_prisma_migrations` newest row `20270312090000_tenant_market_immutable`, trigger `Tenant_marketCode_immutable` present, `https://labs.test.kiorly.com/health` 200.

## Deploy tooling hardening (committed in the workspace)

`infra/tofu/deploy/scripts/deploy.sh` now refuses (exit 65) a `KX_REGISTRY` that has neither a dot nor a slash (the incident of the closing release: a display name made `docker compose pull` fail on the host), refuses a stored registry value of that kind, refuses an empty `release.env` value, and refuses any empty `urls/<product>.env` (the incident of the MFA release: Passport started without its issuer). Offline test: `bash infra/tofu/deploy/scripts/test-deploy-guards.sh` (3 cases). `validate-registry.mjs` already compares real paths (the macOS `/tmp` symlink case).

## Passport release (sign-in limits)

1. Backup first: `pg_dump -Fc passport` to `/srv/kx/backups/passport-pre-signin-limits-20261127T152836Z.dump` on the host (113 KB). The schema change is additive (two new tables `signin_limits`, `signin_limits_changes`, created by the idempotent start-up migration); nothing existing is altered.
2. Image `kx-test/passport:437a988` (kiorex-account `437a988`), release `20261127T152921Z-ec90eb24` (only `PASSPORT_TAG` changed; the other tags were read from the live `release.env` first).
3. Verified: `https://passport.test.kiorex.com/healthz` 200, container healthy, `GET /api/ops/signin-limits` 401 without a token; the live spec `12-signin-limits` proves the defaults (5, 20, 5, 300, 15), the ranges and a full maker-checker round trip.

## Host housekeeping

The host disk was 90 percent full (25 of 29 GB, mostly old images). `docker image prune -a -f` freed 16 GB (now 9.7 GB used, 35 percent). Rollback still works: `docker compose pull` fetches a missing image from the registry.

## Clinic (both branches, deployed from `main`)

Founder rules followed: change on `kiorex` (`d03f1404`) and `main` (`c2bbf6e1`, no `[skip ci]`), no run in flight before the push, RDS snapshot `pre-seed-scrub-20261127` taken first (no migration in this change, the snapshot is a precaution because the post-deploy seed runs against the real organisation), run `46024320894` watched to green (CI test, deploy, post-deploy smoke). After the run: `https://d92iz83i79c05.cloudfront.net/api/v1/health/ready` `{"status":"ok","database":"ok"}`, `https://clinics.test.kiorly.com/api/v1/health/ready` 200, and the seed Lambda log says "existing database content detected - incremental ensure only (no deletes, no password/role overwrites)". The organisation's rows were not read or written by this release other than through that insert-only seed. A deeper per-organisation check needs a signed-in session and was deliberately not made with the published demo password.
