# Kiorex v2: demo data index (DEV ONLY)

> **DEV ONLY / synthetic.** Everything in the demo docs is fictional and local: phones `+20100000xxxx`, e-mails `@demo.kiorex.test` / `@demo.kiorly.local` / `@nurse-demo.kiorly.test`, passwords, the OTP `000000`, TOTP seeds and invitation tokens. They work only against the local stack, are blocked when `NODE_ENV=production` (and by the demo-seed guard), and must never be reused anywhere real. Providers are mocked everywhere (messages land in the dev inbox / log, PSP is `sandbox-fake`, video is `mock`); there is no tax-authority integration.
> Each repo has a `DEMO_DATA.md` (what the demo is, personas, data, step-by-step manual test scripts, role checklists, limitations). This file is the index. The older cross-product persona and flow tables stay in [TEST_DATA.md](TEST_DATA.md) (this index links to it instead of copying it). Every repo also keeps its seed reference in `Docs/TEST_DATA.md`.
> All facts were checked on **21 Nov 2026** against the seed scripts, the running APIs (curl) and the dev databases on `:5433` (read-only SELECTs).

## 1. Index: demo -> doc -> app -> seed

| Demo (product) | Repo doc | App URL (dev) | API | Seed command (idempotent unless noted) |
|---|---|---|---|---|
| **Kiorex Passport** (identity: OTP, families, orgs, invitations, ops TOTP) | [kiorex-account/DEMO_DATA.md](kiorex-account/DEMO_DATA.md) | http://localhost:4400/account · dev inbox `/dev/inbox` | :4400 | `cd kiorex-account && npm run db:seed:demo` (`npx tsx scripts/seed-demo.ts --reset` to re-create) |
| **Kiorly Clinic + Nurse edition** (clinic, 3 orgs, Basic clinic, solo + agency nurses, home visits, physio) | [clinics-management/DEMO_DATA.md](clinics-management/DEMO_DATA.md) | http://localhost:5174 (`npm run dev -w web`) | :3010 | `cd clinics-management/apps/api && npm run db:seed:demo` (`-- --reset`); `npm run db:seed:mobile` for Kiorly |
| **Kiorly Pharmacy** (chain, solo, Lite) | [kiorly-pharmacy/DEMO_DATA.md](kiorly-pharmacy/DEMO_DATA.md) | http://localhost:5192 (was 5190, see section 3) | :3100 | `cd kiorly-pharmacy/apps/api && npm run seed:all` (= seed, seed:demo, seed:suite, seed:mobile); no true reset |
| **Kiorly Lab** (LIS: PRO, chain, Basic) | [kiorly-lab/DEMO_DATA.md](kiorly-lab/DEMO_DATA.md) | http://localhost:5193 (was 5191, see section 3) | :3200 | `cd kiorly-lab/apps/api && npm run db:seed && npm run db:seed:demo && npm run db:seed:mobile`; no true reset |
| **Kiorex platform**: patient web, patient Expo app, ops console, marketplace, Kiorex Pay | [kiorex-platform/DEMO_DATA.md](kiorex-platform/DEMO_DATA.md) | patient web http://localhost:5180 · Expo web http://localhost:8081 · ops http://localhost:5181 | :4000 | `cd kiorex-platform/apps/api && npm run db:seed:demo` (needs the Kiorly seed + provider sync first) |
| **Kiorly** (staff mobile app: Clinic + Pharmacy + Lab modules, Basic/Lite gate) | [kiorly/DEMO_DATA.md](kiorly/DEMO_DATA.md) | Expo web http://localhost:8082 (`npm run web`), iOS / Android via Expo | uses :3010 / :3100 / :3200 | the three `*:mobile` seeds above |
| **Kiorex contracts** (fixtures only, no service) | [kiorex-contracts/DEMO_DATA.md](kiorex-contracts/DEMO_DATA.md) | n/a | n/a | none: `npm test` |
| **All products, in order** | this file + [TEST_DATA.md](TEST_DATA.md) | all of the above | | `scripts/seed-all.sh [--reset]` (see section 2; includes the Kiorly staff-app seeds) |

## 2. Start the stack and seed everything

