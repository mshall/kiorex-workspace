# KX22 · GitHub Repository Map & Build-Agent Handoff
Source: 1TSvVbvcT4lJUQNUEgg3Hnlu6p0_AxGzx

> Extraction note: symbols (≥, ≈, →, +) and some diagram/table cell alignments lost in the PDF text layer were restored by inference where obvious. Page headers/footers removed. The legacy module map (§07) is a two-column table in the PDF whose cells interleaved on extraction; mappings below were re-paired by best reading.

Section 03 — TECHNICAL DOCUMENTS.

What exists on GitHub today, what each repository becomes, what to keep, harvest or archive, the conventions every repo follows — and the exact brief a build agent needs to construct the platform.

- Authored in the role of Chief Software Architect. Accountable for repository boundaries, engineering conventions and the build handoff.
- Topics: 5 repos assessed · Keep · harvest · archive · Target repo map · M01–M34 mapping · Conventions · Agent brief

| Field | Value |
|---|---|
| DOCUMENT | KX22 |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Build agents (Cursor / autonomous), engineering leads, technical due diligence |
| OWNER ROLE | Chief Software Architect |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 Summary
02 Inventory of existing repositories
03 Assessment: kiorex-backend
04 Assessment: kiorex-web-app
05 Assessment: kiorex-ai-services and kiorex-backend-documentation
06 Target repository map
07 Legacy module map (M01–M34 → v2 repositories)
08 Harvest map
09 Engineering conventions (all repositories)
10 Migration sequence
11 Build-agent brief
12 Sources & evidence

**EVIDENCE:** Assessment performed on 19 Nov 2026 by cloning every Kiorex-related repository under github.com/mshall and inspecting code, tests, dependencies, commit history and docs. Figures are counts from the repositories at the commits listed below.

## 01 Summary

One repository is production-grade; the four 2025 Kiorex repositories are prototypes and design references. None of them is a foundation to build on.

Headline stats: PRODUCTION-GRADE — 1 repo (clinics-management, Kiorly) · 2025 PROTOTYPES — 4 repos, reference only · TARGET REPOSITORIES — 6 (per KX08) · LEGACY BACKEND CODE MIGRATED — 0 (harvest designs, not code).

| Repository | Verdict | One-line reason |
|---|---|---|
| mshall/clinics-management | KEEP — foundation | Kiorly Clinic, build-ready; source of the commerce kernel, contracts and the infra template (moving to OpenTofu) |
| mshall/kiorex-web-app | HARVEST UI → archive | Same stack as Kiorly web; ≈40k lines of screens with dummy data — reuse patient-facing pages |
| mshall/kiorex-backend | REFERENCE → archive | 17-service NestJS/TypeORM prototype, almost no tests, no idempotency/outbox, Stripe; conflicts with ADR-003 |
| mshall/kiorex-ai-services | ARCHIVE | Empty (README title only) |
| mshall/kiorex-backend-documentation | ARCHIVE | Docs for a third, unbuilt architecture (Express, EKS, Terraform, Helm); superseded by KX08/09/21 |

## 02 Inventory of existing repositories

| Repository | Last commit | Commits | Stack | Size | Tests |
|---|---|---|---|---|---|
| clinics-management | 6b24a79 · 19 Nov 2026 | Active | NestJS modular monolith, Prisma, PostgreSQL 16, React 18 + Vite, AWS CDK | 108-step build sequence; full Docs hub | Unit, integration, contract, property-based, Playwright golden flows |
| kiorex-web-app | bef5c0d · 30 Sep 2025 | 72 | React 18, Vite, TypeScript, shadcn/ui, Tailwind, TanStack Query, i18next (ar, en, es, fr) | 39,900 lines TS/TSX; 59 routes; 125 TSX files | None; no API calls (dummy data) |
| kiorex-backend | c55ddcb · 7 Oct 2025 | 27 | NestJS 10/11 microservices, TypeORM, PostgreSQL 15, Kafka, Redis/Bull, Elasticsearch, MinIO, Stripe, Twilio, k8s YAML | 25,000 lines TS across 17 service folders (2 empty, 1 stub); 31 SQL files | 4 files — framework boilerplate |
| kiorex-ai-services | 81d3049 · 5 Oct 2025 | 1 | — | 1 file (README) | — |
| kiorex-backend-documentation | 2bb88a3 · 23 Sep 2025 | 1 | Markdown + Postman | 19 docs, 3 Postman files | — |

## 03 Assessment: kiorex-backend

A broad prototype of the 2025 'all-in-one' vision. Valuable as a catalogue of entities and endpoints; not suitable as a production base.

