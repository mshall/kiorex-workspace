# KX00 — Master Blueprint & Reading Guide
Source: 1c-byYRoKikv4IRxN4N7aLGNQz_pK-5me

> Note: transcribed from PDF text extraction. Symbols dropped by the extractor (≥, ≤, ×, →, bullets) were restored by inference where obvious; page headers/footers removed.

Subtitle: One ecosystem, two brands, four products: how Kiorex and Kiorly decouple, make money, launch in Egypt and scale — and where every detail lives.

Kiorex v2 · ecosystem reference. Authored in the role of Chief Executive Officer. Accountable for strategy, capital allocation and the integrity of this reference set.

Tags: Ecosystem strategy · Brand & product map · Operating principles · Document index · Glossary

| Field | Value |
|---|---|
| DOCUMENT | KX00 |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Founders, investors, engineering & operations leads |
| OWNER ROLE | Chief Executive Officer |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 Executive summary
02 The ecosystem at a glance
03 Brand, domains and store accounts
04 Operating principles
05 Business model in one page
06 Where we are and the critical path
07 Lean governance and decision rights
08 Document map
09 How to use this set with Cursor and the team
10 Glossary

## 01 Executive summary

Kiorex v2 turns a single 'all-in-one' healthcare super-app plan into a decoupled ecosystem: independent provider software that earns subscriptions, and a patient marketplace that earns on completed care — connected by contracts, not by a shared database.

Headline figures: BRANDS 2 (Kiorex (patients) · Kiorly (providers)); PRODUCTS 4 (Marketplace · Clinic · Pharmacy · Lab). [Extraction rendered as "PRODUCTS 24Kiorex (patients) · Kiorly / Marketplace · Clinic · Pharmacy · Lab", i.e. "2" brands and "4" products.]

**Where we are.** Kiorly Clinic — the clinic management platform — is build-ready. The repository mshall/clinics-management already ships plans and entitlements, the trial engine, the 'pay the higher of subscription or commission, never both' settlement engine, the Kiorex marketplace connector (HMAC API, slot engine, holds, idempotent bookings, transactional outbox), Kiorly Pay rails (Paymob, Fawry, InstaPay, bank), clinical SOAP/Rx safety, WhatsApp messaging, and the Egypt market pack. Twenty-three items still need a human (Meta templates, pen-test, restore drill, Kiorex CI wiring, domains) — see KX17.

**What changes in v2.**
1. Kiorex stops trying to be the clinic system; it becomes the patient-side marketplace and orchestrator.
2. Provider software becomes the Kiorly suite — Kiorly Clinic, Kiorly Pharmacy, Kiorly Lab — each sellable on its own, each working when Kiorex is down.
3. One login (Kiorex Account) across everything, but no shared medical records.
4. Everything that is built ships enabled by default and can be switched off from the Kiorex super admin — globally, per country or per organization.
5. Monetization runs on two engines that reinforce each other: SaaS subscriptions and per-completed-care commissions, reconciled monthly so a provider never pays both.

**What we ask of the reader.** Treat this set as the single reference. Where it disagrees with the 2025 PRD/BRD, the 2025 roadmap or the Kiorex v2 draft volumes of 19 Nov 2026, this set wins. Where it disagrees with the Kiorly repository, the repository wins for what is already built and this set wins for what is planned.

**DECISION** Strategic thesis: win the provider's daily workflow first (Kiorly Clinic, free to start), then route patient demand to those providers through Kiorex, and charge only when a new patient actually attends. Each new vertical (pharmacy, lab) repeats the pattern: software first, marketplace second.

Stat tiles:
- KIORLY BUILD STEPS: 108 — Clinic platform build sequence, Stages A–F
- TO START: EGP 0 — Lite tier · founding 180-day trial

## 02 The ecosystem at a glance

Who uses what, who owns which data, and which contracts connect them.

Figure 1 (diagram, textual rendering): Kiorex v2 ecosystem: patient marketplace on top, independent provider SaaS below, shared kernel and contracts underneath.
- Patients & families → Kiorex Marketplace (Kiorex app / web; discovery · booking · Kiorex Pay · reviews · vault)
- Kiorex Account (OIDC identity, "Passport") — "uses sign-in" by all products
- KIORLY SUITE (provider software, sold independently): Kiorly Clinic (appointments · encounters · Rx · billing); Kiorly Pharmacy (dispensing · inventory · POS); Kiorly Lab (accession · QC · result release)
- Marketplace → Clinic: slots · holds · bookings; → Pharmacy: orders; → Lab: test bookings
- Shared commerce kernel & contracts: plans · entitlements · settlement · market packs · OpenAPI/events

