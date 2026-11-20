# UI review (Q9, 20 Nov 2026)

Method: built-in browser against the live local stack, real logins from `TEST_DATA.md` (the browser profile was already signed in as the e2e patient `+201000000001`).
Honest limits: the browser pane was not displayed for most of the session, so screenshots timed out after the first one; screens were reviewed through page text /
accessibility tree (which still catches empty, untranslated and broken states) plus one visual check (patient home, Arabic RTL, dark). The Kiorly Clinic/Nurse web
(`:5174`) navigation was refused by the browser tool, so it was NOT walked by hand: it is covered by its Playwright specs
(`clinics-management/apps/web/e2e/*`, incl. the nurse solo/agency/safety/MAR/lab specs, RTL + axe). Ops console (`:5181`) showed "No access" for the signed-in patient
(correct role guard); the ops pages are covered by `kiorex-platform/apps/ops` unit tests + the ops e2e specs. Role-by-role manual walk with screenshots is still open.

| Area | Screen | Finding | Severity | Status |
|---|---|---|---|---|
| Patient web | Home (AR, dark, RTL) | Renders correctly, nav mirrored, hero + specialty chips | - | OK |
| Patient web | Search, doctor cards | Home-visit coverage showed raw district slugs ("mansoura", "nasr-city") in Arabic | medium (untranslated) | FIXED `apps/web/src/lib/districts.ts` used in DoctorCard + DoctorProfile |
| Patient web | Search (home nursing) | Same slugs in the HOME district filter options and care-plan list | medium | FIXED (ResultsPage, CarePlansPage) |
| Patient web | Records (vault) | System-created records were titled in English ("Lab report", "Visit summary", "Prescription") under an Arabic UI | medium | FIXED: localized kind label (`recordTitle`) |
| Patient web | Records | Dozens of identical "Lab report" rows | low | Data artefact of repeated e2e runs (every lab golden path releases a report for the e2e patient); not a UI defect |
| Patient web | Pharmacy / Lab / Services | "Awaiting approval" cards after the e2e run revoked the dev gate evidence; copy is clear, existing data untouched | - | Expected (re-run `scripts/seed-all.sh` restores the dev gate rows) |
| Patient web | /login | 404 page ("page not found" + home link) | low | Not a route (sign-in is the Passport redirect); the 404 is well formed |
| Patient web | My bookings / Account / Waitlist / Care plans | Loaded, AR copy complete, account has Addresses / Care plans / Family / Consents / Devices tabs; empty states present | - | OK |
| Mobile (Expo web) | Sign-in | Loads; English copy, emergency number shown | - | OK (home flows covered by 111 jest tests) |
| Pharmacy | Dashboard | KPIs render (EN) | - | OK |
| Lab | Dashboard | KPIs render (AR, RTL) | - | OK |
| Passport | /account | Sign-in landing in Arabic | - | OK |
| Ops | `/` | "No access" for a patient token | - | OK (role guard) |
| Kiorly Clinic / Nurse | all | Not walked (see limits) | - | OPEN: needs a displayed pane |
| All | Dark mode / RTL on key pages | Verified on patient home (visual) and by `rtl.spec.ts` (Playwright) | - | OK |

Larger items to schedule (not done here): mobile app push registration UI (API exists: `POST /me/devices`); Passport UI list of sent invitations with a revoke
button (API exists: `GET /api/orgs/:id/invitations`); a per-visit cash screen for home visits.

## Q11 UI/UX pass: Kiorex patient web + Ops console (20 Nov 2026)

Screenshots (before/after, AR+EN, light+dark; 1280x860 / ops 1360x860, plus 390 px mobile home): `_docs/ui-review/kiorex-web/` and `_docs/ui-review/kiorex-ops/`
(`before-*` = pre-Q11, `after-*` = final). Regenerate with `TAG=after npx playwright test e2e/ui-review/shots` in each app (not an assertion suite).
Key pairs: web home, search, doctor profile, records, services, account, landing (signed out), not-found, mobile home; ops flags, orders, providers, finance, safety, held deposits.

