# KX-05 — Kiorly Clinic PRD (as built)
Source: 1JIhEl6TDzm69GR9lZLFpwUTH66mMtrVY
Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (first issued 20 November 2026; this update adds the build status of 19-23 Nov 2026)
Owner role: VP Product, Kiorly. Audience: Product, engineering, sales, support.
Extraction note: PDF text extraction; check/cross glyphs and some symbols lost (inferred where obvious).

Subtitle: The clinic management platform that is already built — capabilities, plans and entitlements, the money engine, the Kiorex connector — plus professions, home visits and what remains for Phase 1b.
Tags: Repository source of truth · 4 plans · Higher-of settlement · Kiorex connector · Professions & scope · Home visits · Phase 1b

## What changed in Rev 2.3
New §06 Professions and scope of practice (ADR-029): physicians, dentists, physiotherapists, nurses; verification per profession.
New §07 Physiotherapy pack (CL-07 specified) and §08 Home visits for all professions (ADR-030). Plans table adds home-visit entitlements; flag catalogue adds clinic home-visit and profession keys.
Kiorly Nurse is an edition of this product (ADR-031); its PRD is KX-23.

Contents: 01 Product summary · 02 Capability map · 03 Plans and entitlements · 04 The money engine · 05 Kiorex connector (provider side) · 06 Professions and scope of practice · 07 Physiotherapy pack (CL-07) · 08 Home visits · 09 Phase 1b and next requirements · 10 Feature flags in Kiorly Clinic · 11 Kiorly Clinic flag keys · 12 Success metrics

## 01 Product summary
Kiorly Clinic is a multi-tenant, Arabic-first clinic operating system for Egyptian private clinics — from a single practitioner to multi-branch groups — and, from v2.3, for physiotherapists and (as the Kiorly Nurse edition) nurses, in the clinic or at the patient's home.
Tiles: BUILD STEPS 108 (Stages A–F) · PLANS 4 (Lite · Pro · Clinic · Enterprise) · LAUNCH SPECIALTIES 11 (templates pending board sign-off) · PROFESSIONS 4 (physician · dentist · physio · nurse) · Open human items: 23 (see KX-17).
Stack (as deployed): NestJS modular monolith + Prisma + PostgreSQL 16; React 18 + Vite + TanStack Query + shadcn/ui + Tailwind; i18next EN/AR with RTL; AWS CDK today, moving to OpenTofu (ADR-028); CloudFront + S3 SPA + App Runner API + RDS + S3 uploads, Frankfurt cell; GitHub Actions CI/CD with OIDC deploy role. Mobile: installable PWA (UX01); native app deferred.
Editions (ADR-031). One codebase serves two editions, chosen per organization: CLINIC (this document) and NURSE (Kiorly Nurse, KX-23). The edition changes name, navigation, terminology, plans and visible modules — never the database, API or Kiorex connector.

## 02 Capability map
Status from the repository's capability matrix (GT06, Nov 2026); v2.3 additions marked Planned.
Scheduling & front desk — Shipped: Canonical slot engine: buffers, rooms, overrides, channels (FS01, KX03); Walk-ins, queues, check-in with payment capture; Waitlist auto-fill on cancellation (FS03); No-show risk with honest label (FS05); Deposits & payment links for high-risk bookings (FS04).
Clinical — Shipped: Patient 360, encounters, SOAP templates per specialty (CL04); Egyptian drug database brand → active ingredient (CL01); Rx safety: interactions, allergies, duplicates (CL02); Rx print + WhatsApp share with verification QR (CL03); Sign-off, amendments, auto-lock (CL05).
Money at the clinic — Shipped: Single revenue path postRevenue (no ETA ...; extraction truncated); Split payments, installments (MN06); Refunds, credit notes, packages, deposits (MN01); Cash drawer & shift close with owner WhatsApp (MN03); Doctor revenue share & statements (MN02); Payers, contract prices, TPA claims (MN05).
Engagement — Shipped / 1b: WhatsApp Business templates, inbound confirm/cancel/reschedule (MS01/02); Messaging consent, STOP, PDPL handling (MS03); Doctor & owner digests (MS04); transactional email via SES (MS05); WhatsApp AI receptionist in Egyptian Arabic (MS06, 1b).
Reports — Shipped: Today dashboard, period KPIs, P&L; Operational KPIs: no-show, utilisation, revenue/doctor-hour (RP01); Excel/PDF exports, scheduled reports (RP02); Kiorex impact report (RP03); AR aging, payouts, branch P&L (RP04, 1b).
Platform & trust — Shipped: Self-serve signup with phone OTP (ON01); Onboarding wizard, imports, staff invites, field-rep onboarding (ON04…07); MFA for privileged roles (SC04); tenant export (SC05); Rate limits, WAF intent, secrets hygiene (SC06); support access with consent (PA04).
Professions & scope — Planned v2.3: Profession per clinician; scope-of-practice guard (PRSOP); Verification per profession and register (PRVER).
Physiotherapy pack — Planned v2.3: Assessment, treatment plan, progress notes, outcome trends (CL07-PT).
Home visits — Planned v2.3: Home visit types, coverage zones, travel buffers, safety timer and SOS (HV*).

