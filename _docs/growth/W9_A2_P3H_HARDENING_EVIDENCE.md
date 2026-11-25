# GRW-P3-H evidence: Phase 3 and 4 end to end, performance and security regression (wave 9 lane A2, 25 Nov 2026; final close-out lane appended the same day)

Everything here ran locally on a private stack; nothing was pushed or deployed. Authoritative companion files: `_docs/security/PHASE34_PERFORMANCE.md` (numbers), `_docs/security/PENTEST_2026-11_REPORT.md` section 8 (KX-PT-16 onwards), `e2e/README.md` (how to run).

## 1. The private stack

`e2e/scripts/w9-stack.sh up|down|env` (Passport :4710 with a re-pointed `idp.json` copy through the new `KX_IDP_CONFIG`, Clinic :4712, Kiorex :4713, Pharmacy :4714, Lab :4715; databases `w9_*` cloned from the dev databases, migrated to the current heads, flag catalogue seeded, every stored URL, partner registration, back-channel logout URI and flag webhook re-pointed, builds in `dist-w9`, removed by `down`). Ports 3000, 5173, 5175 and the shared 3010, 4000, 4400, 3100, 3200 are refused by the script. Suites that hard-coded those ports now read `e2e/src/env.ts` (04, 05, 40, 44, 45, 49, `growth-p3.ts`), 10-resilience stops and starts only the private Clinic, 11-nurse-lab and 39 run when `E2E_FULL_STACK=1`.

Isolation incidents, all mine and all closed: (1) the first bring-up left the Passport back-channel logout URIs of the committed `idp.json` pointing at the shared Kiorex, Clinic, Pharmacy and Lab (suite 21 failed on it); fixed by re-pointing all of them in the private copy. (2) `10-resilience` called `svc.sh`, which stops and starts the **shared** Clinic on :3010: it ran once before I noticed, so the shared Clinic was stopped and started again (about 30 seconds of downtime, restarted from its own `dist/`); `svc.sh` now delegates to the private stack when `E2E_FULL_STACK` is set. (3) The Kiorex seed resets `PartnerRegistration` to the default shared ports; the URL rewrite now runs after the seeds. A short burst of suite 04 requests reached the shared Pharmacy before (3) was fixed.

