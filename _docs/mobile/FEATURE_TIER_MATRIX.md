# Feature x product x tier matrix (Kiorly app)

> Audit date 20 Nov 2026. Backend status is from reading the controllers/services in `clinics-management` (branch `kiorex`), `kiorly-pharmacy` (main), `kiorly-lab` (main). Design context: [MOBILE_APP_DESIGN.md](./MOBILE_APP_DESIGN.md) · decision: [ADR-033](./ADR-033_One_Kiorly_App_Tiered_Mobile.md) · unknowns: [RISKS_AND_OPEN_QUESTIONS.md](./RISKS_AND_OPEN_QUESTIONS.md).
> **Gaps are listed, not invented.** No endpoint below is proposed unless a row says "new".

## How to read

**Availability symbols**: `●` included, `○` not included (shown as locked, never hidden, unless role-denied), `-` not applicable to that product. Columns are the *default* mapping (design §5.2): **Lite/entry** = Clinic `LITE` / `NURSE_LITE`, Pharmacy `LITE`, Lab `LITE`; **Pro** = `PRO` / `NURSE_PRO`; **Clinic/Chain** = Clinic `CLINIC` / `NURSE_AGENCY`, Pharmacy and Lab `CHAIN`; **Ent** = Clinic and Pharmacy `ENTERPRISE` (Lab has no Enterprise).

**Backend status** (is the data/action reachable by a mobile client today, ignoring the entitlement re-keying that applies to *every* row, see X2):
* **Available today**: route exists and returns what the feature needs (cited).
* **Small backend change**: additive change in an existing module (new field, ungating a read, a hook, a header). Effort S (under 1 day) or M (1-3 days).
* **New backend work**: no suitable route, model or workflow. Effort L (over 3 days) unless marked.

**App UI**: `Built` = a screen already exists in `kiorly-team/app/**` (salvageable, needs re-gating and rename); `New` = nothing yet. App effort is not in the Effort column; see design §14 for phasing.

Roles/scope still apply to every row (server decides; e.g. nurses and assistants can never sign prescriptions, `NON_PRESCRIBING_PROFESSIONS`).

## 1. Clinic (incl. Nurse edition)

### 1.1 Core + safety

