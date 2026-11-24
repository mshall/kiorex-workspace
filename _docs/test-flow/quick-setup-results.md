# Quick setup - results (24 Nov 2026)

Every row below was run against the local stack (Clinic API :3010 / web :5174, Pharmacy :3100 / :5192, Lab :3200 / :5193) from a FRESH self-serve organisation, never a demo tenant. Last full runs: Clinic + Nurse 8/8, Pharmacy 4/4, Lab 4/4 (Playwright), plus node unit/integration tests for the completion rules (Clinic 12 + 4 integration, Pharmacy 6, Lab 6).

Legend. **Opens screen** = click opens the exact screen (deep link, first field focused, bar "Step n of N" with Back to checklist / Skip for now). **Auto-detects** = the step flipped to done on its own when the real data changed, with no reload and no tick. **Animation** = the row carries `data-just-done="true"` (check draws in, soft green tint, progress eases) and the bar showed `data-success="true"`. **Next highlighted** = the following pending step got `data-next="true"` (outline, scrolled to, primary button focused). "via UI" = the action was done in the browser; "via API" = the data change was made through the product API while the step screen was open (the detection and animation are still the real ones); "open only" = completion needs an outside party.

## Clinic (fresh Pro organisation, UI sign-up)

| Step | Opens correct screen | Auto-detects done | Animation | Next highlighted | How completed in the test |
|---|---|---|---|---|---|
| clinic_profile | yes (`/clinics/:id?tab=settings`, licence focused) | yes | yes | yes | UI |
| clinic_logo | yes (logo card) | yes | yes | yes | UI (file upload) |
| working_hours | yes (opening time focused, "Confirm these hours") | yes | yes | yes | UI |
| appointment_types | yes (card focused) | yes | yes | yes | UI (edit fee) |
| doctor_availability | yes (`/profile/availability?entity=:clinicId`) | yes | yes | yes | UI |
| invite_receptionist | yes (`/team`, contact focused) | yes | yes | yes | UI |
| whatsapp_reminders | yes (`/admin?section=organization`, toggle focused) | yes | yes | yes | UI |
| import_patients | yes (`/onboarding/import`) | yes | yes | yes | UI (CSV) |
| first_appointment | yes (`/appointments?book=1`, wizard opens) | yes | yes | yes | wizard opened in UI; booking via API |
| first_check_in | yes (deep link to the open appointment) | yes | yes | yes (next: doctor verification) | UI (cash check-in on the appointment page) |
| doctor_verification | yes (`/profile/verification`) | needs platform review | n/a | n/a | open only |
| kiorex_profile | yes (Kiorex listings card) | needs verified doctor + bookable type | n/a | n/a | open only (completion covered in the completion-state test via DB) |
| connect_kiorex | yes (`/kiorex`; owner/admin only) | status from `kiorexConnect` | n/a | n/a | open only (page owned by the Kiorex-tab agent) |

Also verified for Clinic: persistence after reload and after sign-out/in; skip of an optional step; two clinics (nested rows "1 of 2", own deep link with the clinic id, aggregate, collapse/expand, third clinic reopens "2 of 3"); skip for ONE clinic only; branch manager (disabled primary + "Ask the owner", Connect to Kiorex hidden, API 403, API 400 on manual complete); Lite plan (WhatsApp marked Upgrade, not counted); completion state (celebration, Dismiss remembered per organisation on the server, a new clinic reopens it); Arabic RTL + dark + 360/768/1440/2560 px with no horizontal scroll and no layout shift; keyboard (Enter on the primary button); axe (WCAG 2 A/AA) on the checklist and on the bar.

## Nurse edition (fresh self-serve Nurse organisations, public sign-up API)

| Step | Opens correct screen | Auto-detects done | Animation | Next highlighted | How |
|---|---|---|---|---|---|
| nurse_zones (solo) | yes (`/nurse/onboarding`, zones editor) | yes | yes (`data-just-done`, same page) | yes (exactly one pending row `data-next`) | UI |
| nurse_availability (solo) | yes (availability editor) | yes | state flips in place | not asserted | UI |
| nurse_services / nurse_prices | seeded done at sign-up (service catalogue with prices) | yes | n/a | n/a | n/a |
| nurse_verification | yes (`/profile/verification`) | needs platform review | n/a | n/a | open only |
| nurse_safety_contact (agency) | yes (`/nurse/safety`) | rule unit-tested | n/a | n/a | open only |
| agency vs solo | agency has no zones / availability rows; Clinic-only steps absent in both | n/a | n/a | n/a | UI |

## Pharmacy (fresh pharmacy, `POST /onboarding/signup`)

