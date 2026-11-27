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
| X1 | The UI font on every surface is Jost (Latin) with IBM Plex Sans Arabic, not Plus Jakarta Sans. `_brand/README.md` also says Jost + IBM Plex Sans Arabic for the Kiorly kit and Plus Jakarta Sans only for the Kiorex wordmark, so the written rules disagree with the brief. | Decision | Founder decision (not changed) |
| X2 | Arabic numerals are inconsistent across products: Passport and the Kiorly admin show Arabic-Indic digits and dates (`٢٨ نوفمبر ٢٠٢٦`), Lab and Pharmacy show Western digits, Clinic has a toggle (default Western). Pick one default. | Moderate | Founder decision |
| X3 | The browser tab title is one fixed string on Kiorex ops ("Kiorex Ops"), Kiorly admin, Clinic, Pharmacy, Lab and the signed-in patient web (WCAG 2.4.2: a title should name the screen). Passport is fixed in code (see below). | Moderate | Recommendation (the SPA shells of Ops, Pharmacy, Lab and Clinic were being edited by other agents; a `useDocumentTitle(route)` hook in each router is a small follow-up) |
| X4 | The Kiorex platform apps still spell the brand `كيوركس` in Arabic (33 files incl. API SEO data and snapshots); the brand rule is `كيوريكس`. It shows in the patient web title `Kiorex — كيوركس`, header banner and privacy banner. | Moderate | Not fixed: spans API, SEO and test snapshots (founder: "align separately") |
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
| Fixed browser title on signed-in pages; English title carries the old Arabic spelling | moderate | No (X3, X4) | |
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
| Fixed title "Kiorex Ops" on every page | moderate | No (X3; the Ops shell was being edited by another agent) | |
| Growth overview: two `section`s share the landmark name (landmark-unique) | moderate | No | |
| Growth overview: 29 link targets 20 px high; policy checkboxes 13 px | minor | No | |
| 504s on `leads/summary`, `markets`, `liquidity` while other browsers ran | info | No (X6) | |
| Dark mode, Arabic mirroring, tab strip scroll at 360: pass | pass | | |

### 3. Kiorly admin edition, admin.test.kiorly.com
Found 2, fixed 0 of its own (it shares the Ops bundle, so the three Ops fixes apply here too and were re-verified here).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Fixed title "Kiorly Admin" | moderate | No (X3) | |
| Join requests and partner leads: 16 px checkboxes (17 on partner leads) | minor | No | |
| Kiorly logo (chevron mark and Arabic wordmark) used correctly; no axe violation on leads, markets, plans, partner leads, partner onboarding, providers | pass | | |

### 4. Passport, passport.test.kiorex.com (account screens; sign-in not touched)
Found 3, fixed 1 (in code only).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Title is "Kiorex Passport" on every screen (WCAG 2.4.2) | moderate | Code fixed: "Security - Kiorex Passport" etc. from the existing nav labels. NOT deployed (needs a Passport image and a container restart while the login agent is changing Passport; it rides with the next Passport release) | kiorex-account `3cc2567` |
| Privacy page checkbox 22x22 px | minor | No | |
| Ops screens answered 403 to a session without step-up; the console logs the 403 even though the step-up page is shown | info | No | |
| RTL (nav tab strip starts at the right, language and theme controls mirror), dark mode, no axe violation on 10 screens: pass | pass | | |

### 5. Kiorly Home, app.test.kiorly.com
Found 1, fixed 0. Title "Kiorly: sign in", `lang`/`dir` correct, no axe violation, mirrored product tiles. Inline links "Create a Kiorly ... workspace" are 20 px high (minor, not fixed). Login surface: not edited (another agent).

### 6. Clinic web, clinics.test.kiorly.com
Public pages (login, signup, forgot password, pricing): found 4, fixed 0 (all four belong to the login and Plans work of other agents). Signed-in: found 11, fixed 4. Live on kx-test and the live organisation host (web-only deploy from `main`).