| # | Capability | Tier | Lite | Pro | Clinic | Ent | Backend status | Effort | App UI | Evidence / gap |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Schedule read, today and tomorrow | Core | ● | ● | ● | ● | Available today | S (re-key gate) | Built `clinic/schedule` | `GET /mobile/schedule?date=&clinicId=` (`clinics-management/apps/api/src/mobile/mobile.controller.ts`); physician sees own, others org/clinic. Tomorrow = `date` param |
| C2 | Appointment details | Core | ● | ● | ● | ● | Available today | - | Built (list); detail sheet small | `GET /appointments/:id` (`appointments/appointments.controller.ts:134`, policy `open`); schedule items carry status, queue stage, home-visit flag |
| C3 | Patient name / contact | Core | ● | ● | ● | ● | Available today | S (confirm phone in search payload, money/contact masking) | Built `clinic/patients` | `GET /mobile/search?q=` (name EN/AR, phone, MRN), `GET /patients/:id` (`patients.controller.ts`, policy `open`) |
| C4 | Check-in / arrived | Core | ● | ● | ● | ● | **Small backend change** | S | Partly built | `POST /front-desk/appointments/:id/check-in` (`front-desk/front-desk.controller.ts:46`) is gated by `mod_front_desk` (PRO) so Lite would dead-end. Alternative `PATCH /appointments/:id/status` (`appointments.controller.ts:142`) is `open`; verify CHECKED_IN transition and queue-stage default, or add a mobile check-in route not behind `mod_front_desk` |
| C5 | No-show | Core | ● | ● | ● | ● | Available today | - | Built (status action) | `PATCH /appointments/:id/status` with `NO_SHOW` (`appointments.service.ts:884`); blocked only when subscription is read-only (`SCHEDULING_WRITE`) |
| C6 | Push: booking, cancel, reschedule, Kiorex booking | Core | ● | ● | ● | ● | **Small backend change** | M | Inbox built | Only 5 templates exist (`mobile/mobile-push.service.ts`: `HOME_SAFETY_ALERT`, `CRITICAL_VITALS`, `LAB_RESULT_READY`, `PATIENT_CHECKED_IN`, `TEST`); hooks only in `HomeVisitSafetyService`, `FrontDeskService`, `ClinicalOrdersService`. Need templates + hooks on appointment create/cancel/reschedule and Kiorex-origin bookings, PHI-free text. Provider is mock; real Expo push = go-live task (`PG-04` family, NEEDS_HUMAN) |
| C7 | Patient summary, read-only (allergies, problems, meds, last note) | Core (allergy banner = Safety) | ● | ● | ● | ● | **Small backend change** | S | Built `clinic/patient/[id]` | `GET /patients/:id/summary` (`patients.controller.ts:353`) returns allergies, active problems, current medications, last vitals, alerts, balance. **Last note is not in the shape**; add excerpt or use `GET /encounters?patientId=` (`encounters.controller.ts:72`). Hide `outstandingBalance` per money-visibility rules. Mobile read is **unaudited** today (design C11) |
| C8 | Share booking link (kiorly.link) | Core | ● | ● | ● | ● | Available today | S (confirm role + Lite access) | New (share sheet) | `GET /kiorex/booking-link` (`marketplace/kiorex-settings.controller.ts:53`); host logic in `marketplace/clinic-booking-page.service.ts` |
| C9 | Safety alerts: list + acknowledge | **Safety** | ● | ● | ● | ● | Available today | - | Built (Inbox) | `GET /mobile/alerts`, `POST /mobile/alerts/:id/ack` (`mobile.controller.ts`); kinds `HOME_VISIT_SOS`, `HOME_VISIT_MISSED_CHECKIN`, `NURSE_SAFETY`, `CRITICAL_VITALS`, `CRITICAL_LAB_RESULT`; never calls the entitlement service (test exists) |
| C10 | Home-visit safety actions: SOS, "I'm OK", leave-unsafe | **Safety** | ● | ● | ● | ● | Available today (verify no `home_route_view` gate) | S | Built `clinic/round/[id]` | `POST /home-visits/:id/sos|safety/answer|abort-unsafe` (`home-visits/home-visits.controller.ts:165,172,158`); registered safety control `home_visit_safety` (`feature-flags/safety-controls.ts`) |
| C11 | Home-visit execution: depart / arrive (geostamp) / finish | Core (recommended, Q7) or Pro | ● / ○ | ● | ● | ● | Available today | - | Built `clinic/rounds` | `POST /home-visits/:id/depart|arrive|finish` (lines 137/144/151). Rev 2.3 P5 says execution is in every tier on web; brief says home visits are Pro. **Decision Q7** |

### 1.2 Pro

