# Kiorex and Kiorly: handoff for any LLM or engineer picking this up

Written 26 Nov 2026 by Claude (Sonnet 5.5) at the founder's request, from the working sessions of 19 to 26 Nov 2026. Read this first, then `../CLAUDE.md` (permanent rules), `../README.md` (ecosystem map) and `LAUNCH_PREPARATION_GUIDE.md` (what is left). If this file disagrees with the code, the code and the tests win; if it disagrees with a founder statement, the founder wins. Believe only things labelled As-built in the KX volumes.

Founder: Mohamed Shall (single decision maker, product + engineering lead, based in Egypt/Gulf time UTC+4). Everything below is private.

## 1. What this is

A healthcare ecosystem for Egypt (one live market, multi-market-capable API):

| Product | What | Repo (folder) | Local port |
|---|---|---|---|
| **Kiorex** (patients) | Marketplace: discover verified doctors, book live slots from each clinic's own schedule, deposits (Kiorex Pay), reviews, family accounts, consent, record vault, ops console and super admin owning every feature flag | `kiorex-platform` (API Nest, web, widget, mobile Expo, ops) | API 4000 |
| **Kiorex Passport** | Shared OIDC identity provider (oidc-provider, PKCE, back-channel logout). Product name is "Kiorex Passport", repo key `kiorex-account` | `kiorex-account` | 4400 |
| **Kiorly Clinic** (+ Nurse edition) | Provider SaaS for clinics; works without Kiorex. Nurse is an EDITION (`Organization.edition`), never a separate repo | `clinics-management` (GitHub `mshall/clinics-management`) | API 3010 |
| **Kiorly Pharmacy**, **Kiorly Lab** | Provider SaaS products | `kiorly-pharmacy`, `kiorly-lab` | see INTEGRATION.md |
| **Kiorly** (staff app) | Expo mobile app with Clinic, Nurse, Pharmacy, Lab modules. Name is plain "Kiorly" (never "Kiorly Team"/"Kiorly Work"), bundle `com.kiorly.app` | `kiorly` | n/a |
| Shared packages | `kiorex-contracts` (versioned event/API contracts, HMAC-signed REST + outbox webhooks), `kiorex-pay-contract` (`@kiorex/pay-contract`, unified Pay adapter types) | `kiorex-contracts`, `kiorex-pay-contract` | n/a |

Rules of the architecture: products never share a database and never import each other's source; they integrate only through versioned contracts, HMAC-signed requests and outbox webhooks. Consumers install contracts and pay-contract from vendored tarballs (`vendor/*.tgz`), not from a registry.

Parent folder: `/Users/shall/Documents/Peraonal/Work/kiorex-v2/` (workspace repo `kiorex-workspace`, branch `main`). It holds docs (`_docs`), brand kit (`_brand`), cross-product e2e (`e2e/`), scripts (`scripts/`). The founder's own separate checkout `kiorly-clinics-management` (ports 3020/5190/5191) is NEVER touched.

## 2. Hard rules (founder decisions, do not violate)