| Product | Brand | Primary user | System of record for | Never owns |
|---|---|---|---|---|
| Kiorex Marketplace | Kiorex | Patients, caregivers | Search, booking intent, attribution, Kiorex Pay ledger, reviews, patient vault | Appointments, encounters, stock, results |
| Kiorly Clinic | Kiorly | Doctors, front desk, clinic owners | Appointments, encounters, Rx, clinic billing, commission charges | Patient marketplace orders |
| Kiorly Pharmacy | Kiorly | Pharmacists, pharmacy owners | Catalogue, lots, dispensing, POS, stock | Prescriptions' clinical authorship |
| Kiorly Lab | Kiorly | Lab managers, technicians, phlebotomists | Orders, specimens, QC, released results | Clinical interpretation outside lab scope |
| Kiorex Account | Kiorex | Everyone | Login subject, credentials, sessions, memberships | Any medical data or roles that grant chart access |

## 03 Brand, domains and store accounts

The naming and distribution decisions taken on 19 Nov 2026 (detail in KX19).

**Kiorex (patients)**
- The company, the patient marketplace and the patient app
- Domain: kiorex.com (AR/EN paths)
- Sign-in for all products: account.kiorex.com

**Kiorly by Kiorex (providers)**
- Provider software suite: Kiorly Clinic, Kiorly Pharmacy, Kiorly Lab
- Marketing: kiorly.com/clinic · /pharmacy · /lab
- Apps: app.kiorly.com; booking links kiorly.link

**Store accounts (distribution)**
- One Apple Developer organization account and one Google Play organization account, held by the IP-holding legal entity
- Apps by audience: Kiorex (patients), Kiorly (doctors & clinic staff); field apps only when a mobile workflow exists

**RULE** Singular product names: Kiorly Lab, Kiorly Pharmacy. 'Labs' reads as an R&D division; 'Pharmacies' implies we operate pharmacies — a regulated activity we do not perform.

## 04 Operating principles

Eleven rules that settle most design arguments before they start.

| # | Principle | What it means in practice |
|---|---|---|
| P1 | Provider software must work without Kiorex | No Kiorly critical workflow calls Kiorex synchronously. Kiorex outage → marketplace degrades; clinics keep working. |
| P2 | One owner per fact | Appointment lives in Kiorly Clinic; order intent and attribution live in Kiorex; results live in Kiorly Lab. Everything else is a projection with provenance. |
| P3 | Contracts before code | OpenAPI + event schemas versioned and pinned in both producer and consumer CI (NH019 wires Kiorex). |
| P4 | Pay the higher of, never both | Subscription vs Kiorex commission settled monthly; a busy clinic's Kiorly becomes free (CR06). |
| P5 | Safety is never paywalled | Rx safety, audit, consent, records export and lab QC are in every tier, including Lite and read-only. |
| P6 | Configuration, not forks | New country = new market pack (currency, tax, payment methods, data cell, templates), not a code branch. |
| P7 | Charge only on delivered value | Commission only for attended new patients from Kiorex channels; clinic's own booking link is commission-free. |
| P8 | Honest AI | AI outputs labelled, human-signed, quota-gated by plan; no PHI in prompts without redaction and consent. |
| P9 | Records are the clinic's | Dunning never blocks clinical read/export; offboarding export always available (SC05). |
| P10 | Evidence over assertion | Every number labelled Observed / Validated / Estimated / Proposed; decisions logged in KX01. |
| P11 | Ship ON, switch off centrally | Every built capability is live by default; the Kiorex super admin can turn it off globally, per country or per organization without a deploy (ADR023). Launch-locked items wait for their gate; safety controls are never switchable. |

## 05 Business model in one page

Dual engine: recurring software revenue plus commission on completed care, reconciled so they never double-charge.

Figure 2: Provider lifecycle and where revenue is recognized.
1. Sign up free
2. Activate — Lite or 180-day founding trial; 20 visits in 30 days
3. List on Kiorex — verified doctor, ≥80% profile
4. Patients attend — EGP 40 per new patient
5. Settle monthly — max(subscription, commission)
6. Expand — seats · branches · Pharmacy · Lab

