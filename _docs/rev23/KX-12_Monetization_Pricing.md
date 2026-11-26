# KX-12 Monetization & Pricing Architecture

Source: 1hTRK4WdabuUHyCHl8NvsTWfpXADeOMyA
Revision: Rev 2.7 · Reference Edition, updated 25 November 2026 (Rev 2.7: Phases 2 to 4 as-built notes refreshed, see the last sections; supersedes KX12 Rev 2.3, 20 Nov 2026; Rev 2.4 as-built section added at the end, status-labelled)

> Extraction note: text from Drive read_file_content; a few symbols (>=, <=, ~, arrows) lost in the PDF text layer, gaps marked "[?]".

Part 04 — Financial Model & GTM. Every way the ecosystem earns money, the price points to test, and the rules that keep pricing fair, predictable and hard to copy.

- Authored in the role of Chief Revenue Officer. Owns pricing, packaging, commercial policy and revenue quality.
- Tags: Dual engine · Higher-of rule · Plan ladders · Kiorly Nurse ladder · Add-ons · Price governance
- DOCUMENT: KX12 | REVISION: Rev 2.4 · Reference Edition | DATE: 24 November 2026 | STATUS: Approved reference
- AUDIENCE: Founders, sales, finance, investors | OWNER ROLE: Chief Revenue Officer | SUPERSEDES: KX12 Rev 2.1 19 Nov 2026

## WHAT CHANGED IN REV 2.3 (as printed)
Kiorly Nurse price ladder added (Proposed): Nurse Lite, Nurse Pro, Nurse Agency, Enterprise. Kiorex fee design gains profession and service-location overrides; care-plan rule; nursing benchmark.
Home visits included in every plan (not an add-on); physiotherapists use the Clinic ladder + physio pack.

## Contents
01 Revenue architecture · 02 The higher-of rule — why it wins · 03 Price ladders by product · 04 Kiorex fee design · 05 Trials, cohorts and incentives · 06 Add-ons and usage · 07 Price governance · 08 Storage limits and storage packs · 09 Credit systems and sponsored promotions (Proposed)

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

<!-- kx-diagram: revenue-engines -->

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

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built. Rev 2.4: where this section differs from the Rev 2.4 as-built update at the end of the volume, the end section wins.

- **Section 04 (Kiorex fee design) and ADR-007**: fee amount, attended-patient trigger and 24-month lookback are unchanged (As-built). Proposed attribution rule: the fee applies only when the booking's acquisition origin is not `PROVIDER_LED`. Evidence can remove a fee and never add one; any rule that charges more than today is not proposed and needs the CEO (Open decision).
- **Provider promise, now provable (Proposed)**: bookings through a provider's own link, QR or widget never carry the fee; a decision row records why for both outcomes; disputes with reason `PROVIDER_LED_EVIDENCE` auto-approve when Kiorex evidence supports them. Rules and windows are versioned, approved by two people and effective at least 7 days after approval (KX-30).
- **Open decision**: EGP 40 for a patient who touched a provider link and later books through marketplace search. Proposed default: no charge (`PROVIDER_FIRST`, 30-day window).
- **Section 05 (trials, cohorts, incentives)**: BR12 (one free month for both sides) is provider-only. A patient referral reward would be closed-loop discount credit or a coupon, never cash, never a fee change, and only after an attended first visit (Roadmap, Regulatory dependency, KX-30 section 09).
- **Spend cap and pause (Roadmap)**: a visible monthly cap and pause per provider in the Growth workspace, in line with competitor practice; policy decision for the CEO.
- **Revenue reporting**: GBV is never revenue; Kiorex revenue is confirmed or billed charges net of reversals (KX-32).

## Rev 2.4 as-built update (24 Nov 2026)
Rev 2.4 verification (24 Nov 2026): checked against the repositories, with the suites re-run the same day (counts in KX-33 section 04). As-built means in code with a passing test on the local stack; nothing is deployed or pushed and every provider is mocked. This section wins over the Growth Engine update above wherever they differ.

- **Commission attribution as built (As-built).** The fee amount, the attended-new-patient trigger, the 24-month lookback and the monthly "higher of subscription or commission, never both" rule are unchanged (ADR-007). The only addition is one more way to be non-chargeable: acquisition origin `PROVIDER_LED` (a provider link, QR, widget or prior provider touch of the same organisation inside its window). Evidence can only remove a fee: a test proves a provider touch never adds one and `MARKETPLACE` and `UNATTRIBUTED` behave exactly like today.
- **Defaults built, money decisions open.** `PROVIDER_FIRST` precedence, windows of 30, 30 and 7 days and "no charge for provider-led-then-marketplace" are built as `PROPOSED_DEFAULT`; the CEO has not signed them (KX-33 section 06 items 4 and 5). A change to any money policy needs two super admins and takes effect at least 7 days after approval with a provider announcement.
- **Provider view (As-built).** The monthly statement shows `providerLedBookings` and fee-bearing bookings from the decision rows; the provider can dispute with `PROVIDER_LED_EVIDENCE` and it auto-approves when Kiorex evidence supports it. The platform can override with a closed reason list and a note (audited, removal only).
- **Not built:** patient referral rewards and any reward ledger (Roadmap, counsel-gated), the provider monthly cap and pause (Roadmap), a public help page for the rules.

