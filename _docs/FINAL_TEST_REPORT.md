# Final test report (Q9, 20 Nov 2026, ~06:40-07:35 local)

Run one repo at a time against the shared Postgres (:5433); throw-away dev stacks were stopped first (APIs 3011/3012/4001, webs 5185/5186, flag fixtures 4101/4102). Logs: `kiorex-v2/.e2e/q9/*.log`.

| Suite | Command | Result |
|---|---|---|
| kiorex-contracts | `npm run lint && npm test` | PASS, 116 tests |
| kiorex-account | `npm run typecheck && npm test` (dev IdP + packages + passport-ui jsdom) | PASS, 184 tests (22 files) + new KA-09 sent-invitations test |
| kiorex-account Playwright (passport-ui e2e) | `npm run test:e2e` | NOT RUN in Q9 (needs Chrome + own servers); last green per its owner |
| kiorly-pharmacy | typecheck + lint + `npm test` (api unit 39 + e2e 85, web 6) | PASS, 130 tests |
| kiorly-lab | typecheck + lint + `npm test` (api unit 58 + e2e 91, web 6) | PASS, 155 tests |
| kiorex-platform typecheck + lint | `npm run typecheck && npm run lint` | PASS (all workspaces) |
| kiorex-platform api unit | `npm run test:unit` | PASS, 63 |
| kiorex-platform api integration | `npm run db:test:prepare && npm run test:integration` | PASS, 241 (25 suites), incl. new device-registry test |
| kiorex-platform web / ops / mobile | vitest / vitest / jest | PASS 112 / 32 / 111 |
| kiorex-platform Playwright (web e2e) | `apps/web/e2e/*` | NOT RUN in Q9 (own throw-away stacks) |
| clinics-management typecheck + lint | `npm run typecheck && npm run lint` | PASS |
| clinics-management unit | `npm run test:unit`: web 43, api 768, field-visit 48, infra 5 | PASS (infra needed `npm ci` in `infra/` and a web build: both environment, no code change) |
| clinics-management integration | `npm run test:integration` against `kiorly_test` | PASS, 358 |
| clinics-management web Playwright (incl. nurse specs) | `apps/web/e2e/*` | NOT RUN in Q9 (own stacks); last green per Docs/NURSE_EDITION.md |
| Cross-product E2E (real stack) | `cd e2e && npm test` | PASS: 13 files, 57 tests, 1 file skipped (11 = isolated stack) |
| Nurse -> Kiorex -> Lab E2E (isolated stack) | `cd e2e && npm run test:nurse` | PASS, 5 tests |
| OpenTofu | `tofu fmt -check -recursive` + `init -backend=false` + `validate` on all 11 live stacks, 5 module trees | PASS (kiorex-account stacks fixed in Q9) |
| `scripts/seed-all.sh --reset` | | NOT RUN: the permission system refused the destructive reset; the idempotent `scripts/seed-all.sh` was run (twice) and succeeded |

## Failures found in the first full run, and root causes

| Failure | Root cause | Fix |
|---|---|---|
| 05-lab golden path 409 | (1) demo-lab tenant had no safety contact (`SAFETY_CONTACT_REQUIRED`, KLORD04) because the base seed returned early on an existing tenant; (2) the field-safety lifecycle now needs `arrive` (geostamp) before collection; (3) the demo phlebotomist's open demo visits overlapped (`PHLEBOTOMIST_UNAVAILABLE`) | seed backfills the synthetic contact (kiorly-lab 92bf8c2); test arrives and picks a non-overlapping slot |
| 10-resilience "lost-reply booking adopted" timeout (only in the full run) | the per-clinic circuit opened while Kiorly was down was still open when reconciliation ran, so the sweep counted the Kiorly read as an error (by design) | test waits for the circuit to close and repeats the sweep (3 consecutive full runs afterwards were green) |
| 11-nurse-lab failed on the shared stack | needs its own outbox workers and the KIORLY_NURSE lab registration (documented) | skipped in the default run; `npm run test:nurse` runs it on the isolated stack |
| Clinic integration HVSAF01 drill + KX-02 resync (first run) | integration tests were run against the live `kiorly` dev DB and saw demo data (arrived visits, extra providers) | run against `kiorly_test` (all 358 pass). NOTE: `apps/api/.env` points DATABASE_URL at the dev DB; always override for tests |
| Clinic infra CDK tagging (2) | `infra/node_modules` absent and `apps/web/dist` not built | environment only |
| tofu validate on kiorex-account (2 stacks) | Passport SPA client has no `backchannelLogoutUri` | `try()` in main.tf (kiorex-account) |
| Real product bug found by new E2E 13 | `MarketplaceModule` never imported `HomeVisitsModule`: every real Kiorex HOME slot/hold/booking returned 400 | fixed + regression test (clinics-management b1ca51d) |

## Stack state at hand-over

Standard stack restarted from the final builds: Passport :4400, Kiorly Clinic :3010, Kiorex :4000, Pharmacy :3100, Lab :3200 (`e2e/scripts/up.sh --build --seed --restart`), Kiorly web :5174 (vite), patient web :5180, ops :5181, Expo :8081, pharmacy web :5190, lab web :5191. Demo data re-seeded (idempotent) so the dev-only gate rows are back after the e2e cleanup. Ports 3000/5173/5175 (founder's other checkout) untouched.
