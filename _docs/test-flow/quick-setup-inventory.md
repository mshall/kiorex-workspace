# Quick setup ("Welcome - quick setup") - full inventory

Written before the fix and kept up to date with it. Source of truth in code is listed per product. Every step below is **detected from real data on the server**; none is a manual tick (`manual: false` on every step; `PATCH .../steps/:key` with `action: "complete"` answers 400). The only stored state is an explicit **skip** of an optional step (per clinic / branch / lab for per-entity steps) and the **dismissal** of the finished checklist (per organisation).

## What existed before (the founder's report)

| Product | Before | Gap |
|---|---|---|
| Kiorly Clinic | `apps/api/src/onboarding` (12 steps, tenant-level, based on the first clinic only) and the dashboard card `features/dashboard/onboarding-checklist-card.tsx`. Each row was a plain `<Link>` to a page (`/admin`, `/clinics`, `/profile`...) | No deep link to the field, no bar, no focus, no animation, completion sticky and never re-evaluated after the action, only the first clinic counted, "Skip" call rejected by the API (DTO had no validators: `property action should not exist`), several destinations were dead ends (see bugs below) |
| Kiorly Nurse (edition of Clinic) | Own page `/nurse/onboarding` (6 steps, `GET /nurse/onboarding`), not on any dashboard | Separate model; nothing in common with the Clinic checklist |
| Kiorly Pharmacy | Only the one-time first-run page `/onboarding` (branch licence, catalogue count, safety text, "Finish setup"). No checklist anywhere | No quick setup at all |
| Kiorly Lab | Only the sign-up page `/onboarding`. No checklist anywhere | No quick setup at all |

## Clinic (`clinics-management`, branch `kiorex`) - `apps/api/src/onboarding/onboarding-plan.ts`

Scope `clinic` = listed per clinic (nested rows, own state, deep link carrying the clinic id). `req` = counts toward the required progress and cannot be skipped.

| # | Step key | Scope | req | Who can (owner always) | Completion rule (server, live) | Deep link (screen / first field) |
|---|---|---|---|---|---|---|
| 1 | `clinic_profile` | clinic | yes | group admin, clinic admin, branch manager | licence number is not the sign-up placeholder | `/clinics/:id?tab=settings` - licence field focused |
| 2 | `clinic_logo` | clinic | no | admins | `logoUrl` or an uploaded logo exists | clinic settings - logo card (new) upload input |
| 3 | `working_hours` | clinic | yes | admins | hours saved explicitly (`providerSettings.setupHoursConfirmedAt`, written by the clinic PATCH) or opening/closing differ from defaults | clinic settings - opening time focused; "Confirm these hours" keeps the defaults |
| 4 | `appointment_types` | clinic | yes | admins | a type of the clinic (or tenant-wide) was edited, or added after the clinic was created | clinic settings - appointment-types card |
| 5 | `doctor_availability` | clinic | yes | admins, physician | an availability template of the clinic was saved after sign-up seeding | `/profile/availability?entity=:clinicId` (new screen) |
| 6 | `invite_receptionist` | org | no | admins | a receptionist/call-centre user exists or a non-revoked invitation exists | `/team` - contact field focused |
| 7 | `whatsapp_reminders` | org | no | group admin / owner; **plan: Pro+** (Lite: shown as "Upgrade", excluded from progress) | tenant WhatsApp reminders enabled | `/admin?section=organization` - toggle focused |
| 8 | `import_patients` | org | no | front desk + admins | at least one non-sample patient | `/onboarding/import` - first entity button |
| 9 | `first_appointment` | org | yes | front desk + admins | at least one non-sample appointment | `/appointments?book=1` - booking wizard opens |
| 10 | `first_check_in` | org | yes | front desk + admins | at least one non-sample appointment checked in | `/appointments/:id` of the earliest open appointment (check-in button focused); falls back to `/front-desk/board` |
| 11 | `doctor_verification` | org | no | admins, physician | a physician is VERIFIED (platform review) | `/profile/verification` |
| 12 | `kiorex_profile` | clinic | no | admins | bookable Kiorex type exists and a physician is verified | clinic settings - Kiorex listings card |
| 13 | `connect_kiorex` | org | no | **owner / group admin / clinic admin only (hidden for everyone else)** | `Tenant.providerSettings.kiorexConnect.status` is requested/in review/approved/paused | `/kiorex` |

Nurse edition (same engine, `edition = NURSE`): `clinic_profile` (practice/agency, per entity), `clinic_logo`, `invite_receptionist`, `import_patients`, `first_appointment`, `connect_kiorex` plus `nurse_verification`, `nurse_zones` (solo), `nurse_services`, `nurse_prices`, `nurse_availability` (solo), `nurse_safety_contact`. Clinic-only steps (`working_hours`, `appointment_types`, `first_check_in`, ...) are absent. Agencies have no personal-readiness steps (zones / availability). Rendered on `/nurse/onboarding` (Nurse landing is the visit/dispatch screens, not the dashboard).

## Pharmacy (`kiorly-pharmacy`) - `apps/api/src/modules/setup/setup-plan.ts` (new)

