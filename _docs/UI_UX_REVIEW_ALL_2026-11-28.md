# UI/UX, accessibility, RTL and responsive review, all Kiorex and Kiorly web surfaces (28 Nov 2026)

Reviewer role: senior UI/UX designer. Hosts: the live kx-test hosts. Method: real Chrome through Playwright (`e2e/kx-test/ui-review/audit.mjs`), the kx-test e2e personas (no published demo credentials), axe-core 4 on every page at 360 and 1440, an overflow probe (page-level horizontal scroll, with the offending element), a touch-target probe (interactive elements under 24 px), an unnamed-control probe, a 14-stop keyboard Tab pass (visible focus), page title, favicon, `lang`/`dir`, console and network errors. Screenshots (before and after) are under `_private/ui-review/<surface>/{before,after}/` (git-ignored; raw results `_private/ui-review/results_*.json`).

## What was and was not covered

| Covered | Not covered or only partly |
|---|---|
| English and Arabic, light and dark, on every page below | Widget `book.test.kiorex.com` and Nurse `nurse.test.kiorly.com` are not hosted on kx-test (no DNS answer), so not reviewed |
| Public pages at 360/390/768/1024/1440/1920 (Kiorex web, Kiorly Home, Clinic/Pharmacy/Lab public pages); signed-in pages at 360/768/1440 (and 360/1440 for the after runs) | Signed-in screens at 390/1024/1920 were not run (time and a shared host that returned 502/504 when six browsers ran at once) |
| Signed in as: patient (Hoda Mahmoud), ops, Kiorly super admin, Pharmacy cashier, Lab technologist, Clinic throwaway owner "[TEST] KX E2E Clinic (removable)" | Passport sign-in, MFA and step-up screens were only looked at as screenshots: the login pages and the unified login component are being edited by another agent (not touched). Passport ops screens (`/account/ops/*`) need a step-up (TOTP) session; the audit session answered 403 and showed the step-up page, so their real content was not reviewed |
| 12 to 13 pages per signed-in product, 6 to 7 per Passport persona | Real offline/slow network, loading skeletons, validation messages of forms, modals, toasts, print and PDF screens, pagination interactions: not exercised (no state was changed on kx-test); only what a plain page load shows |
| Keyboard: first 14 Tab stops per page | No screen-reader run, no real device, no zoom 200 percent run |

Clinic has the live real organisation (Dr Ahmed Shall): only the throwaway test organisation was signed in; nothing was written.

## Cross-cutting findings (all surfaces)

