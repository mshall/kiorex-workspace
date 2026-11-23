# KX22 · GitHub Repository Map & Build-Agent Handoff
Source: 17aubh5cfA7Vx_t9Wv6YXXCTQ1AawGXvx
Revision: Rev 2.3 · Reference Edition, updated 23 November 2026 (first issued 20 November 2026; this update adds the repository states and scripts of 23 Nov 2026)

> Extraction note: symbols restored by inference; §06 repo table and §07 two-column module map interleaved on extraction and were re-paired best-effort (cells flagged where ambiguous).

Section 03 — TECHNICAL DOCUMENTS. Owner: Chief Software Architect. Audience: build agents (Cursor / autonomous), engineering leads, technical due diligence.

WHAT CHANGED IN REV 2.3 (as printed): clinics-management also publishes @kiorly/field-visit and hosts the Kiorly Nurse edition (no new repo). Legacy M11 (home nursing) and M21 (allied health) re-homed to clinics-management; nurse-service remains vocabulary only. Build-agent brief: reading order adds KX23; new work wave A2 (professions, field-visit, home visits, Nurse edition); never-list and stop-and-ask rules extended.

EVIDENCE: Assessment performed on 19 Nov 2026 by cloning every Kiorex-related repository under github.com/mshall and inspecting code, tests, dependencies, commit history and docs.

## 01 Summary
One repository is production-grade; the four 2025 Kiorex repositories are prototypes and design references. None is a foundation to build on. Stats: production-grade 1 (clinics-management); 2025 prototypes 4 (reference only); target repositories 6 (per KX08); legacy backend code migrated 0.
| Repository | Verdict | One-line reason |
|---|---|---|
| mshall/clinics-management | KEEP — foundation | Kiorly Clinic (and the Kiorly Nurse edition), build-ready; source of the commerce kernel, field-visit package, contracts and the infra template (moving to OpenTofu) |
| mshall/kiorex-web-app | HARVEST UI → archive | Same stack as Kiorly web; ≈40k lines of screens with dummy data — reuse patient-facing pages |
| mshall/kiorex-backend | REFERENCE → archive | 17-service NestJS/TypeORM prototype, almost no tests, no idempotency/outbox, Stripe; conflicts with ADR003 |
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
| Service | Lines TS | Controllers / entities | Overlaps with (v2 owner) | Harvest value |
|---|---|---|---|---|
| appointment-service | 3,736 | 5 / 6 | Kiorly Clinic (built, superior) | None — Kiorly owns scheduling |
| clinical-service | 3,966 | 6 / 10 | Kiorly Clinic | None |
| lab-service | 2,886 | 5 / 4 (+ migrations/seeds) | Kiorly Lab KX07 | Entity and endpoint ideas for lab orders/results/tests |
| pharmacy-service | 2,226 | 4 / 5 (medication, interaction, allergy, prescription, inventory) | Kiorly Pharmacy KX06 | Catalogue/interaction model ideas |
| inventory-service | 1,412 | 2 / 3 | Kiorly Pharmacy | Stock model ideas (lots/expiry must be redesigned) |
| nurse-service · surgery-service | 2,435 · 2,068 | 4/4 · 4/4 | Kiorly Nurse edition (KX23) · Kiorex P3 | Domain vocabulary for home nursing (service types) and surgery funnels — no code |
| video-service | 490 | 2 / 2 (Twilio) | Kiorex telemedicine P3 | Reference only; re-evaluate provider |
| auth · user · payment | 1,393 · 934 · 981 | 2/4 · 2/1 · 2/3 (Stripe) | Kiorex Account; Kiorly Pay / Kiorex Pay | None — managed IdP and Egyptian PSPs |
| api-gateway · notification · search · analytics | 1,532 · 1,257 · 408 · 308 | small | Kiorex platform modules | None |
| admin · document · consultations | 0 · 0 · 225 | empty / stub | — | None |