| Area | Change | Status |
|---|---|---|
| Brand | Old indigo-X logo replaced by the founder artwork (lockup / mark / wordmark, colour + inverse for dark) via the vendored `_brand` kit; favicon, apple-touch, PWA icons, OG tags | DONE |
| Tokens | CSS vars, shadcn HSL bridge and Tailwind preset generated from `_brand/tokens.json`; designed dark theme (not inverted); Arabic line-height 1.7, no tracking on Arabic headings | DONE |
| Primitives | `PageHeader`, `StatCard`, `StatusChip`, `FormField`, `Stepper`, `StateArt` (chevron+pulse illustration) in `src/components/kit.tsx`; 13 web pages migrated to `PageHeader`; ops `PageHeader`/`StatTile`/`DataTable` rebuilt on them | DONE |
| States | Empty / error states use brand illustration (no stock art); success variant used on booking confirmation | DONE |
| Booking flow | Stepper on checkout (Choose time > Confirm > Done), confident confirmation moment on the appointment page after a booking (`booking-confirmed`) | DONE |
| Motion | route enter (`kx-page`), button press feedback, card hover lift, eased 150-250 ms, pulse draw-in; all reduced-motion safe | DONE |
| Forms | native `select` restyled (chevron, RTL-mirrored), inputs rounded/hover states, market select no longer clips | DONE |
| Ops tables | sticky header, calm hairline rows, vertical-centre cells, sticky action column in flags (actions were off-screen), compact `sm` buttons (36 px) for dense consoles, dates no longer wrap or show a stray leading comma in Arabic, scroll regions keyboard-focusable | DONE |
| Badges | `secondary`/`destructive` are now soft tints (calmer status columns); coral still never used for errors | DONE |
| A11y | axe (wcag2a/aa, 21aa) on 8 web + 7 ops screens in AR+EN x light+dark: 0 serious/critical. Fixed `/account` dl and `/pharmacy` radiogroup list structure, dark nav-active contrast, scrollable-region focus | DONE |
| Not done | Doctor-profile/booking-slot visual redesign beyond tokens, bottom-sheet slot picker on mobile web, illustrated per-specialty icons | OPEN (P2) |

Test status: web vitest 112/112, ops vitest 32/32, tsc + eslint clean in both. Playwright (real stack): ops console/flag-toggle/pages-smoke pass; `console.spec.ts:46` (gate evidence form) and `home/home.spec.ts` safety console were already failing before this work (data-dependent: launch-gate rows revoked by earlier e2e runs; the `home/` and `verticals/` specs also need their own :4001 / isolated stacks); web `new-screens.spec.ts:27` expects locked services which the current data does not have. Re-run `scripts/seed-all.sh` / the isolated configs to exercise them.

## Q11 mobile (Expo) and Passport (agent b)
Screenshots: `_docs/ui-review/kiorex-mobile/` (before-* from the live 8081 app with Hoda `+201000001001`; after-* from the Expo web build in offline-mock mode on :8082, 390x844, light/EN and dark/AR) and `_docs/ui-review/passport/` (before-*/after-* on :4400 with demo personas; `idp-*` are the server-rendered sign-in pages from a fresh build).

| Area | Change | Status |
|---|---|---|
| Brand | `_brand` theme/logo/icons vendored in `apps/mobile/src/brand`; old X logo + hex palette replaced; Passport shows the PASSPORT lockup (light/inverse by theme); self-hosted Jost/Plex fonts | DONE |
| Expo UX | Large titles that collapse to a hairline bar, spring bottom sheet with grabber/drag-to-dismiss, press-scale + haptics, toasts, pulse-line loader, brand empty/error illustrations, animated pulse splash (reduced-motion aware), dark-mode logo | DONE |
| Push (Q9 follow-up) | Account > Notifications switch registers/removes this device via `/me/devices` (native token; web = opaque install id + browser permission); refresh on sign-in | DONE |
| Passport | Calm hero sign-in, sticky blurred top bar, new tokens, designed dark mode, coral focus ring, IdP pages restyled | DONE |
| Passport (Q9 follow-up) | Sent organisation invitations list in Manage members (status chip, masked phone, expiry) with confirmed revoke | DONE |
| Tests | mobile jest 115/115 + tsc; passport vitest 185/185, tsc, Playwright 19/19 (axe AR/EN, light/dark) | GREEN |
| Note | Brand `tokens.css` now needs `data-theme="auto"` on `<html>` for OS dark mode | applied in Passport |

