# Kiorex v2 cross-service E2E

API-level scenarios against the REAL running services (no mocks): Passport dev IdP :4400, Kiorly Clinic :3010, Kiorex API :4000,
Kiorly Pharmacy :3100, Kiorly Lab :3200, Postgres :5433. (:3000 / :5173 belong to a different checkout and are never touched.)

```bash
scripts/up.sh [--build] [--seed] [--restart]   # start the stack (logs ../.e2e/logs, pids ../.e2e/pids)
npm test                                        # vitest, files run sequentially in name order
npm test -- test/07-cancellation-refund.e2e.ts  # one scenario
scripts/down.sh                                 # stop (by port; never :3000)
scripts/svc.sh kiorly stop|start                # single service (used by 10-resilience)
```

| File | Scenario | Requirement IDs |
|---|---|---|
| 01-passport | a. phone-OTP login, auth code + PKCE, Kiorex accepts the token | KA-01, KA-03, KXM-AC-01 |
| 02-provider-sync | b. pull the 3 LIVE KX-DEV doctors (the catalogue is paged: `pageSize` caps at 30 and the default `earliest` sort now covers the whole catalogue; the fixtures still page with `sort=rating`); search by specialty with 3 inline slots | KXM-DS-01..04/06/07, KX-09 §03 |
| 03-booking-golden | c. hold -> confirm (Idempotency-Key) -> Kiorly appointment (KIOREX_MARKETPLACE) -> webhook CONFIRMED; d. slot race | KXM-BK-02/03/04, KX-09 §05 |
| 04-pharmacy, 05-lab | vertical partners (see INTEGRATION.md) | |
| 06-lifecycle-review | e. check-in -> COMPLETED -> review invitation -> verified review -> aggregate in Kiorly; commission event | KXM-LC, KXM-RV-01/03, CR-03 |
| 07-cancellation-refund | f. patient (in policy / window closed) and clinic cancel; deposit capture and refund (sandbox-fake PSP) | KXM-BK-07, KX-06, KXM-PAY-01/02 |
| 08-flags | g. kiorex.marketplace OFF -> 403 FEATURE_DISABLED; clinic.kiorex_listing OFF (EG) reaches Kiorly; safety controls refused | ADR-023/025, OP-07/08, FF03 |
| 09-backchannel-logout | h. Passport session revoke -> Kiorex session invalid | KA-07, KXM-AC-05 |
| 10-resilience | i. Kiorly down -> 503 CLINIC_SYSTEM_BUSY, HELD/UNCERTAIN, circuit opens; restart -> reconciliation + idempotent re-confirm | KX-09 §05 |

| 11-nurse-lab | m. Kiorly Nurse (clinic NURSE edition) records a collected sample -> Kiorex relays with the KIORLY_NURSE source -> Lab custody, scan receipt, results, release on the nurse channel -> status, custody and secure link back to the nurse; consent-missing, identifier-mismatch and future-time refusals; no PHI kept at Kiorex. Runs on an isolated stack (`scripts/nurse-lab-stack.sh up|down|drop`, ports 3012/4002/3202, own databases) so no other outbox worker competes: `E2E_NURSE_STACK=1 E2E_KIORLY_URL=http://localhost:3012 E2E_KIOREX_URL=http://localhost:4002 E2E_LAB_URL=http://localhost:3202 npm test -- test/11-nurse-lab.e2e.ts` | KNLAB01, KLORD05 |

| 12-waitlist | n. KXM-BK-12 waitlist on the real stack: join refused while slots are open (409 SLOTS_AVAILABLE) -> other patient cancels -> autofill offer -> accept (5-minute hold) -> confirm -> Kiorly appointment; decline returns the entry to WAITING | KXM-BK-12 |
| 13-home-visit | o. Rev 2.3 home visits: address book + OTP confirm -> HOME slots (OUT_OF_COVERAGE 422) -> hold with addressId -> confirm -> Kiorly HomeVisit with encrypted address -> nurse depart/arrive (Kiorex timeline) -> unsafe abort is not a no-show and the deposit goes to HOLD_FOR_REVIEW | KXMHV01-10, HVBK/HVEXE/HVSAF, KXMPAY07 |
| 14-care-plan | p. Care-plan request Kiorex -> Kiorly (HMAC, address encrypted) -> nurse inbox -> accept -> CARE_PLAN_CONFIRMED -> Kiorex plan CONFIRMED with visits; decline | KXMHV08, KNCP, KNKX01 |

