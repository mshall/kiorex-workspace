# KX-13 36-Month Financial Model & Unit Economics
Source: 1RHYmCsuJEn1d4bK8Nlpm6L9H7MrdVQzp

> Extraction note: the PDF text layer dropped many symbols (>=, <=, +/-, arrows) and all numeric cells of the tables in sections 04, 06 and 07. Those cells are not recoverable from the extracted text and are marked "(values not extracted)".

Part 04 — Financial Model & GTM. A driver-based model of revenue, costs, cash and runway for the Kiorex ecosystem — with scenarios, sensitivities, unit economics and the gates that release capital.

- Authored in the role of Chief Financial Officer. Owns the model, capital plan, unit economics and financial controls.
- Tags: Driver-based, 3 scenarios, P&L + cash, Unit economics, Funding gates
- DOCUMENT: KX13 | REVISION: Rev 2.1 · Reference Edition | DATE: 19 November 2026 | STATUS: Approved reference
- AUDIENCE: Founders, investors, board | OWNER ROLE: Chief Financial Officer | SUPERSEDES: Kiorex v2 draft volumes 19 Nov 2026, 00000106

## Contents
01 Headline results (base case); 02 Model structure; 03 Key assumptions; 04 Revenue build; 05 Customers and the 'Kiorly is free' effect; 06 P&L and cash; 07 Scenarios; 08 Unit economics (paid clinic, base, month 24); 09 Sensitivities (base, impact on M36 monthly revenue); 10 Funding plan and capital gates; 11 Financial controls

WATCH: Status: Estimated. Month 1 = January 2027. All values in EGP unless marked; USD at a planning rate of EGP 50 = USD 1. These are planning assumptions, not forecasts or results. Replace inputs with observed pilot cohorts monthly.

## 01 Headline results (base case)
- Monthly revenue M12: EGP 0.54M
- Monthly revenue M24: EGP 4.1M
- Monthly revenue M36: EGP 16.0M (~USD 3.8M ARR)
- Gross margin M36: 87%
- Paying clinics M36: 938 (+ 2,357 Lite)
- Pharmacies / Labs M36: 1,619 / 334
- Seed cash-out (USD 4M) without Series A: M27
- Series A window: M15-M20, gated, see section 10 (source says §7)

## 02 Model structure
Pipeline: 01 Signups (by month & product) -> 02 Cohorts (trial -> paid / Lite / churn) -> 03 Price & usage (plans, fees, add-ons) -> 04 Higher-of (per clinic, distribution) -> 05 Revenue (by engine) -> 06 Costs (COGS + opex) -> 07 Cash (runway & gates).

The higher-of rule is modelled per clinic, not on averages: each paying clinic's monthly Kiorex patients follow a log-normal distribution (sigma = 0.9) around the cluster mean, and revenue is the expected value of max(S, C). This captures that busy clinics pay commission while quiet clinics pay subscription.

## 03 Key assumptions

| Driver | Base value | Basis |
|---|---|---|
| New clinic signups / month | 30 (M1) -> 120 (M12) -> 190 (M24) -> 240 (M36) | Founder-led + field reps in 2 Cairo/Giza clusters, then national |
| Signup mix | Lite 55% · Pro 35% (1.3 doctors) · Clinic 10% (7 doctors) | Market structure: mostly single-doctor clinics |
| Trial | 6 months for signups M1-M8 (founding), 3 months after | ADR010 |
| Trial -> paid conversion | 55% (downside 45%, upside 62%) | To validate in pilot |
| Failed trials -> Lite | 60% (rest churn) | Assumption |
| Monthly churn | Paid 2.0% · Lite 3.5% | SMB SaaS benchmark range |
| Prices | Pro EGP 1,149 blended per doctor · Clinic EGP 4,897 · +15%/yr indexation | PL01 seed; Egypt inflation |
| Kiorex patients / listed doctor / month | 2 (M1) -> 14 (M12) -> 22 (M24) -> 28 (M36); 70% of clinics listed | Liquidity ramp |
| Kiorex fee | EGP 40 per attended new patient, indexed | CR04 placeholder |
| AI scribe | 15% of paid doctors x EGP 400 from M7 | Add-on |
| Pharmacy | Signups 15 -> 150/mo from M13; EGP 1,000 ARPA; 60% on marketplace; 20 -> 120 orders x EGP 450 x 4% | KX06 |
| Lab | Signups 4 -> 40/mo from M19; EGP 1,800 ARPA; 10 -> 50 bookings x EGP 900 x 8% | KX07 |
| Enterprise | 1 contract per quarter from M15 at EGP 25k/month | KX14 |
| Market 2 GCC | From M25 15 -> 60 clinic signups/mo; 3x EGP-equivalent ARPA | KX18 |
| Team | 14 FTE (M1) -> 28 (M12) -> 46 (M24) -> 60 (M36) at USD 3,000 loaded | Egypt-based engineering & ops |
| Sales & marketing | USD 25k -> 40k (M7) -> 60k (M13) -> 80k (M25) per month | Field reps, content, patient acquisition |
| COGS | Cloud USD 2.5k -> 15k; AI USD 1.5/active doctor; WhatsApp USD 3/clinic; PSP 2.5% of revenue | AWS + vendor pricing |
| G&A | USD 15k -> 30k / month; Market-2 launch USD 40k/month from M22 | Legal, finance, compliance, pen tests |

