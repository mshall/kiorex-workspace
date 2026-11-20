# KX01 — Decision Log & Architecture Decision Records
Source: 1tQ5iEGdC3nQkK9TULztjRptMjb2KS9P4
Revision: Rev 2.3 · Reference Edition (20 November 2026, Approved reference; supersedes KX01 Rev 2.2, 19 Nov 2026)

> Cleaned from Drive text extraction; symbols restored where obvious; headers/footers removed. Owner: Chief Software Architect. Audience: Founders, engineering leads, Cursor sessions.

Subtitle: The decisions that shape Kiorex v2 — what was decided, why, what it costs, and how to change it. Tags: 32 ADRs · Rationale & consequences · Supersession map · Open questions.

## WHAT CHANGED IN REV 2.3
New ADR-029 (profession model), ADR-030 (service location / home visits), ADR-031 (Kiorly Nurse edition), ADR-032 (individual nurses and agencies) — all Accepted 20 Nov 2026. ADR-002 consequence extended to Kiorly Nurse; ADR-024 launch-locked list extended. Open questions Q7–Q13 added.

## 01 How decisions are recorded
Short, numbered, immutable. Superseding a decision means a new ADR that references the old one. Process: Context (problem + evidence) → Options (2 real alternatives) → Decision (one sentence) → Consequences (cost · risk · rollback) → Status (Proposed → Accepted → Superseded). Accepted decisions are binding for all volumes and code. Proposed are validated in pilot. A volume that contradicts an Accepted ADR is wrong; raise a revision. ADR IDs are referenced in commit messages and Docs/.
Counters: ACCEPTED 30 (binding) · PROPOSED 2 (validate in pilot) · V2-DRAFT ITEMS SUPERSEDED 9 (see §04) · OPEN QUESTIONS 13 (owners named).

## 02 Decision register
| ID | Decision | Status | Area |
|---|---|---|---|
| ADR001 | Kiorex becomes the patient marketplace; provider operations move to the Kiorly suite | Accepted | Strategy |
| ADR002 | Two brands: Kiorex (patients/company) and Kiorly by Kiorex (providers) | Accepted | Brand |
| ADR003 | Kiorly Clinic stays a modular monolith | Accepted | Architecture |
| ADR004 | Share a commerce kernel by package, not by service | Accepted | Architecture |
| ADR005 | Kiorly Clinic is the only system of record for clinic appointments | Accepted | Data |
| ADR006 | Integration via HMAC REST + transactional outbox webhooks | Accepted | Integration |
| ADR007 | Commission = flat fee per attended new Kiorex patient (clinics) | Accepted | Commercial |
| ADR008 | Pay the higher of subscription or commission, never both | Accepted | Commercial |
| ADR009 | Lite tier is commission-only, no subscription | Accepted | Commercial |
| ADR010 | Founding cohort: 180-day trial with activation rule and 24-month price lock | Accepted | Commercial |
| ADR011 | Kiorly does no tax-authority ETA integration | Accepted | Compliance |
| ADR012 | Kiorex Account: managed OIDC identity, patients first | Accepted | Identity |
| ADR013 | Clinical data never flows into identity | Accepted | Privacy |
| ADR014 | Per-market configuration through market packs | Accepted | Platform |
| ADR015 | Hosting: AWS, Egypt tenants in the Frankfurt cell | Accepted | Infrastructure |
| ADR016 | AI: OpenAI EU endpoint now; self-hosted open model at scale | Accepted | AI |
| ADR017 | Pharmacy and Lab start as Kiorly SaaS before any Kiorex commerce | Accepted | Sequencing |
| ADR018 | One store account per platform; apps by audience | Accepted | Distribution |
| ADR019 | Domains: kiorex.com (patients, identity) and kiorly.com (providers) | Accepted | Brand |
| ADR020 | Reviews: Kiorex is the single source; only completed visits | Accepted | Trust |
| ADR021 | Sponsored placement allowed only when labelled and never affects verification | Proposed | Commercial |
| ADR022 | Series A raised against milestone gates, not calendar | Proposed | Finance |
| ADR023 | Everything ships enabled by default; Kiorex super admin can switch any capability off | Accepted | Platform |
| ADR024 | Launch-locked flags: ON by default, effective only once legal/clinical gate evidence is recorded | Accepted | Compliance |
| ADR025 | Safety controls are never feature flags | Accepted | Clinical safety |
| ADR026 | 2025 Kiorex repositories are references, not foundations | Accepted | Engineering |
| ADR027 | Shared code ships as versioned packages on GitHub Packages | Accepted | Engineering |
| ADR028 | Infrastructure as code with OpenTofu through cloud-neutral module contracts; AWS today | Accepted | Infrastructure |
| ADR029 | Profession is a first-class attribute of every clinician; it drives verification, scope of practice and marketplace category | Accepted | Clinical / Data |
| ADR030 | Service location (in clinic, at home) is set per visit type; Kiorly stays system of record for home visits | Accepted | Product / Data |
| ADR031 | Kiorly Nurse is an edition of Kiorly Clinic, not a separate product or repository | Accepted | Architecture / Brand |
| ADR032 | Nurses can be tenants alone or as agencies; Kiorex listing of individual nurses is launch-locked | Accepted | Commercial / Compliance |

