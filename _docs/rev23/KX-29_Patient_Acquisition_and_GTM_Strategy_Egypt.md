# KX-29 — Patient Acquisition and Go-to-Market Strategy for Egypt

Revision: Rev 2.4 draft 1 · Growth Edition, 24 November 2026 (new volume; owner: Chief Marketing Officer; supersedes: none; extends KX-14 sections 03 to 05 and 09 for patient demand)

Subtitle: How Kiorex gets patients in Egypt without buying them: provider-led first, organic second, referral and WhatsApp third, paid last and only after verified provider supply.

Tags: Go-to-market · Egypt · 30/60/90 · 6 and 12 months · Playbooks · Geography and specialties · Budget hypotheses · Scenarios

> **Note** How to read this volume. It is a strategy and a hypothesis sheet, not a forecast. Every number marked ASSUMPTION is a starting value to replace with pilot data at month 3 and month 6. The supply-side plan (clinics, nurses, field reps) stays in KX-14 section 04; this volume covers patient demand. Status labels are defined in the legend below.

| Field | Value |
|---|---|
| DOCUMENT | KX-29 |
| REVISION | Rev 2.4 draft 1 · Growth Edition (24 November 2026) |
| STATUS | Proposed strategy; founder confirmation of the 50/25/15/10 interpretation is an Open decision |
| OWNER ROLE | Chief Marketing Officer, with Head of Growth |
| AUDIENCE | Founders, marketing, field operations, finance, investors |
| RELATED | KX-14; KX-13; KX-17; KX-27; KX-30; KX-31; KX-32; KX-33 |

## Revision history
| Revision | Date | Change | Author |
|---|---|---|---|
| Rev 2.4 draft 1 | 24 Nov 2026 | First issue from the Phase 1 work packages report, section 6, extended with playbooks, geography, specialties and scenarios | Documentation agent |

## Contents
01 Summary · 02 Principles and constraints · 03 The 50/25/15/10 hypothesis · 04 Geography · 05 Specialties · 06 Playbooks · 07 30, 60 and 90 days · 08 Six and twelve months · 09 Budget hypotheses · 10 Scenarios · 11 Guardrails · 12 KPIs, risks, dependencies, open decisions

## Key numbers
<!-- kpis -->
- **EGP 40** fee per attended new patient; about **EGP 38** after a 4 percent dispute rate
- **EGP 150,000** illustrative monthly marketing budget (hypothesis, not approved)
- **50 / 25 / 15 / 10** hypothesis split, interpretation open
- **8 percent** search-to-booking gate and **12** attended new patients per listed provider to open the next cluster (KX-14)
- **0** large paid spend before the liquidity gate

## Status legend (read first)
Every statement in this volume carries one of these labels, in a column, a prefix or a callout. Growth Engine Phase 1 is being implemented by other agents while this volume is written, so the labels matter more than usual.

| Label | Meaning | Rule for readers |
|---|---|---|
| **As-built** | Exists in code and tests in the workspace, verified by reading the repositories on 24 Nov 2026 (discovery) and re-checked for the items named in KX-28 §02 | Safe to rely on. Everything not listed as As-built does not exist yet |
| **Approved target** | Accepted by the founder as an ADR or founder decision (FD) | Binding. As of this revision no growth ADR is Accepted, so this label marks only rules inherited from existing Accepted ADRs |
| **Proposed** | Designed in the Growth reports of 24 Nov 2026 and written up here, not yet signed (ADR-041 to ADR-047) | Build only after sign-off, or inside a work package the founder released |
| **Roadmap** | Phase 2 to 4 capability, scoped coarsely | Do not build; estimates are ranges |
| **Open decision** | A founder or CEO choice with a stated default | Use the default, never decide silently |
| **Regulatory dependency** | Needs counsel, DPO, a regulator position or a partner approval (NEEDS_HUMAN) | Flag stays OFF in production until evidence is recorded; never mark a gate satisfied |

> **Warning** Nothing in this volume has run in production, against a real ad platform, search engine, WhatsApp number or payment provider. Messaging and provider integrations stay MOCKED until the pre-launch pass (FD-04). Numbers marked ASSUMPTION are starting hypotheses, not forecasts.

