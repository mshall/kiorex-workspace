# KX06 — Kiorly Pharmacy PRD

Source: 16xpvUfI-F2iI1IR6lk461_o6B0qIcsRw
Revision: Rev 2.4 · Reference Edition, updated 24 November 2026 (previous: Rev 2.3, 23 November 2026; this update adds the Rev 2.4 as-built section at the end, status-labelled)

Pharmacy operating software for Egypt's 88,000 licensed pharmacies: lot-accurate inventory, pharmacist-gated dispensing, fast POS, supplier automation — and, when ready, Kiorex orders.

Authored in the role of Head of Pharmacy Product. Written with a licensed clinical pharmacist's operating view.

Tags: Inventory & lots · Rx validation · POS · Suppliers & recalls · Kiorex orders (phase 2)

| Field | Value |
|---|---|
| DOCUMENT | KX06 |
| REVISION | Rev 2.4 · Reference Edition (updated 24 Nov 2026) |
| DATE | 23 November 2026 (first issued 20 November 2026) |
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

## 08 Build status (23 Nov 2026)
Observed in `kiorly-pharmacy` (60 commits since 19 Nov) and the e2e suite 17. Local development only; the pharmacy pilot remains month 13 (ADR-017).

| Capability | Status | Evidence and caveat |
|---|---|---|
| Pharmacy module in the Kiorly staff app: Rx queue and validation (`rx.validate`), interaction override with reason and pharmacist sign-off, FEFO dispensing, receiving purchase orders (partial then full), stock count with manager approval, expiry and recalled-lot screens, controlled-drug discrepancy with a different witness, online Kiorex orders, shift open and close | Done (dev) | e2e suite 17: 30 tests on 21 Nov; Expo web per-role spec 19 tests; pharmacy modules not run on iOS or Android simulators |
| Role rules: cashier cannot validate, receive, count or witness; assistant and manager can receive and count; managers have the validate screen | Done | Bugs fixed 21 Nov: recalled lot invisible on the expiry screen, no alert for a recalled lot without a notice, `lots?status=bad` returned 500 |
| Plan gate: Lite pharmacy gets a safety-alert slice and an upgrade request; the plan gate answers before RBAC errors; witness route exempt from the plan gate | Done | `mobile_staff_app` ON for Pro, Chain, Enterprise (not when the subscription is suspended) |
| Provider adapters: SMS, email, WhatsApp, payment (pay-by-link), push (Expo-compatible HTTP), storage (signed URLs), consent registry, AI gateway | Done (not live) | Mock by default; `CONSENT_MODE`, `AI_MODE` (token and daily budget guards) and `STORAGE_MODE` added 22 Nov; webhook `POST /api/v1/webhooks/providers/{sms,email,whatsapp,payment,consent}`; dev tools under `/api/v1/dev/providers/*` |
| Consent registry wire format | Open | An assumption (`POST /consents`, `GET /consents`, `POST /consents/{id}/revoke`, `POST /consents/introspect`); adapt `consent.mapping.ts` to the real service |
| AI daily token budget | Open | Counted per API instance; needs a shared counter before scaling out |
| Pharmacy on the shared notification layer | Planned (step 4 of 5) | REMINDER and TRANSACTIONAL templates; existing consent registry becomes the preference store |
| Kiorex order mirror (`KIOREX_MODE=real` flag polling) | Open | On in `e2e/scripts/up.sh`; not exercised on a deployed stack |
| Real vendor credentials, PSP onboarding | Blocked | Human, see `kiorly-pharmacy/Docs/NEEDS_HUMAN.md` |

> **Note** Demo tenants (DEV ONLY): Solo (Pro), Corner (Lite), chain, with `seed:mobile` alerts; web port defaults to 5192 (`PHARMACY_WEB_PORT`).

## What changed in this revision (23 Nov 2026)
- Revision header moved from Rev 2.2 to the 23 Nov 2026 update (the 20 Nov edition did not revise this volume).
- Added §08 build status for the mobile pharmacy module, provider adapters (consent, AI, storage), plan gate and role fixes.
- Product requirements, dispensing flow, commercial model and compliance gates are unchanged.
- Not verified: pharmacy modules on a simulator or device, any real vendor.

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built. Rev 2.4: where this section differs from the Rev 2.4 as-built update at the end of the volume, the end section wins.

- Pharmacy has no growth surface today (the repository is a scaffold until M9). Proposed Phase 4: pharmacy public pages `/{locale}/{cc}/pharmacy/{slug}` with `Pharmacy` structured data and provider links, only when `kiorex.pharmacy_orders` is effective (launch-locked). Roadmap, GRW-P4-2.
- Pharmacy consent and notification registries still have to adopt KX-24 before any marketing; until then no pharmacy marketing messages exist (Open).
- Pharmacy data never enters acquisition segments; no ad audience is ever built from pharmacy or prescription data (Proposed rule, enforced by tests).

## Rev 2.4 as-built update (24 Nov 2026)
Rev 2.4 verification (24 Nov 2026): checked against the repositories, with the suites re-run the same day (counts in KX-33 section 04). As-built means in code with a passing test on the local stack; nothing is deployed or pushed and every provider is mocked. This section wins over the Growth Engine update above wherever they differ.

- **Quick setup (As-built).** The Pharmacy first-run checklist (Finish setup) opens each screen, auto-detects completion and is tested (Pharmacy 4 of 4 Playwright runs, 6 rule tests; the implementing agents' record).
- **Connect to Kiorex wizard (As-built, ADR-040).** Branch opt-in, priced catalogue, hours and collection, licence number and document, payout label placeholder (an account-number-like input is refused, no bank data stored), terms; a signed request carries a freshly issued HMAC client and webhook secret, stored encrypted by Kiorex until Go live. A rejection returns the pharmacy to STANDALONE. The Kiorex tab shows the five-state front door.
- **Routing (As-built).** Orders, carts and webhooks are routed per partner registration, so a second live pharmacy is served; the launch gate `kiorex.pharmacy_orders` stays human evidence only.
- **Staff sign-in (As-built).** Public PKCE client `kiorly-pharmacy-web`, back-channel logout at `/api/v1/auth/oidc/backchannel-logout`, phone linking (off by default in production), Kiorly Home handoff, staff phone editable by owners.
- **Growth (As-built, limited).** A pharmacy page exists in the public site (`/{locale}/{cc}/pharmacy/{slug}`) as a brand page for a LIVE partner only when `kiorex.pharmacy_orders` is effective; there is no provider-link service and no Growth tab in Pharmacy. Contracts 1.11.0 are vendored.
- **Security (As-built).** Security headers, Swagger off in production, trusted-proxy handling, dummy hash compare for unknown users, constant-time SNS secret compare, NUL characters refused with 400; the edge sweep fixed cancel-versus-accept races (F12) and hostile cart lines.
- Tests: Pharmacy API unit and marketplace e2e pass in the edge run (216 and 17). Not verified: real SMS and WhatsApp providers, licence verification in production.