## 09 Credit systems and sponsored promotions (Proposed, 24 Nov 2026)
Labels: **Proposed** (ADR-048, founder-approved design of 24 Nov 2026, unsigned), **As-built**, **Regulatory dependency**. **As-built:** only the Clinic provider credit wallet CR-05 exists (grants, first-expiring-first consumption, expiry, late-reversal credit, applied to the Kiorly invoice, daily balance check). Rev 2.7: the patient credit ledger, refund-as-credit, sponsored promotions and fee draw-down are **built locally and launch-locked** with every amount zero or entered by a human (no price or fee is set by this volume); usage bundles are a skeleton and off; the corporate benefit is a separate ledger and not wired to Pay. Full design: KX-30 section 14, ADR-048 in KX-01, packages P2-B2, P2-W, P2-S.

| Question | Monetisation rule (Proposed) |
|---|---|
| Is credit revenue? | **No.** Kiorex revenue stays the Kiorly subscription and Kiorex fee commission (engines A and B) and add-ons; patient credit, provider credit grants and sponsored discounts are never revenue when issued; credit consumed against a Kiorex fee reduces the cash invoiced, the fee itself is still earned (recognition by the accountant, H-25) |
| Two systems | Patient credit (Kiorex, closed loop) and provider credit (Kiorly, existing wallet); no conversion either way; no general-purpose wallet; no top-up; no cash-out |
| Provider credit uses | Pay fees first (commission and subscription draw from credit, then invoice); goodwill and waivers; dispute wins and fee refunds return as credit; onboarding, free months, setup credit and connect bonus; provider referral rewards (BR12 stays "one free month both sides", now actually paid through the wallet); usage purchases (messaging credits, SMS and WhatsApp bundles, extra storage packs) as prepaid packs priced later; marketing spend (boosts) reserved |
| Patient credit | Referral and welcome rewards after a completed visit; support goodwill; refund kept as credit by choice (option, original method is the default); campaign credit with expiry and scope; platform-funded credit is a marketing cost within the KX-29 budget, refund credit is the patient's own money and a liability |
| Sponsored promotions | The clinic funds a discount from its own credit: reservation at booking, debit at completion, release or reversal on cancel or refund, shown as a promotion expense on the clinic statement. Commission is computed on the fee before the sponsored discount (versioned policy `SPONSORED_PROMOTION_POLICY`, default `GROSS_BEFORE_SPONSORED`); the EGP 40 fee is unchanged |
| Add-ons and usage (section 06) | A prepaid pack bought from credit consumes currency from the wallet and grants units in a separate unit ledger; prices need a CEO decision (H-30); nothing is priced here |
| Governance (section 07) | Credit grants above the dual-approval threshold need two Super Admins (CR-05, As-built); high-value sponsored promotions need maker-checker; money-policy changes take effect at least 7 days after approval |
Open decisions: maximum open patient balance, expiry months, goodwill limits, onboarding and bonus amounts, bundle prices, accounting for breakage. Regulatory dependency: counsel on patient CREDIT mode and refund credit (launch guide 11.24).

## Rev 2.7 finishing update: subscription behaviour, commission collection and Kiorly Pay (25 Nov 2026)

Status: **As-built locally** (code plus passing tests, mock billing and payment providers). **No price, fee or amount is set or changed in this update.** The higher-of rule, the fee design and every price ladder above are as before; the ladders stay Proposed until the founder confirms them.

<!-- kx-diagram: subscription-lifecycle -->

| Topic | Behaviour that now exists in all three products | Effect on pricing |
|---|---|---|
| Renewal | A paid plan renews automatically by default and the saved token is charged; failure retries on D+1, D+3 and D+7, then dunning | None on the price; it makes the monthly invoice automatic |
| Lite instead of lockout | Switching renewal off, or a lapse that dunning cannot fix (default 15 days after the due date), moves the organisation to the free Lite plan. Nothing is deleted; modules of the previous plan stay readable for a grace window (default 30 days) | The free Lite plan is part of the ladder; its limits are catalogue rows, not code |
| No catalogue price yet | Where the catalogue has no price, the period rolls without a charge and the event `renewed_without_charge` records it; reactivation needs an active price (`NO_ACTIVE_PRICE`, "price to be confirmed") | Prices must be entered by a human before any real renewal charge (NEEDS_HUMAN) |
| Proration | Upgrade timing defaults exist; `creditUnusedOnDowngrade` is stored but no credit is granted until the founder decides (LG-SUB-3) | Open decision |
| Commission collection | Kiorex collects the per-attended-new-patient fee through the provider's chosen payment partner in one of three modes: net from payout, saved-method charge, or invoice. Provider credit is drawn first, then the invoice; the higher-of rule is unchanged | None on the fee; the mode is configuration, approved by a second person |

<!-- kx-diagram: commission-modes -->

> **Needs human** PSP fee values are not set and unset fees are never ranked cheap (LG-INT-PAY-3). Whether commission collection or the plan price covers the Lite organisation's Kiorex fee minimum (SB-05, Clinic) is a founder decision. Counsel decides the funds flow of collection (LG-COM-3).

> **Decided 26 Nov 2026 (launch guide row 13.16, resolved; the founder delegated the choice to the recommendation):** collection never pauses listing. An unpaid Kiorex commission (Lite or any plan) is reminded, aged, escalated and can be disputed, but it never pauses or hides the Kiorex listing, and never blocks booking, plan or care. The Clinic code no longer pauses the listing at D+30 (SB-05 superseded; `Tenant.kiorexBillingPausedAt` is legacy, never set, and cleared by the daily dunning job where an old value remains). The listing still follows the subscription state (READ_ONLY or SUSPENDED for a non-commission subscription lapse) and verification. The rule is a code rule, not a feature flag: safety controls are never flags, so reversing it is a code change only (and a new founder decision).
