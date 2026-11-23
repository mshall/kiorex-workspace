# KX-12 Monetization & Pricing Architecture
Source: 1eCJOfb0iNtXD1JPbrfS2fnYmUvF0CnnM

> Extraction note: the PDF text layer dropped some symbols (>=, <=, ->, +/-, some numerals/percentages). Gaps are left as in the source.

Part 04 — Financial Model & GTM. Every way the ecosystem earns money, the price points to test, and the rules that keep pricing fair, predictable and hard to copy.

- Authored in the role of Chief Revenue Officer. Owns pricing, packaging, commercial policy and revenue quality.
- Tags: Dual engine, Higher-of rule, Plan ladders, Add-ons, Price governance
- DOCUMENT: KX12 | REVISION: Rev 2.1 · Reference Edition | DATE: 19 November 2026 | STATUS: Approved reference
- AUDIENCE: Founders, sales, finance, investors | OWNER ROLE: Chief Revenue Officer | SUPERSEDES: Kiorex v2 draft volumes 19 Nov 2026, 00000106

## Contents
01 Revenue architecture; 02 The higher-of rule — why it wins; 03 Price ladders by product; 04 Kiorex fee design; 05 Trials, cohorts and incentives; 06 Add-ons and usage; 07 Price governance

## 01 Revenue architecture
Five engines; the first two carry the business for 24 months.

| Engine | Payer | Unit | Start | Share of M36 revenue (base) |
|---|---|---|---|---|
| A · Provider SaaS (Clinic, Pharmacy, Lab) | Clinics, pharmacies, labs | Per doctor / org / branch / lab per month | M1 | 45% |
| B · Kiorex commissions incl. Lite | Providers | Per attended new patient (clinics); % of fulfilled order (pharmacy, lab) | M1 | 45% |
| C · Add-ons & usage | Providers | AI scribe, WhatsApp packs, specialty packs, extra branches | M7 | 13% |
| D · Enterprise contracts | Groups, chains, hospitals, employers | Annual contract | M15 | 2% |
| E · Marketplace services | Providers / partners | Labelled sponsored placement, analytics (no PHI) | Post-liquidity | upside only |

(Percentages as extracted; the sum exceeds 100% in the source text, likely due to lost "<" / "~" symbols.)

RULE: We never sell patient data, never rank by payment without a label, and never charge patients a booking fee in the MVP. Trust is the asset that makes engine B work.

## 02 The higher-of rule — why it wins
A clinic pays max(subscription, commission). Below the crossover Kiorly is a normal subscription; above it Kiorly is free and Kiorex is the only cost.

Figure 1: Payable vs Kiorex patients. Chart parameters: Pro plan, EGP 999 annual-equivalent, fee EGP 40 (Subscription S = Pro, 1 doctor); Commission C = 40 x patients; Clinic pays max(S, C); crossover: 25 patients, "Kiorly is free"; competitor-style line: subscription + fees. X axis: Attended new Kiorex patients per month (0-60); Y axis 0-3500 EGP. The dashed line is what a provider pays when software and booking fees stack.

- For the clinic: risk-free growth — every Kiorex patient above the crossover is pure demand at the same monthly cost.
- For Kiorex: commission revenue replaces subscription revenue only when we deliver; our revenue per clinic rises with marketplace performance.
- For competitors: a stacked model cannot match it without cannibalising its own subscription line.

## 03 Price ladders by product
### Kiorly Clinic (as built, Egypt)

| Plan | Price | Who | Upgrade trigger |
|---|---|---|---|
| Lite | EGP 0 + Kiorex fees (min invoice EGP 100) | Single doctor starting out | Needs reminders, payments, reports or a 3rd user |
| Pro | EGP 1,299/doctor monthly · 999 annual | 1-10 doctors | Multi-branch, OR, payroll, scribe |
| Clinic | EGP 3,499 incl. 5 doctors · 699 (per extra doctor) | Polyclinics, groups | Integrations, 50 doctors |
| Enterprise | Custom | Hospitals, chains | — |