| # | Capability | Tier | Lite | Pro | Clinic | Ent | Backend status | Effort | App UI | Evidence / gap |
|---|---|---|---|---|---|---|---|---|---|---|
| P1 | Create / edit prescription | Pro | ○ | ● | ● | ● | Available today | S (verify drug search endpoint for phone) | **New** (list/sign built) | `POST /encounters/:id/medications` (`encounters.controller.ts:196`), `PATCH /encounters/:id`; server Rx safety checks run on the server path (`clinical/rx-safety-check.service.ts`); needs web `mod_clinical` (PRO) |
| P2 | Sign prescription | Pro | ○ | ● | ● | ● | Available today | - | Built `clinic/prescriptions` | `GET /mobile/prescriptions`, `POST /mobile/prescriptions/:encounterId/sign` (delegates to `EncountersService.finalize`; 409 `ALREADY_SIGNED`; never NURSE/ASSISTANT). **Online only** |
| P3 | Approve results | Pro | ○ | ● | ● | ● | Available today | - | Built `clinic/lab-results` | `GET /mobile/lab-results`, `POST /mobile/lab-results/:orderId/approve` (`MobileResultReview`, idempotent). **Online only** |
| P4 | Sign "docs" (other documents) | Pro | ○ | ● | ● | ● | **New backend work (needs definition)** | M | New | Only encounter finalize and document upload exist (`encounters.controller.ts:142,253`). Which documents the brief means (referral, certificate, report) is unspecified: Q8 |
| P5 | AI scribe on phone (record, draft, clinician signs) | Pro | ○ | ● | ● | ● | Available today | S (confirm audio format/size) | **New** (needs mic, `expo-audio`) | `POST /clinic-ai/encounters/:id/scribe/start`, `GET /clinic-ai/scribe/:sessionId`, `POST .../audio`, `/stop`, `/approve` (`clinic-ai/clinic-ai.controller.ts:34-75`); needs `ai_scribe` entitlement (PRO), flag `clinic.ai_scribe`, mock AI provider until PG-11. Recording consent wording is NEEDS_HUMAN |
| P6 | Home-visit route | Pro | ○ | ● | ● | ● | Available today | - | Built `clinic/rounds` | `GET /home-visits/route` (`home-visits.controller.ts:84`); web `home_route_view` is PRO; `@kiorly/field-visit` vendored in app. Launch-locked flag `clinic.home_visits` (GHV1/GHV2) applies |
| P7 | Check-in at address (arrive with geostamp) | Pro (see C11) | ○ | ● | ● | ● | Available today | - | Built | `POST /home-visits/:id/arrive`; coarse geostamp retention rules in `Docs/FIELD_VISIT.md` |
| P8 | Home-visit / nurse visit note | Pro | ○ | ● | ● | ● | Available today | S (revision precondition) | Built `clinic/visit/[appointmentId]` | `GET /nurse/visits/:appointmentId/record`, `POST .../record/sign` (`nurse/nurse-clinical.controller.ts:98,110`) |
| P9 | Nurse-collected samples | Pro (Nurse edition) | ○ | ● | ● | ● | Available today | - | Built | `POST /nurse/visits/:appointmentId/lab-orders`, `POST /nurse/lab-orders/:orderId/collection` (`nurse/nurse-lab.controller.ts:30,43`); needs `nurse_lab_samples` (NURSE_PRO+); offline envelope per design §8 |
| P10 | Full visit-note editing + templates | Pro | ○ | ● | ● | ● | **Small backend change** | S | Built `clinic/visits` | `PATCH /encounters/:id` (`encounters.controller.ts:134`), `GET /clinical/form-templates` (`clinical.controller.ts:45`). **No server revision check**: add `If-Match`/`updatedAt` to give conflicts to the user (design §8) |
| P11 | Lightweight owner KPIs | Pro | ○ | ● | ● | ● | **Small backend change** | S-M | Built `clinic/revenue` (revenue only) | `GET /mobile/revenue/snapshot`; `GET /dashboard/today` (`dashboard/dashboard.controller.ts:28`). Revenue exists; visits / no-show rate / new patients not in the mobile payload |
| P12 | Multi-branch | Pro | ○ | ○ | ● | ● | Available today | S | Partly built | `clinicId` on `/mobile/schedule`; `GET /dashboard/group-overview` (`dashboard.controller.ts:17`); web `multi_branch` entitlement is CLINIC+ (`plans-matrix.ts`) so Pro stays single-branch unless the web plan changes |

## 2. Pharmacy (no mobile POS)

### 2.1 Core + safety

