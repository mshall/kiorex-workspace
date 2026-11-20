# KX06 — Kiorly Pharmacy PRD

Source: 16xpvUfI-F2iI1IR6lk461_o6B0qIcsRw

Pharmacy operating software for Egypt's 88,000 licensed pharmacies: lot-accurate inventory, pharmacist-gated dispensing, fast POS, supplier automation — and, when ready, Kiorex orders.

Authored in the role of Head of Pharmacy Product. Written with a licensed clinical pharmacist's operating view.

Tags: Inventory & lots · Rx validation · POS · Suppliers & recalls · Kiorex orders (phase 2)

| Field | Value |
|---|---|
| DOCUMENT | KX06 |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Founders, investors, engineering & operations leads |
| OWNER ROLE | Head of Pharmacy Product |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026 |

## Contents

01 Opportunity · 02 Users and editions · 03 Functional requirements · 04 Dispensing flow and lot lifecycle · 05 Commercial model and pilot plan · 06 Compliance and release gates · 07 Sources & evidence

## 01 Opportunity

Large, fragmented, under-digitized supply with heavy working capital in stock.

| Metric | Value | Source |
|---|---|---|
| Licensed pharmacies | 87,608 | EDA, Q3 2026 |
| Packs sold / year | 4B | largest MEA market by packs |
| Pharma market 2025 | EGP 422B | Arab Finance |
| Pharmacies on Yodawy network | 3,000 | 2023 disclosure |

Independent pharmacies lose margin to expiry write-offs, stock-outs and manual price updates after frequent price revisions. Chains run legacy ERPs. E-pharmacy players (Chefaa, Yodawy, Vezeeta pharmacy) route orders to pharmacies but do not run the pharmacy. Kiorly Pharmacy runs the pharmacy; Kiorex later sends it orders.

WHY: Same playbook as clinics: be the daily system first. A pharmacy that already manages stock in Kiorly can accept Kiorex orders with accurate availability — something order-routing apps cannot guarantee.

## 02 Users and editions

| Persona | Needs | Edition |
|---|---|---|
| Owner-pharmacist (1 branch) | Stock, expiry, daily cash, supplier credit | Lite / Pro |
| Pharmacist on shift | Fast POS, Rx check, substitutions, controlled items log | All |
| Assistant / cashier | Barcode sale, returns, shift close | All |
| Chain operations manager | Multi-branch stock, transfers, central pricing, reports | Chain / Enterprise |

| Capability | Lite (free) | Pro (per branch) | Chain | Enterprise |
|---|---|---|---|---|
| POS, catalogue, lots/expiry, Rx validation, controlled log, recall block | ✓ | ✓ | ✓ | ✓ |
| Users / branches | 2 / 1 | 5 / 1 per branch | Unlimited | Unlimited |
| Purchase orders, supplier credit, auto-reorder | — | ✓ | ✓ | ✓ |
| Expiry & demand forecasting | — | ✓ | ✓ | ✓ |
| Inter-branch transfers, central price book | — | — | ✓ | ✓ |
| Insurer/TPA eligibility & claims | — | Add-on | ✓ | ✓ |
| Kiorex orders | Fee per fulfilled order | Commission credited vs subscription | Credited | Negotiated |

RULE: Safety controls — expiry/recall blocks, Rx validation, controlled-substance log, pharmacist sign-off — are in every edition including Lite (P5).

## 03 Functional requirements

### Catalogue (KPCAT)

| ID | Requirement |
|---|---|
| KPCAT01 | Drug master seeded from Kiorly's Egyptian drug database (brand ↔ active ingredient, strength, form, pack, GTIN/barcode, price). |
| KPCAT02 | Regulatory flags: Rx-only, controlled schedule, cold-chain, OTC; market-specific codes. |
| KPCAT03 | Bulk price updates with effective dates; history retained; shelf label printing. |
| KPCAT04 | Generic substitution groups by active ingredient + strength + form. |

### Inventory (KPINV)

| ID | Requirement |
|---|---|
| KPINV01 | Receive by PO or direct: lot, expiry, quantity, cost, supplier invoice; barcode/GS1 scan. |
| KPINV02 | FEFO picking (first-expiry-first-out) suggested at POS. |
| KPINV03 | Block sale of expired, recalled or quarantined lots; negative stock only with manager permission and audit. |
| KPINV04 | Near-expiry alerts (90/60/30 days) with return-to-supplier workflow. |
| KPINV05 | Stock counts (cycle and full) with variance approval. |
| KPINV06 | Cold-chain items: temperature log entry; excursion → quarantine. |
| KPINV07 | Available-to-promise per SKU and branch exposed to Kiorex (phase 2). |

### Prescriptions & dispensing (KPRX)

| ID | Requirement |
|---|---|
| KPRX01 | Capture Rx: scan paper, receive Kiorly e-Rx (PrescriptionIssued with patient consent), or Kiorex upload. |
| KPRX02 | Validate prescriber (Kiorly-verified doctor badge where available), patient, dose, quantity. |
| KPRX03 | Interaction / allergy / duplicate checks by active ingredient (shared engine with CL02). |
| KPRX04 | Substitution requires pharmacist decision and patient consent; recorded. |
| KPRX05 | Controlled medicines: dispensing log per EDA rules, ID capture, quantity limits; never exposed to Kiorex ordering. |
| KPRX06 | Pharmacist sign-off (user + timestamp) on every Rx dispense; counselling notes optional. |

