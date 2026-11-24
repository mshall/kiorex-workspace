# Edge-case sweep report, 24 November 2026

Scope: an end-to-end attempt to BREAK the local stack (Kiorex platform API / web / ops, Passport, Kiorly Clinic, Pharmacy, Lab, widget, public pages) with duplicates, races, hostile input, boundary values, bad clocks and odd UI conditions. Every defect found in product code was fixed with a regression test; nothing was pushed or deployed; providers are mocks (sandbox-fake PSP, log messaging).

Suites: `e2e/test/40..49-edge-*.e2e.ts` (real running stack), unit / integration specs next to the fixed code, Playwright specs `kiorex-platform/apps/web/e2e/edge-ui.spec.ts` and `apps/web/e2e/signin-edge.spec.ts` in Clinic, Pharmacy and Lab. Every suite creates its own fixtures under a unique prefix (`edge_<tag>_...`) and removes them (`purgeEdgePayments`, batch cleanup, role/user restore).

Result words: **pass** = the system already behaved; **fixed** = a defect was found, fixed and is now covered by a regression test; **gap** = not covered or only partly (see "Remaining risks").

## 0. Results

| Suite | Tests | Result |
|---|---|---|
| e2e 40 money | 38 | pass (6 defects fixed on the way) |
| e2e 41 booking | 16 | pass (1 defect) |
| e2e 42 attribution | 8 | pass |
| e2e 43 identity | 9 | pass |
| e2e 44 pharmacy | 7 | pass (3 defects) |
| e2e 45 public / privacy | 9 | pass |
| e2e 46 tenant | 5 | pass |
| e2e 47 import | 4 | pass (1 defect) |
| e2e 48 data | 9 | pass (3 defects) |
| e2e 49 contract sweep | 4 | pass (5 defect groups, about 25 endpoints) |
| Full e2e run 01..49 on the same stack (closure round, before the second round below) | 374 passed, 33 skipped (11-nurse-lab needs its own stack; 30-security belongs to the concurrent security sweep) | pass (45 C3 timing fixed afterwards and re-run green) |
| Kiorex API unit / integration | 578 / 600 | pass |
| Clinic API node unit / edge + marketplace + patients + kiorex integration | 1222 / 46 | pass |
| Pharmacy API unit + marketplace e2e | 216 + 17 | pass |
| Lab API unit | 239 | pass |
| Playwright patient web edges | 12 | pass |
| Playwright sign-in edges (Clinic, Pharmacy, Lab) | 6 passed + 1 skipped each | pass |

Lesson learned on the way: new integration specs must leave the shared test database empty (`c.reset()` in `afterAll`); two older specs failed when the new ones ran before them, which looked like a product regression and was test pollution.

## 1. Defects found and fixed (24)