| Engine | Unit | Egypt list price (validate in pilot) | Where defined |
|---|---|---|---|
| Kiorly Clinic — Pro | per doctor / month | EGP 1,299 monthly · EGP 999 billed annually | PL01 plan catalog |
| Kiorly Clinic — Clinic | per organization / month | EGP 3,499 incl. 5 doctors · EGP 699 per extra | PL01 |
| Kiorly Clinic — Lite | commission only | EGP 0 subscription · Kiorex fees, EGP 100 minimum invoice | SB05 |
| Kiorex commission (clinics) | attended new patient | EGP 40 flat placeholder; warning if >50% of lowest competitor | CR04 |
| Kiorly Pharmacy / Lab | per location / month | EGP 1,000 / EGP 1,800 base | KX12 |
| Marketplace (pharmacy / lab) | % of fulfilled order | 4% pharmacy · 8% lab test bookings | KX12 |

Base revenue per month (three milestone tiles; labels as extracted — "BASE REVENUE — MONTH 12 / 24 / 36"): EGP 0.54M (mostly trials converting) · EGP 4.1M · EGP 16.0M monthly (≈ USD 3.8M ARR at planning FX).
[Extraction: "BASE REVENUE — MONTH 122436EGP 0.54M / EGP 4.1M / EGP 16.0M … USD 3.8M ARR". The month labels read 12, 24, 36; the mapping of each value to its month is inferred in order.]

**WATCH** All financial figures are model outputs from KX13 (driver-based, planning FX EGP 50 = USD 1). They are Estimated, not forecasts, until the Egypt pilot produces observed cohorts.

## 06 Where we are and the critical path

Status by product on 19 Nov 2026 and the sequence that unlocks revenue.

| Product | Status | Evidence | Next gate |
|---|---|---|---|
| Kiorly Clinic | Build-ready | Stages A–E shipped on kiorly/launch; Phase 1b steps 101–108 partly shipped | Egypt pilot → public launch (KX17) |
| Kiorex Marketplace | Rebuild consumer side | Kiorly provider API, outbox and OpenAPI exist; 2025 kiorex-backend/web-app are prototypes | Patient MVP consuming Kiorly contract (KX03) |
| Kiorex Account | Decide & integrate | Kiorly has its own auth, MFA, sessions (AUTH_SESSIONS, SC04) | Managed OIDC IdP for patients first (KX04) |
| Kiorly Pharmacy | Specified | This set (KX06) | Discovery: 15 pharmacy interviews; pilot month 13 |
| Kiorly Lab | Specified | This set (KX07) | Discovery: 15 lab interviews; pilot month 19 |

Side metrics (extracted adjacent to the table): SEED CASH-OUT (BASE) M27; Series A window M15–M20.

Figure 3: 36-month critical path (month 1 = January 2027; detail in KX18). Quarters Q1–Q12:
- Kiorly Clinic: pilot → GA (pilot · GA)
- Kiorex patient MVP: build
- Kiorex public (Egypt): marketplace live
- Kiorex Account (patients): OIDC
- Kiorly Pharmacy: discovery · build · pilot M13 · GA M16
- Kiorly Lab: build · pilot M19 · GA M21
- Market 2: GCC pack · pilot M25
- Series A raise
- Kiorly GA; Kiorex live M24 [as extracted: "Kiorly GAKiorex live M24"]

## 07 Lean governance and decision rights

Named people over committees. Councils exist on paper only when the team is big enough to staff them.

| Decision class | Decides | Consulted | Evidence required |
|---|---|---|---|
| Strategy, capital, pricing | Mohamed El Shall (CEO / acting CTO) | Prof. Dr. Ahmed El Shall (CMO), finance advisor | KX12/13 update, pilot data |
| Clinical safety, templates, AI clinical use | Prof. Dr. Ahmed El Shall (CMO) | Specialty advisory board (NH010) | Hazard log entry, sign-off record |
| Architecture, data boundaries | CEO / acting CTO | Lead engineers per repo | ADR in KX01 |
| Privacy, security, residency | CEO + external counsel | Security lead | Threat model, ROPA, counsel memo |
| New country | CEO | Local counsel, CMO | Market pack checklist (MARKET_GO_LIVE_TEMPLATE) |
| Release to production | Repo owner | QA lead | Green CI, golden flow, runbook |

**NOTE** When headcount passes 40 (KX18), split the CEO's architecture and security rights to a hired CTO and security lead; until then, three founders' signatures replace five councils.

## 08 Document map

23 volumes in ten folders that mirror the main Kiorex Drive structure.