## Q11 (agent c): Kiorly Clinic / Nurse, Pharmacy, Lab, docs portal
Walked with real demo logins via Playwright screenshots (`apps/web/scripts/ui-shots.mjs before|after`, EN light/dark + AR light) into `_docs/ui-review/{kiorly-clinic,kiorly-nurse,pharmacy,lab}/`. This closes the Q9 "Kiorly Clinic / Nurse not walked" item.
| App | Finding | Status |
|---|---|---|
| Lab | Sidebar/navigation invisible on desktop in Arabic (RTL `translate-x-full` beat `lg:translate-x-0`) | FIXED (`max-lg:` variants) |
| Pharmacy | axe: success chip contrast, decorative SVG role=img without name | FIXED (darker success/warning tokens, `Pulse` is aria-hidden); axe EN+AR green |
| Clinic/Nurse | axe: unlabelled front-desk clinic select, icon-only header buttons on phones, scrollable table not focusable, rose text 3.7:1 in dark | FIXED; `scripts/axe-check.mjs` CLEAN on 9 pages, EN/AR, light/dark |
| Clinic | Appointment statuses used saturated orange/blue/violet fills | FIXED: soft semantic chips (coral never means error) |
| Clinic | Legal banner took ~100 px on phones | FIXED: documents collapse on mobile |
| All | Old blue/teal Inter palette + old X logos | Replaced by Kiorly by Kiorex tokens, lockup, Jost / IBM Plex Sans Arabic (self-hosted) |
Known: pre-existing e2e failures unrelated to UI (clinic `theme.spec`/`fs02` fail identically on the base commit; pharmacy `golden-flow` needs the dev Kiorex client key, HMAC "unknown client key").

### Q11 P2: patient web signature screens (20 Nov 2026)

Before/after in `_docs/ui-review/kiorex-web/` (`p2-before-*`, `p2-after-*`; desktop 1280 and 390 px, AR+EN, light+dark; regenerate with `TAG=p2-after FLOW=1 npx playwright test e2e/ui-review/p2-shots.spec.ts`).

| Screen | Change | Status |
|---|---|---|
| Landing / Home | Hero with instant search (query, specialty, area, date), brand-mark art with proof chips, proof band, how-it-works with a pulse line drawing between steps; signed-in home gets greeting hero, appointment ticket, quick access, recent doctors | DONE |
| Search | Rich doctor cards (seal, rating, fee, deposit/home chips, next slots as tappable chips labelled Today/Tomorrow), sticky toolbar (count, list/map toggle, sort, filters), shimmer skeletons shaped like the cards; map view is an honest "coming soon" placeholder with per-area counts | DONE |
| Doctor profile | Editorial header, credentials/verification, clinic info, review summary with distribution bars, policy (derived from the policy numbers when the clinic text is empty) before booking; slot picker redesigned (next available, week strip, time-of-day groups, timezone line); phones get a bottom bar + bottom sheet | DONE |
| Checkout | Stepper, hold countdown ring, patient card, payment summary with deposit transparency (fee at clinic, deposit after confirming, due now), consent rows, sticky confirm on phones | DONE |
| Confirmation | Animated check + pulse draw, add-to-calendar, directions, call, what-to-bring (generic list). Fixed a race that dropped the `justBooked` state, so the moment now shows reliably | DONE |
| Appointment / lists | Date block, connected timeline with the current step pulsing and upcoming steps outlined; vault grouped by month with kind-tinted tiles; services/pharmacy/lab cards share the interactive-card finish | DONE |
| Fixes | Header overflowed at 390 px (language label now icon-only on phones); route changes scroll to top | DONE |
| Not done | Interactive map; per-specialty illustrations; deeper redesign of pharmacy cart / lab booking forms and the home-visit tracker beyond shared card finish; copy for consents/policy/what-to-bring remains draft pending legal/CMO | OPEN |

