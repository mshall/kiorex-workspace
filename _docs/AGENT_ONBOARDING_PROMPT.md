# Onboarding prompt for a new agent (Kiorex and Kiorly)

Paste everything below the line into the new agent as its first message, or attach this file together with `_docs/LLM_HANDOFF.md`. Workspace root on the founder's machine: `/Users/shall/Documents/Peraonal/Work/kiorex-v2/`. Last updated 28 Nov 2026 (mid-session snapshot). Read sections 14 to 19 of the handoff first: they hold the current state, decisions and the critical path (kx-test live on AWS, markets, Kiorly Home, dual sign-in).

---

You are joining a long-running build for the founder (Mohamed Shall, Gulf time UTC+4). Your first job is to scan the whole workspace and reach the same understanding as the agent that worked on it before you. Do not change anything until you have finished the reading list and written back a short summary of what you understood.

## 1. Reading list, in order

1. `_docs/LLM_HANDOFF.md` (the master handoff: products, hard rules, repos and branches, what is built, quality state, founder direction, open items, deployment facts, doc locations, remaining-work checklist in section 12).
2. `AGENTS.md` and `CLAUDE.md` at the workspace root (permanent rules).
3. `_docs/LAUNCH_PREPARATION_GUIDE.md` (authoritative list of what is open before launch; rows LG-COM-* are commissions and money).
4. `_docs/CLINIC_FIRST_DEPLOY_DRYRUN.md` (first AWS deploy risks, migrations, rollback).
5. `_brand/KIOREX_LOGO_SPEC_v2.md` (use the logo geometry verbatim) and the `_brand/` folder.
6. Per repo: `README`, `Docs/` (platform has `NEEDS_HUMAN.md`, `CONFIGURATION_CATALOG.md`, `COMMISSION_DEFAULTS.md`, `PARTNER_STATEMENT_CLIENT_CHANGES.md`), and `git log --oneline -30`.

## 2. What the ecosystem is (one paragraph each)

- **Kiorex**: the patient-facing marketplace and network (patient web and mobile, Kiorex ops console, Passport sign-in, Kiorex Pay, Growth Engine, commissions). Brand: Indigo `#3730A3`, Ocean `#0369A1`, Coral `#E8735E`, Plus Jakarta Sans.
- **Kiorly**: the provider products. Clinic management (`clinics-management`, deploys to AWS from `main` only), Pharmacy (`kiorly-pharmacy`), Lab (`kiorly-lab`), and the staff mobile app, which is plain "Kiorly" (`com.kiorly.app`, repo `kiorly`).
- **Platform** (`kiorex-platform`): Kiorex backend: Growth, commission policy and collection, reconciliation and settlement, Ops admin with maker-checker config.
- **Contracts**: `kiorex-contracts` (shared OpenAPI, events, flags, HMAC helpers; version 1.13.2 tagged `v1.13.2`, registry publish blocked by scope owner, consumers use vendored tarballs) and `kiorex-pay-contract` (0.1.0, vendored).
- **Account** (`kiorex-account`): Passport identity.
- Repo paths, GitHub links (`https://github.com/mshall/<repo>`), branches and tips are in section 11 of the handoff.

## 3. Hard rules (non-negotiable)

- Deploys and AWS changes only on the founder's explicit say-so. Standing approvals (27 to 28 Nov 2026): every Clinic change goes to BOTH `kiorex` and `main`; a push to `main` auto-deploys to AWS (the real organisation Dr Ahmed Shall is live there) and no longer carries `[skip ci]`, but must not change ports, CI workflows or infra; take an RDS snapshot first when migrations are included. Provisioning of the kx-test environment through OpenTofu was approved 'per your recommendation' (review the plan before apply). DNS, purchases, real-money modes, real patient-data migration and counsel sign-off stay with the founder.
- Every repo on GitHub is PUBLIC: never commit secrets, real data or demo passwords. The private demo-accounts register is in the git-ignored `_private/` folder.
- Before moving to the next environment (test to pilot to prod) ask the founder: carry the previous one over, or keep separate.
- Never touch ports 3000, 5173 or 5175, or the founder's own checkout `kiorly-clinics-management` (ports 3020, 5190, 5191). Use private databases and ports for tests; one test process at a time; no broad `pkill`.
- Shared services only through `e2e/scripts/up.sh --build --restart --only=<svc>` with output redirected.
- Mock providers by default. Secrets by reference only, never in code, chat or commits.
- Safety controls are code rules, never feature flags.
- Never invent prices, fees or legal wording without the founder saying so. Counsel sign-off (`COMMISSION_COUNSEL_SIGNOFF`) is a human record: never mark it approved. No tax-authority integration.
- Use Sonnet agents for code work. Ask before drops, visibility changes, deploys, publishing and anything outward-facing.
- Local git identity is missing: set `GIT_AUTHOR_NAME/EMAIL` and `GIT_COMMITTER_NAME/EMAIL` in the environment when committing. End commits with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Push all repos with `scripts/push-all.sh` (it skips Clinic `main`).

