# KX20 · Investor Brief
Source: 1l3JjCKl-DuU5ZpSh1pISynrLCOqpQY0W
Revision: Rev 2.1 · Reference Edition (19 November 2026, Approved reference) — NOTE: cover still prints Rev 2.1; this file was NOT revised for 2.3 and has no Superseded copy. Cover also prints "about:blank" artefact at top (print header).

> Extraction note: chart/table numeric values (ARR table, chart series) and some symbols were lost; "(not extracted)" marks them.

Section 09 — PITCH DECK. Kiorex builds the operating software Egyptian providers run on — and the patient marketplace that fills their schedules, charging only when care is delivered. Author role: CEO & CFO. Audience: investors. Supersedes: Kiorex v2 draft volumes 19 Nov 2026.

## 01 The opportunity in one page
Headline stats: People in Egypt 118M; Licensed pharmacies 87,608; Pharma market 2025 EGP 422B; Diagnostic labs 2024 USD 2.3B (pairing of labels/values per extraction order; unverified).
Problem. Private outpatient care in Egypt runs on phone calls, paper and WhatsApp. Patients cannot see real availability or trustworthy reviews; providers pay booking platforms for patients who never show up and buy separate software that does not bring demand.
Solution. Kiorly — free-to-start clinic, pharmacy and lab software in Arabic — plus Kiorex, a patient marketplace connected to providers' live schedules. Providers pay the higher of subscription or commission, never both, and never for no-shows.
Why now. A digital-health strategy for 2025–2029, mainstream instant payments (InstaPay, Fawry), WhatsApp Business APIs, and an incumbent that has diversified away from pure booking under unit-economics pressure.

## 02 What is already built
Kiorly Clinic (built/shipped): 108-step build sequence; Stages A–E shipped; Plans, trials, settlement, payments, dunning; Rx safety with Egyptian drug database; WhatsApp messaging, AI assistant; AWS Frankfurt cell, MFA, audit, export.
Kiorex connector (built/ready): HMAC marketplace API, canonical slot engine; Holds, idempotent bookings, outbox events; Deposits, payouts, verified reviews; Contract tests in CI.
Money engine (tested/built) 'Pay the higher of, never both': 9 worked examples as tests; 10k-run property tests on invariants; Monthly statements AR/EN.

## 03 Business model
Flow: 01 Free signup (Lite / 180-day trial) → 02 Daily use (front desk · Rx · billing) → 03 Kiorex demand (EGP 40 per attended new patient) → 04 Higher-of invoice max(S, C) → 05 Expand (seats · Pharmacy · Lab · Market 2).
| Engine | Price (Egypt, to validate) |
|---|---|
| Kiorly Clinic Pro | EGP 1,299 / doctor / month (999 annual) |
| Kiorly Clinic Clinic plan | EGP 3,499 incl. 5 doctors |
| Kiorex commission | EGP 40 per attended new patient; no-shows free |
| Kiorly Pharmacy / Lab | EGP 1,000 / 1,800 per location (test points) |
| Marketplace (pharmacy / lab) | 4% / 8% of fulfilled orders (test points) |

## 04 Financial outlook (Estimated — driver model, KX-13)
Chart: annualised revenue run-rate, Downside/Base/Upside, y 0–7 USD M, Month 1 = Jan 2027. Table rows ARR run-rate M24 (USD M), ARR run-rate M36 (USD M), Provider locations M36, Gross margin M36 %: values (not extracted).
WATCH: Model outputs at a planning FX of EGP 50 = USD 1. Inputs are assumptions until the Egypt pilot produces observed cohorts; live model shared monthly.

## 05 The ask
SEED USD 3–5M (modelled at USD 4M). Runway (base) 27 months without Series A. Series A window M15–M20, USD 8–10M, milestone-gated.
| Milestone before Series A | Target |
|---|---|
| Total active / paying clinic tenants | ≥1,400 / ≥300 |
| Founding trial → paid | ≥50% |
| Kiorex patients / listed doctor / month (launch clusters) | ≥12 |
| Kiorly Pharmacy pilot | ≥20 pharmacies |
| Security | Pen test passed; restore drill recorded |

## 06 Team
Mohamed El Shall — CEO / acting CTO (founder): 15 years across fintech, ride-hailing (Careem) and telecom (Etisalat/Vodafone) in MENA; leads Back Office, BaaS and Virtual IBAN platforms (80 engineers, USD 2B annual volume under CBUAE compliance) as Domain Engineering Head at Wio Bank; architect of Kiorly's build and money engine.
Prof. Dr. Ahmed El Shall — CMO (co-founder): clinical leadership and safety sign-off; leads the specialty advisory board; clinical network for founding cohort.

## 07 Key risks and mitigations
| Risk | Mitigation |
|---|---|
| Marketplace liquidity | Density-first clusters; free clinic booking links seed patient habit |
| Conversion of free users | Activation-gated founding trial; higher-of makes paying feel fair |
| Founder bandwidth | CTO hire by M6; codified build sequences and runbooks |
| Regulation | Counsel-gated verticals; no controlled medicines; privacy filings tracked |
| Funding | Milestone-gated Series A; cost-down plan adds 4–6 months |
