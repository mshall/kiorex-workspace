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
| Full e2e run 01..49 on the same stack | 374 passed, 33 skipped (11-nurse-lab needs its own stack; 30-security belongs to the concurrent security sweep) | pass (45 C3 timing fixed afterwards and re-run green) |
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

**Still open after the closure round:** the 13 free-form `Record<string, unknown>` bodies keep service-side parsing; `i18next` (moderate advisory, a major upgrade of the staff app) is not part of the minimatch / glob fix; Pharmacy and Lab Growth tabs (see the work package, section 13).