| # | Area | Defect (what the caller saw) | Root cause | Fix | Regression test |
|---|---|---|---|---|---|
| 1 | Money | The same PSP capture delivered 8 times at once answered `500` for several deliveries | `findUnique` then `create` on `WebhookReceipt` raced; the unique violation surfaced as 500 | The receipt is claimed first (`create`, P2002 = `DUPLICATE`) | 40 M1, pay-edge.int |
| 2 | Money | A capture that failed once (amount mismatch, unknown payment, transient error) was never processed again: the PSP retry of the same event was answered `DUPLICATE` | The idempotency receipt was written as `PROCESSED` before processing and kept on failure | The receipt is released when processing throws, so the retry is processed | 40 M7, M8, pay-edge.int |
| 3 | Money | Malformed but correctly signed PSP bodies (`[]`, no `eventId`, non-numeric amount) were `500`; `eventId` undefined collided on one receipt key | No shape validation after signature check | `400 INVALID_PSP_PAYLOAD`; optional `currency` in the event is checked (`409 CURRENCY_MISMATCH`) | 40 M6, D4, pay-edge.int |
| 4 | Money | Pay link registration accepted amounts above int4 (`500`), any currency string (`ZZZ`, emoji, lowercase), and silently ignored a re-registration with a different amount | No bounds or currency validation; `upsert(update: {})` | `400` for amount outside 1..2 147 483 647 and for currencies not in the market registry; `409 PAY_LINK_CONFLICT` for a different amount/clinic/currency under a known token | 40 N1, N2, N3, pay-edge.unit |
| 5 | Money | Six concurrent checkouts of one pay link or one booking deposit created several payment intents (double-charge exposure) | check-then-create without a lock | Serialised per link / booking / order with a transaction advisory lock | 40 N5, D1, pay-edge.int |
| 6 | Money | After a failed payment the pay link kept handing out the same FAILED intent: the patient could never retry | `paymentIntentId` reused whatever its status | A FAILED intent is replaced by a new one; a captured link is closed | 40 N6 |
| 7 | Money | A real PSP capture never closed the pay link (only the sandbox page did), so it stayed `OPEN` | `PayLink.status = PAID` lived in `fakeComplete` | Set in the capture transaction | 40 N6 |
| 8 | Money | Ops refund of a payment that was already released to the clinic (completed visit, forfeited no-show, fulfilled order) succeeded and pushed the clinic `HELD` ledger account negative; empty refund reason accepted | `refund()` did not check `releasedAt`; DTO allowed `""` and unbounded amounts | `409 ALREADY_RELEASED`; reason 3..300 chars; amount bounded | 40 D5, D6, R2, pay-edge.int |
| 9 | Booking | Two patients rescheduling onto the same free slot: the loser got `503 CLINIC_SYSTEM_BUSY` (Kiorex) from a Clinic `500` | Serializable transaction P2034 not handled in `rescheduleByPatient` | `409 SLOT_TAKEN` with alternatives (as booking creation already did) | 41 S2 (x4 runs) |
| 10 | Commission | The 24-month new-patient lookback started up to 3 days late at month ends (31 Mar minus 1 month = 3 Mar; 29 Feb 2028 minus 24 months = 1 Mar 2026) and shifted an hour with the server zone's DST: a returning patient could be priced as new | `Date.setMonth` in local time with overflow | UTC arithmetic clamped to the last day of the month | edge-commission-boundaries (3 zones) |
| 11 | Commission | Percent commission off by a piastre on half-cent values (`33.5 x 3%` = 1.00 instead of 1.01; `9.5 x 3%` = 0.28 instead of 0.29) | Float rounding `Math.round(x * 100) / 100` | Exact integer half-up | edge-commission-boundaries |
| 12 | Pharmacy | Patient cancel racing a pharmacist accept: Kiorex `CANCELLED` and the patient refunded while the pharmacy showed `ACCEPTED` with lots reserved (and the symmetric cancel-overwrites-accept) | Accept, reject, cancel and SLA-expiry wrote the status unconditionally | Compare-and-set on the state that was read; the loser releases its reservation / re-reads and cancels the dispensing; SLA sweep cannot expire an accepted order | 44 R1 (x4 rounds, run 4 times) |
| 13 | Pharmacy | A partner `DispenseCompleted` with a non-numeric `quantityDispensed` produced NaN, the order move failed with a Prisma "missing platformFeeMinor" `500`, retried forever | `Math.floor(NaN)` flowed into the refund maths | Non-finite quantities count as 0 dispensed | 44 R3, policy-edge.unit |
| 14 | Webhooks | A correctly signed envelope with `null`, an array, numeric `eventId`, object `type` or a 5 kB id answered `500` and was retried forever (poison message) | No envelope validation | `400 INVALID_ENVELOPE` | 44 W1 |
| 15 | Time | WhatsApp booking copy listed every slot one hour early from the last Friday of April to the last Thursday of October; the default quiet window let messages through at 22:00-23:00 local and held them an hour past 08:00; lead alerts the same | `MARKET_TZ_OFFSET_HOURS` fixed at +2 although Cairo is +3 in summer | `common/market-time.ts` resolves the offset from `MARKET_TIME_ZONE` (default `Africa/Cairo`) at the instant; quiet-window end converted with the offset at the end (both DST nights right) | market-time.unit (12 tests incl. 24 Apr and 29 Oct 2026) |
| 16 | Import | A damaged or truncated base64 upload (`***`) was stored as a different file with a valid-looking hash | Node's lenient base64 decoder | Strict RFC 4648, `400 IMPORT_BAD_BASE64` | 47 I3, onboarding-import-edge.int |
| 17 | Catalog | `?pageSize=abc` returned the whole catalogue (89 providers) | `NaN ?? 10` keeps NaN, `Math.min/max` propagate it, no LIMIT | Finite clamp for page and pageSize | 48 P1 |
| 18 | Catalog | `GET /providers/:id/slots` with `to` before `from` was a `500` | Passed through to Kiorly | `400 INVALID_RANGE`, at most 92 days | 48 D2 |
| 19 | All APIs | A NUL character (`?search=%00`, JSON `\u0000`) in any text answered `500` on Kiorex, Clinic, Pharmacy and Lab | PostgreSQL text cannot hold U+0000 | Global pipe: `400 INVALID_CHARACTER` | 48 N1, reject-nul-bytes x4 |
| 20 | Kiorex ops | 9 admin operations answered `500` for client mistakes: unknown id on update/resolve/resubmit, `?from=garbage`, `?page=-1`, empty settlement import | Prisma errors reached the catch-all as plain errors | `clientFaultOf` maps P2025/P2002/P2003/P2023, argument validation, negative skip/take, Invalid time value to 404/409/400; import DTO validated | 49 Z1, errors.unit |
| 21 | Clinic | `GET /marketplace/listings` without `clinicId` was a `500` | `findFirst({ id: undefined })` matched any clinic, then the upsert failed on `clinicId: undefined` | `400 clinicId is required` | 49 Z2a |
| 22 | Clinic | 11 endpoints with inline-typed bodies (scheduling series, messaging send, billing payments, cash close, clinical shortcuts, ...) answered `500` to an empty or mistyped body | `@Body() b: { ... }` cannot be class-validated; the service dereferenced undefined | TypeError from a mutating request is `400` (still logged); Prisma validation/not-found/duplicate/malformed mapped to 4xx | 49 Z2a, prisma-client-fault.node |
| 23 | Pharmacy | `GET /catalogue/labels` and `/labels/print` without `drugIds` were a TypeError `500`; bad dates `500` | Unchecked query string | `400 DRUG_IDS_REQUIRED`; Prisma validation and RangeError to 400 | 49 Z2b |
| 24 | Lab | `?from=garbage` on orders, refunds, audit logs, TAT, send-out costs, cost-per-test was `500` | Prisma validation error mapped to 500 | 400 | 49 Z2c |

## 2. Scenario register

Legend: **P** pass, **F** fixed (defect number above), **G** gap (see section 3).

### 40 Money and payments (`40-edge-money`, 38 tests)
| Scenario | Result |
|---|---|
| M1 same capture event delivered 8x concurrently: one capture, one ledger tx, one outbox | F1 |
| M2 replay is DUPLICATE; second capture with a new event id is ALREADY_CAPTURED | P |
| M3 failure then late success captures; failure after capture never undoes it | P |
| M4 refund.settled for a payment with no refund (out of order) | P |
| M5 bad / truncated signature, tampered body, wrong key: refused, nothing recorded | P |
| M6 signed but malformed body is 4xx | F3 |
| M7 failed processing never poisons the event id (amount mismatch, same id re-sent corrected) | F2 |
| M8 capture for an unknown payment is 404 and stays retryable | F2 |
| N1 amounts -1, 0, 1.5, 2^31, 1e12, MAX_SAFE_INTEGER | F4 |
| N2 currency ZZZ, egp, USD, empty, EGPX, emoji | F4 |
| N3 pay link re-registration idempotent / conflicting | F4 |
| N4 wrong secret on product-key registration | P |
| N5 concurrent checkouts of one link | F5 |
| N6 PSP failure then retry; paid link closed; expiry 1 s past | F6 F7 |
| N7 link expires after checkout started: money that arrived still captures | P |
| R1 odd amount partial refunds 3333+3333+3335 then +1 refused | P |
| R2 refund amounts 0, -5, 1.5, over remainder, 2^31, 1e15, empty reason | F8 |
| R3 uncaptured, failed, unknown payment | P |
| R4 ten concurrent "refund the rest": one wins, total exact | P |
| R5 refund replay, late refund.settled cannot double-settle | P |
| R6 refund settled by webhook before the worker | P |
| R7 ledger of all scenarios balances (no unbalanced tx, nothing owed, HELD = open deposits) | P |
| D1 six concurrent deposit checkouts | F5 |
| D2 deposit on held-only, released, cancelled, foreign booking | P |
| D3 PSP captures AFTER the patient cancelled: automatic single refund, books balance | P |
| D4 capture with wrong amount / currency: 409, audit rows, correct event still lands | F3 |
| D5 refund after release (visit completed) | F8 |
| D6 no-show forfeits once; refund after forfeiture refused | F8 |

