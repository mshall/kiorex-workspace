# KX-12 Monetization & Pricing Architecture

Source: 1hTRK4WdabuUHyCHl8NvsTWfpXADeOMyA
Revision: Rev 2.3 · Reference Edition (20 November 2026; supersedes KX12 Rev 2.1, 19 Nov 2026)

> Extraction note: text from Drive read_file_content; a few symbols (>=, <=, ~, arrows) lost in the PDF text layer, gaps marked "[?]".

Part 04 — Financial Model & GTM. Every way the ecosystem earns money, the price points to test, and the rules that keep pricing fair, predictable and hard to copy.

- Authored in the role of Chief Revenue Officer. Owns pricing, packaging, commercial policy and revenue quality.
- Tags: Dual engine · Higher-of rule · Plan ladders · Kiorly Nurse ladder · Add-ons · Price governance
- DOCUMENT: KX12 | REVISION: Rev 2.3 · Reference Edition | DATE: 20 November 2026 | STATUS: Approved reference
- AUDIENCE: Founders, sales, finance, investors | OWNER ROLE: Chief Revenue Officer | SUPERSEDES: KX12 Rev 2.1 19 Nov 2026

## WHAT CHANGED IN REV 2.3 (as printed)
Kiorly Nurse price ladder added (Proposed): Nurse Lite, Nurse Pro, Nurse Agency, Enterprise. Kiorex fee design gains profession and service-location overrides; care-plan rule; nursing benchmark.
Home visits included in every plan (not an add-on); physiotherapists use the Clinic ladder + physio pack.

## Contents
01 Revenue architecture · 02 The higher-of rule — why it wins · 03 Price ladders by product · 04 Kiorex fee design · 05 Trials, cohorts and incentives · 06 Add-ons and usage · 07 Price governance

## 01 Revenue architecture
Five engines; the first two carry the business for 24 months. Home care and new professions feed engines A and B — no new engine.

| Engine | Payer | Unit | Start | Share of M36 revenue (base) |
|---|---|---|---|---|
| A · Provider SaaS (Clinic, Nurse, Pharmacy, Lab) | Clinics, physiotherapists, nurses, agencies, pharmacies, labs | Per clinician / nurse / org / branch / lab per month | M1 | ~45% [?] |
| B · Kiorex commissions incl. Lite (clinics, physio, incl. home visits, nursing) | Providers | Per attended new patient; % of fulfilled order (pharmacy, lab) | M1 | ~45% [?] |
| C · Add-ons & usage | Providers | AI scribe, WhatsApp packs, specialty packs, extra branches | M7 | ~13% [?] |
| D · Enterprise contracts | Groups, chains, hospitals, home-care operators, employers | Annual contract | M15 | ~2% [?] |
| E · Marketplace services | Providers / partners | Labelled sponsored placement, analytics (no PHI) | Post-liquidity | upside only |

RULE: We never sell patient data, never rank by payment without a label, and never charge patients a booking fee in the MVP. Kiorex never adds its own home-visit surcharge for patients. Trust is the asset that makes engine B work.

## 02 The higher-of rule — why it wins
A provider pays max(subscription, commission). Below the crossover Kiorly is a normal subscription; above it Kiorly is free and Kiorex is the only cost.

Figure 1 (chart): Payable vs Kiorex patients (EGP/month). Pro plan, EGP 999 annual-equivalent, fee EGP 40; Subscription S (Pro); Commission C = 40 x patients; Provider pays max(S, C); crossover ~25 patients — 'Kiorly is free'; Competitor: S + fees (dashed red). X axis 0–60 attended new Kiorex patients per month; Y axis 0–3,500.

- For the provider: risk-free growth — every Kiorex patient above the crossover is pure demand at the same monthly cost.
- For Kiorex: commission revenue replaces subscription revenue only when we deliver; our revenue per provider rises with marketplace performance.
- For competitors: a stacked model cannot match it without cannibalising its own subscription line.

## 03 Price ladders by product
### Kiorly Clinic (as built, Egypt) — doctors, dentists, physiotherapists

| Plan | Price | Who | Upgrade trigger |
|---|---|---|---|
| Lite | EGP 0 + Kiorex fees (min invoice EGP 100) | Single practitioner starting out | Needs reminders, payments, reports or a 3rd user |
| Pro | EGP 1,299/clinician monthly · 999 annual | 1–10 clinicians | Multi-branch, OR, payroll, scribe, home dispatch |
| Clinic | EGP 3,499 incl. 5 clinicians · 699 (per extra clinician) | Polyclinics, physio centres, groups | Integrations, 50 clinicians |
| Enterprise | Custom | Hospitals, chains | — |

Home visits (booking, execution, safety) are included in every Clinic plan; route view from Pro; multi-clinician dispatch from Clinic (KX05 §03).

### Kiorly Nurse (edition, Egypt) — Proposed