### POS & money (KPPOS)

| ID | Requirement |
|---|---|
| KPPOS01 | Barcode sale ≤ 3 s per line; offline mode with queued sync. |
| KPPOS02 | Payments: cash, card, InstaPay, Fawry, wallet; split tender. |
| KPPOS03 | Returns and voids with reason and manager approval; restock to correct lot. |
| KPPOS04 | Shift open/close, Z-report, variance threshold alert to owner via WhatsApp. |
| KPPOS05 | Customer accounts and credit (common in neighbourhood pharmacies) with limits. |
| KPPOS06 | Receipt printing (thermal); no tax-authority submission by Kiorly (pharmacy issues its own fiscal documents). |

### Suppliers (KPSUP)

| ID | Requirement |
|---|---|
| KPSUP01 | Supplier catalogue, terms, credit balance, payments. |
| KPSUP02 | Auto-reorder suggestions from min/max and forecast; one-tap PO via WhatsApp/email. |
| KPSUP03 | Recall notices: block affected lots across branches within 5 minutes of entry. |

### Kiorex orders (KPMKT, phase 2)

| ID | Requirement |
|---|---|
| KPMKT01 | Opt-in per branch; delivery radius, hours, prep time. |
| KPMKT02 | Order inbox with SLA timer; accept / partial / reject with reason. |
| KPMKT03 | Reservation of lots on accept; release on cancel. |
| KPMKT04 | Rx orders require pharmacist validation before acceptance. |
| KPMKT05 | DispenseCompleted / OrderReady / OrderRejected events to Kiorex. |

NOTE: Every Kiorly Pharmacy capability above ships ON by default and can be switched off from the Kiorex super admin (`pharmacy.module`, `pharmacy.kiorex_orders`, `pharmacy.forecasting`, `pharmacy.insurer_claims`) — catalogue in KX08. Dispensing safety controls are not flags.

EVIDENCE: Design input: the 2025 kiorex-backend pharmacy-service and inventory-service (medication, interaction, allergy, prescription, inventory entities) are reference material only — re-model in Prisma with lots, expiry and FEFO; no code reuse (KX22, ADR-026).

## 04 Dispensing flow and lot lifecycle

Dispensing flow (7 steps):

1. Rx / order in — paper · e-Rx · Kiorex
2. Validate — interactions · prescriber · dose · allergy
3. Safety checks
4. Reserve lot — FEFO
5. Pharmacist sign-off — required
6. Dispense & pay — patient · POS
7. Event out — DispenseCompleted

Lot lifecycle states: RECEIVED → AVAILABLE → (order) RESERVED → (sign-off) DISPENSED. QUARANTINE (on excursion / recall); EXPIRED / RECALLED (date / recall) — blocked, return to supplier.

Lot states — sale is impossible outside AVAILABLE/RESERVED.

## 05 Commercial model and pilot plan

| Item | Test point | Validation |
|---|---|---|
| Pro subscription | EGP 1,000 / branch / month (test 500–1,850) | 15 owner interviews; pilot willingness to pay |
| Lite | Free; pays only Kiorex order fees | Adoption rate in pilot cluster |
| Kiorex order fee | 4% of fulfilled order value | Net of PSP, delivery and refunds |
| Higher-of rule | Same as clinics: max(subscription, order fees) | Settlement engine reuse |

Pharmacy timeline (quarters Q1–Q12 from January 2027):

- Discovery: 15 interviews, 3 chains
- Build MVP on commerce kernel
- Pilot: 20 pharmacies, 2 clusters
- Egypt GA
- Kiorex orders marketplace: M13 pilot, M16 GA

## 06 Compliance and release gates

| Gate | Evidence |
|---|---|
| Regulatory review | Counsel memo on pharmacy software, controlled-medicine logging, e-Rx acceptance and online ordering rules |
| Clinical pharmacist sign-off | Hazard log for dispensing and substitution (KX16) |
| Stop-ship tests | Expired/recalled lot sale attempt fails; Rx-only item without sign-off fails; offline POS reconciles |
| Marketplace readiness | Merchant of record and delivery partner decided Q5; refund flows tested |

## 07 Sources & evidence

Every external figure in this document traces to one of these sources; internal facts trace to the Kiorly repository (mshall/clinics-management, commit 6b24a79, 19 Nov 2026) or to founder decisions recorded in KX01.

- EDA Q3 2026 licensing highlights: 87,608 licensed pharmacies.
- Business Monthly: EDA chairman Q&A, 80,000–86,000 registered pharmacies.
- Arab Finance 2025: EGP 422B pharma market, 4B units.
- Scene Now: Yodawy Series B, 3,000 pharmacies integrated, eight insurers.
- Kiorly repository: EGYPT_DRUG_DATABASE.md, CLINICAL_RX_SAFETY.md.