| # | Capability | Tier | Lite | Pro | Chain | Ent | Backend status | Effort | App UI | Evidence / gap |
|---|---|---|---|---|---|---|---|---|---|---|
| H1 | Price / stock lookup, search + barcode | Core | ● | ● | ● | ● | Available today | S (re-key gate) | Built `pharmacy/barcode`, `search` | `GET /mobile/pharmacy/barcode/:code`, `GET /mobile/pharmacy/search?q=` (`kiorly-pharmacy/apps/api/src/modules/mobile`); GS1 parse; perms `catalogue.read`+`inventory.read` |
| H2 | Expiry and low-stock alerts (30/60/90 d, reorder) | Core | ● | ● | ● | ● | Available today | S | Built `pharmacy/expiry` | `GET /mobile/pharmacy/expiry-lowstock`; push template `stock.expiry` (mock). Already-expired stock (`EXPIRED_STOCK`) is **Safety** |
| H3 | Kiorex order notifications, accept / reject | Core | ● | ● | ● | ● | Available today | - | Built `pharmacy/orders` | `GET /kiorex-orders`, `POST /kiorex-orders/:id/accept|reject`; Lite has `kiorex_orders` capability (`kernel-adapter/local/local-kernel.ts:12`); INTEGRATED tenants + flag `pharmacy.kiorex_orders`; push `order.received`. **Online only** |
| H4 | Safety alerts: controlled-drug discrepancy, recall, cold chain, expired stock | **Safety** | ● | ● | ● | ● | Available today | - | Built (Inbox, `pharmacy/controlled`) | `GET /mobile/alerts`, `POST /mobile/alerts/:id/ack` (`modules/mobile/mobile-alerts.service.ts`: `RECALLED_LOT_IN_STOCK`, `COLD_CHAIN_EXCURSION`, `EXPIRED_STOCK`, controlled kinds); `POST /mobile/pharmacy/controlled/countersign` (witness must differ) |

### 2.2 Pro

| # | Capability | Tier | Lite | Pro | Chain | Ent | Backend status | Effort | App UI | Evidence / gap |
|---|---|---|---|---|---|---|---|---|---|---|
| H5 | Barcode receiving (against PO) with offline queue | Pro | ○ | ● | ● | ● | Available today + small | S (queue envelope, clientTime) | Built `pharmacy/receiving` | `POST /inventory/scan/parse`, `POST /inventory/receipts` with `idempotencyKey`, `GET /purchase-orders` (`purchasing` capability PRO+, `local-kernel.ts:13`); conflict `PO_CLOSED` 409 |
| H6 | Stock counts with offline queue | Pro | ○ | ● | ● | ● | **Small backend change** | M | Built `pharmacy/stockcount` | `POST /inventory/counts`, `PUT /inventory/counts/:id/lines` is **last-write-wins per lot**; need append-entries + server reconcile and variance flagging (design §8) |
| H7 | Rx verification queue | Pro | ○ | ● | ● | ● | Available today | - | Built `pharmacy/rx/*` | `GET /prescriptions/verification-queue`, `POST /prescriptions/:id/validate|reject`, `POST /dispensings/:id/override/:checkId`, `/signoff` (perm `dispense.signoff`). **Online only**; safety checks server-side |
| H8 | Branch transfers | Pro (per brief) | ○ | ○ | ● | ● | Available today for Chain/Ent only | S (Chain/Ent) or M (if Pro) | **New** | `GET /inventory/transfers` etc. behind `@RequiresEntitlement("transfers")` (`modules/inventory/inventory.controller.ts:140-143`); `transfers` exists only on CHAIN/ENTERPRISE (`local-kernel.ts:14-15`). **Conflict C6, Q9** |
| H9 | Lightweight owner dashboard | Pro | ○ | ● | ● | ● | **Small backend change** | M | Partly (shift summary) | Parts exist (`/mobile/pharmacy/shift-summary`, `modules/dashboard`, reports); no mobile aggregate. Shift summary is read-only cash, not POS; confirm it stays (Q9) |

## 3. Lab (no analyzer or QC configuration on mobile)

### 3.1 Core + safety