Findings: microservice-per-domain with separate DBs, Kafka, Elasticsearch (contradicts ADR003 modular monolith); TypeORM vs Prisma (no code reuse without rewrite); effectively no tests (4 boilerplate files); no idempotency keys, holds, outbox or settlement; Stripe, Twilio; no Paymob/Fawry/InstaPay, no WhatsApp (wrong integrations for Egypt); compiled dist/ and runtime .log files committed; history contains 'remove hardcoded secrets' commits — run gitleaks and rotate any credential ever committed before archiving.

## 04 Assessment: kiorex-web-app
| Route group | Examples | Decision |
|---|---|---|
| Patient marketplace | /marketplace, /search/doctors, /provider-profile, /booking, /service-detail, /patient-portal, /patient-appointments, /patient-records | Harvest into kiorex-platform/apps/web; wire to Kiorex API |
| Auth & onboarding | /auth/patient-signup, /auth/patient-signin, /auth/verify-email, /auth/mfa-setup, /auth/profile-setup | Harvest layout only; replace flows with Kiorex Account OIDC + phone OTP |
| Shared UI | components/ui (shadcn), Navigation, LanguageSwitcher, useRTL, i18n setup | Harvest — align tokens with KX19 identity |
| Provider dashboards | /clinic-*, /doctor-*, /nurse-*, /pharmacy-*, /ehr, /admin-* | Drop — owned by Kiorly products (nurse screens: layout ideas only for the Kiorly Nurse edition) |
| Telemedicine | /telemedicine, /teleconsult, /consultation | Park until telemedicine gate P3 |
| Landing/marketing | Hero, Features, Testimonials, CTA | Harvest for kiorex.com marketing pages; remove fictional testimonials |
WATCH: Every screen uses hard-coded dummy data and there are no tests; treat harvested pages as design and layout only.

## 05 Assessment: kiorex-ai-services and kiorex-backend-documentation
kiorex-ai-services: README title only; AI lives in each product behind an AI gateway (KX11). Archive. kiorex-backend-documentation: Express on EKS with Terraform, Helm, Argo CD, RS256 JWTs, service names (doctors-service, prescription-service, marketplace-orchestrator) that exist in neither codebase; superseded by KX08, KX09, KX21. Archive; Postman collections historical only. kiorex-backend/docs/AI-Services-Roadmap.md (15 AI categories) superseded by KX11.

## 06 Target repository map
Six repositories. Figure 1 — Repository dependency graph: kiorex-contracts (OpenAPI · event schemas · SDKs) pins → clinics-management (Kiorly Clinic + Nurse edition · publishes kernel & field-visit), kiorex-platform (marketplace · super admin · flags), kiorly-pharmacy (new · M9 · consumes kernel), kiorly-lab (new · M15 · consumes kernel + field-visit); packages @kiorly/commerce-kernel and @kiorly/field-visit (npm); kiorex-account (IdP config as code, OIDC). Dependencies flow through versioned packages and contracts, never source imports.
| Repository | Owns | AWS stack (KX21) | Domains (KX19) | Flag prefix | Governing docs | Start |
|---|---|---|---|---|---|---|
| clinics-management | Kiorly Clinic + Kiorly Nurse edition; commerce-kernel and field-visit packages; Kiorly side of marketplace API | kiorly-clinics-management | app.kiorly.com · nurse.kiorly.com · api.kiorly.com · kiorly.link | `clinic.*`, `nurse.*` + existing keys | KX05, KX23, KX17, repo build sequence | Live |
| kiorex-platform | Kiorex API, patient web, Expo app, ops console + super admin, flag control plane, Kiorex Pay | kiorex-platform | kiorex.com · api · ops · pay.kiorex.com | `kiorex.*`, `market.*` | KX03, KX08 §flags, KX09 | M1 |
| kiorex-account | IdP configuration, themes, OTP sender Lambdas, back-channel logout | kiorex-account | account.kiorex.com | `account.*` | KX04 | M1 |
| kiorex-contracts | OpenAPI specs, event JSON Schemas, generated TS SDKs, contract tests | — (CI; GitHub Packages) | docs.kiorly.com (published specs) | — | KX09 | M1 |
| kiorly-pharmacy | Kiorly Pharmacy API, POS PWA | kiorly-pharmacy | pharmacy.kiorly.com | `pharmacy.*` | KX06 | M9 |
| kiorly-lab | Kiorly Lab API, console, phlebotomist app, analyzer bridge | kiorly-lab | lab.kiorly.com | `lab.*` | KX07 | M15 |
| kiorly-team (repo of the staff app Kiorly; being renamed to `kiorly`; formerly `kiorly-work`) | Kiorly: one Expo staff app (iOS, Android, web :8082) with Clinic, Nurse, Pharmacy and Lab sign-in entries; owns no data, calls `/mobile/*` in the three product APIs | not in the original plan (ADR-033, Proposed) | bundle id `com.kiorly.app` (placeholder), scheme `kiorly`, store title `Kiorly: Clinic, Pharmacy & Lab` | `mobile.*` (Planned); today `mobile_staff_app` | `_docs/mobile/` | built |