| Service | Lines TS | Controllers / entities | Overlaps with (v2 owner) | Harvest value |
|---|---|---|---|---|
| appointment-service | 3,736 | 5 / 6 | Kiorly Clinic (built, superior) | None — Kiorly owns scheduling |
| clinical-service | 3,966 | 6 / 10 | Kiorly Clinic | None |
| lab-service | 2,886 | 5 / 4 (+ migrations/seeds) | Kiorly Lab (KX07) | Entity and endpoint ideas for lab orders/results/tests |
| pharmacy-service | 2,226 | 4 / 5 (medication, interaction, allergy, prescription, inventory) | Kiorly Pharmacy (KX06) | Catalogue/interaction model ideas |
| inventory-service | 1,412 | 2 / 3 | Kiorly Pharmacy | Stock model ideas (lots/expiry must be redesigned) |
| nurse-service · surgery-service | 2,435 · 2,068 | 4/4 · 4/4 | Kiorex P3 verticals | Domain vocabulary for home nursing and surgery funnels |
| video-service | 490 | 2 / 2 (Twilio) | Kiorex telemedicine (P3) | Reference only; re-evaluate provider |
| auth · user · payment | 1,393 · 934 · 981 | 2/4 · 2/1 · 2/3 (Stripe) | Kiorex Account; Kiorly Pay / Kiorex Pay | None — managed IdP and Egyptian PSPs |
| api-gateway · notification · search · analytics | 1,532 · 1,257 · 408 · 308 | small | Kiorex platform modules | None |
| admin · document · consultations | 0 · 0 · 225 | empty / stub | — | None |

| Finding | Impact |
|---|---|
| Microservice-per-domain with separate databases, Kafka and Elasticsearch from day one | Contradicts ADR-003 (modular monolith) and the small-team cost model |
| TypeORM; Kiorly and all v2 repos use Prisma | No code-level reuse without rewrite |
| Effectively no tests (4 boilerplate files) | Nothing to prove correctness; unsafe to extend |
| No idempotency keys, holds, outbox or settlement | The hard parts of the marketplace are absent |
| Stripe, Twilio; no Paymob/Fawry/InstaPay, no WhatsApp | Wrong integrations for Egypt |
| Compiled `dist/` folders and runtime `.log` files committed; history contains 'remove hardcoded secrets' commits | Repository hygiene risk — run a secret scan (gitleaks) and rotate any credential that was ever committed before archiving |

## 04 Assessment: kiorex-web-app

A rich clickable prototype on exactly the stack Kiorly uses — the fastest starting point for the Kiorex patient web.

| Route group | Examples | Decision |
|---|---|---|
| Patient marketplace | /marketplace, /search/doctors, /provider-profile, /booking, /service-detail, /patient-portal, /patient-appointments, /patient-records | Harvest into kiorex-platform/apps/web; wire to Kiorex API |
| Auth & onboarding | /auth/patient-signup, /auth/patient-signin, /auth/verify-email, /auth/mfa-setup, /auth/profile-setup | Harvest layout only; replace flows with Kiorex Account OIDC + phone OTP |
| Shared UI | components/ui (shadcn), Navigation, LanguageSwitcher, useRTL, i18n setup | Harvest — align tokens with KX19 identity |
| Provider dashboards | /clinic-*, /doctor-*, /nurse-*, /pharmacy-*, /ehr, /admin-* | Drop — owned by Kiorly products |
| Telemedicine | /telemedicine, /teleconsult, /consultation | Park until telemedicine gate (P3) |
| Landing/marketing | Hero, Features, Testimonials, CTA | Harvest for kiorex.com marketing pages; remove fictional testimonials |

**WATCH:** Every screen uses hard-coded dummy data and there are no tests. Treat harvested pages as design and layout, not as working features: each must be connected to real APIs, given loading/empty/error states, and covered by tests before it counts as done.

## 05 Assessment: kiorex-ai-services and kiorex-backend-documentation

- `kiorex-ai-services` contains only a README title. AI capabilities live inside each product behind an AI gateway (KX11). Archive.
- `kiorex-backend-documentation` describes Express services on EKS with Terraform, Helm and Argo CD, RS256 JWTs and service names (doctors-service, prescription-service, marketplace-orchestrator) that exist in neither codebase. Superseded by KX08 (architecture), KX09 (contracts) and KX21 (AWS). Archive; keep the Postman collections as historical examples only.
- `kiorex-backend/docs/AI-Services-Roadmap.md` (15 AI categories) is superseded by the focused portfolio in KX11.

## 06 Target repository map

Six repositories. Each row is the contract for a build agent: what it owns, how it ships and which documents govern it.