| ID | Folder | Document | Written as |
|---|---|---|---|
| KX00 | 00 — Executive & Governance | Master Blueprint & Reading Guide | Chief Executive Officer |
| KX01 | 00 — Executive & Governance | Decision Log & Architecture Decision Records | Chief Software Architect |
| KX02 | 01 — BRDs | Ecosystem Business Requirements (BRD) | Chief Business Analyst |
| KX03 | 02 — PRD | Kiorex Marketplace PRD | Chief Product Officer |
| KX04 | 02 — PRD | Kiorex Account — Identity & Organizations PRD | Principal Identity Architect |
| KX05 | 02 — PRD | Kiorly Clinic PRD (as built) | VP Product, Kiorly |
| KX06 | 02 — PRD | Kiorly Pharmacy PRD | Head of Pharmacy Product |
| KX07 | 02 — PRD | Kiorly Lab PRD | Head of Diagnostics Product |
| KX08 | 03 — Technical Documents | Target Architecture & Repository Design | Chief Software Architect |
| KX09 | 03 — Technical Documents | Integration Contracts, Events & Money Flows | Principal Integration Architect |
| KX10 | 03 — Technical Documents | Platform, DevOps & Security Engineering | Chief Information Security Officer |
| KX21 | 03 — Technical Documents | AWS Cloud Hosting & Infrastructure Reference | Principal Cloud Architect |
| KX22 | 03 — Technical Documents | GitHub Repository Map & Build-Agent Handoff | Chief Software Architect |
| KX11 | 03 — Technical Documents / AI docs | AI Strategy, Architecture & Governance | Chief AI Officer |
| KX12 | 04 — Financial Model & GTM | Monetization & Pricing Architecture | Chief Revenue Officer |
| KX13 | 04 — Financial Model & GTM | 36-Month Financial Model & Unit Economics | Chief Financial Officer |
| KX14 | 04 — Financial Model & GTM | Go-to-Market & Marketing Plan | Chief Marketing Officer |
| KX15 | 05 — Risk & Compliance | Risk & Compliance Framework | Chief Risk & Compliance Officer |
| KX16 | 05 — Risk & Compliance | Clinical Safety & Quality Framework | Chief Medical Officer |
| KX17 | 06 — Kiorly | Kiorly Clinic Launch Readiness & Go-Live Plan | Launch Director / VP Engineering |
| KX18 | 07 — Roadmap & Delivery | 36-Month Roadmap & Operating Model | Chief Operating Officer |
| KX19 | 08 — Brand, Domains & Accounts | Brand Architecture, Domains & Store Accounts | Chief Brand Officer |
| KX20 | 09 — Pitch Deck | Investor Brief | CEO & CFO |

### Reading paths

- **Investor (30 min):** KX20 Investor Brief · KX13 Financial Model · KX14 GTM · KX15 Risks
- **Engineer joining (2 h):** KX08 Architecture · KX21 AWS hosting · KX09 Contracts & money flows · KX10 Platform & security · KX05 Kiorly Clinic PRD
- **Clinical / compliance (1 h):** KX16 Clinical safety · KX15 Risk & compliance · KX11 AI governance · KX17 go-live gates
- **Commercial team (1 h):** KX12 Pricing · KX14 GTM · KX19 Brand · KX05 capabilities
- **Build agent (start here):** KX22 Repo map & agent brief · KX01 Decisions · KX08 · KX09 · KX21 · Product PRD for the repo

## 09 How to use this set with Cursor and the team

- **Cursor sessions:** attach the relevant PRD (KX03…07) plus KX08/KX09. Kiorly work continues to follow Docs/kiorly-cursor-build-sequence.md in the repo; new repos get their own build sequence derived from these PRDs.
- **Requirement IDs:** each PRD uses stable IDs (e.g. KXM-BK-04, KP-INV-03). Tickets, commits and tests reference them.
- **Status tags:** Observed (measured), Validated (signed contract/test), Estimated (model), Proposed (design). Do not present Estimated numbers as results.
- **Change control:** a change that alters a decision in KX01 needs a new ADR row; anything else is a normal revision of the volume.
- **Review cadence:** monthly for KX12/13/18 during the pilot; quarterly for the rest.

## 10 Glossary

| Term | Meaning |
|---|---|
| Higher-of settlement | Monthly invoice = max(subscription S, confirmed Kiorex commission C); the lower side is shown as an informational offset. |
| Chargeable Kiorex patient | Booked via KIOREX_MARKETPLACE or KIOREX_WHATSAPP, new to the tenant (24-month lookback on phone or national ID), and attended. |
| Founding cohort | First 500 paying clinics in Egypt (FOUNDING_EG): 180-day trial with activation rule, 24-month price lock. |
| Market pack | Per-country configuration: currency, timezone, tax, payment methods, data cell, templates, commercial config. |
| Data cell | The hosting region a market's tenants live in (e.g. frankfurt, eu-central-1). |
| Outbox | Events written in the same DB transaction as the business change, delivered with HMAC and retries. |
| Kiorex Account | User-facing name of the shared identity service (internally 'Passport'). |