## 03 Plans and entitlements
Commercial gating is enforced by @RequiresEntitlement on API controllers and <Gate> in the web app (PL03/04). Scope of practice (§06) is a separate guard and never a plan feature.

| Entitlement | Lite | Pro | Clinic | Enterprise |
|---|---|---|---|---|
| Clinicians / branches / assistant seats | 2 / 1 / 2 | 10 / 5 / 10 | 50 / 25 / 30 | Unlimited |
| Appointments, patients, encounters, Rx, revenue | ✓ | ✓ | ✓ | ✓ |
| Clinical+, front desk, invoices, expenses, HR, reports, messaging | — | ✓ | ✓ | ✓ |
| Operations / OR, payroll, integrations, data explorer, multi-branch | — | — | ✓ | ✓ |
| AI assistant / AI scribe | — / — | ✓ / add-on | ✓ / ✓ | ✓ / ✓ |
| WhatsApp reminders, card, InstaPay, Fawry, deposits | — | ✓ | ✓ | ✓ |
| Home visits: booking, execution, safety (v2.3) | ✓ | ✓ | ✓ | ✓ |
| Home route view and travel-time planning (v2.3) | — | ✓ | ✓ | ✓ |
| Multi-clinician home dispatch by zone (v2.3) | — | — | ✓ | ✓ |
| Physiotherapy pack (v2.3) | Add-on | Add-on | Add-on | Included |
| Dedicated support | — | — | — | ✓ |
| Kiorex listing | Fee per attended new patient | Commission credited vs subscription | Commission credited vs subscription | Negotiated |
| Clinic booking link (commission-free) | ✓ | ✓ | ✓ | ✓ |

| Plan | Egypt price (seed) | Billing unit | Notes |
|---|---|---|---|
| Lite | EGP 0 subscription | Commission only | EGP 100 minimum invoice, carry-forward; simplified nav ≤ 8 tabs (PL06) |
| Pro | EGP 1,299 monthly · 999 annual-equivalent | Per clinician | Validate 799 / 999 / 1,299 in pilot |
| Clinic | EGP 3,499 incl. 5 clinicians · 699 each extra | Per organization | Annual discount configurable |
| Enterprise | Custom | Contract | Hidden from public catalog |

NOTE: Prices are versioned per market (PlanPrice with validFrom/validTo, cohort keys) and grandfathered: a new version schedules migrations at renewal after 30 days' notice; founding subscriptions are locked for 24 months (SB06, PL09). Home-visit safety (HVSAF) is in every tier, including Lite (P5). Kiorly Nurse plans are defined in KX-23.