Figure — Repository dependency graph. Dependencies flow through versioned packages and contracts, never through source imports. Nodes: kiorex-contracts (OpenAPI · event schemas · SDKs) pins → clinics-management (Kiorly Clinic · publishes kernel), kiorex-platform (marketplace · super admin · flags), kiorly-pharmacy (new · M9), kiorly-lab (new · M15); `@kiorly/commerce-kernel` (npm package from clinics-management) consumed by pharmacy/lab; kiorex-account (IdP config as code) provides OIDC to platform and products.

| Repository | Owns (products / modules) | AWS stack (KX21) | Domains (KX19) | Flag prefix | Governing docs | Start |
|---|---|---|---|---|---|---|
| clinics-management | Kiorly Clinic; commerce-kernel package; Kiorly side of marketplace API | kiorly-clinics-management | app.kiorly.com · api.kiorly.com · kiorly.link | `clinic.*` + existing keys | KX05, KX17, repo build sequence | Live |
| kiorex-platform | Kiorex API, patient web, Expo app, ops console + super admin, flag control plane, Kiorex Pay | kiorex-platform | kiorex.com · api · ops · pay.kiorex.com | `kiorex.*`, `market.*` | KX03, KX08 §flags, KX09 | M1 |
| kiorex-account | IdP configuration, themes, OTP sender Lambdas, back-channel logout | kiorex-account | account.kiorex.com | `account.*` | KX04 | M1 |
| kiorex-contracts | OpenAPI specs, event JSON Schemas, generated TS SDKs, contract tests | — (CI; GitHub Packages) | docs.kiorly.com (published specs) | — | KX09 | M1 |
| kiorly-pharmacy | Kiorly Pharmacy API, POS PWA | kiorly-pharmacy | pharmacy.kiorly.com | `pharmacy.*` | KX06 | M9 |
| kiorly-lab | Kiorly Lab API, console, phlebotomist app, analyzer bridge | kiorly-lab | lab.kiorly.com | `lab.*` | KX07 | M15 |

## 07 Legacy module map (M01–M34 → v2 repositories)

Stable references from the 2025 Comprehensive PRD, re-homed to the v2 repositories.

| ID | Module | v2 home |
|---|---|---|
| M01 | Identity & access | kiorex-account |
| M02 | Patient & family accounts | kiorex-platform |
| M03 | Provider credentialing | clinics-management (ON-03); registry in kiorex-platform |
| M04 | Doctor booking | kiorex-platform + clinics-management |
| M05 | Virtual consultations | kiorex-platform (P3, gated) |
| M06 | Digital prescriptions | clinics-management → kiorly-pharmacy |
| M07 | Personal health vault | kiorex-platform |
| M08 | Lab marketplace | kiorex-platform + kiorly-lab |
| M09 | Pharmacy marketplace | kiorex-platform + kiorly-pharmacy |
| M10 | Surgery marketplace | kiorex-platform (P3) |
| M11 | Home nursing marketplace | kiorex-platform (P3) |
| M12 | Payments & wallets | commerce-kernel + each product; Kiorex Pay in kiorex-platform |
| M13 | Notifications | Each product (WhatsApp/push/email modules) |
| M14 | Reviews & loyalty | kiorex-platform |
| M15 | Marketplace administration | kiorex-platform (ops console) |
| M16 | Provider practice console | clinics-management |
| M17 | Enterprise programmes | kiorex-platform |
| M18 | Clinic management | clinics-management |
| M19 | Pharmacy operations | kiorly-pharmacy |
| M20 | Lab operations | kiorly-lab |
| M21 | Allied health | kiorex-platform (P3) |
| M22 | EHR interoperability | kiorex-contracts + each product |
| M23 | Mental health | kiorex-platform (P3) |
| M24 | Maternal & paediatrics | clinics-management (specialty packs) |
| M25 | Chronic care | kiorex-platform (P3) |
| M26 | Wellness & nutrition | kiorex-platform (P3) |
| M27 | Wearables / IoT | Deferred |
| M28 | Vaccination | clinics-management (P3) |
| M29 | Emergency & ambulance | kiorex-platform: emergency routing only |
| M30 | Devices & equipment | Deferred |
| M31 | Insurance & claims | clinics-management (MN-05) + kiorly-pharmacy |
| M32 | Second opinions | kiorex-platform (P3) |
| M33 | Education & community | kiorex-platform (content) |
| M34 | Care pathways & promotions | kiorex-platform (P3) |

(Re-paired from interleaved two-column extraction; M33 → "kiorex-platform (content)" and M34 → "kiorex-platform (P3)" per reading order.)

