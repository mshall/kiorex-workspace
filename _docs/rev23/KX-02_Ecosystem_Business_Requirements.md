# KX02 — Ecosystem Business Requirements (BRD)
Source: 1YCnxmSbm-JIp0pu8iEm_F2XAINqyXAEr
Revision: Rev 2.4 · Reference Edition, updated 24 November 2026 (Approved reference; supersedes KX02 Rev 2.3, 20 Nov 2026; Rev 2.4 as-built section added at the end, status-labelled)

> Cleaned from Drive text extraction; comparison symbols (≥ ≤) restored by inference; headers/footers removed. Owner: Chief Business Analyst. Audience: Founders, investors, engineering & operations leads. Tags: Objectives & KPIs · Stakeholders · 61 business rules · End-to-end journeys · Traceability.

## WHAT CHANGED IN REV 2.3
Scope adds physiotherapists, nurses (Kiorly Nurse) and home visits; out-of-scope list extended. New objective BO9; new stakeholders; BR18 widened to all professions; new rules BR49…BR61. New journeys J6 (home visit) and J7 (home nursing care plan); traceability updated.

## 01 Business context
Egypt is a large, fragmented, cash-heavy outpatient market where most specialist care happens in private clinics, pharmacies and lab chains — and a growing share at home.
EGYPT POPULATION 118M (Ken Research) · LICENSED PHARMACIES (2025) 87,608 (EDA, Q3 2026) · PHARMA MARKET 2025 EGP 422B (≈USD 8.5B, 4B units) · DIAGNOSTIC LABS MARKET 2024 USD 2.3B (TechSci).
Patients struggle to find a verified doctor with a real, bookable slot; clinics run on paper, WhatsApp and spreadsheets; pharmacies and labs run on disconnected POS and LIS tools; home nursing and home physiotherapy are arranged by phone with little verification or record-keeping. Incumbent booking platforms monetize providers per booking regardless of whether the patient shows up — and the leading one has publicly diversified away from pure booking under unit-economics pressure, with its investor mark cut to roughly 78% below cost by March 2026.
Kiorex v2 answers with software providers want to use every day (Kiorly), demand that is paid for only when it converts into an attended new patient (Kiorex), and a settlement rule that makes the software free for providers Kiorex keeps busy — in the clinic or at the patient's home.

## 02 Business objectives
| ID | Objective | Measure | Target | By |
|---|---|---|---|---|
| BO1 | Become the default clinic system for new Egyptian private clinics | Active Kiorly clinic tenants (all tiers) | ≥ 850 / ≥ 3,500 | M12 / M36 |
| BO2 | Prove paid conversion of the founding cohort | Founding trial → paid conversion | ≥ 50% | M9 |
| BO3 | Build marketplace liquidity in launch clusters | Attended Kiorex new patients / listed provider / month | ≥ 12 | M12 |
| BO4 | Make Kiorly free for busy clinics | Share of listed paid clinics where C ≥ S | ≥ 15% / ≥ 25% | M24 / M36 |
| BO5 | Add Pharmacy and Lab as independent SaaS | Active pharmacy / lab locations | ≥ 1,500 / ≥ 300 | M36 |
| BO6 | Reach fundable unit economics | Gross margin; CAC payback (paid clinics) | ≥ 80%; ≤ 12 months | M18 |
| BO7 | Expand beyond Egypt by configuration | Second market live via certified market pack | Pilot live | M25 |
| BO8 | Earn patient trust | Verified-review coverage; complaint rate | 100% of reviews from completed visits; ≤ 0.5% of bookings | Ongoing |
| BO9 | Make home care a second demand engine | Share of attended Kiorex visits that are home visits; active Kiorly Nurse tenants | Estimated ≥10%; target set after pilot | M24 |

