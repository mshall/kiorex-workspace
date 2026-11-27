# Regression and end-to-end test report, 27 Nov 2026

Scope: kiorex-platform, kiorex-account, kiorly-pharmacy, kiorly-lab, kiorly (staff app), kiorex-contracts, kiorex-pay-contract, plus the cross-product API suites in `e2e/`. The Clinic repo (`clinics-management`) was **not touched** (read only: its existing `dist/` was run on a private port; nothing was built or written there). No push, no deploy, no AWS, no DNS.

All runs used private databases on `localhost:5433` and private ports (4810-4815 stack, 5750-5771, 8861-8863, 4392-4394, 4851, 5853); nothing ran on 3000/5173/5175/3020/5190/5191. One test process at a time. Scratch databases and processes were dropped and stopped at the end.

## 1. Result at a glance

| Area | Result |
|---|---|
| Typecheck and lint, all repos | pass (after one lint fix in platform ops) |
| Unit, integration and e2e API suites, all repos | pass, except the documented items in section 5 |
| Contracts | 454 of 455 pass; the one failure is the by-design openapi-drift test (needs the sibling Clinic spec) |
| Cross-product e2e on a private stack (`e2e/`) | 595 tests: all pass except 1 environmental (`02`, data-dependent slot count); 2 suites not run (section 6) |
| Playwright | pass in every run listed in section 3 after the fixes; 2 groups not fully runnable (section 6) |
| Production code fixed | 1 (ops payments connection page overflow at 768 px) |
| Tests fixed (outdated by the seeded commission defaults, design changes, flake) | 8 files |

## 2. Counts per repo and suite

| Repo | Suite | Result |
|---|---|---|
| kiorex-platform | lint (hosts, api tsc + boundaries + growth SAST, web eslint, ops eslint, widget tsc) | pass after fix `2958d42` |
| | typecheck (workspaces) and mobile typecheck | pass |
| | api unit (jest) | 169 suites, 1962 tests pass |
| | api integration, full (`test:integration`, 12 GB heap ceiling, runInBand, own DB per run) | 111 of 112 suites pass, 1 skipped; 1409 tests pass, 1 skipped; 560 s |
| | web unit (vitest) | 31 files, 382 pass |
| | ops unit | 38 files, 333 pass (37/326 at first run; another agent added tests meanwhile) |
| | widget unit | 3 files, 13 pass |
| | patient app (mobile) jest | 39 suites, 333 pass |
| kiorex-account | `tsc -b` | pass |
| | vitest (all) | 50 files: 384 pass, 9 skipped (skips are in-file `skip`s); one file (`ka13-self-service`) failed once only because port 4450 was held by another agent, passed on re-run (9 of 9) |
| kiorly-pharmacy | typecheck, web lint (eslint max-warnings 0) | pass |
| | api unit | 275 pass |
| | web unit | 69 pass |
| | api e2e (private DB, migrated) | 230 pass |
| kiorly-lab | typecheck, web lint | pass |
| | api unit | 298 pass |
| | web unit | 69 pass |
| | api e2e (private DB) | 209 pass |
| kiorly (staff app) | `tsc --noEmit` (also the lint script) | pass |
| | jest | 54 suites, 367 pass |
| kiorex-contracts | lint (`tsc`) | pass |
| | vitest | 19 files; 454 pass, 1 fail: `openapi-drift` (the pinned spec versus the sibling Clinic spec: 20 differences in `/commission-collections` request body). By design when the sibling Clinic source is behind: noted, not fixed |
| kiorex-pay-contract | lint, vitest | pass, 34 of 34 |

## 3. Playwright (private stacks)

| Spec group | Where | Result |
|---|---|---|
| Pharmacy sign-in (`signin-*`) | private Pharmacy API :4814, Vite :5761 | 30 pass, 1 skipped (in-file) |
| Pharmacy growth | same | 32 pass (1 failed first, fixed `cf1c50d`) |
| Pharmacy Connect to Kiorex front door (`kiorex-tab`) | same | 18 pass |
| Pharmacy COM-3 (counsel chip, settlement statement, 8 viewport x language cells) | private API :5751 on its own DB, fake Kiorex :5753 | 10 pass |
| Lab sign-in | private Lab API :4815, Vite :5762 | 30 pass, 1 skipped (1 flaky axe failure fixed `0f8c61f`) |
| Lab growth | same | 32 pass |
| Lab Kiorex tab | same | 18 pass |
| Lab COM-3 | private API :5771, fake :5763 | 10 pass |
| Widget (desktop + mobile, hermetic stack :4392-4394) | platform `apps/widget` | 30 pass |
| Ops pages on the private stack: growth-ops-pages-w9, integrations-center, growth-automation, **payments-ops-pages (pay)** | Vite :5721, private Kiorex :4813, private Passport :4810 | first run 81 pass, 2 fail (payments connection at 768 px), 22 skipped (fixture setup pointed at the shared default); after fixes: growth-automation 22 pass with its fixtures, payments connection 8 pass |
| Ops Commissions, Rates, Policy pages (mocked API) | Vite :5731 | 25 pass |
| Passport UI | hermetic IdP, port 4851 | 23 pass |
| Kiorly Home | hermetic, ports 4852 / 5853 | 62 pass |
| Staff app on the Expo web build, mock Passport (`passport-*`) | static export served on :8861 | 8 pass after fixes `e2e17c1` |
| Staff app Pharmacy specs (`pharmacy-*`) | static export against the private Pharmacy API | 20 pass, 1 fail (environment, section 5) |