## Q11 Lab console: remaining pages + visual review of the collector/QC/critical work (20 Nov 2026)
Before/after in `_docs/ui-review/lab/` (`q11e-before-*` / `q11e-after-*`, plus `q11e-a1..a4` iteration shots; desktop 1440 and 390 px, EN/AR, light/dark; regenerate with `node apps/web/scripts/ui-shots.mjs <tag>`, `SHOTS_ROLE=phleb ... "/phleb@2026-11-22"` for collector stops).

| Screen | Change | Status |
|---|---|---|
| Worklist | Queue filters with counts (needs action / to enter / to confirm / to validate / all), STAT-first ordering with STAT chip + accent, per-specimen progress, dense analyte rows, Enter-to-submit and focus moves to the next empty value, `/` focuses search, select-ready + bulk technical validation bar | DONE |
| Orders list | Search, status queue chips, source filter, server paging (25), STAT chip/row accent, test chips (+n), relative age, mobile cards, skeletons | DONE |
| Order detail | Progress timeline (ordered to released), patient meta, results table with abnormal count, report cards with in-page PDF preview, invoice VAT line, two-column layout | DONE |
| Accessioning | Scan-first hero, status queue chips with counts, search, STAT ordering, specimen dialog with real label preview (Code 128) + reprint count + keyboard Enter action | DONE |
| Release | Sign-off confirmation dialog (results summary, abnormal/critical counts, signatory), release dialog with side-by-side PDF preview + consent-gated channels | DONE (golden-flow spec updated for the new confirm step) |
| Reports PDF | Arabic patient/lab/test names render (IBM Plex Sans Arabic embedded, shaped, RTL word order); unit test; NH-LB-026 now partly done | DONE (full Arabic template still NEEDS_HUMAN) |
| Billing | Outstanding / paid / VAT stat cards, status chips + search, VAT line per invoice and in the payment dialog, mobile cards | DONE |
| Settings | RBAC matrix (grouped, sticky headers, check marks with sr text), staff avatars | DONE |
| Login / onboarding / patient link | Brand panel + role picker cards; onboarding sections with inline validation; patient result link with step indicator, OTP field, resend timer | DONE |
| Review: collector PWA | Arabic bidi bugs (phone number, address and time range rendered reversed) fixed with `bdi`; 40 px tap targets for address/phone; header link no longer wraps | FIXED |
| Review: QC chart | RTL axis labels collided with the series (SVG text-anchor flips under rtl) and the chart was unreadable at 390 px: now forced ltr geometry + horizontally scrollable region | FIXED |
| Review: critical page | Table clipped at 390 px: stacked alert cards with a 48 px acknowledge button | FIXED |
| Shell / dialogs | Modal focus trap + restore, body scroll lock, motion; logout is an icon on phones; destructive button contrast in dark | DONE |
axe (`node scripts/axe-check.mjs`): every console page + dialogs + signed-out pages, AR/EN x light/dark at 1280 and 390 px: CLEAN. Lab golden-flow Playwright (ports 3290/5291) green; web typecheck/lint/unit green.

## Q11e: Kiorly Pharmacy completion pass (20 Nov 2026)
Shots: `_docs/ui-review/pharmacy/q11e-<view>-<en|ar>-<light|dark>-<desktop|phone>.png` (1440 px and 390 px; regenerate with `node apps/web/scripts/ui-shots.mjs q11e [viewFilter]`). "Before" = the earlier `after-*` / `before-*` pairs in the same folder. Reviewed with the built-in browser (console, DOM metrics, 390 px overflow probe that found the receiving grid blow-out) plus high-resolution Playwright captures for visual checks.

