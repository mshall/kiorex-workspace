# KX-27 — Growth and Patient Acquisition Engine PRD

Revision: Rev 2.4 draft 1 · Growth Edition, 24 November 2026 (new volume; owner: Head of Product with the Chief Software Architect; supersedes: none)

Subtitle: What the Growth and Patient Acquisition Engine must do, for whom, in which phase, how we will know it works, and what is built today versus proposed.

Tags: Growth PRD · Provider links and QR · Attribution · SEO pages · Widgets · Consent · Analytics · Phases 1 to 4 · Proposed

> **Note** How to read this volume. It is the product requirements document for the Growth Engine. The design lives in KX-28, the attribution and money rules in KX-30, the Egypt go-to-market in KX-29, SEO and app-store work in KX-31, metric definitions in KX-32 and the build plan in KX-33. The inputs are the four reports in `_docs/growth/` (discovery, architecture decisions, competitive research, Phase 1 work packages), written on 24 Nov 2026. Where this volume says As-built it means present in code today; everything else is Proposed, Roadmap, an Open decision or a Regulatory dependency.

| Field | Value |
|---|---|
| DOCUMENT | KX-27 |
| REVISION | Rev 2.4 draft 1 · Growth Edition (24 November 2026) |
| STATUS | Proposed. Phase 1 build started by other agents (wave 1); nothing here is Accepted until ADR-041 to ADR-047 are signed |
| OWNER ROLE | Head of Product (requirements), Chief Software Architect (design) |
| AUDIENCE | Founders, product, engineering, build agents, marketing, counsel and DPO, investors in due diligence |
| RELATED | KX-28 architecture; KX-29 go-to-market; KX-30 attribution; KX-31 SEO and ASO; KX-32 analytics; KX-33 roadmap; KX-01 ADR-041 to ADR-047; KX-03; KX-05; KX-09; KX-12; KX-13; KX-14; KX-15; KX-24 |

## Revision history
| Revision | Date | Change | Author |
|---|---|---|---|
| Rev 2.4 draft 1 | 24 Nov 2026 | First issue, consolidated from the four Growth reports; status legend added | Documentation agent |

## Contents
01 Executive summary · 02 Goals, non-goals and principles · 03 Users and jobs to be done · 04 Capability map and phases · 05 Functional requirements · 06 Non-functional requirements · 07 Acceptance criteria · 08 KPIs · 09 Risks and mitigations · 10 Dependencies · 11 Priorities · 12 Open decisions and regulatory dependencies · 13 Cross-references

## Key numbers
<!-- kpis -->
- **40** capabilities inventoried in discovery (11 exist, 14 partial, 15 absent)
- **13** Phase 1 work packages, 84 engineer-days
- **7** proposed ADRs (ADR-041 to ADR-047)
- **EGP 40** flat fee per attended new patient (ADR-007, unchanged)
- **0** growth modules in code before wave 1 (verified 24 Nov 2026)

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

## 01 Executive summary
Kiorex earns EGP 40 only when an attended new patient arrives through the marketplace (ADR-007). Providers are never charged for patients they bring themselves. Today the money half of that promise exists and is well tested, but everything upstream of the booking is missing: no evidence of where a patient came from, no provider link tracking, no indexable pages, no embeddable booking, no consent-gated analytics. The Growth Engine closes that gap so that Kiorex can (a) prove why a fee was or was not charged, (b) win local search demand in Arabic and English, (c) give every provider a free, measurable way to bring their own patients, and (d) measure acquisition cost against what Kiorex actually earns.

**As-built (24 Nov 2026).** The clinic stamps `Appointment.bookingSource` (`FRONT_DESK, PHONE, WALK_IN, CLINIC_LINK, KIOREX_MARKETPLACE, KIOREX_WHATSAPP, INTEGRATION, IMPORT`) and `isNewPatientAtBooking` (24-month lookback). `isCommissionChargeableBooking()` returns false for `CLINIC_LINK`, for non-new patients and for any other source. The charge engine is idempotent per appointment. Booking slugs and a public page `/b/:slug` exist. A notification layer with purposes, consent and quiet hours exists (KX-24). A deterministic WhatsApp booking state machine exists. A supply-side doctor-to-doctor referral programme exists in the clinic. The patient web is a client-only Vite single-page app with no sitemap, robots, structured data or slugs.