| 17-staff-mobile-pharmacy | q. Kiorly (staff app) pharmacy roles on the real :3100 API and demo tenants: role matrix (owner/pharmacist/manager/cashier/assistant/chain, PRO solo, BASIC FEATURE_DISABLED), Rx validate + interaction override + FEFO dispense, barcode/customer lookup, shift open/close reconciliation, PO receiving partial then full, stock count variance + approval, expiry/quarantine/recall + recalled-lot alert, controlled dispense + discrepancy + witness countersign (same user refused), Kiorex order progression; every flow re-read through the web path (no client header). Idempotent replays assert one effect. Needs the demo seeds; Kiorex-side order mirroring is asserted only when pharmacy->Kiorex delivery is live | KXM-PH, KX-06, ADR-025 |

| 16-staff-mobile-clinic | q. Kiorly (staff app) x Kiorly Clinic: role matrix for every clinic demo login (modules/plan/safetyAlertsOnly + endpoint scoping), BASIC org (alerts only, FEATURE_DISABLED), clinic day (front desk check-in -> nurse vitals incl. critical alert -> doctor SOAP + sign Rx -> critical lab approval -> revenue = web totals), home-visit rounds (solo nurse + agency: depart/arrive/SOS/unsafe abort/nursing note), offline replay idempotency, device registration + remote sign-out; each result re-read through the clinic web endpoints. UI parity: `kiorly/e2e-web` (Playwright, `-c clinic.config.ts`) | KWORK, MOBILE.md |

| 22-standalone-connect | s. Connect a standalone clinic / pharmacy / lab (ADR-040): enrolment code from ops, signed request (code, then issued key), automated checks, two-person approval, Go live; uniform 401, replay, 413, 429 | ADR-040, contracts 1.9.0 |
| 23-multi-partner-routing | t. Second live pharmacy and second live lab (wizard + ops walk, multi-tenant :3100 / :3200): each order and booking reaches only its own partner's database, carries its `partnerId`, and its webhooks move only its own orders | ADR-040, per-registration routing |

| 25-growth-booking, 26-growth-analytics | GRW-P1-C and J: attribution decision at hold, signed acquisition block, Clinic decides the fee; analytics numbers reconcile, k = 10 | GRW-P1-C, GRW-P1-J |
| 27-growth-provider-journeys | GRW-P1-M journeys 1-4: provider link created in the staff app API, QR resolver, patient lands on Kiorex, books, PROVIDER_LED, attended, no commission, statement; marketplace booking and the EGP fee in force; returning patient; dispute `PROVIDER_LED_EVIDENCE`; staff app role matrix. Adds a CLINIC_ADMIN user and a booking slug on the KX-DEV clinic for the run and removes them | GRW-P1-L, M, D1, D2 |
| 28-growth-platform-journeys | GRW-P1-M journeys 5-12: consent and touches, widget from another origin, deep links and bootstrap, SSR crawl, robots and sitemap, Super Admin configuration with maker-checker (second super admin fixture, isolated market ZZ), analytics k-anonymity, erasure through Passport account deletion, AR/EN | GRW-P1-B, E, F, G, H, I, J, K, M |

| 39b-corporate-pay | PAY-READY: corporate benefit in Kiorex Pay on the private stack `scripts/pay-stack.sh up` (:4398): deposit lines, benefit held then redeemed, ledger balanced, connection check, settlement import, forged callback | PAY-READY, GRW-P4-C |
| 40..49 edge-* | EDGE sweep (24 Nov 2026): 40 money (duplicate / late / out-of-order PSP webhooks, amounts, currency, refunds, deposits), 41 booking concurrency and hostile input, 42 attribution tokens and windows, 43 identity and sessions, 44 pharmacy orders (races, forged partner events), 45 public pages, widget origin, consent, erasure, 46 tenant isolation and role changes, 47 import hostile uploads, 48 data edges (pagination, dates, NUL), 49 contract sweep (no 5xx on every documented operation). Fixtures use the `edge_<tag>_` prefix and clean up (`purgeEdgePayments`, batch removal, user/role restore); helpers in `src/edge.ts` (signed PSP webhooks, pay links, signed Clinic events). Report: `_docs/test-flow/EDGE_CASE_REPORT_2026-11.md` | EDGE-40..49 |

`11-nurse-lab` is skipped in the default run (it needs its own outbox workers): `npm run test:nurse` starts the isolated stack, runs it and stops the stack.
Prerequisites for 13/14: the demo data (`scripts/seed-all.sh`) with the dev-only gate rows GHV1/GHV2/GKN1 (the tests never record a gate).