## 01 Summary
The patient side of the marketplace is the expensive side. Kiorex only earns EGP 40 when an attended new patient arrives through the marketplace, and nothing when a provider's own patient books through the provider's own link. That makes provider-led acquisition the cheapest way to grow usage (zero patient CAC, it also makes providers loyal) but it does not by itself create fee revenue. The plan therefore does two jobs at once: it makes provider-owned channels so easy that providers adopt Kiorly and Kiorex booking, and it builds organic and referral demand that brings Kiorex-acquired new patients who carry the fee.

> **Decision** (Proposed) Sequence: provider-led and organic first; referral and WhatsApp when consent and counsel allow; paid acquisition only as bounded tests after the cluster liquidity gate, in Arabic, without health-condition targeting and without patient identifiers. No large paid spend without verified provider supply.

## 02 Principles and constraints
| # | Principle | Source |
|---|---|---|
| 1 | Supply before demand: spend on patients only where live slots exist | KX-14 section 03 liquidity gate |
| 2 | Density beats coverage: one cluster at a time | KX-14 |
| 3 | Never pay for patients a provider already has: provider-led bookings carry no fee | ADR-007, KX-30 |
| 4 | Arabic first, Egyptian dialect for patient copy; Modern Standard Arabic for clinical and legal | KX-14 section 10 |
| 5 | No health-condition targeting, no remarketing, no patient lists as ad audiences | KX-15, ARCH section 14 |
| 6 | Marketing messages only with consent; licence status confirmed by counsel | PDPL (Regulatory dependency) |
| 7 | Every campaign approved by the CMO for clinical accuracy; no claims about outcomes | KX-14 |
| 8 | Measure revenue, not gross booking value | KX-32 |

## 03 The 50/25/15/10 hypothesis
The founder supplied a four-way split of patient acquisition. The interpretation below is the discovery agent's reading and is **not confirmed**.

> **Open question** Is 50/25/15/10 (a) the share of attended new patients by acquisition channel group, (b) the share of the patient-marketing budget, or (c) both? Default until the founder answers: (a) for the patient mix and an independently justified budget (section 09), with (b) shown as an alternative so finance can see the literal reading.

| Share | Channel group (interpretation, NEEDS_HUMAN confirm) | Why it should hold | How the engine measures it | Kill or pivot test |
|---|---|---|---|---|
| 50 percent | Provider-led: links, QR in clinics, widgets, Google Business Profile booking links, desk QR | Providers already have patients and trust; zero patient CAC | Decision origin `PROVIDER_LED` | Below 30 percent by month 9: providers are not activating links; fix supply tooling |
| 25 percent | Organic search and maps: SEO pages, Google Business, WhatsApp link previews | Local intent, compounding | Touch kind `ORGANIC_SEARCH`, Search Console | Below 10 percent by month 12 with 3,000 indexed pages: rendering or content problem |
| 15 percent | Referral and WhatsApp: patient referral (Phase 2), WhatsApp entry, community | Trust-based, cheaper than paid | Referral relationships, WhatsApp conversations | No qualified referral in the first 60 days of Phase 2: incentive or experience problem |
| 10 percent | Paid and partnerships: social, employers, insurers, hospital-discharge cards | Needed for cluster seeding, expensive | Campaign spend over attributed attended new patients | CAC above the payback tolerance: stop |

Reading the table: a provider-led patient is real usage but not fee revenue. If 50 percent of attended new patients are provider-led, the fee-bearing patients are the other 50 percent. That is why the revenue model carries the provider-led share explicitly (KX-13).

## 04 Geography
Cluster order follows KX-14 section 03 (candidates, not final): **Cluster 1** Nasr City and Heliopolis, **Cluster 2** New Cairo including Fifth Settlement, **Cluster 3** Mohandessin and Dokki; wave 2 after month 9: Maadi, 6th of October, Alexandria.