## 4. Cross-product end to end (private stack, mock providers)

Stack: `e2e/scripts/reg-stack.sh up` (new, a copy of `w9-stack.sh`; ports 4810-4815; clones of the dev databases migrated to the current trees and re-seeded; the Clinic runs its existing `dist/` read only). Whole suite `01..56` ordered in one vitest run: 57 files, 591 tests: 547 pass, 5 fail, 37 skipped, 2 todo at first run.

Covered and passing: patient booking through the platform to the Clinic (03), Pharmacy and Lab orders and partial dispense refunds (04, 05, 23), HMAC raw-body and partner replay (15, 22, 44, 45), Passport phone OTP (mock mode, code 000000) into the platform API (01, 43), staff Passport sign-in and session revocation into Pharmacy, Lab and the staff app (17 to 21), flags, lifecycle, cancellation and refunds, back-channel logout, waitlist, home visits, care plans, growth, credit ledgers, sponsored promotions, security regression for phases 2 to 4 (56), edge sweeps (40 to 49).

New suite `e2e/test/57-commission-statement-chain.e2e.ts` (4 tests, pass): a commission claim with a `CASH_TRANSFER` (InstaPay) tender raised through the Clinic-signed charge events for the Pharmacy and the Lab registrations, then the Kiorex settlement statement (ops route: accrued cash-type 20.00 as its own cash-transfer kind, bank-transfer-only payout), then the signed partner route behind the Pharmacy and Lab statement screens (same figures, own organisation only). Test rows are removed afterwards.

Demo-data removal dry run: platform `demo-data:remove` (dry-run default): 16 rows tagged DEMO (gate evidence), nothing changed; Passport `demo-data:remove` (dry-run): 7535 demo rows listed, 2217 real accounts untouched, audit chain kept, 7 pattern-matching accounts not tagged and not removed (warning printed). Pharmacy and Lab have **no** `demo-data:remove` script (not built; the handoff lists it only for platform, Passport and Clinic).

## 5. Failures found and what was done

| # | Failure | Cause | Fix |
|---|---|---|---|
| 1 | platform `npm run lint` (ops): 11 `no-explicit-any` errors in `CommissionsPage`, `PaymentsConnectionPage` and two commission specs | lint debt from the COM-3 commits | file-level suppression with reason (repo convention), kiorex-platform `2958d42` |
| 2 | e2e `04-pharmacy` partial dispense: release 3500, test expected 4000 | test outdated: the seeded default pharmacy rate (2%, min EGP 5) now takes a fee of 500; the API DTO never exposed `platformFeeMinor`, so the old assertion silently used 0 | test reads the stored fee, workspace `9893d4a` |
| 3 | e2e `51-sponsored-promotions`: Clinic charge 18 where the test expected the stale EG rate row (1.00); then `MARKETPLACE_FEES` credit 6500 | test outdated: the Clinic decides the fee by the seeded commission policy (3% of 600, rateSource KIOREX_DEFAULT) and pharmacy and lab release fees now book to `MARKETPLACE_FEES` | test expects the decision's fee and scopes the ledger check to the payment, `9893d4a` |
| 4 | e2e `10-resilience`: both tests failed | `svc.sh` always delegated to the `w9` stack script; it could not stop the private Clinic of another tag | `E2E_STACK_SCRIPT` honoured, `9893d4a` (re-run: pass) |
| 5 | Pharmacy and Lab Playwright `growth`: expected "Rate not set" | test outdated: a stack with a pushed rate view shows "Rate in effect now" | regex accepts both, Pharmacy `cf1c50d`, Lab `0f8c61f` |
| 6 | Lab sign-in "ar light" axe `color-contrast` (flaky, 2 of 3 runs) | no wait for the cross-fade after switching language (dark path already waited) | wait before axe in all themes (4 of 4 runs pass), Lab `0f8c61f` |
| 7 | ops `payments-ops-pages`: `payments-connection` overflowed horizontally at 768 px in AR and EN | **production code**: long URLs and secret references in `<code>` did not wrap | `break-all` on the three code elements, platform `3fc2dcb` (8 of 8 pass); the spec now reports the offending elements and uses `PW_OIDC_AUTHORITY`, and the private-stack ops config includes it |
| 8 | staff app `passport-signin*` (7 tests) | the documented build (`expo export`) is a production build: no dev host fallbacks, so the issuer and clinic API must be given | build note in `passport.config.ts` updated, staff app `e2e17c1` |
| 9 | staff app `passport-signin-method` theme test expected the flat Ground token `rgb(244,246,252)` | design change: the sign-in ground is now a light gradient over white | test asserts a light ground (every channel at least 240), staff app `e2e17c1` |
| 10 | COM-3 Playwright (Pharmacy and Lab) all cells failed | environment: the cloned database stored the private Kiorex URL in `IntegrationClient`, so the statement bypassed the in-spec fake | clones pointed at the fake (no code change) |
| 11 | Pharmacy and Lab staff specs: "Cannot reach the server" | environment: the private APIs need `CORS_ORIGINS` for the web origin (hardened default) | `reg-stack.sh` passes `CORS_ORIGINS` (`91c1008`) |