| # | Finding | Severity | Status |
|---|---|---|---|
| X1 | The UI font on every surface was Jost (Latin) with IBM Plex Sans Arabic, not Plus Jakarta Sans. | Decision | **Fixed (founder decision 28 Nov).** Kiorex surfaces (patient web and its public SSR pages, Kiorex ops console, Passport) use Plus Jakarta Sans 400/500/600/700 (Latin) with IBM Plex Sans Arabic as the Arabic companion, self-hosted woff2, `font-display: swap`, no Google Fonts request. Kiorly keeps Jost (README); the Ops console switches to Jost for the Kiorly edition through `html[data-edition="kiorly"]`. See `_brand/README.md` (Type and numerals). Live: patient web, ops (both hosts), Passport. Public SSR pages of the patient site (served by the API image) carry it from platform `6949c9a6` on. |
| X2 | Arabic numerals were inconsistent across products (Passport and the Kiorly admin Arabic-Indic, Lab and Pharmacy Western, Clinic toggle). | Moderate | **Fixed (founder decision 28 Nov): Western digits 0-9 by default everywhere.** One vendored Intl wrapper (`_brand/numerals/western-digits.ts`) adds `-u-nu-latn` to Arabic locales in Passport, ops/Kiorly admin, patient web (client and SSR), Pharmacy, Lab and Clinic; digits inside Arabic UI strings were converted; the staff app and Kiorex mobile use `ar-EG-u-nu-latn` in their format helpers. The Clinic numerals toggle (`data-numerals="arab"`) stays a user choice, default Western. |
| X3 | The browser tab title was one fixed string on Kiorex ops, Kiorly admin, Clinic, Pharmacy, Lab and the signed-in patient web (WCAG 2.4.2). | Moderate | **Fixed.** Shared hook `usePageTitle` (`_brand/pagetitle/use-page-title.ts`, vendored): the title is `<screen h1> - <product>` (fallback: active nav entry), in Ops (both editions), patient web, Pharmacy, Lab and Clinic (not the Nurse edition). Kiorly Home names its current step; Passport sets a title per section (live now). Live check: `Feature flags - Kiorex Ops`, `Provider directory - Kiorly Admin`, `Reports - Kiorly Clinic by Kiorex`, Arabic equivalents. Public Clinic pages (login, sign-up, pricing) keep the product title. |
| X4 | The Kiorex platform apps spelled the brand `كيوركس` in Arabic (33 files incl. API SEO data and snapshots). | Moderate | **Fixed (founder decision 28 Nov): `كيوريكس` everywhere.** Platform 34 files, Pharmacy 5, Lab 5, staff app 2, Clinic web 7, video briefs 2. Left on purpose: the Clinic API strings (statements, legal pack, push and message templates; 11 files) because the Clinic `main` deploy is web-only; they follow with the next Clinic API release. |
| X5 | Card titles render as `h3` directly under the page `h1` on most Clinic and patient pages (axe heading-order, moderate). A shared `CardTitle` level prop is the fix. | Moderate | Recommendation |
| X6 | When six browsers loaded kx-test at once the host answered some `/api/*` calls with 502/504 (Pharmacy `auth/me`, Lab `specimens`, Ops `leads/summary`). Pages showed their error states correctly, but the host is small: a capacity note for the test box. | Info | Not a UI defect |
| X7 | `lang="ar-EG"` on Clinic, `lang="ar"` everywhere else. | Minor | Not fixed |
| X8 | RTL: every Arabic page sets `dir="rtl"` and `lang`; no mirrored layout break, no icon direction fault and no overflow was found at 360 in Arabic apart from the two Ops items below (fixed). Numbers, phone numbers (`+201****369`), codes and Latin names keep LTR runs correctly. | Pass | |
| X9 | Page-level `noindex`: every host answers `X-Robots-Tag: noindex, nofollow` (checked on 8 hosts); favicon link present on every page; skip link present on every app shell. | Pass | |

## Findings per surface (issue, severity, fixed or not, commit)

Severity uses axe impact where it applies (critical, serious, moderate, minor), otherwise major/minor.

### 1. Kiorex patient web, test.kiorex.com (public and signed in)
Found 7, fixed 3 (live).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Logo link `aria-label="Home"` did not contain the visible "KIOREX" (label-in-name, all pages) | serious | Yes, now `KIOREX, Home` / Arabic equivalent | kiorex-platform `be26b5f` |
| Language toggle `aria-label="Switch language"` did not contain the visible language name | serious | Yes (name is "Switch language: English / العربية") | `be26b5f` |
| Notification preferences: a `<p>` directly inside the `<ul>` (axe list) | serious | Yes (paragraph moved out) | `be26b5f` |
| Heading order (`h3` after `h1`) on search, appointments, account, records, loyalty, care plans | moderate | No (X5) | |
| Fixed browser title on signed-in pages; English title carries the old Arabic spelling | moderate | Yes (X3, X4) | Platform `274a409`, `b0b6448` |
| Footer link `clinics.test.kiorly.com` 131x20 px | minor | No | |
| Console noise: 403 on loyalty for the demo patient (feature gate), 504 on records under load | info | No | |
| Keyboard: search field has no outline of its own, but its wrapper shows the focus ring (checked with `:focus-within`, a pass) | pass | | |