## 4. Founder decisions to remember

- Commissions: Kiorex may collect them; both the provider and Kiorex ops/admin see the same data (two-way visibility). Providers in Egypt are paid by bank transfer under CBE rules, including cash visits, through reconciliation and settlement. Commission accrued on cash visits is netted from the next bank payout; Kiorex never holds or pays out cash.
- Rates are per organisation type with per-organisation override, effective-dated, append-only, maker-checker (second super admin approves). Recommended defaults are shipped (Clinic 3% min EGP 10 cap EGP 75; Pharmacy 2% min 5 cap 100; Lab 3% min 10 cap 100; net from payout) as editable `SEEDED_DEFAULT` rows; disclosure texts are drafts pending counsel review; counsel sign-off stays NOT_REVIEWED so real-money modes stay blocked.
- Unpaid commission never pauses a provider's listing (SB-05, resolved).
- Clinic repo visibility: public (kept public for unlimited Actions minutes; make private later after checking minutes). The other repos are private.
- Local scratch databases `kiorex_pay_unified`, `kiorly_pay_unified`, `kiorly_telehealth` are kept; do not raise dropping them.
- Contracts registry publishing: deferred (founder chose to do nothing). Vendored tarballs keep working.
- Environments: kx-test=test, kx-pilot=pilot, kx-pro=prod. AWS for test now, Huawei Cloud the initial production decision (Egypt data residency), all configurable through OpenTofu (`infra/tofu`, `aws|huawei` switch). No dev Clinic copy: the existing AWS Clinic is kx-test's Clinic. ADR-059 and `_docs/registry/service-url-registry.yaml` are the canonical naming source.
- Demo data is removed from all login UIs and tagged for removal on request (`demo-data:remove`, dry-run default).
- LG-COM-20 decided: direct bank/InstaPay/card terminal count as cash-type tender recorded as its own kind CASH_TRANSFER with a configurable per-tender commission treatment.

## 4b. Updates of 27 to 28 Nov 2026 (new since the first version of this prompt)

- kx-test is live on AWS (account 990597228737, eu-central-1, one host, CloudFront per host, OpenTofu `infra/tofu`): Kiorex patient web, ops console, Passport, Pharmacy, Lab, platform API, Kiorly site (test.kiorly.com), Kiorly admin (admin.test.kiorly.com), Kiorly Home (app.test.kiorly.com), Clinic (clinics.test.kiorly.com; legacy host d92iz83i79c05.cloudfront.net stays). Host naming: `<service>.<env>.<domain>` (ADR-059/060); the registry `_docs/registry/service-url-registry.yaml` is the single source.
- ADR-060: an organisation (clinic, pharmacy, lab) belongs to its country for life; no market switch; the Kiorly admin launches Kiorly markets through a signed, audited Clinic route. The Kiorex gate `market.eg.live` is recorded ONLY by the founder (super_admin, Flags tab, Gate): never by code or an agent.
- The live Clinic demo password was rotated and the seed no longer resets passwords. Never use published demo credentials on a live system; the live account register is in the git-ignored `_private/DEMO_ACCOUNTS.md`.
- Passport sign-in limits (20 codes/hour/address by default) are configurable at `/account/ops/limits`; the live e2e suite can run about once per hour. MFA is optional unless Passport admin/ops enable it by policy (maker-checker).
- History of kiorex-workspace, kiorex-account and kiorex-platform was rewritten on 28 Nov 2026 to remove old demo TOTP secrets (backups outside the repos); re-clone old copies.
- Work in progress at the time of writing (check the handoff sections 19 and later for results): dual sign-in (Passport or e-mail and password) with one shared login component for Clinic, Pharmacy and Lab, and a password model for Lab (ADR-061); plans editable in the Kiorly admin and shown on the Kiorly landing page; lead pipeline end-to-end test; UI/UX review of all web surfaces; small open items (staff app errors, expo-dev-client in store builds, tofu demo opt-in, Kiorly-only role split).
- Founder-only items: recording `market.eg.live`, Apple/Google/EAS accounts, counsel sign-off and copy review, plan prices, provider credentials (email, WhatsApp, SMS, push, payments), the NEEDS_HUMAN sign-in decisions, DNS, purchases, real patient data migration.

## 5. What to do after reading

1. Reply with: your understanding in 15 lines or fewer, any contradictions you found between docs and code, and the state of each repo (`git status`, ahead/behind).
2. Then pick work from section 12 of the handoff, marked [E] (engineering). Items marked [H] or [D] need the founder: ask, do not guess.
3. When you finish an item, tick it in the handoff and the launch guide, commit, and report commit ids and test results honestly (including what you did not run).
