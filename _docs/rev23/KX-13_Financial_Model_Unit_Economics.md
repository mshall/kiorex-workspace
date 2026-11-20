# KX-13 36-Month Financial Model & Unit Economics

Source: 1FBBBnCWZ4RlIY71XahyLPRwTTbvFVHdf
Revision: Rev 2.3 · Reference Edition (20 November 2026; supersedes KX13 Rev 2.1, 19 Nov 2026)

> Extraction note: text from Drive read_file_content; several symbols (>=, <=, +/-, arrows) lost; table numeric cells in this read ARE present (the older extract lost them).

A driver-based model of revenue, costs, cash and runway for the Kiorex ecosystem — with scenarios, sensitivities, unit economics and the gates that release capital.

- Authored in the role of Chief Financial Officer. Owns the model, capital plan, unit economics and financial controls.
- Tags: Driver-based · 3 scenarios · P&L + cash · Unit economics · Funding gates
- DOCUMENT: KX13 | REVISION: Rev 2.3 · Reference Edition | DATE: 20 November 2026 | STATUS: Approved reference
- AUDIENCE: Founders, investors, board | OWNER ROLE: Chief Financial Officer | SUPERSEDES: KX13 Rev 2.1 19 Nov 2026

## WHAT CHANGED IN REV 2.3 (as printed)
Model outputs unchanged in this revision: physiotherapists, home visits and Kiorly Nurse are not yet modelled. New §04 lists the drivers to add (owner: CFO before the next monthly refresh); Series A gate list notes the Nurse pilot as supporting evidence.

## Contents
01 Headline results (base case) · 02 Model structure · 03 Key assumptions · 04 Drivers to add (v2.3 scope) · 05 Revenue build · 06 Customers and the 'Kiorly is free' effect · 07 P&L and cash · 08 Scenarios · 09 Unit economics (paid clinic, base, month 24) · 10 Sensitivities (base, impact on M36 monthly revenue) · 11 Funding plan and capital gates · 12 Financial controls

WATCH: Status: Estimated. Month 1 = January 2027. All values in EGP unless marked; USD at a planning rate of EGP 50 = USD 1. Planning assumptions, not forecasts or results. Replace inputs with observed pilot cohorts monthly. Rev 2.3 does not change any output figure: new professions, home visits and Kiorly Nurse enter the model at the next refresh (§04).

## 01 Headline results (base case)
- Monthly revenue M12: EGP 0.54M
- Monthly revenue M24: EGP 4.1M
- Monthly revenue M36: EGP 16.0M (~USD 3.8M ARR)
- Gross margin M36: 87%
- Paying clinics M36: 938 (+ 2,357 Lite)
- Pharmacies / Labs M36: 1,619 / 334
- Seed cash-out (USD 4M) without Series A: M27
- Series A window: M15–M20, gated, see §11

## 02 Model structure
Pipeline: Signups (by month & product) → Cohorts (trial → paid / Lite / churn) → Price & usage (plans · fees · add-ons) → Higher-of (per clinic, distribution) → Revenue (by engine) → Costs (COGS + opex) → Cash (runway & gates).

The higher-of rule is modelled per clinic, not on averages: each paying clinic's monthly Kiorex patients follow a log-normal distribution (sigma = 0.9) around the cluster mean, and revenue is the expected value of max(S, C).

## 03 Key assumptions

| Driver | Base value | Basis |
|---|---|---|
| New clinic signups / month | 30 (M1) → 120 (M12) → 190 (M24) → 240 (M36) | Founder-led + field reps in 2 Cairo/Giza clusters, then national |
| Signup mix | Lite 55% · Pro 35% (1.3 doctors) · Clinic 10% (7 doctors) | Market structure: mostly single-doctor clinics |
| Trial | 6 months for signups M1–M8 (founding), 3 months after | ADR010 |
| Trial → paid conversion | 55% (downside 45%, upside 62%) | To validate in pilot |
| Failed trials → Lite | 60% (rest churn) | Assumption |
| Monthly churn | Paid 2.0% · Lite 3.5% | SMB SaaS benchmark range |
| Prices | Pro EGP 1,149 blended per doctor · Clinic EGP 4,897 · +15%/yr indexation | PL01 seed; Egypt inflation |
| Kiorex patients / listed doctor / month | 2 (M1) → 14 (M12) → 22 (M24) → 28 (M36); 70% of clinics listed | Liquidity ramp |
| Kiorex fee | EGP 40 per attended new patient, indexed | CR04 placeholder |
| AI scribe | 15% of paid doctors x EGP 400 from M7 | Add-on |
| Pharmacy | Signups 15 → 150/mo from M13; EGP 1,000 ARPA; 60% on marketplace; 20 → 120 orders x EGP 450 x 4% | KX06 |
| Lab | Signups 4 → 40/mo from M19; EGP 1,800 ARPA; 10 → 50 bookings x EGP 900 x 8% | KX07 |
| Enterprise | 1 contract per quarter from M15 at EGP 25k/month | KX14 |
| Market 2 GCC | From M25 15 → 60 clinic signups/mo; 3x EGP-equivalent ARPA | KX18 |
| Team | 14 FTE (M1) → 28 (M12) → 46 (M24) → 60 (M36) at USD 3,000 loaded | Egypt-based engineering & ops |
| Sales & marketing | USD 25k → 40k (M7) → 60k (M13) → 80k (M25) per month | Field reps, content, patient acquisition |
| COGS | Cloud USD 2.5k → 15k; AI USD 1.5/active doctor; WhatsApp USD 3/clinic; PSP 2.5% of revenue | AWS + vendor pricing |
| G&A | USD 15k → 30k / month; Market-2 launch USD 40k/month from M22 | Legal, finance, compliance, pen tests |

