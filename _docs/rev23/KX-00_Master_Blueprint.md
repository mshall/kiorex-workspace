# KX00 — Master Blueprint & Reading Guide
Source: 1PCtr6eLZsin2wRXCw6MiC0YikOBrvSFV
Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (first issued 20 November 2026; supersedes the 20 Nov 2026 text of this volume)

> Cleaned from Drive text extraction; symbols dropped by extractor (≥ ≤ × → bullets) restored where obvious; headers/footers removed. Owner role: CEO. Supersedes: KX00 Rev 2.2 (19 Nov 2026). Audience: Founders, investors, engineering & operations leads.

Subtitle: One ecosystem, two brands, five products — how Kiorex and Kiorly decouple, make money, launch in Egypt and scale, and where every detail lives.

## WHAT CHANGED IN REV 2.3
Kiorly suite adds Kiorly Nurse (an edition of Kiorly Clinic, ADR-031; providers now include physiotherapists and nurses, ADR-029). Home visits by doctors, physiotherapists and nurses become part of the ecosystem (ADR-030); new principle P12. Document map adds KX-23 Kiorly Nurse PRD (24 volumes).

## Key numbers (verified 23 Nov 2026)
- Reference set: **27 volumes** (KX-00 to KX-26); decision log ADR-001 to ADR-036 (31 Accepted, 5 Proposed, see KX-01).
- Code: **7 repositories** plus the workspace (contracts, platform, account, clinic, pharmacy, lab, kiorly). Commits since 19 Nov 2026 (git log of the local clones): contracts 23, platform 112, account 48, clinics-management 322 (branch kiorex, includes merges from main), pharmacy 60, lab 69, kiorly 19, workspace 34.
- Contracts `@kiorex/contracts` **1.7.0**; notification layer tests 60, 100 % coverage of `src/notify`.
- Provider adapters: **8 kinds** (SMS, Email, WhatsApp, Payment, Push, Storage, Consent, AI), mock by default, real by configuration; **0** real vendors contacted.
- Demo data: **36** medical specialties, **2** LIVE doctors each (72), **12** demo patients, 108 demo bookings, home visits and nurse tenants.
- Tests: end-to-end suites 16/17/18 (staff app routes versus web) **47 + 30 + 34 = 111**, all passing on the 23 Nov re-run; Expo web per-role specs clinic 6, pharmacy 19, lab 20; patient app Jest **157** (re-run 23 Nov, all pass); staff app Jest **167** (re-run 23 Nov, all pass; two upgrade-request tests used a fixed date that aged out of the request window and now use a relative one).
- Not verified: real push delivery (APNs, FCM), a release build, the patient app on a device, any real vendor, any AWS deployment.

## Contents
01 Executive summary · 02 The ecosystem at a glance · 03 Brand, domains and store accounts · 04 Operating principles · 05 Business model in one page · 06 Where we are and the critical path · 07 Lean governance and decision rights · 08 Document map · 09 How to use this set with Cursor and the team · 10 Glossary

## 01 Executive summary
Kiorex v2 turns a single 'all-in-one' healthcare super-app plan into a decoupled ecosystem: independent provider software that earns subscriptions, and a patient marketplace that earns on completed care — connected by contracts, not by a shared database.

Tiles: BRANDS 2 (Kiorex (patients) · Kiorly (providers)); PRODUCTS 5 (Marketplace · Clinic · Nurse · Pharmacy · Lab); KIORLY BUILD STEPS 108 (Clinic platform build sequence, Stages A–F); TO START EGP 0 (Lite tier · founding 180-day trial).

**Where we are.** Kiorly Clinic — the clinic management platform — is build-ready. The repository mshall/clinics-management already ships plans and entitlements, the trial engine, the 'pay the higher of subscription or commission, never both' settlement engine, the Kiorex marketplace connector (HMAC API, slot engine, holds, idempotent bookings, transactional outbox), Kiorly Pay rails (Paymob, Fawry, InstaPay, bank), clinical SOAP/Rx safety, WhatsApp messaging, and the Egypt market pack. Twenty-three items still need a human (Meta templates, pen-test, restore drill, Kiorex CI wiring, domains) — see KX17.