## 03 Stakeholders and their needs
- **Patients & caregivers (Kiorex)**: find a verified provider with a real slot in minutes — in clinic or at home; transparent fee, location, reviews; manage family members; share visit status with family; own copy of records, shared by consent.
- **Doctors (owner-physicians) (Kiorly Clinic)**: run the clinic from a phone; fill empty slots without paying for no-shows; safe Rx with Egyptian drug database; get paid and see revenue share; take home visits safely.
- **Front desk & clinic managers (Kiorly Clinic)**: one schedule for all channels and locations; check-in, split pay, cash close; WhatsApp reminders and waitlist; Arabic-first UI.
- **Physiotherapists (solo and centres) (Kiorly Clinic)**: find patients; visits grouped by area; session packages and treatment plans; progress tracking and outcome trends; home sessions with travel planned; referrals in from doctors.
- **Nurses (individual) (Kiorly Nurse)**: record care properly (notes, vitals, MAR); get paid without chasing; stay safe on visits.
- **Nursing agencies / home-care companies (Kiorly Nurse)**: roster, dispatch by zone and skill; care plans; family updates; nurse pay and cash reconciliation.
- **Pharmacists & owners (Kiorly Pharmacy)**: lot/expiry-accurate stock; fast POS with Rx validation; fewer expired write-offs; orders from Kiorex without new hardware.
- **Lab managers & technicians (Kiorly Lab)**: barcode accession and chain of custody; analyzer interfaces and QC; critical-value escalation; home collection scheduling.
- **Company (Kiorex) — Business**: predictable recurring revenue; low-cost supply acquisition; defensible data and workflow moat; regulatory standing in every market.
(Extraction of the stakeholder grid is interleaved; grouping of bullets per card is inferred.)

## 04 Scope
**In scope**: Kiorex patient marketplace: doctors first, then physiotherapy, home visits, home nursing, pharmacy orders and lab tests · Kiorly Clinic (built) incl. professions and home visits; Kiorly Nurse (edition); Kiorly Pharmacy; Kiorly Lab · Kiorex Account identity for patients and, later, providers · Kiorex Pay deposits and prepayments; provider payouts · Plans, trials, commissions, settlement, invoicing, dunning · Egypt, then one GCC market by configuration · AI scribe, assistant, no-show risk with honest labels.
**Out of scope (explicitly)**: Tax-authority e-receipts / ETA submission for clinics (ADR-011) · Operating pharmacies, labs, clinics or home-care services ourselves; employing or dispatching clinicians · Transporting medicines or medical waste · Emergency or ambulance services at home (routing to 123 only) · Selling medicines as merchant of record before Q5 is decided · Insurance underwriting; we integrate with payers/TPAs only · Autonomous clinical decisions by AI · Shared all-in-one medical database across products.

## 05 Business rules
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
| BR17 | Clinicians over the seat cap become read-only (cannot book or sign); data retained. | PL07 |
### Marketplace
| ID | Rule | Implemented / owned by |
|---|---|---|
| BR18 | A provider is listed LIVE only if verified for their profession (syndicate number and licence for that profession), profile ≥ 80% complete, bookable visit type and availability exist. | ON03 / PRVER |
| BR19 | Slot holds expire after 5 minutes; a booking without a valid hold or idempotency key is rejected. | KX04 |
| BR20 | Patient cancellation/reschedule windows default to 12 h; deposits refundable ≥ 24 h before; max 2 reschedules. | KX06 |
| BR21 | Clinic cancellations of marketplace bookings require a reason and always refund the deposit. | KX06 |
| BR22 | Only completed Kiorex-channel visits can produce a review; Kiorex moderates and is the source of truth. | KX08 |
| BR23 | Sponsored placement is always labelled and never influences verification or safety signals. | ADR021 |
| BR24 | Emergency symptoms in search route to approved emergency guidance, never to booking (incl. home nursing). | KX03 |
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
### Pharmacy & lab
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
### Professions & home care (v2.3)
| ID | Rule | Implemented / owned by |
|---|---|---|
| BR49 | Scope of practice is enforced per profession in every tier; physiotherapists and nurses can never issue drug prescriptions. | PRSOP |
| BR50 | Assistants without a professional licence (e.g. massage/electrotherapy diplomas) work only under a supervising licensed physiotherapist and are never listed. | PRSOP03 |
| BR51 | A home visit is bookable only inside the provider's coverage zones and only for a patient with a verified phone and a confirmed address. | HVBK |
| BR52 | The patient's full address is shared with the provider only after the booking is CONFIRMED and is masked 24 h after the visit. | HVPRV |
| BR53 | Every home visit records on-my-way, arrived and finished events with a geostamp; a visit not finished 30 min after its planned end raises a safety check. | HVSAF |
| BR54 | Home visits booked via Kiorex require a Kiorex Pay deposit by default (market-configurable). | KXMHV04 |
| BR55 | Commission for home visits follows BR02/03: one fee per attended new patient, never per visit; a care plan's later visits are never commissionable. | CR02 |
| BR56 | A home-visit surcharge set by the provider is part of the visit fee and shown before booking; Kiorex never adds its own surcharge for patients. | HVFEE |
| BR57 | A nurse administers medication only against a recorded doctor's order (shared from Kiorly Clinic with consent, or uploaded and confirmed). | KNMAR |
| BR58 | An individual nurse is listed on Kiorex only after gate GKN2 and stricter verification (ID selfie match, criminal-record certificate). | ADR032 |
| BR59 | The patient (or guardian) can share live visit status with up to 3 family contacts. | KXMHV07 |
| BR60 | Gender preference for home visits is a patient filter; providers may limit home-visit types by patient gender only through their own settings. | HVBK06 |
| BR61 | A provider may end a home visit and leave if they feel unsafe; this is never a no-show and never counts against them. | HVSAF04 |
(Step codes appear unhyphenated in extraction, e.g. "PRSOP", "HVBK", "KXMHV04"; hyphenation of the latter ambiguous, likely KXM-HV-04.)