### 41 Booking concurrency (`41-edge-booking`, 16 tests)
B1 ten holds by two patients on one slot, B2 same-patient double submit, B3 five concurrent confirms + different Idempotency-Key, B4 hold expiring mid-confirm, B5 release twice / confirm after release: **P**. W1 hostile times (past, reversed, zero, 30 days, garbage, off-grid, year 9999, numbers, missing), W2 foreign type / injection ids / anonymous, W3 consent flags, 100 kB notes, emoji and zero-width: **P**. X1 foreign patient on read, calendar, release, cancel, reschedule, deposit: 404, X2 list leakage: **P**. S1 reschedule onto a taken slot, S3 same slot / past / bad body / after cancel, S4 reschedule limit: **P**; S2 racing reschedules: **F9**. E1 lifecycle events after a terminal state, E2 unknown booking: **P**. Waitlist offer races, widget-vs-link-vs-app on the same slot and family/dependant bookings: **G** (existing suites 12, 28 cover the happy path and the single-slot race, not the three-channel race).

### 42 Attribution and commission (`42-edge-growth`, 8 tests + node tests)
T1 22 forged / malformed `lt` tokens (edited signature or payload, wrong secret, missing parts, 100 kB, version 2, non-Crockford code, string time, prototype key): **P**. T2 72 h and clock-skew edges (+4 min accepted, +6 min refused, negative, MAX_SAFE_INTEGER): **P**. T3 other-organisation, unknown-code, forged, edited token never PROVIDER_LED: **P**. T4 revoked link stops deciding: **P**. T5 replayed token by a second patient is provider-led by design (the token names an organisation, not a person), expired token is not: **P** (risk R2). C1 consent withdrawn after a touch, re-consent: **P** (the consent endpoint spelling is probed softly). C2 provider window inside/outside by 2 minutes: **P**. C3 decision unique under replayed confirm: **P**. Commission rate `validFrom` inclusive / `validTo` exclusive to the ms, adjacent rates, future rate, newest wins: **P** (node). 24-month lookback and rounding: **F10 F11**. Policy-version change mid-booking, dispute after charge, refund after charge, no-show and cancellation rules: **P** by existing suites 25-28 and Clinic integration tests; not re-run with new fixtures (**G**).

### 43 Identity and sessions (`43-edge-identity`, 9 tests)
H1 code replay is `invalid_grant`, H2 wrong PKCE / redirect / client / mangled / empty code, H3 Clinic exchange endpoint: **P**. R1 refresh rotation and reuse, R2 revocation vs 12 in-flight requests (only 200/401, then 401 everywhere), R3 three devices, revoke one, sign out everywhere keeps the caller, R4 garbage / none-alg / HS256 / re-signed / 20 kB bearer on Kiorex and Clinic: **P**. O1 wrong OTP, O2 sixth send refused: **P**. After a replayed code the tokens of the first redemption stay valid (RFC 6749 4.1.2 says SHOULD revoke): **G** (R3). Back-channel logout racing, unlinked/ambiguous phone linking, password lockout and reset, passkeys, clock skew of the IdP: **G** (existing 01, 09, 20, 21 plus kiorex-account unit tests; not extended).

### 43 Telehealth (`telehealth-edge.integration.test.ts`, 7 tests, Clinic)
Opens 10 min before start (11 min too early, 9 joins; the ms edge is in `telehealth-core.node.test`), closes 60 min after end (59 joins, 61 expired), reschedule during the call moves the window and the same token works, link regenerated while the patient waits (old tab told LINK_REVOKED, two regenerations in a row), flag off mid-call keeps signalling and the visit ends, cancelled session never reopens, no oracle between unknown session and wrong patient: **P**. Existing `telehealth.integration` already covers the 3-minute attendance threshold, exactly-once encounter and commission, MISSED rules, prepayment gate. TURN unavailable fallback: `telehealth-turn.node.test` (**G**: not re-run with a failing TURN provider on the live stack).

### 44 Pharmacy / Lab (`44-edge-vertical`, 7 tests)
V1 hostile carts (qty 0, negative, 1.5, 1e9, string, null, over stock, unknown sku, foreign branch, duplicate lines), V2 Rx-only without a prescription, V3 foreign patient on read / cancel / payment: **P**. R1 cancel vs accept race x4: **F12**. R2 partner events out of order, duplicated, without sign-off, after final state, pickup out-for-delivery, unknown order, forged secret / key: **P**. R3 hostile partial lines: **F13**. W1 signed malformed envelopes: **F14**. Controlled drugs, out-of-stock after payment, paused listing mid-order, second-partner routing: **P** by 04 and 23. Lab: result released after cancel, sample rejection: **G** (05, 11 cover the happy path; the lab cancel transaction reads then writes at READ COMMITTED, so a specimen received between the check and the write is a theoretical race I could not force, risk R4).

### 45 Public pages, widget, privacy (`45-edge-public-privacy`, 9 tests)
S1 hostile slugs (NUL, traversal, 600 chars, emoji, RTL marks, script, trailing slash, double dash) never 5xx and never reflected, S2 odd query strings (50 kB `lt`, repeated, malformed percent, page=-1), S3 language / country / case variants, S4 sitemap files well-formed, under 50 000 URLs and 50 MB, no unescaped character in `<loc>`: **P**. W1 non-allow-listed / null / odd parent origins, unknown org, W2 forged widget token and a patient bearer in its place: **P**. C1 quiet-hour preference edges, C2 concurrent consent toggles, C3 account erasure end to end: **P** (C3 returns early if the dev Passport requires step-up for deletion; 28 covers the full journey). Unpublished / delisted provider 410 / 301 and slug rename redirect: **G** (the public site answers 404 for unknown slugs; a delisted provider keeps no tombstone, risk R5). Frequency caps, suppression after STOP: **P** by `consent-gate.unit.spec`, **G** end to end. SDK postMessage forgery from inside a page: **G** (origin checks are covered at the API; no browser-level forgery test).

### 46 Tenant and role (`46-edge-tenant`, 5 tests)
X1 tenant NA's patient, appointment, clinic, encounter, invoice ids as tenant DF: 404, X2 write attempts change nothing, X3 `tenantId` in query / header ignored, M1 role downgrade effective on the next request with the same token, M2 soft-deleted user locked out at once and restored, billing seat removal never 5xx: **P**. Plan downgrade mid-session and market-hidden features: **P** by 16 / 17 / 18 and the flag-off contract specs; **G** for a downgrade while a staff-app session is open.

