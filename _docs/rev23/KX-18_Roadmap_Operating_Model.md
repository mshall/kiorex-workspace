# KX18 · 36-Month Roadmap & Operating Model
Source: 1agB72kMlqgTC4JTaiu3UhEanK_YF792e
Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (first issued 20 November 2026; this update adds progress against the roadmap)

> Extraction note: Gantt chart text is scrambled; quarter table rows reconstructed from text order (PDF text layer places some cells after the next row header). Symbols restored by inference.

Section 07 — ROADMAP & DELIVERY. Quarter-by-quarter delivery across six products, the team that delivers it, and the operating rhythm that keeps a part-time founding team in control. Owner: COO. Audience: founders, team leads, investors.

WHAT CHANGED IN REV 2.3 (as printed): New roadmap rows: professions + physio pack Q3, home visits Q4, Kiorly Nurse (discovery Q3 → pilot Q5 → GA Q6), Lab home collection on the shared field-visit package. Team plan adds a home-care product lead, nursing advisor and safety on-call; topology adds Nurse edition ownership inside the Kiorly Clinic squad. Capacity rule: if capacity binds, Kiorly Nurse GA moves before Pharmacy GA does.

## 01 Roadmap at a glance (month 1 = January 2027)
Lanes (Q1–Q12): Kiorly Clinic: pilot · GA; Kiorly Clinic Phase 1b (KX11 · CL06/07); Professions + physio pack (PRSOP); Field-visit package + home visits (extract M7-9 · live ...; text truncated); Commerce kernel package extract; Kiorex patient MVP build · beta M4 · public; Kiorex growth clusters 1-6; Kiorex Account (patients) OIDC; Provider SSO (Kiorly); Kiorly Nurse: disc · build · pilot M13 · GA M16-18; Kiorex home nursing (agencies); Kiorly Pharmacy: disc · build · pilot M13 · GA M16; Kiorex pharmacy orders; Kiorly Lab: build · pilot M19 (+ home); Kiorex lab bookings + home; Enterprise programme; Market 2 pack · pilot M25; Series A raise. Figure 1 — 36-month portfolio.

DECISION: Deploy = live. Every module ships to production enabled by default the day it is deployed; the Kiorex super admin can switch it off at global, market or organization scope (ADR-023). The dates below are therefore go-live dates. Launch-locked capabilities (home visits, physio category, nursing care plans and MAR, individual nurse listing, pharmacy orders, lab bookings) go live when their gate is recorded.

## 02 Quarter-by-quarter deliverables
| Q | Months | Product deliverables | Exit criteria |
|---|---|---|---|
| Q1 | Jan–Mar 2027 | Kiorly pilot (≈20 clinics); STOP items closed; Kiorex MVP build; IdP selected | GA gate G2 passed |
| Q2 | Apr–Jun 2027 | Kiorly GA; Kiorex closed beta (M4) → public Egypt (M6); patient accounts | ≥300 LIVE doctors; ≥95% booking concordance |
| Q3 | Jul–Sep 2027 | Phase 1b (record share, lab orders, AI receptionist pilot); kernel extraction; profession model + physio pack; @kiorly/field-visit extracted; clusters 3–4; pharmacy discovery; Kiorly Nurse discovery (15 nurse + 5 agency interviews); counsel memos GHV1, GKN2 requested | Founding trials converting ≥50%; GPR1/GPR2 recorded |
| Q4 | Oct–Dec 2027 | Provider SSO; Kiorly Pharmacy build; specialty packs; RP04; home visits for doctors and physios + Kiorex home filter in 2 clusters | ≥850 active tenants; ≥12 Kiorex patients/provider; GHV1 + GHV2 recorded |
| Q5 | Jan–Mar 2028 | Pharmacy pilot (M13); Kiorly Nurse build + pilot (10 solo nurses, 3 agencies); scribe GA with production STT; enterprise programme design | ≥20 pharmacies live; GKN1 signed; missed nurse visits <3% |
| Q6 | Apr–Jun 2028 | Pharmacy GA (M16); Kiorex pharmacy orders; Kiorly Nurse GA (M16–18); Kiorex home-nursing category (agencies; individuals if GKN2); first enterprise contract; Series A raise | Series A gates met |
| Q7 | Jul–Sep 2028 | Kiorly Lab build (home collection on field-visit); Market-2 pack design; no-show ML model | Pharmacy NRR ≥100% |
| Q8 | Oct–Dec 2028 | Lab pilot (M19) → GA (M21); Kiorex lab bookings + home collection | ≥8 pilot labs; zero QC stop-ships |
| Q9 | Jan–Mar 2029 | Market 2 pilot (M25) incl. scope-of-practice matrix; self-hosted AI evaluation | Market pack certified |
| Q10 | Apr–Jun 2029 | Market 2 GA; insurer/TPA interfaces; telehealth (if approved) | Market-2 unit economics positive at contribution |
| Q11 | Jul–Sep 2029 | Care continuity across products (Rx → pharmacy, orders → lab → clinic, discharge → home nursing) | Cross-product journeys ≥10% of patients |
| Q12 | Oct–Dec 2029 | Scale: capacity planning, advanced automation, next-market readiness | EBITDA trajectory to break-even |