### 2. Kiorex ops console, admin.test.kiorex.com
Found 7, fixed 3 (live; the fixes were verified on the same bundle at admin.test.kiorly.com).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Data tables had blank header cells for the action column (flags, orders, moderation, outbox: axe empty-table-header) | minor | Yes (screen-reader text from the existing "Actions" string, new key `common.actions` EN/AR) | `be26b5f` |
| Booking timeline: search field and button overflowed the page at 360 px (button clipped) | major | Yes (`flex-wrap`, `max-w-full`) | `be26b5f` |
| Market policy (Arabic, 360): the partial-fulfilment select was wider than its card and pushed the page left | major | Yes (`max-w-full`) | `be26b5f` |
| Fixed title "Kiorex Ops" on every page | moderate | Yes (X3, per-screen titles) | Platform `b0b6448` |
| Growth overview: two `section`s share the landmark name (landmark-unique) | moderate | No | |
| Growth overview: 29 link targets 20 px high; policy checkboxes 13 px | minor | No | |
| 504s on `leads/summary`, `markets`, `liquidity` while other browsers ran | info | No (X6) | |
| Dark mode, Arabic mirroring, tab strip scroll at 360: pass | pass | | |

### 3. Kiorly admin edition, admin.test.kiorly.com
Found 2, fixed 0 of its own (it shares the Ops bundle, so the three Ops fixes apply here too and were re-verified here).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Fixed title "Kiorly Admin" | moderate | Yes (X3: `Provider directory - Kiorly Admin`) | Platform `b0b6448` |
| Join requests and partner leads: 16 px checkboxes (17 on partner leads) | minor | No | |
| Kiorly logo (chevron mark and Arabic wordmark) used correctly; no axe violation on leads, markets, plans, partner leads, partner onboarding, providers | pass | | |

### 4. Passport, passport.test.kiorex.com (account screens; sign-in not touched)
Found 3, fixed 1 (in code only).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Title is "Kiorex Passport" on every screen (WCAG 2.4.2) | moderate | Yes, and deployed with the Passport image `f4e8693` (28 Nov second pass) | kiorex-account `3cc2567` |
| Privacy page checkbox 22x22 px | minor | No | |
| Ops screens answered 403 to a session without step-up; the console logs the 403 even though the step-up page is shown | info | No | |
| RTL (nav tab strip starts at the right, language and theme controls mirror), dark mode, no axe violation on 10 screens: pass | pass | | |

### 5. Kiorly Home, app.test.kiorly.com
Found 1, fixed 1 (second pass: the tab title now names the current step, `Sign in - Kiorly`, commit `abec596`; deployed). Original: title "Kiorly: sign in", `lang`/`dir` correct, no axe violation, mirrored product tiles. Inline links "Create a Kiorly ... workspace" are 20 px high (minor, not fixed). Login surface: not edited (another agent).

### 6. Clinic web, clinics.test.kiorly.com
Public pages (login, signup, forgot password, pricing): found 4, fixed 0 (all four belong to the login and Plans work of other agents). Signed-in: found 11, fixed 4. Live on kx-test and the live organisation host (web-only deploy from `main`).