## 07 Legacy module map (M01–M34 → v2 repositories)
| ID | Module | v2 home |
|---|---|---|
| M01 | Identity & access | kiorex-account |
| M02 | Patient & family accounts | kiorex-platform |
| M03 | Provider credentialing | clinics-management (ON03 / PRVER); registry in kiorex-platform |
| M04 | Doctor booking | kiorex-platform + clinics-management |
| M05 | Virtual consultations | kiorex-platform (P3, gated) |
| M06 | Digital prescriptions | clinics-management → kiorly-pharmacy |
| M07 | Personal health vault | kiorex-platform |
| M08 | Lab marketplace | kiorex-platform + kiorly-lab |
| M09 | Pharmacy marketplace | kiorex-platform + kiorly-pharmacy |
| M10 | Surgery marketplace | kiorex-platform (P3) |
| M11 | Home nursing | clinics-management (Kiorly Nurse edition, KX23) + kiorex-platform (home-nursing category) |
| M12 | Payments & wallets | commerce-kernel + each product; Kiorex Pay in kiorex-platform |
| M13 | Notifications | Each product (WhatsApp/push/email modules) |
| M14 | Reviews & loyalty | kiorex-platform |
| M15 | Marketplace promotions / administration (label ambiguous in extraction) | kiorex-platform (ops console) |
| M16 | Provider practice console | clinics-management |
| M17 | Enterprise programmes | kiorex-platform |
| M18 | Clinic management | clinics-management |
| M19 | Pharmacy operations | kiorly-pharmacy |
| M20 | Lab operations | kiorly-lab |
| M21 | Allied health | clinics-management (professions: physiotherapy; KX05 §06–07) |
| M22 | EHR interoperability | kiorex-contracts + each product |
| M23 | Mental health | kiorex-platform (P3) |
| M24 | Maternal & paediatrics | clinics-management (specialty packs) |
| M25 | Chronic care | kiorex-platform (P3) |
| M26 | Wellness & nutrition | kiorex-platform (P3) |
| M27 | Wearables / IoT | Deferred |
| M28 | Vaccination | clinics-management (P3) |
| M29 | Emergency & ambulance | kiorex-platform: emergency routing only |
| M30 | Devices & equipment | Deferred |
| M31 | Insurance & claims | clinics-management (MN05) + kiorly-pharmacy |
| M32 | Second opinions | kiorex-platform (P3) |
| M33 | Education & community | kiorex-platform (content) |
| M34 | Care pathways & administration / promotions (label ambiguous) | kiorex-platform (P3) |

