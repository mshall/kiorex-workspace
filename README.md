<div align="center">

<img src="docs/assets/kiorex-logo-lockup.svg" alt="Kiorex" height="84">

# Kiorex v2 workspace

**The ecosystem map.** One parent folder, seven repositories, two brands, four products.
Kiorex (patients) and Kiorly by Kiorex (clinics, pharmacies, labs) built to work together and to work alone.

![Ecosystem](https://img.shields.io/badge/ecosystem-Kiorex%20v2-3730A3)
![Reference set](https://img.shields.io/badge/reference-Rev%202.3%20(KX--00..23)-0369A1)
![Stack](https://img.shields.io/badge/stack-NestJS%20%7C%20Prisma%20%7C%20React%20%7C%20Expo-3730A3)
![DB](https://img.shields.io/badge/PostgreSQL-16%2B-0369A1?logo=postgresql&logoColor=white)
![IaC](https://img.shields.io/badge/IaC-OpenTofu-3730A3)
![Providers](https://img.shields.io/badge/providers-ready%20for%20real%20URLs-E8735E)
![Tax authority](https://img.shields.io/badge/tax--authority%20reporting-never-E8735E)
![License](https://img.shields.io/badge/license-private-lightgrey)

[The map](#the-map) · [Repositories](#repositories) · [How they integrate](#how-the-products-integrate) · [Start locally](#start-everything-locally) · [Decisions](#decisions) · [Docs](#where-to-read-next)

</div>

---

## What and why

Kiorex v2 is a healthcare ecosystem for Egypt and the region. **Kiorex** is the patient side: a marketplace to discover verified doctors, book **live slots from each clinic's own schedule**, pay a deposit and keep records, with a super admin that owns every feature flag. **Kiorex Passport** is the shared sign-in. **Kiorly by Kiorex** is the provider SaaS: Kiorly Clinic (built, with a Nurse edition), Kiorly Pharmacy and Kiorly Lab. Every Kiorly product works without Kiorex; when connected, they talk through **versioned contracts, HMAC-signed REST and outbox webhooks**, and never share a database or import each other's source. This folder is the parent that holds the product repos, the reference documents, the brand kit and the cross-product end-to-end tests.

<img src="docs/assets/ecosystem-map.svg" alt="Kiorex v2 ecosystem map" width="100%">

## The map

```mermaid
flowchart TB
  subgraph Patients[Kiorex - patients]
    KXW[Patient web :5180]
    KXM[Expo app :8081]
    KXO[Ops console :5181]
    KXA[Kiorex API :4000<br/>marketplace, Kiorex Pay, flag control plane]
  end
  PP[Kiorex Passport :4400<br/>OIDC, phone OTP, passkeys]
  CT[(kiorex-contracts<br/>OpenAPI, events, flags, HMAC SDK)]
  subgraph Kiorly[Kiorly by Kiorex - providers]
    KC[Kiorly Clinic :3010 / :5174<br/>Clinic and Nurse editions]
    KPH[Kiorly Pharmacy :3100 / :5192]
    KLB[Kiorly Lab :3200 / :5193]
    KW[Kiorly staff app<br/>repo kiorly<br/>Expo]
  end
  KXW --> KXA
  KXM --> KXA
  KXO --> KXA
  KXW -. OIDC .-> PP
  KC -. OIDC .-> PP
  PP -. back-channel logout .-> KXA
  PP -. back-channel logout .-> KC
  KXA -- HMAC REST: holds, confirm --> KC
  KC -- outbox webhooks --> KXA
  KXA -- partner HMAC REST --> KPH
  KXA -- partner HMAC REST --> KLB
  KPH -- outbox webhooks --> KXA
  KLB -- outbox webhooks --> KXA
  KXA -- flag snapshot + push --> KC
  KXA -- flag snapshot + push --> KPH
  KXA -- flag snapshot + push --> KLB
  CT -. pinned import .-> KXA
  CT -. pinned import .-> KC
  CT -. pinned import .-> KPH
  CT -. pinned import .-> KLB
  KW -.-> KC
```

## At a glance

| | |
|---|---|
| **Brands** | Kiorex (patients, company) and Kiorly by Kiorex (providers) |
| **Products** | Kiorex marketplace, Kiorex Passport, Kiorly Clinic (+ Nurse edition), Kiorly Pharmacy, Kiorly Lab |
| **Shared stack** | NestJS 10, Prisma 6, PostgreSQL 16, React 18 + Vite + TanStack Query + shadcn/ui + Tailwind, i18next (AR/EN, RTL), Expo |
| **Integration** | HMAC REST + outbox webhooks (KX-09), Passport OIDC, feature-flag control plane, Kiorex Pay |
| **Truth rule** | Kiorly Clinic is the only system of record for appointments (ADR-005) |
| **Reference set** | Rev 2.4 (24 Nov 2026): 34 volumes KX-00 to KX-33, ADRs 001 to 047 (041 to 047 Proposed), contracts 1.11.0 |
| **Infra** | OpenTofu only (ADR-028); nothing deployed, no AWS deploy until the founder says so |
| **Providers** | Mock by default; real SMS, Email, WhatsApp, payments, consent, AI and storage adapters are built and need only URLs and credentials: [_docs/PROVIDER_GO_LIVE.md](_docs/PROVIDER_GO_LIVE.md) |

## Repositories

| Repo | Role | GitHub | Branch | Status | README |
|---|---|---|---|---|---|
| **kiorex-contracts** | OpenAPI, event schemas, flags, HMAC SDK (`@kiorex/contracts`) | [mshall/kiorex-contracts](https://github.com/mshall/kiorex-contracts) | `main` | :white_check_mark: 1.7.0 | [GitHub](https://github.com/mshall/kiorex-contracts#readme) |
| **kiorex-platform** | Kiorex API, patient web, Expo app, ops console, Kiorex Pay, control plane | [mshall/kiorex-platform](https://github.com/mshall/kiorex-platform) | `main` | :white_check_mark: built, pre-launch | [GitHub](https://github.com/mshall/kiorex-platform#readme) |
| **kiorex-account** | Kiorex Passport: IdP config-as-code, dev OIDC provider, OTP sender | [mshall/kiorex-account](https://github.com/mshall/kiorex-account) | `main` | :white_check_mark: dev complete | [GitHub](https://github.com/mshall/kiorex-account#readme) |
| **kiorly-clinic** (dir `clinics-management`) | Kiorly Clinic and Nurse edition; owns appointments; marketplace API + outbox | [mshall/clinics-management](https://github.com/mshall/clinics-management) | **`kiorex`** (never `main`) | :white_check_mark: built | [GitHub](https://github.com/mshall/clinics-management/tree/kiorex#readme) |
| **kiorly-pharmacy** | Pharmacy SaaS, Kiorex machine API | [mshall/kiorly-pharmacy](https://github.com/mshall/kiorly-pharmacy) | `main` | :construction: in progress | [GitHub](https://github.com/mshall/kiorly-pharmacy#readme) |
| **kiorly-lab** | Lab SaaS, Kiorex machine API, nurse sample custody | [mshall/kiorly-lab](https://github.com/mshall/kiorly-lab) | `main` | :construction: in progress | [GitHub](https://github.com/mshall/kiorly-lab#readme) |
| **kiorly** (app name **Kiorly**; repo being renamed to `kiorly`) | Mobile + web staff app (clinic, nurse, pharmacy, lab modules; role-scoped; Lite upgrade slice) | `mshall/kiorly` (private) | n/a | :white_check_mark: running, e2e per role | Expo web :8082 |
| **kiorex-workspace** (this folder) | Coordination: docs, brand, e2e, scripts | [mshall/kiorex-workspace](https://github.com/mshall/kiorex-workspace) | `main` | :white_check_mark: | you are here |

Kiorly Nurse is an **edition of Kiorly Clinic** (`Organization.edition = CLINIC | NURSE`, ADR-031), not a separate repo. `_legacy/*` holds the 2025 repos as read-only references (ADR-026). The product repos are separate nested git repos and are git-ignored by this workspace repo.

## How the products integrate

| Channel | Direction | What travels | Security |
|---|---|---|---|
| **HMAC REST** | Kiorex to Kiorly Clinic, Pharmacy, Lab | Holds, confirm (with `Idempotency-Key`), reschedule, cancel, orders, quotes | Per-client HMAC over timestamp, nonce, method, path, body hash |
| **Outbox webhooks** | Kiorly products to Kiorex | `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `OrderReady`, `LabResultReleased` ... | `X-Kiorly-Signature` over `ts.rawBody`, de-duplicated on `eventId` |
| **Passport OIDC** | Every app to Passport | Sign-in, tokens, session list | Auth code + PKCE, RS256 JWT, back-channel logout |
| **Feature flags** | Kiorex control plane to every product | Signed snapshot (ETag) every 30 s plus `flag.changed` push | HMAC product key; OFF gives `403 FEATURE_DISABLED` |
| **Kiorex Pay** | Inside Kiorex API | Deposits, refunds, payouts, ledger | Idempotency key + outbox + ledger + reconciliation |

```mermaid
sequenceDiagram
  autonumber
  participant P as Patient
  participant X as Kiorex API
  participant C as Kiorly Clinic
  participant Y as Kiorex Pay (mock PSP)
  P->>X: choose slot
  X->>C: HMAC hold (Idempotency-Key)
  X->>Y: deposit intent
  Y-->>X: captured
  X->>C: HMAC confirm (same key)
  C->>X: outbox webhook CONFIRMED
  X-->>P: confirmed, reminders scheduled
  C->>X: webhook COMPLETED
  X->>Y: release deposit to payable, weekly payout
```

<img src="docs/assets/booking-flow.svg" alt="One booking end to end" width="100%">

```mermaid
flowchart LR
  SA[Super admin<br/>Kiorex ops console] --> REG[Flag registry + gate evidence]
  REG --> SNAP[Signed snapshot<br/>GET /control/v1/flags/snapshot]
  SNAP --> KCf[Kiorly Clinic]
  SNAP --> KPf[Pharmacy]
  SNAP --> KLf[Lab]
  SNAP --> KXf[Kiorex API]
  REG -. push on change .-> KCf
  KCf --> E{Local evaluate<br/>any OFF wins}
  E -->|OFF| F403[403 FEATURE_DISABLED key + scope]
  E -->|ON| OK[Allowed]
```

Every capability ships ON and can be switched OFF at global, market or org scope (ADR-023). Launch-locked flags need gate evidence recorded by a human (ADR-024). **Safety controls are never flags** (ADR-025). Authoritative shapes and the exact local wiring: [INTEGRATION.md](INTEGRATION.md) and [kiorex-contracts](https://github.com/mshall/kiorex-contracts#readme).

## Screens

Real captures from the apps with synthetic data (English, light). More, including Arabic, dark and phone sizes, are in [`_docs/ui-review/`](_docs/ui-review) and [`_docs/UI_REVIEW.md`](_docs/UI_REVIEW.md).

| Kiorex patient web | Kiorex Expo app | Kiorex Passport |
|---|---|---|
| <img src="docs/assets/shots/kiorex-web.jpg" alt="Kiorex patient web" width="270"> | <img src="docs/assets/shots/kiorex-mobile.jpg" alt="Kiorex mobile" height="250"> | <img src="docs/assets/shots/passport.jpg" alt="Passport" width="270"> |

| Kiorly Clinic | Kiorly Nurse edition | Kiorly Pharmacy | Kiorly Lab |
|---|---|---|---|
| <img src="docs/assets/shots/kiorly-clinic.jpg" alt="Kiorly Clinic" width="215"> | <img src="docs/assets/shots/kiorly-nurse.jpg" alt="Kiorly Nurse" width="215"> | <img src="docs/assets/shots/kiorly-pharmacy.jpg" alt="Kiorly Pharmacy" width="215"> | <img src="docs/assets/shots/kiorly-lab.jpg" alt="Kiorly Lab" width="215"> |

## Ports and databases

| Service | Repo | Port | Database (Postgres :5433) |
|---|---|---|---|
| Kiorly Clinic API (`/api/v1`) | clinics-management | 3010 | `kiorly` |
| Kiorly Clinic web | clinics-management | 5174 | n/a |
| Kiorex API (`/api/v1`) | kiorex-platform | 4000 | `kiorex_platform` |
| Kiorex patient web | kiorex-platform | 5180 | n/a |
| Kiorex ops console / super admin | kiorex-platform | 5181 | n/a |
| Kiorex Expo (web + simulator) | kiorex-platform | 8081 | n/a |
| Kiorex Passport (dev OIDC, `/account`) | kiorex-account | 4400 | `kiorex_account` |
| Passport fake upstream IdP (federation tests) | kiorex-account | 4401 | n/a |
| Kiorly Pharmacy API / web | kiorly-pharmacy | 3100 / 5192 | `kiorly_pharmacy` |
| Kiorly Lab API / web | kiorly-lab | 3200 / 5193 | `kiorly_lab` |

:warning: Ports 3000 and 5173 belong to the founder's separate checkout and are never touched. Test databases end in `_test`. Connection pattern: `postgresql://postgres:postgres@127.0.0.1:5433/<db>?schema=public` (local development only).

## Start everything locally

Prerequisites: Apple Silicon Mac, Node 22 (contracts need 22+), Docker Desktop (optional), Postgres binaries, OpenTofu (for infra checks only). The workspace Postgres cluster lives in `.pgdata/` on port **5433**.

```bash
# 1. Postgres (workspace cluster)
PATH=/Users/postgres/bin:$PATH pg_ctl -D .pgdata -l .pgdata/server.log -o "-p 5433" start

# 2. One command: Passport, Kiorly Clinic, Kiorex API, Pharmacy, Lab (first time: build and seed)
e2e/scripts/up.sh --build --seed          # later: e2e/scripts/up.sh

# 3. Demo data in dependency order (idempotent)
scripts/seed-all.sh                       # add --reset to remove only the demo records first

# 4. Front ends (separate terminals)
(cd kiorex-platform && npm run dev -w apps/web)       # patient web :5180
(cd kiorex-platform && npm run dev -w apps/ops)       # ops console :5181
(cd clinics-management && npm run dev:web)            # Kiorly Clinic web :5174
```

```bash
e2e/scripts/down.sh                       # stop the stack (by port; never :3000)
cd e2e && npm test                        # cross-service E2E against the real running services
```

`e2e/scripts/up.sh` logs to `.e2e/logs` and records pids in `.e2e/pids`. Details and the scenario table: [e2e/README.md](e2e/README.md). All seeding helpers: [scripts/README.md](scripts/README.md).

<details>
<summary><b>Seed users, passwords and demo personas (pointer)</b></summary>

All demo data is synthetic (phones `+20100000xxxx`, e-mails `@demo.kiorex.test`) and DEV ONLY; the seeds refuse to run in production. The persona list, Passport phone logins, staff logins, OTP behaviour and ops TOTP setup are in **[TEST_DATA.md](TEST_DATA.md)** (cross-product index); each repo has its own `TEST_DATA.md`. Dev client keys and webhook secrets for local wiring are in [INTEGRATION.md](INTEGRATION.md). Rotate everything for staging and production.

**How to test everything, with every user and credential and the expected results: [TEST_GUIDE.md](TEST_GUIDE.md)** (run the stack, seed, URLs and ports, the DEV-only "Test users" sign-in panels, step-by-step flows). Every demo (what it is for, personas, data, manual test scripts, role checklists, limitations) is indexed in [DEMO_DATA.md](DEMO_DATA.md); each repo has its own `DEMO_DATA.md`.
</details>

## Standing rules

> :no_entry: **No tax-authority reporting.** No product integrates with, submits to or reports to any tax authority (no ETA e-invoicing, ZATCA, FTA or similar), in any market (ADR-011, KX-01, FD-02). VAT appears only as a configurable line on Kiorly's own invoices and printed payment records; businesses export CSV/PDF for their accountant. A repo test fails if code references such endpoints.

> :test_tube: **Providers are mocked.** Email, WhatsApp, SMS, push, PSPs (Paymob, Fawry, InstaPay), video, maps, OpenAI run on mock adapters (`MODE=mock`, default) that exercise the same code paths, until every other feature is verified. The real adapters (SMS, Email, WhatsApp, payments, consent, AI, storage) are now built in every product and are switched on by env only: see [_docs/PROVIDER_GO_LIVE.md](_docs/PROVIDER_GO_LIVE.md). Staging first; no real credentials in code.

| Rule | Detail |
|---|---|
| No shared DB, no cross imports | Products talk over contracts only |
| Appointments | Kiorly Clinic is the only system of record |
| Money paths | Idempotency key, outbox event, ledger entry, reconciliation test; three ledgers never commingled |
| Flags | Capabilities ship ON; safety controls are never flags |
| IaC | OpenTofu only; `tofu fmt` and `validate` locally; **never deploy to AWS** without the founder |
| Branches | `clinics-management` works on `kiorex`, never `main`, and is never pushed without approval (a push there used to deploy) |
| Data | No PHI in logs or analytics; no secrets, `.env` or build output in git; Arabic + English strings, RTL verified |
| Commits | Conventional Commits with requirement IDs, for example `feat(booking): KXM-BK-03 idempotent confirm` |
| Ask a human | Prices, fees, VAT, refunds; legal or clinical wording; marking a launch gate satisfied; production credentials, domains, store or PSP accounts; breaking a published contract |

## Decisions

Open founder and human decisions are in one table: **[_docs/FOUNDER_DECISIONS.md](_docs/FOUNDER_DECISIONS.md)** (FD-01 to FD-20: launch gates, real provider credentials, nurse pricing, branding, AWS, pushes). The software always has a safe default, no launch gate is ever recorded by code, and every repo lists its own items in `Docs/NEEDS_HUMAN.md`.

## Brand

Indigo `#3730A3`, Ocean `#0369A1`, Coral pulse `#E8735E`, Ground `#F4F6FC`. The mark is two facing chevrons (indigo and ocean) with a coral ECG pulse through the centre. Never redraw it: use the SVGs and components in [`_brand/`](_brand/README.md).

<div align="center">
<img src="docs/assets/kiorex-mark.svg" alt="Kiorex mark" height="56">&nbsp;&nbsp;&nbsp;<img src="docs/assets/kiorex-wordmark.svg" alt="Kiorex wordmark" height="40">&nbsp;&nbsp;&nbsp;<img src="docs/assets/kiorex-app-icon.svg" alt="Kiorex app icon" height="56">
</div>

## Folder map

```text
kiorex-v2/
├── CLAUDE.md             permanent context for any build agent (read first)
├── INTEGRATION.md        local wiring: ports, clients, webhooks, flags, vertical partners
├── TEST_GUIDE.md         how to run, seed and test every flow with every test user (DEV ONLY)
├── TEST_DATA.md          synthetic QA data index (DEV ONLY)
├── _brand/               logo SVGs, tokens, Tailwind preset, RN theme, favicons (README inside)
├── _docs/                KX-00..KX-23 older extracts, rev23/ (current, KX-00..KX-33), DOCS_SYNC_MANIFEST.md, FOUNDER_DECISIONS.md, UI review, autopilot  (README inside)
├── docs/                 this README's INDEX and images (assets/)
├── e2e/                  cross-service end-to-end suite and stack scripts
├── scripts/              seed-all, seed-staging, push-all, ops-sync                          (README inside)
├── kiorex-contracts/     (nested repo)  contracts and SDK
├── kiorex-platform/      (nested repo)  Kiorex API + web + ops + mobile
├── kiorex-account/       (nested repo)  Kiorex Passport
├── clinics-management/   (nested repo, branch kiorex)  Kiorly Clinic + Nurse
├── kiorly-pharmacy/      (nested repo)  Kiorly Pharmacy
├── kiorly-lab/           (nested repo)  Kiorly Lab
└── _legacy/              2025 repos, read-only references (ADR-026)
```

## Deployment overview

```mermaid
flowchart LR
  DEV[Local: native Postgres :5433 + Node] --> CI[GitHub Actions per repo<br/>lint, test, gitleaks]
  CI --> STG[Staging cell, Frankfurt<br/>after a human deploys]
  STG --> PRD[Production cell, Frankfurt<br/>founder approval]
  TF[OpenTofu live stacks<br/>validated locally only] -. provisions .-> STG
  TF -. provisions .-> PRD
```

Nothing is deployed; each repo carries `infra/tofu/` for staging and prod. See KX-21 and each repo's `infra/README.md`.

## Security notes

- Synthetic data only in this workspace; seeds guard against production (`DEMO_SEED_ALLOWED` and a non-production check).
- Every cross-product call is signed (HMAC) and replay-protected; every webhook is verified on the raw body and de-duplicated.
- Tokens carry no clinical data and no addresses (ADR-013); PHI never appears in logs or analytics.
- `.env`, secrets and build output are git-ignored; each repo runs gitleaks in CI. Dev defaults in docs are local only and must be replaced in any shared environment.

## Where to read next

| Read | For |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Permanent brief: rules, repos, brand, local environment |
| [INTEGRATION.md](INTEGRATION.md) | Ports, clients, webhooks, flags, Passport, vertical partners, nurse lab flow |
| [TEST_GUIDE.md](TEST_GUIDE.md) | Step-by-step test guide: run, seed, URLs, users, flows, expected results |
| [TEST_DATA.md](TEST_DATA.md) | Synthetic personas and logins |
| [docs/INDEX.md](docs/INDEX.md) | Index of the workspace docs |
| [_docs/README.md](_docs/README.md) | Map of the 24 reference volumes and reports |
| [_docs/FOUNDER_DECISIONS.md](_docs/FOUNDER_DECISIONS.md) | Open human decisions |
| [_docs/CHANGES_2.2_to_2.3.md](_docs/CHANGES_2.2_to_2.3.md) | What changed in Rev 2.3 |
| [kiorex-contracts/docs/NOTIFICATION_LAYER.md](kiorex-contracts/docs/NOTIFICATION_LAYER.md) | Shared notification layer above the SMS / Email / WhatsApp / Push / in-app adapters (`@kiorex/contracts/notify`, 1.7.0): intents, templates, routing, consent, status model, migration order |
| [e2e/README.md](e2e/README.md) | Cross-service E2E scenarios |
| [scripts/README.md](scripts/README.md) | Seeding and helper scripts |
| [_brand/README.md](_brand/README.md) | Brand kit and vendoring |
| Repo READMEs | [contracts](https://github.com/mshall/kiorex-contracts#readme) · [platform](https://github.com/mshall/kiorex-platform#readme) · [account](https://github.com/mshall/kiorex-account#readme) |

Reading order for a build agent: KX-22, KX-01, KX-08, KX-09, KX-21, KX-10, the product PRD (KX-03 Kiorex, KX-04 Account, KX-05 Clinic, KX-06 Pharmacy, KX-07 Lab, KX-23 Nurse), KX-16, KX-17/18.

## Contributing

Work in the repo that owns the change; keep contracts first (change `kiorex-contracts` before producers and consumers, bump the version, then re-pin). Use branches and Conventional Commits with requirement IDs. Do not push `clinics-management` `kiorex` without founder approval, do not deploy, and do not add tax-authority integrations. Update `_docs/FOUNDER_DECISIONS.md` and the repo's `NEEDS_HUMAN` file instead of inventing prices, legal text or gate evidence.

## Glossary

| Term | Meaning |
|---|---|
| **KX-nn** | Numbered reference volume (KX-00 to KX-33) |
| **ADR** | Architecture decision record (001 to 032) |
| **Outbox** | Same-transaction event table delivered at least once to another system |
| **HMAC** | Keyed hash that signs every cross-product request and webhook |
| **Hold** | Temporary slot reservation before payment and confirm |
| **Control plane** | Kiorex super admin and registry that owns feature flags |
| **Launch gate** | Human-recorded evidence that unlocks a launch-locked flag |
| **Edition** | Variant of a product (Kiorly Clinic vs Kiorly Nurse) in the same codebase |
| **Passport** | Kiorex Passport, the shared OIDC identity |
| **Kiorex Pay** | Kiorex's deposit and payout ledger |

<div align="center"><sub>Private workspace repository (mshall/kiorex-workspace). Brand: Indigo, Ocean, Coral.</sub></div>