| Screen | Change | Status |
|---|---|---|
| Catalogue | Rich rows (name, strength/form/pack, ingredient, flag chips with icons), search + segmented filter, select-page/selection bar, "showing x-y of n", price drawer = price hero + trend + price book + substitution group (best value, stock, delta %, expiry chip), phone layout collapses columns | DONE |
| Receiving | Two-column layout, scan field with icon, product search popover, per-line expiry chips and cold-chain badges, running totals + invoice variance, completeness chip, 390 px grid overflow fixed | DONE |
| Purchasing | Suppliers with credit-usage meter and over-limit state, PO status track + received progress, reorder bulk action, recall empty/danger states, tab icons + arrow-key navigation | DONE |
| Kiorex orders | KPI strip + view filter (New / In progress / Closed, in the URL), order card with state timeline, draining SLA bar, accept dialog with per-line quantities (partial flow), reject dialog with quick reasons, show-more | DONE |
| Reports | KPI tiles + hand-drawn SVG/CSS charts in brand ramps (daily sales columns, top sellers, stock retail vs cost, expiry stack, supplier balance vs credit limit), formatted/right-aligned tables, skeletons | DONE |
| Settings | Tab icons, avatar staff table, new Roles and access matrix (read-only mirror of the API role map), switches for marketplace opt-in, unsaved-changes bar | DONE |
| Login / Onboarding | Split brand panel (indigo-950 + pulse) and form; onboarding as a stepper with per-step state | DONE |
| Previous pages | Dashboard quick actions + calmer attention banners; POS pay dialog (due tile, amount/quick-cash layout, focus lands on the amount); Rx detail totals and numeric alignment; inventory numeric columns; dialogs become bottom sheets on phones; nowrap money/dates | DONE |
| A11y | axe (wcag2a/aa, 21aa) clean on all 10 routes + inventory tabs, EN/AR x light/dark (`e2e/a11y-rtl.spec.ts` 5/5). Fixed: login contrast flagged mid page-enter animation (animation now scoped to `#main`) | DONE |
Not done: bulk price import UI (API exists), per-line receiving PO matching, chart tooltips beyond native titles.

### Q11 P3: service flows, states and specialty icons (patient web, 20 Nov 2026)

Before/after in `_docs/ui-review/kiorex-web/` (`p3-before-*`, `p3-after-*`; AR+EN, light+dark, 1280 and 390 px; regenerate with `TAG=p3-after npx playwright test e2e/ui-review/p3-shots.spec.ts`; signs in as Hoda and applies the DEV fixtures in `e2e/fixtures.ts` so every order / lab / video state is visible). The `p3-before-*` set was captured from the live stack before the edits (the EN runs of that batch overlapped the first edits, treat the AR set as the reference).
Reviewed in the built-in browser (landing how-it-works pulse, 390 px, AR dark) and through Playwright screenshots for the full matrix.

| Area | Change | Status |
|---|---|---|
| Primitives | `StatusBanner`, `SegmentedControl`, `Row` (receipt rows), `IconTile`, `Timeline` (live status) in `kit.tsx`; `OrderTracker` (`ProgressSteps`): horizontal / vertical, pulsing current step, terminal failure step | DONE |
| Pharmacy | 1-2-3 flow, pharmacy cards with pickup / delivery fee / prep chips, medicine cards with rx + stock + in-cart chips, pickup/delivery segmented control, receipt rows; phones get a bottom cart bar + bottom sheet | DONE |
| Orders | Order list rows, hero header, tracker, banners for rejected (auto-refund note), cancelled/refunded, partial review, ready; pay panel | DONE |
| Lab | Test cards (selectable, price, sample, prep), "show more" paging, collection segmented control, day strip + time chips, mobile summary bar + sheet; booking detail with result-ready banner / rejected / tracker | DONE |
| Video | Session cards with date block, waiting-room countdown + prep tips, designed mock room (brand mark, pulse, self-view tile, round controls, live timer), provider cards with specialty tiles | DONE |
| Home visit | Timeline tracker, assignee card, ETA banner, safety card with emergency action, family-share rows, address cards, public family link page | DONE |
| Waitlist / care plans / account | Live offer highlighted, expired offers collapsed, care-plan progress bars, account profile card, shortcut cards, localized relationships (son/daughter/...), consent rows with on/off chips, device icons | DONE |
| States | 404 with brand art + actions, offline banner + offline state (no more generic error when the browser is offline), error boundary framed, empty states use a tinted icon tile | DONE |
| Motion | How-it-works pulse line draws itself on scroll into view (desktop horizontal, phone vertical, mirrored in RTL), reduced-motion safe | DONE |
| Icons | `SpecialtyIcon` set (21 specialties, 24 px grid, 1.75 stroke, indigo body + ocean detail + one coral accent) in chips and doctor / video-provider cards | DONE |
| A11y | `e2e/ui-review/axe.spec.ts` now covers 15 pages (incl. 404) AR+EN x light+dark, order / lab / video / home-visit states, checkout, confirmation, the mobile cart / lab / booking sheets and the offline banner: 0 serious/critical | DONE |
| Tests | vitest 112/112, tsc + eslint (src, e2e) clean; Playwright new-screens fixed (awaiting-gate asserted through a DEV fixture instead of seed state) | GREEN |
Not done: interactive map, saved-address quick pick inside pharmacy/lab delivery forms, copy for consents/what-to-bring (draft pending legal/CMO). Known flaky, unrelated: `vault.spec.ts` follow-up reminder races on the list count (passes alone).


