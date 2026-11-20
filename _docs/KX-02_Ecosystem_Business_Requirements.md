# KX02 — Ecosystem Business Requirements (BRD)
Source: 1j7sLw2QccAIJBRGUUXG8m8OKmwNcXtJZ

> Note: transcribed from PDF text extraction. Symbols dropped by the extractor (≥, ≤, →, ∑, ×) were restored by inference where obvious; page headers/footers removed.

Subtitle: What the business needs from Kiorex v2 — objectives, stakeholders, business rules, journeys and success measures — traceable to every PRD.

Kiorex v2 · ecosystem reference. Authored in the role of Chief Business Analyst. Translates strategy into testable business requirements.

Tags: Objectives & KPIs · Stakeholders · 48 business rules · End-to-end journeys · Traceability

| Field | Value |
|---|---|
| DOCUMENT | KX02 |
| REVISION | Rev 2.1 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Founders, investors, engineering & operations leads |
| OWNER ROLE | Chief Business Analyst |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 Business context · 02 Business objectives · 03 Stakeholders and their needs · 04 Scope · 05 Business rules · 06 End-to-end journeys · 07 Non-functional business requirements · 08 Assumptions, constraints and dependencies · 09 Traceability to product documents · 10 Sources & evidence

## 01 Business context

Egypt is a large, fragmented, cash-heavy outpatient market where most specialist care happens in private clinics, pharmacies and lab chains.

Market figures:
- EGYPT POPULATION: 118M
- LICENSED PHARMACIES (2025): 87,608 (EDA, Q3 2026)
- PHARMA MARKET 2025: EGP 422B (≈ USD 8.5B, 4B units) (Ken Research / Arab Finance)
- DIAGNOSTIC LABS MARKET 2024: USD 2.3B (TechSci)

Patients struggle to find a verified doctor with a real, bookable slot; clinics run on paper, WhatsApp and spreadsheets; pharmacies and labs run on disconnected POS and LIS tools. Incumbent booking platforms monetize providers per booking regardless of whether the patient shows up — and the leading one has publicly diversified away from pure booking under unit-economics pressure, with its investor mark cut to roughly 78% below cost by March 2026.

Kiorex v2 answers with software providers want to use every day (Kiorly), demand that is paid for only when it converts into an attended new patient (Kiorex), and a settlement rule that makes the software free for providers Kiorex keeps busy.

## 02 Business objectives

Measurable outcomes for the first 36 months (base case, KX13).

| ID | Objective | Measure | Target | By |
|---|---|---|---|---|
| BO1 | Become the default clinic system for new Egyptian private clinics | Active Kiorly clinic tenants (all tiers) | ≥ 850 / ≥ 3,500 | M12 / M36 |
| BO2 | Prove paid conversion of the founding cohort | Founding trial → paid conversion | ≥ 50% | M9 |
| BO3 | Build marketplace liquidity in launch clusters | Attended Kiorex new patients / listed doctor / month | ≥ 12 | M12 |
| BO4 | Make Kiorly free for busy clinics | Share of listed paid clinics where C ≥ S | ≥ 15% / ≥ 25% | M24 / M36 |
| BO5 | Add Pharmacy and Lab as independent SaaS | Active pharmacy / lab locations | ≥ 1,500 / ≥ 300 | M36 |
| BO6 | Reach fundable unit economics | Gross margin; CAC payback (paid clinics) | ≥ 80%; ≤ 12 months | M18 |
| BO7 | Expand beyond Egypt by configuration | Second market live via certified market pack | Pilot live | M25 |
| BO8 | Earn patient trust | Verified-review coverage; complaint rate | 100% of reviews from completed visits; ≤ 0.5% of bookings | Ongoing |

(Comparison symbols were lost in extraction and are inferred from context: ≥ for growth targets, ≤ for CAC payback and complaint rate.)

## 03 Stakeholders and their needs

**Patients & caregivers (Kiorex)**
- Find a verified doctor with a real slot in minutes
- Transparent fee, location, reviews
- Manage family members
- Own copy of records, shared by consent

**Doctors (owner-physicians) (Kiorly Clinic)**
- Run the clinic from a phone
- Fill empty slots without paying for no-shows
- Safe Rx with Egyptian drug database
- Get paid and see revenue share