| Rule | Detail | Label |
|---|---|---|
| Open a cluster for paid tests only when the gate passes | At least 150 LIVE doctors across the top 8 specialties, median next slot at most 48 hours, search-to-booking at least 8 percent, at least 12 attended new patients per listed provider per month | Approved target (KX-14, Accepted) |
| SEO pages follow the same order | District pages are indexable only above the live-provider threshold (default 3) | Proposed |
| Districts come from the market pack | District list is NH-040 / FD-14, still open | Open decision |
| Home care opens per cluster at 50 home-enabled providers | KX-03 gate | Approved target |

## 05 Specialties
The top 8 specialties of KX-14 are not named in the existing volumes. The list below is a **hypothesis** for the first search-demand review; replace it with Search Console, Google Business and pilot data in the first 30 days.

| Priority | Specialty (hypothesis) | Reason | Validation |
|---|---|---|---|
| P1 | Paediatrics, obstetrics and gynaecology, dermatology, dentistry | High frequency, appointment-driven, strong local search | Pilot clinics' own mix |
| P1 | Internal medicine, orthopaedics, ENT, ophthalmology | Dense specialist streets in clusters | Same |
| P2 | Physiotherapy and home nursing | Home care opens per cluster; nurse listing is launch-locked (GKN2) | KX-23 gates |
| P3 | Labs and pharmacies | Phase 4; flags `kiorex.lab_bookings`, `kiorex.pharmacy_orders` launch-locked | KX-06, KX-07 |

Rule: a specialty-in-district page is published only when real live providers exist; no page is created to chase search volume (thin-page guard, KX-31).

## 06 Playbooks
Each playbook states owner, steps, measure and stop rule. All Proposed.

| ID | Playbook | Steps | Measure | Stop rule |
|---|---|---|---|---|
| PB1 | Clinic QR and link kit | Rep installs desk QR poster (A4/A5, AR/EN), sets up a link per doctor, shares the link in the clinic's WhatsApp groups and Facebook page, trains the front desk to offer it at check-out | Link visits, bookings, repeat use per provider | A clinic with no booking after 30 days gets a support call; poster redesign after 3 clinics fail |
| PB2 | Google Business Profile booking link | Guide for providers to put the tracked link on the profile's appointment URL; rep helps in the first visit | Link bookings by channel kind `GOOGLE_PROFILE` | If profile edit rights are missing, drop for that provider |
| PB3 | Own-website widget | Provider pastes script or iframe; allowlist the domain | Widget bookings (always provider-led) | Widget abuse or hostile embed: RB-G4 |
| PB4 | Local SEO cluster build | Slug bootstrap, thin-page guard, specialty-in-district pages for the live cluster, FAQ blocks reviewed by the CMO, Search Console verified | Indexed pages passing guard, impressions, organic bookings | Indexation below 50 percent after 60 days: audit content and render |
| PB5 | WhatsApp entry | `wa.me` link and QR into the existing deterministic booking flow; assistant later (Phase 2) | WhatsApp conversations started, completion | Wrong-booking incident: pause the assistant flag |
| PB6 | Patient referral (Phase 2, counsel-gated) | Referral link; reward only after the friend's attended visit and refund window; no sight of the friend | Qualified referrals, reward cost per qualified referral | No qualified referral in 60 days, or fraud rate above threshold |
| PB7 | Hospital discharge and surgeon cards | Referral cards for post-operative physio and nursing at home from orthopaedic and general surgeons on Kiorly | Home bookings from card | Below target after 2 quarters |
| PB8 | Specialty society evenings | CME evenings that teach the link and QR kit | New provider activations | Poor attendance conversion |
| PB9 | Bounded paid test | Click-to-WhatsApp or Maps-area ads in a gated cluster; Arabic; no condition targeting; anonymised conversions only | Paid CAC against guardrail (KX-13) | CAC above guardrail for 2 consecutive weeks, or any policy warning |
| PB10 | Employers and insurers | Employee booking programmes | Covered lives | Phase 4, month 15 and later |

## 07 30, 60 and 90 days
Month 1 is January 2027 (KX-14 section 08); today is 24 Nov 2026. The first column is therefore "before month 1".