## 04 The money engine
How Kiorly earns — and how it makes itself free for busy clinics. Unchanged for every profession and for home visits: a home visit's "Arrived" geostamp is its check-in.
Commission lifecycle (CR02, CR03, CR08, CR06): Book (source stamped; new patient? 24-mo lookback) → Check-in / Arrived (charge PENDING) → Complete / 24 h (CONFIRMED) → Dispute ≤ 7 d (auto/manual) → Settle max(S, C).
Nine worked examples (Pro EGP 999, fee EGP 40; S = subscription, C = commission; "Clinic pays" excl. VAT):
1 Pro, 5 Kiorex patients: S 999, C 200 → 999
2 Pro, 30 Kiorex patients: 999, 1,200 → 1,200 (Kiorly free)
3 Clinic plan (5 doctors), 60 patients: 3,499, 2,400 → 3,499
4 Pro in trial, 30 patients, WAIVE_UP_TO_PLAN_PRICE: 999 waived, 1,200 → 201
5 Pro in trial, 10 patients: 999 waived, 400 → 0
6 Lite, 12 patients: 0, 480 → 480 (carry if < 100)
7 Pro, 10 patients, 999 referral credit: 999, 400 → 0 (wallet)
8 Pro annual (prepaid), 30 patients: 999 prepaid, 1,200 → 201
9 Lite → Pro on day 16 of 30: 499.50, 280 → 499.50
These are automated tests (cr06-settlement.node.test.ts, QA03 matrix with 10k property-based runs asserting payable ≥ 0, payable ≤ max(S, C) + add-ons, and Σ wallet ledger = balance). A home-visit surcharge is clinic patient revenue and never enters S or C (BR56).
Subscription lifecycle and dunning: TRIALING (no card, 7 d) → ACTIVE (paid) → PAST_DUE (D1) → GRACE (to D14) → READ_ONLY (D15) → SUSPENDED (D45); also LITE. Records stay viewable, printable and exportable in every state (SB03).

## 05 Kiorex connector (provider side)
What Kiorly exposes to the marketplace — all shipped and contract-tested (QA04); v2.3 adds home-visit fields additively (KX-09 minor version).
| Capability | Endpoint / event | Step |
|---|---|---|
| Platform client auth | HMAC-SHA256 — X-Kiorly-Client-Key/Secret/Timestamp/Nonce/Signature, optional IP allow-list | KX01 |
| Provider sync | GET /marketplace/v1/providers?updatedSince=&page= — v2.3 adds profession, edition, serviceLocations[], coverageDistricts[] | KX02 |
| Slots | GET /marketplace/v1/clinics/:clinicId/slots?clinicianId&typeId&from&to — v2.3 adds serviceLocation=HOME&district | KX03 |
| Holds and bookings | POST/DELETE /holds, POST /bookings (Idempotency-Key), GET /bookings/:externalRef — v2.3 visitAddress on hold | KX04 |
| Events | Outbox → HMAC webhook: CONFIRMED, RESCHEDULED, CANCELLED_*, CHECKED_IN, COMPLETED, NO_SHOW, SLOTS_CHANGED, … — v2.3 adds HOME_VISIT_ASSIGNED / _EN_ROUTE / _ABORTED_UNSAFE | KX05 |
| Policies | POST /bookings/:ref/cancel|reschedule; 422 window errors | KX06 |
| Kiorex Pay | /bookings/:ref/deposit-paid, /payouts, /deposit-links/:token/paid | KX07 |
| Reviews | POST /reviews/aggregate; REVIEW_INVITATION_ELIGIBLE, REVIEW_REPLY_POSTED | KX08 |
| Booking link | GET /api/v1/public/booking-pages/:slug; channel=CLINIC_LINK | KX09 |
| Kiorex tab | Settings, per-clinician listing toggles, caps, performance overview | KX10 |