### 47 Import (`47-edge-import`, 4 tests)
Empty, binary, BOM, UTF-16, CP1256 bytes, unterminated string, unbalanced parens, 2 MB line, 20 000 statements, DROP / COPY PROGRAM / pg_sleep, NUL, zero-width, RTL override dumps: no 5xx, nothing outside staging: **P**. File names (traversal, absolute, NUL, 5 000 chars, reserved, RTL override, Unicode): **P**. Invalid base64: **F16**. Unknown batch / task / commit without approval, patient token 403: **P**. Duplicate patients, orphan files, two-person rule, rollback of a half-committed batch: **P** by `onboarding-import.int.spec` (crash-resumable commit).

### 48 Data edges (`48-edge-data`, 9 tests)
P1 odd page / pageSize / sort / q on search: **F17**. P2 pages are a partition of the catalogue (no duplicates, no gaps, empty past the end), P3 bookings / notifications filters, P4 Clinic / Pharmacy / Lab lists: **P**. N1 NUL and control characters on four APIs: **F19**. D1 appointment ranges (leap day 2028-02-29, 2027-02-29, both Cairo DST nights, midnight, reversed, 1900-2100, garbage, 2026-02-30): **P**. D2 slots windows: **F18**. D3 Cairo wall-clock across both DST changes, D4 empty states of a brand-new patient: **P**. The 10 000-row list is **G**: the demo databases hold hundreds of rows; the 30 / 100 / 200 caps were asserted instead (pageSize 100000 is clamped everywhere).

### 49 Contract sweep (`49-edge-fuzz`, 4 tests)
256 Kiorex operations x {patient, ops, anonymous} x 5 hostile ids, 10 hostile queries, 11 hostile bodies; 654 Clinic, 289 Pharmacy, 347 Lab operations x {owner, anonymous}: never a 5xx. Initially 26 / 162 / 29 / 7 offending requests (about 25 distinct endpoints): **F20 F21 F22 F23 F24**. Skipped on purpose: logout, password, sessions, backup/restore/purge, seed, reset, webhooks, marketplace machine API, streams.

### Playwright UI edges
Patient web (`edge-ui.spec.ts`, 12 tests): 320x568, 2560x1440, 640x450 (= 200 % zoom of 1280) and a landscape phone in Arabic and English: no horizontal scroll, no control pushed outside the viewport; very long Arabic names with mixed digits, 80 emoji, zero-width and RTL-override characters, 5 000 characters, markup in the search box; offline reload and in-app offline; 3 s slow API; 500 / 429 / empty / HTML / null-list answers from search never blank the page or throw; back / forward / refresh in the booking flow and a double-clicked slot sends at most one hold; keyboard-only Tab order, visible focus on at least 80 % of stops, Escape closes the sheet; reduced motion leaves no infinite or long animation; pagination bounds: **P**. Sign-in of Clinic, Pharmacy, Lab web (`signin-edge.spec.ts`, 7 tests each, 1 skipped where the Passport method is the default): 320 / zoom 200 % / 2560, hostile text, keyboard focus, offline, reduced motion: **P**. Not covered: Kiorly Home web :5194, staff app web, ops console, Quick Setup and Connect wizards, the widget iframe at 320 px (**G**).

## 3. Remaining risks and honest gaps

1. **(Closed 24 Nov 2026, closure round, section 5)** ~~Untyped request bodies in the Clinic API.~~ 115 controller parameters were typed inline (`@Body() b: { code: string }`), which class-validator ignores. Defect 22 turns the resulting TypeError into a 400, but the real fix is one DTO class per endpoint, so a body that is wrong in a more subtle way (a string where a number is expected) is still stored or fails deeper. The mapping hides real null-dereference bugs behind a 400 (they are still logged at error level).
2. **`lt` tokens are not bound to a person** (by design, ARCH 6.2): anyone holding a provider link token inside its 72 h window books fee-free. Revocation and the 72 h window bound it; a per-session binding would need a product decision.
3. **DST nights in the shared notification gate.** `@kiorex/contracts` `quietUntil` converts the end of a quiet window with the offset at "now". The platform now passes the correct offset, so the whole summer is right, but on the two Cairo DST nights (24 Apr 00:00, 29/30 Oct 24:00) a deferral can end an hour early (fall back) inside the quiet window. The platform's own `quietWindowEnd` is exact; making the contract take a zone is a contract change (additive) and was not made.
4. **Lab cancel race.** `OrdersService.cancel` checks specimen state and writes at READ COMMITTED; a specimen scanned between the two statements could be cancelled. Not reproducible deterministically; needs a row lock or a conditional update.
5. **Delisted / unpublished providers** answer 404 on the public pages (no 410 tombstone or 301 to the clinic page), so a de-indexed profile is slower to leave search engines. Slug rename redirects were not tested.
6. **(Closed 24 Nov 2026, section 5)** ~~Code replay containment.~~ A replayed Passport authorization code was refused, but the tokens of the first redemption remained valid (RFC 6749 section 4.1.2 recommends revoking them).
7. **Not exercised:** waitlist offers racing a manual booking, three-channel (widget, provider link, app) race on the last slot, TURN failure on the live stack, 10 000-row lists (database too small), Kiorly Home / staff app / ops console / Quick Setup / Connect wizards under 320 px, 2560 px, RTL stress and offline, plan downgrade during an open staff-app session, SDK postMessage forgery from a hostile parent page, lab result released after cancel, sample rejection edges.
8. The "never 5xx" sweeps prove robustness, not correctness: a 4xx may still be the wrong 4xx for a rare input.

## 4. How to run

```bash
cd e2e
npx vitest run test/40-edge-money.e2e.ts test/41-edge-booking.e2e.ts test/42-edge-growth.e2e.ts test/43-edge-identity.e2e.ts \
  test/44-edge-vertical.e2e.ts test/45-edge-public-privacy.e2e.ts test/46-edge-tenant.e2e.ts test/47-edge-import.e2e.ts \
  test/48-edge-data.e2e.ts test/49-edge-fuzz.e2e.ts          # about 4 minutes on a seeded stack
cd ../kiorex-platform/apps/web && npx playwright test e2e/edge-ui.spec.ts --project=chromium
cd ../../../clinics-management/apps/web && SIGNIN_BASE_URL=http://localhost:5174 npx playwright test -c playwright.signin.config.ts e2e/signin-edge.spec.ts   # Pharmacy :5192, Lab :5193 likewise
cd ../../../clinics-management/apps/api && DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/kiorly_test?schema=public node --import tsx --test src/telehealth/telehealth-edge.integration.test.ts
```