## Q11d: Kiorly Clinic + Nurse web, page-by-page redesign (round 2, 20 Nov 2026)
Screenshots: `_docs/ui-review/kiorly-clinic/` and `/kiorly-nurse/` (`r2-before-*` = start of round 2 (EN light, clinic); `after-*` from Q11c is the previous state for the others; `r2-after-*` = final, EN light/dark + AR light/dark). Regenerate with `TAG=r2-after node apps/web/scripts/ui-shots.mjs` (filters `ONLY`, `MODES`, `ROUTE`).
| Area | Change | Status |
|---|---|---|
| Shell | Quiet icon-only toolbar (help, density, theme, language, sign out) with titles, user chip with initial + role, slim one-line legal banner (documents collapse), compact one-row reporting period bar, single-row mobile header with 44 px targets | DONE |
| Power-user | `?` shortcut sheet, `g` + `d/p/a/b/e/r/k` navigation, `Shift+D` compact density (persisted), `N` quick-book on Appointments, patient search Enter opens first hit, keycaps on the front-desk board | DONE |
| Dashboard | PageHeader + quick actions, live "Today" strip (status-toned StatCards + flow bar), period KPIs and money cards with skeletons, onboarding card trimmed to the next 4 steps | DONE |
| Appointments | Status chips with dots, patient name over MRN, date over time, skeleton rows, brand soft event chips; Calendar gains Week and Day time-grids (overlap packing, now-line, sticky day header, click an empty half-hour to quick-book) | DONE |
| Front-desk board | PageHeader, tool pills, stat strip (waiting / in exam / free rooms / longest wait), ticket tiles, optimistic "Call", wait-time warning colour, room tiles | DONE |
| Patient 360 | Allergies as danger chips, vitals tiles, balance emphasis, formatted upcoming visits, skeleton; header card slimmer (avatar, age) | DONE |
| Encounter | Vitals grid with unit suffixes and proper labels instead of floating icons | DONE |
| Reports / Kiorex | Charts in brand ramps (`--kx-chart-*`, dark set), hairline grid, calm tooltips, tabular numerals, reduced-motion safe | DONE |
| Tables | Compact filter row (translated placeholder + accessible names), hover/sticky, density-aware rows | DONE |
| Nurse Today | Field-first cards: big time, status chip, next-up highlight, full-width primary action (On my way / Arrived / Finished), Navigate + Call tiles, progress, optimistic state change with rollback | DONE |
| RTL | Radix Tabs were hard-coded `dir="ltr"` (Arabic tab lists and panels did not mirror; the calendar rendered LTR in AR) - fixed in `ui/tabs.tsx`; calendar/sign-out chevrons mirror; date/number cells stay LTR | DONE |
| A11y | `lib/a11y-autofix.ts` wires legacy Labels, decorative chart shapes hidden; nested-interactive expense rows, unnamed selects/inputs/progressbars, listbox structure, 3 contrast failures fixed; `scripts/axe-check.mjs` now covers 20+ pages (incl. detail pages and calendar views) x EN/AR x light/dark | DONE |
| Not done | Bespoke redesign of: prescriptions/orders dialogs, invoices/payment dialogs, admin consoles, HR, platform tabs, family/lab nurse pages (they inherit the new tokens, cards, tables, chips) | OPEN |