**What changes in v2.**
1. Kiorex stops trying to be the clinic system; it becomes the patient-side marketplace and orchestrator.
2. Provider software becomes the Kiorly suite — Kiorly Clinic, Kiorly Nurse, Kiorly Pharmacy, Kiorly Lab — each sellable on its own, each working when Kiorex is down.
3. One login (Kiorex Account) across everything, but no shared medical records.
4. Everything that is built ships enabled by default and can be switched off from the Kiorex super admin — globally, per country or per organization.
5. Monetization runs on two engines that reinforce each other: SaaS subscriptions and per-completed-care commissions, reconciled monthly so a provider never pays both.
6. Care happens in the clinic or at home: doctors, physiotherapists and nurses can all take home visits, with safety controls that are never switchable.

**What we ask of the reader.** Treat this set as the single reference. Where it disagrees with the 2025 PRD/BRD, the 2025 roadmap or the Kiorex v2 draft volumes of 19 Nov 2026, this set wins. Where it disagrees with the Kiorly repository, the repository wins for what is already built and this set wins for what is planned.

> **Note** Current status, 23 Nov 2026. All five backends, the patient app and the staff app run locally against mock providers and seeded demo data; nothing is deployed, no real vendor has been contacted and no launch gate is recorded by code. The staff mobile app is now one app, "Kiorly" (final name, ADR-037), covering Clinic, Nurse, Pharmacy and Lab sign-in entries (ADR-033, Proposed). Every outbound provider (SMS, email, WhatsApp, payments, push, storage, consent, AI) is ready for real URLs and credentials, and a shared notification layer (contracts 1.7.0) sits above the channel adapters (KX24). What remains is human: credentials, template approvals, PSP onboarding, push keys, store accounts, counsel and clinical sign-offs.

**DECISION** Strategic thesis: win the provider's daily workflow first (Kiorly Clinic, free to start), then route patient demand to those providers through Kiorex, and charge only when a new patient actually attends. Each new vertical (nursing, pharmacy, lab) repeats the pattern: software first, marketplace second.

## 02 The ecosystem at a glance
Figure 1: patient marketplace on top, independent provider SaaS below, shared packages and contracts underneath.
- Patients & families → Kiorex Marketplace (Kiorex app / web: discovery · booking (clinic or home) · Kiorex Pay · reviews · vault)
- Kiorex Account: OIDC identity (Passport)
- Marketplace → Kiorly: slots · holds · bookings · home visits | orders | test bookings; HMAC API + outbox webhooks
- KIORLY SUITE — provider software, sold independently: Kiorly Clinic (appointments · encounters · Rx · billing · home visits); Kiorly Nurse (edition of Clinic · care plans · MAR · dispatch); Kiorly Pharmacy (dispensing · inventory · POS); Kiorly Lab (accession · QC · result release)
- Shared commerce kernel, field-visit package & contracts — plans · entitlements · settlement · market packs · OpenAPI/events

| Product | Brand | Primary user | System of record for | Never owns |
|---|---|---|---|---|
| Kiorex Marketplace | Kiorex | Patients, caregivers | Search, booking intent, attribution, Kiorex Pay ledger, reviews, patient vault, patient address book | Appointments, encounters, stock, results |
| Kiorly Clinic | Kiorly | Doctors, dentists, physiotherapists, front desk, clinic owners | Appointments (in clinic and home), encounters, Rx, clinic billing, commission charges | Patient marketplace orders |
| Kiorly Nurse | Kiorly | Solo nurses, nursing agencies | Home visits, care plans, nursing records, medication administration (same database as Kiorly Clinic) | Prescriptions |
| Kiorly Pharmacy | Kiorly | Pharmacists, pharmacy owners | Catalogue, lots, dispensing, POS, stock | Prescriptions' clinical authorship |
| Kiorly Lab | Kiorly | Lab managers, technicians, phlebotomists | Orders, specimens, QC, released results | Clinical interpretation outside lab scope |
| Kiorex Account | Kiorex | Everyone | Login subject, credentials, sessions, memberships | Any medical data, professions or roles that grant chart access |

