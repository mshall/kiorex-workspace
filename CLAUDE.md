# Kiorex v2 workspace — permanent context

> ## ⛔ NO TAX-AUTHORITY REPORTING — founder decision, reaffirmed 19 Nov 2026 (ADR-011, KX-01, FD-02)
> **No product in this ecosystem integrates with, submits to, or reports to any tax authority** (no Egyptian ETA e-invoicing/e-receipt, no ZATCA, no FTA, nothing similar — in any market).
> Clinics, doctors, pharmacies and labs are independent businesses that file their **own** taxes with their **own** systems.
> What products MAY do: show configurable VAT/tax lines on Kiorly's own SaaS invoices and on printed payment records (market-pack config), and export data (CSV/PDF) so a business can hand it to its accountant.
> What products MUST NOT do: any tax-authority API client, signing certificate/e-seal handling, UUID submission, fiscal-device integration, or "tax compliance status" UI. Do not add them, do not stub them, do not plan them.
> A repo test (`no-tax-authority.node.test`) must fail if code references ETA/e-invoice submission endpoints.

> ## 📘 Reference set is now Rev 2.3 (20 Nov 2026) — 24 volumes KX-00…KX-23
> Current extracts: `_docs/rev23/`; what changed vs the old extracts: `_docs/CHANGES_2.2_to_2.3.md` (read its backlog before building). ADRs now 001…032. **Kiorly Nurse (KX-23) is an EDITION of Kiorly Clinic, not a new repo** (`Organization.edition = CLINIC | NURSE`, ADR-031) — never create a `kiorly-nurse` repo; built inside clinics-management with nurse.kiorly.com as an alias. New: professions & scope of practice (ADR-029, `@RequiresScope`, 403 `SCOPE_NOT_ALLOWED`), home visits (ADR-030, Kiorex `KXMHV*`), solo vs agency nurses (ADR-032), shared package `@kiorly/field-visit`, physio pack. Founder decisions still win over doc wording: product name stays **Kiorex Passport** and the logo/palette in `_brand/` stays (KX-19 still says otherwise — flagged, not resolved). Nurse plan prices, Arabic Nurse name (Q12), gates GHV1/2, GPR1/2, GKN1/2 and all counsel/CMO sign-offs are NEEDS_HUMAN — use placeholders, never record a gate.

> ## 📈 Growth & Patient Acquisition Engine — documented 24 Nov 2026, PROPOSED (not yet signed)
> Volumes `_docs/rev23/KX-27..KX-33` (PRD, architecture, Egypt GTM, attribution/commission, SEO/ASO, analytics definitions, roadmap and agent hand-off); ADR-041..047 are **Proposed** in KX-01; source reports in `_docs/growth/`. Every statement is labelled As-built / Approved target / Proposed / Roadmap / Open decision / Regulatory dependency: believe only As-built. Rules: no new service, Redis or Kafka; provider-led bookings never carry the EGP 40 fee and evidence can only remove a fee, never add one; no PHI, no health targeting, no patient identifiers to ad platforms; consent-gated visitor key; marketing launch-locked until counsel signs; integrations MOCKED. Work packages `GRW-P1-A..M` have single owners for shared files (KX-33 §03); ADR-039 is not found in the repo set (verify in Drive).

> ## 🧪 Messaging & provider integrations are MOCKED for now — founder decision, 19 Nov 2026
> Email, WhatsApp, SMS, push, PSPs (Paymob/Fawry/InstaPay), video (telemedicine), maps, OpenAI and any other third-party provider run on **dummy/mock adapters** (log + DB "dev inbox", deterministic fake data) until every other feature is verified. Real providers are wired **before launch**, in a dedicated pass, in staging first.
> Rules: every integration sits behind an adapter interface with `MODE=mock|real` (default `mock`); mocks must exercise the same code paths (templates rendered, consent checked, delivery states, webhooks/callbacks simulated); no real credentials in code; list each real-provider task in `Docs/NEEDS_HUMAN.md` under "Provider go-live" with required keys/templates.

Read this before working in any repo under this folder. It is the condensed brief of the 23 Kiorex v2
reference documents (KX-00…KX-22, Drive folder "Kiorex v2"), extracted to `_docs/`.

> ## 📱 Staff app name is FINAL: **Kiorly** (founder, 23 Nov 2026, App Store checked; ADR-037 supersedes the naming in ADR-033)
> Earlier names Kiorly Work, Kiorly Team and `kiorly-app` are retired. Display name **Kiorly**; store title **Kiorly: Clinic, Pharmacy & Lab**; "by Kiorex" only on the splash and About, never in the icon label or the store name; icon = Kiorex mark with the Kiorly accent (not a product colour); modules inside: Clinic, Nurse, Pharmacy, Lab. Web products keep their `Kiorly Clinic by Kiorex` lockups. Identifiers: bundle id `com.kiorly.app`, scheme `kiorly`, header `X-Kiorly-Client: kiorly/<version>` (legacy `kiorly-team/*` and `kiorly-work/*` still accepted), Arabic **كيورلي**. The repo folder is still `kiorly-team` until the lead renames it to `kiorly`. Apple/Google registration and the Passport client are NEEDS_HUMAN.

