# Kiorex v2: demo data index (DEV ONLY)

> **DEV ONLY / synthetic.** Everything in the demo docs is fictional and local: phones `+20100000xxxx`, e-mails `@demo.kiorex.test` / `@demo.kiorly.local` / `@nurse-demo.kiorly.test`, passwords, the OTP `000000`, TOTP seeds and invitation tokens. They work only against the local stack, are blocked when `NODE_ENV=production` (and by the demo-seed guard), and must never be reused anywhere real. Providers are mocked everywhere (messages land in the dev inbox / log, PSP is `sandbox-fake`, video is `mock`); there is no tax-authority integration.
> Each repo has a `DEMO_DATA.md` (what the demo is, personas, data, step-by-step manual test scripts, role checklists, limitations). This file is the index. The older cross-product persona and flow tables stay in [TEST_DATA.md](TEST_DATA.md) (this index links to it instead of copying it). Every repo also keeps its seed reference in `Docs/TEST_DATA.md`.
> All facts were checked on **21 Nov 2026** against the seed scripts, the running APIs (curl) and the dev databases on `:5433` (read-only SELECTs).

## 1. Index: demo -> doc -> app -> seed

| Demo (product) | Repo doc | App URL (dev) | API | Seed command (idempotent unless noted) |
|---|---|---|---|---|
| **Kiorex Passport** (identity: OTP, families, orgs, invitations, ops TOTP) | [kiorex-account/DEMO_DATA.md](kiorex-account/DEMO_DATA.md) | http://localhost:4400/account · dev inbox `/dev/inbox` | :4400 | `cd kiorex-account && npm run db:seed:demo` (`npx tsx scripts/seed-demo.ts --reset` to re-create) |
| **Kiorly Clinic + Nurse edition** (clinic, 3 orgs, Basic clinic, solo + agency nurses, home visits, physio) | [clinics-management/DEMO_DATA.md](clinics-management/DEMO_DATA.md) | http://localhost:5174 (`npm run dev -w web`) | :3010 | `cd clinics-management/apps/api && npm run db:seed:demo` (`-- --reset`); `npm run db:seed:mobile` for Kiorly Work |
| **Kiorly Pharmacy** (chain, solo, Lite) | [kiorly-pharmacy/DEMO_DATA.md](kiorly-pharmacy/DEMO_DATA.md) | http://localhost:5190 (clash: see section 3) | :3100 | `cd kiorly-pharmacy/apps/api && npm run seed:all` (= seed, seed:demo, seed:suite, seed:mobile); no true reset |
| **Kiorly Lab** (LIS: PRO, chain, Basic) | [kiorly-lab/DEMO_DATA.md](kiorly-lab/DEMO_DATA.md) | http://localhost:5191 (clash: see section 3) | :3200 | `cd kiorly-lab/apps/api && npm run db:seed && npm run db:seed:demo && npm run db:seed:mobile`; no true reset |
| **Kiorex platform**: patient web, patient Expo app, ops console, marketplace, Kiorex Pay | [kiorex-platform/DEMO_DATA.md](kiorex-platform/DEMO_DATA.md) | patient web http://localhost:5180 · Expo web http://localhost:8081 · ops http://localhost:5181 | :4000 | `cd kiorex-platform/apps/api && npm run db:seed:demo` (needs the Kiorly seed + provider sync first) |
| **Kiorly Work** (staff mobile app: Clinic + Pharmacy + Lab modules, Basic/Lite gate) | [kiorly-work/DEMO_DATA.md](kiorly-work/DEMO_DATA.md) | Expo web http://localhost:8082 (`npm run web`), iOS / Android via Expo | uses :3010 / :3100 / :3200 | the three `*:mobile` seeds above |
| **Kiorex contracts** (fixtures only, no service) | [kiorex-contracts/DEMO_DATA.md](kiorex-contracts/DEMO_DATA.md) | n/a | n/a | none: `npm test` |
| **All products, in order** | this file + [TEST_DATA.md](TEST_DATA.md) | all of the above | | `scripts/seed-all.sh [--reset]` (see section 2) |