## 04 Drivers to add (v2.3 scope)
Physiotherapists, home visits and Kiorly Nurse are specified (KX05 §06–08, KX23) but not yet in the model. Each driver below is added as Estimated, with owner and date, at the next monthly refresh.

| Driver to add | Source of first estimate | Affects |
|---|---|---|
| Physiotherapist signups / month and mix (solo vs centre) | Physical Therapy Syndicate counts in launch clusters; pilot | Engine A (Clinic ladder), physio pack add-on |
| Share of Clinic tenants enabling home visits; home share of attended Kiorex new patients | Pilot (from M10) | Engine B |
| Kiorly Nurse signups: solo vs agency; trial → paid; ARPA by plan (Nurse Pro EGP 399, Agency EGP 1,999 + 149/nurse) | >=15 WTP interviews (KX23), Nurse pilot M13–15 | Engine A |
| Home-nursing first-visit commission volume (care-plan follow-ups excluded) | Agency interviews; Kiorex home-nursing launch M16–18 | Engine B |
| Safety on-call rota and 1 h home-visit complaint SLA | Ops plan (KX18) | Opex |
| Maps / geocoding cost per home visit | AWS Location pricing | COGS |

## 05 Revenue build
Monthly revenue by engine — base case, EGP thousands per month. Figure 1 (stacked chart): Clinic paid max(S,C); Lite Kiorex fees; Trial commission above plan; AI scribe; Pharmacy SaaS; Pharmacy orders; Lab SaaS; Lab bookings; Enterprise; Market 2. Caption: Clinic revenue is subdued until founding trials end (M7–M14), then compounds with marketplace liquidity.

| Revenue line | M6 | M12 | M18 | M24 | M30 | M36 |
|---|---|---|---|---|---|---|
| Clinic paid — max(S, C) | 0 | 270 | 941 | 1,616 | 2,798 | 3,884 |
| Lite Kiorex fees | 36 | 201 | 546 | 991 | 1,739 | 2,445 |
| Trial commission above plan | 6 | 53 | 89 | 162 | 271 | 370 |
| AI scribe add-on | 0 | 17 | 55 | 88 | 145 | 191 |
| Pharmacy SaaS | 0 | 0 | 181 | 569 | 1,314 | 2,142 |
| Pharmacy marketplace | 0 | 0 | 75 | 369 | 1,277 | 2,775 |
| Lab SaaS | 0 | 0 | 0 | 96 | 373 | 797 |
| Lab marketplace | 0 | 0 | 0 | 83 | 536 | 1,594 |
| Enterprise | 0 | 0 | 57 | 115 | 198 | 264 |
| Market 2 | 0 | 0 | 0 | 0 | 510 | 1,510 |
| Total (EGP thousands / month) | 42 | 541 | 1,944 | 4,090 | 9,160 | 15,971 |

## 06 Customers and the 'Kiorly is free' effect
Figure 2: Active provider locations (base) — Active clinic tenants, Paying clinics, Pharmacies, Labs (M6, M12, M24, M36; y axis to ~4,000). Same figures as the KX14 funnel targets.

Share of listed paid clinics where commission exceeds subscription ('Kiorly is free'): 10% at M12, 19% at M24, 25% at M36 (base). Attended Kiorex visits reach 109,430 per month by M36.

## 07 P&L and cash