**Proposed.** Eleven Phase 1 capabilities (section 04) delivered as modules inside the two existing modular monoliths, with no new service, no Redis and no Kafka. Phase 2 adds campaigns, patient referral and rewards (counsel-gated), lifecycle messaging, a WhatsApp assistant and the provider Growth workspace v2. Phases 3 and 4 add experiments, paid-platform adapters and the pharmacy, lab and nurse surfaces.

> **Decision** Two findings change the plan. (1) Kiorex earns once per new patient per provider network, so patient-marketing return must be read against first-visit fees, not gross booking value. At EGP 40 less disputes, a patient is worth about EGP 38 on the fee alone, so paid acquisition cannot be justified by fee revenue alone (KX-32, KX-13). (2) KX-14's attended-visit targets are about 14 percent (month 6) and 34 percent (month 12) of what a bottom-up from tenants and listing rates gives for fee-bearing new patients. The series must be re-based (KX-13 section 12).

## 02 Goals, non-goals and principles
### Goals
| ID | Goal | Measure | Label |
|---|---|---|---|
| G1 | Prove every commission decision with replayable evidence | 100 percent of charged and uncharged bookings carry a decision record; replay equality 100 percent | Proposed |
| G2 | Make provider-owned acquisition free, easy and visible | Providers with an active link or QR; provider-led share of attended new patients | Proposed |
| G3 | Win indexable local demand in Arabic and English | Indexed pages that pass the quality guard; organic bookings per month | Proposed |
| G4 | Measure acquisition honestly | CAC, ROAS, MER from revenue not GBV, under consent and k-anonymity | Proposed |
| G5 | Stay lawful and trusted | Zero marketing sends without consent; no health-condition targeting; no patient identifiers to ad platforms | Proposed, Regulatory dependency |
| G6 | Run in any market by configuration | A second market needs configuration and data, no code fork | Proposed |

### Non-goals
- Changing the fee amount or when it is charged (ADR-007). Any rule that charges providers more than today is not proposed and needs the CEO (Open decision).
- Tax-authority integration of any kind (ADR-011).
- A new microservice, Redis, Kafka or a third-party CDP or attribution vendor.
- Ad audiences built from patient lists, remarketing, or health-condition targeting.
- Stored-value wallets. Rewards, if cleared by counsel, are closed-loop discount credit or coupons (KX-30).
- Clinical decisions in the assistant; marketing as a safety path.

### Principles
1. Every Kiorly product works without Kiorex (ADR-001/002). Provider links, QR and widget settings work for a standalone organisation.
2. The clinic is the only system of record for appointments (ADR-005). Growth adds fields to the existing signed booking call (contracts 1.10.0), never a shared table.
3. Attribution is a deterministic pure function with an immutable evidence record, never a spreadsheet judgement.
4. Evidence can only remove a fee, never add one.
5. Every capability ships ON and can be switched OFF at global, market and organisation scope (ADR-023); launch-locked flags need human gate evidence (ADR-024); safety messaging is never a flag (ADR-025).
6. Mock first (FD-04): every ad, search, messaging and store integration defaults to `MODE=mock`.
7. No PHI in logs, events or analytics; Arabic and English with RTL on every surface.

## 03 Users and jobs to be done
| Persona | Job | What the Engine gives them | Phase |
|---|---|---|---|
| Patient (Arabic-first, WhatsApp-first) | Find a trustworthy doctor nearby and book quickly | Indexable doctor, clinic and specialty-in-district pages; fast booking; reminders; clear preferences and opt-out | 1 |
| Patient who was sent a link by their own doctor | Book with the doctor I already trust | One-tap booking via provider link, QR or widget; no marketplace detour | 1 |
| Clinic owner or front desk | Bring existing patients online, pay nothing for them, see what works | Links per doctor, branch and desk; A4/A5 AR/EN QR posters; widget for their website; last-30-day counters; explanation of fee or no fee | 1 |
| Clinic owner (growth minded) | Reach new patients and control cost | Marketplace listing, monthly cap and pause, campaign tools | 2 |
| Kiorex operations | Understand funnel and attribution, settle disputes with facts | Growth overview, evidence per booking, link and widget monitoring, consent and communications view | 1 |
| Super admin | Change policy safely | Versioned growth configuration with maker-checker, effective dating and rollback | 1 |
| Marketing and SEO lead | Grow organic and referral demand without breaking rules | Page-quality guard, sitemaps, Search Console data, campaign builder, budgets | 1 to 2 |
| Counsel and DPO | Prove consent and minimise data | Consent register, retention jobs, erasure, processing record, ad-payload guard | 1 |
| Patient referrer (Phase 2) | Invite friends and get a modest reward | Referral link, delayed reward after an attended visit, no sight of who the friend is | 2 |

