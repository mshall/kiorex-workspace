# KX08 — Target Architecture & Repository Design

Source: 1aN7N1aRgcP0lsghQMxmWoAbm0ysIjPR0

Systems, containers, repositories, data ownership and deployment topology for the decoupled Kiorex ecosystem — starting from what Kiorly already runs in production.

Authored in the role of Chief Software Architect. Owns service boundaries, technology choices and the path from today's code to the target state.

Tags: C4 views · 6 repositories · Modular monoliths · Commerce kernel package · Feature-flag control plane · Cells & scaling

| Field | Value |
|---|---|
| DOCUMENT | KX08 (03 — Technical documents) |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Engineering, Cursor sessions, technical due diligence |
| OWNER ROLE | Chief Software Architect |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026 |

## Contents

01 Architecture drivers · 02 System context (C4 level 1) · 03 Containers (C4 level 2) · 04 Repository plan · 05 Commerce kernel (ADR-004) · 06 Kiorex platform internal design · 07 Deployment topology · 08 Feature-flag control plane (ADR-023) · 09 Feature-flag catalogue · 10 Scaling path

## 01 Architecture drivers

What the design must optimize for, in order.

| # | Driver | Architectural response |
|---|---|---|
| 1 | Provider SaaS must keep working when Kiorex fails | Separate deployables, databases and failure domains; async events; no synchronous Kiorex dependency in Kiorly critical paths |
| 2 | Small team, fast delivery | Modular monoliths per product (NestJS, enforced module boundaries), shared kernel by package, one cloud (AWS) |
| 3 | Money correctness | Idempotency keys, transactional outbox, immutable charges, idempotent settlement, property-based tests |
| 4 | Clinical safety & privacy | Per-product authorization, consent enforcement in code, PHI-free logs, encryption, audit |
| 5 | Multi-market by configuration | Market packs, data-cell registry, per-market provider adapters |
| 6 | Cost discipline | App Runner + RDS, no NAT gateways, CloudFront single origin per product, scale-to-need |

## 02 System context (C4 level 1)

Figure 1 — External actors and systems.

- Patients (web · iOS · Android)
- Providers (doctors · pharmacists · labs)
- Kiorex (marketplace) — HMAC API + webhooks to the Kiorly suite (Clinic · Pharmacy · Lab)
- Kiorex Account (OIDC)
- Payment providers (Paymob · Fawry · InstaPay)
- Meta WhatsApp (templates · inbound)
- AI providers (OpenAI EU · self-hosted)
- AWS (SES · S3 · KMS — email · files · keys)

## 03 Containers (C4 level 2)

Figure 2 — Container view; each product owns its API, database, storage and dispatcher.