## 2. Start the stack and seed everything

```bash
# 1) Postgres :5433 + the five APIs (Passport :4400, Kiorly :3010, Kiorex :4000, Pharmacy :3100, Lab :3200)
e2e/scripts/up.sh --build --seed        # first time; afterwards just e2e/scripts/up.sh   (stop: e2e/scripts/down.sh)
# 2) demo data in dependency order: Passport -> Kiorly (incl. Nurse tenants) -> Pharmacy -> Lab -> provider sync -> Kiorex
scripts/seed-all.sh                     # idempotent; add --reset to remove demo records first (never non-demo data)
# 3) staff-app seeds that seed-all.sh does NOT run (pharmacy seed:all already includes its own)
(cd clinics-management/apps/api && npm run db:seed:mobile)
(cd kiorly-lab/apps/api && npm run db:seed:mobile)
# 4) the web apps you want to look at (each is a Vite dev server; the APIs are already running)
(cd clinics-management && npm run dev -w web)     # :5174
(cd kiorex-platform && npm run dev -w apps/web)   # :5180
(cd kiorex-platform && npm run dev -w apps/ops)   # :5181
(cd kiorex-platform && npm run mobile:web)        # :8081 patient app
(cd kiorly-pharmacy && PHARMACY_WEB_PORT=5192 npm run dev -w web)   # use 5192 if 5190 is taken
(cd kiorly-lab && LAB_WEB_PORT=5193 npm run dev -w web)             # use 5193 if 5191 is taken
(cd kiorly-work && npm run web)                    # :8082 staff app
```