## 04 Capability map and phases
Status column is the label of the capability in this revision. IDs are the proposed requirement IDs (`GRW-P1-x` are the work packages of KX-33).

| # | Capability | Phase | Today | Work package | Priority |
|---|---|---|---|---|---|
| C1 | Provider links (org, clinic, branch, doctor, desk) with counters | 1 | Partial: slug and `/b/:slug` page As-built; links absent | GRW-P1-D0, D1 | Must |
| C2 | QR codes and print kit (A4/A5, AR/EN) | 1 | Absent | GRW-P1-D1 | Must |
| C3 | Attribution engine v1 (touch, decision, evidence, replay) | 1 | Absent; booking source stamp As-built | GRW-P1-B0, B, C | Must |
| C4 | Commission integration (origin, decision record, dispute reason) | 1 | Charge engine As-built; origin and decision absent | GRW-P1-D0, D2 | Must |
| C5 | First-party acquisition events and analytics overview | 1 | Anonymous events As-built (13 names); canonical funnel absent | GRW-P1-J | Must |
| C6 | SEO-ready public pages (SSR, sitemap, robots, hreflang, JSON-LD, slugs with history) | 1 | Absent; SPA only | GRW-P1-E, F | Must |
| C7 | Booking widgets and JS SDK on a dedicated origin | 1 | Absent | GRW-P1-G | Should |
| C8 | Deep links and market bootstrap | 1 | Partial (staff app templates only) | GRW-P1-H | Should |
| C9 | Consent management and preference centre | 1 | Partial | GRW-P1-I | Must |
| C10 | Super Admin versioned growth configuration | 1 | Partial (flags, policy) | GRW-P1-K | Must |
| C11 | Staff app Growth tab (share link, counts) | 1 | Absent | GRW-P1-L | Could |
| C12 | Campaign engine, UTM builder, budgets | 2 | Absent | GRW-P2-1 | Should |
| C13 | Patient referral and reward ledger | 2 | Absent; blocked on counsel | GRW-P2-2, 3 | Should |
| C14 | Provider Growth workspace v2 (analytics, cap and pause) | 2 | Absent | GRW-P2-4 | Should |
| C15 | WhatsApp booking assistant (tool-based) | 2 | Deterministic machine As-built; assistant absent | GRW-P2-5 | Should |
| C16 | Lifecycle messaging with frequency caps | 2 | Transactional only | GRW-P2-6 | Should |
| C17 | CAC, ROAS, MER, cohorts; store and Search Console adapters | 2 | Absent | GRW-P2-7, 8 | Should |
| C18 | Experiments, fraud scoring, paid-platform adapters, SEO automation | 3 | Absent | GRW-P3-* | Could |
| C19 | Pharmacy, lab and nurse acquisition pages; corporate programmes; loyalty | 4 | Absent | GRW-P4-* | Could |

## 05 Functional requirements
Requirement text uses SHALL for Phase 1 Must items. Each item is Proposed unless stated.

### 5.1 Provider links and QR (C1, C2)
- GR-101 The clinic SHALL let an owner or admin create a link scoped to organisation, clinic, branch, doctor or desk, with a label and a channel kind (web link, QR poster, desk QR, social, SMS, WhatsApp share, email signature, Google profile).
- GR-102 A link code SHALL be 8 characters of Crockford base32 without I, L, O, U; unknown codes are ignored; revoked links stop issuing booking tokens.
- GR-103 The public booking page SHALL accept a link code, count the visit without cookies and return a signed short-lived booking token `lt` (30 minutes) bound to organisation and link.
- GR-104 The clinic SHALL generate QR codes server-side as SVG (error correction M, four-module quiet zone) with no third-party QR service, and a printable A4/A5 poster in Arabic and English.
- GR-105 Counters SHALL show visits, bookings and attended visits per link for the last 30 days and never contain patient data.
- GR-106 Links SHALL work for a standalone organisation with no Kiorex connection.
- GR-107 The UI SHALL state plainly: bookings through your links never carry a Kiorex fee.
- GR-108 `kiorly.link` SHALL only resolve a slug or code to an entity and redirect to a host in the domain table; it never redirects to a caller-supplied URL.

