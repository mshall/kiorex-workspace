# KX05 — Kiorly Clinic PRD (as built)
Source: 1sq_L08CD9u3uk3oALmsjR1dvtlWNzSEz

> Note: transcribed from PDF text extraction. Symbols dropped by the extractor (✓/✗/–, ≥, ≤, →, +) were restored by inference where obvious; page headers/footers removed. The extracted settlement-example table (§04) lost its check/cross glyphs, so only its row labels and visible text are reproduced; see the note there.

Subtitle: The clinic management platform that is already built: capabilities, plans and entitlements, the money engine, the Kiorex connector, and what remains for Phase 1b.

Kiorex v2 · ecosystem reference. Authored in the role of VP Product, Kiorly. Owns the clinic product, its plans and its adoption.

Tags: Repository source of truth · 4 plans · Higher-of settlement · Kiorex connector · Phase 1b

| Field | Value |
|---|---|
| DOCUMENT | KX05 |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Product, engineering, sales, support |
| OWNER ROLE | VP Product, Kiorly |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 Product summary · 02 Capability map · 03 Plans and entitlements · 04 The money engine · 05 Kiorex connector (provider side) · 06 Phase 1b and next requirements · 07 Feature flags in Kiorly Clinic · 08 Kiorly Clinic flag keys · 09 Success metrics

## 01 Product summary

Kiorly Clinic is a multi-tenant, Arabic-first clinic operating system for Egyptian private clinics — from a single doctor to multi-branch groups.

Stat tiles: BUILD STEPS 108 (Stages A–F) · PLANS 4 (Lite · Pro · Clinic · Enterprise) · LAUNCH SPECIALTIES 11 (templates pending board sign-off) · OPEN HUMAN ITEMS 23 (see KX17).

**Stack (as deployed):** NestJS modular monolith + Prisma + PostgreSQL 16; React 18 + Vite + TanStack Query + shadcn/ui + Tailwind; i18next EN/AR with RTL; AWS CDK today, moving to OpenTofu (ADR028); CloudFront + S3 (SPA) + App Runner API + RDS + S3 uploads, Frankfurt cell; GitHub Actions CI/CD with OIDC deploy role. Mobile: installable PWA (UX01); native app deferred.

## 02 Capability map

Status from the repository's capability matrix (GT06, Nov 2026).

### Scheduling & front desk — Shipped
- Canonical slot engine: buffers, rooms, overrides, channels (FS01, KX03)
- Walk-ins, queues, check-in with payment capture
- Waitlist auto-fill on cancellation (FS03)
- No-show risk with honest label (FS05)
- Deposits & payment links for high-risk bookings (FS04)

### Clinical — Shipped
- Patient 360, encounters, SOAP
- Specialty templates per specialty (CL04)
- Egyptian drug database: brand → active ingredient (CL01)
- Rx safety: interactions, allergies, duplicates (CL02)
- Rx print + WhatsApp share with verification QR (CL03)
- Sign-off, amendments, auto-lock (CL05)

### Money at the clinic — Shipped
- Single revenue path (postRevenue) (no ETA — fiscal modules removed, FD02 / ADR011)
- Split payments, installments (MN06)
- Refunds, credit notes, packages, deposits (MN01)
- Cash drawer & shift close with owner WhatsApp (MN03)
- Doctor revenue share & statements (MN02)
- Payers, contract prices, TPA claims (MN05)

### Engagement — Shipped / 1b
- WhatsApp Business templates, inbound confirm/cancel/reschedule (MS01/02)
- Messaging consent, STOP, PDPL handling (MS03)
- Doctor & owner digests (MS04)
- Transactional email via SES (MS05)
- WhatsApp AI receptionist in Egyptian Arabic (MS06, 1b)

### Reports — Shipped
- Today dashboard, period KPIs, P&L
- Operational KPIs: no-show, utilisation, revenue/doctor-hour (RP01)
- Excel/PDF exports, scheduled reports (RP02)
- Kiorex impact report (RP03)
- AR aging, payouts, branch P&L (RP04, 1b)

