# Kiorex v2 — synthetic QA / demo data (DEV ONLY)

> **DEV ONLY.** Everything below is fictional: names, phones (`+20100000xxxx`), e-mails (`@demo.kiorex.test`), ids. Passwords/OTPs/TOTP seeds are
> local development values, never used in staging/production, and are blocked when `NODE_ENV=production`.
> No tax-authority integration exists anywhere; VAT appears only as a plain configurable % line (14 %) on invoices.
> Providers are mocked (messages land in the dev inbox / message log; PSP is `sandbox-fake`; video is `mock`).
> Each repo has its own `TEST_DATA.md`; this file is the cross-product index.

## Run / reset
```bash
e2e/scripts/up.sh            # stack running (first time: --build --seed)
scripts/seed-all.sh          # idempotent, dependency order: Passport -> Kiorly Clinic (incl. the Nurse edition tenants, Rev 2.3 home visits) -> Pharmacy -> Lab -> provider sync -> Kiorex (incl. home bookings)
scripts/seed-all.sh --reset  # first removes the demo records only (non-demo data and the e2e fixtures are never touched)
scripts/seed-staging.sh --dry-run   # AWS staging (non-production only, after a human deployed it): prints the plan; see "Seeding staging on AWS" below
```
Every demo seed refuses to run unless `DEMO_SEED_ALLOWED=true` **and** the environment is non-production (see "Guard" below); `seed-all.sh` and the repos' `npm run` seed scripts set it for local runs. The seeds use `connection_limit=3` because the shared Postgres has `max_connections=100`.
Dates are relative to *today* when seeding (-45 … +14 days). The Rev 2.3 home visits that are "live" (en route / arrived / just aborted) are relative to the seed instant (`DEMO_SEED_NOW`, exported by seed-all.sh to both repos), so re-run with `--reset` to get fresh live ones: the Kiorly safety scheduler (15 s tick) will, like in real life, prompt/alert on an *arrived* visit nobody answers about 40 min after the seed. Re-run with `--reset` every few days to re-anchor them. Run the e2e suite (`cd e2e && npm test`)
then re-run `scripts/seed-all.sh` (e2e cleanup revokes some dev gate evidence). Pharmacy/Lab ledgers are append-only by design: `--reset` removes
the demo sales/Rx/POs/orders it can, but lots, released reports and QC runs stay (see each repo's TEST_DATA.md); for a full wipe recreate the DB.

## Passwords / codes
| What | Value |
|---|---|
| Passport phone OTP (all demo phones below + `+201000000001/2/99`) | `000000` |
| Staff password (Kiorly Clinic demo orgs, Pharmacy base logins) | `Demo@12345` |
| Ops super admin TOTP seed (`+201000000099`) | `REMOVED-OLD-DEMO-TOTP-SECRET` |
| Ops admin (`+201000009001`) TOTP seed | `REMOVED-OLD-DEMO-TOTP-SECRET` |
| Ops finance (`+201000009002`) TOTP seed | `REMOVED-OLD-DEMO-TOTP-SECRET` |
Add the secret to any authenticator app (or compute RFC 6238, SHA-1, 30 s, 6 digits) for the ops console TOTP step.

## URLs
Kiorly Clinic web http://localhost:5174 (API :3010) · Kiorex patient web http://localhost:5180 · Ops console http://localhost:5181 · Expo web http://localhost:8081 ·
Passport http://localhost:4400/account (dev inbox `/dev/inbox`) · Pharmacy web http://localhost:5190 (API :3100) · Lab web http://localhost:5191 (API :3200) · Kiorex API :4000 · Postgres :5433.

## Persona -> app -> login
| Persona | App | URL | Login |
|---|---|---|---|
| Hoda Mahmoud / هدى محمود (mother; guardian of Yassin 8y + Laila 4y; co-guardian Samir `+201000001002`) | Kiorex patient web / Expo / Passport | :5180 / :8081 / :4400/account | phone `+201000001001`, OTP `000000` |
| Karim Mostafa (legal guardian of Salma, 15) | same | same | `+201000001003` |
| Mahmoud El-Sayed (cardiology patient, guardian of Adam, 2y) | same | same | `+201000001005` |
| Other demo patients: Nourhan `…1004`, Mariam `…1006`, Omar `…1007`, Dalia `…1008`, Tarek `…1009`, Heba `…1010`, Youssef `…1011`, Rana `…1012` | same | same | `+20100000` + last 4 digits, OTP `000000` |
| Amira (`+201000000001`), Hassan (`+201000000002`) | e2e fixtures (do not edit) | | OTP `000000` |
| Ahmed Fawzy (org owner, org "Nile Care Medical Center (DEMO)") | Passport orgs | :4400/account/orgs | `+201000002001` |
| Sara Lotfy (receptionist member), Dr Amr Salem (doctor member) | Passport orgs | | `+201000002002`, `+201000002003` |
| Mostafa Reda (pharmacist member), Dina Wagdy (lab technician member) | Passport orgs | | `+201000002004`, `+201000002005` |
| Kiorly Nurse: solo nurse Mona Adel (owner of "Demo Home Nursing (Mona)", also a member of the agency) | Passport orgs (edition NURSE) / Kiorly web Nurse view | :4400/account/orgs / :5174 | `+201000003001` OTP `000000` -> "Sign in with Kiorex Passport", or `mona@nurse-demo.kiorly.test` / `Demo@12345` |
| Kiorly Nurse agency "Demo Care Agency": owner / dispatcher Dina / nurses Heba, Salma, Nadine, Rawan, Yara / aide Aya | same | same | Passport `+201000003002` / `3003` / `3004` `3005` `3007` `3008` `3009` / `3006`; Kiorly `owner@`, `dispatch@`, `nurse1@`…`nurse5@`, `aide@nurse-demo.kiorly.test` / `Demo@12345` |
| Noha Nurse (pending invitation to the agency, token `demo-invite-agency-nurse`), Dr Mai Hassan (physiotherapist, Nile Care) | Passport / Kiorly | | `+201000003011` / `+201000003010` (Kiorly `mai.na@demo.kiorex.test` / `Demo@12345`) |
| Nabila Hamdy / نبيلة حمدي (68, agency home-care client: care plan, MAR, shifts) | Kiorex patient web / Expo | :5180 / :8081 | `+201000001013`, OTP `000000` |
| Ops super admin | Ops console | :5181 | `+201000000099` + OTP + TOTP |
| Ops admin / finance / support | Ops console | :5181 | `+201000009001` (TOTP) / `+201000009002` (TOTP) / `+201000009003` |
| Org owner (group admin) | Kiorly Clinic | :5174 | `owner.na@demo.kiorex.test` / `Demo@12345` (tenants: `na` Nile Care, `df` Delta, `ss` Smile & Skin) |
| Branch manager / front desk / nurse / accountant / call-centre | Kiorly Clinic | :5174 | `manager.na@…`, `frontdesk1.na@…`, `frontdesk2.na@…`, `nurse.na@…`, `accountant.na@…`, `callcenter.na@…` (same for `.df` `.ss`) |
| Doctors (Nile Care): paediatrics `nadia`, dermatology `walid`, cardiology `tamer`, ob-gyn `rania`, dentistry `khaled`, ortho `hossam`, ENT `ingy`, internal medicine `sherif` | Kiorly Clinic | :5174 | `<name>.na@demo.kiorex.test` |
| Doctors (Delta): `ola` paediatrics, `medhat` family medicine, `samah` ophthalmology (listing PAUSED) · (Smile & Skin): `lamia` dermatology, `adham` dentistry (pending verification) | Kiorly Clinic | :5174 | `<name>.df@…` / `<name>.ss@…` |
| Pre-existing Kiorly demo data (kept) | Kiorly Clinic | :5174 | `admin@kiorly.com` etc. (`demo`), KX-DEV doctors `kxdev.*@kiorly.dev` (e2e) |
| Pharmacy owner / pharmacist / cashier / manager | Pharmacy | :5190 | `owner|pharmacist|cashier|manager@demo.kiorly.local` / `Demo@12345` |
| Lab owner / director / signatory / tech / phlebotomist / reception | Lab | :5191 | dev-login screen, org `demo-lab`, pick the role (`<role>@demo-lab.test`) |

## What exists, where to click
**Kiorly Clinic (3 orgs).** Dashboard (set reporting period to the last 60 days) · Appointments: list + calendar, all statuses, sources (Front desk, Phone, Walk-in, Clinic link, Kiorex WhatsApp, Kiorex marketplace) · Front desk board (`na`: 4 checked-in walk-ins WAITING/CALLED/IN_EXAM) ·
Patients (70/39/24 with allergies, problems, families) → patient → encounters with SOAP/diagnosis/prescription (QR token) and lab/imaging orders · Revenue / Invoices (14 % VAT line, paid + receivable) · Expenses (approved/pending/rejected) ·
Waitlist · Recall campaigns · Kiorex → listings (LIVE / PAUSED / PENDING verification), reviews, commission charges (pending/confirmed/billed/disputed/waived; demo rate is labelled *DEV-DEMO-NOT-A-REAL-RATE*) · Admin → plan & billing: Nile Care PRO active, Delta PRO active + commission on invoice, Smile & Skin on a 14-day trial; credit wallet + ledger; SaaS invoices (paid/issued/part-paid) ·
Dev inbox messages (WhatsApp/e-mail, delivered/read/failed). Note: first login shows a "legal terms" acceptance banner (UI behaviour).
**Kiorex patient web / Expo.** Search: 13 doctors across 8+ specialties with live slots · My bookings: confirmed, completed, cancelled (refund), no-show, held, pending clinic, checked-in · deposits (paid / released / forfeited / refunded) · reviews (some with clinic replies, one hidden) ·
Vault: visit summaries, prescriptions (QR) and an uploaded ECG · Family: dependants · Waitlist entries/offers · Pharmacy orders (8, every state) · Lab bookings (8, every state) · Telemedicine sessions (waiting/scheduled/ended).
**Ops console.** Providers (sync from Kiorly) · Bookings · Payments, refunds, ledger, payouts · Reviews/moderation · Message log · Outbox · Partners (pharmacy/lab registrations) · Flags: registry of 52, non-default values (`clinic.waitlist_autofill` OFF for org `demo_t_df`, `clinic.kiorex_listing` OFF for org `demo_t_ss`) and gate evidence labelled **DEV-ONLY-NOT-A-REAL-GATE** for telemedicine, pharmacy orders, lab bookings, AI navigation, 3 specialty templates, market EG.
**Passport.** `/account/family` (guardian links, act-as), `/account/orgs` (memberships, pending invitation for `+201000001010`, invite token `demo-invite-nile-nurse`), `/account/security` (sessions), ops reviewer queue `/account/ops/links` (one pending link request).
**Pharmacy.** Dashboard KPIs · Catalogue 343 drugs · Inventory: valid, near-expiry (<30 d: 49), expired, quarantined, recalled lots · Receiving · Purchasing: draft/sent/partially received/received/cancelled POs, 5 suppliers · Rx queue (received/validated/rejected/dispensed) · POS (45 sales over 30 days) · Kiorex orders (new, ready, dispensed, rejected).
**Lab.** Dashboard · Orders in every status (awaiting collection, collected, in lab, awaiting validation, validated, released, cancelled) · QC (history on analyzers; a deliberately failing TSH run from the base seed) · Critical alerts (haemoglobin, potassium) · Release/Reports · Billing (paid/unpaid) · Phlebotomist app `/phleb` (home-collection route today) · Kiorex bookings.

## Rev 2.3: Kiorly Nurse, home visits, physio (added by the Q4 data task)
**Nurse edition tenants** (`edition = NURSE`, password `Demo@12345`; the older `db:seed:nurse` is now folded into `db:seed:demo` and uses the same password): solo **Demo Home Nursing (Mona)** and agency **Demo Care Agency** (dispatcher, 5 nurses, aide, 3 local clients + the Kiorex personas as clients).
Profession verification covers every state: Mona/Heba/Salma VERIFIED (Salma's MoH licence expires in 18 days), Nadine REJECTED, Rawan EXPIRED (licence expired), Yara UNVERIFIED (so the dispatch guard refuses 3 of 5 nurses); also Dr Hany's MoH physio licence PENDING renewal, Dr Adham PENDING, Dr Samah EXPIRED (listing PAUSED), registration rows (`ProfessionalRegistration`) in all 5 states. Solo Mona has PRVER04 solo evidence.
**Home-visit-enabled providers** (coverage districts, HOME visit types with 40-150 EGP home surcharge, deposits 100-200 EGP): Mona (nasr-city, heliopolis, new-cairo), agency via nurse Heba (nasr-city, heliopolis, maadi, zamalek), physio **Dr Mai Hassan** (Nile Care, maadi/nasr-city/heliopolis), paediatrician Dr Nadia Fouad (home), physio **Dr Hany Sobhy** (Delta, mansoura). Physio pack entitlement on Nile Care and Delta; physio assessments, plans (active + discharged), progress notes, outcome trends, a HEP link and a 10-session series (3 done) for Mahmoud El-Sayed (`+201000001005`).
**Home bookings, every state** (Kiorly `HomeVisit` + Kiorex `BookingIntent` for Kiorex-origin ones, spec in `demo-home-visits.json`): assigned, dispatch-queue (unassigned agency visits), en route, arrived, finished (address visible < 24 h vs masked > 24 h), aborted-unsafe x4 (fresh, 46 h old, reviewed->released, reviewed->refunded), cancelled by patient/clinic, no-show, requested without an address, phone/front-desk bookings. Care plan: Nabila's 10-day post-operative wound-care plan (4 done, 6 upcoming, Kiorex `kx_cp_demo_1`) plus a pending request `kx_cp_demo_2`. Visit records (signed), vitals (one CRITICAL with escalation), doctor orders (shared, photo, controlled+witness, expired, revoked) with MAR entries, private-duty shifts (booked, completed with handover, cancelled).
**Kiorex side**: address book (confirmed, unconfirmed, deleted), booking address snapshots (masked after 24 h), deposits paid / released / forfeited / refunded, **hold-for-review** deposits (2 held: 35 min and 46 h old; 1 reviewed->released, 1 reviewed->refunded), safety console feed (SOS resolved, timer-expired acknowledged, unsafe-abort raised / escalated / resolved, one 60 s SLO breach), family status shares (2 active, 1 stopped).
Gate evidence for the new flags is recorded only as **DEV-ONLY-NOT-A-REAL-GATE:GHV1/GHV2/GPR1/GPR2/GKN1/GKN2** in the dev DB (so home visits, physio, MAR/care plans and solo-nurse listing are visible locally). No real gate is ever recorded by seeds; GKN1/GKN2 are normally left unrecorded in the base seed (founder decision), only the demo seed adds the dev rows.
**Where to click.** Kiorly web http://localhost:5174 as Mona or the agency owner/dispatcher (Nurse view: Today route, visits, Team, Dispatch) · Kiorex patient web as Hoda/Nabila: Home visits care type, address book, booking timeline (assignee, ETA, safety card), family share · Ops console: Safety console, held-deposit review queue, home-visit gate metric (>=50 providers per cluster is NOT met by demo data: the metric never satisfies a gate) · Passport `/account/orgs` for the two NURSE-edition organisations.

## Q10: flow -> persona -> app -> URL -> login -> what to click
Everything below exists after `scripts/seed-all.sh` (same people/phones/ids in every product). Passport OTP is always `000000`; staff password `Demo@12345`.
| Flow | Persona | App -> URL | Login | What to click |
|---|---|---|---|---|
| Book a doctor, deposit, review | Hoda `+201000001001` | Kiorex patient web :5180 / Expo :8081 | phone + OTP | Search -> doctor -> slot -> checkout (sandbox PSP) -> My bookings -> review |
| Booking states (completed, cancelled+refund, no-show, held, checked-in) | Hoda / Mahmoud `…1005` | :5180 | phone + OTP | My bookings; Vault for visit summaries and the ECG; Family for the dependants |
| Waitlist offer | Hoda | :5180 | phone + OTP | Waitlist (entries + an offer to accept); Kiorly side: Waitlist at `na` |
| Pharmacy / Lab orders in every state | Nourhan `…1004`, Mariam `…1006`… | :5180 -> Pharmacy orders / Lab bookings; :5190 / :5191 | OTP; `pharmacist@demo.kiorly.local` / dev-login `demo-lab` | Order -> Pharmacy Rx queue / Lab worklist -> release -> result in the vault |
| Telemedicine (waiting / scheduled / ended) | Hoda | :5180 -> Telemedicine | phone + OTP | Join the mock video room |
| Home visit booking + live timeline + safety card | Hoda (+ mother's flat), Nabila `…1013` | :5180 -> Home visits | phone + OTP | Address book (confirmed / unconfirmed), book, timeline (assignee, ETA), family status share |
| Nurse day: route, visit record, vitals, MAR, shifts | Heba (agency nurse 1) `nurse1@nurse-demo.kiorly.test`; Mona `mona@nurse-demo.kiorly.test` | Kiorly web (Nurse view) :5174 | `Demo@12345` or Passport `+201000003004` / `…3001` | Today route -> visit -> record -> vitals (one CRITICAL) -> doctor orders -> MAR |
| Dispatch + unassigned agency queue + dispatch guard | Dina `dispatch@nurse-demo.kiorly.test` | :5174 | `Demo@12345` / Passport `…3003` | Dispatch: assign a nurse (nurses 3-5 and the aide are refused: rejected / expired / unverified) |
| Care-plan requests inbox | Agency owner `owner@nurse-demo.kiorly.test` | :5174 -> Requests | `Demo@12345` / `…3002` | Accept `kx_cp_demo_2`; see the accepted `kx_cp_demo_1` and the declined `kx_cp_demo_3`; Kiorex side: Nabila's care plan |
| **Nurse sample -> Lab -> result back (KNLAB01)** | Heba / Mona | :5174 -> Lab samples; Lab :5191 | `nurse1@…`; Lab dev-login `demo-lab` (reception / technologist / signatory) | Nurse: Lab samples -> nl1 (released, custody timeline, report link), nl2 (awaiting validation), nl3 (in transit), nl4 (rejected by the lab). Lab: Accessioning -> receive `DEMO-NL3-EDTA`; Validation -> nl2; Release -> nl2. Record a new one for Hoda/Nabila (consent granted); Rana (consent revoked) and Nourhan (none) show the named refusals |
| Professions / registrations in all states | Agency owner / Ops | Kiorly Team; Ops console :5181 -> Providers | `owner@…`; `+201000000099` + OTP + TOTP | Verified / pending / rejected / expired / unverified nurses and physios; Dr Samah's paused listing |
| Physio pack | Dr Mai `mai.na@demo.kiorex.test` | :5174 | `Demo@12345` / Passport `…3010` | Mahmoud: assessment, plan, progress notes, outcome trends, HEP link, 10-session series |
| Safety console, held deposits, flags (launch-locked gates DEV-ONLY) | Ops super admin / admin | Ops console :5181 | `+201000000099` (TOTP `REMOVED-OLD-DEMO-TOTP-SECRET`) | Safety console (SOS, timer, unsafe abort + SLO breach), held-deposit review queue (35 min / 46 h), Flags: gates labelled `DEV-ONLY-NOT-A-REAL-GATE:G…` |
| Passport: guardian / org / linking / security states | Hoda, Karim, Tarek, Omar, Dalia; Ahmed Fawzy; ops | Passport :4400/account | phone + OTP | `/account/family` (active, ended, expired, pending guardian links), `/account/orgs` (invitations pending / consumed / expired / revoked, ended membership), `/account/security` (passkeys, sessions), `/account/ops/links` (pending_review) |
| Pharmacy POS / inventory / purchasing | `cashier@`, `owner@demo.kiorly.local` | :5190 | `Demo@12345` | POS, inventory (near-expiry, expired, quarantined, recalled), receiving, purchasing in every state |

## Ops outbox: DEAD rows and how to clear them (demo/e2e data only)
A fresh `scripts/seed-all.sh --reset` produces **zero** new DEAD outbox events. Historic `kiorly.record_share_consent` DEAD rows (`Kiorly 404`, `timeout`, `circuit open`) all came from the e2e suite `04-pharmacy`, which links the demo patient to a FAKE Kiorly patient (`pat_e2e_*`); every later record-sharing toggle then pushed a consent to a patient the clinic does not know. Fixed at the root: Kiorex now treats a 404 on that push as a stale link (link `status='STALE'`, event dropped, no further fan-out), and `04-pharmacy` / the e2e global teardown delete their fake links and events (`purgeE2eConsentPushes` in `e2e/src/db.ts`).
To clear leftovers from older runs (dev DB only, never on real data):
```sql
-- psql -h 127.0.0.1 -p 5433 -U postgres -d kiorex_platform
delete from "OutboxEvent" where type = 'kiorly.record_share_consent' and (status = 'DEAD' or payload->>'kiorlyPatientId' like 'pat\_e2e\_%');
delete from "KiorlyPatientLink" where "kiorlyPatientId" like 'pat\_e2e\_%';
```
(Replaying through the ops outbox API would only re-hit the same 404.) Unrelated `flag.changed` DEAD rows (HTTP 401 / fetch failed from flag-push to partners while they were down or unregistered) are not touched by this.

## Guard (demo seeds can never run in production)
A seed runs only when `DEMO_SEED_ALLOWED=true` and `KIORLY_ENV` / `KIOREX_ENV` / `ENV_TAG` (the `Env` tag from OpenTofu) declares a non-production environment; `NODE_ENV` is only a fallback (staging containers run with `NODE_ENV=production`). It fails closed: prod/production/live anywhere, an unknown environment name, an undeclared environment under `NODE_ENV=production`, a production-looking database, or any override all refuse. A banner shows the environment and database name only. The staging Lambdas, the Cognito script (`scripts/seed-cognito-demo.mjs`, also checks the pool name/tags) and the tofu stacks (`enable_demo_seed`, plan fails for prod) repeat the check. Tests: every repo's `demo-seed-guard` test, `tofu test` in each `modules/product-stack`, `node --test scripts/seed-staging.dry-run.test.mjs`.

## Seeding staging on AWS (non-production only; nothing here deploys)
1. A human deploys the staging stacks and pushes the seed images (`apps/api/Dockerfile.seed` of each API repo; `docker build -f apps/api/Dockerfile.seed --build-context contracts=../kiorex-contracts .` for the repos with the `file:` contracts dependency).
2. `scripts/seed-staging.sh --dry-run` prints the plan: (1) Passport = Cognito users (`kiorex-account/scripts/seed-cognito-demo.mjs`), (2) Kiorly Clinic, (3) Pharmacy, (4) Lab (its response carries the nurse-sample hand-off), (5) Kiorex provider sync, (6) Kiorex demo data; each step is the stack's `<product>-staging-demo-seed` Lambda (`tofu output demo_seed_function_name`).
3. `scripts/seed-staging.sh --yes` runs it (`--reset` = remove and re-create demo records only; `--only lab,kiorex`; refuses any AWS account but the staging one). A copy of the script lives in `kiorex-platform/scripts/`.
4. Staging logins are the same phones with OTP `000000` (the staging `test_phone_numbers` list every demo persona), staff `Demo@12345`. Providers stay mock (`MODE=mock`).
Limits: steps 5-6 need the egress path HB07; Passport families/orgs/invitations exist only in the local dev IdP; ops users enrol TOTP in the UI.

## SCIM and map test data (20 Nov 2026)
- SCIM: no seed. `kiorex-account/apps/dev-idp/test/ka11-scim.test.ts` creates its own org, token and users (random `+20100...` phones). To try it by hand: sign in as a seeded org owner, `POST /api/orgs/<orgId>/scim-tokens`, then `curl -H "Authorization: Bearer kxscim_..." http://localhost:4400/scim/v2/Users`.
- Map: the demo providers seeded by `kiorex-platform/prisma/demo/seed-demo.ts` carry clinic coordinates from the Kiorly demo clinics, so the results map shows pins and clusters in Cairo/Giza/Alexandria with the default offline (`mock`) style; set `VITE_MAP_PROVIDER=osm` for real tiles in dev.
