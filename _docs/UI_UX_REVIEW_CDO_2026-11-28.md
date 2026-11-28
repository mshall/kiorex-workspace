# Chief Design Officer review: Kiorex and Kiorly, all surfaces (28 Nov 2026)

Role: CDO, one design language for both products. Companion: `_docs/DESIGN_SYSTEM_KIOREX_KIORLY.md` (tokens, states, motion guidelines, reduced motion). Earlier reviews this builds on: `UI_UX_REVIEW_ALL_`, `_KIOREX_LANDING_`, `_LANDING_`, `_PASSPORT_` (28 Nov).

## Honest scope

| Done in this pass | Not done (be clear) |
|---|---|
| Live probe of 12 public pages at 360 and 1440 (console and CSP errors, HTTP errors, overflow, h1, computed font, small targets): `e2e/kx-test/ui-review/cdo-probe.mjs` | Signed-in screens were NOT re-shot: the saved Passport sessions had expired and re-signing in all personas would exceed the 8-code budget. Signed-in scoring below is from the 28 Nov screenshots (`_private/ui-review/*/after`, ops bookings reviewed again) plus code, not a fresh walk |
| Fresh screenshots EN/AR, light/dark, 390 and 1440 of the landing, entry, Kiorly site, Home, Clinic/Pharmacy/Lab/ops sign-in: `_private/ui-review/cdo/<surface>/` | Mobile apps (Kiorex patient app, Kiorly staff app): no fresh web export was built; scores are from code and earlier jest/e2e-web evidence, marked "not reviewed visually" |
| Design system document, fixes below, deploy to kx-test, live re-probe | Dark-mode and Arabic of every signed-in dense screen; real devices, Safari, screen readers, Lighthouse |
| Platform unit test and TypeScript rootDir fixes | Clinic API strings (not mine, left) |

## Scores (1 to 10; before = start of this pass, after = live now)

Scale: 10 = would not be embarrassed next to Stripe/Linear/Apple Health in first impression, hierarchy, states, motion, RTL, a11y. Scores are my judgement, not a metric.

| Surface | Before | After | Why (one line) |
|---|---|---|---|
| Kiorex patient landing | 8 | 8 | Strong hero, phone mock-up, scroll reveals, FAQ, CTA band, bilingual. Hero lower third is airy and the trust strip sits under the cookie banner on first paint |
| Kiorex entry and onboarding | 8 | 8.5 | Calm segmented Sign in / Join, clear Egypt-not-live notice; the consent sheet used to cover a third of a phone: now smaller with a sheet-up entrance |
| Kiorex search, booking, records, account | 7.5 | 7.5 | Consistent tokens, skeletons, reduced-motion; not re-walked live this pass |
| Passport sign-in / register / MFA | 9 | 9 | Brand panel, drawn mark, six-cell code, shake, countdown (earlier review); Passport root path answers a bare 404 text page (backlog) |
| Passport account and ops screens (`/account/*`) | 6.5 | 6.5 | Older layout than the sign-in; not touched (backlog) |
| Kiorex ops console and role dashboards | 7.5 | 7.7 | Clean, dense and readable, good nav; machine codes (`internal_medicine`) now read as words. Clinic column shows ids in test data; row hover and bulk bars to verify per table |
| Kiorly admin edition | 7.5 | 7.7 | Same bundle as ops; Kiorly marks correct. Sign-in page title says "Kiorex Passport" on the Kiorly admin host (backlog) |
| Kiorly landing (test.kiorly.com) incl. Plans and join | 8 | 8.3 | Strong IA, product tabs, diagram, plan tabs, 5-step join. FIXED a real defect: the CDN CSP (`style-src 'self'`) blocked 13 inline style attributes, so the product accent colours (module tabs and panels) were lost; plan buttons now share a baseline and cards lift on hover |
| Kiorly Home (unified sign-in hub) | 9 | 9 | Excellent: product tiles, Passport/Password switch, brand panel |
| Clinic web (login, pricing; signed-in per earlier shots) | 7.5 | 7.5 | Login good; MFA field always shown with a dark placeholder that reads as a value |
| Pharmacy web | 7.5 | 7.5 | Login good; Arabic lockup sub-line in the brand panel is about 7 px (illegible) |
| Lab web | 7.5 | 7.5 | Same pattern as Pharmacy; worklist tap targets small |
| Unified login card | 8.5 | 8.5 | Consistent across Home, Clinic, Pharmacy, Lab |
| Kiorex patient app, Kiorly staff app | n/r | n/r | Not reviewed visually (no export this pass) |

## Findings and status