| Window | Goals | Engine deliverables (Proposed, KX-33) | Field and content | Exit evidence |
|---|---|---|---|---|
| Before month 1 and first 30 days | Founders sign ADR-041 to ADR-047; counsel starts the consent and marketing questions; 20 pilot clinics recruited (KX-17) | Phase 1 wave 0 and 1: contracts, schemas, links and QR, consent, SSR skeleton | QR kit designed; Arabic FAQ and help copy drafted; Search Console and Business Profile owners named | ADRs signed; pilot list; counsel engagement letter |
| 60 days | Pilot clinics live with links and QR; first indexed pages in the pilot cluster | Phase 1 wave 2: attribution live, commission integration, widget beta, SEO templates, analytics overview | Posters at desks; link shared in clinic WhatsApp groups; Business Profile guide; first provider-led bookings | At least 15 of 20 pilot clinics with a booking through a link |
| 90 days | KX-17 pilot exit; attribution accuracy audit | Phase 1 complete; SLO baselines; first Search Console data | Measure provider-led share, dispute rate, link activation, organic impressions | Replay equality 100 percent; dispute rate below 5 percent; consent audit clean |

## 08 Six and twelve months
| Window | Goals | Engine | Field and content | Gate |
|---|---|---|---|---|
| About month 6 | Kiorex closed beta (month 4) to public launch; cluster 1 liquidity gate | Start Phase 2: campaigns, lifecycle messaging under consent, provider Growth workspace v2 | Nasr City, Heliopolis, New Cairo first; specialty society evenings; first 50 specialty-district pages passing the guard (600 pages at the cluster edge is the month 6 target) | Liquidity gate passes before any paid test |
| About month 12 | Clusters 2 and 3 open; home care by cluster gate | Phase 2 complete (WhatsApp assistant, referral and rewards if legal clears); start Phase 3 experiments | Content cadence per specialty; referral pilot; first bounded paid tests with a CAC ceiling | CAC ceiling and MER reviewed with finance |

Month 12 is the earliest point at which the marketing budget should step above its first tier (section 09).

## 09 Budget hypotheses
> **Warning** The figures below are an illustrative budget supplied for planning (EGP 150,000 per month). They are hypotheses, not approved spend, and they have not been reconciled with KX-14 section 09 (patient acquisition 30 percent of sales and marketing) or KX-13 (sales and marketing USD 25,000 per month at the start). Reconciling them is an Open decision for the CEO and finance.

Two readings of the founder's split applied to EGP 150,000 per month (the second is the literal application, kept for transparency):

| Channel group | A: allocation justified by role (hypothesis) | EGP | B: literal 50/25/15/10 | EGP | What the money buys |
|---|---|---|---|---|---|
| Provider-led enablement | 25 percent | 37,500 | 50 percent | 75,000 | QR and poster printing, rep incentive for link activation, provider training, Business Profile help |
| Organic and local SEO | 35 percent | 52,500 | 25 percent | 37,500 | Arabic content and FAQ writing, design, Search Console and rendering monitoring, slug and photo work |
| Referral and WhatsApp | 15 percent | 22,500 | 15 percent | 22,500 | WhatsApp utility and marketing message cost (Meta rate card), referral design; rewards only after counsel |
| Paid and partnerships | 25 percent, held in reserve | 37,500 | 10 percent | 15,000 | Bounded tests after the gate; unspent paid budget is redeployed to supply tooling, never rolled into a larger test |

Staging (Proposed): months 1 to 3 spend only on enablement and organic (section 06 PB1 to PB4), roughly EGP 30,000 to 60,000 per month; the full EGP 150,000 applies only after the liquidity gate. A tier above EGP 150,000 needs a finance review of KX-13 guardrails.

Why the budget is small relative to revenue at first: at the base-case bottom-up, month 12 fee revenue is about EGP 107,000 a month (KX-32), below a EGP 150,000 spend. That is a real finding, not an error: Kiorex patient marketing is paid back by supply-side effects (listings, retention, sponsored listings, Pay margin) as much as by the first-visit fee. See KX-13 guardrails.