## 06 Professions and scope of practice
Every clinician has a profession (ADR-029). It decides how they are verified, what they may do and how Kiorex lists them. Scope of practice is a safety control, never a feature flag (ADR-025).
Enforced server-side by @RequiresScope(capability) beside @RequiresEntitlement; the web hides what the profession may not do. A physio or nurse calling any Rx endpoint receives 403 SCOPE_NOT_ALLOWED.
| Capability | Physician | Dentist | Physiotherapist | Nurse |
|---|---|---|---|---|
| Appointments, patients, packages, payments | Yes | Yes | Yes | Yes |
| Encounter templates | SOAP + specialty | Dental chart | Physio assessment & progress | Nursing visit record (KX-23) |
| Drug prescription (CL01…03) | Yes | Yes | No | No |
| Lab / radiology orders (CL06) | Yes | Yes | No — attach referral | No — attach order |
| Vitals and outcome measures | Yes | Yes | Yes | Yes |
| Medication administration record | Optional | No | No | Yes, against a doctor's order |
| Supervise unlicensed assistants | Yes | Yes | Yes (BR50) | Yes (nursing aides) |
| Home visits | Yes | No at launch | Yes | Yes |
(Matrix cell alignment partly ambiguous in extraction; template row and Rx/Lab/MAR/home rows reconstructed from reading order.)

| ID | Requirement |
|---|---|
| PRSOP01 | Clinician.profession required: PHYSICIAN, DENTIST, PHYSIOTHERAPIST, NURSE (extensible by market pack). Existing rows migrate to PHYSICIAN (dentistry specialties → DENTIST). Changing profession forces re-verification. |
| PRSOP02 | Capability matrix stored per market pack (scopeOfPractice), versioned and CMO-signed; an unknown capability fails CI. |
| PRSOP03 | ASSISTANT staff role under a named supervising clinician: records sessions and vitals, cannot sign, is never listed. |
| PRSOP04 | AI scribe and assistant prompts carry the profession; drafts never suggest actions outside its scope. |
| PRVER01 | Verification rule per profession from the market pack: register, number format, documents (syndicate card, MoH licence). Extends ON03. |
| PRVER02 | Ops queue shows the profession's checklist; the badge names the profession ("Verified physiotherapist"). |
| PRVER03 | Re-verify on change of name, profession or specialty (hazard H11); licence-expiry reminders. |
| PRVER04 | Solo nurses (KX-23): ID selfie match and criminal-record certificate in addition (ADR-032). |

| Profession | Register checked before LIVE (Egypt) |
|---|---|
| Physician | Egyptian Medical Syndicate number + MoH licence |
| Dentist | Dentists Syndicate number + MoH licence |
| Physiotherapist | Physical Therapy Syndicate number + MoH physiotherapy licence (Law 3 of 1985) |
| Nurse | Nursing Professions Syndicate card + MoH licence |

## 07 Physiotherapy pack (CL-07)
A paid add-on (EGP 300 / org / month, KX-12) behind clinic.specialty_templates.physio, launch-locked until the specialty board — with a physiotherapist reviewer — signs it (gate GPR2, NH010).
| ID | Requirement |
|---|---|
| CL07-PT01 | Initial assessment: complaint, history, pain scale 0–10, range of motion per joint, strength grades, special tests, functional goals. |
| CL07-PT02 | Treatment plan: session count, frequency, modalities, home exercise programme; sold as a package (MN01) with a session counter. |
| CL07-PT03 | Progress note per session with outcome trend chart (pain, ROM); discharge summary. |
| CL07-PT04 | Referral in: attach a doctor's referral, or receive ReferralIssued from a Kiorly Clinic doctor by consent (KX-09). Direct access without referral only where the market pack allows (open question Q9). |
| CL07-PT05 | Home exercise programme shared by WhatsApp link — no PHI in the message body. |
Physiotherapists use the Clinic edition and its plans (Lite / Pro / Clinic). Massage or electrotherapy diploma holders work only as supervised assistants (PRSOP03) and are never listed.

