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
7. **Deploys and AWS changes only on the founder's explicit say-so.** Standing approvals as of 27 Nov 2026: (a) Clinic changes go to BOTH `kiorex` and `main` always; pushes to `main` auto-deploy to AWS and must NOT carry `[skip ci]` any more, but must not change ports, CI workflows or infra files; (b) the founder approved provisioning the kx-test environment (cost-minimal) 'on my behalf per your recommendation' (OpenTofu in `infra/tofu`, plan reviewed before apply); DNS records, registrar changes, purchases, real-money modes, real patient-data migration and the counsel sign-off always stay with the founder. Local AWS CLI credentials exist for account 990597228737 (the Clinic account); use them only for what is approved. Take an RDS snapshot before a Clinic deploy that has migrations.
8. Databases are local Postgres at localhost:5433 (user `postgres`); `psql` is at `~/.local/bin/psql`.
9. Git: commit with `git commit --only` as author Mohamed Shall; set `GIT_AUTHOR_*` and `GIT_COMMITTER_*` env if identity is missing; end messages with the Co-Authored-By line given by the session. Never force-push. Merge founder commits, never discard them.
10. Privacy/safety in growth code: k>=10 floors, no PHI in growth events, consent gating, closed action vocabularies, shadow-mode fraud scoring.

## 3. Repositories, branches and sync