| Issue | Severity | Fixed | Commit (kiorex / main) |
|---|---|---|---|
| Active tab trigger of Revenue and Reports: white on sky-600 4.02:1 (dark mode worse); emerald and amber had the same weakness | serious | Yes (700 shades, AA) | `7d110775` / `390868de` |
| Blank table headers (10 tables: doctor statements, cash drawer, claims, instalments, invoices, statements, charges, outbox, payment channels, Kiorex booking settings) | minor | Yes (sr-only "Actions") | `7d110775` / `390868de` |
| Arabic numerals toggle ("123") accessible name did not contain its visible digits | serious | Yes | `7d110775` / `390868de` |
| Report error line `text-red-700/70` 4.13:1 | serious | Yes | `524711ae` / `42e71c36` |
| Reports: amber status text on the muted table row measures 4.49:1 in light mode (found after the red line was fixed) | serious (borderline) | Yes (amber 800 in `reports-page.tsx` and the column-head tone in `patient-acquisition-icons.tsx`) | `c6d80f39` + `29fe51ad` / main `b83e530e` + follow-up |
| Heading order (card titles are `h3`) | moderate | No (X5) | |
| Sidebar section labels outside a landmark (axe region) | moderate | No | |
| "Documents (7)" banner link 85x16 px; 18 px checkboxes on Team and Kiorex | minor | No | |
| Branch select (`#kiorex-clinic`) label does not contain the selected value (axe label-content-name-mismatch, a field-label pattern) | serious by axe, low in practice | No | |
| Fixed title "Kiorly Clinic by Kiorex"; `lang="ar-EG"` | moderate / minor | Title yes (X3, `c3793f58` / main `37b7194a`); `lang` not changed (X7) | |
| Test-data only: avatar initial shows "[" for the name "[TEST] KX E2E Owner" | cosmetic | No | |
| **Pricing page, dark mode: the header "Sign in" link measures 1.09:1** (#0f1024 on #171936), i.e. unreadable | critical | Yes (the page is a light design: its header and hero outline buttons now keep light colours in dark mode). The live re-check found the same defect on the "See pricing" button and the patients input: fixed too | `c6d80f39`, `29fe51ad` |
| **Pricing page: one `input` and one `select` without a label** (axe label, select-name) | critical | Yes (`htmlFor`/`id`; axe label violations gone live) | `c6d80f39` |
| Login: no `h1`; signup and forgot-password: no `main` landmark and no `h1` | moderate | Yes (also reset password and invitation pages; `CardTitle` got an `as` level prop, which also answers X5 where used) | `c6d80f39` |

### 7. Pharmacy web, pharmacies.test.kiorly.com
Found 4, fixed 1 (live).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Blank table header cells (catalogue, prescriptions) | minor | Yes (sr-only "Actions", new key `common.actions` EN/AR) | kiorly-pharmacy `08b4e99` |
| Notification bell: name "Notifications (5)" does not contain the visible badge text | serious | No | |
| Fixed title "Kiorly Pharmacy by Kiorex" | moderate | Yes (X3 hook in the layout) | kiorly-pharmacy `cf37068` |
| Hidden 1x1 inputs on customers/catalogue and 13 px checkboxes; 403 on `growth/commission-rate` logged for the cashier (feature gate) | minor / info | No | |

### 8. Lab web, labs.test.kiorly.com
Found 3, fixed 1 (live).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Blank table header cells (catalogue, accessioning) | minor | Yes | kiorly-lab `69e9a36` (my files were committed inside another agent's commit; same change) |
| Worklist checkboxes 13-16 px; patient links and "Order" links 18-21 px high | minor | No | |
| Fixed title (X3 hook in the app shell, kiorly-lab `1d56250`); setup-progress line "7 of 10 . 70%" has the percent sign on the wrong side in Arabic (bidi) | moderate / minor | No | |

## Counts

| Surface | Found | Fixed (code) | Live on kx-test |
|---|---|---|---|
| Kiorex patient web | 7 | 3 | 3 |
| Kiorex ops console | 7 | 3 | 3 |
| Kiorly admin edition | 2 (+ the 3 shared Ops fixes verified) | 0 | shared 3 |
| Passport | 3 | 1 | 0 (code only) |
| Kiorly Home | 1 | 0 | 0 |
| Clinic (public and signed in) | 15 | 4 | 4 (web-only deploy to the shared Clinic host) |
| Pharmacy web | 4 | 1 | 1 |
| Lab web | 3 | 1 | 1 |
| Cross-cutting (X1 to X9) | 7 open, 2 pass | 0 | |

## Verification

* Unit and type tests per touched repo, run before committing: Ops 375/375 and patient web 382/382 (vitest) plus `tsc -b`; Clinic web `tsc -b` clean and 219/219 unit tests (eslint shows 2 errors in another agent's `unified-sign-in.parity.node.test.ts`, none in the files changed here); Lab 73/73 and Pharmacy 73/73 node tests.
* After deployment the audit was re-run live (EN and AR, light and dark, 360 and 1440): Ops (bookings, policy, flags, orders, moderation) and patient web (home, notifications, account): zero axe violations apart from the known items above and no horizontal overflow; Clinic (revenue, reports, kiorex, patients, cash drawer): contrast, blank header and numerals-toggle violations gone. Pharmacy and Lab were checked in the live JavaScript bundle (`common.actions`, the sr-only header) because their saved sessions were removed by a concurrent e2e sign-out and a new sign-in would have used another Passport code (3 were used, as allowed).
* Before and after screenshots: `_private/ui-review/<surface>/before/` and `/after/`.

## Deployment (kx-test, nothing outside it)

* Ops console and patient web: built from kiorex-platform `be26b5f` with the registry-generated `ops.build.env` / `web.build.env`, synced to `kx-test-site-kiorex-admin-990597228737`, `kx-test-site-kiorly-admin-990597228737` and `kx-test-site-kiorex-marketplace-990597228737` (assets immutable, `index.html` no-cache), CloudFront `E3QZ8P1W9X4CC`, `EQGFK1VR1MHT5`, `E2LL663XIANQEF` invalidated.
* Pharmacy web: built from kiorly-pharmacy `08b4e99`, synced to the Pharmacy bucket, `E3G9V72X5CEJC2` invalidated. Lab web: already carried the change (deployed by another agent from a tree that included it).
* Clinic: pushed to `kiorex`, then to `main` (run 46080485165, `Detect deploy scope` web-only, CI web green, deploy green in about 2 minutes; no in-flight run at the time; no migration, no port, CI or infra change).
* Passport: code committed, not deployed (see above). No tofu apply, no database change, no Secrets Manager change.

## Second pass, 28 Nov 2026 (founder decisions applied, open accessibility findings closed)

Founder decisions (final): (1) Kiorex surfaces use Plus Jakarta Sans with IBM Plex Sans Arabic; Kiorly keeps Jost; (2) `كيوريكس` everywhere; (3) Western digits by default everywhere, the Clinic numerals toggle stays a user choice. All three are implemented (X1, X2, X4 above) and recorded in `_brand/README.md` ("Type and numerals").

| Item | Result | Commits |
|---|---|---|
| Clinic pricing page, dark mode "Sign in" 1.09:1; "See pricing" button and patients input had the same defect (found by the live re-check) | Fixed: the page is a light design, now scoped `kx-force-light`; axe `color-contrast` and `label` violations 0 on `/pricing` in EN/AR, light/dark, 1440 | kiorex `c6d80f39`, `29fe51ad`, `1fe77f7c`; main `b83e530e`, `b754dc80`, `a116f160` |
| Clinic login, sign-up, forgot, reset, invitation: no `h1` / `main` | Fixed (`CardTitle as="h1"`, `main` landmark); live: one `h1` and `main` on login, signup, forgot-password | kiorex `c6d80f39` / main `b83e530e` |
| Clinic Reports amber text 4.49:1 | Fixed (amber 800 in the page and in the column-head tone helper); axe `color-contrast` 0 live | `c6d80f39`, `29fe51ad` / main `b83e530e`, `b754dc80` |
| Per-screen titles: Ops (both editions), patient web, Pharmacy, Lab, Clinic; Kiorly Home and Passport | Fixed, see X3 | platform `b0b6448`, pharmacy `cf37068`, lab `1d56250`, Clinic `c3793f58` / `37b7194a`, account `abec596`, `3cc2567` |
| Passport Arabic font stack was a circular CSS variable (Times fallback) in the first Passport build | Found by the live audit, fixed and redeployed the same hour | account `f4e8693` |

What changed in numbers: 4 cross-cutting items closed (X1 to X4) plus 6 surface findings (pricing contrast, pricing labels, login/sign-up/forgot landmarks, Reports amber, Passport title, Kiorly Home title) = 10 items. Still open from the first pass: X5 heading order (the `CardTitle` level prop now exists, pages not yet migrated), X6 capacity note, X7 `lang="ar-EG"`, Clinic sidebar region, 18 px checkboxes, Pharmacy bell label-in-name, Lab percent sign in Arabic, small link targets. Live axe after the pass (EN/AR, light/dark, 1440): Clinic pricing 0 violations; Clinic Reports `heading-order` 1 and `region` 5 (known, moderate); patient search `heading-order` 1; Ops, Kiorly admin, Passport sign-in and Kiorly Home 0.

Verification of this pass:
* Unit/type tests before committing: platform ops 375/375 (the 3 new title tests run separately and pass: 3/3), patient web 382/382 (8 SSR snapshots re-recorded: Arabic prices now Western digits, `كيوريكس`), widget 13/13, mobile jest 344/344; Passport (account repo) 487/487 and `tsc -b` clean; Pharmacy 73/73 and Lab 73/73 node tests, `tsc -b` clean; staff app jest 460/460 (digits assertions moved to Western, the `by Kiorex` placement guard needed one sentence reworded); Clinic web `tsc -b` clean and 219/219 unit tests on `kiorex` and on the `main` worktree. Clinic eslint on the touched files: 0 errors.
* Live, kx-test (Playwright, Chrome, EN and AR, light and dark, 390 and 1440): 96 page runs on 12 surfaces plus Passport and Kiorly Home: no horizontal overflow, computed font is Plus Jakarta Sans on patient web, Ops (Kiorex host) and Passport; Jost on Kiorly admin and every Kiorly product; zero Arabic-Indic digits and Western digits present on the Arabic pages of patient web, both Ops hosts, Clinic and Passport (`digits-probe`); tab titles per screen as listed in X3. Screenshots: `_private/ui-review/after28*/`.
* NOT tested: signed-in Pharmacy and Lab pages (their saved sessions had expired; checked in the live bundle that the title hook is present, and in code), the staff app and Kiorex mobile on a device (Hermes `Intl` with `-u-nu-latn` is covered by jest only), the booking widget in a host page, print/PDF/e-mail templates (digits and spelling there live in API code: Clinic API strings still say `كيوركس`), real screen readers, Safari/Firefox.

Deployed on kx-test in this pass (no tofu, no secret, no migration): patient web and Ops (both hosts) static build from platform `b0b6448`; Pharmacy web `cf37068` and Lab web `1d56250` (static, `VITE_KIORLY_HOME_URL` as before); Kiorly Home from `abec596`; Passport image `f4e8693` (the MFA agent's `2ce2134` plus fonts, digits, titles) through `deploy.sh test --tag passport=f4e8693`; platform API: release `6949c9a6` (another agent's, built after my commits) carries the spelling and the public SSR fonts. Clinic `main` run 46092053468 (web-only, success) and 46094918395 (web-only, success), no migration, no port, CI or infra change.

## Founder decisions still needed

1. Clinic API strings (statements, legal pack, push and message templates, 11 files) still spell `كيوركس`: change them with the next Clinic API release (a `main` push that touches the API starts a full deploy), or now?
2. Migrate the remaining card titles (`h3` under `h1`, X5) to the new `CardTitle as="h2"` level prop page by page (about 25 pages), or leave?
3. Pricing page: the plan prices shown there come from the catalogue; the seeded Clinic ANNUAL prices still look inconsistent (see the plans deploy log).