## 08 Home visits
Any visit type can be in the clinic or at the patient's home (ADR-030). Doctors and physiotherapists use it in the Clinic edition, nurses in Kiorly Nurse. Built on @kiorly/field-visit; launch-locked behind clinic.home_visits until gates GHV1 (counsel memo) and GHV2 (CMO-signed safety protocol).
Flow: Book in zone → Confirmed (address confirmed) → On my way (address revealed) → Arrived (geostamp = check-in) → Finished (= complete) → address masked after 24 h.
| ID | Requirement |
|---|---|
| HVCFG01 | Visit type has serviceLocation = IN_CLINIC or HOME; home types set duration, travel buffer before/after (default 30/30 min), home surcharge and deposit rule. |
| HVCFG02 | Coverage zones per clinician: district list from the market pack (polygons later); optional maximum travel time from a start point. |
| HVCFG03 | Daily home-visit cap and home-visit hours per clinician; clinic sessions and home visits share one calendar. |
| HVBK01 | Slot engine returns home slots only for in-zone addresses and blocks travel buffers around each booked home visit. |
| HVBK02 | Front desk books home visits from Kiorly (phone or walk-in requests) under the same rules. |
| HVBK03 | Kiorex bookings carry the address in the hold; Kiorly stores it encrypted on HomeVisit.addressSnapshot. |
| HVBK06 | Clinicians may restrict home-visit types by patient gender in their own settings (BR60). |
| HVPRV01 | Address and phone visible only to the assigned clinician and admins after CONFIRMED; masked 24 h after the visit (BR52). |
| HVEXE01 | Mobile "Today" route: home visits in time order with map link and On my way · Arrived · Finished buttons; each records time and coarse geostamp. |
| HVEXE02 | "Arrived" = check-in (attendance and commission exactly as in-clinic); "Finished" = complete. |
| HVEXE03 | Payment at home: cash, InstaPay or Kiorly payment link; cash goes to the clinician's drawer and reconciles at shift close (MN03). |
| HVSAF01 | Safety timer: no "Finished" 30 min after planned end → prompt; no answer in 10 min → alert to the org safety contact (BR53). |
| HVSAF02 | One-tap SOS shares live location with the safety contact and shows 123 (ambulance) and 122 (police). |
| HVSAF03 | A first home visit to a new patient needs a Kiorex-verified phone or a deposit (BR51, BR54). |
| HVSAF04 | "Leave visit — unsafe" ends the visit with a reason; never a no-show (BR61); incident logged for the owner. |
| HVFEE01 | Home surcharge is a separate invoice line and is included in the fee shown on Kiorex (BR56). |
| HVRPT01 | Reports split in-clinic vs home: visits, revenue, travel time, cancellations. |
RULE: Never flags: the safety timer, SOS, unsafe-abort and address masking (ADR-025). They work in every plan and cannot be switched off from the super admin.

## 09 Phase 1b and next requirements
Post-launch backlog (steps 101–108 plus v2 additions for the ecosystem).
| ID | Item | Status / trigger |
|---|---|---|
| CR10 | No-show guarantee credits (optional, off by default) | Shipped |
| KX11 | Consent-based record sharing with patient app | Shipped in Kiorly; needs Kiorex consumer |
| CL06 | Lab & radiology orders as records | Bridge to Kiorly Lab orders (KX-07) |
| CL07 | Specialty packs: dental chart, aesthetics, physio (physio specified in §07) | Paid add-ons; physio M7–9 |
| MN05 | Company contracts & TPA claims | Shipped foundation |
| MS06 | WhatsApp AI receptionist (Egyptian Arabic) | Pilot with consent |
| RP04 | AR aging, payouts, branch P&L | Planned |
| UX04 | Thermal printing & accessibility | Planned |
| PRSOP / PRVER | Profession model, scope guard, verification per profession | M7–9, before physio listing |
| KCV206 | Extract @kiorly/field-visit package (zones, buffers, visit lifecycle, safety timer) | M7–9 |
| HV* | Home visits for physicians and physiotherapists | M10–12, after GHV1/GHV2 |
| KN* | Kiorly Nurse edition (KX-23) | Build M13–15, GA M16–18 |
| KCV201 | 'Sign in with Kiorex' OIDC alongside existing auth | Phase 2 of KX-04 |
| KCV202 | Publish @kiorly/commerce-kernel (plans, entitlements, wallet, settlement, market packs) | Before Pharmacy build M9 |
| KCV203 | e-Prescription handoff to Kiorly Pharmacy (PrescriptionIssued with consent) | Pharmacy GA |
| KCV204 | Lab order handoff to Kiorly Lab and result import | Lab GA |
| KCV205 | Market 2 pack (currency, tax, payment methods, templates, scope-of-practice matrix) | M22 |

