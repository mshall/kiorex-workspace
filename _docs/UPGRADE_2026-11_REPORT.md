# Toolchain upgrade, 20 Nov 2026: versions and verification report

Scope: every repo of the workspace moved to Node 26 LTS, NestJS 12, Prisma 7 (pg driver adapter), React 19, Vite 8, Tailwind 4, TypeScript 6 (details and migration logs in each repo's `Docs/UPGRADE_NOTES.md`). PostgreSQL stays 16 (KX-01). This report records the cross-product verification that followed. Nothing was pushed or deployed.

## Versions per repo

| Repo (branch) | Node | NestJS | Prisma | React / UI | Vite | Tailwind | TypeScript | Other |
|---|---|---|---|---|---|---|---|---|
| clinics-management (`kiorex`) | 26 (`.nvmrc`, engines >=24) | 12.5 | 7.10 + adapter-pg | 19.3 | 8.3 | 4.3 | 6.0 | openid-client 6.9, zod 4, ESLint 10, Playwright 1.65 |
| kiorex-platform (`main`) | 26 | 12.5 | 7.10 (generator `prisma-client`) | 19.3 (web, ops), Expo 58 / RN 0.88 (mobile) | 8.3 | 4.3 | 6.0 | jest 30, vitest 5, zod 4 |
| kiorly-pharmacy (`main`) | 26 | 12.5 | 7.10 | 19.3 | 8.3 | 4.3 | 6.0 | |
| kiorly-lab (`main`) | 26 | 12.5 | 7.10 | 19.3 | 8.3 | 4.3 | 6.0 | zod 4 |
| kiorex-account (`main`, dev IdP) | 26 | (Express, oidc-provider 9) | (raw `pg`) | account UI 19 | n/a | n/a | 6.0 | zod 4 |
| kiorex-contracts (`main`) | engines >=26.13 | n/a | n/a | n/a | 8.3 (vitest 5) | n/a | 5.9 | |
| kiorly (`main`) | n/a | n/a | n/a | Expo 58, React 19.3 | n/a | n/a | 5.9 | jest 29 |

Local toolchain: Node 26.13.1 (darwin-arm64, SHA-256 verified against nodejs.org) installed in `~/.local/node-26/`, put first on `PATH` for every command. Docker Desktop 29.9 is running.

## Verification results (Node 26.13.1, full standard stack rebuilt with `e2e/scripts/up.sh --build --seed --restart`, `scripts/seed-all.sh --reset`)

| Suite | Result |
|---|---|
| `e2e` `npm test` (cross-product vitest harness, real stack) | 15 files: 14 run, 62 tests passed, 5 skipped (11-nurse-lab, runs only in the isolated stack), 0 failed (last of 4 full runs; the earlier runs exposed the flakes listed below, all fixed) |
| `e2e` `npm run test:nurse` (isolated stack :3012/:4002/:3202) | 5 / 5 passed |
| New `15-hmac-rawbody` (added in this pass, included above) | 5 / 5 passed |
| kiorex-platform API: unit + integration (jest) | 76 + 242 passed |
| kiorex-platform web (vitest) / kiorex-account (vitest) | 132 / 206 passed |
| clinics-management API unit (node:test) / web unit | 798 / 67 passed |
| kiorly-pharmacy API unit / kiorly-lab API unit | 81 / 112 passed |
| `tsc --noEmit` (all changed packages) | clean |
| Docker `build -f apps/api/Dockerfile.seed` for all four repos | 4 / 4 built; images start on their Lambda base, `@prisma/adapter-pg` + `pg` load |
| Headless-browser sweep (Chromium via Playwright; light/dark x EN/AR x main pages, console + failed-request capture) | Kiorly clinic 10 routes (40 shots), patient web 9 (36), ops 12 (48), pharmacy 10 (40), lab 10 (40), Passport account 7 (28), Expo web (sign-in, light/dark): no console errors or failed requests after the two fixes below (expected 402/403 only: plan paywall and launch-locked feature flags) |
| Swagger / OpenAPI | Kiorly `/docs` + `/docs-json` (591 paths), pharmacy (240), lab (290), Kiorex `/api/docs` + `/api/docs-json` (169), Passport discovery + JWKS: all served |
| Kiorly to Passport login (openid-client 6) end to end | Passed: `Sign in with Kiorex Passport` -> Passport phone + OTP -> `/auth/kiorex/callback` code exchange -> logged in as the linked Nurse user (`/home-visits/today`), no console errors |

Note: the built-in Browser pane denied navigation to the locally started dev servers (no approval available in this unattended run), so the browser checks were done with Playwright Chromium (same screenshots, console and network capture) instead of the pane.

### HMAC raw-body signatures under Nest 12 / Express 5
`rawBody: true` works on all surfaces. Covered by the existing flows (Kiorly to Kiorex outbox, flag push, marketplace API, pharmacy/lab machine APIs and their webhooks to Kiorex) and by the new test `e2e/test/15-hmac-rawbody.e2e.ts`, which signs pretty-printed bodies with CRLF, Arabic text and escaped characters (any re-serialisation would break them) and asserts that a changed signature, a whitespace-only body change, a wrong secret and a tampered canonical-string body are all 401 on every inbound surface.

### Prisma 7 pg adapter: URL parameters, SSL, pooling
- `schema`, `connection_limit`, `connect_timeout`, `pool_timeout`, `pgbouncer` are consumed by each adapter factory and removed before the string reaches `pg`. `sslmode=no-verify` (used by the AWS seed Lambdas) is parsed by `pg-connection-string` 2.14 to `rejectUnauthorized:false`: verified. `sslmode=require|prefer|verify-ca` are treated by pg 8.23 as `verify-full` (with a deprecation warning; pg 9 changes this to libpq semantics).
- Pool sizing was implicit (pg default 10; Prisma 6 used num_cpus*2+1). It is now explicit and identical everywhere (clinics `create-prisma-client.ts`, kiorex `client-factory.ts`, pharmacy/lab `pg-adapter.ts`, dev IdP `db.ts`): `connection_limit=N` in `DATABASE_URL` wins, else `DB_POOL_MAX`, else 10 (unit-tested, documented in each `.env.example` and in `e2e/STACK.md`).
- Budget on the shared dev cluster (`max_connections=100`): five Nest/IdP processes x max 10 (idle connections are reaped after 10 s) plus seeds/tests at `connection_limit=2..3` plus the isolated nurse stack at 3 each. Measured peak during a full `npm test` run: 39 connections total.

## Fixes made in this pass (all committed locally, none pushed)

| Repo | Commit | Fix |
|---|---|---|
| kiorex-platform | `98a07ad` | Real race behind the known 04-pharmacy flake: `PharmacyService.reject/cancel` (and the lab equivalents) moved the order to REJECTED/CANCELLED and refunded in a second, separate transaction, so a reader could see REJECTED while the payment was still CAPTURED (and a crash between the two left an un-refunded order). Status change and refund now commit in one transaction (`PayService.refund/refundOrder` accept the caller's `Tx`). |
| kiorex-platform | `64044f8` | Explicit pool default (`DB_POOL_MAX`, 10) + unit test; `.env.example` note |
| kiorex-platform | `0789315` | React 19 DOM nesting warning on the appointment page (`<div>` inside `<p>`) |
| clinics-management (`kiorex`) | `fee24d1` | Explicit pool default + test + `.env.example`; web called `/billing/trial` and `/billing/access-state` without the `/api/v1` prefix (404 on every page load, silently swallowed) |
| clinics-management (`kiorex`) | `781b1bc` | UPGRADE_NOTES: openid-client 6 end-to-end result, pool default |
| kiorly-pharmacy | `f908c8d`, `949df56` | Explicit pool default; PO numbering used `count+1` and collided forever once demo POs had been deleted (this broke `seed-all.sh --reset`); now highest existing + 1 |
| kiorly-lab | `a2dabb7` | Explicit pool default |
| kiorex-account | `a57b397` | Dev IdP pool size via `DB_POOL_MAX` (default 10) |
| workspace (root repo, branch main) | `38831b5` | `e2e`: `freeSlots/pickSlot` can bypass Kiorex's 60 s slot cache (`fresh`), used for 12-waitlist and for random slot picks (fixes the 10 -> 12 stale-cache failure and the random-slot collisions in 03 BK-04); 03 BK-04 now counts only ACTIVE appointments (SCHEDULED, CONFIRMED, CHECKED_IN) at the slot, because COMPLETED rows from 06 accumulate in future slots across runs (12 / 12 clean repeat runs); 14-care-plan starts at +10 days (collided with 13-home-visit's CHECKED_IN visits and the seeded demo visit on the same nurse calendar); new 15-hmac-rawbody; CLAUDE.md binding-rules line; STACK.md |

Environmental findings (not code bugs, written into `e2e/STACK.md`): stale dev servers of this workspace (`nest start --watch`, a `start:swc` pharmacy on :3101) share the databases and run their own outbox workers; a pharmacy worker in `KIOREX_MODE=mock` marks events SENT without delivering them (this, not Nest 12, caused one false 04 timeout). The Kiorly API on :3010 was also killed by something outside this session several times (SIGKILL, no log; other agents work in the founder checkout on the same Postgres and ports).

## Known follow-ups
1. **RDS TLS with the pg adapter in AWS.** pg verifies certificates (`require` = `verify-full`). The seed Lambdas use `sslmode=no-verify`. For the APIs either keep `no-verify` (encrypted, unauthenticated server) or ship the RDS global CA bundle and use `sslmode=verify-full&sslrootcert=<path>` (or `NODE_EXTRA_CA_CERTS`). Kiorex's `client-factory.ts` maps `sslmode=require|verify-*` to `ssl: true` and drops the parameter, so it cannot take `sslrootcert` today: pass `ssl: { ca }` there when this is done. Plan for pg 9 libpq semantics (`uselibpqcompat=true`).
2. **Seed Docker images.** All four `Dockerfile.seed` build, but kiorex-platform, kiorly-pharmacy and kiorly-lab use `lambda/nodejs:26` while clinics and the Lambda runtime (`nodejs24.x`) use 24; align them (or all move to 26 once Lambda GA). Run the image handlers against a scratch RDS-like DB before the first deploy.
3. **Lambda runtime** `nodejs24.x` vs Node 26 (preview-only on AWS): bump `jobs.tf`, the CDK stack, `Dockerfile.seed`, `db-backup` at GA.
4. **react-hooks lint**: about 140 React Compiler findings in clinics `apps/web` are warnings; burn down and promote to errors. Check the other web apps for the same rules.
5. **TypeScript 7 blockers**: typescript-eslint 8.73 supports `<6.1`, openapi-typescript peers `^5`, Nest CLI and Prisma use the JS compiler API; kiorex-contracts and kiorly are still on TS 5.9.
6. Prisma generator: clinics/pharmacy/lab stay on `prisma-client-js` (kiorex-platform already on `prisma-client`).
7. Kiorly API on :3010 dying unexplained during this session: find the process that sends SIGKILL (`scripts/free-dev-ports.sh` of the founder checkout and Playwright web servers also use :3010/:5174 area).
8. Vite dev warnings: `__dirname` in the kiorex ops/web `vite.config.ts` (use `import.meta.dirname`); occasional 504 for `maplibre-gl-worker.mjs` right after dependency re-optimisation (dev only).
9. The pharmacy seed logs Prisma `P2002` for `SettlementEntry` although the code handles it idempotently (noise from Prisma's query log).