## 03 Decisions in detail
**ADR001** Accepted · Strategy. Why: Decouples failure domains and lets each product be sold alone. Replaces the 34-module all-in-one model. Consequence: Separate repos, deployables and databases per product.
**ADR002** Accepted · Brand. Why: Patients and providers buy for different reasons; one name per audience keeps marketing spend focused. Consequence: Kiorly Clinic / Kiorly Nurse / Kiorly Pharmacy / Kiorly Lab; singular names.
**ADR003** Accepted · Architecture. Why: Shipped, tested and enforced by module-boundary tests; extraction path documented (MODULAR_MONOLITH). Consequence: Extract a context only when scale or team ownership demands it.
**ADR004** Accepted · Architecture. Why: Plans, entitlements, subscriptions, credit wallet, settlement and market packs are already proven in Kiorly; Pharmacy and Lab reuse them. Consequence: Publish @kiorly/commerce-kernel from clinics-management; versioned, semver, contract-tested. The same pattern publishes @kiorly/field-visit (ADR030).
**ADR005** Accepted · Data. Why: Avoids double-booking; Kiorex keeps booking intent and attribution only. Consequence: Kiorex books via holds + Idempotency-Key; never writes appointments directly. Applies equally to home visits.
**ADR006** Accepted · Integration. Why: Already built (KX01/KX05); simple, auditable, works across clouds. Consequence: OpenAPI pinned in both CIs (NH019); event bus only if fan-out exceeds 3 consumers.
**ADR007** Accepted · Commercial. Why: Aligns price with delivered value; resistant to fee-inflation disputes; easy to explain. Consequence: EGP 40 placeholder; per specialty, profession and service-location override; benchmark guardrail at 50% of lowest competitor.
**ADR008** Accepted · Commercial. Why: Makes Kiorly 'free' for providers Kiorex keeps busy — the core wedge against incumbents. Consequence: CR06 settlement engine; informational offset line.
**ADR009** Accepted · Commercial. Why: Zero-risk entry for single practitioners; marketplace supply growth. Consequence: Minimum invoice EGP 100, carry-forward; unpaid → listing paused, Kiorly keeps working.
**ADR010** Accepted · Commercial. Why: Speeds supply acquisition in Egypt while filtering inactive sign-ups. Consequence: 500 clinics; ≥20 checked-in visits in 30 days else 90-day trial.
**ADR011** Accepted · Compliance. Kiorly does no tax-authority ETA integration. Why: Decided after legal review; clinics issue their own receipts. Consequence: FD02 removed fiscal modules; printouts are payment records only.
**ADR012** Accepted · Identity. Why: Do not hand-roll identity; Kiorly launch must not wait. Consequence: Kiorly keeps its auth at launch behind an OIDC-ready seam; providers federate in phase 2.
**ADR013** Accepted · Privacy. Why: Identity roles must not imply chart access. Consequence: Kiorex Account holds subject, credentials, memberships only — no profession, licence or address claims.
**ADR014** Accepted · Platform. Why: New country without code forks; already implemented (Market pack, commercialConfig). Consequence: Market go-live template + certification checklist; packs now also carry the scope-of-practice matrix and district lists for coverage zones.
**ADR015** Accepted · Infrastructure. Why: No in-country hyperscaler region; recorded government approval path (SC01). Consequence: platform/data-cells.json; optional future cell when available.
**ADR016** Accepted · AI. Why: Speed to launch with redaction and consent; cost and control later. Consequence: Provider abstraction; market-specific redaction; plan-gated quotas.
**ADR017** Accepted · Sequencing. Why: Supply and compliance first; marketplace consumes their APIs. Consequence: Pharmacy pilot M13, Lab pilot M19; marketplace verticals follow GA. Kiorly Nurse follows the same pattern (software pilot before Kiorex home-nursing category).
**ADR018** Accepted · Distribution. Why: Apple 5.1.1(ix) requires a legal entity for health apps; multiple accounts add no value. Consequence: Kiorex app + Kiorly app (edition-aware for Kiorly Nurse); field apps only on demand.
**ADR019** Accepted · Brand. Why: Session-cookie isolation and focused SEO. Consequence: Marketing in paths, apps on subdomains (incl. nurse.kiorly.com); kiorly.link for booking links.
**ADR020** Accepted · Trust. Why: Verified-only reviews are a differentiator and a moderation safeguard. Consequence: REVIEW_INVITATION_ELIGIBLE event on COMPLETED (KX08).
**ADR021** Proposed · Commercial. Why: Adds revenue without compromising trust. Consequence: Launch after marketplace liquidity; ranking explanation page.
**ADR022** Proposed · Finance. Why: Seed lasts to M27 in base case; raise from strength. Consequence: Gates in KX13 §10; raise window M15–M20.
**ADR023** Accepted · Platform. Why: Founder decision 19 Nov 2026 — build every module, release it ON, and keep operational control centrally without deploys. Consequence: Flag control plane in kiorex-platform; global · market · organization scopes; any OFF wins; universal OFF contract; Kiorly FF01…06.
**ADR024** Accepted · Compliance. Why: Keeps the default-ON model while preventing regulated features from going live before approval. Consequence: Pharmacy orders, lab bookings, telemedicine, AI navigation, AI receptionist, specialty templates, new markets — and from v2.3 home visits (GHV1/GHV2), physiotherapy category (GPR1), nursing care plans and MAR (GKN1), individual nurse listing (GKN2).
**ADR025** Accepted · Clinical safety. Why: A switch that can disable Rx checks, QC or audit is itself a hazard. Consequence: Fixed list in KX08; CI rejects flag keys on safety paths. v2.3 adds scope-of-practice enforcement, profession verification, home-visit safety timer/SOS/unsafe-abort, address masking and MAR checks.
**ADR026** Accepted · Engineering. Why: Assessment (KX22): kiorex-backend is an untested TypeORM microservice prototype with Stripe/Twilio; kiorex-web-app is UI with dummy data; kiorex-ai-services is empty; backend-documentation describes an unbuilt architecture. Consequence: Build kiorex-platform from the Kiorly skeleton; harvest patient UI only; secret-scan then archive all four repos.
**ADR027** Accepted · Engineering. Why: Keeps repos independently deployable while reusing the kernel and contracts. Consequence: @kiorly/commerce-kernel, @kiorly/field-visit, @kiorex/contracts; semver; 90-day dual support on majors.
**ADR028** Accepted · Infrastructure. Why: Founder decision 19 Nov 2026 — stay on AWS but be able to switch cloud without a rewrite; OpenTofu is open source (MPL 2.0) and free. Consequence: CDK retired before the Kiorly pilot; encrypted S3 state; app adapters for storage, secrets, email; no AWS SDK outside adapters (KX21 §01).
**ADR029 · Profession is a first-class attribute of every clinician** Accepted · Clinical / Data. Why: Physiotherapists and nurses are licensed under different laws and syndicates from doctors (physiotherapy: Law 3 of 1985 [extraction garbled]) and may not do the same things — they must never issue a drug prescription. Today every clinician is implicitly a doctor. Decision: Clinician.profession ∈ PHYSICIAN, DENTIST, PHYSIOTHERAPIST, NURSE, extensible by market pack; a scope-of-practice matrix maps profession × capability. Consequence: @RequiresScope guard (never a flag); verification per profession (PRVER); Kiorex care-type categories; existing clinicians migrate to PHYSICIAN/DENTIST. Rollback: none needed — additive.
**ADR030 · Service location is set per visit type** Accepted · Product / Data. Why: Doctors, physiotherapists and nurses all do home visits; building it per profession would triple the work and split the slot engine. Options: separate home-care product vs. a property of the visit type — the latter chosen. Decision: VisitType.serviceLocation ∈ IN_CLINIC, HOME (VIDEO reserved). Consequence: Slot engine gains coverage zones, travel buffers and home caps; Kiorly remains system of record (ADR005); field logic published as @kiorly/field-visit and reused by Kiorly Lab home collection; home-visit safety controls are never flags; launch-locked behind GHV1/GHV2.
**ADR031 · Kiorly Nurse is an edition of Kiorly Clinic** Accepted · Architecture / Brand. Why: Most of what a nurse or agency needs (Estimated ≈80%) already exists in Kiorly Clinic. A separate product would fork scheduling, payments, messaging and the Kiorex connector. Decision: Organization.edition ∈ CLINIC, NURSE; the NURSE edition has its own name, navigation, terminology, plans and modules (care plans, nursing records, vitals, MAR, shifts, dispatch) and hides doctor-only modules. Consequence: Same repository, API, database, kernel and connector; edition set at sign-up, changed only by the super admin; PRD is KX23.
**ADR032 · Individual nurses and agencies are both tenants** Accepted · Commercial / Compliance. Why: Home nursing in Egypt is delivered by companies and by freelance nurses; excluding individuals leaves most supply out, but listing them to patients without a legal basis is a safety and regulatory risk. Decision: A solo nurse is an organization of one (Nurse Lite / Nurse Pro); agencies use Nurse Agency. Software use is open to both from day one; Kiorex listing of individual nurses is launch-locked (GKN2). Consequence: nurse.individual_kiorex_listing flag; stricter solo verification (ID selfie match, criminal-record certificate — Q8); agencies listed after GHV1/GHV2.