| # | Step key | Scope | req | Permission (roles shown as "who can") | Completion rule | Deep link |
|---|---|---|---|---|---|---|
| 1 | `branch_licence` | branch | yes | `settings.write` (owner) | licence number and address set | `/settings?tab=branches&entity=:branchId` - licence field focused (new edit form) |
| 2 | `pharmacist_licence` | org | yes | `staff.manage` | an active OWNER/PHARMACIST has a syndicate licence | `/settings?tab=staff` |
| 3 | `drug_prices` | org | yes | `price.write` | the organisation has price-book entries (the global catalogue is pre-loaded, so only prices are a real action) | `/catalogue` |
| 4 | `first_stock` | branch | yes | `inventory.receive` | a stock lot exists in the branch | `/receiving` (branch context switched to the entity) |
| 5 | `invite_staff` | org | no | `staff.manage` | any active staff besides the owner | `/settings?tab=staff` |
| 6 | `receipt_settings` | org | no | `settings.write` | receipt header/footer configured | `/settings?tab=receipt` |
| 7 | `first_sale` | branch | yes | `pos.sell` | a completed sale in the branch | `/pos` |
| 8 | `connect_kiorex` | org | no | `settings.write`; hidden for roles without it | `Tenant.settings.kiorexConnect.status` requested/approved/paused/changes | `/kiorex-connect` |

## Lab (`kiorly-lab`) - `apps/api/src/modules/setup/setup-plan.ts` (new)

| # | Step key | Scope | req | Permission | Completion rule | Deep link |
|---|---|---|---|---|---|---|
| 1 | `lab_licence` | lab | yes | `settings.manage` | licence number and address set | `/settings?tab=labs&entity=:labId` - licence field focused (new edit form) |
| 2 | `starter_catalogue` | org | yes | `catalogue.write` | at least one test definition | `/settings?tab=general` - "Load starter catalogue" focused |
| 3 | `signatory` | org | yes | `staff.manage` | an active authorised signatory / lab director with a licence number | `/settings?tab=staff` |
| 4 | `invite_staff` | org | no | `staff.manage` | any active staff besides the owner | `/settings?tab=staff` |
| 5 | `lab_coverage` | lab | no | `settings.manage` | home-collection districts configured for the lab | `/settings?tab=labs` |
| 6 | `safety_contact` | org | no | `settings.manage` | safety contact name and phone set | `/settings?tab=general` - safety name focused |
| 7 | `first_order` | org | yes | `orders.create` | at least one lab order | `/orders` |
| 8 | `first_report` | org | yes | `reports.release` | at least one released report | `/release` |
| 9 | `connect_kiorex` | org | no | `settings.manage`; hidden for roles without it | Kiorex intake key issued | `/kiorex-connect` |

Lab keeps skips and the dismissal as append-only audit events (`setup.step_skipped`, `setup.dismissed`, `setup.reopened`) because its Prisma schema had uncommitted changes by another agent at the time (no schema edit); the state is the replay of those events.

## Bugs and missing rules found and fixed while doing this

1. Clinic `PATCH /onboarding/steps/:key` never worked: the DTO had no validators, so every call failed with `property action should not exist` (skip was dead). Now validated; `complete` is refused by design.
2. Clinic "Upload clinic logo" led to a page with no logo UI. New logo card in clinic settings (uses the invoice-logo upload); done also when `logoUrl` is set.
3. Clinic "Set your availability" led to `/profile`, which has no availability editor. New `/profile/availability` screen reusing the editor with a clinic id.
4. Self-serve sign-up seeds each clinician's availability with an end time of `00:00` which the API's own validator rejects ("Slot end must be after start"), so the seeded week could never be saved. Seed now ends the day at `23:59`; the editor shows `00:00` ends from older tenants as `23:59`.
5. The self-serve owner is a physician with `GROUP_ADMIN` as an additional role. The web dropped `roles`, `additionalRoles` and `isTenantOwner` in `refreshSessionFromServer`, the clinic settings screen ignored additional roles (read-only for the owner) and the Admin page kicked the owner back to the dashboard. Fixed in the auth store, clinic detail page and Admin page.
6. `PATCH /admin/tenant-settings` (WhatsApp reminders) required `role === GROUP_ADMIN`, so the owner could not complete the WhatsApp step; the organisation owner is now allowed, and the card is shown to them.
7. Saving only the licence number in the clinic regulatory panel sent `taxRegistrationNumber: null` and failed in markets that require a TRN; the tax number is now only sent when changed.
8. The Admin "Organization" section called `/admin/integration-clients` on plans without the integrations module; the 402 popped the upgrade paywall over the whole page. The panel is no longer mounted without the entitlement.
9. Clinic working hours: "Save" was disabled when the hours were unchanged, so default hours could never be confirmed; saving the hours is now the explicit confirmation (and the old rule counted any clinic edit as "hours done").
10. Clinic "first check-in" linked to the live board, which cannot check a patient in; it now links to the earliest open appointment's check-in panel.
11. Nurse self-serve sign-up: `POST /public/signup/complete` ignored `edition` / `nurseKind`; now forwarded (edition NURSE only).
12. Pharmacy: no UI to set a branch's licence or address except the one-time first-run page (and only for the home branch). New per-branch form in Settings > Branches. Settings now honour `?tab=`.
13. Lab: no UI to edit a lab's licence or address. New per-lab form in Settings > Labs. Settings now honour `?tab=`.
14. Lab Settings > General "Save" always failed with 400 (`Unrecognized keys: edition, marketCode, currency, effectiveSignInMethod, linkedToKiorex`): the page sent the whole GET payload to a strict PUT. It now sends only the editable fields (this also made the safety contact savable).
15. Clinic: an organisation owner (physician + GROUP_ADMIN) got "Clinic not found" for every clinic they did not practise in (clinic detail and visibility checks only honoured the physician network). Group admins now see all clinics of the organisation.
16. Nurse: the sign-up seeds an availability template, so "availability" counted as done at once; it now needs a saved (edited) template, like the Clinic rule.
17. Admin > Organization popped the upgrade paywall on plans without integrations (see 8); the Clinic appointment-detail page currently throws "Maximum update depth exceeded" in this working tree (reported in the results, not caused by this work).