## 03 Brand, domains and store accounts
Naming and distribution decisions taken on 19 Nov 2026 and extended on 20 Nov 2026 (detail in KX19).

**Kiorex — patients**: the company, the patient marketplace and the patient app. Domain kiorex.com (AR/EN paths). Sign-in for all products: account.kiorex.com. Patients see care types (Doctors · Physiotherapy · Home nursing), never Kiorly product names.

**Kiorly by Kiorex — providers**: software suite Kiorly Clinic, Kiorly Nurse, Kiorly Pharmacy, Kiorly Lab. Marketing: kiorly.com/clinic · /nurse · /pharmacy · /lab. Apps: app.kiorly.com and nurse.kiorly.com; booking links kiorly.link.

**Store accounts**: One Apple Developer organization account and one Google Play organization account, held by the IP-holding legal entity. Apps by audience: Kiorex (patients), Kiorly (doctors, physiotherapists, nurses and clinic staff — the app shows the Kiorly Nurse edition when the active organization is a Nurse tenant); field apps only when a mobile workflow exists.

**RULE** Singular product names: Kiorly Nurse, Kiorly Lab, Kiorly Pharmacy. 'Labs' reads as an R&D division; 'Pharmacies' or 'Nurses' implies we operate them — regulated activities we do not perform.

## 04 Operating principles
Twelve rules.

| # | Principle | What it means in practice |
|---|---|---|
| P1 | Provider software must work without Kiorex | No Kiorly critical workflow calls Kiorex synchronously. Kiorex outage → marketplace degrades; clinics and nurses keep working. |
| P2 | One owner per fact | Appointment and home visit live in Kiorly; order intent and attribution live in Kiorex; results live in Kiorly Lab. Everything else is a projection with provenance. |
| P3 | Contracts before code | OpenAPI + event schemas versioned and pinned in both producer and consumer CI (NH019 wires Kiorex). |
| P4 | Pay the higher of, never both | Subscription vs Kiorex commission settled monthly; a busy provider's Kiorly becomes free (CR06). |
| P5 | Safety is never paywalled | Rx safety, audit, consent, records export, lab QC and home-visit safety are in every tier, including Lite and read-only. |
| P6 | Configuration, not forks | New country = new market pack (currency, tax, payment methods, data cell, templates, scope of practice), not a code branch. |
| P7 | Charge only on delivered value | Commission only for attended new patients from Kiorex channels; clinic's own booking link is commission-free; care-plan follow-up visits are never charged. |
| P8 | Honest AI | AI outputs labelled, human-signed, quota-gated by plan; no PHI in prompts without redaction and consent. |
| P9 | Records are the provider's | Dunning never blocks clinical read/export; offboarding export always available (SC05). |
| P10 | Evidence over assertion | Every number labelled Observed / Validated / Estimated / Proposed; decisions logged in KX01. |
| P11 | Ship ON, switch off centrally | Every built capability is live by default; the Kiorex super admin can turn it off globally, per country or per organization without a deploy (ADR-023). Launch-locked items wait for their gate; safety controls are never switchable. |
| P12 | Licensed people, in scope, safe at the door | Every listed provider is verified for their profession; software enforces scope of practice; home visits always carry the safety timer, SOS and address masking (ADR-029/030). |

## 05 Business model in one page
Dual engine. Figure 2 lifecycle: Sign up free → Activate (Lite or 180-day trial; 20 visits in 30 days) → List on Kiorex (verified, ≥80% profile) → Patients attend (EGP 40 per new patient) → Settle monthly max(subscription, commission) → Expand (seats · home · Nurse · Pharmacy · Lab).