| Plan | Price (test point) | Who | Includes |
|---|---|---|---|
| Nurse Lite | EGP 0 + Kiorex fees (EGP 100 minimum invoice) | Solo nurse starting out | Visits, records, vitals, MAR, safety, Kiorex listing (when allowed) |
| Nurse Pro | EGP 399 / nurse / month · 299 annual-equivalent | Busy solo nurse | + family updates, private-duty shifts, WhatsApp reminders, card/InstaPay/Fawry, reports |
| Nurse Agency | EGP 1,999 / month incl. 10 nurses · 149 per extra nurse | Agencies, home-care companies | + team, dispatch by zone/skill, nurse pay, multi-branch |
| Enterprise | Custom | Large home-care operators | Negotiated |

Nurse prices sit well below Pro EGP 1,299 because nurse visit fees are lower; the higher-of rule, founding trial and referral rules apply unchanged.

### Kiorly Pharmacy and Kiorly Lab (test points)

| Product | Low | Base | High | Unit |
|---|---|---|---|---|
| Kiorly Pharmacy Pro | EGP 500 | EGP 1,000 | EGP 1,850 | per branch / month |
| Kiorly Lab Pro | EGP 850 | EGP 1,800 | EGP 3,500 | per lab / month |
| Pharmacy order fee | 3% | 4% | 6% | of fulfilled order value |
| Lab booking fee | 6% | 8% | 12% | of booking value |

WATCH: Pharmacy, lab and Kiorly Nurse prices are Proposed until >=15 willingness-to-pay interviews per vertical (for Nurse: nurses and agencies) and a paid pilot. The higher-of rule applies to them too.

## 04 Kiorex fee design
Flat fee per attended new patient for every profession and location (ADR-007).

| Parameter | Default | Configurable at |
|---|---|---|
| Fee | EGP 40 (placeholder) | Market default + per specialty + per profession + per service location (KiorexCommissionRate gains profession, serviceLocation) |
| Home-visit fee override | Same as in-clinic EGP 40 until benchmarked | Per profession + HOME |
| Care plans | Fee only on the first attended visit of a new patient (BR55) | Fixed rule |
| Competitor guardrail | Warn if fee > 50% of lowest competitor benchmark | kiorex.benchmarkTargetRatio, per profession |
| New-patient lookback | 24 months | Market pack |
| Dispute window | 7 days | Market pack |
| Auto-confirm | 24 h after check-in (home: after arrival geostamp) | Market pack |
| Lite monthly cap | None | Optional |
| Clinic booking link | Never charged | Fixed rule |

- Benchmarking: collect each competitor's provider fee by specialty, profession and city through field interviews and published price lists; store in benchmarkFlat / benchmarkPercent with source and date; refresh quarterly. For home nursing, include home-nursing platforms (e.g. 7keema, Tabibi 24/7).
- Specialty overrides: high-value specialties (dermatology, dentistry, aesthetics) may carry a higher flat fee; keep under the guardrail.
- Never per booking: no-shows, cancellations, unsafe-aborted home visits and care-plan follow-ups are never charged — this is the headline promise.

## 05 Trials, cohorts and incentives

| Mechanic | Rule | Purpose |
|---|---|---|
| Founding trial | 180 days if >=20 checked-in visits in first 30 days (Nurse: >=15 visits recorded), else 90 | Speed + filter inactive |
| Trial commission policy | WAIVE_UP_TO_PLAN_PRICE | Busy trial providers still pay for extra demand |
| Founding price lock | 24 months for first 500 paying clinics (separate founding cohort of 200 for Kiorly Nurse, Proposed) | Early-adopter loyalty |
| Annual billing | ~23–25% off (999 vs 1,299; 299 vs 399) [extraction ambiguous on exact %] | Cash and retention |
| Referral | 1 month free both sides after first paid period | Doctor-to-doctor and nurse-to-nurse growth |
| Field reps | 10% of collected revenue for 90 days (default) | Assisted onboarding |
| No-show guarantee credits | Optional, off by default (CR10) | Competitive response tool |

## 06 Add-ons and usage

| Add-on | Test price | Metering |
|---|---|---|
| AI scribe | EGP 400 / clinician / month | AI_SCRIBE_MINUTES |
| WhatsApp pack | EGP 150 per 1,000 messages beyond plan | WHATSAPP_MESSAGES |
| Specialty packs (dental, aesthetics, physio) | EGP 300 / org / month | Entitlement |
| Extra branch (Pro) | EGP 500 / month | max_branches |

Home visits are not an add-on: they are included in every plan, and their safety features are never paywalled (P5).

## 07 Price governance
- Prices are versioned per market and cohort; publishing a new version previews MRR impact and schedules moves at renewal after 30 days' notice (SB06).
- Annual indexation review each January against Egyptian inflation and FX; founding locks honoured.
- Market 2 pricing set from local willingness to pay, not FX conversion; GCC test point ~3x Egypt in EGP-equivalent.
- Every quote and invoice shows currency, VAT and terms; VAT rates from market pack (SaaS 14% pending NH001).

## 08 Storage limits and storage packs (Proposed, 23 Nov 2026)
Storage becomes a metered plan limit (a gauge, not a monthly counter). Proposed defaults: Lite 2 GB, Pro 20 GB, Clinic 100 GB, Enterprise 1 TB, each overridable per tenant. Extra storage is sold as packs (price to be set by the CRO; NEEDS_HUMAN). The 80 percent warning and the grace band follow the existing usage-warning pattern; downloads, exports and deletes are never blocked. Cost rationale and phases: KX-25 §05 and §09.