```bash
# 1) Postgres :5433 + the five APIs (Passport :4400, Kiorly :3010, Kiorex :4000, Pharmacy :3100, Lab :3200)
e2e/scripts/up.sh --build --seed        # first time; afterwards just e2e/scripts/up.sh   (stop: e2e/scripts/down.sh)
# 2) demo data in dependency order: Passport -> Kiorly (incl. Nurse tenants) -> Pharmacy -> Lab -> provider sync -> Kiorex
scripts/seed-all.sh                     # idempotent; add --reset to remove demo records first (never non-demo data)
#    seed-all.sh also runs the three Kiorly staff-app seeds (Clinic and Lab db:seed:mobile, Pharmacy seed:mobile), each right after its base demo seed; they are idempotent
# 4) the web apps you want to look at (each is a Vite dev server; the APIs are already running)
(cd clinics-management && npm run dev -w web)     # :5174 (`npm run dev` now frees only this branch's own ports; `KIORLY_FREE_ALL_PORTS=1` restores the old wide sweep)
(cd kiorex-platform && npm run dev -w apps/web)   # :5180
(cd kiorex-platform && npm run dev -w apps/ops)   # :5181
(cd kiorex-platform && npm run mobile:web)        # :8081 patient app
(cd kiorly-pharmacy && npm run dev -w web)         # :5192 (PHARMACY_WEB_PORT overrides)
(cd kiorly-lab && npm run dev -w web)              # :5193 (LAB_WEB_PORT overrides)
(cd kiorly && npm run web)                    # :8082 staff app
# native dev build (iOS simulator / Android emulator) and push payload fixtures: kiorly/README.md (expo run:ios, e2e-push/send.sh)
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
| 3100 / 5192 | Pharmacy API / web | Web port configurable with `PHARMACY_WEB_PORT`. It was 5190, which is the default web port of the Kiorly Clinic *main* checkout (`scripts/local-dev-ports.sh`: main = API 3020, web 5190, docs 5191), so the default is now 5192. |
| 3200 / 5193 | Lab API / web | Web port configurable with `LAB_WEB_PORT`. It was 5191 (the Clinic main checkout's docs server), the default is now 5193. |
| 8082 | Kiorly (Expo web) | |
| 5175 | Clinic docs portal on branch `kiorex` (`npm run dev` at the clinic repo root; `main` uses 3020 / 5190 / 5191, see `clinics-management/scripts/local-dev-ports.sh`) | |

The Vite configs of Pharmacy and Lab honour `PHARMACY_WEB_PORT` / `LAB_WEB_PORT` (defaults 5192 / 5193, start-up of both checked on 21 Nov 2026); the APIs proxy through Vite so no CORS change is needed. Dev scripts in every repo were reviewed: only `clinics-management` had a port-killing script (now limited to its own ports); the others (`kiorly-pharmacy`, `kiorly-lab`, `kiorex-platform`, `kiorex-account`, `kiorly`) kill nothing.

## 4. Shared logins in one place

* Passport phone OTP for **every** demo phone: `000000`. Staff password `Demo@12345`. Lab: dev-login (org slug + `<role>@<slug>.test`, no password). Legacy password **`demo`** (not `Demo@12345`) only for the older Clinic accounts (`admin@kiorly.com`, `superadmin@kiorly.com`, `admin@drahmedshall.com`).
* Ops TOTP seeds (Base32): super admin `+201000000099` -> `<local seed +201000000099>`; admin `+201000009001` -> `<local seed +201000009001>`; finance `+201000009002` -> `<local seed +201000009002>`; support `+201000009003` has an unconfirmed TOTP row and no seeded secret, so it enrols on first sign-in. Finance and support are role claims only (the API treats every `ops_admin` alike).
* The persona -> app -> login map, the flow -> persona -> click table (Q10) and the Rev 2.3 Nurse / home-visit description stay in [TEST_DATA.md](TEST_DATA.md); the per-product docs above add the step-by-step scripts and the role checklists.

## 5. Cross-product flows (end to end): which docs to follow

| Flow | Start | Then | Docs |
|---|---|---|---|
| Book a doctor, pay a deposit, check in, review | Kiorex patient web K1-K5 | Kiorly front desk C1/C5, completion, review | [platform](kiorex-platform/DEMO_DATA.md), [clinic](clinics-management/DEMO_DATA.md) |
| Pharmacy order from the patient app | platform K6 | Pharmacy PH5 (accept, ready, dispense) | [platform](kiorex-platform/DEMO_DATA.md), [pharmacy](kiorly-pharmacy/DEMO_DATA.md) |
| Lab booking and result in the vault | platform K7 | Lab L7 (receive, validate, release) | [platform](kiorex-platform/DEMO_DATA.md), [lab](kiorly-lab/DEMO_DATA.md) |
| Nurse sample -> Lab -> result back (KNLAB01) | Clinic C10 | Lab L3 / L6 | [clinic](clinics-management/DEMO_DATA.md), [lab](kiorly-lab/DEMO_DATA.md) |
| Home visit booking, timeline, SOS, held deposit | platform K11 / K14 | Clinic C7 / C8 (nurse, dispatcher) | [platform](kiorex-platform/DEMO_DATA.md), [clinic](clinics-management/DEMO_DATA.md) |
| Plan gate: Basic / Lite across the staff app | Kiorly W12 | the three Basic tenants | [work](kiorly/DEMO_DATA.md) |
| Flag off -> 403 FEATURE_DISABLED | platform K15 | any product | [platform](kiorex-platform/DEMO_DATA.md) |
| Guardian, organisation, invitation, account-link | Passport P3-P8 | ops queue | [passport](kiorex-account/DEMO_DATA.md) |

## 5b. Staff app changes (22 Nov 2026)
The staff app is now plain **Kiorly** (final name, ADR-037, 23 Nov 2026; earlier Kiorly Work and Kiorly Team; repo `kiorly`; bundle id `com.kiorly.app`): sign-in tiles Clinic / Nurse / Pharmacy / Lab (Nurse signs in through the Clinic API and lands on home-visit rounds), the bottom tab bar on every screen, a confirmed sign-out (Home header and Me), the brand lockup header, a flat native splash that hands off to the animated one, and nurses no longer get the doctor's Lab results queue (sample collection stays under home visits). The patient app gets the same persistent tab bar and sign-out. Details: [kiorly-team/DEMO_DATA.md](kiorly-team/DEMO_DATA.md), [_docs/mobile/DEVICE_TEST_REPORT_2026-11-20.md](_docs/mobile/DEVICE_TEST_REPORT_2026-11-20.md).

## All 36 specialties (added 22 Nov 2026)
Every Kiorex specialty (36 codes) now has 2 LIVE verified doctors, with bookable slots, 3 demo bookings in varied states, 14 home-visit doctors and 11 video bookings: new Kiorly tenant `demo_t_sp` (72 doctors, staff logins `<key>.sp@demo.kiorex.test` / `Demo@12345`, owner `owner.sp@`), provider-synced into Kiorex, bookings for the demo patients `+201000001001`..`1012` (OTP `000000`). The full specialty -> doctor -> login/slug -> booking table is in [TEST_DATA.md](TEST_DATA.md) (section "All 36 specialties"). Seed order is unchanged (`scripts/seed-all.sh`).

## 6. Verification log (21 Nov 2026)

Logins actually exercised against the running stack: **Passport/Kiorex** Hoda `+201000001001` through the full OIDC code + PKCE flow (token accepted by `GET :4000/api/v1/me/profile`, name and sub match), ops super admin `+201000000099` with OTP + computed TOTP (`GET :4000/api/v1/admin/flags` -> 200); **Clinic** about 25 logins (all clinic staff roles of `na` / `ss` / `df` / Basic / Nurse tenants) + the three legacy `demo` accounts; **Pharmacy** all 15 logins (base, solo, Lite); **Lab** all 27 dev-logins (3 tenants x 9 roles); **Kiorly** `/mobile/bootstrap` for every login above (the matrices come from it), BASIC gate re-checked (403 `FEATURE_DISABLED` on `/mobile/schedule`, `/mobile/pharmacy/controlled/pending-witness`, `/mobile/summary`; 200 on bootstrap and alerts); **Contracts** `npm test` (116 passed) and a signed `GET :3010/marketplace/v1/providers` -> 200. Not exercised: the web UIs (not running at the time), `+201000009001/2` TOTP logins (secrets confirmed in the DB only), `+201000009003` enrolment, native iOS / Android runs.

## 7. Inconsistencies found (status 2026-11-21)

**Fixed on 2026-11-21**

1. Port clash 5190 / 5191: Pharmacy and Lab web now default to 5192 / 5193 (configurable `PHARMACY_WEB_PORT` / `LAB_WEB_PORT`) in the Vite configs, scripts and every doc; start-up of both verified.
2. `clinics-management` `npm run dev` now frees only this branch's own ports (scoped 21 Nov); `KIORLY_FREE_ALL_PORTS=1` restores the wide sweep.
3. Pharmacy `RecallNotice`: `seed:demo` now re-creates the `DEMO-RECALL-001` notice for lot `DM00013` when it is missing (verified: notice linked to the lot).
4. Pharmacy numbers corrected: 259 shared catalogue rows (44 base + 215 generated; the live 524 tenant drugs and 32 suppliers include 523 `E2E-Med-*` drugs and 27 `E2E Supplier` rows), 5 seeded suppliers (the earlier "6 live" was an e2e leftover); `kx_ph_demo_3` is EXPIRED at the pharmacy and REJECTED (`SLA_EXPIRED`) in Kiorex, now documented as such.
5. Kiorex flag registry: 68 definitions (docs said 52); 14 demo providers LIVE (docs said 13 doctors; plus 3 older KX-DEV LIVE, 2 demo PAUSED, 3 DELISTED).
6. Passport link requests: `+201000001009` is `pending_review`, `+201000001010` is `pending_verification` (docs said 1011/1009); `+201000009003` already has an unconfirmed TOTP row (still enrols on first sign-in).
7. Delta Family Clinics has 40 patients (docs said 39).
8. `demo_t_nsolo` home visits: 10 seeded + 56 extra test rows = 66 (22 cancelled, 9 arrived); agency tenant 45 (22 seeded + 23 extra). The extras come from e2e runs and keep growing.
9. `kiorex-contracts/fixtures/demo-personas.json` now holds all 35 Passport personas (phones and subs match `seed-users.json`); `npm test` 116 passed.
10. `kiorex-contracts/docs/USAGE.md`: the signed path is `/marketplace/v1/...` (verified live: 200; the `/api/v1/marketplace/...` form is 404).
11. `scripts/seed-all.sh` now runs the Clinic, Pharmacy and Lab Kiorly staff-app seeds (`db:seed:mobile` / `seed:mobile`) in dependency order; ran twice without errors (idempotent).
12. Lab: one critical alert is now deliberately OPEN (`DEMO-OPEN-ALERT-001`, K 6.9, deadline a year ahead); the other alerts stay ESCALATED / ACKNOWLEDGED.
13. `admin@kiorly.com`, `superadmin@kiorly.com`, `admin@drahmedshall.com` use the password `demo` (bcrypt-checked), now stated in the Test data tables; all other staff use `Demo@12345`.
14. `kiorly`: `README.md` now exists; `.env.local` (git-ignored override) now equals `.env.example` (3010 / 3100 / 3200) and the doc explains that `.env.local` wins.
15. Ops `finance` and `support` are role claims only (documented in the Passport, Kiorex and index docs).

**Still open**

* Docs drift not touched here: `kiorly/Docs/ARCHITECTURE.md` says Xcode is absent (Xcode and an iPhone simulator exist now) and the workspace README still draws kiorly as "planned" (not touched here).
* The API returns the group-admin tab set for BRANCH_MANAGER (documented; FINANCE_OFFICER was fixed by the roles work).
* Dev databases carry e2e leftovers (hundreds of `kx-e2e-*` pharmacy orders, 41+ safety alerts, 1,348+ Kiorex booking intents, 124 lab home-collection rows, an `E2E Till Branch (test)`, 248+ `demo-lab` orders), so counts in every doc are snapshots; the states are what the seeds guarantee.
* Lab: dev-login e-mails use short role names (`tech@`, `phleb@`, `signatory@`); `kx_lb_demo_7` is CANCELLED in the lab but REJECTED in Kiorex (consistent mapping, easy to misread).
* Not run: `seed-all.sh --reset` and the full `seed-all.sh` (Passport restart risk); the individual seeds it calls were run twice instead. Web UIs were not exercised.

---
Verified: 2026-11-21