Rules that apply to every seed:
* Seeds run only with `DEMO_SEED_ALLOWED=true` in a non-production environment (the npm scripts and `seed-all.sh` set it). Seeds use `connection_limit=3` because the shared Postgres has `max_connections=100`.
* **Do not run `seed-all.sh --reset` while other people or agents use the live stack** (it deletes and re-creates demo records and can restart the Passport IdP). Pharmacy and Lab ledgers, released reports, QC runs and audit are append-only: `--reset` cannot remove them, a full wipe means recreating the database.
* Dates are relative to the seed day; the live home visits are relative to the seed instant (`DEMO_SEED_NOW`), so re-run with `--reset` every few days. After the e2e suite (`cd e2e && npm test`) re-run `seed-all.sh` (the suite revokes some dev gate evidence) and expect e2e leftovers in the dev databases (counts in the docs are snapshots).
* Never touch ports 3000 / 5173 / 5175 (the founder's other checkout).

## 3. Ports and clashes

| Port | Service | Note |
|---|---|---|
| 5433 | Postgres | user `postgres` / `postgres` (DEV ONLY) |
| 4400 / 4401 | Passport dev IdP / second fake upstream | |
| 3010 / 5174 | Kiorly Clinic API / web | |
| 4000 / 5180 / 5181 / 8081 | Kiorex API / patient web / ops console / patient Expo app | |
| 3100 / 5190 | Pharmacy API / web | **5190 is also the default web port of the Kiorly Clinic *main* checkout** (`scripts/local-dev-ports.sh`: main = API 3020, web 5190, docs 5191). When that checkout runs, `http://localhost:5190` is Clinic, not Pharmacy. |
| 3200 / 5191 | Lab API / web | **5191 is the Clinic main checkout's docs server.** Same clash. |
| 8082 | Kiorly Work (Expo web) | |

Workaround used in the docs: `PHARMACY_WEB_PORT=5192` and `LAB_WEB_PORT=5193` (the Vite configs honour them; the APIs proxy through Vite so no CORS change is needed).

## 4. Shared logins in one place

* Passport phone OTP for **every** demo phone: `000000`. Staff password `Demo@12345`. Lab: dev-login (org slug + `<role>@<slug>.test`, no password). Legacy `demo` password only for the older Clinic accounts (`admin@kiorly.com`, `superadmin@kiorly.com`, `admin@drahmedshall.com`).
* Ops TOTP seeds (Base32): super admin `+201000000099` -> `REMOVED-OLD-DEMO-TOTP-SECRET`; admin `+201000009001` -> `REMOVED-OLD-DEMO-TOTP-SECRET`; finance `+201000009002` -> `REMOVED-OLD-DEMO-TOTP-SECRET`; support `+201000009003` enrols on first sign-in.
* The persona -> app -> login map, the flow -> persona -> click table (Q10) and the Rev 2.3 Nurse / home-visit description stay in [TEST_DATA.md](TEST_DATA.md); the per-product docs above add the step-by-step scripts and the role checklists.

## 5. Cross-product flows (end to end): which docs to follow

| Flow | Start | Then | Docs |
|---|---|---|---|
| Book a doctor, pay a deposit, check in, review | Kiorex patient web K1-K5 | Kiorly front desk C1/C5, completion, review | [platform](kiorex-platform/DEMO_DATA.md), [clinic](clinics-management/DEMO_DATA.md) |
| Pharmacy order from the patient app | platform K6 | Pharmacy PH5 (accept, ready, dispense) | [platform](kiorex-platform/DEMO_DATA.md), [pharmacy](kiorly-pharmacy/DEMO_DATA.md) |
| Lab booking and result in the vault | platform K7 | Lab L7 (receive, validate, release) | [platform](kiorex-platform/DEMO_DATA.md), [lab](kiorly-lab/DEMO_DATA.md) |
| Nurse sample -> Lab -> result back (KNLAB01) | Clinic C10 | Lab L3 / L6 | [clinic](clinics-management/DEMO_DATA.md), [lab](kiorly-lab/DEMO_DATA.md) |
| Home visit booking, timeline, SOS, held deposit | platform K11 / K14 | Clinic C7 / C8 (nurse, dispatcher) | [platform](kiorex-platform/DEMO_DATA.md), [clinic](clinics-management/DEMO_DATA.md) |
| Plan gate: Basic / Lite across the staff app | Kiorly Work W12 | the three Basic tenants | [work](kiorly-work/DEMO_DATA.md) |
| Flag off -> 403 FEATURE_DISABLED | platform K15 | any product | [platform](kiorex-platform/DEMO_DATA.md) |
| Guardian, organisation, invitation, account-link | Passport P3-P8 | ops queue | [passport](kiorex-account/DEMO_DATA.md) |

## 6. Verification log (21 Nov 2026)

Logins actually exercised against the running stack: **Passport/Kiorex** Hoda `+201000001001` through the full OIDC code + PKCE flow (token accepted by `GET :4000/api/v1/me/profile`, name and sub match), ops super admin `+201000000099` with OTP + computed TOTP (`GET :4000/api/v1/admin/flags` -> 200); **Clinic** about 25 logins (all clinic staff roles of `na` / `ss` / `df` / Basic / Nurse tenants) + the three legacy `demo` accounts; **Pharmacy** all 15 logins (base, solo, Lite); **Lab** all 27 dev-logins (3 tenants x 9 roles); **Kiorly Work** `/mobile/bootstrap` for every login above (the matrices come from it), BASIC gate re-checked (403 `FEATURE_DISABLED` on `/mobile/schedule`, `/mobile/pharmacy/controlled/pending-witness`, `/mobile/summary`; 200 on bootstrap and alerts); **Contracts** `npm test` (116 passed) and a signed `GET :3010/marketplace/v1/providers` -> 200. Not exercised: the web UIs (not running at the time), `+201000009001/2` TOTP logins (secrets confirmed in the DB only), `+201000009003` enrolment, native iOS / Android runs.

## 7. Inconsistencies found (existing docs, seeds and environment)

1. **Port clash 5190 / 5191** between Pharmacy / Lab web and the Clinic *main* checkout (web / docs) running on the same Mac; `TEST_DATA.md` lists 5190 / 5191 as Pharmacy / Lab only.
2. `clinics-management` (branch `kiorex`) `npm run dev` runs `scripts/free-dev-ports.sh`, which kills whatever listens on 3000, 5173, 5174, 5175 and 4175 (the founder's other checkout). Use `npm run dev -w web` instead.
3. **Pharmacy `RecallNotice` is empty** while lot `DM00013` is RECALLED ("Recalled (DEMO-RECALL-001)"): dangling after a `--reset` (append-only lots stay). Docs claim a notice `DEMO-RECALL-001` exists.
4. Pharmacy numbers: docs say 343 catalogue drugs and 5 suppliers; live: 299 tenant drugs (560 table rows), 6 suppliers; demo order `kx_ph_demo_3` documented as "new" is EXPIRED (SLA job) on the pharmacy side and REJECTED in Kiorex.
5. Kiorex flag registry has **68** definitions (`TEST_DATA.md` says 52); 14 demo providers are LIVE (docs: "13 doctors"), plus 3 older KX-DEV ones and 3 DELISTED duplicates.
6. Passport link requests: `pending_review` is for secondary `+201000001009` and `pending_verification` for `+201000001010` (docs say "1011/1009"). The support account `+201000009003` already has an unconfirmed TOTP credential (docs say "none": it must enrol on first sign-in).
7. Delta Family Clinics has 40 patients (docs 39); Smile & Skin is a LITE-base org on a CLINIC trial.
8. **Mona's tenant `demo_t_nsolo` holds 42 extra home-visit rows** (cuid ids) from integration/e2e runs on top of the 10 seeded: 52 rows (22 cancelled, 8 arrived), so the seeded "today route" is noisy.
9. The API returns the group-admin tab set (Admin, Clinics, Encounters, Patients, Revenue, Expenses, Reports) for FINANCE_OFFICER and BRANCH_MANAGER, while `clinics-management/Docs/Test_Data_Users.md` says finance officers have "no Admin".
10. Lab: dev-login e-mails use short role names (`tech@`, `phleb@`, `signatory@`), not "technologist"; `kx_lb_demo_7` is CANCELLED in the lab but REJECTED in Kiorex (consistent mapping, easy to misread); all current critical alerts are already ESCALATED; the dev DB holds 248 `demo-lab` orders (about 40-50 seeded, rest e2e).
11. `kiorex-contracts/fixtures/demo-personas.json` has 20 personas while the Passport seed has 35 (missing Nabila, the Nurse cast, the ops super admin and the e2e fixtures).
12. `kiorex-contracts/docs/USAGE.md` says the signed path is the "full path incl. /api/v1"; the Kiorly marketplace API actually answers at `/marketplace/v1/...` (signing `/marketplace/v1/providers` returns 200).
13. `scripts/seed-all.sh` does not run the Kiorly Work seeds (`db:seed:mobile` of Clinic and Lab); the Basic clinic and the `chain-lab` / `basic-lab` tenants exist only after they are run by hand.
14. `kiorly-work` has **no README.md** (one pointer file was created to link `DEMO_DATA.md`); its `.env.local` points at an alternate stack (3011 / 3190 / 3250); `Docs/ARCHITECTURE.md` says Xcode is absent while Xcode and an iPhone simulator exist now; the workspace README still draws kiorly-work as "planned".
15. Dev databases carry e2e leftovers (hundreds of `kx-e2e-*` pharmacy orders, 41 safety alerts, 1,348 Kiorex booking intents, 124 lab home-collection rows, an `E2E Till Branch (test)`), so counts in any doc are snapshots; the states are what the seeds guarantee.
16. The workspace Clinic API on :3010 was down for several minutes during this review (another process restarted it); nothing in the docs depends on it staying up.