- Experience: Kiorex app (Expo RN), Kiorex web (React), Kiorly web/PWA (React+Vite), Pharmacy POS PWA, Lab console PWA, Ops console
- Edge: CloudFront + WAF per product (kiorex.com · kiorly.com; /api/* → API origin)
- Product APIs: kiorex-platform API, clinics-management API, kiorly-pharmacy API, kiorly-lab API
- Shared: Kiorex Account IdP, @kiorly/commerce-kernel (pkg), kiorex-contracts (OpenAPI/events)
- Async: Outbox dispatchers (per product), HMAC webhooks, Schedulers (settlement, dunning, trials)
- Data: RDS Postgres per product, S3 per product, OpenSearch (Kiorex search, M9), Redis (slot/session cache, as needed)

## 04 Repository plan

Six repositories. One per product plus identity and contracts; the kernel ships as a package from Kiorly.

| Repository | Contents | State today | Action |
|---|---|---|---|
| mshall/clinics-management | Kiorly Clinic API + web + docs + infra (CDK → OpenTofu) | Production-ready | Keep. Publish @kiorly/commerce-kernel from packages/ |
| kiorex-platform (new) | Marketplace API (NestJS modular monolith), web, Expo app, ops console + super admin, feature-flag control plane, infra | Create new | New repo from Kiorly skeleton; harvest patient UI from kiorex-web-app; no code from kiorex-backend; archive 2025 repos (KX22) |
| kiorly-pharmacy (new) | Pharmacy API + POS PWA + infra | Planned M9 | Scaffold from Kiorly template; consume kernel |
| kiorly-lab (new) | Lab API + console + phlebotomist app + infra | Planned M15 | Scaffold from template; ASTM/HL7 adapters |
| kiorex-account (new) | IdP configuration-as-code, themes, OTP sender lambdas, back-channel logout | Planned M1 | Managed IdP; no custom crypto |
| kiorex-contracts (new) | OpenAPI specs, JSON Schemas for events, generated TS SDKs, contract tests | Extract | Move marketplace.openapi.json + consumer contract here; both CIs pin versions (NH019) |

NOTE: The 2025 repositories kiorex-backend, kiorex-web-app, kiorex-ai-services and kiorex-backend-documentation were assessed on 19 Nov 2026 as prototypes and references only. Keep / harvest / archive decisions, the full repo map and the build-agent brief are in KX22.

### Standard repository layout

```
<repo>/
  apps/api/        NestJS modular monolith (bounded contexts as modules, *-public.ts façades)
  apps/web/        React + Vite + TanStack Query + shadcn/ui + i18next (EN/AR, RTL)
  apps/mobile/     Expo React Native (Kiorex only, later Kiorly field apps)
  packages/        shared libs (e.g. commerce-kernel in clinics-management)
  infra/tofu/      OpenTofu: modules/aws/* behind cloud-neutral contracts, product-stack, live/<env>/<cell>/<product> (ADR-028)
  Docs/            product docs, runbooks, ADR references, market packs
  .cursor/rules/   repo rules for autonomous build sequences
  .github/workflows/  ci-test-reusable, deploy-aws (OIDC role), pr-synth-build
```

## 05 Commerce kernel (ADR-004)

The most valuable reusable asset in Kiorly — reused, not re-invented, by Pharmacy and Lab.

| Kernel module | From Kiorly step | Responsibility | Consumers |
|---|---|---|---|
| plans & prices | PL01, SB06 | Versioned per-market price catalog, cohorts, grandfathering, indexation | Clinic, Pharmacy, Lab |
| entitlements | PL03/04 | Resolve plan ⊕ trial ⊕ overrides; guards; limits | All |
| subscriptions & trials | PL02, CR01, PL07 | Lifecycle, activation rules, proration | All |
| credit wallet | CR05 | Immutable ledger, FIFO expiry, grants | All |
| settlement | CR06, SB05 | max(S, C), trial policies, Lite minimum invoice, carry-forward, VAT | All (C = commissions/order fees) |
| dunning | SB03 | Config timeline, access guard that never blocks records | All |
| market packs | FD00, PA02 | Currency, tax, payment methods, data cell, commercial config | All + Kiorex |

RULE: The kernel is a library with its own semver and test suite (QA03 matrix travels with it). Each product keeps its own database tables for these models — no shared billing database.

## 06 Kiorex platform internal design

A modular monolith with bounded contexts mirroring Kiorly's discipline.

| Context | Responsibilities | Data owned |
|---|---|---|
| Catalog & search | Provider projection from Kiorly sync + events; search index; ranking | Provider projections (with source version) |
| Booking orchestration | Intent, holds, idempotent booking calls, state machine, reconciliation job | Booking intents, correlation IDs |
| Kiorex Pay | Deposits, refunds, payouts, PSP adapters, ledger, reconciliation | Payment ledger, payouts |
| Engagement | Notifications (WhatsApp/push/email), reminders, review invitations | Message log, consents |
| Trust | Reviews, moderation, complaints | Reviews (source of truth) |
| Patient | Profiles, family, consent centre, record vault (shares) | Patient profile, shares |
| Ops | Admin console, dashboards, dispute and support tooling | Ops notes, audit |

## 07 Deployment topology

Product stack in the market's data cell (Egypt: frankfurt, eu-central-1).

Figure 3 — Per-product stack, identical across products (OpenTofu product-stack module, KX21 §01):

CloudFront + WAF (kiorly.com / kiorex.com) → S3 SPA assets (SPA) and /api/* → App Runner API (autoscale, VPC connector) → RDS PostgreSQL 16 (Multi-AZ, PITR); S3 uploads (KMS); Secrets Manager / KMS; CloudWatch + alarms (logs/metrics) → on-call webhooks; VPC endpoints.

| Environment | Purpose | Data |
|---|---|---|
| local | Docker Postgres, seeded demo tenants | Synthetic |
| staging (KIORLY_ENV=staging) | WhatsApp sandbox, payment sandboxes, pilot rehearsal | Synthetic + demo:reset ≤ 60 s |
| production | Live tenants per cell | Real; PITR + quarterly restore drill |

## 08 Feature-flag control plane (ADR-023)

Everything that is built ships to production enabled by default. The Kiorex super admin can switch any capability off — globally, per country or per organization — without a deploy.

Key figures:

- Default for every flag: ON (unless launch-locked)
- Scopes: 3 (global · market · organization)
- Change mechanism: toggle + reason; flag.changed signed snapshot; org-adjustable only for organization-scope flags
- Propagation: ≤ 60 s (push ≤ 30 s pull)
- Safety controls behind flags: 0 (never switchable)

Figure — One registry, evaluated locally in every product. Products never call the control plane per request.

Kiorex super admin (ops.kiorex.com · SSO + MFA) → Flag control plane (kiorex-platform · registry · audit) → Registry DB (definitions · values · gates) → local snapshot + evaluator in Kiorly Clinic, Kiorly Pharmacy, Kiorly Lab, Kiorex apps & API. Org admins toggle their own org only.

### How the effective value is computed

1. Global — default ON
2. Market — inherit / off
3. Organization — inherit / off
4. Plan entitlement — 402 if not in plan
5. Gate evidence — launch-locked only
6. Dependencies — parent flags ON
7. Effective — ON / OFF

| Rule | Detail |
|---|---|
| Default | Every flag defaults ON at every scope. A missing row means 'inherit', and the root inherits ON. |
| Any OFF wins | OFF at global, market or organization makes the capability OFF for everything beneath it. A lower scope cannot re-enable what a higher scope turned off. |
| Plan still applies | A flag says the capability is *available*; the plan says the customer *paid* for it. Effective = flag ∧ entitlement (@RequiresEntitlement, HTTP 402). |
| Launch-locked flags | Default ON, but effective only after the gate evidence is recorded in the super admin (gate ID, approver, date, document link). The panel shows 'ON · awaiting gate'. |
| Dependencies | A child flag is effective only if its parents are (e.g. clinic.commission_settlement needs clinic.kiorex_listing and kiorex.marketplace). |
| Who may toggle | Kiorex super admin: every flag, every scope, every product. Organization admins: only flags marked organization-scope, only for their own organization. |

### What 'OFF' must do — universal contract

- Never deletes or hides data: records stay viewable, printable and exportable.
- Stops new actions only: entry points hidden; APIs return 403 FEATURE_DISABLED {key, scope}; UI shows 'temporarily unavailable' in AR/EN.
- Honours what is in flight: confirmed bookings, paid deposits, accepted orders and booked collections complete or are refunded per policy.
- Money stays consistent: charges already CONFIRMED still settle; new charges stop; settlement re-runs remain idempotent.
- Reversible: turning a flag back ON restores the capability with no migration.

### Distribution and resilience

| Concern | Design |
|---|---|
| Delivery | Signed snapshot per product (GET /control/v1/flags/snapshot?product=, ETag, 30 s poll) + HMAC flag.changed webhook for immediate refresh |
| Evaluation | In-process from the product's persisted snapshot — no network call per request; Kiorly's FeatureFlagsService becomes the evaluator |
| Control plane down | Fail-static: keep last-known snapshot. A fresh deploy with no snapshot uses code defaults: ON, except launch-locked → OFF until a snapshot confirms the gate |
| Audit | Every change: actor, scope, old → new, reason, ticket, expiry; streamed to each product's audit log |
| Safety net | Optional expiry on any OFF ('disable for 2 hours'); scheduled toggles for planned maintenance |
| Two-person rule | Global or market OFF of a money-path flag needs a second approver; an emergency kill by one admin is allowed and auto-reviewed within 24 h |

## 09 Feature-flag catalogue

Every capability that can be switched off from the Kiorex super admin. All default ON. Scopes: G global · M market · O organization.

| Key | Product | Scopes | Class | When OFF | Depends on / gate |
|---|---|---|---|---|---|
| clinic.kiorex_listing | Kiorly Clinic | G M O | Module | Listings PAUSED on Kiorex; confirmed bookings honoured; booking link still works | kiorex.marketplace |
| clinic.commission_settlement | Kiorly Clinic | G M | Commercial | New commission charges stop; invoices = subscription only; confirmed charges still settle | clinic.kiorex_listing |
| clinic.kiorly_pay_deposits | Kiorly Clinic | G M O | Commercial | No new deposit requirements or links; existing deposits refund/convert per policy | — |
| whatsapp_reminders | Kiorly Clinic | G M O | Integration | Reminders stop; manual call list shown | — (existing key) |
| clinic.whatsapp_inbound | Kiorly Clinic | G M O | Integration | Replies no longer change appointments; routed to inbox | whatsapp_reminders |
| instapay · fawry · card_payments | Kiorly Clinic | G M O | Integration | Method hidden at cashier; cash and other methods remain | — (existing keys) |
| ai_assistant | Kiorly Clinic | G M O | AI | Widget hidden; chat returns 403 | — (existing key) |
| clinic.ai_scribe | Kiorly Clinic | G M O | AI | Record button hidden; signed notes unaffected | — |
| clinic.whatsapp_ai_receptionist | Kiorly Clinic | G M O | Launch-locked | Inbound messages go to human inbox | clinic.whatsapp_inbound · gate: Meta approval + consent copy |
| clinic.no_show_risk | Kiorly Clinic | G M O | AI | Risk chip hidden | — |
| clinic.waitlist_autofill | Kiorly Clinic | G M O | Module | Waitlist kept; no automatic offers | whatsapp_reminders |
| clinic.record_share_patient_app | Kiorly Clinic | G M O | Module | No new shares; existing shares stay visible to the patient | kiorex.record_vault |
| clinic.eprescription_handoff | Kiorly Clinic | G M O | Module | Rx printed / WhatsApp only | pharmacy.module |
| clinic.lab_order_handoff | Kiorly Clinic | G M O | Module | Lab orders kept as records only | lab.module |
| clinic.payers_tpa | Kiorly Clinic | G M O | Module | Contract prices kept; no new claims | — |
| clinic.specialty_templates.<code> | Kiorly Clinic | G M | Launch-locked | Template hidden from new encounters | gate: specialty board sign-off (NH010) |
| clinic.referral_rewards | Kiorly Clinic | G M | Commercial | No new codes; earned credits honoured | — |
| clinic.field_rep_onboarding | Kiorly Clinic | G M | Commercial | Rep codes rejected at signup; earned commissions honoured | — |
| kiorex.marketplace | Kiorex | G M | Module | Search shows clinic phone only; no new bookings; existing bookings honoured | — |
| kiorex.pay_deposits | Kiorex | G M | Commercial | Deposit-required visit types bookable without deposit or hidden (per market setting) | kiorex.marketplace |
| kiorex.reviews | Kiorex | G M | Module | No new reviews; aggregates still displayed | kiorex.marketplace |
| kiorex.family_accounts | Kiorex | G M | Module | Existing dependants kept; cannot add new | — |
| kiorex.record_vault | Kiorex | G M | Module | Vault read-only | — |
| kiorex.whatsapp_booking | Kiorex | G M | Integration | WhatsApp replies with app link | kiorex.marketplace |
| kiorex.sponsored_listings | Kiorex | G M | Commercial | Sponsored slots removed; organic ranking only | kiorex.marketplace |
| kiorex.pharmacy_orders | Kiorex | G M | Launch-locked | Pharmacy tab hidden; open orders completed or refunded | pharmacy.kiorex_orders · gate: merchant-of-record + counsel memo (Q5) |
| kiorex.lab_bookings | Kiorex | G M | Launch-locked | Lab tab hidden; booked collections honoured | lab.kiorex_bookings · gate: counsel memo |
| kiorex.telemedicine | Kiorex | G M | Launch-locked | Video option hidden | gate: clinical governance sign-off |
| kiorex.ai_navigation | Kiorex | G M | Launch-locked | Plain specialty search | gate: clinical evaluation (KX11) |
| account.passkeys | Kiorex Account | G M | Module | OTP only | — |
| account.provider_sso | Kiorex Account | G M O | Module | Providers use product login | — |
| pharmacy.module | Kiorly Pharmacy | G M O | Module | No new sign-ups; existing tenants read-only with export | — |
| pharmacy.kiorex_orders | Kiorly Pharmacy | G M O | Module | Order inbox hidden; stock not exposed | pharmacy.module |
| pharmacy.forecasting | Kiorly Pharmacy | G M O | AI | Min/max reorder only | pharmacy.module |
| pharmacy.insurer_claims | Kiorly Pharmacy | G M O | Module | Cash/self-pay only | pharmacy.module |
| lab.module | Kiorly Lab | G M O | Module | No new sign-ups; existing tenants read-only with export | — |
| lab.analyzer_interfaces | Kiorly Lab | G M O | Integration | Manual entry with dual control | lab.module |
| lab.home_collection | Kiorly Lab | G M O | Module | Walk-in collection only | lab.module |
| lab.kiorex_bookings | Kiorly Lab | G M O | Module | Not bookable from Kiorex | lab.module |
| market.<country>.live | All products | G | Launch-locked | Country hidden from sign-up and search; existing tenants unaffected | gate: market pack certification + local counsel |

RULE: Not flags — never switchable: Rx safety checks (interactions, allergies, duplicates); Encounter sign-off, auto-lock and versioned amendments; Audit logging; Consent enforcement; Record view / print / export for the tenant; Lot expiry / recall / quarantine blocks; Pharmacist sign-off; Lab QC blocks and authorized release; Critical-value escalation; Privileged MFA on production; Tenant isolation and authorization; Breach-response tooling.

## 10 Scaling path

Design for 10× without re-architecture; extract only with evidence.

| Trigger | Action |
|---|---|
| Slots p95 > 150 ms at load | Redis slot cache (beyond current 60 s in-process cache); read replica |
| Search > 50k providers or complex ranking | OpenSearch index fed by provider events |
| > 3 consumers of the same events | Introduce EventBridge/SNS fan-out behind the outbox dispatcher |
| A context needs independent scaling or team | Extract per MODULAR_MONOLITH.md: stop imports → OpenAPI → own schema → route by path |
| New market without suitable cell | Add cell to platform/data-cells.json; deploy stack in new region; tenants pinned to cell |