| EGP millions | Year 1 (2027) | Year 2 (2028) | Year 3 (2029) |
|---|---|---|---|
| Revenue | 1.7 | 26.8 | 120.2 |
| COGS (cloud, AI, messaging, PSP) | 3.9 | 10.4 | 20.0 |
| Gross profit | −2.2 [sign lost in extraction] | 16.3 | 100.2 |
| Payroll | 37.5 | 68.8 | 96.5 |
| Sales & marketing | 19.5 | 36.0 | 48.0 |
| G&A | 10.5 | 13.6 | 16.6 |
| Market-2 launch | 0.0 | 6.0 | 24.0 |
| EBITDA | −69.7 [sign lost] | −108.2 [sign lost] | −84.9 [sign lost] |

(Signs inferred: Y1 revenue 1.7 − COGS 3.9 = −2.2; EBITDA rows printed without signs in the text layer.)

With the USD 4M seed and no further funding, cash falls below zero in M24 (downside) and M27 (base); the upside reaches EBITDA break-even in M31 without a Series A (§08).

## 08 Scenarios

| Scenario | Rev M12 (EGP M) | Rev M24 | Rev M36 | ARR M36 (USD M) | Paid clinics M36 | EBITDA +ve month | Cash = 0 |
|---|---|---|---|---|---|---|---|
| Downside | 0.22 | 1.8 | 6.7 | 1.6 | 482 | — | M24 |
| Base | 0.54 | 4.1 | 16.0 | 3.8 | 938 | — | M27 |
| Upside | 1.02 | 7.4 | 29.1 | 7.0 | 1,437 | M31 | none |

| Scenario lever | Downside | Upside |
|---|---|---|
| Signups | −30% | +30% |
| Trial conversion | 45% | 62% |
| Kiorex patients per doctor | −40% | +40% |
| Churn | 1.5x | 0.8x |
| Price realisation | −10% | +5% |
| Costs | +5% | flat |

## 09 Unit economics (paid clinic, base, month 24)
- ARPA paid clinic / month: EGP 3,239 (higher-of expected value)
- Gross margin: 71%
- Blended CAC (assumption): EGP 12,500 (~USD 250 incl. rep + onboarding)
- CAC payback: 5.4 mo (target <12)
- LTV (2% churn): EGP 115,498
- LTV / CAC: 9 (target >3)

NOTE: Lite clinics have near-zero CAC (self-serve) and pay only Kiorex fees; they are the marketplace's supply engine and the funnel for Pro conversion. Nurse Lite plays the same role for home nursing once modelled.

## 10 Sensitivities (base, impact on M36 monthly revenue)
Figure 3 (tornado): Kiorex patients/doctor ±30% → 18%; Signups ±20% → 20%; Price ±10% → 10%; Churn ±50% → 9%; Trial conversion ±45% → 4%. (Signs lost; pairing approximate.)

## 11 Funding plan and capital gates

| Use of seed USD 4M | Share | Notes |
|---|---|---|
| Engineering & product (Kiorex, Kiorly, Pharmacy) | 55% | Payroll-led |
| Sales & marketing (clinic acquisition + patient demand) | 25% | Founding cohort and two clusters |
| G&A, legal, compliance, security | 12% | PDPC filings, pen tests, counsel (incl. home-visit and nursing memos) |
| Cloud, AI, messaging | 8% | Scales with usage |

| Series A gate (all required) | Threshold | Status |
|---|---|---|
| Paying clinics (>=3 months tenure) / total active tenants | >=300 / >=1,400 | Estimated M18 |
| Founding trial → paid conversion | >=50% | Pilot |
| Attended Kiorex new patients / listed provider / month (launch clusters) | >=12 | Pilot |
| Net revenue retention (paid clinics) | >=100% | M15 |
| Gross margin | >=80% | Model 85% |
| Kiorly Pharmacy pilot live | >=20 pharmacies | M13–M15 |
| Security | Pen test passed, restore drill recorded | NH017/018 |
| Supporting evidence (not a gate) | Home-visit share and Kiorly Nurse pilot results | M13–M18 |

DECISION: Raise a Series A of USD 8–10M in the M15–M20 window against these gates, sized for 24 months of runway through Market 2 and Lab GA. If gates slip, cut S&M to USD 40k/month and defer Market 2 — extends seed runway by roughly 4–6 months. If team capacity binds, Kiorly Nurse GA moves before Pharmacy GA does (KX18).

## 12 Financial controls
- Monthly close: PSP statements ↔ Kiorly invoices ↔ settlement summaries; Kiorex Pay ledger ↔ PSP; payouts ↔ provider deposits; per-clinician cash-at-home drawers ↔ shift close.
- Revenue recognition: subscriptions over service period; commissions on CONFIRMED attendance (home: arrival); marketplace order fees on fulfilment (agent treatment — confirm with auditor). Every model input tagged Observed / Validated / Estimated with owner and date; model versioned alongside this document.
- Board pack monthly: cohort table, higher-of share, burn, runway, gate status.