**Front desk & clinic managers (Kiorly Clinic)**
- One schedule for all channels
- Check-in, split pay, cash close
- WhatsApp reminders and waitlist
- Arabic-first UI

**Pharmacists & owners (Kiorly Pharmacy)**
- Lot/expiry-accurate stock
- Fast POS with Rx validation
- Fewer expired write-offs
- Orders from Kiorex without new hardware

**Lab managers & technicians (Kiorly Lab)**
- Barcode accession and chain of custody
- Analyzer interfaces and QC
- Critical-value escalation
- Home collection scheduling

**Company (Kiorex) — Business**
- Predictable recurring revenue
- Low-cost supply acquisition
- Defensible data and workflow moat
- Regulatory standing in every market

## 04 Scope

In and out of scope for the 36-month horizon.

**In scope**
- Kiorex patient marketplace: doctors first, then pharmacy orders and lab tests
- Kiorly Clinic (built), Kiorly Pharmacy, Kiorly Lab
- Kiorex Account identity for patients and, later, providers
- Kiorex Pay deposits and prepayments; provider payouts
- Plans, trials, commissions, settlement, invoicing, dunning
- Egypt, then one GCC market by configuration
- AI scribe, assistant, no-show risk with honest labels

**Out of scope (explicitly)**
- Tax-authority e-receipts / ETA submission for clinics (ADR011)
- Operating pharmacies, labs or clinics ourselves
- Selling medicines as merchant of record before Q5 is decided
- Insurance underwriting; we integrate with payers/TPAs only
- Autonomous clinical decisions by AI
- Shared all-in-one medical database across products

## 05 Business rules

Rules the products must enforce. Where a rule is already implemented in Kiorly, the implementing step is cited.

### Commercial

| ID | Rule | Implemented / owned by |
|---|---|---|
| BR01 | A provider never pays both subscription and Kiorex commission for the same month; invoice = max(S, C). | CR06 |
| BR02 | Commission applies only to attended patients booked via Kiorex marketplace or Kiorex WhatsApp who are new to the tenant. | CR02/03 |
| BR03 | New-to-tenant = no attended visit or signed encounter in 24 months, matched on normalized phone or national ID. | CR02 |
| BR04 | Bookings via the clinic's own link (kiorly.link/<slug>) are never commissionable. | KX09 |
| BR05 | Commission amount and rate are frozen at check-in; later price changes do not alter it. | CR03 |
| BR06 | Clinics may dispute a charge within 7 days; auto-approve for proven existing patient or duplicate. | CR08 |
| BR07 | During trial, commission counts only above the reference plan price (WAIVE_UP_TO_PLAN_PRICE default). | CR01/06 |
| BR08 | Lite invoices are issued only when fees reach EGP 100; smaller balances carry forward. | SB05 |
| BR09 | Founding cohort (first 500 paying clinics) gets a 24-month price lock. | PL09 |
| BR10 | Price changes require 30 days' notice and apply at renewal; consent by continuing. | SB06 |
| BR11 | Configured Kiorex fee above 50% of the lowest competitor fee raises a warning to the platform admin. | CR04 |
| BR12 | Referral reward: one free month for both sides after the referee's first paid period; credits expire in 12 months. | CR09 |

### Access & records

| ID | Rule | Implemented / owned by |
|---|---|---|
| BR13 | Non-payment never blocks viewing, printing or exporting clinical records. | SB03 |
| BR14 | Dunning timeline: grace to day 14, read-only from day 15, suspended from day 45 (configurable). | SB03 |
| BR15 | Unpaid Lite fees past 30 days pause the Kiorex listing; Kiorly keeps working. | SB05 |
| BR16 | A tenant can export all its data at any time and on offboarding. | SC05 |
| BR17 | Physicians over the seat cap become read-only (cannot book or sign); data retained. | PL07 |

### Marketplace

| ID | Rule | Implemented / owned by |
|---|---|---|
| BR18 | A doctor is listed LIVE only if verified (syndicate number, licence), profile ≥ 80% complete, bookable type and availability exist. | ON03/KX02 |
| BR19 | Slot holds expire after 5 minutes; a booking without a valid hold or idempotency key is rejected. | KX04 |
| BR20 | Patient cancellation/reschedule windows default to 12 h; deposits refundable ≥ 24 h before; max 2 reschedules. | KX06 |
| BR21 | Clinic cancellations of marketplace bookings require a reason and always refund the deposit. | KX06 |
| BR22 | Only completed Kiorex-channel visits can produce a review; Kiorex moderates and is the source of truth. | KX08 |
| BR23 | Sponsored placement is always labelled and never influences verification or safety signals. | ADR021 |
| BR24 | Emergency symptoms in search route to approved emergency guidance, never to booking. | KX03 |