### 5.2 Attribution and commission (C3, C4)
- GR-201 Kiorex SHALL record first-party touchpoints (landing kind, normalised UTM, referrer host, click-id hash, provider link, locale, dwell) as append-only rows.
- GR-202 For every booking Kiorex SHALL compute exactly one attribution decision per policy version using a pure function, and persist origin (`PROVIDER_LED`, `MARKETPLACE`, `UNATTRIBUTED`), reason code, policy version, inputs hash and evidence ids before calling the clinic.
- GR-203 Kiorex SHALL send the decision in an optional `acquisition` block on the existing signed booking call (contracts 1.10.0). A missing block behaves exactly as today.
- GR-204 The clinic SHALL store origin, decision reference and policy version on the appointment and write an append-only commission decision row for both charge and no-charge outcomes.
- GR-205 A booking with origin `PROVIDER_LED` SHALL never create a commission charge.
- GR-206 A provider SHALL be able to dispute a charge with reason `PROVIDER_LED_EVIDENCE`; evidence-backed disputes are auto-approved and emit `CommissionAdjusted`.
- GR-207 Ops and the provider SHALL be able to read the evidence for a booking: counts, times and reason code, never patient identity.
- GR-208 Policy (windows, precedence, offline evidence) SHALL be versioned, effective dated and maker-checker approved; money-affecting changes take effect no sooner than 7 days after approval.

### 5.3 SEO and public pages (C6)
- GR-301 Public routes SHALL be server rendered with correct status codes (200, 301, 404, 410), canonical, hreflang (`ar`, `en`, `x-default`), JSON-LD and a sitemap; private routes SHALL send `noindex`.
- GR-302 URLs SHALL follow `https://kiorex.com/{locale}/{cc}/{type}/{slug}` with ASCII slugs identical in Arabic and English, slug history and 301 from legacy `/doctors/:id`.
- GR-303 A generated page SHALL be indexable only if it passes the thin-page guard (minimum live providers, minimum data-derived blocks, maximum sibling similarity).
- GR-304 Structured data SHALL be generated from the same data as the visible page and never include home addresses, doctor phone numbers without opt-in, or patient names.
- GR-305 A flag SHALL return the existing SPA shell if server rendering misbehaves, without taking booking down.

### 5.4 Widgets and deep links (C7, C8)
- GR-401 A clinic SHALL be able to embed booking on its own site with a script tag or iframe served from a dedicated origin, with an exact-origin allowlist (HTTPS only, no wildcards, at most 10).
- GR-402 The widget SHALL book through the same hold and idempotent confirm flow as the app; it cannot create an appointment itself.
- GR-403 A widget booking SHALL carry `lt` and be `PROVIDER_LED`.
- GR-404 The patient app SHALL open doctor and clinic URLs through Universal and App Links; no URL-valued parameter is ever followed; Android deferred deep link uses the Play Install Referrer; iOS uses a claim code.
- GR-405 App start SHALL call a bootstrap endpoint; with one live market no selector is shown.

### 5.5 Consent, communications and analytics (C5, C9)
- GR-501 Analytics and attribution cookies SHALL be created only after consent. Without consent only the in-session `lt` token and the booking channel are used.
- GR-502 Consent purposes SHALL include analytics measurement and marketing per channel; wording is versioned; withdrawal reaches the send gate within 60 seconds.
- GR-503 A preference centre SHALL exist in web and app; STOP and إلغاء on WhatsApp and SMS write a suppression record.
- GR-504 Canonical funnel events SHALL be recorded with minimal properties; specialty and provider never join the visitor stream; reports use k-anonymity with k at least 10.
- GR-505 Retention and erasure jobs SHALL purge expired rows and honour `subject.deleted`.

### 5.6 Super Admin (C10)
- GR-601 A Growth group in the ops console SHALL provide overview, attribution and commission evidence, links and widgets monitoring, SEO and landing pages, consent and communications, and configuration versions.
- GR-602 Configuration kinds SHALL be validated against JSON Schemas shared through contracts; secrets are references only.