WATCH — Capacity rule (R17): Kiorly Nurse is mostly configuration and UI over Kiorly Clinic code, built by the Clinic squad. If capacity binds in Q5–Q6, Kiorly Nurse GA moves; Pharmacy GA (M16) does not.

## 03 Team plan
Figure 2 — Headcount plan (base): 14 FTE M1 → 28 M12 → 46 M24 → 60 M36; intermediate points interpolated. (Total FTE, base, KX13.)

| Hire | When | Why |
|---|---|---|
| Head of Engineering / CTO | By M6 | Remove key-person risk R10; own architecture and on-call |
| Kiorex product lead + 2 mobile engineers | M1–M3 | Patient MVP |
| Customer success lead + 4 onboarding specialists | M1–M4 | Pilot and founding cohort activation |
| Field sales lead + 6 reps (commissioned) | M2–M6 | Supply acquisition |
| Security lead (part-time → full) | M6 / M18 | Pen tests, audits, enterprise asks |
| Home-care product lead + nursing advisor (part-time) | M7 | Physio pack, home visits, Kiorly Nurse (KX23); GKN1 templates |
| Safety on-call rota (ops, 24/7 for home visits) | M10 | Home-visit safety alerts ≤15 min |
| Pharmacy product lead + clinical pharmacist advisor | M8 | KX06 discovery and build |
| Finance manager | M9 | Monthly close, Series A data room |
| Lab product lead + pathologist advisor | M14 | KX07 |
| Market-2 country manager | M21 | Market pack and launch |

## 04 Team topology
Teams aligned to repositories; one owner per repo (CODEOWNERS).
| Squad | Owns | Scope |
|---|---|---|
| Kiorly Clinic squad | clinics-management | Phase 1b, kernel and field-visit packages; Professions, home visits, Kiorly Nurse edition; On-call for clinic API |
| Kiorex squad | kiorex-platform | Patient app, search, booking (incl. home), Kiorex Pay; Ops console, safety console |
| Platform & identity | kiorex-account, kiorex-contracts | OpenTofu modules, CI, observability; Security controls |
| Pharmacy squad (M8) | kiorly-pharmacy | POS, inventory, Rx |
| Lab squad (M14) | kiorly-lab | LIMS, analyzers, collection (field-visit) |
| Growth & ops | business | Onboarding, support, reps; Liquidity dashboards; Provider verification per profession; safety on-call |

## 05 Operating cadence
| Rhythm | Forum | Inputs | Outputs |
|---|---|---|---|
| Daily | Squad stand-ups (async allowed) | Board, alerts | Blockers cleared |
| Weekly | Founders' review (60 min) | Scorecard, incidents (incl. home-visit safety), pipeline | Decisions, priorities |
| Bi-weekly | Release review | Changelog, test evidence | Go/no-go |
| Monthly | Business review + model refresh + flag review | Cohorts, burn, gates, flags OFF >30 days | Updated KX13, board pack, flag decisions |
| Quarterly | Roadmap re-score | Evidence vs plan | Re-prioritised portfolio |