| # | Finding | Surface | Severity | Status |
|---|---|---|---|---|
| 1 | CSP `style-src 'self'` blocks 13 inline `style` attributes: product accents on module tabs/panels and the SVG sprite were silently unstyled | Kiorly site | High (visible brand loss, console errors) | Fixed: `data-acc` attribute rules, `.sprite` class, test forbids `style="` in built HTML. Live: zero CSP errors |
| 2 | Consent banner covers about a third of a phone on first paint, appears with no entrance | Kiorex web | Medium | Fixed: compact layout under 640 px (icon hidden, two equal buttons in a row, tighter copy), `kx-sheet-up` entrance delayed 400 ms; equal-weight Accept/Reject unchanged (legal) |
| 3 | `url-policy.unit.spec.ts` failed: `/signin`, `/join`, `/welcome` (new entry routes) were not robots-disallowed | Platform API | Test failure | Fixed in code (they are private SPA flows): PRIVATE_PATH_PREFIXES. 2023/2023 unit tests pass |
| 4 | TypeScript TS6059 for `ops-role-matrix.int.spec.ts` | Platform API | Build hygiene | Fixed: `tsconfig.json` `rootDir` spans `apps` (build config keeps `./src`); another agent also made the import runtime-loaded. `tsc --noEmit` clean |
| 5 | Plan cards of unequal length leave the CTA at different heights | Kiorly site | Low | Fixed (CTA on the bottom edge) |
| 6 | Machine codes (`internal_medicine`, `ent`) in ops tables | Ops | Low | Fixed (`humanizeCode`, 2 tests) |
| 7 | Plans data: Clinic "per clinic / year" equals the monthly price; Pro "per clinician / year" (999) is lower than monthly (1,299) | Kiorly site (data) | Needs founder | NOT changed: prices are the founder's (maker-checker); known inconsistent annual seeds |
| 8 | Kiorly admin sign-in tab title reads "Sign in with Kiorex Passport - Kiorex Passport" | Kiorly admin | Low | Backlog |
| 9 | Pharmacy/Lab Arabic lockup sub-line about 7 px in the sign-in brand panel | Pharmacy, Lab | Low | Backlog (needs logo size decision; logo is never redrawn) |
| 10 | Passport root `/` answers a plain "Not Found" | Passport | Low | Backlog: redirect to the account site or a branded 404 |
| 11 | Pharmacy and Lab default to Arabic regardless of the browser language and ignore the Kiorex language cookie | Pharmacy, Lab | Info | Decision below |
| 12 | Clinic login MFA code field always visible, placeholder looks filled | Clinic | Low | Backlog (Clinic web, both branches) |
| 13 | Small targets: inline links (20 px), 13 to 18 px checkboxes in dense tables | Ops, Clinic, Pharmacy, Lab | Minor | Backlog (known from the earlier review) |
| 14 | Landing hero lower third and trust strip: whitespace, strip hidden under the banner on load | Kiorex landing | Low | Backlog (banner now smaller) |

## What was verified

* Platform: API unit 2023/2023 (176 suites), `tsc --noEmit`; web vitest 391/391 and `tsc -b`; ops vitest 408/408 and `tsc -b`. Kiorly site tests 53/53 (account repo run of `apps/kiorly-site`).
* Release bundles checked with `check-release-bundle.sh` (clean). Live re-probe after deploy (360 and 1440): no CSP error on the Kiorly site, no overflow anywhere, fonts correct (Plus Jakarta Sans on Kiorex, Jost on Kiorly).
* Reduced motion: the new sheet animation inherits the token collapse in `tokens.css`; not separately emulated in a browser.
* Not run: Playwright e2e suites (they use phone codes), axe on every page, real devices.

## Deployed to kx-test (static only, no containers, no tofu, no DB, no secrets)

Built from clean worktrees of committed code (platform `ed296ff`, account `75e56e8`) with the regenerated registry env files. Synced to `kx-test-site-kiorly-marketing`, `kx-test-site-kiorex-marketplace`, `kx-test-site-kiorex-admin`, `kx-test-site-kiorly-admin` (assets immutable, HTML no-cache, site HTML 300 s). CloudFront invalidated: `E15BCBE1TTZP1L` (`I9ZHRK2R1598IHLHZGL2DOF2PM`), `E2LL663XIANQEF` (`I2E9P66AR0EIFPBGTBV6C6IHPH`), `E3QZ8P1W9X4CC` (`I7XLIOYJJAE9DQMR4H96LEMZIS`), `EQGFK1VR1MHT5` (`I84FD4047PP9M3K0GUHTX8IJ8B`). Nothing was rolled back: the trees are `origin/main` plus these commits and no other agent was releasing. No Clinic change, so no Clinic deploy to either branch.

## Prioritised backlog for the founder

1. Decide the plan prices/annual rule (finding 7): the most visible inconsistency on the public Kiorly page.
2. Passport account site (`/account/*`) to the new sign-in look (brand panel, same cards), plus a branded root and 404 (largest design gap between two Passport halves).
3. Dense tables: row hover, sticky header, 24 px checkbox hit area, bulk-action bar, humanised codes everywhere (ops, Clinic, Pharmacy, Lab worklists).
4. Landing: a count-up only on real numbers once real data exists; hero lower third tightened; a short product video or looping mock-up demo (needs founder assets).
5. Pharmacy/Lab sign-in brand panel logo size in Arabic; Kiorly admin tab title; Clinic MFA field optional state.
6. A fresh signed-in walk of every dashboard in EN/AR dark at 360 (needs about 12 phone codes; schedule when the hourly limit is free) and a web export of both apps for visual review.
7. Page transitions and list-reveal in signed-in apps using `kx-page` consistently (Pharmacy, Lab, Clinic do not share it yet).

## Decisions needed

* Pharmacy/Lab default language: follow the browser (and the shared Kiorex cookie) or stay Arabic-first?
* Should the Kiorly admin host use its own Passport sign-in title ("Kiorly Admin")?
* Approve the Passport account site redesign (backlog 2) as the next UI task.