## 06 End-to-end journeys
The seven journeys every release must keep working.
**J1 Patient finds and sees a new doctor**: search specialty + area → GET slots (cached 60 s) → pick slot → POST hold (5 min) → POST booking (Idempotency-Key) → auto-confirm or queue → APPOINTMENT_CONFIRMED (outbox) → confirmation + reminder → check-in → charge PENDING → COMPLETED → review invite. Kiorly is the authority; Kiorex holds intent and attribution.
**J2 Clinic signs up free and becomes paid**: OTP signup — ready clinic → wizard import · invite → activate (20 visits / 30 d) → trial ends (card on file?) → paid or Lite, data retained.
**J3 Monthly settlement**: close month 02:00 Cairo day 1 → sum S and C (confirmed only) → apply trial/prepaid policy → credits & VAT (wallet FIFO) → invoice & statement (PDF AR/EN) → collect (card · Fawry · InstaPay).
**J4 Prescription to pharmacy (phase 2)**: Doctor signs Rx in Kiorly Clinic → patient consents to share → Kiorex shows nearby Kiorly Pharmacy stock availability → patient orders → pharmacist validates and dispenses in Kiorly Pharmacy → delivery or pickup → DispenseCompleted updates Kiorex order.
**J5 Lab test booking to result (phase 2)**: Patient books a test or home collection on Kiorex → Kiorly Lab creates order and accession → collection with barcode → analyzer result → QC → authorized release → LabResultReleased to patient vault and ordering doctor with consent.
**J6 Home visit (doctor or physiotherapist)**: 1 Search home address + "Home visit" → 2 Coverage: in-zone home slots → 3 Book: hold · deposit · confirm → 4 On my way: address revealed → 5 Arrived: geostamp = check-in → 6 Finished: review · address masked 24 h.
**J7 Home nursing care plan**: 1 First visit: nurse or agency booked → 2 Assess: note · vitals · doctor's order → 3 Propose plan (e.g. dressing × 14 days) → 4 Schedule recurring visits; agency assigns → 5 Each visit: tasks · vitals · MAR · family update → 6 Discharge note; record shared by consent.

## 07 Non-functional business requirements
| Area | Requirement |
|---|---|
| Language | Arabic-first with English; Egyptian-dialect patient copy reviewed by native speakers (UX03). |
| Devices | Front desk on tablet and phone; clinician and nurse views mobile-first; installable PWA with offline 'today' (UX01/02). |
| Performance | Marketplace slots p95 ≤ 150 ms at 50 rps; mobile TTI ≤ 4 s on 4G (QA07). |
| Availability | Booking API ≥ 99.5% monthly; Kiorly critical workflows independent of Kiorex. |
| Recovery | RDS PITR; quarterly restore drill with recorded RPO/RTO (SC08). |
| Auditability | Every money, plan, consent, clinical and home-visit safety event audited with actor and timestamp (SC07). |
| Safety response | Home-visit safety alerts delivered ≤ 60 s and resolved ≤ 15 min. |
| Support | WhatsApp support Sun–Thu 09:00–18:00 Cairo with measured first-response SLA (GT04); home-visit complaints ≤ 1 h SLA. |

