# KX20 · Investor Brief
Source: 1l3JjCKl-DuU5ZpSh1pISynrLCOqpQY0W

> Extraction note: symbols (≥, ≈, →, "$"-style ranges) and several numeric table/chart values were lost in the PDF text layer. Obvious ones restored by inference; others marked "(not extracted)". Four headline stats below are listed in extraction order without clear label pairing.

Section 09 of the Kiorex v2 ecosystem reference — PITCH DECK.

Kiorex builds the operating software Egyptian providers run on — and the patient marketplace that fills their schedules, charging only when care is delivered.

- Authored in the role of CEO & CFO. Prepared for seed and Series A conversations; complements the 18-slide pitch deck.
- Topics: Problem · Product (built) · Business model · Market · Financials · The ask

| Field | Value |
|---|---|
| DOCUMENT | KX20 |
| REVISION | Rev 2.1 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Investors |
| OWNER ROLE | CEO & CFO |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 The opportunity in one page
02 What is already built
03 Business model
04 Financial outlook (Estimated — driver model, KX-13)
05 The ask
06 Team
07 Key risks and mitigations

## 01 The opportunity in one page

Headline stats (labels and values as extracted): PEOPLE IN EGYPT; LICENSED PHARMACIES; PHARMA MARKET 2025; DIAGNOSTIC LABS 2024 — values: 118M, 87,608, EGP 422B, USD 2.3B.

**Problem.** Private outpatient care in Egypt runs on phone calls, paper and WhatsApp. Patients cannot see real availability or trustworthy reviews; providers pay booking platforms for patients who never show up and buy separate software that does not bring demand.

**Solution.** Kiorly — free-to-start clinic, pharmacy and lab software in Arabic — plus Kiorex, a patient marketplace connected to providers' live schedules. Providers pay the higher of subscription or commission, never both, and never for no-shows.

**Why now.** A digital-health strategy for 2025–2029, mainstream instant payments (InstaPay, Fawry), WhatsApp Business APIs, and an incumbent that has diversified away from pure booking under unit-economics pressure.

## 02 What is already built

**Kiorly Clinic — built / shipped**
- 108-step build sequence; Stages A–E shipped
- Plans, trials, settlement, payments, dunning
- Rx safety with Egyptian drug database
- WhatsApp messaging, AI assistant
- AWS Frankfurt cell, MFA, audit, export

**Kiorex connector — built / ready**
- HMAC marketplace API, canonical slot engine
- Holds, idempotent bookings, outbox events
- Deposits, payouts, verified reviews
- Contract tests in CI

**Money engine — tested / built** — 'Pay the higher of, never both'
- 9 worked examples as tests
- 10k-run property tests on invariants
- Monthly statements AR/EN

## 03 Business model

Flow: 01 Free signup (Lite / 180-day trial) → 02 Daily use (front desk · Rx · billing) → 03 Kiorex demand (EGP 40 per attended new patient) → Higher-of invoice max(S, C) → 05 Expand (seats · Pharmacy · Lab · Market 2).

| Engine | Price (Egypt, to validate) |
|---|---|
| Kiorly Clinic Pro | EGP 1,299 / doctor / month (999 annual) |
| Kiorly Clinic Clinic plan | EGP 3,499 incl. 5 doctors |
| Kiorex commission | EGP 40 per attended new patient; no-shows free |
| Kiorly Pharmacy / Lab | EGP 1,000 / 1,800 per location (test points) |
| Marketplace (pharmacy / lab) | 4% / 8% of fulfilled orders (test points) |

## 04 Financial outlook (Estimated — driver model, KX-13)

Chart: Annualised revenue run-rate by scenario (Downside / Base / Upside), y-axis 0–7 (USD M), x-axis Month 1–35 (Month 1 = Jan 2027). (Series values not extracted.)

| Metric | Downside | Base | Upside |
|---|---|---|---|
| ARR run-rate M24 (USD M) | (not extracted) | (not extracted) | (not extracted) |
| ARR run-rate M36 (USD M) | (not extracted) | (not extracted) | (not extracted) |
| Provider locations M36 | (not extracted) | (not extracted) | (not extracted) |
| Gross margin M36 (%) | (not extracted) | (not extracted) | (not extracted) |

**WATCH:** Model outputs at a planning FX of EGP 50 = USD 1. Inputs are assumptions until the Egypt pilot produces observed cohorts; we will share the live model monthly.

## 05 The ask

**SEED — USD 3–5M** (modelled at USD 4M) *(exact range digits partly lost in extraction: "USD 35M" = USD 3–5M)*
- RUNWAY (BASE): 27 months without Series A
- SERIES A WINDOW: M15–M20, USD 8–10M, milestone-gated

| Milestone before Series A | Target |
|---|---|
| Total active / paying clinic tenants | ≥1,400 / ≥300 |
| Founding trial → paid | ≥50% |
| Kiorex patients / listed doctor / month (launch clusters) | ≥12 |
| Kiorly Pharmacy pilot | ≥20 pharmacies |
| Security | Pen test passed; restore drill recorded |

## 06 Team

**Mohamed El Shall — CEO / acting CTO (founder)**
- 15 years across fintech, ride-hailing (Careem) and telecom (Etisalat/Vodafone) in MENA
- Today leads Back Office, BaaS and Virtual IBAN platforms (80 engineers, USD 2B annual volume under CBUAE compliance) as Domain Engineering Head at Wio Bank
- Architect of Kiorly's build and money engine

**Prof. Dr. Ahmed El Shall — CMO (co-founder)**
- Co-founder; clinical leadership and safety sign-off
- Leads the specialty advisory board
- Clinical network for founding cohort

## 07 Key risks and mitigations

| Risk | Mitigation |
|---|---|
| Marketplace liquidity | Density-first clusters; free clinic booking links seed patient habit |
| Conversion of free users | Activation-gated founding trial; higher-of makes paying feel fair |
| Founder bandwidth | CTO hire by M6; codified build sequences and runbooks |
| Regulation | Counsel-gated verticals; no controlled medicines; privacy filings tracked |
| Funding | Milestone-gated Series A; cost-down plan adds 4–6 months |