### Kiorly Pharmacy and Kiorly Lab (test points)

| Product | Low | Base | High | Unit |
|---|---|---|---|---|
| Kiorly Pharmacy Pro | EGP (n/a in extraction) | EGP | EGP | per branch / month |
| Kiorly Lab Pro | EGP | EGP | EGP | per lab / month |
| Pharmacy order fee | % | % | % | of fulfilled order value |
| Lab booking fee | % | % | % | of booking value |

WATCH: Pharmacy and lab prices are Proposed until >=15 willingness-to-pay interviews per vertical and a paid pilot. The higher-of rule applies to them too.

## 04 Kiorex fee design
Flat fee per attended new patient for clinics (ADR007).

| Parameter | Default | Configurable at |
|---|---|---|
| Fee (KiorexCommissionRate) | EGP 40 (placeholder) | Market default + per specialty |
| Competitor guardrail (kiorex.benchmarkTargetRatio) | Warn if fee > 50% of lowest competitor benchmark | — |
| New-patient lookback | 24 months | Market pack |
| Dispute window | 7 days | Market pack |
| Auto-confirm | 24 h after check-in | Market pack |
| Lite monthly cap | None | Optional |
| Clinic booking link | Never charged | Fixed rule |

- Benchmarking: collect each competitor's provider fee by specialty and city through field interviews and published price lists; store in benchmarkFlat/benchmarkPercent with source and date; refresh quarterly.
- Specialty overrides: high-value specialties (dermatology, dentistry, aesthetics) may carry a higher flat fee; keep under the guardrail.
- Never per booking: no-shows and cancellations are never charged — this is the headline promise.

## 05 Trials, cohorts and incentives

| Mechanic | Rule | Purpose |
|---|---|---|
| Founding trial | 180 days if >=20 checked-in visits in first 30 days, else 90 | Speed + filter inactive |
| Trial commission policy | WAIVE_UP_TO_PLAN_PRICE | Busy trial clinics still pay for extra demand |
| Founding price lock | 24 months for first 500 paying clinics | Early-adopter loyalty |
| Annual billing | 23% off (999 vs 1,299) | Cash and retention |
| Referral | 1 month free both sides after first paid period | Doctor-to-doctor growth |
| Field reps | 10% of collected revenue for 90 days (default) | Assisted onboarding |
| No-show guarantee credits | Optional, off by default (CR10) | Competitive response tool |

## 06 Add-ons and usage

| Add-on | Test price | Metering |
|---|---|---|
| AI scribe | EGP 400 / doctor / month | AI_SCRIBE_MINUTES |
| WhatsApp pack | EGP 150 per 1,000 messages beyond plan | WHATSAPP_MESSAGES |
| Specialty packs (dental, aesthetics, physio) | EGP 300 / org / month | Entitlement |
| Extra branch (Pro) | EGP 500 / month | max_branches |

## 07 Price governance
- Prices are versioned per market and cohort; publishing a new version previews MRR impact and schedules moves at renewal after 30 days' notice (SB06).
- Annual indexation review each January against Egyptian inflation and FX; founding locks honoured.
- Market 2 pricing set from local willingness to pay, not FX conversion; GCC test point ~3x Egypt in EGP-equivalent.
- Every quote and invoice shows currency, VAT and terms; VAT rates from market pack (SaaS 14% pending NH001).

## 08 Storage limits and storage packs (Proposed, 23 Nov 2026)
Storage becomes a metered plan limit (a gauge, not a monthly counter). Proposed defaults: Lite 2 GB, Pro 20 GB, Clinic 100 GB, Enterprise 1 TB, each overridable per tenant. Extra storage is sold as packs (price to be set by the CRO; NEEDS_HUMAN). The 80 percent warning and the grace band follow the existing usage-warning pattern; downloads, exports and deletes are never blocked. Cost rationale and phases: KX-25 §05 and §09.