| Engine | Unit | Egypt list price (validate in pilot) | Where defined |
|---|---|---|---|
| Kiorly Clinic — Pro | per clinician / month | EGP 1,299 monthly · EGP 999 billed annually | PL01 plan catalog |
| Kiorly Clinic — Clinic | per organization / month | EGP 3,499 incl. 5 clinicians · EGP 699 per extra | PL01 |
| Kiorly Clinic — Lite | commission only | EGP 0 subscription · Kiorex fees, EGP 100 minimum invoice | SB05 |
| Kiorly Nurse — Pro / Agency (Proposed) | per nurse / per agency | EGP 399 (299 annual) / EGP 1,999 incl. 10 nurses | KX23, KX12 |
| Kiorex commission (all professions) | attended new patient | EGP 40 flat placeholder; warning if >50% of lowest competitor | CR04 |
| Kiorly Pharmacy / Lab | per location / month | EGP 1,000 / EGP 1,800 base (test points) | KX12 |
| Marketplace (pharmacy / lab) | % of fulfilled order | 4% pharmacy · 8% lab test bookings (test points) | KX12 |

Base revenue (tiles, month labels 12/24/36 in order): EGP 0.54M (mostly trials converting) · EGP 4.1M · EGP 16.0M monthly (≈ USD 3.8M ARR). SEED CASH-OUT (BASE) M27; Series A window M15–M20.

**WATCH** All financial figures are model outputs from KX13 (driver-based, planning FX EGP 50 = USD 1). Estimated, not forecasts, until the Egypt pilot produces observed cohorts. Kiorly Nurse and home-visit revenue are not yet in the model (KX13 §03 lists the inputs to add).

## 06 Where we are and the critical path
Status by product on 20 Nov 2026.

| Product | Status | Evidence | Next gate |
|---|---|---|---|
| Kiorly Clinic | Build-ready | Stages A–E shipped on kiorly/launch; Phase 1b steps 101–108 partly shipped | Egypt pilot → public launch (KX17) |
| Kiorex Marketplace | Rebuild consumer side | Kiorly provider API, outbox and OpenAPI exist; 2025 kiorex-backend/web-app are prototypes | Patient MVP consuming Kiorly contract (KX03) |
| Kiorex Account | Decide & integrate | Kiorly has its own auth, MFA, sessions (AUTH_SESSIONS, SC04) | Managed OIDC IdP for patients first (KX04) |
| Professions & home visits | Specified | This set (KX05 §06–08, ADR-029/030) | Physio M7–9; home visits M10–12 after GHV1/2 |
| Kiorly Nurse | Specified | This set (KX23) | Discovery M7–9; pilot M13–15; GA M16–18 |
| Kiorly Pharmacy | Specified | This set (KX06) | Discovery: 15 pharmacy interviews; pilot month 13 |
| Kiorly Lab | Specified | This set (KX07) | Discovery: 15 lab interviews; pilot month 19 |

Figure 3 (critical path, month 1 = January 2027; detail KX18), rows: Kiorly Clinic pilot · GA; Kiorex patient MVP build · beta M4 · public; Kiorex Account (patients) OIDC; Professions + physio pack M7–9; Home visits (doctors, physio) M10–12; Kiorly Nurse disc · build · pilot M13 · GA M16–18 [extraction merges: "M79, M1012, disc · pilot M13 · GA M1618"]; Kiorly Pharmacy disc · build · pilot M13 · GA M16; Kiorly Lab build · pilot M19 · GA M21; Market 2 GCC pack · pilot M25; Series A raise.

### Build status at 23 Nov 2026
| Area | Status | Evidence / what remains |
|---|---|---|
| Kiorly Clinic and Nurse edition | Done | Built and running locally; demo tenants, home visits, care plans, nurse role |
| Kiorly staff app (Clinic, Nurse, Pharmacy, Lab entries) | Done (dev) | Dev builds on iOS simulator and Android emulator; e2e 16/17/18; release build and physical device Open |
| Patient app (Expo) | Done (dev) | Services, family visit status, push-tap routing, sign-out; Jest and tsc only, device check Open |
| Provider adapters (mock and real, all backends) | Done | Tested against a local fake server only |
| Notification layer (`@kiorex/contracts/notify` 1.7.0) | Done in platform; Planned in Passport, Lab, Pharmacy, Clinic | KX-24 §11 |
| Communications control plane (runtime templates and routing) | Planned (Proposed) | KX-24 §10 |
| Document storage growth: lifecycle, quotas, compression, retention | Planned (Proposed, ADR-036) | KX-25 |
| System architecture reference (all diagrams in one volume) | Done | KX-26 |
| Real vendor URLs and credentials (SMS, email, WhatsApp, PSP, consent, AI, storage) | Blocked | Human: contracts, templates, sender ids, PSP onboarding |
| Real push delivery (APNs, FCM, EAS project id) | Blocked | Human: keys and accounts; never observed |
| Store submissions (Apple, Google) | Blocked | Store accounts (KX-19); ADR-033 still Proposed |
| AWS deployment and secret injection | Blocked | Founder instruction: no deploy; Passport Lambda secrets route missing |