Tests: web typecheck, eslint (0 errors), unit 43/43. Playwright: nurse-open 5/5 and nurse-gated 2/2 (throw-away stacks on `kiorly_test`), clinics golden flow 3 passed / 1 skipped, theme.spec 11/11 and fs02 4/4 (both were failing before: `theme.spec` because the `login` helper wiped the per-tab theme and the material-light session theme is deliberately reset on reload; `fs02` because the API helper defaulted to :3000 while the web proxies to :3010 - helper now follows `PLAYWRIGHT_BASE_URL`). Other chromium specs failing on the `kiorly_test` stack (ff05, hr-create-employee, on07/on08, flows-integrity, patient-manage-rbac, ux04, encounter-create/delete) fail identically on the commit before this work (missing fixtures in that DB), not caused by it.

## Q11f: Kiorly Clinic + Nurse web, round 3 (surfaces that only inherited tokens; 20 Nov 2026)
Screenshots: `_docs/ui-review/kiorly-clinic/` and `/kiorly-nurse/` (`r3-before-*` = start of round 3, EN light; `r3-after-*` = final, EN light/dark + AR light/dark, desktop 1440 for the clinic, 390 px for Nurse). Regenerate with `TAG=r3-after MODES=en-light,en-dark,ar-light,ar-dark VIEWS=desk node apps/web/scripts/ui-shots-r3.mjs` (filters `ONLY=admin,soap,...`).
| Area | Change | Status |
|---|---|---|
| Dialogs (all ~230) | One `DialogContent`: bottom sheet below `sm` (drag handle, safe-area padding), calm open/close motion (reduced-motion safe), larger close target; `DialogFooter` is sticky and flush with the bottom edge; migrated the create-encounter, register/edit-patient, generate-invoice and assign-nurse dialogs to it | DONE |
| Forms | One native `<select>` look (chevron, mirrors in RTL), 18 px brand-accent checkboxes/radios, dark `color-scheme` for native pickers | DONE |
| Pick lists in dialogs | **Real bug fixed**: `SearchablePickList` options are portalled to `<body>`, which a modal Radix dialog makes `pointer-events:none`, so options were unclickable in every dialog (create encounter, HR, ...); also the deferred mobile focus no longer re-seeds/clears what was just typed | DONE |
| Admin / HR | `SectionNav` underline tabs (scrolls on phones, `aria-current`) replace pill buttons; `PageHeader` titles; duplicate "Show Tree" removed | DONE |
| Platform admin | Header, KPI `StatCard`s with skeletons and a `NavLink` section nav for all 11 tabs (previously only reachable from the sidebar) | DONE |
| Invoices / cash close | Invoice dialog: patient chip, line cards, live total, sticky footer; Cash drawer: `PageHeader` + status chip, 56 px count inputs, `StatCard` close result with variance tone | DONE |
| Encounter / SOAP | Vitals in one 7-up grid (BP labels no longer truncated), 44 px inputs; create dialog has a sticky Create/Cancel footer | DONE |
| Onboarding / signup | Signup: lockup, 5-segment progress, proper label rhythm; onboarding checklist: state icons (done/skipped/todo), 48 px rows | DONE |
| Kiorex tab | Empty month shows the brand empty state instead of a blank chart grid | DONE |
| Nurse safety | 123 / 122 tiles (64 px), check-in timer phases as callouts (before / grace / prompt / alert) with 56 px "I'm safe", SOS and Leave-unsafe actions, success/danger callouts for SOS, abort and missing safety contact | DONE |
| Nurse MAR | Allergy block is a danger/ok callout (unknown allergy state is danger), per-line 48 px "Administer", refusals as `kx-callout` blocks, given-list timeline | DONE |
| Nurse visit record | 56 px checklist rows, big vitals inputs, flagged values as chips, sticky action bar (Save / Sign), critical-value banner with a 56 px "Call 123" | DONE |
| Nurse lab / care plans / dispatch | Sample progress stepper (collected, handed over, received, result), refusals as callouts, care-plan progress bars, dispatch rows with assignment chip + 48 px assign, roster avatars | DONE |
| Nurse chrome | Mark-only logo on phones (the lockup was truncated to "KIORI"), 2-line legal banner, patient picker rows with avatars | DONE |
| A11y | `axe-check.mjs` now also covers HR, admin org tab, patient/encounter/employee dialogs, 10 platform tabs, signup/login/forgot, all Nurse pages incl. detail pages (EN+AR, light+dark); fixed dark `bg-destructive` contrast (3.78 to 5.6), the unlabeled referral link input | DONE |
| Not done | Bespoke redesign of the prescription/order composer (it inherits the new sheet/field system), payroll and the 40-odd remaining admin panels internals (they inherit SectionNav, selects, dialogs) | OPEN |