### Platform & trust — Shipped
- Self-serve signup with phone OTP (ON01)
- Onboarding wizard, imports, staff invites, field-rep onboarding (ON04…07)
- MFA for privileged roles (SC04); tenant export (SC05)
- Rate limits, WAF intent, secrets hygiene (SC06)
- Support access with consent (PA04)

## 03 Plans and entitlements

Commercial gating is enforced by @RequiresEntitlement on API controllers and <Gate> in the web app (PL03/04).

| Entitlement | Lite | Pro | Clinic | Enterprise |
|---|---|---|---|---|
| Clinicians / branches / assistant seats | 2 / 1 / 2 | 10 / 5 / 10 | 50 / 25 / 30 | Unlimited |
| Appointments, patients, encounters, Rx, revenue | ✓ | ✓ | ✓ | ✓ |
| Clinical+, front desk, invoices, expenses, HR, reports, messaging | — | ✓ | ✓ | ✓ |
| Operations / OR, payroll, integrations, data explorer, multi-branch | — | — | ✓ | ✓ |
| AI assistant / AI scribe | — / — | ✓ / add-on | ✓ / ✓ | ✓ / ✓ |
| WhatsApp reminders, card, InstaPay, Fawry, deposits | — | ✓ | ✓ | ✓ |
| Dedicated support | — | — | — | ✓ |
| Kiorex listing | Fee per attended new patient | Commission credited vs subscription | Commission credited vs subscription | Negotiated |
| Clinic booking link (commission-free) | ✓ | ✓ | ✓ | ✓ |