## 08 Assumptions, constraints and dependencies
| Type | Item | Status |
|---|---|---|
| Assumption | Doctors will adopt a free tool that also brings patients | Estimated — validate in pilot |
| Assumption | Patients accept small deposits for high-risk and home bookings | Estimated |
| Assumption | Nurses and agencies will pay for Kiorly Nurse at the KX23 price points | Proposed — ≥15 WTP interviews |
| Constraint | Meta WhatsApp templates must be approved before automated sends (NH003…015) | Open |
| Constraint | Counsel review of legal pack before charging or listing | Open |
| Constraint | Counsel memos GHV1 (home visits) and GKN2 (individual nurse listing) before those flags take effect | Open |
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
| BR49…61 | KX05 §06–08, KX23 Kiorly Nurse, KX03 | KX08, KX09, KX16 |

## 10 Sources & evidence
Internal facts trace to repository mshall/clinics-management (commit 6b24a79, 19 Nov 2026) or founder decisions in KX01.
- Ken Research, Egypt E-Pharmacy & Digital Health Market 2025 (base): population 118.4M; e-pharmacy & digital health USD 69M (2025) → USD 236M (2032). EDA Q3 2026: 87,608 licensed pharmacies.
- Arab Finance 2025: Egypt pharmaceutical market EGP 422B (USD 8.5B, 4B units). TechSci Research: Egypt diagnostic labs market USD 2,267M (2024).
- Launch Base Africa 24 Apr 2026: Vezeeta stake marked 78.6% below cost; implied valuation ≈ USD 22.4M (Mar 2026); pivot to operating a medical building.
- NEW: Law 3 of 1985 regulating the practice of physiotherapy; Nursing Professions Syndicate law (membership required to practise); Law 51 of 1981 on medical establishments — see KX15. Enterprise 2025 home-nursing operators such as 7keema and Tabibi 24/7 have institutionalised home nursing in Egypt.
- Kiorly repository Docs: BOOKING_ATTRIBUTION, KIOREX_COMMISSION_CHARGES, MONTHLY_SETTLEMENT, KIOREX_MARKETPLACE, PLANS_AND_ENTITLEMENTS, TRIAL_ENGINE, kiorly-cursor-build-sequence §24.

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built. Rev 2.4: where this section differs from the Rev 2.4 as-built update at the end of the volume, the end section wins.

| Item | Status | Detail |
|---|---|---|
| New business objective G-ACQ: acquire patients through provider-owned and organic channels at a cost below what Kiorex earns | Proposed | Measured by provider-led share, organic share and MER (KX-32) |
| BR (existing) 12, referral reward | As-built | One free month for both sides is the provider-to-provider programme only (CR-09); it is not a patient programme |
| New BR (proposed number to assign): patient referral | Open decision | Reward only after the referee's first attended visit and refund window; closed-loop discount credit or coupon; counsel-gated (KX-30 section 09) |
| New BR: provider-led protection | Proposed | A booking credited to a provider's own link, QR or widget never carries a Kiorex fee; evidence is stored and visible to the provider (KX-30) |
| New BR: marketing consent | Proposed, Regulatory dependency | No marketing message without recorded, versioned consent per channel; STOP and إلغاء honoured (KX-24, KX-27 GR-5xx) |
| Stakeholders added | Proposed | Marketing and SEO lead, DPO and counsel as owners of growth gates |
| Traceability | Proposed | KX-27 requirement ids GR-101 to GR-602 map to work packages GRW-P1-A to M in KX-33 |

Not verified: counsel opinion on consent and marketing licensing.

## Rev 2.4 as-built update (24 Nov 2026)
Rev 2.4 verification (24 Nov 2026): this volume was re-read against the repositories; the only changes are status refreshes. Labels as in KX-27; nothing is deployed.
- Status refresh only: the Phase 1 requirements behind BO and BR items mentioned in the Growth update above (provider-led promise, evidence, consent-gated analytics) are As-built locally (KX-27 section 07, KX-33 section 04). No business requirement changed in Rev 2.4. Nothing is deployed and the gates in KX-33 section 06 are open.
