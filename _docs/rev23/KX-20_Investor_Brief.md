# KX20 · Investor Brief
Source: 1l3JjCKl-DuU5ZpSh1pISynrLCOqpQY0W
Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (first issued 20 November 2026; previous text was Rev 2.1, 19 Nov 2026, not revised in 2.3; this update adds progress evidence only, financial content is the founder's and is untouched)

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

## 08 Progress evidence (23 Nov 2026)
Facts below are observed in the code repositories and reports; status tag Observed. They show build progress, not traction: no production deployment, no real vendor and no paying customer is evidenced in this section.

### Key numbers (verified 23 Nov 2026)
- Reference set: **25 volumes** (KX-00 to KX-24); decision log ADR-001 to ADR-035 (31 Accepted, 4 Proposed, see KX-01).
- Code: **7 repositories** plus the workspace (contracts, platform, account, clinic, pharmacy, lab, kiorly-work). Commits since 19 Nov 2026 (git log of the local clones): contracts 23, platform 112, account 48, clinics-management 322 (branch kiorex, includes merges from main), pharmacy 60, lab 69, kiorly-work 19, workspace 34.
- Contracts `@kiorex/contracts` **1.7.0**; notification layer tests 60, 100 % coverage of `src/notify`.
- Provider adapters: **8 kinds** (SMS, Email, WhatsApp, Payment, Push, Storage, Consent, AI), mock by default, real by configuration; **0** real vendors contacted.
- Demo data: **36** medical specialties, **2** LIVE doctors each (72), **12** demo patients, 108 demo bookings, home visits and nurse tenants.
- Tests: end-to-end suites 16/17/18 (staff app routes versus web) **47 + 30 + 34 = 111**, all passing on the 23 Nov re-run; Expo web per-role specs clinic 6, pharmacy 19, lab 20; patient app Jest **157** (re-run 23 Nov, all pass); staff app Jest **167** (re-run 23 Nov, all pass; two upgrade-request tests used a fixed date that aged out of the request window and now use a relative one).
- Not verified: real push delivery (APNs, FCM), a release build, the patient app on a device, any real vendor, any AWS deployment.

| What | Observed | Status |
|---|---|---|
| Products running together locally | Marketplace, Passport, Kiorly Clinic (with Nurse edition), Kiorly Pharmacy, Kiorly Lab, patient app, staff app | Done (dev) |
| Provider integration readiness | One adapter contract for SMS, email, WhatsApp, payments, push, storage, consent and AI; only vendor URLs and credentials remain | Done (not live) |
| Shared notification layer | Contracts 1.7.0, adopted in the marketplace; four migrations Planned | Done / Planned |
| Staff mobile app | One app for clinic, nurse, pharmacy and lab staff, with plan and role gating; safety alerts on every plan | Done (dev builds); store submission Blocked |
| Demo marketplace | 36 specialties, 2 live doctors each, 12 demo patients, bookings, home visits | Done (synthetic data) |
| Automated checks | 18 cross-service end-to-end suites; staff app routes versus web (47 + 30 + 34 = 111 tests, 23 Nov); patient app Jest 157; contracts notify 60 tests at 100 % | Done; staff Jest 167 of 167 pass on the last re-run |
| Not yet verified | Real push delivery, release builds, the patient app on a device, any real vendor, any AWS deployment | Open / Blocked |

> **Note** Use these as engineering-progress evidence only. Pilot results (activation, bookings, revenue) will replace them as the traction section once the Egypt pilot produces observed data (KX17).

## What changed in this revision (23 Nov 2026)
- Revision header corrected: this volume was never re-issued after Rev 2.1; this update adds §08 progress evidence only.
- Market, business model, outlook, ask, team and risks are unchanged (financials and go-to-market belong to the founder).
- No credentials or test logins appear in this volume. Not verified: any customer, revenue or production usage.