## 04 What changed from the Kiorex v2 drafts
| Draft position | Replaced by | Reason |
|---|---|---|
| Six repos incl. a central healthcare-platform service | ADR004 shared kernel package + kiorex-contracts | No service until cross-product operations justify it |
| Passport identity built before the Egypt clinic launch (Wave 1) | ADR012 Kiorly launches on own auth | Kiorly is build-ready; do not block revenue |
| Marketplace take rate 5–13% of booking value | ADR007 flat fee per attended new patient | Matches what Kiorly ships (CR04) and the founder's competitor guardrail |
| Generic Lite/Pro/Enterprise ladder | Lite / Pro / Clinic / Enterprise as built (PL04) | Repository is the source of truth |
| Five governance councils (G0–G4 gates) | Named decision owners (KX00 §7) | Team size |
| Repeated boilerplate 'data/negative-path' blocks | Requirement IDs with specific acceptance criteria | Boilerplate was mismatched and unusable |
| Revenue-only financial model | Full P&L, cash and runway (KX13) | Investors need burn and runway |
| 'Kiorex Labs / Pharmacies' naming | Kiorly Lab / Kiorly Pharmacy (ADR002) | Avoid R&D and regulated-operator connotations |
| Pharmacy/lab brands unresearched | Brand architecture fixed; discovery interviews required (KX06/07) | Close the gap explicitly |
| Staged releases per product and wave | ADR023 deploy = live, switchable from super admin | Founder decision |
| Home nursing as a P3 Kiorex-only module (M11) | ADR030/031 home visits in Kiorly; Kiorly Nurse edition (KX23) | Supply first, software before marketplace |