(Some cell values were ambiguous in extraction; positions follow the extraction's reading order: the "Clinical+..." row reads "— ✓ ✓ ✓", the "Operations..." row "— — ✓ ✓", the AI row "— / — | ✓ / add-on | ✓ / ✓ | ✓ / ✓", the WhatsApp/payments row "— ✓ ✓ ✓", the dedicated support row "— — — ✓".)

| Plan | Egypt price (seed) | Billing unit | Notes |
|---|---|---|---|
| Lite | EGP 0 subscription | Commission only | EGP 100 minimum invoice, carry-forward; simplified nav ≤ 8 tabs (PL06) |
| Pro | EGP 1,299 monthly · 999 annual-equivalent | Per clinician | Validate 799 / 999 / 1,299 in pilot |
| Clinic | EGP 3,499 incl. 5 clinicians · 699 each extra | Per organization | Annual discount configurable |
| Enterprise | Custom | Contract | Hidden from public catalog |

**NOTE** Prices are versioned per market (PlanPrice with validFrom/validTo, cohort keys) and grandfathered: a new version schedules migrations at renewal after 30 days' notice; founding subscriptions are locked for 24 months (SB06, PL09).

## 04 The money engine

How Kiorly earns — and how it makes itself free for busy clinics.

Commission lifecycle (CR02, CR03, CR08, CR06):
1. Book — source stamped
2. New patient? — 24-mo lookback
3. Check-in — charge PENDING
4. Complete / 24 h — CONFIRMED
5. Dispute ≤ 7 d — auto/manual
6. Settle — max(S, C)

### Nine worked settlement examples

Columns in the source: # · Situation (Pro EGP 999, fee EGP 40) · S · C · Clinic pays (excl. VAT). The S/C comparison glyphs and the "Clinic pays" amounts were lost in extraction (only text annotations survived). Situation text and surviving annotations:

| # | Situation | Surviving annotation |
|---|---|---|
| 1 | Pro, 5 Kiorex patients | (values lost in extraction) |
| 2 | Pro, 30 Kiorex patients | Kiorly free |
| 3 | Clinic plan (5 doctors), 60 patients | (values lost) |
| 4 | Pro in trial, 30 patients, WAIVE_UP_TO_PLAN_PRICE | waived |
| 5 | Pro in trial, 10 patients | waived |
| 6 | Lite, 12 patients | carry if < EGP 100 |
| 7 | Pro, 10 patients, 999 referral credit | wallet |
| 8 | Pro annual (prepaid), 30 patients | prepaid |
| 9 | Lite → Pro on day 16 of 30 | (values lost) |

[Reconstruction aid, derived from the stated parameters (Pro EGP 999, fee EGP 40/patient) and the higher-of rule; NOT printed in the extraction: ex.1 S=999, C=200 → pays 999; ex.2 C=1,200 > S → pays 1,200 (Kiorly effectively free: subscription not charged on top); ex.3 compare Clinic plan 3,499 vs C=2,400 → pays 3,499. Verify against the PDF before relying on these.]

These nine worked examples are automated tests (cr06-settlement.node.test.ts, QA03 matrix with 10k property-based runs asserting payable ≥ 0, payable ≤ max(S, C) + add-ons, and Σ wallet ledger = balance).

### Subscription lifecycle and dunning
States: TRIALING (no card, 7 d) → paid → ACTIVE → PAST_DUE (D1) → GRACE (to D14) → READ_ONLY (D15) → SUSPENDED (D45); also LITE.
Records stay viewable, printable and exportable in every state (SB03).

## 05 Kiorex connector (provider side)

What Kiorly exposes to the marketplace — all shipped, contract-tested (QA04).

| Capability | Endpoint / event | Step |
|---|---|---|
| Platform client auth | HMAC-SHA256 — X-Kiorly-Client-Key / Secret / Timestamp / Nonce / Signature, optional IP allow-list | KX01 |
| Provider sync | GET /marketplace/v1/providers?updatedSince=&page= | KX02 |
| Slots | GET /marketplace/v1/clinics/:clinicId/slots?clinicianId&typeId&from&to | KX03 |
| Holds and bookings | POST/DELETE /holds, POST /bookings (Idempotency-Key), GET /bookings/:externalRef | KX04 |
| Events | Outbox → HMAC webhook: CONFIRMED, RESCHEDULED, CANCELLED_*, CHECKED_IN, COMPLETED, NO_SHOW, SLOTS_CHANGED, … | KX05 |
| Policies | POST /bookings/:ref/cancel|reschedule; 422 window errors | KX06 |
| Kiorex Pay | /bookings/:ref/deposit-paid, /payouts, /deposit-links/:token/paid | KX07 |
| Reviews | POST /reviews/aggregate; REVIEW_INVITATION_ELIGIBLE, REVIEW_REPLY_POSTED | KX08 |
| Booking link | GET /api/v1/public/booking-pages/:slug; channel=CLINIC_LINK | KX09 |
| Kiorex tab | Settings, per-doctor listing toggles, caps, performance overview | KX10 |

## 06 Phase 1b and next requirements

Post-launch backlog (steps 101–108 plus v2 additions for the ecosystem).

| ID | Item | Status / trigger |
|---|---|---|
| CR10 | No-show guarantee credits (optional, off by default) | Shipped |
| KX11 | Consent-based record sharing with patient app | Shipped in Kiorly; needs Kiorex consumer |
| CL06 | Lab & radiology orders as records | Bridge to Kiorly Lab orders (KX07) |
| CL07 | Specialty packs: dental chart, aesthetics, physio | Paid add-ons |
| MN05 | Company contracts & TPA claims | Shipped foundation |
| MS06 | WhatsApp AI receptionist (Egyptian Arabic) | Pilot with consent |
| RP04 | AR aging, payouts, branch P&L | Planned |
| UX04 | Thermal printing & accessibility | Planned |
| KCV201 | 'Sign in with Kiorex' OIDC alongside existing auth | Phase 2 of KX04 |
| KCV202 | Publish @kiorly/commerce-kernel package (plans, entitlements, wallet, settlement, market packs) | Before Pharmacy build (M9) |
| KCV203 | e-Prescription handoff to Kiorly Pharmacy (PrescriptionIssued with consent) | Pharmacy GA |
| KCV204 | Lab order handoff to Kiorly Lab and result import | Lab GA |
| KCV205 | Market 2 pack (currency, tax, payment methods, templates) | M22 |

## 07 Feature flags in Kiorly Clinic

Kiorly already ships a three-layer flag system (platform · market · organization). v2 makes every module switchable, defaults everything ON, and hands authority to the Kiorex super admin (ADR023).

| Today (repo, commit 6b24a79) | Target (v2) |
|---|---|
| 5 keys: ai_assistant, whatsapp_reminders, instapay, fawry, card_payments | Every Kiorly module and integration has a key (catalogue below and in KX08) |
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

## 08 Kiorly Clinic flag keys

Every capability that can be switched off from the Kiorex super admin. All default ON. Scopes: G = global · M = market · O = organization.

| Key | Product | Scopes | Class | When OFF | Depends on / gate |
|---|---|---|---|---|---|
| clinic.kiorex_listing | Kiorly Clinic | G M O | Module | Listings PAUSED on Kiorex; confirmed bookings honoured; booking link still works | kiorex.marketplace |
| clinic.commission_settlement | Kiorly Clinic | G M | Commercial | New commission charges stop; invoices = subscription only; confirmed charges still settle | clinic.kiorex_listing |
| clinic.kiorly_pay_deposits | Kiorly Clinic | G M O | Commercial | No new deposit requirements or links; existing deposits refund/convert per policy | — |
| whatsapp_reminders | Kiorly Clinic | G M O | Integration | Reminders stop; manual call list shown | — (existing key) |
| clinic.whatsapp_inbound | Kiorly Clinic | G M O | Integration | Replies no longer change appointments; routed to inbox | whatsapp_reminders |
| instapay · fawry · card_payments | Kiorly Clinic | G M O | Integration | Method hidden at cashier; cash and other methods remain | — (existing keys) |
| ai_assistant | Kiorly Clinic | G M O | AI | Widget hidden; chat returns 403 | — (existing key) |
| clinic.ai_scribe | Kiorly Clinic | G M O | AI | Record button hidden; signed notes unaffected | — |
| clinic.whatsapp_ai_receptionist | Kiorly Clinic | G M O | Launch-locked | Inbound messages go to human inbox | clinic.whatsapp_inbound · gate: Meta approval + consent copy |
| clinic.no_show_risk | Kiorly Clinic | G M O | AI | Risk chip hidden | — |
| clinic.waitlist_autofill | Kiorly Clinic | G M O | Module | Waitlist kept; no automatic offers | whatsapp_reminders |
| clinic.record_share_patient_app | Kiorly Clinic | G M O | Module | No new shares; existing shares stay visible to the patient | kiorex.record_vault |
| clinic.eprescription_handoff | Kiorly Clinic | G M O | Module | Rx printed / WhatsApp only | pharmacy.module |
| clinic.lab_order_handoff | Kiorly Clinic | G M O | Module | Lab orders kept as records only | lab.module |
| clinic.payers_tpa | Kiorly Clinic | G M O | Module | Contract prices kept; no new claims | — |
| clinic.specialty_templates.<code> | Kiorly Clinic | G M | Launch-locked | Template hidden from new encounters | gate: specialty board sign-off (NH010) |
| clinic.referral_rewards | Kiorly Clinic | G M | Commercial | No new codes; earned credits honoured | — |
| clinic.field_rep_onboarding | Kiorly Clinic | G M | Commercial | Rep codes rejected at signup; earned commissions honoured | — |

**RULE** Not flags — never switchable: Rx safety checks (interactions, allergies, duplicates); Encounter sign-off, auto-lock and versioned amendments; Audit logging; Consent enforcement; Record view / print / export for the tenant; Lot expiry / recall / quarantine blocks; Pharmacist sign-off; Lab QC blocks and authorized release; Critical-value escalation; Privileged MFA on production; Tenant isolation and authorization; Breach-response tooling.

## 09 Success metrics

Tiles (values partly lost in extraction; comparison symbols inferred):
- ACTIVATION IN 30 DAYS: ≥ 60% (20 visits checked-in)
- FOUNDING TRIAL → PAID: ≥ 50%
- MONTHLY PAID CHURN: ≤ 2.5%
- ACTIVE DAYS / CLINIC / MONTH: ≥ 20
