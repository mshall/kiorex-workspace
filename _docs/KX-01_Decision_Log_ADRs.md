# KX01 — Decision Log & Architecture Decision Records
Source: 1fr9kgpRWVEbaPJuyPfyfIEKws8jIDP-V

> Note: transcribed from PDF text extraction. Symbols dropped by the extractor (≥, ≤, →, ·) were restored by inference where obvious; page headers/footers removed.

Subtitle: The decisions that shape Kiorex v2 — what was decided, why, what it costs, and how to change it.

Kiorex v2 · ecosystem reference. Authored in the role of Chief Software Architect. Custodian of architecture, data boundaries and the decision record.

Tags: 28 ADRs · Rationale & consequences · Supersession map · Open questions

| Field | Value |
|---|---|
| DOCUMENT | KX01 |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Founders, engineering leads, Cursor sessions |
| OWNER ROLE | Chief Software Architect |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 How decisions are recorded
02 Decision register
03 Decisions in detail
04 What changed from the Kiorex v2 drafts
05 Open questions

## 01 How decisions are recorded

Short, numbered, immutable. Superseding a decision means a new ADR that references the old one.

Process: 01 Context (problem + evidence) → 02 Options (2 real alternatives) → 03 Decision (one sentence) → 04 Consequences (cost · risk · rollback) → 05 Status (Proposed → Accepted → Superseded).

Accepted decisions are binding for all volumes and code. Proposed decisions are being validated in the pilot. A volume that contradicts an Accepted ADR is wrong; raise a revision, do not work around it.

In code repos, the same ADR IDs are referenced in commit messages and in Docs/ (Kiorly already follows this convention via step IDs).

Counters: ACCEPTED 26 (binding) · PROPOSED 2 (validate in pilot) · V2-DRAFT ITEMS SUPERSEDED 9 (see §4) · OPEN QUESTIONS 6 (owners named).

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
| ADR028 | Infrastructure as code with OpenTofu through cloud-neutral module contracts; AWS today | Accepted | Infrastructure |
| ADR027 | Shared code ships as versioned packages on GitHub Packages | Accepted | Engineering |

(Register order as in source: ADR028 is listed before ADR027.)

## 03 Decisions in detail

Rationale and consequences for each record.

**ADR001 · Kiorex becomes the patient marketplace; provider operations move to the Kiorly suite** — Accepted · Strategy
- Why: Decouples failure domains and lets each product be sold alone. Replaces the 34-module all-in-one model.
- Consequence: Separate repos, deployables and databases per product.

**ADR002 · Two brands: Kiorex (patients/company) and Kiorly by Kiorex (providers)** — Accepted · Brand
- Why: Patients and providers buy for different reasons; one name per audience keeps marketing spend focused.
- Consequence: Kiorly Clinic / Kiorly Pharmacy / Kiorly Lab; singular names.

**ADR003 · Kiorly Clinic stays a modular monolith** — Accepted · Architecture
- Why: Shipped, tested and enforced by module-boundary tests; extraction path documented (MODULAR_MONOLITH).
- Consequence: Extract a context only when scale or team ownership demands it.

**ADR004 · Share a commerce kernel by package, not by service** — Accepted · Architecture
- Why: Plans, entitlements, subscriptions, credit wallet, settlement and market packs are already proven in Kiorly; Pharmacy and Lab reuse them.
- Consequence: Publish @kiorly/commerce-kernel from clinics-management; versioned, semver, contract-tested.

**ADR005 · Kiorly Clinic is the only system of record for clinic appointments** — Accepted · Data
- Why: Avoids double-booking; Kiorex keeps booking intent and attribution only.
- Consequence: Kiorex books via holds + Idempotency-Key; never writes appointments directly.

**ADR006 · Integration via HMAC REST + transactional outbox webhooks** — Accepted · Integration
- Why: Already built (KX01/KX05); simple, auditable, works across clouds.
- Consequence: OpenAPI pinned in both CIs (NH019); event bus only if fan-out exceeds 3 consumers.

**ADR007 · Commission = flat fee per attended new Kiorex patient (clinics)** — Accepted · Commercial
- Why: Aligns price with delivered value; resistant to fee-inflation disputes; easy to explain.
- Consequence: EGP 40 placeholder; per specialty override; benchmark guardrail at 50% of lowest competitor.

**ADR008 · Pay the higher of subscription or commission, never both** — Accepted · Commercial
- Why: Makes Kiorly 'free' for clinics Kiorex keeps busy — the core wedge against incumbents.
- Consequence: CR06 settlement engine; informational offset line.

**ADR009 · Lite tier is commission-only, no subscription** — Accepted · Commercial
- Why: Zero-risk entry for single doctors; marketplace supply growth.
- Consequence: Minimum invoice EGP 100, carry-forward; unpaid → listing paused, Kiorly keeps working.

**ADR010 · Founding cohort: 180-day trial with activation rule and 24-month price lock** — Accepted · Commercial
- Why: Speeds supply acquisition in Egypt while filtering inactive sign-ups.
- Consequence: 500 clinics; 20 checked-in visits in 30 days else 90-day trial.

**ADR011 · Kiorly does no tax-authority ETA integration** — Accepted · Compliance
- Why: Decided after legal review; clinics issue their own receipts.
- Consequence: FD02 removed fiscal modules; printouts are payment records only.

**ADR012 · Kiorex Account: managed OIDC identity, patients first** — Accepted · Identity
- Why: Do not hand-roll identity; Kiorly launch must not wait.
- Consequence: Kiorly keeps its auth at launch behind an OIDC-ready seam; providers federate in phase 2.

**ADR013 · Clinical data never flows into identity** — Accepted · Privacy
- Why: Identity roles must not imply chart access.
- Consequence: Kiorex Account holds subject, credentials, memberships only.