### 5.7 Phase 2 to 4 (Roadmap)
- Campaign lifecycle (draft, scheduled, active, paused, completed) with budget caps and threshold events; UTM builder.
- Patient referral link; reward after the referee's attended visit and refund window; closed-loop discount credit or coupon; fraud review queue.
- WhatsApp assistant with a closed tool registry, confirmation button and cost caps.
- Lifecycle journeys limited to non-clinical segments.
- Experiments with guardrails (never on safety flows, fees or consent wording); Google, Meta and TikTok adapters with anonymised conversions only.
- Pharmacy, lab and nurse pages and links; corporate and insurer programmes (month 15 and later); loyalty if rewards clear legal review.

## 06 Non-functional requirements
| ID | Requirement | Target | Label |
|---|---|---|---|
| N1 | Public page availability | 99.9 percent monthly | Proposed (ASSUMPTION) |
| N2 | Public HTML TTFB, edge hit and origin miss | p95 at most 150 ms and 800 ms | Proposed |
| N3 | Core Web Vitals, field mobile p75 | LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1 | Proposed |
| N4 | Attribution decision latency | p99 at most 150 ms | Proposed |
| N5 | Decision determinism | 100 percent replay equality | Proposed |
| N6 | Consent propagation | 60 seconds | Proposed |
| N7 | No PHI in any growth payload | Enforced by unit tests | Proposed |
| N8 | Accessibility | WCAG 2.2 AA on public pages and consent UI | Proposed |
| N9 | Localisation | Arabic and English, RTL verified, one slug for both | Proposed |
| N10 | Multi-market | Zero market-specific branches in code | Proposed |

## 07 Acceptance criteria
### Phase 1 exit (all must hold)
- [ ] A standalone organisation creates a link, prints a QR poster in Arabic and English and sees visit counts (GRW-P1-D1).
- [ ] A patient who opens the link and books through the widget produces decision `PROVIDER_LED` and no commission charge, with a decision row explaining why (GRW-P1-C, D2, G).
- [ ] A patient who books from search and is an attended new patient produces a charge of the current rate and decision `MARKETPLACE`.
- [ ] A patient with prior history is not charged (existing rule unchanged).
- [ ] With the `acquisition` block absent, every existing clinic test passes unchanged.
- [ ] View-source of a doctor page shows title, description, H1, JSON-LD and content without JavaScript; every private route sends `noindex`.
- [ ] A widget from a non-allowlisted origin cannot render.
- [ ] No visitor key exists before consent; withdrawal stops visitor-linked processing.
- [ ] Two admins can draft, approve and activate an attribution window change; an older decision still cites the old version.
- [ ] All seven end-to-end scenarios of GRW-P1-M pass on the local stack.
- [ ] Documentation, contracts 1.10.0 changelog and flag catalogue updated; no secret or build output committed.

### Gates before production (Regulatory dependency)
Counsel opinion on PDPL consent and marketing licensing; approved consent wording; provider-terms update for attribution and evidence; hosts and DNS; store team IDs; Search Console ownership (KX-33 section 06).

## 08 KPIs
| KPI | Definition | Target (hypothesis) | Owner |
|---|---|---|---|
| Provider-led share | Provider-led attended new patients over all attended new patients | At least 30 percent by month 9, kill test below | Product |
| Providers with an active link | Listed providers with at least one link or QR with a booking in 30 days | 80 percent of listed | Provider success |
| Indexed pages passing the guard | Count in sitemap and Search Console | 600 at month 6, 3,000 at month 12 | SEO lead |
| Organic share of attended new patients | Organic search and maps touches | At least 10 percent by month 12 | SEO lead |
| Decision determinism | Replay equality | 100 percent | Engineering |
| Dispute rate attributable to attribution | Disputes with attribution reason over charges | Below 3 percent | Finance ops |
| Consent send correctness | Sends without valid consent | 0 | DPO |
| Blended patient CAC | Patient acquisition spend over attended new patients | Below one fee (EGP 40) times payback tolerance; measured from month 6 | Marketing |
| MER | Kiorex revenue over total marketing spend | Tracked; see KX-13 guardrails | Finance |