| Issue | Severity | Fixed | Commit (kiorex / main) |
|---|---|---|---|
| Active tab trigger of Revenue and Reports: white on sky-600 4.02:1 (dark mode worse); emerald and amber had the same weakness | serious | Yes (700 shades, AA) | `7d110775` / `390868de` |
| Blank table headers (10 tables: doctor statements, cash drawer, claims, instalments, invoices, statements, charges, outbox, payment channels, Kiorex booking settings) | minor | Yes (sr-only "Actions") | `7d110775` / `390868de` |
| Arabic numerals toggle ("123") accessible name did not contain its visible digits | serious | Yes | `7d110775` / `390868de` |
| Report error line `text-red-700/70` 4.13:1 | serious | Yes | `524711ae` / `42e71c36` |
| Reports: amber status text on the muted table row measures 4.49:1 in light mode (found after the red line was fixed) | serious (borderline) | No | |
| Heading order (card titles are `h3`) | moderate | No (X5) | |
| Sidebar section labels outside a landmark (axe region) | moderate | No | |
| "Documents (7)" banner link 85x16 px; 18 px checkboxes on Team and Kiorex | minor | No | |
| Branch select (`#kiorex-clinic`) label does not contain the selected value (axe label-content-name-mismatch, a field-label pattern) | serious by axe, low in practice | No | |
| Fixed title "Kiorly Clinic by Kiorex"; `lang="ar-EG"` | moderate / minor | No (X3, X7) | |
| Test-data only: avatar initial shows "[" for the name "[TEST] KX E2E Owner" | cosmetic | No | |
| **Pricing page, dark mode: the header "Sign in" link measures 1.09:1** (#0f1024 on #171936), i.e. unreadable | critical | Not touched: the Plans area is being edited by another agent. Needs fixing there | |
| **Pricing page: one `input` and one `select` without a label** (axe label, select-name) | critical | Not touched (Plans area) | |
| Login: no `h1`; signup and forgot-password: no `main` landmark and no `h1` | moderate | Not touched (login pages are being edited by another agent) | |

### 7. Pharmacy web, pharmacies.test.kiorly.com
Found 4, fixed 1 (live).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Blank table header cells (catalogue, prescriptions) | minor | Yes (sr-only "Actions", new key `common.actions` EN/AR) | kiorly-pharmacy `08b4e99` |
| Notification bell: name "Notifications (5)" does not contain the visible badge text | serious | No | |
| Fixed title "Kiorly Pharmacy by Kiorex" | moderate | No (X3) | |
| Hidden 1x1 inputs on customers/catalogue and 13 px checkboxes; 403 on `growth/commission-rate` logged for the cashier (feature gate) | minor / info | No | |

### 8. Lab web, labs.test.kiorly.com
Found 3, fixed 1 (live).

| Issue | Severity | Fixed | Commit |
|---|---|---|---|
| Blank table header cells (catalogue, accessioning) | minor | Yes | kiorly-lab `69e9a36` (my files were committed inside another agent's commit; same change) |
| Worklist checkboxes 13-16 px; patient links and "Order" links 18-21 px high | minor | No | |
| Fixed title; setup-progress line "7 of 10 . 70%" has the percent sign on the wrong side in Arabic (bidi) | moderate / minor | No | |

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

## Founder decisions needed

1. UI font: Jost + IBM Plex Sans Arabic is what ships everywhere; the brief says Plus Jakarta Sans for Kiorex. Keep Jost (the Kiorly kit rule) or move the UI to Plus Jakarta Sans.
2. One Arabic numeral default across products (Western vs Arabic-Indic).
3. Arabic brand spelling `كيوريكس` in the Kiorex platform apps: go ahead with the platform-wide replace (API SEO data, snapshots)?
4. Page-title hook for Ops, Pharmacy, Lab and Clinic (small change, touches shells under active edit).
5. Pricing page (Clinic): fix the dark-mode "Sign in" link contrast and the unlabeled input and select; owned by the Plans work.