## 07 Lean governance and decision rights
| Decision class | Decides | Consulted | Evidence required |
|---|---|---|---|
| Strategy, capital, pricing | Mohamed El Shall (CEO / acting CTO) | Prof. Dr. Ahmed El Shall (CMO), finance advisor | KX12/13 update, pilot data |
| Clinical safety, templates, AI clinical use, scope of practice, home-visit safety | Prof. Dr. Ahmed El Shall (CMO) | Specialty advisory board (NH010) incl. physiotherapist reviewer and nursing advisor | Hazard log entry, sign-off record |
| Architecture, data boundaries | CEO / acting CTO | Lead engineers per repo | ADR in KX01 |
| Privacy, security, residency | CEO + external counsel | Security lead | Threat model, ROPA, counsel memo |
| New country | CEO | Local counsel, CMO | Market pack checklist (MARKET_GO_LIVE_TEMPLATE) |
| Release to production | Repo owner | QA lead | Green CI, golden flow, runbook |

**NOTE** When headcount passes 40 (KX18), split the CEO's architecture and security rights to a hired CTO and security lead; until then, three founders' signatures replace five councils.

## 08 Document map
25 volumes (KX00 to KX24) in ten folders mirroring the Kiorex Drive structure. KX24 Notifications & Messaging Architecture was added on 23 Nov 2026; KX23 Kiorly Nurse PRD was added in Rev 2.3.

| ID | Folder | Document | Written as |
|---|---|---|---|
| KX00 | 00 Executive & Governance | Master Blueprint & Reading Guide | CEO |
| KX01 | 00 Executive & Governance | Decision Log & Architecture Decision Records | Chief Software Architect |
| KX02 | 01 BRDs | Ecosystem Business Requirements BRD | Chief Business Analyst |
| KX03 | 02 PRD | Kiorex Marketplace PRD | Chief Product Officer |
| KX04 | 02 PRD | Kiorex Account — Identity & Organizations PRD | Principal Identity Architect |
| KX05 | 02 PRD | Kiorly Clinic PRD (as built) | VP Product, Kiorly |
| KX06 | 02 PRD | Kiorly Pharmacy PRD | Head of Pharmacy Product |
| KX07 | 02 PRD | Kiorly Lab PRD | Head of Diagnostics Product |
| KX23 | 02 PRD | Kiorly Nurse PRD (edition of Kiorly Clinic) | Head of Home Care Product |
| KX08 | 03 Technical Documents | Target Architecture & Repository Design | Chief Software Architect |
| KX09 | 03 | Integration Contracts, Events & Money Flows | Principal Integration Architect |
| KX10 | 03 | Platform, DevOps & Security Engineering | CISO |
| KX21 | 03 | AWS Cloud Hosting & Infrastructure Reference | Principal Cloud Architect |
| KX22 | 03 | GitHub Repository Map & Build-Agent Handoff | Chief Software Architect |
| KX24 | 03 | Notifications & Messaging Architecture (shared notification layer, provider adapters) | Chief Software Architect |
| KX11 | 03 / AI docs | AI Strategy, Architecture & Governance | Chief AI Officer |
| KX12 | 04 Financial Model & GTM | Monetization & Pricing Architecture | CRO |
| KX13 | 04 | 36-Month Financial Model & Unit Economics | CFO |
| KX14 | 04 | Go-to-Market & Marketing Plan | CMO |
| KX15 | 05 Risk & Compliance | Risk & Compliance Framework | Chief Risk & Compliance Officer |
| KX16 | 05 | Clinical Safety & Quality Framework | CMO |
| KX17 | 06 Kiorly | Kiorly Clinic Launch Readiness & Go-Live Plan | Launch Director / VP Engineering |
| KX18 | 07 Roadmap & Delivery | 36-Month Roadmap & Operating Model | COO |
| KX19 | 08 Brand, Domains & Accounts | Brand Architecture, Domains & Store Accounts | Chief Brand Officer |
| KX20 | 09 Pitch Deck | Investor Brief | CEO & CFO |