Workspace repo commits (this run): `9893d4a`, `a4a27f6` (suite 57), `91c1008`. Other repos: kiorex-platform `2958d42`, `3fc2dcb`; kiorly-pharmacy `cf1c50d`; kiorly-lab `0f8c61f`; kiorly `e2e17c1`. Account, contracts and pay-contract needed no change.

## 6. Not run, or not green, and why

- **e2e `02-provider-sync` (1 test failing)**: "the specialty list and a profile": `slots.length > 5` got 5. The cloned dev Clinic data (relative-date demo schedule, aged since the last `seed-all --reset`) gives 5 default-window slots for the paediatrics doctor (66 over 14 days). Data-dependent, environmental; re-seed the dev data to turn it green. Not skipped.
- **e2e `30-security` and `11-nurse-lab`** (own stacks): not run. `sec-stack.sh` and `nurse-lab-stack.sh` build the Clinic into `clinics-management/apps/api`, which this task must not touch. Platform integration (111 suites) and suites 15, 43, 45, 46, 56 cover the same ground on the main stack.
- **Staff app Lab specs (`lab-growth`, `lab-staff`)**: not run to a result. The Lab dev sign-in is disabled in a production export by design (`LAB_DEV_LOGIN_UNAVAILABLE`), and a dev Expo server on a private port still read the git-ignored `kiorly/.env.local` (API 3200, the founder's stack) so it could not be pointed at the private Lab API without editing that file. Hold for a run with a dev server and a private env.
- **Staff app Pharmacy `owner: tab opens` (1 test)**: the owner's Growth tab calls `GET /mobile/growth/commission-statement`, which answers **503 `STATEMENT_NOT_CONNECTED`** until Kiorex has pushed the organisation's rate view; the spec counts any 5xx as a defect. The cloned database had no rate link (resync queued 0). See finding B.
- Staff app Clinic specs (`clinic-*`), `real-passport`, platform patient web Playwright (`apps/web`, fixed port 5180) and patient-app Expo e2e: not run (need the Clinic web or fixed shared ports).
- `tofu` / infra: not in scope.

## 7. Findings for follow-up (not regressions)

- **A. Cash vs cash-transfer split is Kiorex-finance only.** The Pharmacy and Lab statement views (API, web, staff app) normalise the settlement statement and drop `cashBreakdown`, so LG-COM-20's separate kind is not visible to the provider, although the two-way visibility direction (26 Nov) says both sides see the same figures. The accrual total is correct and equal on both sides.
- **B. 503 for an unconnected statement.** `STATEMENT_NOT_CONNECTED` is returned as 503 on the mobile route when no rate view exists; the staff app then logs a 5xx on a normal screen. A 404/409 or an empty "not connected" body would be friendlier.
- **C. Shared-default hazards in ops Playwright specs.** `growth-automation.spec.ts` defaults `KIOREX_API_URL` to the shared `:4000` and `PW_DB` to the shared `kiorex_platform` database. My first run (before I set both) attempted its fixtures there: the API calls were refused (private token), and I verified afterwards that no `pw*` rows remain in `kiorex_platform` (0 campaigns, spend, metrics or dev gate rows). The defaults should be changed to refuse unset values.
- **D. Playwright runs rewrite tracked screenshots** in `_docs/test-flow/**` (71 files changed, 13 new): reverted after each run; the screenshot directory should be env-driven.
- **E. Pharmacy and Lab have no `demo-data:remove`**, and the staff app production export needs `EXPO_PUBLIC_PASSPORT_ISSUER` and product API variables (no dev fallbacks), as intended.

## 8. How to repeat

```bash
e2e/scripts/reg-stack.sh up            # private stack 4810-4815 (clones, current migrations, builds to dist-reg; Clinic read only)
eval "$(e2e/scripts/reg-stack.sh env)" && (cd e2e && npx vitest run)     # about 15 minutes
e2e/scripts/reg-stack.sh down          # stops it, drops reg_* databases, removes dist-reg
```
Platform integration: `cd kiorex-platform/apps/api && npm run test:integration` (own DB per run, dropped afterwards). Pharmacy and Lab API e2e need a private `TEST_DATABASE_URL` (migrated: `node scripts/prepare-test-db.mjs` for Lab, `run-e2e.mjs` migrates for Pharmacy).
