# KX-13 36-Month Financial Model & Unit Economics

Source: 1FBBBnCWZ4RlIY71XahyLPRwTTbvFVHdf
Revision: Rev 2.4 · Reference Edition, updated 24 November 2026 (supersedes KX13 Rev 2.3, 20 Nov 2026; Rev 2.4 as-built section added at the end, status-labelled)

> Extraction note: text from Drive read_file_content; several symbols (>=, <=, +/-, arrows) lost; table numeric cells in this read ARE present (the older extract lost them).

A driver-based model of revenue, costs, cash and runway for the Kiorex ecosystem — with scenarios, sensitivities, unit economics and the gates that release capital.

- Authored in the role of Chief Financial Officer. Owns the model, capital plan, unit economics and financial controls.
- Tags: Driver-based · 3 scenarios · P&L + cash · Unit economics · Funding gates
- DOCUMENT: KX13 | REVISION: Rev 2.4 · Reference Edition | DATE: 24 November 2026 | STATUS: Approved reference
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

## 13 Growth Engine inputs, bottom-up check and scenarios (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built.

> **Warning** These are modelling inputs and arithmetic on stated assumptions, not a forecast. The founder's financials in sections 01 to 12 are untouched. Every input below is an ASSUMPTION until pilot data (month 3 and 6).

### 13.1 New inputs
| Input | Symbol | Starting value | Source of truth later |
|---|---|---|---|
| Active clinic tenants | T | KX-14 section 07: M6 341, M12 857 | KX-13 |
| Share of tenants with a LIVE listing | L | M6 20%, M12 45% | ops providers page |
| Listed providers per listing tenant | d | 1.5 | provider sync |
| Attended new patients per listed provider per month | a | M6 4, M12 8 (cluster gate is 12) | charges plus decisions |
| Provider-led share of attended new patients | p | 35% to 50% | decisions |
| Fee per attended new patient | f | EGP 40 indexed | rate table |
| Dispute and reversal rate | r | 4% | disputes |
| Unattributed share treated as marketplace | u | 10% of bookings | decisions |
| Search to booking, booking to attended | c1, c2 | at least 8% (gate), 75% | funnel, charges |
| Patient marketing spend, content and SEO spend | S_p, S_c | KX-14 section 09: 30% and 12% of S&M | finance |
| WhatsApp message price and volume | w, m | Meta rate card by category (not yet modelled) | Meta pricing page |
| Reward cost per qualified referral, breakage | q, b | open (founder, counsel), 30% | ledger |

### 13.2 Bottom-up check against KX-14 section 07
| Month | Listed providers | Attended new patients | Fee-bearing | Fee revenue per month | KX-14 attended Kiorex visits | Share |
|---|---|---|---|---|---|---|
| 6 | 102 | 409 | 205 (p 50%) | EGP 7,872 | 2,900 | about 14% |
| 12 | 578 | 4,628 | 2,777 (p 40%) | EGP 106,637 | 13,667 | about 34% |

Finding: the bottom-up lands near 14 percent (month 6) and 34 percent (month 12) of KX-14's attended-visit targets. The series reconcile only if KX-14 counts repeat visits and provider-led visits, or if listing rates and patients per provider are far higher. At the 12-per-provider gate, month 12 needs about 1,140 listed providers to reach 13,667, above the 857 tenants. **Action:** split "attended Kiorex visits" into new, returning and provider-led, and re-base fee revenue on fee-bearing attended new patients. This is not a statement that the target is wrong.

### 13.3 Scenarios (EGP, monthly fee revenue from attended new patients only)
| Scenario | L at M6 / M12 | a at M6 / M12 | p at M6 / M12 | r | Fee revenue M6 | Fee revenue M12 |
|---|---|---|---|---|---|---|
| Conservative | 15% / 35% | 3 / 6 | 55% / 50% | 6% | EGP 3,895 | EGP 50,752 |
| Base | 20% / 45% | 4 / 8 | 50% / 40% | 4% | EGP 7,872 | EGP 106,637 |
| Aggressive | 25% / 55% | 5 / 10 | 40% / 30% | 3% | EGP 14,885 | EGP 192,028 |

These sit beside, not inside, the founder's base, downside and upside cases of section 08, which model the whole business (SaaS, fees, pharmacy, lab). Base-case cells use the rounded counts of the source report; other cells differ from unrounded arithmetic by up to 0.2 percent.

### 13.4 Illustrative monthly patient-marketing budget (EGP 150,000), hypothesis only
Not approved and not reconciled with KX-14 section 09 or the USD 25,000 per month sales and marketing line (Open decision).

| Channel group | A: role-based hypothesis | EGP | B: literal 50/25/15/10 | EGP |
|---|---|---|---|---|
| Provider-led enablement | 25% | 37,500 | 50% | 75,000 |
| Organic and local SEO | 35% | 52,500 | 25% | 37,500 |
| Referral and WhatsApp | 15% | 22,500 | 15% | 22,500 |
| Paid and partnerships (reserve until the liquidity gate) | 25% | 37,500 | 10% | 15,000 |

Blended patient CAC if the full EGP 150,000 were spent: EGP 652 / 367 / 235 at month 6 and EGP 56 / 32 / 21 at month 12 (conservative / base / aggressive); MER 0.03 / 0.05 / 0.10 at month 6 and 0.34 / 0.71 / 1.28 at month 12. So the budget must ramp with liquidity (KX-29 section 09).

### 13.5 LTV and CAC guardrails
- Fee LTV of one attended new patient is about EGP 38 (EGP 40 less a 4% dispute rate), plus Pay margin once measured. Repeat visits at the same network earn no fee (ADR-007).
- Paid CAC at or below about EGP 38 pays back on the fee alone. Scale a campaign only at LTV/CAC of at least 3; sustain at 1; stop below 1 for two weeks (ASSUMPTION).
- Where CAC exceeds the fee, the spend is an investment in supply and retention and is tracked separately.
- Track MER monthly; below 1 needs a finance-approved reason. Include delivered-message cost by Meta category before approving proactive messaging.
- No large paid spend without verified provider supply (KX-29 section 11). Definitions: KX-32.

## Rev 2.4 as-built update (24 Nov 2026)
Rev 2.4 verification (24 Nov 2026): checked against the repositories, with the suites re-run the same day (counts in KX-33 section 04). As-built means in code with a passing test on the local stack; nothing is deployed or pushed and every provider is mocked. This section wins over the Growth Engine update above wherever they differ.

- **Financial model unchanged.** Rev 2.4 changes no figure in this volume. The as-built analytics reproduce the KX-32 section 08 worked examples in a unit test (month 6 fee revenue EGP 7,872, month 12 EGP 106,637, LTV EGP 38.40 on the fee alone), which confirms the arithmetic of section 13 but not its assumptions, which remain ASSUMPTION until pilot data.
- **Commission attribution as built:** the fee-bearing share of attended new patients is now measurable from decision rows (`PROVIDER_LED` against `MARKETPLACE` and `UNATTRIBUTED`); revenue is confirmed or billed charges net of reversals, recorded when the visit is completed because the Clinic sends no confirmation event. Spend is entered manually with a second approver; CAC and ROAS stay empty (not zero) until spend exists.
- **Still open:** the re-base of the attended-visit series (KX-32 section 08), the EGP 150,000 illustration (KX-29 section 09) and Pay margin per patient. No finance decision was taken in Rev 2.4.
