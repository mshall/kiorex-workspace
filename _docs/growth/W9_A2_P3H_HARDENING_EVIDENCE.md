# GRW-P3-H evidence: Phase 3 and 4 end to end, performance and security regression (wave 9 lane A2, 25 Nov 2026)

Everything here ran locally on a private stack; nothing was pushed or deployed. Authoritative companion files: `_docs/security/PHASE34_PERFORMANCE.md` (numbers), `_docs/security/PENTEST_2026-11_REPORT.md` section 8 (KX-PT-16 onwards), `e2e/README.md` (how to run).

## 1. The private stack

`e2e/scripts/w9-stack.sh up|down|env` (Passport :4710 with a re-pointed `idp.json` copy through the new `KX_IDP_CONFIG`, Clinic :4712, Kiorex :4713, Pharmacy :4714, Lab :4715; databases `w9_*` cloned from the dev databases, migrated to the current heads, flag catalogue seeded, every stored URL, partner registration, back-channel logout URI and flag webhook re-pointed, builds in `dist-w9`, removed by `down`). Ports 3000, 5173, 5175 and the shared 3010, 4000, 4400, 3100, 3200 are refused by the script. Suites that hard-coded those ports now read `e2e/src/env.ts` (04, 05, 40, 44, 45, 49, `growth-p3.ts`), 10-resilience stops and starts only the private Clinic, 11-nurse-lab and 39 run when `E2E_FULL_STACK=1`.

Isolation incidents, all mine and all closed: (1) the first bring-up left the Passport back-channel logout URIs of the committed `idp.json` pointing at the shared Kiorex, Clinic, Pharmacy and Lab (suite 21 failed on it); fixed by re-pointing all of them in the private copy. (2) `10-resilience` called `svc.sh`, which stops and starts the **shared** Clinic on :3010: it ran once before I noticed, so the shared Clinic was stopped and started again (about 30 seconds of downtime, restarted from its own `dist/`); `svc.sh` now delegates to the private stack when `E2E_FULL_STACK` is set. (3) The Kiorex seed resets `PartnerRegistration` to the default shared ports; the URL rewrite now runs after the seeds. A short burst of suite 04 requests reached the shared Pharmacy before (3) was fixed.

## 2. Ordered full runs (01 to 56 in one `npx vitest run`)

| Run | Stack state | Result | Failing |
|---|---|---|---|
| 1 | first clone (no flag seed) | 18 failed / 508 passed | 11 files; most were a clone with an unseeded flag catalogue (`growth.cross_product` and others unknown), a leftover second live lab and the Clinic restarted by 10 on the shared port |
| A | fresh clone, seeded | 5 failed / 524 passed | 12 (waitlist), 33, 52, 53 x2 |
| B | second run on the same stack | 12 failed / 517 | repeat-run dependence: 38 (market ZY is created once), 26, 41, 52 (cap sums), 11, 12, 33 |
| C | fresh, after fixes | 3 failed / 526 | 12, 52 (counted other suites' grants), 55 (marketing cap, timing) and suites 39b, 51, 52B failed in their hooks (Clinic booking slug left on a KX-DEV clinic in the dev Clinic database) |
| D | second run | 4 failed / 525 | 12 x2, 34, 52 |
| E | fresh, after more fixes, current mains | 5 failed / 543 | 11, 12 x2, 33, 34 |
| F | second consecutive run on the same stack | 4 failed / 544 | 12 x2, 26, 49 Z2a (see 3, a broken Clinic schema on main moved under the stack) |

**The programme gate (all suites green three times in one ordered invocation) is NOT met.** What is true: 544 of 591 tests pass in the last ordered run, 41 skip by design (39b, 51 and 52 part B need data this clone does not carry; the last two runs skipped them cleanly, see 4), and the failures that remain are listed in section 4 with what is known.

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

## 4. Honest list of what still fails or does not run

1. **12-waitlist, autofill offer within 90 s** fails in every full ordered run (A to F, 2 of 3 tests) and passes alone and together with 10-resilience; in a six-file ordered subset (03, 06, 07, 08, 09, 12) the first test passed and the decline test failed, so it depends on what the earlier files leave behind (bookings on the same doctors and slots). Not root-caused. Evidence: the offer event itself arrives (log `WAITLIST_OFFER` in earlier runs), the host load average was 25 to 50 in runs A to D and about 4 in E and F, so load is not the whole story. Owner: the lane that owns waitlist autofill (GC-2).
2. **11-nurse-lab** failed in B, D and E (`clinic mirror ACCEPTED` after 45 s), passed in A, C and F. The Kiorex to Clinic status push was measured at 58 seconds after the order in one failing run, so the 45 second wait is shorter than the relay under load. Timing, not logic.
3. **34-growth-experiments** "WINNER" failed in D and E and passed in A to C and F: statistical (random visitor keys, 160 visitors). The suite needs a seeded visitor sequence or a larger sample.
4. **26-growth-analytics** rollup idempotency failed in the second consecutive run (B and F) and passes after a pause or alone: events that other suites write between its two rollups change the comparison. 
5. **39b, 51, 52 part B** (sponsored promotions on the real Clinic and the corporate benefit in Pay) skip because their setup needs fixtures the cloned dev databases do not carry in this run (Clinic booking slug, a corporate account activation written for the pay-ready build). 51 passed on its own private instance in W8 (`promo-stack.sh`); they are NOT proven by this wave.
6. **30-security** (production-mode stack, ports 4300 to 4303) was not re-run: `sec-stack.sh` validates tokens at the shared Passport :4400, which this lane may not use. It stands on the 24 Nov result.
7. **UI edge Playwright at 320, 640x450, 1440 and 2560 in AR and EN for every new page** was not run in this wave (no private web dev servers were started). The per-package Playwright suites of waves 5 to 8 ran at 320 and 1440 with their own records; 640x450 and 2560 are not covered anywhere.
8. **Backup and restore, migration replay**: done, see section 5.
9. A full run takes 17 to 20 minutes on a quiet machine; the three-in-a-row requirement was not finished in the time of this lane.

## 5. Migration replay and backup/restore drill (`e2e/scripts/migration-replay.sh`)

From an empty database to head: Kiorex 46 migrations, Clinic 199, Pharmacy 26, Lab 27, none failed, the folder set equals the applied set and the applied order is the timestamp order. Growth drill: the data of 79 growth tables of the populated private database was dumped, restored into the replayed schema and compared table by table (row count and an md5 over all rows): 79 of 79 identical.

## 6. Dependency audit

`npm audit --omit=dev` on 25 Nov: 0 vulnerabilities in kiorex-platform, kiorex-account, clinics-management, kiorly-pharmacy, kiorly-lab, kiorex-contracts, e2e, kiorly (staff app).

## 7. Lighthouse and performance

See `_docs/security/PHASE34_PERFORMANCE.md`. Public SSR pages: 20 of 20 combinations 99 or 100 performance, 100 for the other three categories, LCP at most 692 ms on the slow-4G mobile profile.

## 8. Flag matrix

`kiorex-platform/apps/api/test/locked-flags.int.spec.ts` (7 tests, green): every launch-locked growth flag is registered, locked and not effective without gate evidence; no visitor cookie or touchpoint, no reward or credit route, no corporate join, no promotion quote, no marketing send, no real model.