## 06 Company scorecard
| Metric | Owner | M6 target | M12 target | M24 target |
|---|---|---|---|---|
| Active clinic tenants | Growth | 341 | 857 | 2,146 |
| Paying clinics | Growth | — | 109 | 499 |
| Attended Kiorex visits / month | Kiorex | 2,900 | 13,667 | 51,101 |
| Monthly revenue (EGP k) | CEO | 42 | 541 | 4,090 |
| Booking concordance | Eng | ≥95% | ≥99% | ≥99.5% |
| S1/S2 clinical incidents | CMO | 0 | 0 | 0 |
| Home-visit safety alerts resolved ≤15 min | CMO | — | 100% | 100% |
| Months of runway | CFO | ≥18 | ≥12 | ≥18 (post-A) |

## 07 Build method for new repositories
Repository map, migration order and the build-agent brief: KX22.
- Every step that adds a capability also adds its flag key, OFF behaviour and per-flag OFF contract test (definition of done).
- Each new repo gets a Docs/<product>-cursor-build-sequence.md modelled on Kiorly's: stages, numbered steps with IDs, acceptance tests, 'stop and ask the human' rules, progress tracker. Kiorly Nurse is a stage inside the Kiorly build sequence, not a new repo.
- Steps cite PRD requirement IDs (KXM, KP, KL, KA, PR, HV, KN*). Definition of done per step: migration + API + UI + tests + doc status row updated in the same change (GT06 convention).
- Human-only items go to a NEEDS_HUMAN.md register with STOP flags, as in Kiorly (counsel memos GHV1, GKN2 and CMO sign-offs GHV2, GKN1, GPR2 are human items).

## 08 Progress against the roadmap (23 Nov 2026)
The roadmap dates (month 1 = January 2027) are the founder's gates and were not changed. Build progress is ahead of the plan in several lanes because the work is local and mock-provider based; go-live dates still depend on human gates.

| Lane | Plan | Observed on 23 Nov 2026 | Status |
|---|---|---|---|
| Kiorly Clinic pilot, GA | Q1, Q2 2027 | Built; STOP items and operations work open (KX17) | Open |
| Kiorex patient MVP | Build Q1, beta M4 | API, web, ops console and Expo app running locally with 36 specialties of demo doctors | Done (dev) |
| Kiorex Account | Month 1 | Dev OIDC provider, OTP providers ready | Done (dev) |
| Professions, home visits, Kiorly Nurse | Q3 2027 to Q6 2028 | Built locally behind launch-locked flags; Nurse entry in the staff app | Done (dev); gates Open |
| Kiorly Pharmacy | Build Q4 2027, pilot M13 | Built locally incl. mobile module and provider adapters | Done (dev); pilot Planned |
| Kiorly Lab | Build Q7 2028, pilot M19 | Built locally incl. mobile module and nurse hand-off | Done (dev); pilot Planned |
| Staff mobile app | not in the roadmap | Kiorly Team, one app for four entries (ADR-033, Proposed) | Done (dev); store submission Blocked |
| Notification layer | not in the roadmap | Platform done; four migrations Planned | Planned |
| Communications control plane | not in the roadmap | Proposed in KX24 §10 | Planned (Proposed) |
| Real providers and push | before pilot | Adapters ready | Blocked (human) |

> **Risk** Capacity rule R17: more built surface raises review, QA and support load before any revenue. Pharmacy and Lab modules ship OFF globally until their pilots (ADR-017) unless the founder rules otherwise (mobile Q6).

## What changed in this revision (23 Nov 2026)
- Added §08 progress table. Quarter plan, team plan, topology, cadence and scorecard are unchanged.
- Not verified: team capacity and spend; no change to dates was made.