## 10 Feature flags in Kiorly Clinic
Kiorly already ships a three-layer flag system (platform · market · organization). v2 makes every module switchable, defaults everything ON, and hands authority to the Kiorex super admin (ADR-023).
| Today (repo, commit 6b24a79) | Target (v2) |
|---|---|
| 5 keys: ai_assistant, whatsapp_reminders, instapay, fawry, card_payments | Every Kiorly module and integration has a key (catalogue below and in KX-08) |
| Unset flags fall back to market defaults, otherwise conservative (off) | Unset = inherit; root default ON |
| Edited in Kiorly's own Platform → Overview / Market launch pages | Edited in the Kiorex super admin; Kiorly pages become read-only mirrors with a deep link |
| Org admins can toggle on or off | Org admins can switch org-scope flags for their own org; cannot override a platform/market OFF |
| Plan gating via FEATURE_FLAG_ENTITLEMENT | Unchanged: effective = flag ∧ entitlement |
| Step | Change in clinics-management | Acceptance |
|---|---|---|
| FF01 | Flag key registry expanded to the full catalogue; descriptions AR/EN; class and dependencies in code | Unknown key fails CI |
| FF02 | Default resolution changed to ON (inherit chain); launch-locked keys OFF until gate evidence arrives in snapshot | Unit tests for all 7 resolution rules |
| FF03 | Snapshot client: pull /control/v1/flags/snapshot (ETag, 30 s) + HMAC flag.changed webhook; persist last-known | Control plane down → last-known kept |
| FF04 | Guard every module entry point: @RequiresFeature(key) on controllers, <Feature> in web; 403 FEATURE_DISABLED | Per-flag OFF contract test green |
| FF05 | Platform flag pages read-only with 'Managed in Kiorex super admin' banner; org page shows effective value and source | Playwright EN/AR |
| FF06 | Audit events for snapshot changes; on-call alert if snapshot older than 10 min | Alert fires in staging drill |

## 11 Kiorly Clinic flag keys
All default ON. Scopes: G global · M market · O organization. Kiorly Nurse keys (nurse.*) are listed in KX-23 and KX-08.
| Key | Scopes | Class | When OFF | Depends on / gate |
|---|---|---|---|---|
| clinic.kiorex_listing | G M O | Module | Listings PAUSED on Kiorex; confirmed bookings honoured; booking link still works | kiorex.marketplace |
| clinic.commission_settlement | G M | Commercial | New commission charges stop; invoices = subscription only; confirmed charges still settle | clinic.kiorex_listing |
| clinic.kiorly_pay_deposits | G M O | Commercial | No new deposit requirements or links; existing deposits refund/convert per policy | — |
| whatsapp_reminders | G M O | Integration | Reminders stop; manual call list shown | — (existing key) |
| clinic.whatsapp_inbound | G M O | Integration | Replies no longer change appointments; routed to inbox | whatsapp_reminders |
| instapay · fawry · card_payments | G M O | Integration | Method hidden at cashier; cash and other methods remain | — (existing keys) |
| ai_assistant | G M O | AI | Widget hidden; chat returns 403 | — (existing key) |
| clinic.ai_scribe | G M O | AI | Record button hidden; signed notes unaffected | — |
| clinic.whatsapp_ai_receptionist | G M O | Launch-locked | Inbound messages go to human inbox | clinic.whatsapp_inbound · gate: Meta approval + consent copy |
| clinic.no_show_risk | G M O | AI | Risk chip hidden | — |
| clinic.waitlist_autofill | G M O | Module | Waitlist kept; no automatic offers | whatsapp_reminders |
| clinic.record_share_patient_app | G M O | Module | No new shares; existing shares stay visible to the patient | kiorex.record_vault |
| clinic.eprescription_handoff | G M O | Module | Rx printed / WhatsApp only | pharmacy.module |
| clinic.lab_order_handoff | G M O | Module | Lab orders kept as records only | lab.module |
| clinic.payers_tpa | G M O | Module | Contract prices kept; no new claims | — |
| clinic.specialty_templates.<code> | G M | Launch-locked | Template hidden from new encounters | gate: specialty board sign-off (NH010); physio: GPR2 |
| clinic.referral_rewards | G M | Commercial | No new codes; earned credits honoured | — |
| clinic.field_rep_onboarding | G M | Commercial | Rep codes rejected at signup; earned commissions honoured | — |
| clinic.profession.physiotherapy (v2.3) | G M | Module | No new physio sign-ups; existing physios keep working | — |
| clinic.home_visits (v2.3) | G M O | Launch-locked | Home visit types hidden for new bookings; booked visits honoured | gate: GHV1 + GHV2 |
| clinic.home_route_view (v2.3) | G M O | Module | List view only | clinic.home_visits |
| clinic.home_dispatch (v2.3) | G M O | Module | Manual assignment | clinic.home_visits |
RULE: Not flags — never switchable: Rx safety checks (interactions, allergies, duplicates); Encounter sign-off, auto-lock and versioned amendments; Audit logging; Consent enforcement; Record view / print / export for the tenant; Lot expiry / recall / quarantine blocks; Pharmacist sign-off; Lab QC blocks and authorized release; Critical-value escalation; Privileged MFA on production; Tenant isolation and authorization; Breach-response tooling; scope-of-practice enforcement; profession verification before listing; home-visit safety timer, SOS, unsafe-abort and address masking; MAR allergy/duplicate checks and doctor-order requirement.