**ADR014 · Per-market configuration through market packs** — Accepted · Platform
- Why: New country without code forks; already implemented (Market pack, commercialConfig).
- Consequence: Market go-live template + certification checklist.

**ADR015 · Hosting: AWS, Egypt tenants in the Frankfurt cell** — Accepted · Infrastructure
- Why: No in-country hyperscaler region; recorded government approval path (SC01).
- Consequence: platform/data-cells.json; optional future cell when available.

**ADR016 · AI: OpenAI EU endpoint now; self-hosted open model at scale** — Accepted · AI
- Why: Speed to launch with redaction and consent; cost and control later.
- Consequence: Provider abstraction; market-specific redaction; plan-gated quotas.

**ADR017 · Pharmacy and Lab start as Kiorly SaaS before any Kiorex commerce** — Accepted · Sequencing
- Why: Supply and compliance first; marketplace consumes their APIs.
- Consequence: Pharmacy pilot M13, Lab pilot M19; marketplace verticals follow GA.

**ADR018 · One store account per platform; apps by audience** — Accepted · Distribution
- Why: Apple 5.1.1(ix) requires a legal entity for health apps; multiple accounts add no value.
- Consequence: Kiorex app + Kiorly app; field apps only on demand.

**ADR019 · Domains: kiorex.com (patients, identity) and kiorly.com (providers)** — Accepted · Brand
- Why: Session-cookie isolation and focused SEO.
- Consequence: Marketing in paths, apps on subdomains; kiorly.link for booking links.

**ADR020 · Reviews: Kiorex is the single source; only completed visits** — Accepted · Trust
- Why: Verified-only reviews are a differentiator and a moderation safeguard.
- Consequence: REVIEW_INVITATION_ELIGIBLE event on COMPLETED (KX08).

**ADR021 · Sponsored placement allowed only when labelled and never affects verification** — Proposed · Commercial
- Why: Adds revenue without compromising trust.
- Consequence: Launch after marketplace liquidity; ranking explanation page.

**ADR022 · Series A raised against milestone gates, not calendar** — Proposed · Finance
- Why: Seed lasts to M27 in base case; raise from strength.
- Consequence: Gates in KX13 §7; raise window M15–M20.

**ADR023 · Everything ships enabled by default; Kiorex super admin can switch any capability off** — Accepted · Platform
- Why: Founder decision 19 Nov 2026 — build every module, release it ON, and keep operational control centrally without deploys.
- Consequence: Flag control plane in kiorex-platform; global · market · organization scopes; any OFF wins; universal OFF contract; Kiorly FF01…06.

**ADR024 · Launch-locked flags: ON by default, effective only once legal/clinical gate evidence is recorded** — Accepted · Compliance
- Why: Keeps the default-ON model while preventing regulated features from going live before approval.
- Consequence: Pharmacy orders, lab bookings, telemedicine, AI navigation, AI receptionist, specialty templates, new markets.

**ADR025 · Safety controls are never feature flags** — Accepted · Clinical safety
- Why: A switch that can disable Rx checks, QC or audit is itself a hazard.
- Consequence: Fixed list in KX08; CI rejects flag keys on safety paths.

**ADR026 · 2025 Kiorex repositories are references, not foundations** — Accepted · Engineering
- Why: Assessment (KX22): kiorex-backend is an untested TypeORM microservice prototype with Stripe/Twilio; kiorex-web-app is UI with dummy data; kiorex-ai-services is empty; backend-documentation describes an unbuilt architecture.
- Consequence: Build kiorex-platform from the Kiorly skeleton; harvest patient UI only; secret-scan then archive all four repos.

**ADR028 · Infrastructure as code with OpenTofu through cloud-neutral module contracts; AWS today** — Accepted · Infrastructure
- Why: Founder decision 19 Nov 2026 — stay on AWS but be able to switch cloud without a rewrite; OpenTofu is open source (MPL 2.0) and free.
- Consequence: CDK retired before the Kiorly pilot; encrypted S3 state; app adapters for storage, secrets, email; no AWS SDK outside adapters (KX21 §01).

**ADR027 · Shared code ships as versioned packages on GitHub Packages** — Accepted · Engineering
- Why: Keeps repos independently deployable while reusing the kernel and contracts.
- Consequence: @kiorly/commerce-kernel, @kiorex/contracts; semver; 90-day dual support on majors.

## 04 What changed from the Kiorex v2 drafts

The 16 draft volumes of 19 Nov 2026 were reviewed; these positions are superseded.

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

(The source summary counts 9 superseded items; ten rows are extractable, including the final "Staged releases" row.)

## 05 Open questions

Each has an owner and a date; the default safe action applies until answered.

| # | Question | Owner | Due | Default until answered |
|---|---|---|---|---|
| Q1 | Final Kiorex fee per specialty (EGP 40 placeholder) after competitor benchmarking | CEO | Pilot week 6 | EGP 40 flat; warning chip if > 50% of benchmark |
| Q2 | Pro price point: 799 / 999 / 1,299 | CEO | Pilot week 8 | 999 annual / 1,299 monthly |
| Q3 | Managed IdP vendor for Kiorex Account | CEO / acting CTO | Month 2 | Scorecard in KX04 §6 |
| Q4 | VAT treatment: medical services vs Kiorly SaaS (NH001) | Tax adviser | Before first invoice | Medical 0%, SaaS 14% in pack |
| Q5 | Pharmacy marketplace: merchant of record and delivery partner | CEO + counsel | Month 10 | No pharmacy marketplace until decided |
| Q6 | Market 2 selection KSA vs UAE | CEO | Month 18 | Prepare both packs to checklist depth |