Services were rebuilt and restarted only through `e2e/scripts/up.sh --build --restart --only=<svc>` (Kiorex 7 times, Clinic 4, Pharmacy 3, Lab 2).

## 5. Closure round (24 Nov 2026): the remaining engineering defects and hygiene gaps

Nothing here was pushed or deployed. Services were rebuilt only through `e2e/scripts/up.sh --build --restart --only=kiorly`.

| # | Item | Root cause | Fix | Regression test |
|---|---|---|---|---|
| C1 | Kiorex `growth-analytics.int.spec.ts` k-anonymity test failed with a rollup unique-key error, only after other suites | Not a race and not key ordering. `growth-schema.int.spec.ts` "migration is idempotent" re-applies `20261128100000_growth_core`, whose `CREATE UNIQUE INDEX IF NOT EXISTS` re-creates the old 7-column unique index on `GrowthMetricDaily` that `20261129090000_growth_analytics_v1` had replaced with the 17-column `GrowthMetricDaily_dim_key`. In the shared per-run test database every later suite then saw the narrow index, and three providers' rows that differ only in `city` / `providerRef` collided. jest runs previously failed specs first, which is why it passed alone or when it ran first. | The replay test now continues with the superseding migration (the real upgrade path), so the database ends in its migrated state. No product code was wrong. | `growth-analytics` "schema guard: the only unique index is the full-dimension key" (fails loudly if a suite pollutes the schema again) |
| C2 | e2e 16 agency home-visit `HOME_VISIT_DAILY_CAP_REACHED` after repeated runs; Clinic-day tests `409` against `demo_mk_mk03` | The suite cancelled only the `Appointment`; the `HomeVisit` row (what the daily cap and travel rule count) stayed `ARRIVED` or `CONFIRMED` (60 + 8 leaked rows on the dev DB). The Clinic-day slot was now-relative and collided with now-relative demo appointments, and "today" assumptions broke after midnight. | `e2e/src/slots.ts` (pure, takes `nowMs`): home visits are booked on a random day 2..28 ahead (the product refuses more than 30), every booking is recorded and released in `afterAll` on the `HomeVisit` and the appointment, and a `beforeAll` releases leftovers of crashed runs; the Clinic day tries every 5-minute start of the clinic's own today in random order until the server accepts one. | e2e 16 passed 3 of 3 consecutive runs and a 4th inside the full e2e run |
| C3 | Clinic `mobile.integration` failed on `kiorly_test` (mobile demo tenants missing); single-invocation `node --test` hung after the KCV-201 file | (a) CI seeds, a fresh local test DB does not. While making the test self-seeding the base demo seed itself failed on a fresh DB: `seed-rev23` `skipDuplicates` skipped a verification (unique `userId`) and its registrations then pointed at a missing id. (b) `PasswordHasher` called `worker.unref()` before `worker.on("message")`; attaching the listener re-refs the worker's message port, so any process that verified one password never exited. | `ensureMobileDemoTenants()` runs `db:seed:demo` / `db:seed:mobile` when the tenants are missing; `seed-rev23` re-points registrations at the verification the user really has; the worker is unref'd after its listeners and ref'd only while a job is in flight. No `--test-force-exit`. | `password-hasher-exit.node.test.ts` (a process that hashed exits by itself); all 119 integration files in one invocation: 457 of 457, no hang (about 93 s) |
| C4 | 115 inline-typed Clinic bodies and queries | class-validator cannot see an inline type, so the ValidationPipe skipped them | 145 DTO classes (49 `*.controller.dto.ts` files, generated from the declared types and reviewed: required, optional, nullable, enum, number coercion for forms and queries, `@ApiProperty` for OpenAPI) plus a hand-written `CreateSlotHoldBodyDto` for the marketplace hold. They are `@Lenient()`: undeclared fields are dropped, not rejected, so existing clients keep working while the declared fields are validated. `openapi/openapi.json` regenerated. The TypeError-to-400 net stays only for the 13 free-form `Record<string, unknown>` bodies that services parse themselves. | `inline-dto-coverage.node.test.ts` (a ratchet: no inline object type in any controller; behaviour of the money, auth and marketplace DTOs) |
| C6 | Kiorex `records.int.spec.ts` RC-01 (3 MB vault upload) answered `500 INTERNAL_ERROR` in about 4 of 12 full-suite runs and never in 12 isolated runs (found while running the suite three times in a row) | A REAL product bug, found with the new `KX_TEST_LOGGER=1` harness switch (prints the stack of every 500): `RecordsService.upload` validated the base64 text with `/^[A-Za-z0-9+/=\s]+$/.test(wholeString)`, which overflows V8's regexp backtrack stack on a multi-megabyte string (`RangeError: Maximum call stack size exceeded`), depending on how deep the stack already is. Any upload near the 5 MB limit could therefore 500. | `isBase64Text()`, a linear scan with no regexp | `base64-text.unit.spec.ts` (8 MB string), RC-01; also RC-02 failed about one run in 20 because the test "tampered" a token by replacing its last base64 character with `x` (a no-op when it already is `x` or only touches unused bits): it now flips a middle character and asserts the token changed |
| C5 | e2e 42 C1 consent withdrawal conditional | the assertion sat behind `if (rec[0].granted === false)` | asserts unconditionally: the withdrawal answers 200, the latest `ConsentRecord` is `granted:false`, the earlier touch no longer makes the booking PROVIDER_LED | e2e 42 C1 |

Pentest Low items closed in the same round (see `_docs/security/PENTEST_2026-11_REPORT.md`): KX-PT-L1 (Clinic login limiter and marketplace nonce store now in Postgres, failed client-secret attempts throttled), KX-PT-L2 (`/health/ready` detail and `/health/providers` internal-only in all four APIs), KX-PT-L3 (verified already 4xx, now covered by `ops-input-shapes.int.spec.ts`), KX-PT-L7 (minimatch / glob), and the Passport replay containment.