(Extraction of the last two rows is jumbled; the final row's pairing is inferred from the text order "Home nursing as a P3 Kiorex-only module M11 / ADR030/031 ... / Supply first, software before marketplace".)

## 05 Open questions
| # | Question | Owner | Due | Default until answered |
|---|---|---|---|---|
| Q1 | Final Kiorex fee per specialty (EGP 40 placeholder) after competitor benchmarking | CEO | Pilot week 6 | EGP 40 flat; warning chip if >50% of benchmark |
| Q2 | Pro price point: 799 / 999 / 1,299 | CEO | Pilot week 8 | 999 annual / 1,299 monthly |
| Q3 | Managed IdP vendor for Kiorex Account | CEO / acting CTO | Month 2 | Scorecard in KX04 §6 |
| Q4 | VAT treatment: medical services vs Kiorly SaaS (NH001) | Tax adviser | Before first invoice | Medical 0%, SaaS 14% in pack |
| Q5 | Pharmacy marketplace: merchant of record and delivery partner | CEO + counsel | Month 10 | No pharmacy marketplace until decided |
| Q6 | Market 2 selection KSA vs UAE | CEO | Month 18 | Prepare both packs to checklist depth |
| Q7 | May individual nurses be listed for home bookings, and what duty of care does the platform carry? | CEO + counsel | Month 9 | Solo nurses use Kiorly Nurse as software only; Kiorex lists agencies only |
| Q8 | Is a criminal-record certificate lawful and practical to require from solo nurses (and home-visit doctors/physios)? | Counsel + DPO | Month 9 | Required for solo nurses only |
| Q9 | May physiotherapists treat without a doctor's referral (direct access)? | CMO + counsel | Month 8 | Referral recorded, not required; template prompts for it |
| Q10 | Accepted forms of a doctor's order for nurse-administered medication | CMO + nursing advisor | Month 12 | Shared Kiorly order or photo upload with prescriber name and date |
| Q11 | Do nursing agencies need a facility licence (Law 51 of 1981) before listing, and what do we verify? | Counsel | Month 12 | Commercial registration + MoH licence where one exists; ops review |
| Q12 | Final Arabic product name for Kiorly Nurse | CEO + brand | Month 9 | كيورلي نيرس (glyphs garbled in extraction; same as KX23) |
| Q13 | Home-visit commission override and Kiorly Nurse plan prices | CEO | Pilot week 8 | EGP 40 flat; Nurse plans as KX23 §05 |