| Step | Opens correct screen | Auto-detects done | Animation | Next highlighted | How |
|---|---|---|---|---|---|
| branch_licence | yes (`/settings?tab=branches&entity=:id`, licence focused, per-branch form) | yes | yes | yes | UI |
| pharmacist_licence | yes (`/settings?tab=staff`) | yes | yes | yes | UI (staff form, role Pharmacist + licence) |
| drug_prices | yes (`/catalogue`) | yes | yes | yes | API |
| first_stock | yes (`/receiving`, branch context switched) | yes | yes | yes | API |
| first_sale | yes (`/pos`) | yes | yes | yes | API (shift + sale) |
| invite_staff | yes | yes (flipped together with the pharmacist) | n/a | n/a | UI |
| receipt_settings | yes (`/settings?tab=receipt`) | yes | skip tested | n/a | skip (UI), data via API in the completion test |
| connect_kiorex | yes (`/kiorex-connect`, owner only) | status from `kiorexConnect` | n/a | n/a | open only |

Also verified: two branches (CHAIN) with per-branch rows and a third reopening the step, cashier view (disabled + "Ask the owner", Connect hidden, API 403/400), completion state + Dismiss remembered on the server, Arabic RTL + dark + sizes + axe.

## Lab (fresh lab created on the onboarding page)

| Step | Opens correct screen | Auto-detects done | Animation | Next highlighted | How |
|---|---|---|---|---|---|
| lab_licence | yes (`/settings?tab=labs&entity=:id`, licence focused, per-lab form) | yes | yes | yes | UI |
| starter_catalogue | yes (`/settings?tab=general`, button focused) | yes | yes | yes | UI |
| signatory | yes (`/settings?tab=staff`) | yes | yes (bar) | yes | UI (staff form) |
| invite_staff | yes | yes (flipped together with the signatory) | n/a | n/a | UI |
| lab_coverage | yes (per lab) | yes | yes | yes | UI |
| safety_contact | yes (name focused) | yes | yes | yes | UI (fixed: the settings save was rejected by the API, see inventory) |
| first_order | yes (`/orders`) | yes | yes | yes | API |
| first_report | yes (`/release`) | yes | yes (bar), then the celebration card | n/a (last pending step) | UI: bench pipeline as in `golden-flow.spec.ts` (order by API), then Sign report + Release from the checklist; finished state asserted, Dismiss remembered |
| connect_kiorex | yes (`/kiorex-connect`, owner only) | status from intake key | n/a | n/a | open only |

Also verified: two labs (CHAIN) with per-lab rows, third lab reopens, reception view (disabled + "Ask the owner", Connect hidden, API 403/400), Arabic RTL + dark + sizes + axe, keyboard Enter, Skip for now keeps the step pending and moves the highlight, dismissal refused with pending work (400).

## Honest gaps (updated after the crash fix)

1. **Appointment detail crash: fixed.** Root cause: `VisitCollectionFields` rebuilt its imperative handle every render (`useImperativeHandle` without deps) while `QuickCheckInPanel` stores it in state (`ref={setFieldsHandle}`); every commit re-set the state. Handle is now stable (commit 3feeebdc). The Clinic first check-in is now done through the UI, not the database. Regression: `e2e/no-update-depth.spec.ts`; full sweep `e2e/crash-sweep.spec.ts`.
2. Steps that need an outside party (doctor verification, Kiorex approval) are still "open only"; the Lab first report is now done in the browser.
3. Pharmacy prices/stock/sale, Lab first order and the Clinic booking are made through the API (large flows with their own tests); the screens opened and the checklist reacted without a reload.
4. Lab: the finished-state card is exercised in the browser (first-report test). The bench pipeline before the release step is driven through the same UI steps as the golden flow; the order itself is created by API.
5. Nurse: the checklist card now sits on the Nurse home pages (Today and Dispatch) and links to `/nurse/onboarding`. Nurse sign-up is still only reachable through the public API (the Clinic sign-up page has no Nurse switch).
6. Clinic Lite plan marks only WhatsApp as an upgrade; Pharmacy and Lab have no plan-gated steps today. Arabic strings are in `quick-setup-arabic-review.md` for a native review. Screenshots and the design critique: `quick-setup/` and `quick-setup-design-review.md`.
7. The staff app (Kiorly mobile) has no quick-setup list; not in scope here.
8. Another agent's `refreshSessionFromServer` / design changes can regress the owner-role handling; covered by the Clinic journey.
9. Public sign-up OTP is throttled per IP per hour in memory; repeated quick-setup runs exhaust it ("Too many requests from this network") until the Clinic API restarts.