> ## 🌍 Country/market selectors are HIDDEN while one market is live (founder, 23 Nov 2026)
> Egypt is the only launch market. Every country/market selector (Kiorex patient web header, ops flag market filter, Passport org-create country, Kiorly Clinic sign-up, rep console and platform tenant-create) renders nothing unless MORE THAN ONE market is live (`market.<cc>.live`; Passport uses `VITE_MARKETS`, default `EG`). One market fixes the value to EG, phone `+20`, EGP. The API stays multi-market. Rule helpers: `marketVisibility.ts` (platform web/ops), `market-selector-policy.ts` (Clinic), `util.ts` (Passport).

## What we are building
One ecosystem, two brands, four products (KX-00, ADR-001/002):
- **Kiorex** (patients, company) — patient marketplace: discovery, booking against Kiorly's live slots,
  Kiorex Pay deposits, verified reviews, family accounts, consent, record vault; ops console + super admin
  with the **feature-flag control plane**. Domain kiorex.com.
- **Kiorex Passport** — shared OIDC identity (founder naming, 19 Nov 2026: the product is called Kiorex Passport everywhere; the repo/product key keep the technical name `kiorex-account`), patients first, phone OTP, passkeys. account.kiorex.com.
- **Kiorly Clinic / Lab / Pharmacy by Kiorex** (provider SaaS; lockup text is always "Kiorly <Product> by Kiorex", each works without Kiorex): Kiorly Clinic (built), Kiorly Pharmacy (M9),
  Kiorly Lab (M15). kiorly.com / app.kiorly.com / kiorly.link.