**Final close-out lane additions.** `w9-stack.sh` sets `OUTBOX_POLL_INTERVAL_MS=1000` on all four APIs. `sec-stack.sh` is private too (section 4.2). `svc.sh` refuses to touch the shared Clinic unless `E2E_FULL_STACK` (then it delegates to the private stack) or `SVC_ALLOW_SHARED=1` is set by a human, and suite 16 no longer seeds the shared `kiorly` database. Do not start a second vitest beside a run on the same stack (its global teardown cancels the run's open bookings).

## 2. Ordered full runs (01 to 56 in one `npx vitest run`)

### 2.1 The first lane (earlier on 25 Nov): not green, kept for the record

| Run | Stack state | Result | Failing |
|---|---|---|---|
| 1 | first clone (no flag seed) | 18 failed / 508 passed | 11 files; most were a clone with an unseeded flag catalogue, a leftover second live lab and the Clinic restarted by 10 on the shared port |
| A | fresh clone, seeded | 5 failed / 524 passed | 12 (waitlist), 33, 52, 53 x2 |
| B | second run on the same stack | 12 failed / 517 | repeat-run dependence: 38, 26, 41, 52, 11, 12, 33 |
| C | fresh, after fixes | 3 failed / 526 | 12, 52, 55 and suites 39b, 51, 52B failed in their hooks |
| D | second run | 4 failed / 525 | 12 x2, 34, 52 |
| E | fresh, after more fixes | 5 failed / 543 | 11, 12 x2, 33, 34 |
| F | second consecutive run on the same stack | 4 failed / 544 | 12 x2, 26, 49 Z2a |

### 2.2 The final close-out lane (this section is the gate record)

Private stack `w9` only (Passport :4710, Clinic :4712, Kiorex :4713, Pharmacy :4714, Lab :4715), freshly cloned and built from the current mains (Clinic branch `kiorex`), `OUTBOX_POLL_INTERVAL_MS=1000` on Clinic, Kiorex, Pharmacy and Lab. No other process touched the stack while a run was in progress (a vitest started beside a run executes its global teardown, which cancels the run's open bookings: that cost one run in this lane and is recorded below as run 3 of the first series).

| Run | Stack | Result | What it showed |
|---|---|---|---|
| X0 | fresh clone, current mains, before any fix | 1 failed / 547 passed | 12 (waitlist) and the 39b hook (`growth.corporate` AWAITING_GATE); 49 Z2a, 51, 52 part B, 33, 34, 26, 11 all passed |
| X1 | fresh, after the first fixes | 3 failed, 10 skipped | 08, 10 (cascade) and 11 behind a backlog of 74 undeliverable `SeoQualityGateFailed` outbox rows (defect 15); 12 still failed (defect 12, the cap) |
| X2 | same stack | 1 failed | 26 (defect 17: the two rollup snapshots were compared in an arbitrary tie order) |
| X3 | same stack | 1 failed | 10: **my own mistake**, a second vitest started beside the run executes its global teardown, which cancelled the run's open bookings; invalid run |
| X4 | same stack | 2 failed | 07 and 50 (defects 23 and 24: the fixed-length lots page and the near days at the marketplace cap) |
| G1 | **fresh clone and fresh builds** (the stack the gate runs used) | 1 failed / 551 passed | 50, a typo of mine in the edit of defect 23 (`lots is not defined`); everything else green |
| **G2** | same stack, second run | **0 failed / 552 passed**, 37 skipped, 2 todo, 55 files passed, 2 skipped by design, 785 s | green |
| **G3** | same stack, third run | **0 failed / 552 passed**, 37 skipped, 2 todo, 790 s | green |
| **G4** | same stack, fourth run | **0 failed / 552 passed**, 37 skipped, 2 todo, 789 s | green |

Skipped by design in every run: 30-security (31 tests, own production-mode stack, section 4.2), 40-cross-product-real-clinic (5 tests, needs the :4139 build of `gap-stack.sh`) and one test of 54 (the sitemap check needs a production-mode site). 39b, 51 and 52 part B ran and passed in every run listed.

**The programme gate: G2, G3 and G4 are three consecutive full ordered runs (01 to 56, one `npx vitest run` each) with no failure on the same freshly built private stack, so the gate is met for the 55 suites that run on it; G1, the first run of that stack, failed once on a typo in the test code of this lane, and 30-security is green on its own private production-mode stack (section 4.2)**

## 3. Defects found and fixed (with tests)

| # | Defect | Where | Fix |
|---|---|---|---|
| 1 | `POST /admin/growth/cohorts/rollup` answered 500: LTV estimate outside its own interval (a CHECK) and a `NaN` decay for a net-negative cohort | kiorex-platform | `ltv.model.ts`, `ltv-fit.ts`, unit test, `52c284d` (KX-PT-16) |
| 2 | WhatsApp assistant answered "I did not catch that" when the Clinic refused a cancellation (window closed) | kiorex-platform | new reply `cancel_window_closed` in EG, EN, MSA, unit spec, `52c284d` (KX-PT-17) |
| 3 | Clinic `schema.prisma` on branch `kiorex` did not validate twice on 25 Nov (two commits appended a model and swallowed the closing brace of the one before): `prisma validate`, `migrate deploy`, the build and every private stack failed | clinics-management | `e563b748` and `94ef4a21` (two lines, each a missing `}`). Recommend a `prisma validate` step in the pre-commit hook of that repo |
| 4 | Suite 50 left the raised goodwill caps (5,000,000) in force: suite 52's daily-cap test then granted without a refusal | e2e | 50 restores the rules in `afterAll`; 52 counts only its own grants |
| 5 | Suite 53 relied on the patient's analytics consent, which 32 withdraws (a touch of a person without consent is ignored by design) | e2e | 53 states its precondition |
| 6 | Suite 39 asserted empty reward and referral tables for the whole database | e2e | compares before and after its own order |
| 7 | Suite 38 could not run twice on one database (market ZY is created once) | e2e | removes the ZY rows first |
| 8 | Suite 17 hard-coded the Pharmacy module list; the staff-app Growth tab (P4-B3) added `pharmacy.growth` | e2e | the growth key has its own role matrix in the Pharmacy repo |
| 9 | Suite 33: the assistant lists five bookings and the earlier suites leave more on the patient; the first slot of the day can be inside the cancellation window | e2e | closes the others in Kiorex's table, accepts the new "window closed" reply |
| 10 | Suite 54's sitemap check needs a production-mode site; suite 28 asserts the dev site is noindex on the same stack | e2e | skipped (not weakened) when the site is `noindex` |

### 3.1 Defects found and fixed in the final close-out lane (root causes, each with its test)

| # | Defect | Kind | Fix |
|---|---|---|---|
| 11 | **Waitlist autofill read the 60 s slot read-cache** (`WaitlistService.scan` called `catalog.slots` without `fresh`; the patient's own join had just cached the slot list WITHOUT the slot it was waiting for, so a cancellation became invisible to the scan for up to 60 s) | product (kiorex-platform) | the scan asks Kiorly fresh (it is a background job, not the patient hot path); integration test "a slot freed AFTER the join is offered by the very next scan" fails without the fix |
| 12 | **12-waitlist, root cause of the "2 tests fail in every ordered run"**: the doctor's marketplace daily cap (`marketplaceDailyCap` 20, counted over every non-cancelled Kiorex booking of the day, COMPLETED and NO_SHOW included) is already reached on most near days of a long-lived database. A day list cached for 60 s still showed the slot, the booking worked (holds do not check the cap), but when the booking was cancelled the Clinic recomputed the day and correctly offered nothing back; the failed test then also left its waitlist entry, which the next test received (join is idempotent) with the wrong window | test + fixture | `slotWithRoom` picks a slot of a day with room below the cap (27-day window); entries are removed after EVERY test. (Clinic note, not changed here: holds and bookings do not enforce the daily cap, only the slot list does, so a stale cached list can overbook a day by a few) |
| 13 | **11-nurse-lab "clinic mirror ACCEPTED" (the 45 s vs 58 s timing)** was not timing: a nurse's order reaches the Lab already COLLECTED, the Lab announces ACCEPTED and COLLECTED within the same millisecond, the Clinic's mirror is monotonic, so ACCEPTED is a transient headline that a 500 ms poll could only catch by luck | test | the mirror must be at ACCEPTED or later AND the Clinic's audit log must show it received the ACCEPTED push |
| 14 | Outbox poll intervals fixed in code (Kiorex 5 s, Clinic 5 s, Lab 10 s) made every relay chain slow on a loaded machine | config | `OUTBOX_POLL_INTERVAL_MS` read by the Kiorex, Clinic and Lab dispatchers (default unchanged, floor 250 ms); `w9-stack.sh` sets 1000 on all four APIs |
| 15 | **`SeoQualityGateFailed` had no outbox handler**: every one was retried with backoff and finally DEAD (a false dead-letter alarm), and 74 due rows sat in front of real work in the outbox ordering (this delayed flag propagation and failed 08, 10 and 11 in one run) | product (kiorex-platform) | the SEO service registers the no-op announcement handler (the pattern of the corporate, loyalty and reward events) |
| 16 | **34-growth-experiments WINNER**: conversions were derived from the visitor INDEX while the arm comes from a keyed hash with a server-only random salt, so the effect size varied per run | test | conversions are counted inside each arm (exactly 30 and 10 percent whatever the split) |
| 17 | **26-growth-analytics rollup idempotency**: the snapshot selected 8 of the 18 columns of the table's unique key and ordered by those 8, so ties came back in an arbitrary order that differed between two identical reads | test | the snapshot selects and orders by the whole key; the pair of rollups is compared only when the input facts did not move between them |
| 18 | 39b: the corporate flag was unlocked by a raw `FlagGateEvidence` insert that the flag cache never saw (`AWAITING_GATE`), and the PSP list now has `bank_ipn` (Kiorly Pay unified layer) | test | `unlockForRun` like the other suites; list updated |
| 19 | 39b / 51 / 52 B setup (a booking slug left on a KX-DEV clinic) | test fixture | `kxdevGrowthTenant` is idempotent and self-cleaning: it frees the fixture slug from any other clinic, never "restores" a stale slug and the stack script clears it |
| 20 | **Two Kiorex migrations with the same timestamp** (`20270302090000_com1_commission_collection` and `..._pay_unified_layer`): four schema integration specs failed on "unique prefix" | product (kiorex-platform) | `pay_unified_layer` renamed to `20270302090100` (both are idempotent SQL; a database that applied it under the old name re-runs it harmlessly) |
| 21 | Clinic: two new controllers missing from the PL-04 entitlement policy map (`billing/pay/pay-collections`, `kiorex/commission-collections`) and `POST /commission-collections` missing from the Clinic's OpenAPI copy (two unit tests red) | product (clinics-management) | both registered as `open` (no plan gate exists today; gating by plan is a pricing decision), path added to the Clinic copy of `marketplace.openapi.json` (additive, 1.6.0) |
| 22 | Ops i18n parity test did not know `pay.unified.json` (35 keys "missing") | test | registered |
| 23 | 50: the ops lots list (newest first, 20 rows) did not contain the lot just issued: fixtures written by raw SQL carried the database clock (UTC+4) in `createdAt` and sorted ahead of it | test | the three fixture inserts write UTC; the assertion reads the API's maximum page |
| 24 | 07: the earliest free slot is more than the policy's 168 h away once the near days are at the cap | test | the test's own appointment is placed 100 h ahead at the Clinic |
| 25 | **16-staff-mobile-clinic seeded the SHARED `kiorly` database** (`DATABASE_URL` hard-coded in an `execSync`) when its demo order was missing | test (isolation) | uses the mapped database |
| 26 | `svc.sh` could stop and start the shared Clinic :3010 from a suite | script | refuses unless `E2E_FULL_STACK` (delegates to the private stack) or `SVC_ALLOW_SHARED=1` is set by a human |

Also new: a side-nav entry for the stand-alone Clinic route `/kiorex-commissions` (Finance group, shown only when `GET /billing/kiorex-commissions/access` says the user may see the figures; locale key `nav.kiorexCommissions` EN and AR; Playwright: finance sees it in EN and AR and it opens the panel, a receptionist does not).

## 4. Honest list of what still fails or does not run (after the final close-out lane)

The items of the first lane's list are closed: 12-waitlist (defects 11 and 12), 11-nurse-lab (13 and 14), 34 (16), 26 (17), 49 Z2a (green since the Clinic schema fix, in every run X0 to G4), 33 (green in every run X0 to G4), 39b / 51 / 52 part B (18 and 19: they run and pass in every run), 30-security (4.2).

### 4.1 Package suites (one suite per process, private databases `w9_*`, dropped afterwards)

| Suite | Result |
|---|---|
| kiorex-platform API unit | 157 suites, 1829 tests, green |
| kiorex-platform API integration (private per-run databases) | 102 suites passed, 1 skipped, 1325 tests, green; **`growth-integrations` (the blended-CAC test) passes, 19 of 19: the two earlier reports conflicted and the answer is "fixed"** |
| Clinic API unit | 1458 tests, green (two were red at the start: PL-04 map and OpenAPI copy, defect 21) |
| Clinic API integration (private database `w9_clinic_it`, demo and mobile seeds) | 567 tests, 566 passed, 1 skipped, green |
| Pharmacy API unit and integration (private database) | 256 and 222, green |
| Lab API unit and integration (private database) | 279 and 201, green |
| Staff app (jest) | 53 suites, 353 tests, green |
| Kiorex patient web, widget, mobile | 382, 13, 333, green |
| Kiorex ops (vitest) | 314, green after defect 22 (one parity test was red) |
| Clinic web unit, Pharmacy web, Lab web | 196, 71, 71, green |

### 4.2 30-security on its own private stack

`npm run test:security` (= `scripts/sec-stack.sh up --prod`, `eval "$(scripts/sec-stack.sh env)"`, `vitest run test/30-security.e2e.ts`, `down`): Clinic :4301, Kiorex :4300, Pharmacy :4302, Lab :4303 and a **private Passport :4304** (own `sec_kiorex_account`, `KX_IDP_CONFIG` copy), every build in `dist-sec`, current migrations and seed on the clones; the shared Passport is not read any more. **31 of 31 passed, twice in a row.** Two test bugs were found and fixed on the way: the growth route reader assumed one `@Controller` per file (so `GET /ops/growth/cross-product/funnel` was probed as `/growth/v1/continuity/funnel`, 404), and the import-job check of KX-PT-01 matched the job of an earlier run within a minute.

### 4.3 UI edge checks (Playwright, real browser, private stack, AR RTL and EN)

* **Ops console** (`playwright.w9final.config.ts`: private Vite :5721, private Kiorex :4713, session minted from the private Passport by `e2e/scripts/ops-web-session.ts`): the six W9 pages (lifecycle, send gate, suppression, fraud, SEO, corporate) and the integrations centre at **320, 640x450, 1440 and 2560**: 58 passed; 22 skipped (the automation specs that need a fixture journey). No overflow, axe serious/critical zero.
* **Clinic web** (private Vite :5712): the new spec `edge-viewports-w9.spec.ts` covers credit wallet, promotions, Kiorex commissions and the growth workspace at the four viewports in both languages, fixture-free (renders, direction, no overflow, no page error, axe): green; plus the side-nav entry for `/kiorex-commissions` (finance sees it in EN and AR and it opens the panel, a receptionist does not): 3 of 3.
* **Not run to green here**: the fixture-bound specs `credits-wallet`, `promotions` (wizard) and `kiorex-commissions` (ledger) fail in this clone at their CONTENT assertions (a lot that expires in 12 days, a commission ledger with 300.00, a Kiorex-bookable visit type): the clone does not carry those fixtures. Their layout steps before the fixture assertion pass; the four-viewport matrix was added to them anyway. Kiorex patient web (`loyalty` already has the four viewports, `referral` stays at 320 to 1440) and the Pharmacy and Lab `growth.spec.ts` (320 to 2560 without 640x450) were not extended.

### 4.4 Still open (named, not hidden)

1. **40-cross-product-real-clinic** (5 tests) stays skipped in the ordered run by design: it needs the `:4139` build of `gap-stack.sh` (it passed there in the gap-closure lane).
2. **Contract gaps for the lead**: the Clinic emits `COMMISSION_CHARGE_STATUS_CHANGED` and Kiorex logs "failed contract schema: unknown event type" for it (non-fatal), and `POST /commission-collections` exists only in the Clinic's copy of `marketplace.openapi.json`, not in `kiorex-contracts` (publishing contracts is not this lane's call).
3. **Clinic**: holds and bookings do not enforce `marketplaceDailyCap`, only the slot list does, and the per-day slot cache is 60 s, so a stale list can overbook a day by a few. Not changed here (behaviour decision).
4. **Plan gating** of the two new Clinic controllers (pay collections, commission collections) is recorded as `open` in the PL-04 map because that is what they do today; whether they belong to a plan is a pricing decision.
5. A full ordered run takes about 13 minutes on a quiet machine (785 to 790 s measured); every run leaves COMPLETED appointments on the near days of the three demo doctors, so the near days of a long-lived database sit at the marketplace cap: the suites that need room now pick it (12, 07) instead of assuming it.

## 5. Migration replay and backup/restore drill (`e2e/scripts/migration-replay.sh`)

From an empty database to head: Kiorex 46 migrations, Clinic 199, Pharmacy 26, Lab 27, none failed, the folder set equals the applied set and the applied order is the timestamp order. Growth drill: the data of 79 growth tables of the populated private database was dumped, restored into the replayed schema and compared table by table (row count and an md5 over all rows): 79 of 79 identical.

## 6. Dependency audit

`npm audit --omit=dev` on 25 Nov: 0 vulnerabilities in kiorex-platform, kiorex-account, clinics-management, kiorly-pharmacy, kiorly-lab, kiorex-contracts, e2e, kiorly (staff app).

## 7. Lighthouse and performance

See `_docs/security/PHASE34_PERFORMANCE.md`. Public SSR pages: 20 of 20 combinations 99 or 100 performance, 100 for the other three categories, LCP at most 692 ms on the slow-4G mobile profile.

## 8. Flag matrix

`kiorex-platform/apps/api/test/locked-flags.int.spec.ts` (7 tests, green): every launch-locked growth flag is registered, locked and not effective without gate evidence; no visitor cookie or touchpoint, no reward or credit route, no corporate join, no promotion quote, no marketing send, no real model.