## 09 Risks and mitigations
| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| GR1 | Providers route every patient through links, so marketplace revenue shrinks | Medium | High | Show incremental value; track provider-led share; KX-13 carries p explicitly |
| GR2 | PDPL consent or marketing licence reading is wrong | Medium | High | Counsel gate; flags launch-locked; mock mode |
| GR3 | Thin or duplicate pages harm the domain | Medium | High | Thin-page guard; verified reviews only; no UGC pages |
| GR4 | Vezeeta dominates head terms | High | Medium | Long-tail specialty and district pages where Kiorex has live slots |
| GR5 | Forged tokens or provider gaming | Low | High | Signed tokens, dwell minimum, anomaly rules, audit sampling |
| GR6 | Widget clickjacking, SDK supply chain | Low | High | Exact-origin CSP, SRI, no third-party scripts |
| GR7 | Reward farming | Medium | Medium | Attended-visit rewards, OTP, velocity caps, review queue (Phase 2) |
| GR8 | WhatsApp quality rating or cost surprises | Medium | Medium | Consent, caps, template review; model cost with the current Meta rate card |
| GR9 | Schedule: 84 engineer-days with a shared-file bottleneck | Medium | Medium | Wave plan and single owners for shared files (KX-33) |
| GR10 | KX-14 targets are not reconcilable with bottom-up | High | Medium | Re-base series in KX-13; split new, returning, provider-led |

## 10 Dependencies
| Dependency | Needed by | Owner | Label |
|---|---|---|---|
| Contracts 1.10.0 (additive) | Every Phase 1 package | Contracts owner | Proposed |
| `kiorex.com` patient host and `kiorly.link` DNS and hosting (NH-008) | SEO, links | Founder | Open decision |
| Widget host name (`book.kiorex.com` proposed) | Widgets | Founder | Open decision |
| Apple Team ID, Play signing SHA-256, store accounts | Deep links in production | Founder | Regulatory dependency (store) |
| District list in Egypt market pack (NH-040, FD-14) | District pages, bootstrap | Ops | Open decision |
| Counsel and DPO outputs | Consent, marketing, rewards | Counsel, DPO | Regulatory dependency |
| Real providers in the pre-launch pass (FD-04) | Any real send | CEO, ops | Open decision |

## 11 Priorities
Must: C1 to C6, C9, C10. Should: C7, C8, Phase 2 items. Could: C11, Phase 3 and 4. Won't (this programme): fee changes, tax reporting, remarketing, stored-value wallets, patient-list ad audiences.

## 12 Open decisions and regulatory dependencies
| # | Item | Default until decided | Label |
|---|---|---|---|
| 1 | Sign ADR-041 to ADR-047 | All Proposed | Open decision |
| 2 | Attribution precedence `PROVIDER_FIRST`; windows 30 days provider, 30 days referral, 7 days campaign | As proposed | Open decision |
| 3 | EGP 40 for provider-led-then-marketplace cases | No charge | Open decision |
| 4 | Whether `kiorly.link` serves the page or redirects | Redirect to the clinic web `/b/<slug>` | Open decision |
| 5 | SSR role as a separate App Runner service from day one | One service, flag-controlled | Open decision |
| 6 | Interpretation of the 50/25/15/10 hypothesis | Flagged open, see KX-29 | Open decision |
| 7 | PDPL consent, cookies, marketing licence, retention | Consent-gated; marketing launch-locked OFF | Regulatory dependency |
| 8 | Reward credits legal assessment | Rewards not built; coupon fallback | Regulatory dependency |
| 9 | Provider content licence for public pages | Terms update needed | Regulatory dependency |
| 10 | Review markup eligibility (Google review-snippet rules) | No `aggregateRating` until verified | Regulatory dependency |
| 11 | ADR-039 status (not found in repo; Drive title search found nothing) | ADR-041 used | Open decision |

## 13 Cross-references
KX-28 (design), KX-29 (go-to-market), KX-30 (attribution and money), KX-31 (SEO and ASO), KX-32 (analytics definitions), KX-33 (roadmap and hand-off); KX-01 ADR-041 to ADR-047; KX-03 KXMBK10 (widget); KX-05 (clinic); KX-09 (contracts 1.10.0); KX-12 BR12 and the new patient-referral rule; KX-13 (inputs); KX-14 (go-to-market); KX-15 (compliance); KX-24 (notification purposes). Source reports: `_docs/growth/GROWTH_DISCOVERY.md`, `GROWTH_ARCHITECTURE_DECISIONS.md`, `GROWTH_COMPETITIVE_RESEARCH.md`, `GROWTH_PHASE1_WORK_PACKAGES.md`.