Verification: Kiorex integration suite 613 of 613 on three consecutive runs in one ordered invocation (after the RC-01 fix), Clinic integration single invocation 457 of 457, Clinic unit 1,239, Passport 314, staff app jest 276, e2e 16 x 3. Full e2e run on the rebuilt Clinic and Kiorex APIs with nothing else running: 373 passed, 33 skipped, 2 failed: 49 Z2b / Z2c ("never a 5xx" sweeps of Pharmacy and Lab) saw `fetch failed` connection errors on nearly every request after the earlier sweeps in the same file; Z2b passed and Z2c passed when re-run alone (and Z2c passed in the first full run); Pharmacy and Lab were not rebuilt or changed in this round, so this is probably local socket exhaustion by the sweeps, not proven. An earlier full run that overlapped with the Clinic integration suite additionally failed 10-resilience and 12-waitlist, which pass alone.

**Still open after the closure round (and what happened to it):** the free-form `Record<string, unknown>` bodies (closed in section 6.4: 14 of them, DTOs or bounded schemas, TypeError net removed); `i18next` (closed: staff app on i18next 27, section 6.6); the `fetch failed` of the 49 sweeps and the 10 / 12 flakiness (closed, 6.1 and 6.9; two consecutive full runs green, 6.0); Pharmacy and Lab Growth tabs (still open, see the work package, section 13).

## 6. Second closure round (24 Nov 2026): clean full runs, socket exhaustion, Lighthouse, real Passport popup, free-form bodies, CI

Nothing here was pushed or deployed. Services were rebuilt only through `e2e/scripts/up.sh --build --restart --only=<svc>` (Kiorex twice, Clinic twice, Passport once to load the `kiorex-widget` client).

### 6.0 Results of this round

| Suite | Result |
|---|---|
| e2e 01..49 on the shared stack, two consecutive runs (M and N, 19:48 and 20:00) | **383 passed, 33 skipped, 0 failed** in both (the 33 skipped are 11-nurse-lab and 30-security, which run on their own stacks below) |
| 11-nurse-lab (`npm run test:nurse`, own stack :3012 / :4002 / :3202), after each of M and N | 5 / 5 and 5 / 5 |
| 30-security (`npm run test:security`, isolated production-mode stack :4300-4303), after each of M and N | 28 / 28 and 28 / 28 |
| e2e 49 (never-5xx sweeps of Kiorex, Clinic, Pharmacy, Lab, plus the new Z3 oversized-request test) | 5 / 5, about 45 s (it was 4 to 5 minutes with 2 to 5 `fetch failed` offenders) |
| Earlier full runs of the same round | I green; J green except one security race (a real defect, 6.9 S8); K green; L one file (10-resilience) failed in its `beforeAll`: the catalogue was briefly stale after the flag suite (fixed with a 30 s retry); A to H were polluted by the :3010 kills (6.8), slot exhaustion and the two defects below, and are not counted |
| Clinic API unit (`node --test`), integration | 1,252 with 1 failure that is not Clinic's (`ff01-registry` vs `kiorex-contracts` 1.12.0 flag `growth.provider_marketing_v2`, Phase 2 work in flight); integration 457 / 457 (run before the last two DTO fixes; the DTO ratchet file 14 / 14 afterwards) |
| Kiorex booking integration (`booking.int`, own database) | 36 / 36 including the new parallel-confirm test |
| Kiorex web / ops / widget unit | 282 / 110 / 13 pass; web lint, widget lint and typecheck clean; ops lint and typecheck fail on the uncommitted Phase 2 work (`any` in `i18n/index.ts`, `JSX` namespace in `growth-p2-routes.test.tsx`), not on this round's files |
| Kiorex patient app jest, `tsc` | 251 / 251, clean |
| Clinic web / Pharmacy web / Lab web unit and lint | 153 / 64 / 64 pass; lint 0 errors (38 / 1 / 1 warnings that were there before); typecheck clean |
| Staff app (`kiorly`) jest, `tsc`, `npm audit` | 276 / 276, clean, 0 vulnerabilities |
| Production bundle checks | web, ops, widget, public site: OK; Clinic, Pharmacy, Lab webs, patient app, staff app, Kiorly Home: OK (6.5) |
| Widget against the real Passport popup | 8 / 8 (6.3) |