| # | Capability | Tier | Lite | Pro | Chain | Ent | Backend status | Effort | App UI | Evidence / gap |
|---|---|---|---|---|---|---|---|---|---|---|
| L1 | Today's bookings / orders | Core | ● | ● | ● | - | Available today | S | Built `lab/orders` | `GET /orders?from=&status=&search=` (`orders.read`), `GET /mobile/summary` (`kiorly-lab/apps/api/src/modules/orders/orders.controller.ts`, `modules/mobile`) |
| L2 | Home-collection list (read) | Core | ● | ● | ● | - | **Small backend change** | S | Built (in `lab/phlebotomy`) | `GET /home-collections` (`orders.controller.ts:63`) is behind `@RequiresFlag("lab.home_collection")` + `@RequiresEntitlement("home_collection")` (PRO, `kernel-adapter/local-kernel.ts:9-11`). Lite labs have none, so serve an ungated read-only mobile list (empty for Lite), no 402. **C7** |
| L3 | Push: new bookings and TAT breaches | Core | ● | ● | ● | - | **Small backend change** | M | Inbox built | TAT / critical / collector-safety pushes are mirrored from `MessagingAdapter` (`kiorly-lab/Docs/MOBILE.md`); a "new booking" push is not listed. Routine TAT notification is Core; escalation workflow is Pro (L8) |
| L4 | Critical-value notification + acknowledge | **Safety** | ● | ● | ● | - | Available today | - | Built `lab/critical` | `GET /mobile/alerts` (`CRITICAL_VALUE`), `POST /mobile/alerts/:id/ack` (uses `CriticalService.acknowledge`, perm `critical.ack`); texts carry no raw values |
| L5 | Other lab safety alerts: STAT/URGENT TAT breach, QC failure, collector safety | **Safety** | ● | ● | ● | - | Available today | - | Built | `TAT_BREACH_CRITICAL`, `QC_FAILURE`, `HOME_COLLECTION_SAFETY` in `modules/mobile-alerts`; `field-safety.controller.ts` (`.../sos`, `.../safety/answer`, `.../leave-unsafe`) is explicitly not behind `lab.home_collection` |

### 3.2 Pro

| # | Capability | Tier | Lite | Pro | Chain | Ent | Backend status | Effort | App UI | Evidence / gap |
|---|---|---|---|---|---|---|---|---|---|---|
| L6 | Phlebotomy round: specimen scanning, chain of custody, offline queue | Pro | ○ | ● | ● | - | **Small backend change** | M | Built `lab/phlebotomy` | `GET /home-collections/my-route`, `GET /mobile/scan?code=`, `POST /specimens/:id/collect|transport`, `GET /specimens/:id/custody` (append-only). Need round **manifest download** for offline label match and an idempotency/clientTime envelope on collect/transport |
| L7 | Result validation + release for authorised signatory | Pro | ○ | ● | ● | - | Available today | - (app S for release) | Built `lab/validation` (release not seen) | `GET /validation-queue`, `POST /results/:id/tech-validate|medical-validate`, `GET /release-queue`, `POST /reports/:id/release` (`modules/release/release.controller.ts:44,48`; perms `reports.release`). **Online only** |
| L8 | TAT alerts and escalation | Pro | ○ | ● | ● | - | **Small backend change** | S-M | Built `lab/tat` | `GET /tat` (`dashboard.read`); escalation chain verified for **critical values** (`critical.service.ts`), not for ordinary TAT breaches |
| L9 | Owner dashboard | Pro | ○ | ● | ● | - | **Small backend change** | M | Partly (`lab/worklist`) | `GET /mobile/summary`, `GET /mobile/worklist/progress`; no owner aggregate (volume, TAT, revenue) |
| L10 | QC status view (read-only; no configuration) | Pro (view) | ○ | ● | ● | - | Available today | - | Built `lab/qc` | `GET /qc/blocks` (`qc.read`); QC *failure alert* is Safety (L5). Configuration stays web-only |

## 4. Cross-cutting items the tiers depend on