### Clinical & privacy

| ID | Rule | Implemented / owned by |
|---|---|---|
| BR25 | Rx safety checks (interactions, allergies, duplicates by active ingredient) run in every tier. | CL02 |
| BR26 | Encounters auto-lock after sign-off; amendments are versioned and attributed. | CL05 |
| BR27 | Marketplace, messaging and AI processing each require recorded patient consent. | SC03 |
| BR28 | Patient records are shared to the patient app only with explicit consent per share. | KX11 |
| BR29 | AI outputs are labelled as AI and require clinician acceptance before entering the record. | AI03 |
| BR30 | Privileged roles (owner, admin, finance) require MFA in production. | SC04 |
| BR31 | Support access to a tenant requires tenant consent and is audited. | PA04 |
| BR32 | Each market declares its data cell; tenants are validated against the cell registry. | SC01 |

### Pharmacy & lab (new)

| ID | Rule | Implemented / owned by |
|---|---|---|
| BR33 | No sale of an expired, recalled or quarantined lot; no negative stock unless explicitly authorized. | KP-INV |
| BR34 | Prescription-only items require a valid Rx and a signed pharmacist decision. | KP-RX |
| BR35 | Controlled medicines follow EDA dispensing rules; Kiorex never sells them. | KP-RX |
| BR36 | A lab result is released only after QC pass and authorized signature; corrections create a new version. | KL-QC |
| BR37 | Critical values must be acknowledged by a clinician or escalated within the configured time. | KL-CRIT |
| BR38 | Duplicate accession numbers are rejected; chain of custody is append-only. | KL-SPC |

### Identity & org

| ID | Rule | Implemented / owned by |
|---|---|---|
| BR39 | One human, one Kiorex Account subject; roles are contextual per organization. | KX04 |
| BR40 | Identity never grants medical access; each product decides authorization. | ADR013 |
| BR41 | Account merges require dual verification and are reversible. | KX04 |
| BR42 | Guardians manage dependants; dependants are patient subjects, not login users. | KX04 |

### Finance

| ID | Rule | Implemented / owned by |
|---|---|---|
| BR43 | Kiorly SaaS invoices are numbered gaplessly per entity and are separate from clinic patient invoices. | SB01 |
| BR44 | Payments via card token, Fawry, InstaPay or bank transfer; webhooks idempotent. | SB02 |
| BR45 | Kiorex Pay deposits are held, converted to clinic revenue at check-in, refunded or forfeited per policy. | KX07 |
| BR46 | Payouts to providers are idempotent per payout reference and reconciled to the ledger. | KX07 |
| BR47 | Monthly settlement runs day 1 at 02:00 Cairo for the previous month; re-runs are idempotent. | CR06 |
| BR48 | VAT is computed once on subtotal minus credits; rates come from the market pack. | CR11 |

(Step codes such as "KPINV", "KPRX", "KLQC", "KLCRIT", "KLSPC" appeared without hyphens in the extraction; hyphens added to match the requirement-ID style used elsewhere.)

## 06 End-to-end journeys

The five journeys every release must keep working.

### J1 — Patient finds and sees a new doctor
Participants: Patient · Kiorex · Kiorly Clinic · Clinic staff

1. search specialty + area
2. GET slots (cached 60s)
3. pick slot
4. POST hold (5 min)
5. POST booking (Idempotency-Key)
6. auto-confirm or queue
7. APPOINTMENT_CONFIRMED (outbox)
8. confirmation + reminder
9. check-in → charge PENDING
10. COMPLETED → review invite

J1 sequence — Kiorly is the authority; Kiorex holds intent and attribution.

### J2 — Clinic signs up free and becomes paid
1. OTP signup — ready clinic
2. Wizard import · invite
3. Activate — 20 visits / 30 d
4. Trial ends — card on file?
5. Paid or Lite — data retained

### J3 — Monthly settlement
1. Close month — 02:00 Cairo, day 1
2. Sum S and C — confirmed only
3. Apply trial/prepaid policy
4. Credits & VAT — wallet FIFO
5. Invoice & statement — PDF AR/EN
6. Collect — card · Fawry · InstaPay