### 6.1 Root causes found

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| S1 | Suite 49 sweeps of Pharmacy and Lab (Z2b, Z2c) failed with `fetch failed` on nearly every request after the first sweeps | The sweep read only `res.status` and never the body, so every response kept its socket busy until garbage collection, and Node's default dispatcher kept opening more; later requests found no socket. Two smaller contributors: a 20 kB query string is answered 431 by Node's HTTP layer WITH `Connection: close` (one new connection per GET operation, thousands of `TIME_WAIT` sockets towards one port), and the retry-less client counted one refused connection as a defect | `e2e/src/http.ts` (vitest `setupFile`): one bounded keep-alive undici agent (16 connections, keep-alive below the server's 5 s), `probe()` drains every body, retries connection-level failures 3 times with a growing pause and reports the error code; the sweeps send 9 kB queries and a new test (49 Z3) checks the 20 kB request per API |
| S2 | 10-resilience: "expected 200 to be 503" after `svc.sh kiorly stop` | `kill` sends SIGTERM; the Clinic shuts down gracefully and keeps answering on already-open keep-alive connections for a while, and a leftover instance keeps running after the listener closed | `svc.sh stop` waits until the port is really closed (SIGKILL after 8 s) |
| S3 | 12-waitlist depends on what other suites left behind | `join` is idempotent per patient, doctor and type, so a WAITING entry left by an aborted run absorbs the offer the file waits for | the file removes the patient's open entries before it starts |

### 6.2 Lighthouse and Core Web Vitals (public SSR pages, local, 24 Nov 2026)

Lighthouse 13.6 (dev dependency of `apps/web`, `npm run audit:lighthouse -w apps/web`), Chrome headless, default simulated slow-4G / 4x CPU mobile profile and the desktop profile, a second Kiorex API instance on :4350 with `SITE_ENVIRONMENT=production` (the dev API on :4000 is `noindex` by design and would score SEO 66). Budgets in `apps/web/lighthouserc.json`: performance >= 90, accessibility >= 95, best practices >= 95, SEO >= 95, LCP <= 2.5 s, CLS <= 0.1. Pages: home, specialty hub (`/doctors/paediatrics`), city hub (`/locations/cairo`), doctor, clinic, in Arabic and English, mobile and desktop = 20 measurements.

| Measurement (median of 3 runs, simulated slow-4G mobile profile and desktop profile) | Result |
|---|---|
| 20 combinations: 5 pages x 2 locales x 2 form factors | all four categories **100** in every one (budgets: performance 90, accessibility 95, best practices 95, SEO 95) |
| LCP mobile / desktop | worst case 638 ms / 170 ms (budget 2,500 ms) |
| CLS, TBT | worst case 0.028 and 10 ms (budgets 0.1 and 200 ms) |
| Cross-check with APPLIED throttling (`--throttling devtools`, mobile, ar + en, 1 run each) | performance 99 to 100, other categories 100, LCP 750 to 761 ms, CLS up to 0.077 (budget 0.1), TBT up to 20 ms |

Lighthouse 12.8 gave 3.5 s FCP and 4.1 s LCP for the same uncompressed pages; the applied-throttling run (a real slowed-down browser, not a model) agrees with 13.6, not 12.8.

Defects found by the audit and fixed (all real, none a score trick): (1) the review-count bars on hub pages set their width with an inline `style` attribute, which the page CSP (`style-src` without `unsafe-inline`) blocks: a console error on every hub page, best practices 92. They are SVG now. (2) `/favicon*`, `/manifest.webmanifest` and `/og-image.png` answered 404 from the API role (they live in the patient web build), a console error on every page: a fixed allow-list route serves them. (3) The site served 340 kB of JavaScript and 19 kB of HTML uncompressed; the CDN compresses in production, the origin now does too (`compression` middleware, public paths only, `SITE_COMPRESSION=false` switches it off). Lighthouse 12.8 (first install) reported mobile LCP 4.1 s for the same pages; Lighthouse 13 models the page load differently and reports 0.8 s, so the cross-check with applied (DevTools) throttling below is the number to trust.

**Lab is not field data.** One machine, simulated throttling, a warm local cache and a database with 89 providers. The targets that count are the real-user p75 on mobile in Egypt (LCP 2.5 s, INP 200 ms, CLS 0.1) after launch, measured by CrUX or the real-user monitoring that does not exist yet. SEO audit (`npm run seo:audit -w apps/api`) of the production-mode instance: 278 pages from 12 sitemap files, 0 errors, 0 warnings (status codes, head tags, canonical and hreflang, JSON-LD, duplicate titles, internal links, Web Vitals hygiene). The dev API (:4000) lists nothing in its sitemap because it is not production-indexable; the audit therefore needs that second instance..

### 6.3 Real Passport popup for the widget

`up.sh --restart --only=passport` loaded the `kiorex-widget` client. `e2e/scripts/widget-real.sh` then ran 8 Playwright tests (desktop Chrome and Pixel 7; 4 each) against the real Kiorex API (:4000, embed and SDK), the real Clinic (:3010, holds and bookings) and the real Passport (:4400): the host page (the only synthetic part, an https origin the clinic really registered through `PUT /growth/widget`) loads the SDK, the iframe lists two doctors, the patient picks a doctor, a visit type and a time, the sign-in button opens the Passport popup (checked: client `kiorex-widget`, PKCE S256, redirect to the widget host callback), the dev quick-pick chip signs in, the popup closes itself, the hold timer shows, consent, confirm, and the host page receives a PHI-free `kx:booked` event; closing the popup without signing in leaves the widget usable and holds nothing; a page on an unregistered origin gets 403 for a session and the CSP lists only the registered origin. No product defect was found. Two test-environment points: recent Chrome blocks an https page from reaching `http://localhost` (Local Network Access), so the test browser disables that one check; and the widget needs a doctor AND a visit type chosen before Continue is enabled when a clinic lists two doctors.

### 6.4 Free-form Clinic bodies closed (EDGE risk 1, last part)

14 controller parameters were typed `Record<string, unknown>` (the earlier count of 13 was one short): patients (active problem, family link), scheduling (appointment type create and patch, availability, waitlist, series), mobile (device registration, push token, vitals), clinical form template, data explorer create and patch, operation note. Where the shape is known they are DTO classes (`*.free-form.dto.ts`, numbers or numeric strings in range, enums, ISO dates, bounded string lengths, `@Lenient` like the earlier 145). Where it is genuinely free-form (data explorer rows depend on the table, the operation note and the section tree of a form template are user-designed) they go through `BoundedObjectPipe` / `@IsBoundedJson` (`common/bounded-json.ts`): plain JSON object only, at most 64 to 512 kB, depth 4 to 12, 200 to 5,000 keys, string length limits, no `__proto__` / `constructor` / `prototype` keys. A ratchet test fails on a new `Record<string, unknown>` body without the pipe. The TypeError-to-400 net in `integration-failure.filter.ts` is removed: a TypeError is a 500 again and is logged. Verified by `inline-dto-coverage.node.test.ts` (13 tests) and `bounded-json.node.test.ts` (6), the Clinic integration suite (457 of 457) and the e2e 49 sweeps without the net.

### 6.5 Production bundles: no dev-only feature, no localhost, for every app

`kiorex-platform/scripts/check-production-bundles.mjs` (`npm run check:bundles`) builds production for the patient web, the ops console, the booking widget (app and SDK) and the public SSR site (client and server bundle) and fails on a dev-only marker (test-users panel, synthetic logins, MSW service worker, mock switches) or on any `http(s)://localhost / 127.0.0.1 / [::1]` or `.test` URL; the web and ops builds are also built in development mode to prove the scan can see a local fallback. The existing `check:dev-test-users` of the Clinic, Pharmacy and Lab webs, the patient app, the staff app and Kiorly Home got the same local-address scan. Real findings, all fixed (see KX-PT-15 in the pentest report): patient web and ops console fell back to `http://localhost:4400` for Passport, both shipped `mockServiceWorker.js`, the three product webs kept the local Kiorly Home URL, the staff app defaulted its API bases and Passport to localhost, the patient app defaulted Passport to localhost and shipped its offline-fixtures module in the production export. Library constants that mention localhost (react-router's URL base, oidc-client-ts, a hostname comparison) are listed as benign in the scripts. Contract drift found while wiring CI: `kiorly-pharmacy/Docs/openapi.json` and `kiorly-lab/Docs/openapi.json` were stale (284 and 323 paths): regenerated, and CI now fails when they drift.

### 6.6 Dependencies

`npm audit` after this round: `--omit=dev` is 0 in every repo. Full audit: 0 in clinics-management, pharmacy, lab, account, contracts, the staff app (i18next 23 -> 27 and react-i18next 14 -> 18, GHSA-6jcc-5g8w-32mx), e2e (vitest 2 -> 5 and vite 8: the tinypool / vitest critical advisories were dev-server only), and the patient app (npm `overrides` glob ^14.0.6 / minimatch ^11.0.9 for the jest chain). **Documented exception:** `kiorex-platform` (root, workspaces) keeps 18 moderate advisories, all in the jest 30 tool chain (`glob` 13 and `minimatch` 10 inside `@jest/*`, `jest-*`, `babel-plugin-istanbul`): dev-only test tooling, not shipped, only reachable through developer-controlled glob patterns. Overriding `glob` globally in that workspace would change the test runner for the Growth Phase 2 work that is in flight in the same repo, so it was not done; revisit with the next jest release. Lighthouse (dev dependency, local measurement only) is at 13.6 because 12.x pulled in `puppeteer-core`, `basic-ftp` and `zod` advisories.

### 6.7 CI added (not executed on GitHub)

`kiorex-platform` ci.yml: `security-edge`, `web-apps`, `playwright-hermetic`, `site-audit`. `kiorly-pharmacy` and `kiorly-lab`: `web-bundle`, `web-e2e` (sign-in, edge, Kiorex tab on a seeded API), OpenAPI drift step. `kiorex-account`: `bundles`, `security-edge`, `browser`. `kiorly` (had no workflow): `test`, `audit`, `bundle`. Workspace `.github/workflows/e2e.yml` (dispatch + nightly: e2e 01..49, nurse, security, real-Passport widget; needs a `WORKSPACE_READ_TOKEN` secret). `clinics-management/.github` was NOT touched: `Docs/CI_PATCH_security_edge.md` describes the jobs for the founder to apply. The commands in each job were run locally; the YAML was only parsed.

### 6.8 Environment finding that cost most of the round

The Kiorly Clinic API on :3010 was killed repeatedly during this round (every few minutes, no log line, no crash report, while Kiorex, Pharmacy, Lab and Passport stayed up). Cause, observed with a process watcher: another session in this workspace ran `clinics-management/scripts/playwright-with-local-ports.sh qa01-golden-flow.spec.ts` with `CI=true`, and that script's `free_listen_port` kills whatever listens on :3010 and :5174 (it did so at 17:36:31 and 17:44:44, each time the Clinic API vanished). It is not a product defect, but it makes a shared-stack e2e run meaningless while such a run is in progress. Mitigation used: a fresh restart through `up.sh` before each full run and discarding any run during which the watcher saw :3010 stop answering. Recommendation: run the golden-flow Playwright (CI mode) only when the workspace e2e stack is idle, or point it at other ports (`local-dev-ports.sh`, without `CI=true`).

### 6.9 More root causes found while getting the full run clean

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| S4 | 41, 42 (and later files) failed with "no free slots" in a full run | One KX-DEV doctor has about 50 free slots in the 12-day window the suites use; a full run books more than that (growth, money, edge, Phase 2 campaigns) and cancels only in the global teardown at the very end | `e2e/src/release.ts` + a per-file `afterAll` (`src/cleanup.ts`, a setupFile) cancel the future bookings through the Clinic after EVERY file; the global teardown uses the same function |
| S5 | 02 and 10 could not find the KX-DEV doctors | They looked on page 1 of a rating-ordered list (30 or 50 rows); the demo catalogue now has more than 50 providers that outrank them | `providerBySpecialty` searches by name (`q=`), 02 pages through the admin directory |
| S6 | 49 Z2a: `POST /front-desk/encounters/:id/collect-visit-balance` with `{}` was a 500 | `@ValidateNested()` accepts an absent object and `toVisitCollectionInput()` dereferenced it; the TypeError-to-400 net had hidden it. Same shape in `PutProviderProfileDto` | `@IsDefined()` on both, ratchet test for any `@ValidateNested()` property without `@IsDefined` / `@IsOptional` |
| S7 | Everything behind `:3010` failed at random, 30 times in this round | see 6.8 (an outside `CI=true` Playwright run frees :3010) | environment, not product |

**S8 (a real defect, found by a security-suite flake).** `30-security` "12 parallel holds" failed once in seven runs because one of six parallel confirms of the same booking with the same Idempotency-Key answered `409 SLOT_TAKEN`. Reproduced on the dev stack (about 1 request in 36): the duplicate loses inside Kiorly against the first request's own insert, and `handleConfirmError` then moved the Kiorex booking to `EXPIRED / SLOT_TAKEN` while the Clinic held the appointment as `CONFIRMED` (state divergence; the nightly reconciliation only heals lookups, not this). Fix in `BookingService.confirm`: one confirm per booking at a time per process (in-memory chain; a database lock on a pooled connection would starve the pool under load), and a confirm that fails after the booking already moved past HELD returns the booking as it is. Tests: `booking.int.spec.ts` (six parallel confirms are one Kiorly booking, all 200, CONFIRMED) and e2e 41 B6 (15 rounds of six parallel confirms against the real stack: all 200, never EXPIRED, exactly one Clinic appointment). A second instance racing on the same booking is covered only by the post-check, not by the chain.

### 6.10 Honest gaps after this round

1. The CI YAML (kiorex-platform, pharmacy, lab, account, staff app, workspace e2e) was parsed and its commands were run locally, but no workflow was executed on GitHub. The `site-audit` job assumes the demo seed produces slugs; the Lighthouse script falls back to the first sitemap entry when the configured doctor and clinic are missing, which was not exercised.
2. Lab scores are not field data. There is no real-user measurement (CrUX, RUM) of INP at all; INP was not measured in the lab either (no interaction script).
3. `npm audit` full run of `kiorex-platform` keeps 18 moderate dev-only advisories (jest chain) as a documented exception (6.6).
4. Concurrent confirms are serialised per process only; a second Kiorex instance relies on the post-check (6.9 S8).
5. The permanent slot leak is mitigated (27-day window, release before 41 and 42), not removed: COMPLETED / NO_SHOW appointments of the growth suites stay on the doctor's calendar. A periodic reset of the dev Clinic data, or a clock-injected completion in those suites, would remove it.
6. `ops` lint and typecheck are red on uncommitted Phase 2 files that are not part of this round; the Clinic `ff01-registry` unit test is red until the Phase 2 flag `growth.provider_marketing_v2` is registered; the new Clinic ratchet for `Record<string, unknown>` bodies will fail on the untracked `marketplace-provider-verification.controller.ts` until that controller uses a DTO. All three are the Phase 2 owner's to fix; none was touched.
7. Still not exercised (unchanged from section 3): 10 000-row lists, staff app / ops console / Connect wizards under 320 px and 2560 px, plan downgrade during an open staff-app session, SDK postMessage forgery from a hostile parent page.