## 04 Revenue build
Monthly revenue by engine — base case (Figure 1: stacked chart, months 0-35, y axis 0-16 EGP M). Series: Clinic paid (max S,C); Lite commissions; Trial commission above plan; AI scribe; Pharmacy SaaS; Pharmacy orders; Lab SaaS; Lab bookings; Enterprise; Market 2. Caption: Clinic revenue is subdued until founding trials end M7-M14, then compounds with marketplace liquidity.

Revenue table, columns at six checkpoint months (values not extracted):
- Clinic paid — max(S, C)
- Lite Kiorex fees
- Trial commission above plan
- AI scribe add-on
- Pharmacy SaaS
- Pharmacy marketplace
- Lab SaaS
- Lab marketplace
- Enterprise
- Market 2
- Total (EGP thousands / month)

## 05 Customers and the 'Kiorly is free' effect
Figure 2: Active provider locations by month 0-35 (y axis 0-2000): Paid clinics, Lite clinics, In trial, Pharmacies, Labs.

Share of listed paid clinics where commission exceeds subscription ('Kiorly is free'): 10% at M12, 19% at M24, 25% at M36 (base). Attended Kiorex visits reach 109,430 per month by M36.

## 06 P&L and cash
Annual table, EGP millions, Year 1 / Year 2 / Year 3 (values not extracted): Revenue; COGS (cloud, AI, messaging, PSP); Gross profit; Payroll; Sales & marketing; G&A; Market-2 launch; EBITDA.

Figure 3: Cash balance with USD 4M seed, no further funding, by scenario (Base, Downside, Upside), months 0-35, with Series A window marked. Base case needs a Series A before M27; upside reaches EBITDA break-even without it.

## 07 Scenarios

| Scenario | Rev M12 (EGP M) | Rev M24 | Rev M36 | ARR M36 (USD M) | Paid clinics M36 | EBITDA +ve month | Cash = 0 |
|---|---|---|---|---|---|---|---|
| Downside | (values not extracted) | | | | | — | M24 |
| Base | (values not extracted) | | | | | — | M27 |
| Upside | (values not extracted) | | | | | M31 | none |

| Scenario lever | Downside | Upside |
|---|---|---|
| Signups | -30% | +30% |
| Trial conversion | 45% | 62% |
| Kiorex patients per doctor | -40% | +40% |
| Churn | 1.5x | 0.8x |
| Price realisation | -10% | +5% |
| Costs | +5% | flat |

## 08 Unit economics (paid clinic, base, month 24)
- ARPA paid clinic / month: EGP 3,239 (higher-of expected value)
- Gross margin: 71%
- Blended CAC (assumption): EGP 12,500 (~USD 250 incl. rep + onboarding)
- CAC payback: 5.4 mo (target <12)
- LTV (2% churn): EGP 115,498
- LTV / CAC: 9 (target >3)

NOTE: Lite clinics have near-zero CAC (self-serve) and pay only Kiorex fees; they are the marketplace's supply engine and the funnel for Pro conversion.

## 09 Sensitivities (base, impact on M36 monthly revenue)
Tornado chart (% change in M36 monthly revenue, axis 0-20). Drivers and variations as extracted (signs lost): Kiorex patients/doctor +/-30% -> 18%; Trial conversion +/-45% -> 4%; Signups +/-20% -> 20%; Churn +/-50% -> 9%; Price +/-10% -> 10%. (Pairing of bar values to drivers is approximate in extraction.)

## 10 Funding plan and capital gates

| Use of seed USD 4M | Share | Notes |
|---|---|---|
| Engineering & product (Kiorex, Kiorly, Pharmacy) | 55% | Payroll-led |
| Sales & marketing (clinic acquisition + patient demand) | 25% | Founding cohort and two clusters |
| G&A, legal, compliance, security | 12% | PDPC filings, pen tests, counsel |
| Cloud, AI, messaging | 8% | Scales with usage |

| Series A gate (all required) | Threshold | Status |
|---|---|---|
| Paying clinics (>=3 months tenure) / total active tenants | >=300 / >=1,400 | Estimated M18 |
| Founding trial -> paid conversion | >=50% | Pilot |
| Attended Kiorex new patients / listed doctor / month (launch clusters) | >=12 | Pilot |
| Net revenue retention (paid clinics) | >=100% | M15 |
| Gross margin | >=80% | Model 85% |
| Kiorly Pharmacy pilot live | >=20 pharmacies | M13-M15 |
| Security | Pen test passed, restore drill recorded | NH017/018 |

DECISION: Raise a Series A of USD 8-10M in the M15-M20 window against these gates, sized for 24 months of runway through Market 2 and Lab GA. If gates slip, cut S&M to USD 40k/month and defer Market 2 — extends seed runway by roughly 4-6 months.

## 11 Financial controls
- Monthly close: PSP statements <-> Kiorly invoices <-> settlement summaries; Kiorex Pay ledger <-> PSP; payouts <-> clinic deposits.
- Revenue recognition: subscriptions over service period; commissions on CONFIRMED attendance; marketplace order fees on fulfilment (agent treatment — confirm with auditor).
- Every model input tagged Observed / Validated / Estimated with owner and date; model versioned alongside this document.
- Board pack monthly: cohort table, higher-of share, burn, runway, gate status.