## Repositories (KX-22 / KX-08) — this folder is the parent
| Dir | GitHub | Branch | Role |
|---|---|---|---|
| clinics-management | mshall/clinics-management | **kiorex** (never main) | Kiorly Clinic; owns appointments; HMAC marketplace API + outbox; publishes @kiorly/commerce-kernel |
| kiorex-contracts | mshall/kiorex-contracts | main | OpenAPI + event JSON Schemas + TS SDK + contract tests (@kiorex/contracts) |
| kiorex-platform | mshall/kiorex-platform | main | Kiorex API (NestJS modular monolith), patient web, Expo app, ops console/super admin, flag control plane, Kiorex Pay, AI gateway |
| kiorex-account | mshall/kiorex-account | main | IdP config-as-code (managed IdP in AWS), dev OIDC provider for local, OTP sender, back-channel logout |
| kiorly-pharmacy | mshall/kiorly-pharmacy | main | Scaffold only until M9 (KX-06) |
| kiorly-lab | mshall/kiorly-lab | main | Scaffold only until M15 (KX-07) |
| kiorly | mshall/kiorly (private) | main | **Kiorly** (the staff app; repo `kiorly`): one Expo staff app (Clinic, Nurse, Pharmacy, Lab modules) for Pro/Enterprise plans; safety alerts reach every plan (ADR-025). Expo web :8082. Backends: `/mobile/*` in the three product APIs |
| _legacy/* | 2025 kiorex-* repos | — | READ-ONLY references (ADR-026). Harvest UI from kiorex-web-app only; never copy kiorex-backend code |
| _docs/ | — | — | Extracted KX docs (some numeric cells lost in extraction — check the PDF in Drive when exact numbers matter) |
| _brand/ | — | — | Kiorex logo concept, mark SVG, tokens.css |

## Binding rules (KX-01, KX-22 §11)
- Stack (upgraded 20 Nov 2026, see `_docs/UPGRADE_2026-11_REPORT.md`): Node.js 26 LTS (Lambda stays `nodejs24.x` until Node 26 is GA there), NestJS 12 (Express 5) + Prisma 7 (`@prisma/adapter-pg`, pool size explicit, see report) + PostgreSQL 16, React 19 + Vite 8 + TanStack Query + shadcn/ui + Tailwind 4 + i18next 27 (AR/EN, RTL), TypeScript 6, Expo for mobile. Same as Kiorly.
- Products never share a DB or import each other's source; they talk over HMAC REST + outbox webhooks (KX-09), via versioned contracts.
- Kiorly Clinic is the ONLY system of record for appointments (ADR-005). Kiorex books via holds + Idempotency-Key.
- Money paths: idempotency key, outbox event, ledger entry, reconciliation test. Three ledgers never commingled.
- Every capability ships ON, switchable OFF from Kiorex super admin at global/market/org scope (ADR-023); launch-locked flags effective only with gate evidence (ADR-024); **safety controls are never flags** (ADR-025). OFF ⇒ 403 FEATURE_DISABLED {key,scope}, never hides data.
- IaC = **OpenTofu** only (ADR-028), `infra/tofu/` layout from KX-21 §01; no CDK/CloudFormation for new infra; no `@aws-sdk/*` outside `src/platform/adapters/*`.
- No PHI in logs/analytics; Arabic + English strings; RTL verified; no secrets/.env/build output in git.
- Conventional Commits with requirement IDs (e.g. `feat(booking): KXM-BK-03 idempotent confirm`).
- Stop and ask a human for: prices/fees/VAT/refund policy not specified; legal/clinical/consent wording; marking a launch gate satisfied; production credentials, domains, store accounts, PSP onboarding, AWS account changes; breaking a published contract.
- **Do not deploy to AWS** until the founder says so. `tofu validate`/`fmt` locally only.
- **Never push clinics-management `kiorex`** without founder approval: `.github/workflows/deploy-aws-kiorex.yml` deployed on push to that branch (being changed to manual-only).

## Brand (Kiorex) — FINAL founder artwork, 20 Nov 2026 (replaces the earlier rough mark)
Assets in `_brand/`: `kiorex-mark.svg` (two facing chevrons — indigo ">" and ocean "<" — with a coral ECG pulse line through the centre), `kiorex-wordmark.svg` (KIOREX in Jost Medium, wide tracking, "KIOREX" in Indigo with the final X in Ocean; outlined glyph paths), `kiorex-logo-lockup.svg` (mark | thin coral vertical rule | wordmark), `kiorex-app-icon.svg` (indigo→ocean gradient tile, white chevrons, coral pulse). Founder source images: `_brand/kiorex-logo-concept*.png`.
Colours: Ink/Indigo `#3730A3`, Ink 2/Ocean `#0369A1`, Pulse/Coral `#E8735E`, Ground `#F4F6FC`. **Product accents (founder, 20 Nov 2026):** each Kiorly product recolours the right chevron of the mark and the `Y` of `KIORLY` and the ENTIRE product word (Clinic / Lab / Pharmacy) — Clinic Teal `#0D9488`, Lab Violet `#7C3AED`, Pharmacy Green `#16A34A` (dark/inverse `#2DD4BF` / `#A78BFA` / `#4ADE80`; AA text variants `#0F766E` / `#6D28D9` / `#15803D`); tokens `--kx-product-*`. Nurse (edition of Clinic) keeps Nurse Rose; Passport keeps Ocean. Lockups read `Kiorly Clinic by Kiorex`, `Kiorly Lab by Kiorex`, `Kiorly Pharmacy by Kiorex`; details in `_brand/README.md`. **Kiorly (staff app, Kiorly Home) mark, 24 Nov 2026: Indigo `#3730A3` + Periwinkle `#818CF8` chevrons, coral pulse (inverse: white + `#A5B4FC`); Kiorex stays Indigo + Ocean.** Never redraw the logo by hand — always use the SVG assets. UI bar: high-end, award-winning, professional (see _docs/autopilot/Q11_brand_and_ux_polish.md).

## Local dev environment (this Mac)
- Apple Silicon, no Homebrew. Docker Desktop (arm64, 29.x) now installed and running — containers available (e.g. Keycloak, Playwright images, LocalStack) but the shared Postgres stays native on 5433.
- Postgres 18 binaries in `/Users/postgres/bin`. Workspace cluster: `kiorex-v2/.pgdata`, **port 5433**, user/pass `postgres/postgres`.
  DBs: kiorly, kiorly_test, kiorex_platform, kiorex_platform_test, kiorex_account.
  Start: `PATH=/Users/postgres/bin:$PATH pg_ctl -D .pgdata -l .pgdata/server.log -o "-p 5433" start`
- OpenTofu 1.13.9 at `~/.local/bin/tofu`. npm workspaces (no pnpm).
- Ports: Kiorly API 3010 · Kiorly web 5174 (3000/5173 = founder's other checkout, never touch) · Kiorex API 4000 · Kiorex web 5180 · Kiorex Passport (dev OIDC) 4400 · Expo 8081.
- AWS profile `aws-kiorex-profile` (account 599243104052, eu-central-1, user cursor-admin). Org SCPs deny many reads
  (CloudFormation, App Runner, RDS, S3 list) — plans against the live account will need the SCPs relaxed by the org admin.

## Reading order for a build agent
KX-22 → KX-01 → KX-08 → KX-09 → KX-21 → KX-10 → product PRD (KX-03 Kiorex · KX-04 Account · KX-05 Clinic · KX-06 Pharmacy · KX-07 Lab) → KX-16 → KX-17/18.