## 08 Harvest map
| From | Take | Into | How |
|---|---|---|---|
| kiorex-web-app/src/pages | Marketplace, MarketplaceHub, DoctorSearch, ProviderProfile, Booking, ServiceDetail, PatientPortal, PatientProfile, patient/* | kiorex-platform/apps/web/src/pages | Copy, strip dummy data, connect to Kiorex API hooks, add tests |
| kiorex-web-app/src/components/ui + hooks + i18n | shadcn components, useRTL, usePagination, i18n config, ar/en locales | kiorex-platform/apps/web | Align versions with Kiorly web; drop es/fr until needed |
| kiorex-web-app landing components | Hero, FeatureCard, CTA | kiorex-platform/apps/web (marketing) | Rewrite copy per KX14 voice; no fictional testimonials |
| kiorex-backend pharmacy/inventory entities | Medication, interaction, allergy, prescription, inventory shapes | kiorly-pharmacy design notes | Re-model in Prisma with lots/expiry/FEFO (KX06); no code copy |
| kiorex-backend lab-service | Lab order/result/test entities and endpoints | kiorly-lab design notes | Re-model with accession, custody, QC (KX07) |
| kiorex-backend nurse-service | Nursing service types and visit vocabulary | KX23 service catalogue (design notes) | Reference only; re-model as Kiorly Nurse edition in Prisma |
| kiorex-backend surgery/video | Domain vocabulary | KX03 P3 backlog | Reference only |
| kiorex-backend/postman | Request examples | Archive | Superseded by kiorex-contracts |

## 09 Engineering conventions (all repositories)
| Area | Convention |
|---|---|
| Branching | Trunk-based: protected `main`; short-lived branches `feat/<req-id>-slug`, `fix/…`; squash merge |
| Commits | Conventional Commits with requirement IDs, e.g. `feat(booking): KXM-BK-03 idempotent confirm`, `feat(home): HV-SAF-01 safety timer` |
| Required checks | lint · typecheck · unit · integration · contract tests · flag OFF contract tests · scope-of-practice tests · golden flow (where UI) · tofu fmt/validate/plan + tflint + trivy · secret scan |
| Code owners | CODEOWNERS per repo; money paths (billing, settlement, Kiorex Pay) and safety paths (scope of practice, field-visit safety, MAR) require a second reviewer |
| Releases | Tags `vYYYY.MM.DD-N`; GitHub Environments: staging (auto) → production (approval) |
| Packages | `@kiorly/commerce-kernel`, `@kiorly/field-visit` and `@kiorex/contracts` on GitHub Packages, semver; breaking change = major + 90-day dual support |
| Secrets | Never in git; GitHub OIDC to AWS; gitleaks in CI and pre-commit; Dependabot weekly |
| Docs in repo | `Docs/` hub, `NEEDS_HUMAN.md` with STOP flags, `<product>-cursor-build-sequence.md` with step IDs and progress tracker |
| Repo hygiene | No build output, logs or `.env` files committed; `.gitignore` enforced by CI |

## 10 Migration sequence
Flow: 1 Secure → 2 Contracts → 3 Platform → 4 Harvest UI → 5 Account → 6 Archive → 7 Packages (publish commerce-kernel M4–M8 and field-visit M7–M9).
| # | Action | Done when |
|---|---|---|
| 1 | Run gitleaks over full history of the four 2025 repos; rotate any Twilio, Stripe, JWT or database credential ever committed | Scan report clean or all findings rotated |
| 2 | Create `kiorex-contracts`; move `marketplace.openapi.json` and the Kiorex consumer contract from clinics-management; publish v1.0.0; both CIs pin it (closes NH019) | Kiorly CI and Kiorex CI fail on drift |
| 3 | Create `kiorex-platform` by copying Kiorly's repo skeleton (apps/api, apps/web, infra/tofu modules, CI workflows, Docs, .cursor/rules) — not its domain code | Empty API + web deploy to staging via OpenTofu |
| 4 | Port harvested pages from kiorex-web-app per the harvest map | Patient flows render against stub API with tests |
| 5 | IdP spike (KX04 scorecard); create `kiorex-account` | Patient OTP login in staging |
| 6 | Archive the four 2025 repos on GitHub with a README banner pointing to this document | Repos read-only |
| 7 | Extract `@kiorly/commerce-kernel` from clinics-management (KCV202) before Pharmacy build; extract `@kiorly/field-visit` (KCV206) before home visits | Kiorly passes all QA02/03 tests on the kernel; field-visit safety drill green |

## 11 Build-agent brief
RULE — Mission: build the Kiorex v2 ecosystem exactly as specified in KX00…KX23. Where documents and code disagree: the clinics-management code wins for what is already built; these documents win for everything new. When a decision is missing, stop and ask — do not invent product, pricing, legal or clinical behaviour.

### Read in this order
| # | Document | Why |
|---|---|---|
| 1 | KX00 Master Blueprint | Scope, products, principles P1–P12 |
| 2 | KX01 Decision Log | Binding decisions ADR001…032 |
| 3 | KX22 (this) | Repositories, conventions, migration order |
| 4 | KX08 Architecture + flag control plane | Boundaries, packages, data model, flags catalogue |
| 5 | KX09 Contracts & money flows | APIs, events, idempotency, ledgers |
| 6 | KX21 AWS hosting | Stacks, network, hardening backlog |
| 7 | KX10 Platform & security | CI gates, controls |
| 7b | KX21 §01 OpenTofu | How infrastructure is written, planned and applied |
| 8 | Product PRD for the repo in hand | KX03 Kiorex · KX04 Account · KX05 Clinic · KX23 Kiorly Nurse · KX06 Pharmacy · KX07 Lab |
| 9 | KX16 Clinical safety | Hazards and non-switchable controls |
| 10 | KX17 / KX18 | Gates, roadmap, definition of done |

### Work order
| Wave | Repository | Deliverables | Exit test |
|---|---|---|---|
| A | clinics-management | CDK → OpenTofu migration T1–T5 (KX21 §01), FF01…FF06 (feature flags), KCV201 (Sign in with Kiorex seam), close GA hardening HB01/02/04/06/07/08 with humans | Kiorly GA gate G2 (KX17) |
| A2 | clinics-management | PRSOP (profession + @RequiresScope, backfill), PRVER, CL07 physio pack; extract @kiorly/field-visit; HV home visits; then Organization.edition and KN (Kiorly Nurse) behind nurse.* flags | 403 SCOPE_NOT_ALLOWED on every Rx endpoint for physio/nurse; field-visit safety drill green; G5/G6 (KX17) |
| B | kiorex-contracts | Migration step 2; SDK generation; contract tests in both repos; v2.3 minor version (home-visit fields and events) | Drift fails CI |
| C | kiorex-platform | Skeleton + OpenTofu product-stack; flag control plane + super admin KXMOP07…11; provider sync, search, slots, holds, booking state machine, Kiorex Pay deposits/refunds/payouts, reviews, notifications, family, consent; then KXMHV (address book, home slots, visit tracking, safety console) | KX03 closed-beta gate; home-visit gate |
| D | kiorex-account | IdP, phone OTP, passkeys, patient login, back-channel logout | KA01…07 green |
| E | kiorex-platform apps | Expo patient app (iOS/Android) + web from harvested UI | Golden patient journey on 3 platforms |
| F | clinics-management | KCV202 commerce-kernel package | QA02/03 pass on package |
| G | kiorly-pharmacy | KP* requirements, POS PWA, flags pharmacy.* | KX06 stop-ship tests |
| H | kiorly-lab | KL* requirements, analyzer bridge, home collection on field-visit, flags lab.* | KX07 stop-ship tests |

### Definition of done (every step)
- Requirement ID referenced in branch, commit and test names. Migration + API + UI + tests + docs status row updated in the same change.
- Feature flag key added (ON by default) with OFF behaviour and a per-flag OFF contract test (ADR023); safety controls never behind a flag (ADR025). Scope-of-practice test for any clinical capability (which professions may and may not use it).
- Arabic and English strings; RTL verified; accessibility checks; edition-specific copy for Kiorly Nurse where shown. No PHI or patient addresses in logs or analytics; consent enforced where data leaves the product.
- Money paths: idempotency key, outbox event, ledger entry, reconciliation test. CI green including contract tests; staging deploy healthy (/health/ready).

### Stop and ask a human when
- Prices, fees, commission rates, VAT or refund policy are not specified (incl. Kiorly Nurse plan prices — Proposed).
- Any legal, clinical or regulatory text, consent wording or template content is needed (Meta templates, privacy notice, specialty, physio and nursing templates, vitals thresholds, home-visit safety protocol).
- A launch-locked gate (ADR024) would need to be marked satisfied (GHV1, GHV2, GPR1, GPR2, GKN1, GKN2 and earlier gates). Production credentials, domains, store accounts, payment-provider onboarding or AWS account changes are required.
- A change would break a published contract or a decision in KX01.

### Never
- Use AWS CDK or CloudFormation for new infrastructure, or import @aws-sdk/* outside platform adapters (ADR028). Copy code from kiorex-backend into v2 repositories (including nurse-service).
- Create a separate repository or database for Kiorly Nurse (ADR031). Write directly to another product's database or import another repo's source.
- Commit secrets, build output, logs or .env files.
- Remove or flag-gate a safety control (incl. scope of practice, home-visit safety timer/SOS/unsafe-abort, address masking, MAR checks).
- Let a physiotherapist or nurse issue a drug prescription.
- Charge for no-shows, unsafe-aborted home visits, care-plan follow-ups or clinic-booking-link patients.

## 12 Sources & evidence
Internal facts trace to mshall/clinics-management @ 6b24a79 (19 Nov 2026) or to founder decisions in KX01. Sources: clinics-management @ 6b24a79 (19 Nov 2026); kiorex-web-app @ bef5c0d (30 Sep 2025); kiorex-backend @ c55ddcb (7 Oct 2025); kiorex-ai-services @ 81d3049 (5 Oct 2025); kiorex-backend-documentation @ 2bb88a3 (23 Sep 2025).

## 13 Repository states, scripts and seeds (23 Nov 2026)
| Repository | Branch | State | Tests and checks observed |
|---|---|---|---|
| kiorex-contracts | main | 1.7.0 (notification layer) | `npm test`; notify 60 tests at 100 % coverage |
| kiorex-platform | main | Built, pre-launch; patient app has Services, family visit status, push taps | patient app Jest 157; web and ops lint at zero warnings; TypeScript 7 type-check clean (tooling blockers noted in the repo) |
| kiorex-account | main | Dev complete; OTP provider channels ready | repo tests |
| clinics-management | `kiorex` (never `main`, no push without approval) | Built; staff `/mobile/*` API; 72-doctor demo tenant | Clinic web lint 0 warnings; golden-flow and RBAC smoke |
| kiorly-pharmacy | main | In progress, ahead of plan | e2e 17; web spec 19 |
| kiorly-lab | main | In progress, ahead of plan | e2e 18; web spec 20 |
| kiorly-team | main | Kiorly app, dev builds | Jest 167 (all pass on 23 Nov); web specs clinic 6, pharmacy 19, lab 20; `tsc` clean |
| workspace | main | Docs, brand, e2e, scripts | `cd e2e && npm test` runs 18 suites against the running stack |

Scripts (workspace `scripts/`, `e2e/scripts/`): `e2e/scripts/up.sh [--build] [--seed] [--restart]` and `down.sh` start and stop Passport, Clinic, Kiorex, Pharmacy and Lab APIs (by port; never :3000); `scripts/seed-all.sh [--reset]` seeds synthetic demo data in dependency order (Passport, Clinic including Nurse tenants, Pharmacy, Lab, provider sync, Kiorex, and the three staff-app `seed:mobile` seeds), idempotent and refusing production; `scripts/seed-staging.sh --dry-run` prints the AWS staging plan (a human deploys first); `scripts/push-all.sh` pushes only with founder authorization and never touches Clinic `main`; `scripts/ops-sync.mjs` triggers a provider sync. Seed credentials are DEV ONLY and live in `TEST_DATA.md` and each repo's `DEMO_DATA.md`.

Build-agent additions: read `_docs/PROVIDER_GO_LIVE.md`, `kiorex-contracts/docs/NOTIFICATION_LAYER.md` and KX24 before touching messaging; new messaging code goes through `@kiorex/contracts/notify`; staff-app work follows `_docs/mobile/` and never adds prices or upgrade buttons on iOS.

## What changed in this revision (23 Nov 2026)
- Added kiorly-team to the repository map and §13 with repository states, scripts and seeds.
- Legacy module map, harvest map, conventions, migration sequence and build-agent brief are unchanged apart from the reading additions in §13.
- Not verified: GitHub remotes and visibility (the Drive KX24 draft could not see five of them); the 2 failing Jest tests in kiorly-team.