- `scripts/push-all.sh` (workspace root) pushes every repo: workspace/contracts/pay-contract/platform/account/pharmacy/lab/kiorly on `main`; **clinics-management on branch `kiorex`**. It never touches Clinic `main`, never force-pushes, merges remote movement in a temp worktree.
- **Clinic has two branches:** `kiorex` (working branch, ahead) and `main` (what AWS deploys). `kiorex` is merged into `main` only on explicit founder instruction, in a temporary worktree, with commit message ending `[skip ci]`, after checking the diff contains no port or CI/pipeline changes (restore `main`'s `.github/workflows/*` if the merge brings differences). Last done 26 Nov 2026 (`a4320286`). Leave the checkout on `kiorex`.
- `kiorex-contracts`: `main` is published state (1.12.0). Unpublished additive work is on branches `kiorex` and `contracts-1.13.0` (same tip). Do not merge to `main` or publish without the founder (launch row LG-COM-15). `publish.yml` is manual only and immutable.
- Many old local branches (`w9fin`, `com-*`, `pay-*`, `sub-*`, `cfg-*`) are fully merged and can be deleted.
- GitHub owner `mshall`. All Kiorex repos are private except `clinics-management` (public; founder was asked whether to make it private).

## 4. What has been built (mock providers; only the Clinic is deployed to AWS: deploys on 24-25 Nov and 27 Nov 2026, see sections 8 and 14)

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

## 6. Latest founder direction (26 Nov 2026), now built (local, not deployed)

- Kiorex may collect commissions and shows them to the provider's ops/admin AND to Kiorex ops/admin (two-way visibility, same data).
- Providers in Egypt are paid under CBE rules **only by bank transfer to the provider's bank account**; cash visits are included by accruing commission and netting it in settlement (Kiorex never holds or pays out cash). All through Reconciliation and settlement, visible to both sides.
- Everything numeric or legal is configurable from the super admin (default per organisation type, per-organisation override, maker-checker): rates, floor/cap, mode, grace days, reminders, dispute window, a **counsel sign-off record** per market that gates real-money modes (default NOT_REVIEWED, so real money stays blocked), and versioned AR/EN disclosure text (no wording shipped). This is business direction, not legal clearance: never mark counsel sign-off APPROVED on the founder's behalf.
- Built: platform commits 3850d45 (policy, counsel gate, disclosure, cash tender, settlement statement) and e41bc51 (signed partner statement route); Clinic 3555b2e0 and 035a566b, Pharmacy 8e0d07f and 8796925, Lab 2bf38db and fb23fa3 (provider-side statement, tender, disclosure, configurable dunning params). Launch rows `LG-COM-17..20` carry the status.

## 7. Open items and decisions (authoritative list: `LAUNCH_PREPARATION_GUIDE.md`)

- **LG-COM-15:** publish contracts 1.13.0 (adds `COMMISSION_CHARGE_STATUS_CHANGED`, `CommissionRateView`, rate resolution vectors). Steps are in the row. Not yet in contracts `main`.
- **LG-COM-16:** first AWS deploy of the merged Clinic `main`. Dry run done (`_docs/CLINIC_FIRST_DEPLOY_DRYRUN.md`). Two blockers fixed (Dockerfile copies `vendor/`, web typecheck, OpenAPI regenerated). Remaining risks: failed migration is not atomic and App Runner health can still look green, first boot downgrades past-due subscriptions to Lite, pre-deploy backup is disabled (take a manual RDS snapshot), post-deploy seed hits production, a push of this size resolves to a full deploy. Keep flags `clinic.provider_credit_v2`, `growth.provider_marketing_v2`, `clinic.usage_bundles` off.
- Founder/finance/counsel inputs: actual commission numbers, CBE funds-flow sign-off and disclosure wording, bank IPN real layout, doctor-created links, native Arabic review, vendor sandbox credentials, Meta business verification and WhatsApp template approval, store registrations (Apple/Google bundle ids), production Passport clients, production IdP choice (Cognito default), external pentest/ZAP, mTLS only on partner demand.
- Engineering leftovers: real saved-method charging wiring (LG-COM-4), Pharmacy/Lab mobile staff cards for the rate view, a reconciliation finding for "claim differs from the rate", Clinic market-rate table retirement, optional Clinic `safety-controls.ts` registry entry for SB-05, PDFs still say SB-05 is open until rebuilt.
- Local DBs `kiorex_pay_unified`, `kiorly_pay_unified`, `kiorly_telehealth`: founder decided 27 Nov 2026 to KEEP them (no connections, no references, no conflict); do not raise dropping again.

## 8. Deployment facts (read before touching `main`)

- Only **Kiorly Clinic** is deployed on AWS, from `mshall/clinics-management` branch `main`, via `.github/workflows/deploy-aws.yml` (triggers on every push to `main`, scope auto-detected, region eu-central-1, CDK stack; CI test job gates the deploy: typecheck, unit, integration, money gate, Playwright). Earlier deploys ran on 24-25 Nov 2026; on 27 Nov 2026 main was deployed with all merged work (RDS snapshot `pre-kiorex-merge-20261127` taken first). Other deploy workflows are manual only. Contracts/pay-contract repos have no link to that deploy.
- Any push to `main` deploys; the live organisation (Dr Ahmed Shall) must keep working: every Clinic change is backward compatible and neutral by default.

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

## 11. Repositories: local paths and GitHub links (snapshot 26 Nov 2026)

All local paths are under `/Users/shall/Documents/Peraonal/Work/`. GitHub owner is `mshall` (SSH remotes, `git@github.com:mshall/<repo>.git`; web `https://github.com/mshall/<repo>`).

| Repo | Local path | GitHub | Working branch | Tip when written | Apps / packages |
|---|---|---|---|---|---|
| Workspace (docs, brand, e2e, scripts) | `kiorex-v2/` | https://github.com/mshall/kiorex-workspace | `main` | daa4e2e | `_docs`, `_brand`, `e2e`, `scripts` |
| Kiorly Clinic (+ Nurse) | `kiorex-v2/clinics-management/` | https://github.com/mshall/clinics-management | **`kiorex`** (deploys from `main`) | kiorex 035a566b, main 3c1e6a04 | `apps/api`, `apps/web`, `apps/docs`, `packages/field-visit` |
| Contracts | `kiorex-v2/kiorex-contracts/` | https://github.com/mshall/kiorex-contracts | `main` (published 1.12.0); unpublished work on branches `kiorex` and `contracts-1.13.0` (tip 125260d) | main 5685181 | package `@kiorex/contracts` |
| Pay contract | `kiorex-v2/kiorex-pay-contract/` | https://github.com/mshall/kiorex-pay-contract (private) | `main` | 449b706 | package `@kiorex/pay-contract` 0.1.0 |
| Kiorex platform (patients, Pay, growth, ops) | `kiorex-v2/kiorex-platform/` | https://github.com/mshall/kiorex-platform | `main` | 07c3ec1 | `apps/api`, `web`, `widget`, `mobile`, `ops` |
| Kiorex Passport | `kiorex-v2/kiorex-account/` | https://github.com/mshall/kiorex-account | `main` | 29b9cd6 | `apps/dev-idp`, `kiorly-home`, `passport-ui`; `packages/backchannel`, `otp-sender` |
| Kiorly Pharmacy | `kiorex-v2/kiorly-pharmacy/` | https://github.com/mshall/kiorly-pharmacy | `main` | 8796925 | `apps/api`, `apps/web`, `packages/shared` |
| Kiorly Lab | `kiorex-v2/kiorly-lab/` | https://github.com/mshall/kiorly-lab | `main` | fb23fa3 | `apps/api`, `apps/web`, `packages/shared` |
| Kiorly staff app | `kiorex-v2/kiorly/` | https://github.com/mshall/kiorly | `main` | 03fd7f2 | Expo app |
| Founder's own Clinic checkout (**DO NOT TOUCH**) | `kiorly-clinics-management/` | same remote as Clinic | founder's | n/a | ports 3020/5190/5191 |

Other folders in `Work/` that look related but are leftovers: `kiorex-v2-w9fin-*` and `kiorex-v2-w9a1` are old agent git worktrees (their branches are merged; remove with `git worktree remove` after checking `git cherry`). `Kiorex/` holds older material. Unrelated projects (`AIAgentPromptGenerator`, `AINomodTask`, `MAL`) are not part of this.

Key doc paths (all under `kiorex-v2/`): `_docs/adr/ADR-059-...md` and `_docs/environments/*.md` and `_docs/registry/service-url-registry.yaml` (environment, DNS and URL standard, section 13), `AGENTS.md`, `CLAUDE.md`, `README.md`, `INTEGRATION.md`, `TEST_GUIDE.md`, `_docs/LLM_HANDOFF.md` (this), `_docs/LAUNCH_PREPARATION_GUIDE.md`, `_docs/FOUNDER_DECISIONS.md`, `_docs/CLINIC_FIRST_DEPLOY_DRYRUN.md`, `_docs/INTEGRATION_GO_LIVE_RUNBOOK.md`, `_docs/INTEGRATION_RUNBOOK_PAYMENTS.md`, `_docs/INTEGRATION_RUNBOOK_MESSAGING.md`, `_docs/CONFIGURATION_CATALOG.md` (mirror of `kiorex-platform/Docs/CONFIGURATION_CATALOG.md`), `_docs/growth/*`, `_docs/rev23/KX-*.md`, `_docs/pdf/` (PDF builder; qa contact sheets in `_docs/pdf/qa/`), `_brand/`, per-repo `Docs/` and `Docs/NEEDS_HUMAN.md` in the platform. Google Drive folder "Kiorex v2" (id 1Pk__yq04TSGzWwAsiWQB--bVgu8WGd_L) holds the 16 PDFs under "00 Executive & Governance", "02 PRD", "03 Technical Documents", "04 Financial Model & GTM", "05 Risk & Compliance", "07 Roadmap & Delivery".

Useful commands (run from `kiorex-v2/`): `bash scripts/push-all.sh` (sync all repos); `node _docs/pdf/build.mjs` (rebuild PDFs); `e2e/scripts/*-stack.sh` (private stacks); Postgres `~/.local/bin/psql -U postgres -h localhost -p 5433`.

## 12. Remaining work checklist (update this list as items close; the launch guide rows are authoritative)

Legend: [H] needs the founder, finance, counsel or a vendor; [E] engineering an agent can do; [D] decision.

### A. Release gates (in order)
- [ ] [D] Contracts 1.13.0: merged and tagged `v1.13.0` (27 Nov 2026) but registry publish failed (403, scope `@kiorex` has no GitHub owner under `mshall`). Decide: GitHub org `kiorex` (recommended) or rename scope, then re-run `publish.yml`. Consumers use vendored tarballs meanwhile; 1.13.0 is vendored into platform (cb44f8e), pharmacy (fd49527) and lab (a722595) and their local rate-resolution copies are removed. Founder 27 Nov: do nothing about the registry for now. Policy-schema sync script and generated file deleted (platform afc6431); Lab web lint fixed (lab 1747b8b).
- [x] Clinic `main` deployed to AWS on 27 Nov 2026 (founder-approved, no `[skip ci]`): API live and healthy; the post-deploy seed Lambda failed once (seed image copies only `src/staging`; fixed in 6fc01cf9, redeploy tracked in section 14). Keep flags `clinic.provider_credit_v2`, `growth.provider_marketing_v2`, `clinic.usage_bundles` off. Founder checks the real clinic after each deploy.
- [ ] [E] Rebuild and re-upload the PDFs after the final docs are settled (SB-05 now resolved, commission policy/statement/cash netting added; KX-05/12/15/30/33 and Pay docs). Use the Drive web "Manage versions > Upload new version" flow so file ids and links stay; the Drive connector cannot take large base64.

### B. Commission and money (founder direction 26 Nov: two-way visibility, bank-only payouts, cash visits netted)
- [ ] [H] Counsel/CBE funds-flow sign-off per market, recorded in Ops > Commission policy (LG-COM-18). Until then real-money modes stay blocked. Never mark approved on the founder's behalf.
- [ ] [H] Enter the commission numbers per organisation type and any overrides (LG-COM-11..13), through the maker-checker flow with two super admins.
- [ ] [H] Enter AR/EN disclosure texts and choose override-reason visibility (LG-COM-14).
- [x] LG-COM-20 decided 27 Nov 2026: direct bank/InstaPay/card terminal = cash-type tender recorded as its own kind CASH_TRANSFER, with a per-tender commission treatment (rate/min/cap/mode/grace) configurable per org type and per org, default inherits the base rate (platform d998899, 16b3746; Clinic kiorex 1d5b3956). Gap: Clinic reads tender from check-in mode/channel, not invoice payment allocations; FAWRY/wallet stay unknown.
- [ ] [D] LG-COM-7: can the Clinic "higher of subscription or commission" settlement coexist with Kiorex collection?
- [ ] [E] Real saved-method charging for AUTO_CHARGE_SAVED_METHOD (LG-COM-4). (Reconciliation finding `CLAIM_NE_RATE` "claim differs from the rate": DONE, local.)
- [ ] [E] Per-organisation Clinic credentials for the partner statement route: platform part DONE (derived per-tenant secret, `COMMISSION_STATEMENT_CLINIC_AUTH`); the Clinic must hold per-tenant secrets, then flip to `per_org` (`kiorex-platform/Docs/PARTNER_STATEMENT_CLIENT_CHANGES.md`).
- [ ] [E] Query string of the partner statement route is now signed on the platform (`X-Kiorly-Query-Signature`, optional until `COMMISSION_STATEMENT_QUERY_SIGNATURE=required`); the Clinic, Pharmacy and Lab clients still have to send it (exact change in `Docs/PARTNER_STATEMENT_CLIENT_CHANGES.md`). Still open: Pharmacy/Lab mobile staff cards for the rate and statement; statement PDF; `feesMinor` for Pharmacy/Lab; refunds/chargebacks/bank match in the Clinic's mock mirror.
- [x] [E] Clinic dunning: reminders after the due date are now supported (`reminderDaysAfterDue`); Clinic `DEFAULT_DUNNING_TIMELINE` reminders and `renewalReminderDaysBefore` come from the market pack with unchanged defaults. [ ] Still open: move remaining hardcoded values to config (platform job interval, dunning bounds, aging buckets 30/60/90, 7-day notice before money policy, legacy `PHARMACY_TAKE_RATE_BPS`/`LAB_TAKE_RATE_BPS`).
- [x] [E] Clinic market-rate table kept as the documented fallback (schema comment and commission doc); SB-05 entry added to the Clinic `safety-controls.ts` registry (`sb05_collection_never_pauses_listing`).

### C. Real integrations (flip mock to real, one at a time, staging first; see `INTEGRATION_GO_LIVE_RUNBOOK.md`)
- [ ] [H] Payments: Paymob, Fawry, InstaPay, card gateway, bank IPN (real file/layout), Vodafone Cash/wallets; sandbox credentials by reference; settlement import; `INTEGRATION_MODES` approval.
- [ ] [H] Messaging: Meta WhatsApp Cloud (business verification, template approval, number), SES/SNS email, SMS aggregator, APNs/FCM/Expo push credentials.
- [ ] [H] Passport production IdP choice (Cognito default), production OIDC clients per product, Apple/Google bundle-id registration for `com.kiorly.app`, store listings.
- [ ] [H] Native Arabic content review, legal text, pentest by an external firm, ZAP, privacy impact assessment sign-offs, counsel/CMO gates (GHV1/2, GPR1/2, GKN1/2).
- [ ] [D] mTLS for partners only on partner demand (today HMAC-signed requests).

### D. Engineering leftovers
- [ ] [E] Clinic web screens for matching, patient/staff Pay screens, routing in deposit checkout, Pay Playwright, Android Gradle/device checks, Passport email UI.
- [ ] [E] Clinic daily-cap stale cache edge (cap now enforced on holds/bookings; keep watching).
- [ ] [E] Reduce Jest memory retention in platform integration tests (needs 12 GB heap ceiling; CI runner sizing).
- [ ] [E] Older shared-stack Playwright specs (Pharmacy/Lab `growth.spec.ts`) not re-run after the latest changes.
- [ ] [E] Confirm the `growth.product_ingest` flag decision and doctor-created links (G-17).

- [ ] [E] Contracts follow-up (next release): add `CARD_GATEWAY` and `BANK_IPN` to the `INTEGRATION_MODES` schema; the platform patches both locally in `policy-schemas.ts`.
- [ ] [E] Platform: 4 `growth-admin.int.spec.ts` tests fail with 404 on `GET /ops/growth/overview` (fail on the untouched baseline too); investigate.
- [ ] [E] Lab web: 20 jsx-a11y violations in 14 files are switched off per file in `eslint.config.js` (autoFocus, tabindex, click without key handler); fix properly. `eslint-plugin-jsx-a11y` needs `--legacy-peer-deps` (peer range stops at eslint 9, Lab web uses 10).

### E. Housekeeping
- [x] `mshall/clinics-management`: made private 27 Nov 2026, then set back to PUBLIC the same day by the founder to keep unlimited Actions minutes; to be made private again later (check Actions minutes first). The other seven repos were always private. Contracts registry: founder chose to do nothing for now (vendored tarballs).
- [x] Local scratch DBs kept by founder decision (27 Nov 2026); not an open item.
- [ ] [E] Remove the merged old worktrees `kiorex-v2-w9fin-*`, `kiorex-v2-w9a1` and about 30 merged local branches (`git cherry` first); delete `com-collect-onpay` (content is in main).
- [ ] [E] Contracts branch `w9-a1` (one old commit, superseded by 1.13.0) can be dropped.

### E2. Environment, DNS and URL standard (ADR-059, Proposed; all founder-gated, nothing applied)
- [ ] [D] Sign or amend ADR-059; confirm `app.kiorly.com` = Kiorly Home, keep `book.*` (widget) and `kiorly.link`; decide how real identities sit in kx-test Passport (private DB vs keep real staff off it); production IdP choice (G-IDP); counsel position on the designated real organisation in kx-test and on the pilot rule.
- [ ] [H] Founder: NS records for the `test` child zones at domain.com and namecheap.com (after the zones exist); later apex delegation, DNSSEC DS, CAA; ACM certificates; provisioning; adding `clinics.test.kiorly.com` to the live Clinic CloudFront distribution (a deploy; keep `[skip ci]` rules); every deploy.
- [ ] [E] Generate `kiorex-account/config/domains.json`, `idp.json` client URIs and app-link files from the registry; remove host literals listed in `_docs/environments/DNS_AND_DOMAIN_ARCHITECTURE.md` section 9 (platform 23, Clinic 10, Passport 2, staff app 2); `__Host-` cookies and a no-`Domain=` test; Clinic Nurse edition detection and reflected CORS; staff-app universal-link host to `app.<env>.kiorly.com` before the first store build; CI job `validate-registry.mjs --strict`; rename GitHub Environments to test, pilot, prod.

### F. Rules of engagement for the next agent
Read section 2 first. Before any push to Clinic `main`, confirm `[skip ci]` and run the diff check for `.github/`, `infra/`, Docker, vite, env and port files. Use private DBs and ports; one test process at a time; ask before drops, visibility changes, deploys, publishing and anything outward-facing.

## 13. Environments, domains and the URL registry (27 Nov 2026, ADR-059 Accepted by the founder's instruction)

Written from the founder brief `briefs/ENV_DOMAIN_STANDARD_BRIEF.md`. Documentation and a registry only: no DNS, AWS, certificate, CI or deploy change was made, and nothing is pushed.

- **Tags to identifiers:** kx-test = `test` (current on-the-ground testing, includes the real organisation Dr Ahmed Shall on the AWS Clinic `https://d92iz83i79c05.cloudfront.net/`, account 990597228737, eu-central-1), kx-pilot = `pilot`, kx-pro = `prod`; `dev` and `staging` follow the same pattern and are reserved names only.
- **Pattern:** `<service>.<env>.<domain>`, production without the environment label (`passport.test.kiorex.com`, `passport.kiorex.com`). Domains `kiorex.com`, `kiorly.com`; `kiorly.link` is reserved pending confirmation. Registrars: domain.com and namecheap.com; DNS is edited only by the founder.
- **Canonical sources (do not duplicate):** `_docs/registry/service-url-registry.yaml` (run `node _docs/registry/validate-registry.mjs`; `--print`, `--emit cors|redirects|env|certs|dns --env <id>`, `--scan`). Documents: `_docs/adr/ADR-059-unified-environment-dns-subdomain-and-domain-routing.md`, `_docs/environments/ENVIRONMENT_STRATEGY.md` (conflicts, per-repo changes, sequence, approvals), `DNS_AND_DOMAIN_ARCHITECTURE.md`, `SERVICE_URL_REGISTRY.md`, `PILOT_ENVIRONMENT_STRATEGY.md`, `INTERNATIONAL_DOMAIN_ROUTING.md`, `ENVIRONMENT_CONFIGURATION_STANDARD.md`.
- **Key decisions to keep:** pilot runs on the production plane and uses the production issuer `passport.kiorex.com`; per-environment ACM certificates (a production wildcard never covers non-production); Route 53 introduced by delegating only the `test` child zones first; the live Clinic `cloudfront.net` host stays valid permanently (custom name added to the same distribution); host-only `__Host-` cookies, never `Domain=.kiorex.com`; country is `kiorex.com/{locale}/{cc}` and tenant configuration, never a host.
- **Supersedes** the host table of ADR-038 (`kiorex-account/config/domains.json`; the sign-in design stays) and the random-URL, SSM registry and two-pass bootstrap parts of `AWS_DEV_ENV_PLAN.md` (banner added there). ADR number 059 (058 stays retired).
- **Open actions:** section 12 item E2. Drive documents to update (not attempted): see `DOCS_SYNC_MANIFEST.md` section "27 Nov 2026".


## 14. State at the end of the 27 Nov 2026 session (read this first if you are a new agent)

**Founder decisions made on 27 Nov 2026**
- Environments: kx-test (`test`, real data at small scale, includes the real Clinic organisation Dr Ahmed Shall plus tagged dummy data), kx-pilot (`pilot`, bigger scale), kx-pro (`prod`, major release for Egypt). Hosting: AWS now for test; initial production decision is Huawei Cloud (Egypt data residency), and test or pilot may move to Huawei at any time, so everything is configured through OpenTofu with an `aws|huawei` provider switch per environment (`infra/tofu`). Verify Huawei region availability and CBE rules before relying on them.
- No dev Clinic copy: the existing AWS Clinic (`https://d92iz83i79c05.cloudfront.net/`, account 990597228737, eu-central-1) is the kx-test Clinic. Other products (platform, Passport, Pharmacy, Lab) are added around it on one cost-minimal host with a PRIVATE database; the Clinic keeps its own RDS untouched.
- Domains `kiorex.com`, `kiorly.com` (registrars domain.com and namecheap.com; the founder edits DNS). Start by delegating only `test.kiorex.com` and `test.kiorly.com` child zones to Route 53.
- Promotion rule: before moving test to pilot or pilot to prod, ASK the founder whether to carry the previous environment over (identities, orgs, patients, bookings) or keep them separate (`LAUNCH_PREPARATION_GUIDE.md` section 0; `IDENTITY_PROMOTION_MODE=ask|carry|separate` in Passport).
- LG-COM-20 decided: direct bank transfer, InstaPay and card terminal at the clinic count as a cash-type tender recorded as its own kind `CASH_TRANSFER` with a configurable per-tender commission treatment (default = base rate), configurable per organisation type and per organisation.
- Commission recommended defaults are shipped as editable `SEEDED_DEFAULT` rows (Clinic 3% min EGP 10 cap EGP 75; Pharmacy 2% min 5 cap 100; Lab 3% min 10 cap 100; net from payout); disclosure texts are drafts; counsel sign-off remains NOT_REVIEWED (real-money modes stay blocked). Only a human records sign-off.
- Contracts 1.13.0 is merged and tagged `v1.13.0`; registry publishing failed (GitHub scope `@kiorex` has no owner under `mshall`); the founder chose to do nothing: consumers use vendored tarballs. A 1.13.1 additive patch (adds `CARD_GATEWAY`, `BANK_IPN` to INTEGRATION_MODES) may be present locally.
- All nine repos are PUBLIC on GitHub (founder decision for unlimited Actions minutes; secret scan of history was clean). Workspace repo is `mshall/kiorex-workspace`. Treat anything committed as public: demo passwords and real data NEVER go in git. The private demo-accounts register lives in the git-ignored `_private/` folder of the workspace (not in GitHub).
- Demo/dummy data: removed from all login UIs (Passport, Kiorly Home, Pharmacy, Lab, Clinic, platform, staff app); seeds stay; demo rows are tagged (`DemoMarker` table in platform, `data_class` in Passport) with `demo-data:remove` scripts (dry-run default, `--confirm` to delete). The founder will ask when to remove the dummy records.
- Local scratch databases `kiorex_pay_unified`, `kiorly_pay_unified`, `kiorly_telehealth` are kept; never raise dropping them again.
- Clinic changes always go to BOTH `kiorex` and `main`.

**What was built and shipped on 27 Nov 2026 (all pushed unless noted)**
Engineering leftovers closed (platform claim-vs-rate reconciliation, per-org partner credentials, signed query string, constants to config); Clinic R3 failed-migration health, dunning reminders config, SB-05 registry entry, CORS allow-list (legacy mode when unset: set `CORS_ALLOWED_ORIGINS` at deploy), host literals to config, env-driven Passport wiring (per-org default stays PASSWORD); Passport Dockerfile, client override emitter, hardened public DEV mode, identity promotion tool, demo tagging; Pharmacy and Lab runtime Dockerfiles with bounded migration retry; platform Dockerfile verified, scheduler hardened (run exactly ONE container with jobs on), growth-admin overview bug fixed; staff app link host per EAS profile; ADR-059 with six environment documents and the URL registry (`_docs/registry`).

**In flight or not yet merged at the time of writing (check `git log` and `git status` of each repo and `_docs/briefs`)**
OpenTofu multi-cloud infra under `infra/tofu` (plan only, not applied); contracts 1.13.1 + platform host fail-closed + cohort attribute; Pharmacy and Lab signed-statement client + Lab accessibility fixes; Clinic, platform and staff-app demo-UI removal (Clinic part must be merged to `main` too); PDF rebuild with rich design (`_docs/pdf`); merging the private demo-accounts register sections (`_private/sections/*.md`) into one file.

**Critical path to a full end-to-end test on AWS (kx-test)**
1. Review `tofu plan`, bootstrap state, apply the AWS test stack. 2. Build and push images (platform, Passport, Pharmacy, Lab), start on the host, one container with jobs. 3. Deploy workflows and the deploy-role secret per repo (GitHub OIDC role `GitHubAction-AssumeRole` trusts `repo:mshall/*`). 4. Passport client config via `npm run client-overrides:emit -- --env test`; wire the Clinic to Passport (env vars on the Clinic App Runner: needs a Clinic deploy; Dr Ahmed Shall organisation stays on its current sign-in method until an admin switches it). 5. Disable Lab dev sign-in (slug and email, no password) on any environment with real data. 6. Run the cross-product e2e against the deployed URLs. 7. Founder checks the real clinic after every deploy.

**Founder-only steps (give these instructions when asked)**
Tell which registrar holds each domain; add NS records for `test` child zones once zones exist; Apple Team ID and Android SHA-256 fingerprints for app links; WhatsApp (Meta Cloud API business verification, phone number, system-user token, templates), SES domain verification and production access, push (Firebase service account, APNs `.p8` key), payment sandbox credentials (Paymob, Fawry); never paste secrets in chat (store via Secrets Manager commands). Verify the real clinic after each deploy.

**Open decisions and gaps**
Production-capable Passport identity provider (the dev IdP refuses production; identities may not carry over); G-HOST (do signed partner requests bind the Host header) and G-COHORT (pilot cohort attribute); Kiorly admin console and marketing site not in code; Clinic matching screens, patient/staff Pay screens and Pay Playwright; Android Gradle/device checks; Passport email UI; counsel sign-off; commission numbers review; Huawei region verification; the real Clinic organisation in kx-test is a declared exception to 'no real patient data outside production' pending counsel (see `environments/PILOT_ENVIRONMENT_STRATEGY.md`).

**Infra and guides (27 Nov 2026):** OpenTofu blueprint `infra/tofu/` (commit 880a655; plan for test = 90 resources to add, nothing applied; risks in its README: plain-HTTP CDN-to-origin leg, single host, pilot-vs-ADR-059 conflict, Huawei code only syntax-validated). Founder step-by-step guide: `_docs/guides/KIOREX_LAUNCH_SETUP_GUIDE.html` (also published as a private artifact). First apply needs the founder's go-ahead and an admin session; review the plan first.

**DNS and state facts (27 Nov 2026, applied with founder approval):** tofu state bucket `kx-tofu-state-990597228737-eu-central-1` created (bootstrap, 6 resources). Route 53 child zones created by CLI (NOT yet in tofu state; import into `module.stack.module.dns_zone_aws[0].aws_route53_zone.this["kiorex"|"kiorly"]` before the full apply): `test.kiorex.com` = Z037967911ZG8GGSE8NDC (ns-435.awsdns-54.com, ns-1119.awsdns-11.org, ns-1587.awsdns-06.co.uk, ns-588.awsdns-09.net); `test.kiorly.com` = Z09450272NB6O70TDDFKF (ns-1151.awsdns-15.org, ns-639.awsdns-15.net, ns-1880.awsdns-43.co.uk, ns-135.awsdns-16.com). Registrars (WHOIS): kiorex.com at Network Solutions (nameservers NS11/NS12.WORLDNIC.COM, parked A record); kiorly.com at Namecheap (BasicDNS pdns1/2.registrar-servers.com, Namecheap email forwarding MX + SPF present: never change its main nameservers, and merge any SES include into the single existing SPF TXT). The founder adds NS records for host `test` at each registrar; then run `tofu import`, plan, apply with `enable_custom_domains=true`.