## 12 Success metrics
ACTIVATION IN 30 DAYS ≥ 60% (20 visits checked-in) · FOUNDING TRIAL → PAID ≥ 50% · MONTHLY PAID CHURN ≤ 2.5% · ACTIVE DAYS / CLINIC / MONTH ≥ 20 · HOME VISITS WITH FULL GEOSTAMP TRAIL ≥ 98% (v2.3) · SAFETY ALERTS RESOLVED ≤ 15 MIN 100% (v2.3)

## 13 Build status and changes since 19 Nov 2026 (23 Nov 2026)
Observed in `clinics-management` (branch `kiorex`, never `main`; 322 commits since 19 Nov, including merges from main), `kiorly-team` and the workspace e2e suites. Local development only; nothing deployed or pushed.

### 13.1 Staff mobile app: Kiorly Team (Clinic and Nurse entries)
| Capability | Status | Evidence and caveat |
|---|---|---|
| `/mobile/*` API in the Clinic backend: bootstrap, schedule and queue, check-in, vitals, prescriptions, lab results, search, alerts, devices, upgrade request | Done | e2e suite 16 (46 tests on 21 Nov) compares app routes with the web API per role |
| Role gating of modules from the server (front desk, nurse, doctor, accountant, manager, owner, dispatcher) | Done | Bugs found and fixed 21 Nov: `/mobile/search`, `/prescriptions`, `/lab-results` were open to every role; now 403 `MODULE_NOT_ALLOWED` |
| Plan gate: `mobile_staff_app` entitlement ON for Pro, Clinic, Enterprise, Nurse Pro and Nurse Agency; OFF for Lite and Nurse Lite; Lite gets a safety-alert slice and an upgrade request (de-duplicated for 24 h); the plan gate answers before permission errors | Done | ADR-033 (Proposed) will replace the single key with `mobile.clinic.core` or `.pro` plus an always-on `mobile.safety`: Planned |
| Nurse sign-in entry: nurses, aides and dispatchers sign in through the Clinic API and land on today's home-visit rounds; there is no separate nurse app | Done | Added 22 Nov |
| Nurse sees no Lab results queue: `clinic.labs` is not granted to role NURSE or to NURSE and ASSISTANT professions; `GET /mobile/lab-results` answers 403; sample collection stays under home visits | Done (server-enforced, web unchanged) | Changed 22 Nov; asserted in e2e 16 |
| Dispatcher (receptionist or call-centre user in a Nurse-edition organization) gets the home-visit module and the organization's home-visit safety alerts; read access to `/home-visits/safety-alerts`; acknowledge and resolve stay manager-only; no clinical record access | Done | Founder decision 21 Nov |
| Home visit on the phone: depart, arrive, SOS, unsafe abort, nursing note, finish (finish needs a finalized nursing note); replayed transitions by the assigned clinician are idempotent | Done | Arrival distance stored as `arrivalDistanceM` and `arrivedOffSite` (default threshold 500 m, `HOME_VISIT_ARRIVAL_THRESHOLD_M`), never blocks, shown only to dispatchers and owners |
| Critical vitals raise a safety alert to nurse, manager and owner (not front desk); offline replay of `POST /mobile/vitals` is idempotent on `Idempotency-Key` | Done | |
| Push registration, deep-link routing and local simulation | Done (simulator, mock token) | Real APNs and FCM delivery never observed (Blocked on keys and EAS project id) |
| Multi-organization staff accounts, tiered entitlements, Passport sign-in for staff | Planned | ADR-033; one Passport subject links to one Clinic user today |