Reading paths: Messaging and providers (1 h) KX24 · KX09 · KX10 §08 · _docs/PROVIDER_GO_LIVE.md. Staff and patient mobile apps (1 h) KX01 ADR033 · KX05 §13 · KX23 · _docs/mobile/. Investor (30 min) KX20 · KX13 · KX14 · KX15. Engineer joining (2 h) KX08 · KX21 · KX09 · KX10 · KX05. Clinical/compliance (1 h) KX16 · KX15 · KX11 · KX17 go-live gates · KX23 nursing scope. Commercial team (1 h) KX12 · KX14 · KX19 · KX05 and KX23 capabilities. Build agent: KX22 · KX01 · KX08 · KX09 · KX21 · Product PRD for the repo.

## 09 How to use this set with Cursor and the team
- Cursor sessions: attach the relevant PRD (KX03…07, KX23) plus KX08/KX09. Kiorly work continues to follow Docs/kiorly-cursor-build-sequence.md in the repo; new repos get their own build sequence derived from these PRDs.
- Requirement IDs: each PRD uses stable IDs (e.g. KXM-BK-04, KP-INV-03, HV-SAF-01, KN-MAR-01). Tickets, commits and tests reference them.
- Status tags: Observed, Validated, Estimated, Proposed.
- Change control: a change that alters a decision in KX01 needs a new ADR row; anything else is a normal revision. Revision 2.3 (20 Nov 2026) added ADR-029…032 and revised the affected volumes.
- Review cadence: monthly for KX12/13/18 during the pilot; quarterly for the rest.

## 10 Glossary
| Term | Meaning |
|---|---|
| Higher-of settlement | Monthly invoice = max(subscription S, confirmed Kiorex commission C); the lower side is shown as an informational offset. |
| Chargeable Kiorex patient | Booked via KIOREX_MARKETPLACE or KIOREX_WHATSAPP, new to the tenant (24-month lookback on phone or national ID), and attended (in clinic or at home). |
| Founding cohort | First 500 paying clinics in Egypt (FOUNDING_EG): 180-day trial with activation rule, 24-month price lock. |
| Market pack | Per-country configuration: currency, timezone, tax, payment methods, data cell, templates, scope-of-practice matrix, commercial config. |
| Data cell | The hosting region a market's tenants live in (e.g. frankfurt, eu-central-1). |
| Outbox | Events written in the same DB transaction as the business change, delivered with HMAC and retries. |
| Kiorex Account | User-facing name of the shared identity service (internally 'Passport'). |
| Edition | A presentation of Kiorly Clinic for one audience (CLINIC or NURSE): own name, navigation, plans and modules over the same code and data. |
| Profession | Licensed discipline of a clinician (physician, dentist, physiotherapist, nurse); drives verification and scope of practice. |
| Home visit | An appointment whose visit type has serviceLocation = HOME; arrival geostamp = check-in. |
| Care plan | Recurring home services (e.g. dressing daily × 14 days) sold as a package; only the first attended visit of a new patient is commissionable. |

## What changed in this revision (23 Nov 2026)
- Reading guide extended with KX24 (notifications and messaging) and the mobile design pack; document count 24 to 25.
- Key numbers and a Done/Open/Planned/Blocked status table added from the repositories as they stand on 23 Nov 2026.
- Decision log now runs to ADR-035: ADR-033 (one staff app, tiered mobile entitlements, Proposed), ADR-034 (notification layer is a package, Accepted), ADR-035 (provider adapter contract, Proposed). Details in KX01.
- Unchanged: strategy, brands, business model, governance. Figures in KX12, KX13 and KX14 are the founder's and were not touched.
- Not verified: anything running on real vendors, real devices or AWS.