## 10 Scenarios
All values derive from the formulas in KX-32 section 05 with tenants T from KX-14 (341 at month 6, 857 at month 12). Listed providers per listing tenant d is 1.5 in every scenario. Fee f is EGP 40. Base-case revenue uses the rounded intermediate counts of the source report (EGP 7,872 and EGP 106,637); other cells are computed unrounded and can differ by up to 0.2 percent.

| Scenario | Month | Inputs L / a / p / r | Listed providers | ANP | Fee-bearing | Fee revenue per month (EGP) | CAC at 150,000 | MER |
|---|---|---|---|---|---|---|---|---|
| Conservative | 6 | 15% / 3 / 55% / 6% | 77 | 230 | 104 | 3,895 | 652 | 0.03 |
| Conservative | 12 | 35% / 6 / 50% / 6% | 450 | 2,700 | 1,350 | 50,752 | 56 | 0.34 |
| Base | 6 | 20% / 4 / 50% / 4% | 102 | 409 | 205 | 7,872 | 367 | 0.05 |
| Base | 12 | 45% / 8 / 40% / 4% | 578 | 4,628 | 2,777 | 106,637 | 32 | 0.71 |
| Aggressive | 6 | 25% / 5 / 40% / 3% | 128 | 639 | 384 | 14,885 | 235 | 0.10 |
| Aggressive | 12 | 55% / 10 / 30% / 3% | 707 | 7,070 | 4,949 | 192,028 | 21 | 1.28 |

Inputs: L share of tenants with a LIVE listing, a attended new patients (ANP) per listed provider per month, p provider-led share, r dispute rate. CAC is EGP per attended new patient if the full EGP 150,000 were spent; MER is fee revenue over that spend.

Reading: at EGP 150,000 per month, blended CAC is far above one fee at month 6 in every scenario and approaches one fee only at month 12. So the spend must ramp with liquidity (section 09 staging) and its justification is not the first-visit fee alone. Source assumptions are in KX-13 section 13 (new). Reconciliation with KX-14's attended-visit series is in KX-13: the bottom-up lands near 14 percent (month 6) and 34 percent (month 12) of KX-14's 2,900 and 13,667.

## 11 Guardrails
- No large paid spend without verified provider supply (the liquidity gate of section 04). A "large" spend is any monthly paid-platform spend above 10 percent of the monthly budget, or any spend in a cluster that has not passed the gate.
- Paid test stop rules: CAC above guardrail for 2 consecutive weeks; any ad-policy warning; any complaint about health targeting.
- LTV/CAC guardrails live in KX-13 (section 13) and KX-32.
- Marketing messages: none in production until counsel confirms consent mechanics and the reported marketing licence (flag `growth.marketing_messaging` launch-locked OFF).
- Provider promises must stay true: "pay nothing for patients you bring" is a product rule (KX-30) and a marketing line only after Phase 1 attribution is live.
- No claims copied from vendors (for example Zocdoc's self-reported lifts); measure our own.

## 12 KPIs, risks, dependencies, open decisions
### KPIs
Provider-led share; providers with an active link; indexed pages passing the guard; organic share of attended new patients; qualified referrals; WhatsApp completion rate; paid CAC and MER; link activation per pilot clinic (definitions KX-32).

### Risks and mitigations
| Risk | Mitigation |
|---|---|
| Providers channel everything through links; fee revenue lags | Track provider-led share; show the incremental marketplace value; revenue model carries p |
| Arabic search behaviour differs from assumptions | Validate with Search Console before scaling pages; long-tail first |
| Vezeeta head-term dominance | Compete on live-slot long-tail pages and verified reviews |
| Budget burn before liquidity | Staging and the no-large-paid-spend rule |
| Marketing law uncertainty | Counsel gate; mock mode |
| Incomplete field execution | Rep incentives tied to link activation, not signups only |

### Dependencies
Phase 1 delivery (KX-33); pilot clinics (KX-17); counsel; district list (NH-040); Search Console and Business Profile ownership; Meta template approvals (Phase 2).

### Open decisions
Interpretation of 50/25/15/10; reconciliation of the EGP 150,000 illustration with KX-13 and KX-14 budget lines; the top 8 specialty list; cluster order confirmation; whether the first paid test is Click-to-WhatsApp or Maps-area.