### 13.2 Clinic web and demo data
- Web additions merged 22 Nov: patient appointment wizard, encounter-create doctor pick fix, Consent and Operation Report documents on create and after surgery, duplicate operation document types prevented with View and Download, invoice actions and dialog close polish, patient New operation, duplicate patient charts prevented on create (phone lock, unique demo phones), Arabic strings backfilled and the deploy reload banner localized. The AI assistant button is lifted above the mobile bottom navigation. Web lint went from 246 warnings to 0 and the golden-flow and RBAC Playwright smoke passed (21 Nov report).
- Demo seed (DEV ONLY, synthetic): a tenant with **72 LIVE doctors covering all 36 Kiorex specialties** (2 each), plus the existing demo clinic, Basic (Lite) clinic, solo and agency Nurse tenants, home visits and care plans; `db:seed:mobile` adds the staff-app alerts. Logins and values are in `TEST_DATA.md` and `clinics-management/DEMO_DATA.md`, never in this volume.

### 13.3 Providers
SMS, email, WhatsApp and payment adapters follow the provider contract (ADR-035): `SMS_MODE`, `EMAIL_TRANSPORT=ses|http`, `WHATSAPP_PROVIDER=meta_cloud|http`, `PSP_MODE` with `PSP_API_URL`, `PSP_MERCHANT_ID`, `PSP_WEBHOOK_SECRET`; webhooks `POST /api/v1/webhooks/providers/{sms|whatsapp|email}` and `/webhooks/payments/:provider`; dev tools `POST /dev/inbox/send-test`. Push has no HTTP provider here (mock). The Clinic is the **last** product to move onto the shared notification layer (migration step 5, KX24 §11) because its messaging surface is the largest; until then its reminder scheduler does not filter by booking source and does not re-check appointment state before sending (KX24 §08). Status: Done (adapters, not live); Blocked on credentials and Meta template approvals (NH003 to NH015).

> **Warning** Do not push branch `kiorex`: a push there used to trigger a deploy workflow (FD-18).

## 14 Document storage, retention and quotas (Proposed, 23 Nov 2026)
Today patient documents have a 15 MB per-file cap and client-side image shrinking, but no total storage limit, no lifecycle rule and no retention rule (KX-25 §02). Proposed: per-plan storage limits with 80 percent warning and a grace band, server-side compression and thumbnails, soft delete with a reason, legal hold, and retention periods per market and class (NEEDS_HUMAN: DPO). Documents list views show thumbnails; originals open on click. Detail and build prompt: KX-25. Decision: ADR-036 (Proposed).

## What changed in this revision (23 Nov 2026)
- Added §13: Kiorly Team staff app (Clinic and Nurse entries), nurse Lab-results restriction, dispatcher rights, providers, demo data and web changes, each tagged Done, Planned or Blocked.
- Plans, money engine, Kiorex connector and professions sections are unchanged.
- Not verified: the 2 failing staff-app Jest tests (`lite-request.test.tsx`, 23 Nov re-run), real push delivery, a release build, a physical device.
- Added §14: document storage growth, quotas and retention (Proposed, KX-25).
