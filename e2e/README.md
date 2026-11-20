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
| 02-provider-sync | b. pull the 3 LIVE doctors; search by specialty with 3 inline slots | KXM-DS-01..04/06/07, KX-09 §03 |
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

`11-nurse-lab` is skipped in the default run (it needs its own outbox workers): `npm run test:nurse` starts the isolated stack, runs it and stops the stack.
Prerequisites for 13/14: the demo data (`scripts/seed-all.sh`) with the dev-only gate rows GHV1/GHV2/GKN1 (the tests never record a gate).

Notes
- Passport allows 5 OTP sends/phone/hour: the harness truncates only the OTP counters in `kiorex_account` (sessions untouched). Unseeded numbers read their code from `.e2e/logs/passport.log`.
- The ops super admin needs TOTP; the login is cached in `.cache/ops-login.json` (gitignored).
- DB assertions read Postgres directly (`src/db.ts`); `timestamp without time zone` columns are parsed as UTC (Prisma writes UTC).
- Test-only fixtures that are NEEDS_HUMAN product values (a 1 EGP commission rate, a 150 EGP deposit on the KX-DEV visit types) are inserted by the test that needs them and removed afterwards.