Playwright triage of the 15 specs that failed identically before this work on `kiorly_test` (none was deleted or skipped; throw-away stack: API 3011 / web 5185 with `connection_limit=2`):
| Spec | Cause | Fix |
|---|---|---|
| ff05 (x3) | stale: org flags moved under Admin > "Organization & settings"; `platform@kiorly.com` does not exist (seed has `superadmin@kiorly.com`) | test |
| flows-integrity (x2) | stale: 3 buttons match /organization/; create-employee moved to HR (group admin) / staff onboarding (clinic admin); clinic picker is no longer the first combobox (role select was added) | test |
| hr-create-employee (x2) | stale: role `<select>` is the first combobox; HR officer is clinic-scoped by grant (6th October clinic), not "Capital" | test |
| on07, on08 (x3) | stale: Kiorex Passport button added a second "Sign in" button (strict-mode) | test |
| patient-manage-rbac | race: list still mounted a beat after the URL changed | test |
| ux04 | stale: print-settings card is under Organization & settings (the thermal printer itself needs hardware, see below) | test |
| encounter-create | **app bug**: pick-list options unclickable inside modal dialogs (`pointer-events:none`) | app |
| encounter-delete-rbac (x2) | stale: token lives in `localStorage["cms-auth"]` not cookies; CALL_CENTER role ceiling has no Encounters tab (403 is correct) | test |
| fs04, signup-ar | fixed external reference collided on rerun (unique tenant/source/ref; the API answers 500 instead of 409, flagged for the API owner); signup now requires the legal checkboxes | test |
| qa01 (AR) and others in a full run | login rate limit (20/min per email) | helpers honour `Retry-After` |
Blocked on hardware/humans: `ux04-thermal-print` only asserts the settings card; actual ESC/POS output on a receipt printer, the Z-report thermal print and real WhatsApp/OTP delivery cannot be verified in CI.

## Q11g: prescription composer + payroll surfaces (20 Nov 2026)
| Area | Change | Status |
|---|---|---|
| Prescription composer (encounter + draft panel) | Rainbow tab colours replaced by one segmented mode switch in brand tokens; medication lines as cards (icon, drug, dosage/frequency chips, unverified chip, 44 px remove with accessible name); brand dashed upload target; file rows; generate bar + preview card (download/print); add-medication form on a quiet band; `kx-callout` hints; signed-Rx share actions as a success callout. Shared kit: `clinics-management/apps/web/src/features/prescriptions/composer-kit.tsx` | DONE |
| Payroll / compensation | HR summary KPIs as `StatCard`s with skeletons (headcount, monthly payroll per currency in LTR numerals, pending leave tone); employee detail: one grouped "HR & payroll" fieldset (contract, salary, currency) + prominent `CompensationSummary`; admin user edit + create-employee use the same fieldset; profile salary fact emphasised. Kit: `features/hr/compensation-kit.tsx` | DONE |
| Verification | tsc, eslint (0 errors), web unit 43/43; `scripts/axe-check.mjs` gained the employee detail route | see FINAL report |
| Not done | Screenshots for these two surfaces (not regenerated this round); the 40-odd other admin panels still only inherit tokens | OPEN |