1. **No tax-authority integration** of any kind (no ETA, ZATCA, FTA). VAT only as configurable lines on Kiorly's own invoices; a repo test enforces it.
2. **All third-party providers default to MOCK** (`MODE=mock|real`). Real mode is gated by `INTEGRATION_MODES` approval (`common/providers/mode-guard.ts`, fail closed). Secrets only by reference, never printed or committed.
3. **Never invent prices, fees, commission numbers or legal wording.** Unset = no charge and "not set" state. Safety controls are never feature flags.
4. **Money design:** patient credit and provider credit are separate closed-loop ledgers; no money wallet; Kiorex does not hold funds. Commission is collected by Kiorex and shown to both sides (see section 6).
5. **Brand:** Kiorex logo per `_brand/KIOREX_LOGO_SPEC_v2.md` verbatim (indigo `#3730A3`, ocean `#0369A1`, coral `#E8735E` only for lines and large highlights, Plus Jakarta Sans/Inter). Kiorly marks unchanged (guard `_brand/scripts/kiorly-guard.cjs`).
6. **Ports and shared services:** never use ports 3000, 5173, 5175 or the founder's 3020/5190/5191. No broad `pkill`; kill only PIDs you started. Shared stack changes only via `e2e/scripts/up.sh --build --restart --only=<svc>` with output redirected. Tests use private databases and private ports, never the shared DBs (`kiorly`, `kiorex_platform`, `kiorex_account`, `kiorly_pharmacy`, `kiorly_lab`).
7. **No deploys, no `tofu apply`, no AWS access** unless the founder says so in that moment. Pushes to Clinic `main` auto-deploy to AWS (see section 8): always add `[skip ci]`.
8. Databases are local Postgres at localhost:5433 (user `postgres`); `psql` is at `~/.local/bin/psql`.
9. Git: commit with `git commit --only` as author Mohamed Shall; set `GIT_AUTHOR_*` and `GIT_COMMITTER_*` env if identity is missing; end messages with the Co-Authored-By line given by the session. Never force-push. Merge founder commits, never discard them.
10. Privacy/safety in growth code: k>=10 floors, no PHI in growth events, consent gating, closed action vocabularies, shadow-mode fraud scoring.

## 3. Repositories, branches and sync