Notes
- Passport allows 5 OTP sends/phone/hour: the harness truncates only the OTP counters in `kiorex_account` (sessions untouched). Unseeded numbers read their code from `.e2e/logs/passport.log`.
- The ops super admin needs TOTP; the login is cached in `.cache/ops-login.json` (gitignored).
- DB assertions read Postgres directly (`src/db.ts`); `timestamp without time zone` columns are parsed as UTC (Prisma writes UTC).
- Test-only fixtures that are NEEDS_HUMAN product values (a 1 EGP commission rate, a 150 EGP deposit on the KX-DEV visit types) are inserted by the test that needs them and removed afterwards.

**Fixtures clean up after themselves.** 22 and 23 remove every tenant they signed up in the Pharmacy / Lab / Clinic databases (`purgeTenant` in `src/db.ts`: FK checks and append-only triggers are off for ONE transaction; dev databases only), their partner connections, registrations, enrolment codes and the Nurse relay rows. **Quiet hours** never depend on the time of day: 04 sets the patient's own 0-0 window for WhatsApp/push, and `test/pharmacy.int.spec.ts` asserts the quiet window itself with an explicit preference. **Intake rate limits** live in Postgres (`RateLimitBucket`): 22 and 23 call `resetRateLimits()` before (and 22 after) the burst test.

**HTTP client (`src/http.ts`, a vitest `setupFile`).** Every suite's `fetch` goes through ONE bounded keep-alive undici agent (16 connections, keep-alive below the servers' 5 s idle timeout; `E2E_MAX_CONNECTIONS` overrides). `probe()` is the status-only request of the never-5xx sweeps: it drains the body (an unread body keeps its socket busy, which exhausted the sockets in suite 49), retries only connection-level failures (refused, reset) up to 3 times with a growing pause, and reports the error code of a request that never got an answer, so `-1` in a sweep means "the service did not answer", never "a 5xx". A 20 kB query string is answered 431 by the HTTP layer and closes the connection, so the sweeps send 9 kB and one separate test (49 Z3) checks the 20 kB case per API.

**Widget against the REAL Passport popup.** `scripts/widget-real.sh` registers an https host origin for the KX-DEV clinic through the real Clinic API (`widget-real/fixture.mts up`), runs `kiorex-platform/apps/widget/playwright.real.config.ts` (real Kiorex API :4000, real Clinic, real Passport :4400 with client `kiorex-widget`; only the host page is synthetic and Chrome's Local Network Access check is switched off for the test browser), and cancels the bookings and restores the clinic row afterwards (`down`). Prerequisite: `scripts/up.sh --restart --only=passport` so the `kiorex-widget` client from `kiorex-account/config/idp.json` is loaded. The hermetic stand-in suite stays in `kiorex-platform/apps/widget` (`npm run e2e -w apps/widget`).

| 56-security-phase34 | GRW-P3-H security regression for Phases 2 to 4: authorisation matrix over every growth, corporate, promotion, experiment, assistant, credit, referral and lifecycle operation of the four APIs (anonymous 401, patient 403, no 5xx, reviewed list of public routes), injection payloads in query, body, path and headers of the public growth routes, rate limits of touch and events, PHI scan of every growth table, INTERNAL outbox events and the API logs, k >= 10 fuzz over the analytics and cohort routes and the CSV exports. Pentest addendum KX-PT-16 onwards | GRW-P3-H, `_docs/security/PENTEST_2026-11_REPORT.md` section 8 |

**The whole set on a PRIVATE stack (wave 9, GRW-P3-H).** `scripts/w9-stack.sh up` clones the dev databases into `w9_*`, seeds the flag catalogue, points every stored URL at private ports (Passport :4710, Clinic :4712, Kiorex :4713, Pharmacy :4714, Lab :4715), builds all four APIs into `dist-w9` (never `dist/`) and starts them with a private Passport whose `idp.json` copy re-points the back-channel logout URIs (`KX_IDP_CONFIG`). Then `eval "$(scripts/w9-stack.sh env)" && npx vitest run` runs 01 to 56 in one ordered invocation (11-nurse-lab and 39 run because `E2E_FULL_STACK=1`; 30-security keeps its production-mode stack, `npm run test:security`). `10-resilience` stops and starts only the private Clinic (`svc.sh` delegates to `w9-stack.sh clinic-stop|clinic-start` when `E2E_FULL_STACK` is set). `scripts/w9-stack.sh down` drops the databases and the builds. `scripts/migration-replay.sh` replays every Prisma schema from an empty database and runs the growth backup and restore drill.