[Extraction of J3 was interleaved; the steps shown reflect the labels present: "Close month 0200 Cairo, day 1" / "Sum S and C — confirmed only" / "Apply trial/prepaid — policy" / "Credits & VAT — wallet FIFO" / "Invoice & statement — PDF AR/EN" / "Collect — card · Fawry · InstaPay".]

### J4 — Prescription to pharmacy (phase 2)
Doctor signs Rx in Kiorly Clinic → patient consents to share → Kiorex shows nearby Kiorly Pharmacy stock availability → patient orders → pharmacist validates and dispenses in Kiorly Pharmacy → delivery or pickup → DispenseCompleted updates Kiorex order.

### J5 — Lab test booking to result (phase 2)
Patient books a test or home collection on Kiorex → Kiorly Lab creates order and accession → collection with barcode → analyzer result → QC → authorized release → LabResultReleased to patient vault and ordering doctor with consent.

## 07 Non-functional business requirements

| Area | Requirement |
|---|---|
| Language | Arabic-first with English; Egyptian-dialect patient copy reviewed by native speakers (UX03). |
| Devices | Front desk on tablet and phone; doctor views mobile-first; installable PWA with offline 'today' (UX01/02). |
| Performance | Marketplace slots p95 ≤ 150 ms at 50 rps; mobile TTI ≤ 4 s on 4G (QA07). |
| Availability | Booking API ≥ 99.5% monthly; Kiorly critical workflows independent of Kiorex. |
| Recovery | RDS PITR; quarterly restore drill with recorded RPO/RTO (SC08). |
| Auditability | Every money, plan, consent and clinical change audited with actor and timestamp (SC07). |
| Support | WhatsApp support Sun–Thu 09:00–18:00 Cairo with measured first-response SLA (GT04). |

## 08 Assumptions, constraints and dependencies

| Type | Item | Status |
|---|---|---|
| Assumption | Doctors will adopt a free tool that also brings patients | Estimated — validate in pilot |
| Assumption | Patients accept small deposits for high-risk bookings | Estimated |
| Constraint | Meta WhatsApp templates must be approved before automated sends (NH003…015) | Open |
| Constraint | Counsel review of legal pack before charging or listing | Open |
| Dependency | Kiorex consumer must pin Kiorly OpenAPI in its CI (NH019) | Open |
| Dependency | Payment providers: Paymob, Fawry, InstaPay merchant onboarding | In progress |

## 09 Traceability to product documents

| Business rules | Primary PRD | Architecture / finance |
|---|---|---|
| BR01…12 | KX05 Kiorly Clinic, KX12 Pricing | KX09 money flows, KX13 model |
| BR13…17 | KX05 | KX10 security |
| BR18…24 | KX03 Marketplace | KX09 contracts |
| BR25…32 | KX05, KX16 | KX10, KX11, KX15 |
| BR33…38 | KX06 Pharmacy, KX07 Lab | KX08 |
| BR39…42 | KX04 Account | KX08, KX10 |
| BR43…48 | KX05, KX12 | KX09, KX13 |

## 10 Sources & evidence

Every external figure in this document traces to one of these sources; internal facts trace to the Kiorly repository (mshall/clinics-management, commit 6b24a79, 19 Nov 2026) or to founder decisions recorded in KX01.

- Ken Research, Egypt E-Pharmacy & Digital Health Market 2025 (base): population 118.4M; e-pharmacy & digital health USD 69M (2025) → USD 236M (2032).
- Egyptian Drug Authority Q3 2026 licensing highlights: 87,608 licensed pharmacies.
- Arab Finance 2025: Egypt pharmaceutical market EGP 422B (USD 8.5B, 4B units).
- TechSci Research: Egypt diagnostic labs market USD 2,267M (2024).
- Launch Base Africa, 24 Apr 2026: Vezeeta stake marked 78.6% below cost; implied valuation ≈ USD 22.4M (Mar 2026); pivot to operating a medical building.
- Kiorly repository Docs: BOOKING_ATTRIBUTION, KIOREX_COMMISSION_CHARGES, MONTHLY_SETTLEMENT, KIOREX_MARKETPLACE, PLANS_AND_ENTITLEMENTS, TRIAL_ENGINE, kiorly-cursor-build-sequence §24.