## 08 Harvest map

Exactly what to take from the 2025 repositories and where it goes. Everything else stays in the archive.

| From | Take | Into | How |
|---|---|---|---|
| kiorex-web-app/src/pages | Marketplace, MarketplaceHub, DoctorSearch, ProviderProfile, Booking, ServiceDetail, PatientPortal, PatientProfile, patient/* | kiorex-platform/apps/web/src/pages | Copy, strip dummy data, connect to Kiorex API hooks, add tests |
| kiorex-web-app/src/components/ui + hooks + i18n | shadcn components, useRTL, usePagination, i18n config, ar/en locales | kiorex-platform/apps/web | Align versions with Kiorly web; drop es/fr until needed |
| kiorex-web-app landing components | Hero, FeatureCard, CTA | kiorex-platform/apps/web (marketing) | Rewrite copy per KX14 voice; no fictional testimonials |
| kiorex-backend pharmacy/inventory entities | Medication, interaction, allergy, prescription, inventory shapes | kiorly-pharmacy design notes | Re-model in Prisma with lots/expiry/FEFO (KX06); no code copy |
| kiorex-backend lab-service | Lab order/result/test entities and endpoints | kiorly-lab design notes | Re-model with accession, custody, QC (KX07) |
| kiorex-backend nurse/surgery/video | Domain vocabulary | KX03 P3 backlog | Reference only |
| kiorex-backend/postman | Request examples | Archive | Superseded by kiorex-contracts |

## 09 Engineering conventions (all repositories)

| Area | Convention |
|---|---|
| Branching | Trunk-based: protected `main`; short-lived branches `feat/<req-id>-slug`, `fix/…`; squash merge |
| Commits | Conventional Commits with requirement IDs, e.g. `feat(booking): KXM-BK-03 idempotent confirm` |
| Required checks | lint · typecheck · unit · integration · contract tests · flag OFF contract tests · golden flow (where UI) · tofu fmt/validate/plan + tflint + trivy · secret scan |
| Code owners | CODEOWNERS per repo; money paths (billing, settlement, Kiorex Pay) require a second reviewer |
| Releases | Tags `vYYYY.MM.DD-N`; GitHub Environments: staging (auto) → production (approval) |
| Packages | `@kiorly/commerce-kernel` and `@kiorex/contracts` on GitHub Packages, semver; breaking change = major + 90-day dual support |
| Secrets | Never in git; GitHub OIDC to AWS; gitleaks in CI and pre-commit; Dependabot weekly |
| Docs in repo | `Docs/` hub, `NEEDS_HUMAN.md` with STOP flags, `<product>-cursor-build-sequence.md` with step IDs and progress tracker |
| Repo hygiene | No build output, logs or `.env` files committed; `.gitignore` enforced by CI |

## 10 Migration sequence

Flow: 1 Secure (gitleaks legacy repos; rotate) → 2 Contracts (create kiorex-contracts; move OpenAPI) → 3 Platform (create kiorex-platform from Kiorly template) → 4 Harvest UI (port patient pages) → 5 Account (IdP spike + kiorex-account) → 6 Archive (archive 4 legacy repos) → 7 Kernel (publish commerce-kernel, M4–M8).

| # | Action | Done when |
|---|---|---|
| 1 | Run gitleaks over full history of the four 2025 repos; rotate any Twilio, Stripe, JWT or database credential ever committed | Scan report clean or all findings rotated |
| 2 | Create `kiorex-contracts`; move `marketplace.openapi.json` and the Kiorex consumer contract from clinics-management; publish v1.0.0; both CIs pin it (closes NH-019) | Kiorly CI and Kiorex CI fail on drift |
| 3 | Create `kiorex-platform` by copying Kiorly's repo skeleton (apps/api, apps/web, infra/tofu modules, CI workflows, Docs, .cursor/rules) — not its domain code | Empty API + web deploy to staging via OpenTofu |
| 4 | Port harvested pages from kiorex-web-app per the harvest map | Patient flows render against stub API with tests |
| 5 | IdP spike (KX04 scorecard); create `kiorex-account` | Patient OTP login in staging |
| 6 | Archive the four 2025 repos on GitHub with a README banner pointing to this document | Repos read-only |
| 7 | Extract `@kiorly/commerce-kernel` from clinics-management (KCV-202) before Pharmacy build | Kiorly passes all QA-02/03 tests on the package |

## 11 Build-agent brief

Hand this section, with the referenced documents, to any agent building the platform.

**RULE — Mission:** build the Kiorex v2 ecosystem exactly as specified in KX00…KX22. Where documents and code disagree: the clinics-management code wins for what is already built; these documents win for everything new. When a decision is missing, stop and ask — do not invent product, pricing, legal or clinical behaviour.

### Read in this order

| # | Document | Why |
|---|---|---|
| 1 | KX00 Master Blueprint | Scope, products, principles P1–P11 |
| 2 | KX01 Decision Log | Binding decisions ADR-001…027 |
| 3 | KX22 (this) | Repositories, conventions, migration order |
| 4 | KX08 Architecture + flag control plane | Boundaries, kernel, flags catalogue |
| 5 | KX09 Contracts & money flows | APIs, events, idempotency, ledgers |
| 6 | KX21 AWS hosting | Stacks, network, hardening backlog |
| 7 | KX10 Platform & security | CI gates, controls |
| 7b | KX21 §01 OpenTofu | How infrastructure is written, planned and applied |
| 8 | Product PRD for the repo in hand | KX03 Kiorex · KX04 Account · KX05 Clinic · KX06 Pharmacy · KX07 Lab |
| 9 | KX16 Clinical safety | Hazards and non-switchable controls |
| 10 | KX17 / KX18 | Gates, roadmap, definition of done |

### Work order

| Wave | Repository | Deliverables | Exit test |
|---|---|---|---|
| A | clinics-management | CDK → OpenTofu migration T1–T5 (KX21 §01), FF01…FF06 (feature flags), KCV-201 (Sign in with Kiorex seam), close GA hardening HB01/02/04/06/07/08 with humans | Kiorly GA gate G2 (KX17) |
| B | kiorex-contracts | Migration steps 1–2; SDK generation; contract tests in both repos | Drift fails CI |
| C | kiorex-platform | Skeleton + OpenTofu product-stack; flag control plane + super admin (KXM-OP-07…11); provider sync, search, slots, holds, booking state machine, Kiorex Pay deposits/refunds/payouts, reviews, notifications, family, consent | KX03 closed-beta gate |
| D | kiorex-account | IdP, phone OTP, passkeys, patient login, back-channel logout | KA-01…07 green |
| E | kiorex-platform apps | Expo patient app (iOS/Android) + web from harvested UI | Golden patient journey on 3 platforms |
| F | clinics-management | KCV-202 commerce-kernel package | QA-02/03 pass on package |
| G | kiorly-pharmacy | KP-* requirements, POS PWA, flags `pharmacy.*` | KX06 stop-ship tests |
| H | kiorly-lab | KL-* requirements, analyzer bridge, flags `lab.*` | KX07 stop-ship tests |

### Definition of done (every step)

- Requirement ID referenced in branch, commit and test names.
- Migration + API + UI + tests + docs status row updated in the same change.
- Feature flag key added (ON by default) with OFF behaviour and a per-flag OFF contract test (ADR-023); safety controls never behind a flag (ADR-025).
- Arabic and English strings; RTL verified; accessibility checks.
- No PHI in logs or analytics; consent enforced where data leaves the product.
- Money paths: idempotency key, outbox event, ledger entry, reconciliation test.
- CI green including contract tests; staging deploy healthy (`/health/ready`).

### Stop and ask a human when

- Prices, fees, commission rates, VAT or refund policy are not specified.
- Any legal, clinical or regulatory text, consent wording or template content is needed (Meta templates, privacy notice, specialty templates).
- A launch-locked gate (ADR-024) would need to be marked satisfied.
- Production credentials, domains, store accounts, payment-provider onboarding or AWS account changes are required.
- A change would break a published contract or a decision in KX01.

### Never

- Use AWS CDK or CloudFormation for new infrastructure, or import `@aws-sdk/*` outside platform adapters (ADR-028).
- Copy code from kiorex-backend into v2 repositories.
- Write directly to another product's database or import another repo's source.
- Commit secrets, build output, logs or `.env` files.
- Remove or flag-gate a safety control.
- Charge for no-shows or for clinic-booking-link patients.

## 12 Sources & evidence

Every external figure in this document traces to one of these sources; internal facts trace to the Kiorly repository (mshall/clinics-management, commit 6b24a79, 19 Nov 2026) or to founder decisions recorded in KX01.

- github.com/mshall/clinics-management @ 6b24a79 (19 Nov 2026)
- github.com/mshall/kiorex-web-app @ bef5c0d (30 Sep 2025)
- github.com/mshall/kiorex-backend @ c55ddcb (7 Oct 2025)
- github.com/mshall/kiorex-ai-services @ 81d3049 (5 Oct 2025)
- github.com/mshall/kiorex-backend-documentation @ 2bb88a3 (23 Sep 2025)