| # | Item | Status | Effort | Evidence / gap |
|---|---|---|---|---|
| X1 | `GET /mobile/me/entitlements?org=` in each product | New (replaces the `entitlement` block of `GET /mobile/bootstrap`, which exists in all three) | M x3 | `mobile.service.ts` bootstrap (Clinic); Pharmacy/Lab `mobile/*` |
| X2 | Replace `mobile_staff_app` with `mobile.*` keys; force `mobile.safety`; `@MobileCapability` guard; migrate data | Small (Clinic) / New (Pharmacy, Lab) | Clinic M; Pharmacy M; Lab M | Clinic: `plans-matrix.ts` + `MobileInterceptor`. Pharmacy/Lab plan data is **hard-coded** in `local-kernel.ts`, no DB plan rows or per-org override |
| X3 | Capability registry + "safety never paid" CI test in each backend + contract | New | S x3 + M contracts | Pattern to copy: `clinics-management/.../feature-flags/safety-controls.ts` + `ff-safety-never-flags.node.test.ts`; `kiorex-contracts/flags/safety-never-flags.json` |
| X4 | New flag keys `mobile.clinic|pharmacy|lab` (Module, ON, not launch-locked) | Small | S | Contracts `flags/catalogue.json` (57 keys) is pinned by tests in Clinic and Lab; also `kiorex-platform` catalogue. `mobile_staff_app` was never registered (C10) |
| X5 | Per-market plan-to-mobile policy + per-org override in super admin | New | L | Clinic has `TenantEntitlementOverride`; no per-market entitlements anywhere; Pharmacy/Lab none |
| X6 | Org discovery `GET /mobile/me/orgs` + Clinic multi-org identity link | New / Small | M (Clinic), S (Pharmacy, Lab) | C5; Passport `GET /api/orgs` exists (`kiorex-account/apps/dev-idp/src/routes.ts:167`) |
| X7 | Passport public client `kiorly-team` (redirect `kiorlyteam://auth/callback`; supersedes the `kiorly-app` proposal); Clinic Passport-token exchange | Config (NEEDS_HUMAN) + New | S + M | `kiorex-account/config/idp.json` has `kiorex-web/ops/mobile/passport-web` public, `kiorly-clinic` confidential; Pharmacy/Lab already accept Passport tokens |
| X8 | Device register / list / revoke / push token | **Available today** x3 | - | `POST|GET|DELETE /mobile/devices`, `PUT /mobile/devices/:id/push-token` in all three; Clinic revokes the refresh session too |
| X9 | Admin UIs for remote sign-out (web admin per product + super admin, per user across products) | New | M (per product) + L (super admin) | API exists (X8); no web UI found; cross-product by Passport `sub` needs back-channel logout fan-out (`kiorex-account/apps/dev-idp/src/logout.ts` exists) |
| X10 | Real push (Expo / APNs / FCM), silent `entitlements.changed` and `session.revoked` events | New (mock only) | M x3 | `MOBILE_PUSH_MODE=mock`; `real` throws by design (`mobile-push.service.ts`); provider keys NEEDS_HUMAN |
| X11 | Audit of mobile patient/Rx/result reads | Small | M x3 | C11: `shouldAuditGet` does not cover `/mobile/*` or `/patients/:id/summary`; Pharmacy/Lab not verified |
| X12 | Enterprise policy object + MDM config | New | M (policy) + M (MDM native config) | Nothing exists |
| X13 | Account deletion request flow | New | M | No staff account-deletion route found in Clinic (`deleteAccount` search empty); Kiorex patient flow exists in KX-03 only |
| X14 | Export `/mobile/*` in Clinic OpenAPI | Small | S | C9 |
| X15 | Queued-action envelope handling (`Idempotency-Key`, `X-Kiorly-Client-Time`, `409 ENTITLEMENT_CHANGED`, `STALE_PRECONDITION`) | New (generic middleware) | M x3 | Only Pharmacy receipts and Lab specimens have idempotency today |
| X16 | Entitlement-check logging + locked-tap telemetry endpoint | New | M | - |

## 5. Effort roll-up (backend only)

| Product | Small (S/M) items | New (L) items | Biggest unknowns |
|---|---|---|---|
| Clinic | C4, C6, C7, P10, P11, X2, X6, X11, X14 | X5 (shared), X9 | Passport exchange, multi-org linking (C5) |
| Pharmacy | H5, H6, H9, X2 | H8 only if Pro must include transfers | Plan data not in a DB (no overrides) |
| Lab | L2, L3, L6, L8, L9, X2 | - | Manifest/offline round design |
| Shared | X1, X3, X4, X10, X12, X13, X15, X16 | X5 | Control-plane policy vs product-local policy (Q11) |

Rough size: about 25 small items (S-M) across three backends and contracts, 2-3 new-work items (per-market policy, cross-product remote sign-out, docs signing if defined). The existing `/mobile/*` layer and `kiorly-team` screens cover most of the *surface*; the work is re-keying entitlements, multi-org identity, offline correctness, audit, and real push.