- `scripts/push-all.sh` (workspace root) pushes every repo: workspace/contracts/pay-contract/platform/account/pharmacy/lab/kiorly on `main`; **clinics-management on branch `kiorex`**. It never touches Clinic `main`, never force-pushes, merges remote movement in a temp worktree.
- **Clinic has two branches:** `kiorex` (working branch, ahead) and `main` (what AWS deploys). `kiorex` is merged into `main` only on explicit founder instruction, in a temporary worktree, with commit message ending `[skip ci]`, after checking the diff contains no port or CI/pipeline changes (restore `main`'s `.github/workflows/*` if the merge brings differences). Last done 26 Nov 2026 (`a4320286`). Leave the checkout on `kiorex`.
- `kiorex-contracts`: `main` is published state (1.12.0). Unpublished additive work is on branches `kiorex` and `contracts-1.13.0` (same tip). Do not merge to `main` or publish without the founder (launch row LG-COM-15). `publish.yml` is manual only and immutable.
- Many old local branches (`w9fin`, `com-*`, `pay-*`, `sub-*`, `cfg-*`) are fully merged and can be deleted.
- GitHub owner `mshall`. All Kiorex repos are private except `clinics-management` (public; founder was asked whether to make it private).

## 4. What has been built (all local, mock providers, nothing deployed since the founder's last AWS deploy)

- **Growth and Patient Acquisition Engine** Phases 1 to 4 and Waves 5 to 9 (volumes KX-27..KX-33; work packages `_docs/growth/GROWTH_PHASE2_4_WORK_PACKAGES.md`; evidence `_docs/growth/W9_A2_P3H_HARDENING_EVIDENCE.md`): attribution, referral, campaigns, SEO/ASO, experiments, analytics rollups, provider marketing v2, provider credit v2 (promotions funded from provider credit), corporate/B2B benefit, WhatsApp assistant, lifecycle messaging, cohort analytics. Config uses maker-checker `GrowthConfigVersion` (`EDITABLE_KINDS`, `LOCAL_CONFIG_KINDS`); a different super admin must approve changes. REWARD_RULES in force is version 15 (restored from the v1 defaults on 25 Nov via the two-person flow).
- **Integrations Control Center** (`/integrations` in Ops, 25 integrations) and the config catalog (`Docs/CONFIGURATION_CATALOG.md`); go-live runbooks `_docs/INTEGRATION_GO_LIVE_RUNBOOK.md`, `INTEGRATION_RUNBOOK_PAYMENTS.md`, `INTEGRATION_RUNBOOK_MESSAGING.md`.
- **Messaging:** Meta WhatsApp Cloud (interactive buttons, 24h window, template registry), SES/SNS email, SMS aggregator, APNs/FCM/Expo push; all mock until credentials and approvals exist.
- **Kiorly Pay (unified payments layer):** PspAdapter for Paymob, Fawry, InstaPay, card gateway, bank IPN; reconciliation and settlement, disputes/chargebacks, payment links/QR, routing (org preference, Wilson success rate), shadow fraud scorer, rollups; tender order sponsored, corporate, credit, card. Doc: `Docs/PAYMENTS_UNIFIED_LAYER.md`.
- **Commissions engine** (Clinic `apps/api/src/commissions` and `kiorex`, platform `commissions`): collection modes `NET_FROM_PAYOUT`, `AUTO_CHARGE_SAVED_METHOD`, `INVOICE_AND_COLLECT`; append-only status timeline; per-organisation-type default rate with per-organisation super-admin override (`CommissionRatePolicy`, maker-checker, effective-dated); read-only rate view pushed to Clinic/Pharmacy/Lab. No rate numbers are shipped.
- **Subscriptions:** auto-renew default ON, org admin can turn it off; dunning ends in the free **Lite** plan (not lockout); `/plan` upgrade UI shows package benefits; store policy forbids in-app purchase (link to web).
- **Other:** Passport (OIDC, federation/SCIM dev, 51-route OpenAPI), daily marketplace cap enforced (409 `MARKETPLACE_DAILY_CAP_REACHED`), SB-05 resolved 26 Nov (an unpaid commission never pauses a listing; code rule, not a flag).
- **Docs:** 16 Rev 2.7 PDFs (KX-01,03,05,09,12,13,14,15,24,27,28,29,30,31,32,33) built with the Kiorex design system in `_docs/pdf/` (`build.mjs`, `lib/design/`; outputs git-ignored in `_docs/pdf/out/`), uploaded to Google Drive folder "Kiorex v2" as new versions of the existing files on 25 Nov 2026. Markdown sources: `_docs/rev23/` and `_docs/`.

## 5. Quality state (26 Nov 2026)

- Full ordered cross-product e2e (suites 01..56) passed three consecutive times on a private stack (552 passed, 0 failed, 37 skipped by design). Suite 30-security passes on its own private stack. Platform integration 1340 passed (needs `--max-old-space-size=12288`; Nest 12 ESM under `--experimental-vm-modules` retains ~90 MB per test file, so CI runners need more than 12 GB RAM or a lower value). Clinic API unit 1466, integration 580, web unit 200. `npm audit --omit=dev` clean in all repos at last check.
- Edge viewports covered by Playwright: 320, 640x450, 1440, 2560, AR (RTL) and EN.
- Running tests: one process at a time per repo, private DB, private ports.

## 6. Latest founder direction (26 Nov 2026), implementation in progress when this was written

- Kiorex may collect commissions and shows them to the provider's ops/admin AND to Kiorex ops/admin (two-way visibility, same data).
- Providers in Egypt are paid under CBE rules **only by bank transfer to the provider's bank account**; cash visits are included by accruing commission and netting it in settlement (Kiorex never holds or pays out cash). All through Reconciliation and settlement, visible to both sides.
- Everything numeric or legal is configurable from the super admin (default per organisation type, per-organisation override, maker-checker): rates, floor/cap, mode, grace days, reminders, dispute window, a **counsel sign-off record** per market that gates real-money modes (default NOT_REVIEWED, so real money stays blocked), and versioned AR/EN disclosure text (no wording shipped). This is business direction, not legal clearance: never mark counsel sign-off APPROVED on the founder's behalf.
- Check `git log` in `kiorex-platform` for the commit that finished this ("commission policy", cash-visit netting, settlement statement) and `LAUNCH_PREPARATION_GUIDE.md` rows `LG-COM-*`.

## 7. Open items and decisions (authoritative list: `LAUNCH_PREPARATION_GUIDE.md`)

- **LG-COM-15:** publish contracts 1.13.0 (adds `COMMISSION_CHARGE_STATUS_CHANGED`, `CommissionRateView`, rate resolution vectors). Steps are in the row. Not yet in contracts `main`.
- **LG-COM-16:** first AWS deploy of the merged Clinic `main`. Dry run done (`_docs/CLINIC_FIRST_DEPLOY_DRYRUN.md`). Two blockers fixed (Dockerfile copies `vendor/`, web typecheck, OpenAPI regenerated). Remaining risks: failed migration is not atomic and App Runner health can still look green, first boot downgrades past-due subscriptions to Lite, pre-deploy backup is disabled (take a manual RDS snapshot), post-deploy seed hits production, a push of this size resolves to a full deploy. Keep flags `clinic.provider_credit_v2`, `growth.provider_marketing_v2`, `clinic.usage_bundles` off.
- Founder/finance/counsel inputs: actual commission numbers, CBE funds-flow sign-off and disclosure wording, bank IPN real layout, doctor-created links, native Arabic review, vendor sandbox credentials, Meta business verification and WhatsApp template approval, store registrations (Apple/Google bundle ids), production Passport clients, production IdP choice (Cognito default), external pentest/ZAP, mTLS only on partner demand.
- Engineering leftovers: real saved-method charging wiring (LG-COM-4), Pharmacy/Lab mobile staff cards for the rate view, a reconciliation finding for "claim differs from the rate", Clinic market-rate table retirement, optional Clinic `safety-controls.ts` registry entry for SB-05, PDFs still say SB-05 is open until rebuilt.
- Local housekeeping the founder has not yet approved: dropping local DBs `kiorex_pay_unified`, `kiorly_pay_unified`, `kiorly_telehealth` (scratch copies, no references).

## 8. Deployment facts (read before touching `main`)

- Only **Kiorly Clinic** is deployed on AWS, from `mshall/clinics-management` branch `main`, via `.github/workflows/deploy-aws.yml` (triggers on every push to `main`, scope auto-detected, region eu-central-1, CDK stack). Other deploy workflows are manual only. Contracts/pay-contract repos have no link to that deploy.
- A push without `[skip ci]` deploys everything merged so far, including ~9 new migrations on the live database.

## 9. Where things are

- Rules and brief: `../CLAUDE.md`; ecosystem map: `../README.md`; local wiring and ports: `../INTEGRATION.md`; test guide: `../TEST_GUIDE.md`; demo data: `../DEMO_DATA.md`; founder decisions: `FOUNDER_DECISIONS.md`.
- Reference volumes: `rev23/KX-*.md`; ADRs in KX-01; roadmap and package status: KX-33 section 4.
- Growth docs: `growth/`; launch checklist (living, present it when the founder asks for "launch steps"): `LAUNCH_PREPARATION_GUIDE.md`; docs sync manifest: `DOCS_SYNC_MANIFEST.md`.
- Scripts: `scripts/push-all.sh`, `e2e/scripts/*.sh` (private stacks: `w9-stack.sh`, `sec-stack.sh`, `gap-stack.sh`, `pay-stack.sh`, etc.), `_docs/pdf/build.mjs`.
- Claude memory of the founder preferences lives outside the repo at `~/.claude/projects/-Users-shall-Documents-Peraonal-Work-kiorly-clinics-management/memory/`.

## 10. How to continue safely

1. Read `LAUNCH_PREPARATION_GUIDE.md` rows still Open, and `git log --oneline -20` in the repo you touch.
2. Work on the checked-out branch; Clinic work goes on `kiorex`. Use private DBs and ports. Add tests for every change; never loosen a test to pass it.
3. Update the relevant doc and the launch guide row in the same change.
4. Sync with `bash scripts/push-all.sh`. Merge Clinic `kiorex` to `main` only when told, with `[skip ci]`.
5. When unsure about money, legal wording, deploys, deletions or anything outward-facing, stop and ask the founder.
