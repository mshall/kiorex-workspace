# Kiorex v2 — synthetic QA / demo data (DEV ONLY)

> **DEV ONLY.** Everything below is fictional: names, phones (`+20100000xxxx`), e-mails (`@demo.kiorex.test`), ids. Passwords/OTPs/TOTP seeds are
> local development values, never used in staging/production, and are blocked when `NODE_ENV=production`.
> No tax-authority integration exists anywhere; VAT appears only as a plain configurable % line (14 %) on invoices.
> Providers are mocked by default and have real adapters ready ([_docs/PROVIDER_GO_LIVE.md](_docs/PROVIDER_GO_LIVE.md)); messages land in the dev inbox / message log; PSP is `sandbox-fake`; video is `mock`).
> Each repo has its own `TEST_DATA.md`; this file is the cross-product index.

## Run / reset
```bash
e2e/scripts/up.sh            # stack running (first time: --build --seed)
scripts/seed-all.sh          # idempotent, dependency order: Passport -> Kiorly Clinic (incl. the Nurse edition tenants, Rev 2.3 home visits) -> Clinic Kiorly staff-app seed -> Pharmacy (+ its Kiorly staff-app seed) -> Lab -> Lab Kiorly staff-app seed -> provider sync -> Kiorex (incl. home bookings)
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
| Legacy Clinic accounts `admin@kiorly.com`, `superadmin@kiorly.com`, `admin@drahmedshall.com` | `demo` (**not** `Demo@12345`; checked against the bcrypt hashes on 21 Nov 2026) |
| Sign in with Kiorex Passport as staff (Clinic web :5174, Pharmacy web :5192, Lab web :5193, Kiorly staff app) | Clinic `+201000002001` Ahmed Fawzy (owner.na@, GROUP_ADMIN), `+201000002002` (frontdesk1.na@, RECEPTIONIST), `+201000002006` Dr Nadia (PHYSICIAN); Pharmacy `+201000002004` (pharmacist@), `+201000002007` (owner@), `+201000002008` (cashier@) `@demo.kiorly.local`; Lab `demo-lab` `+201000002005` (tech@), `+201000002009` (signatory@), `+201000002010` (owner@) | phone + OTP `000000`; the product role comes from the linked staff row (INTEGRATION.md "Staff sign-in with Kiorex Passport"). Sign-out ends the Passport session too |
| Ops super admin TOTP seed (`+201000000099`) | `REMOVED-OLD-DEMO-TOTP-SECRET` |
| Ops admin (`+201000009001`) TOTP seed | `REMOVED-OLD-DEMO-TOTP-SECRET` |
| Ops finance (`+201000009002`) TOTP seed | `REMOVED-OLD-DEMO-TOTP-SECRET` |
Add the secret to any authenticator app (or compute RFC 6238, SHA-1, 30 s, 6 digits) for the ops console TOTP step.

## URLs
Kiorly Clinic web http://localhost:5174 (API :3010) · Kiorex patient web http://localhost:5180 · Ops console http://localhost:5181 · Expo web http://localhost:8081 ·
Kiorly Home http://localhost:5194/signin · Passport http://localhost:4400/account (dev inbox `/dev/inbox`) · Pharmacy web http://localhost:5192 (API :3100) · Lab web http://localhost:5193 (API :3200) · Kiorex API :4000 · Postgres :5433.

## Persona -> app -> login
| Persona | App | URL | Login |
|---|---|---|---|
| Hoda Mahmoud / هدى محمود (mother; guardian of Yassin 8y + Laila 4y; co-guardian Samir `+201000001002`) | Kiorex patient web / Expo / Passport | :5180 / :8081 / :4400/account | phone `+201000001001`, OTP `000000` |
| Karim Mostafa (legal guardian of Salma, 15) | same | same | `+201000001003` |
| Mahmoud El-Sayed (cardiology patient, guardian of Adam, 2y) | same | same | `+201000001005` |
| Other demo patients: Nourhan `…1004`, Mariam `…1006`, Omar `…1007`, Dalia `…1008`, Tarek `…1009`, Heba `…1010`, Youssef `…1011`, Rana `…1012` | same | same | `+20100000` + last 4 digits, OTP `000000` |
| Amira (`+201000000001`), Hassan (`+201000000002`) | e2e fixtures (do not edit) | | OTP `000000` |
| Ahmed Fawzy (org owner, org "Nile Care Medical Center (DEMO)") | Passport orgs | :4400/account/orgs | `+201000002001` |
| **Kiorly Home (ADR-038)** multi-workspace owner (Passport method; with the Clinic tile a hint shows only for a one-workspace person) | Kiorly Home | http://localhost:5194/signin | `+201000002031`, OTP `000000`. Password method: pick a tile, then any login of that product (Clinic `owner.na@demo.kiorex.test`, Nurse `mona@nurse-demo.kiorly.test`, Pharmacy `owner@demo.kiorly.local`: `Demo@12345`; Lab org `demo-lab` + `tech@demo-lab.test`, no password) |
| **Kiorly Home** no-workspace newcomer (Create or join) | Kiorly Home | http://localhost:5194/signin | `+201000002032`, OTP `000000` |
| Sara Lotfy (receptionist member), Dr Amr Salem (doctor member) | Passport orgs | | `+201000002002`, `+201000002003` |
| Mostafa Reda (pharmacist member), Dina Wagdy (lab technician member) | Passport orgs | | `+201000002004`, `+201000002005` |
| Kiorly Nurse: solo nurse Mona Adel (owner of "Demo Home Nursing (Mona)", also a member of the agency) | Passport orgs (edition NURSE) / Kiorly web Nurse view | :4400/account/orgs / :5174 | `+201000003001` OTP `000000` -> "Sign in with Kiorex Passport", or `mona@nurse-demo.kiorly.test` / `Demo@12345` |
| Kiorly Nurse agency "Demo Care Agency": owner / dispatcher Dina / nurses Heba, Salma, Nadine, Rawan, Yara / aide Aya | same | same | Passport `+201000003002` / `3003` / `3004` `3005` `3007` `3008` `3009` / `3006`; Kiorly `owner@`, `dispatch@`, `nurse1@`…`nurse5@`, `aide@nurse-demo.kiorly.test` / `Demo@12345` |
| Noha Nurse (pending invitation to the agency, token `demo-invite-agency-nurse`), Dr Mai Hassan (physiotherapist, Nile Care) | Passport / Kiorly | | `+201000003011` / `+201000003010` (Kiorly `mai.na@demo.kiorex.test` / `Demo@12345`) |
| Nabila Hamdy / نبيلة حمدي (68, agency home-care client: care plan, MAR, shifts) | Kiorex patient web / Expo | :5180 / :8081 | `+201000001013`, OTP `000000` |
| Ops super admin | Ops console | :5181 | `+201000000099` + OTP + TOTP |
| Ops admin / finance / support | Ops console | :5181 | `+201000009001` (TOTP) / `+201000009002` (TOTP) / `+201000009003` (TOTP: an unconfirmed credential row exists, enrol on first sign-in). Finance and support are role claims only: the API treats every `ops_admin` alike (only `super_admin` differs) |
| Org owner (group admin) | Kiorly Clinic | :5174 | `owner.na@demo.kiorex.test` / `Demo@12345` (tenants: `na` Nile Care, `df` Delta, `ss` Smile & Skin) |
| Branch manager / front desk / nurse / accountant / call-centre | Kiorly Clinic | :5174 | `manager.na@…`, `frontdesk1.na@…`, `frontdesk2.na@…`, `nurse.na@…`, `accountant.na@…`, `callcenter.na@…` (same for `.df` `.ss`) |
| Doctors (Nile Care): paediatrics `nadia`, dermatology `walid`, cardiology `tamer`, ob-gyn `rania`, dentistry `khaled`, ortho `hossam`, ENT `ingy`, internal medicine `sherif` | Kiorly Clinic | :5174 | `<name>.na@demo.kiorex.test` |
| Doctors (Delta): `ola` paediatrics, `medhat` family medicine, `samah` ophthalmology (listing PAUSED) · (Smile & Skin): `lamia` dermatology, `adham` dentistry (pending verification) | Kiorly Clinic | :5174 | `<name>.df@…` / `<name>.ss@…` |
| Pre-existing Kiorly demo data (kept) | Kiorly Clinic | :5174 | `admin@kiorly.com` / `superadmin@kiorly.com` / `admin@drahmedshall.com`, password **`demo`** (not `Demo@12345`), KX-DEV doctors `kxdev.*@kiorly.dev` (e2e) |
| Pharmacy owner / pharmacist / cashier / manager | Pharmacy | :5192 | `owner|pharmacist|cashier|manager@demo.kiorly.local` / `Demo@12345` |
| Lab owner / director / signatory / tech / phlebotomist / reception | Lab | :5193 | dev-login screen, org `demo-lab`, pick the role (`<role>@demo-lab.test`) |

## What exists, where to click
**Kiorly Clinic (3 orgs).** Dashboard (set reporting period to the last 60 days) · Appointments: list + calendar, all statuses, sources (Front desk, Phone, Walk-in, Clinic link, Kiorex WhatsApp, Kiorex marketplace) · Front desk board (`na`: 4 checked-in walk-ins WAITING/CALLED/IN_EXAM) ·
Patients (70/40/24 with allergies, problems, families) → patient → encounters with SOAP/diagnosis/prescription (QR token) and lab/imaging orders · Revenue / Invoices (14 % VAT line, paid + receivable) · Expenses (approved/pending/rejected) ·
Waitlist · Recall campaigns · Kiorex → listings (LIVE / PAUSED / PENDING verification), reviews, commission charges (pending/confirmed/billed/disputed/waived; demo rate is labelled *DEV-DEMO-NOT-A-REAL-RATE*) · Admin → plan & billing: Nile Care PRO active, Delta PRO active + commission on invoice, Smile & Skin on a 14-day trial; credit wallet + ledger; SaaS invoices (paid/issued/part-paid) ·
Dev inbox messages (WhatsApp/e-mail, delivered/read/failed). Note: first login shows a "legal terms" acceptance banner (UI behaviour).
**Kiorex patient web / Expo.** Search: 14 LIVE demo providers (doctors, 2 physiotherapists, 2 home-nursing providers; plus 3 older KX-DEV ones) across 8+ specialties with live slots · My bookings: confirmed, completed, cancelled (refund), no-show, held, pending clinic, checked-in · deposits (paid / released / forfeited / refunded) · reviews (some with clinic replies, one hidden) ·
Vault: visit summaries, prescriptions (QR) and an uploaded ECG · Family: dependants · Waitlist entries/offers · Pharmacy orders (8, every state) · Lab bookings (8, every state) · Telemedicine sessions (waiting/scheduled/ended).
**Ops console.** Providers (sync from Kiorly) · Bookings · Payments, refunds, ledger, payouts · Reviews/moderation · Message log · Outbox · Partners (pharmacy/lab registrations) · Flags: registry of 68 definitions, non-default values (`clinic.waitlist_autofill` OFF for org `demo_t_df`, `clinic.kiorex_listing` OFF for org `demo_t_ss`) and gate evidence labelled **DEV-ONLY-NOT-A-REAL-GATE** for telemedicine, pharmacy orders, lab bookings, AI navigation, 3 specialty templates, market EG.
**Passport.** `/account/family` (guardian links, act-as), `/account/orgs` (memberships, pending invitation for `+201000001010`, invite token `demo-invite-nile-nurse`), `/account/security` (sessions), ops reviewer queue `/account/ops/links` (one request in the review queue: `pending_review` for the secondary phone `+201000001009`; `+201000001010` is `pending_verification` and not in the queue).
**Pharmacy.** Dashboard KPIs · Catalogue 259 shared drugs (44 base + 215 generated) · Inventory: valid, near-expiry (<30 d: 49), expired, quarantined, recalled lots (`DM00013` with its `DEMO-RECALL-001` recall notice) · Receiving · Purchasing: draft/sent/partially received/received/cancelled POs, 5 seeded suppliers · Rx queue (received/validated/rejected/dispensed) · POS (45 sales over 30 days) · Kiorex orders (`kx_ph_demo_3..7`: expired by the SLA job here / rejected in Kiorex, ready, dispensed x2, rejected).
**Lab.** Dashboard · Orders in every status (awaiting collection, collected, in lab, awaiting validation, validated, released, cancelled) · QC (history on analyzers; a deliberately failing TSH run from the base seed) · Critical alerts (haemoglobin, potassium, one deliberately OPEN: `DEMO-OPEN-ALERT-001`) · Release/Reports · Billing (paid/unpaid) · Phlebotomist app `/phleb` (home-collection route today) · Kiorex bookings.

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
| Pharmacy / Lab orders in every state | Nourhan `…1004`, Mariam `…1006`… | :5180 -> Pharmacy orders / Lab bookings; :5192 / :5193 | OTP; `pharmacist@demo.kiorly.local` / dev-login `demo-lab` | Order -> Pharmacy Rx queue / Lab worklist -> release -> result in the vault |
| Telemedicine (waiting / scheduled / ended) | Hoda | :5180 -> Telemedicine | phone + OTP | Join the mock video room |
| Home visit booking + live timeline + safety card | Hoda (+ mother's flat), Nabila `…1013` | :5180 -> Home visits | phone + OTP | Address book (confirmed / unconfirmed), book, timeline (assignee, ETA), family status share |
| Nurse day: route, visit record, vitals, MAR, shifts | Heba (agency nurse 1) `nurse1@nurse-demo.kiorly.test`; Mona `mona@nurse-demo.kiorly.test` | Kiorly web (Nurse view) :5174 | `Demo@12345` or Passport `+201000003004` / `…3001` | Today route -> visit -> record -> vitals (one CRITICAL) -> doctor orders -> MAR |
| Dispatch + unassigned agency queue + dispatch guard | Dina `dispatch@nurse-demo.kiorly.test` | :5174 | `Demo@12345` / Passport `…3003` | Dispatch: assign a nurse (nurses 3-5 and the aide are refused: rejected / expired / unverified) |
| Care-plan requests inbox | Agency owner `owner@nurse-demo.kiorly.test` | :5174 -> Requests | `Demo@12345` / `…3002` | Accept `kx_cp_demo_2`; see the accepted `kx_cp_demo_1` and the declined `kx_cp_demo_3`; Kiorex side: Nabila's care plan |
| **Nurse sample -> Lab -> result back (KNLAB01)** | Heba / Mona | :5174 -> Lab samples; Lab :5193 | `nurse1@…`; Lab dev-login `demo-lab` (reception / technologist / signatory) | Nurse: Lab samples -> nl1 (released, custody timeline, report link), nl2 (awaiting validation), nl3 (in transit), nl4 (rejected by the lab). Lab: Accessioning -> receive `DEMO-NL3-EDTA`; Validation -> nl2; Release -> nl2. Record a new one for Hoda/Nabila (consent granted); Rana (consent revoked) and Nourhan (none) show the named refusals |
| Professions / registrations in all states | Agency owner / Ops | Kiorly; Ops console :5181 -> Providers | `owner@…`; `+201000000099` + OTP + TOTP | Verified / pending / rejected / expired / unverified nurses and physios; Dr Samah's paused listing |
| Physio pack | Dr Mai `mai.na@demo.kiorex.test` | :5174 | `Demo@12345` / Passport `…3010` | Mahmoud: assessment, plan, progress notes, outcome trends, HEP link, 10-session series |
| Safety console, held deposits, flags (launch-locked gates DEV-ONLY) | Ops super admin / admin | Ops console :5181 | `+201000000099` (TOTP `REMOVED-OLD-DEMO-TOTP-SECRET`) | Safety console (SOS, timer, unsafe abort + SLO breach), held-deposit review queue (35 min / 46 h), Flags: gates labelled `DEV-ONLY-NOT-A-REAL-GATE:G…` |
| Passport: guardian / org / linking / security states | Hoda, Karim, Tarek, Omar, Dalia; Ahmed Fawzy; ops | Passport :4400/account | phone + OTP | `/account/family` (active, ended, expired, pending guardian links), `/account/orgs` (invitations pending / consumed / expired / revoked, ended membership), `/account/security` (passkeys, sessions), `/account/ops/links` (pending_review) |
| Pharmacy POS / inventory / purchasing | `cashier@`, `owner@demo.kiorly.local` | :5192 | `Demo@12345` | POS, inventory (near-expiry, expired, quarantined, recalled), receiving, purchasing in every state |

## Ops outbox: DEAD rows and how to clear them (demo/e2e data only)
A fresh `scripts/seed-all.sh --reset` produces **zero** new DEAD outbox events. Historic `kiorly.record_share_consent` DEAD rows (`Kiorly 404`, `timeout`, `circuit open`) all came from the e2e suite `04-pharmacy`, which links the demo patient to a FAKE Kiorly patient (`pat_e2e_*`); every later record-sharing toggle then pushed a consent to a patient the clinic does not know. Fixed at the root: Kiorex now treats a 404 on that push as a stale link (link `status='STALE'`, event dropped, no further fan-out), and `04-pharmacy` / the e2e global teardown delete their fake links and events (`purgeE2eConsentPushes` in `e2e/src/db.ts`).
To clear leftovers from older runs (dev DB only, never on real data):
```sql
-- psql -h 127.0.0.1 -p 5433 -U postgres -d kiorex_platform
delete from "OutboxEvent" where type = 'kiorly.record_share_consent' and (status = 'DEAD' or payload->>'kiorlyPatientId' like 'pat\_e2e\_%');
delete from "KiorlyPatientLink" where "kiorlyPatientId" like 'pat\_e2e\_%';
```
(Replaying through the ops outbox API would only re-hit the same 404.) Unrelated `flag.changed` DEAD rows (HTTP 401 / fetch failed from flag-push to partners while they were down or unregistered) are not touched by this.

## All 36 specialties: 72 demo doctors, searchable and bookable (added 22 Nov 2026)

DEV ONLY, synthetic. Every specialty of the Kiorex catalogue (`GET :4000/api/v1/specialties`, 36 codes) has **2 LIVE, verified doctors** in the new Kiorly demo tenant `demo_t_sp` "Kiorex Specialties Network (DEMO)" (3 branches: New Cairo `demo_c_sp_cairo`, Dokki `demo_c_sp_giza`, Alexandria/Smouha `demo_c_sp_alex`; 72 doctors, 40 + 12 persona patients, working days every day except Friday (12 doctors also close Saturday), 09:00-13:00 and 16:00-20:00 Cairo time, so every doctor has real bookable future slots; about 2,480 appointments, about 600 signed encounters). Gender mix 36 M / 36 F; languages ar, ar+en, ar+en+fr, ar+en+de; fees 300-1000 EGP. **14 doctors also take home visits** (the "Home" column: both physiotherapists, plus doctor A of family medicine, internal medicine, paediatrics, geriatrics, cardiology, pulmonology, diabetes, neurology, nutrition, ob-gyn, sports medicine, rheumatology; coverage districts: New Cairo branch `new-cairo nasr-city heliopolis maadi`, Dokki `dokki mohandessin agouza`, Smouha `smouha sidi-gaber`; HOME visit type fee = 1.2 x consultation + 150 EGP surcharge, deposit 200). **Video (mock) visits**: 11 confirmed bookings are flagged "(video)" (psychiatry, nutrition, family medicine, dermatology, diabetes, allergy, infectious diseases, geriatrics, rheumatology, pain management, audiology) and 2 ended sessions (psychiatry, nutrition) exist as `TeleSession` rows (`kiorex.telemedicine` is ON, video provider `mock`).

**Per specialty 3 Kiorex bookings** (108 in total, keys `spNNa/b/c` in `prisma/demo/demo-marketplace-bookings.json`, mirrored byte-identical in both repos) for the demo patients Hoda `+201000001001` ... Rana `+201000001012`: one COMPLETED (with a visit summary and, every second one, a prescription in the patient vault; most carry a review), one CONFIRMED (some with a PAID deposit, some video) and a third that cycles through COMPLETED, CANCELLED (deposit refunded), NO_SHOW (deposit forfeited), PENDING_CLINIC, HELD, CHECKED_IN and CONFIRMED. The table below names which key is which state. Pharmacy and lab orders were NOT added per specialty (they must mirror the partner seeds; the existing 8 + 8 stay).

**How to run it** (idempotent; this is what `scripts/seed-all.sh` does in order): `cd clinics-management && npm run db:seed:demo -w api` (Kiorly), then provider sync (`node scripts/ops-sync.mjs`, or ops console Providers -> Sync), then `cd kiorex-platform && npm run db:seed:demo -w apps/api` (Kiorex). **Kiorly Clinic staff side** (web http://localhost:5174/login or `POST :3010/api/v1/auth/login`), password `Demo@12345`: owner `owner.sp@demo.kiorex.test` (GROUP_ADMIN), `manager.sp@`, `frontdesk1.sp@` / `frontdesk2.sp@` (front desk), `nurse.sp@`, `accountant.sp@`, `callcenter.sp@`, and every doctor as `<key>.sp@demo.kiorex.test` (PHYSICIAN; the key is in the table, e.g. `psychiatrya.sp@demo.kiorex.test`). **Kiorex patient side**: patient web http://localhost:5180 (or Expo web :8081) -> sign in with the demo phone `+201000001001` (Hoda) ... `+201000001012`, OTP `000000` (Passport), then search by specialty; the Kiorex provider id is `demo_l_sp_<key>`. Public Kiorly booking slug: `demo-sp-<key>`. Verified 22 Nov 2026 with `GET /search/providers?specialty=<code>`: all 36 codes return at least 2 providers with `nextSlots` (some codes also return older demo doctors, e.g. paediatrics 5, cardiology 4). The older codes `obstetrics_gynecology` and `physio_therapy` (Nile Care Dr Rania, Dr Mai Hassan) are not folded onto `obgyn` / `physiotherapy` by the provider mapper, so search by those two codes does not show them; the new doctors use the catalogue codes.

| # | Specialty (code) | Doctor (EN / AR) | Gender | Clinic | Home | Langs | Kiorly login / booking slug | Demo bookings (Kiorex) |
|---|---|---|---|---|---|---|---|---|
| 1 | Allergy & Immunology (`allergy_immunology`) | Dr Adel Aziz / د. عادل عزيز | M | New Cairo |  | ar/en | `allergyimmunologya.sp@` / `demo-sp-allergyimmunologya` | `sp01a` done |
|  |  | Dr Amal Fahmy / د. أمل فهمي | F | Dokki |  | ar/en | `allergyimmunologyb.sp@` / `demo-sp-allergyimmunologyb` | `sp01b` confirmed (video), `sp01c` done |
| 2 | Anaesthesiology (`anesthesiology`) | Dr Asmaa Metwally / د. أسماء متولي | F | Dokki |  | ar | `anesthesiologya.sp@` / `demo-sp-anesthesiologya` | `sp02a` done, `sp02b` confirmed |
|  |  | Dr Alaa Refaat / د. علاء رفعت | M | Smouha |  | ar/en/fr | `anesthesiologyb.sp@` / `demo-sp-anesthesiologyb` | `sp02c` cancelled |
| 3 | Audiology & Speech (`audiology`) | Dr Amir Yassin / د. أمير ياسين | M | Smouha |  | ar/en | `audiologya.sp@` / `demo-sp-audiologya` | `sp03a` done |
|  |  | Dr Anas Taha / د. أنس طه | M | New Cairo |  | ar/de/en | `audiologyb.sp@` / `demo-sp-audiologyb` | `sp03b` confirmed (video), `sp03c` no-show |
| 4 | Cardiology (`cardiology`) | Dr Basma Barakat / د. بسمة بركات | F | New Cairo | yes | ar/en | `cardiologya.sp@` / `demo-sp-cardiologya` | `sp04a` done, `sp04b` confirmed |
|  |  | Dr Eman Habib / د. إيمان حبيب | F | Dokki |  | ar/en | `cardiologyb.sp@` / `demo-sp-cardiologyb` | `sp04c` pending clinic |
| 5 | Cardiothoracic Surgery (`cardiothoracic_surgery`) | Dr Ashraf Mounir / د. أشرف منير | M | Dokki |  | ar | `cardiothoracicsurgerya.sp@` / `demo-sp-cardiothoracicsurgerya` | `sp05a` done |
|  |  | Dr Esraa Selim / د. إسراء سليم | F | Smouha |  | ar/en/fr | `cardiothoracicsurgeryb.sp@` / `demo-sp-cardiothoracicsurgeryb` | `sp05b` confirmed, `sp05c` held |
| 6 | Dentistry (`dentistry`) | Dr Farida Shalaby / د. فريدة شلبي | F | Smouha |  | ar/en | `dentistrya.sp@` / `demo-sp-dentistrya` | `sp06a` done, `sp06b` confirmed |
|  |  | Dr Ayman Abbas / د. أيمن عباس | M | New Cairo |  | ar/de/en | `dentistryb.sp@` / `demo-sp-dentistryb` | `sp06c` checked in |
| 7 | Dermatology (`dermatology`) | Dr Bassem Diab / د. باسم دياب | M | New Cairo |  | ar/en | `dermatologya.sp@` / `demo-sp-dermatologya` | `sp07a` done |
|  |  | Dr Emad Kamel / د. عماد كامل | M | Dokki |  | ar/en | `dermatologyb.sp@` / `demo-sp-dermatologyb` | `sp07b` confirmed (video), `sp07c` confirmed |
| 8 | Diabetes & Endocrinology (`diabetes_endocrinology`) | Dr Ghada Okasha / د. غادة عكاشة | F | Dokki | yes | ar | `diabetesendocrinologya.sp@` / `demo-sp-diabetesendocrinologya` | `sp08a` done, `sp08b` confirmed (video) |
|  |  | Dr Hanan Soliman / د. حنان سليمان | F | Smouha |  | ar/en/fr | `diabetesendocrinologyb.sp@` / `demo-sp-diabetesendocrinologyb` | `sp08c` done |
| 9 | Emergency Medicine (`emergency_medicine`) | Dr Essam Gad / د. عصام جاد | M | Smouha |  | ar/en | `emergencymedicinea.sp@` / `demo-sp-emergencymedicinea` | `sp09a` done |
|  |  | Dr Hend Amin / د. هند أمين | F | New Cairo |  | ar/de/en | `emergencymedicineb.sp@` / `demo-sp-emergencymedicineb` | `sp09b` confirmed, `sp09c` cancelled |
| 10 | ENT (`ent`) | Dr Jihan Eissa / د. جيهان عيسى | F | New Cairo |  | ar/en | `enta.sp@` / `demo-sp-enta` | `sp10a` done, `sp10b` confirmed |
|  |  | Dr Fady Maher / د. فادي ماهر | M | Dokki |  | ar/en | `entb.sp@` / `demo-sp-entb` | `sp10c` no-show |
| 11 | internal_medicine (`family_medicine`) | Dr Gamal Rashad / د. جمال رشاد | M | Dokki | yes | ar | `familymedicinea.sp@` / `demo-sp-familymedicinea` | `sp11a` done |
|  |  | Dr Hatem Wahba / د. حاتم وهبة | M | Smouha |  | ar/en/fr | `familymedicineb.sp@` / `demo-sp-familymedicineb` | `sp11b` confirmed (video), `sp11c` pending clinic |
| 12 | Gastroenterology (`gastroenterology`) | Dr Laila Radi / د. ليلى راضي | F | Smouha |  | ar/en | `gastroenterologya.sp@` / `demo-sp-gastroenterologya` | `sp12a` done, `sp12b` confirmed |
|  |  | Dr Lobna Badawy / د. لبنى بدوي | F | New Cairo |  | ar/de/en | `gastroenterologyb.sp@` / `demo-sp-gastroenterologyb` | `sp12c` held |
| 13 | General Surgery (`general_surgery`) | Dr Hazem Ghoneim / د. حازم غنيم | M | New Cairo |  | ar/en | `generalsurgerya.sp@` / `demo-sp-generalsurgerya` | `sp13a` done |
|  |  | Dr Maha Morsy / د. مها مرسي | F | Dokki |  | ar/en | `generalsurgeryb.sp@` / `demo-sp-generalsurgeryb` | `sp13b` confirmed, `sp13c` checked in |
| 14 | Geriatrics (`geriatrics`) | Dr Marwa Saad / د. مروة سعد | F | Dokki | yes | ar | `geriatricsa.sp@` / `demo-sp-geriatricsa` | `sp14a` done, `sp14b` confirmed (video) |
|  |  | Dr Ihab Zahran / د. إيهاب زهران | M | Smouha |  | ar/en/fr | `geriatricsb.sp@` / `demo-sp-geriatricsb` | `sp14c` confirmed |
| 15 | Haematology (`haematology`) | Dr Ismail Younis / د. إسماعيل يونس | M | Smouha |  | ar/en | `haematologya.sp@` / `demo-sp-haematologya` | `sp15a` done |
|  |  | Dr Kamal Darwish / د. كمال درويش | M | New Cairo |  | ar/de/en | `haematologyb.sp@` / `demo-sp-haematologyb` | `sp15b` confirmed, `sp15c` done |
| 16 | Infectious Diseases (`infectious_diseases`) | Dr Mervat Helmy / د. ميرفت حلمي | F | New Cairo |  | ar/en | `infectiousdiseasesa.sp@` / `demo-sp-infectiousdiseasesa` | `sp16a` done, `sp16b` confirmed (video) |
|  |  | Dr Nada Nagy / د. ندى ناجي | F | Dokki |  | ar/en | `infectiousdiseasesb.sp@` / `demo-sp-infectiousdiseasesb` | `sp16c` cancelled |
| 17 | Internal Medicine (`internal_medicine`) | Dr Maged Sharaf / د. ماجد شرف | M | Dokki | yes | ar | `internalmedicinea.sp@` / `demo-sp-internalmedicinea` | `sp17a` done |
|  |  | Dr Nahla Awad / د. نهلة عوض | F | Smouha |  | ar/en/fr | `internalmedicineb.sp@` / `demo-sp-internalmedicineb` | `sp17b` confirmed, `sp17c` no-show |
| 18 | Nephrology (`nephrology`) | Dr Noha Abdelhamid / د. نهى عبد الحميد | F | Smouha |  | ar/en | `nephrologya.sp@` / `demo-sp-nephrologya` | `sp18a` done, `sp18b` confirmed |
|  |  | Dr Marwan El-Banna / د. مروان البنا | M | New Cairo |  | ar/de/en | `nephrologyb.sp@` / `demo-sp-nephrologyb` | `sp18c` pending clinic |
| 19 | Neurology (`neurology`) | Dr Mohab Labib / د. مهاب لبيب | M | New Cairo | yes | ar/en | `neurologya.sp@` / `demo-sp-neurologya` | `sp19a` done |
|  |  | Dr Nabil Qandil / د. نبيل قنديل | M | Dokki |  | ar/en | `neurologyb.sp@` / `demo-sp-neurologyb` | `sp19b` confirmed, `sp19c` held |
| 20 | Neurosurgery (`neurosurgery`) | Dr Nesma Tantawy / د. نسمة طنطاوي | F | Dokki |  | ar | `neurosurgerya.sp@` / `demo-sp-neurosurgerya` | `sp20a` done, `sp20b` confirmed |
|  |  | Dr Rasha Hosny / د. رشا حسني | F | Smouha |  | ar/en/fr | `neurosurgeryb.sp@` / `demo-sp-neurosurgeryb` | `sp20c` checked in |
| 21 | Nutrition & Dietetics (`nutrition`) | Dr Osama Aziz / د. أسامة عزيز | M | Smouha | yes | ar/en | `nutritiona.sp@` / `demo-sp-nutritiona` | `sp21a` done (video) |
|  |  | Dr Rehab Fahmy / د. رحاب فهمي | F | New Cairo |  | ar/de/en | `nutritionb.sp@` / `demo-sp-nutritionb` | `sp21b` confirmed (video), `sp21c` confirmed |
| 22 | Obstetrics & Gynaecology (`obgyn`) | Dr Reham Metwally / د. ريهام متولي | F | New Cairo | yes | ar/en | `obgyna.sp@` / `demo-sp-obgyna` | `sp22a` done, `sp22b` confirmed |
|  |  | Dr Raafat Refaat / د. رأفت رفعت | M | Dokki |  | ar/en | `obgynb.sp@` / `demo-sp-obgynb` | `sp22c` done |
| 23 | Oncology (`oncology`) | Dr Ramy Yassin / د. رامي ياسين | M | Dokki |  | ar | `oncologya.sp@` / `demo-sp-oncologya` | `sp23a` done |
|  |  | Dr Sameh Taha / د. سامح طه | M | Smouha |  | ar/en/fr | `oncologyb.sp@` / `demo-sp-oncologyb` | `sp23b` confirmed, `sp23c` cancelled |
| 24 | Ophthalmology (`ophthalmology`) | Dr Sahar Barakat / د. سحر بركات | F | Smouha |  | ar/en | `ophthalmologya.sp@` / `demo-sp-ophthalmologya` | `sp24a` done, `sp24b` confirmed |
|  |  | Dr Samar Habib / د. سمر حبيب | F | New Cairo |  | ar/de/en | `ophthalmologyb.sp@` / `demo-sp-ophthalmologyb` | `sp24c` no-show |
| 25 | Orthopaedics (`orthopaedics`) | Dr Seif Mounir / د. سيف منير | M | New Cairo |  | ar/en | `orthopaedicsa.sp@` / `demo-sp-orthopaedicsa` | `sp25a` done |
|  |  | Dr Shaimaa Selim / د. شيماء سليم | F | Dokki |  | ar/en | `orthopaedicsb.sp@` / `demo-sp-orthopaedicsb` | `sp25b` confirmed, `sp25c` pending clinic |
| 26 | Paediatrics (`paediatrics`) | Dr Shereen Shalaby / د. شيرين شلبي | F | Dokki | yes | ar | `paediatricsa.sp@` / `demo-sp-paediatricsa` | `sp26a` done, `sp26b` confirmed |
|  |  | Dr Wael Abbas / د. وائل عباس | M | Smouha |  | ar/en/fr | `paediatricsb.sp@` / `demo-sp-paediatricsb` | `sp26c` held |
| 27 | Pain Management (`pain_management`) | Dr Yehia Diab / د. يحيى دياب | M | Smouha |  | ar/en | `painmanagementa.sp@` / `demo-sp-painmanagementa` | `sp27a` done |
|  |  | Dr Zein Kamel / د. زين كامل | M | New Cairo |  | ar/de/en | `painmanagementb.sp@` / `demo-sp-painmanagementb` | `sp27b` confirmed (video), `sp27c` checked in |
| 28 | Physiotherapy (`physiotherapy`) | Dr Soha Okasha / د. سها عكاشة | F | New Cairo | yes | ar/en | `physiotherapya.sp@` / `demo-sp-physiotherapya` | `sp28a` done, `sp28b` confirmed |
|  |  | Dr Suzan Soliman / د. سوزان سليمان | F | Dokki | yes | ar/en | `physiotherapyb.sp@` / `demo-sp-physiotherapyb` | `sp28c` confirmed |
| 29 | Plastic & Cosmetic Surgery (`plastic_surgery`) | Dr Ziad Gad / د. زياد جاد | M | Dokki |  | ar | `plasticsurgerya.sp@` / `demo-sp-plasticsurgerya` | `sp29a` done |
|  |  | Dr Walaa Amin / د. ولاء أمين | F | Smouha |  | ar/en/fr | `plasticsurgeryb.sp@` / `demo-sp-plasticsurgeryb` | `sp29b` confirmed, `sp29c` done |
| 30 | Psychiatry (`psychiatry`) | Dr Yasmine Eissa / د. ياسمين عيسى | F | Smouha |  | ar/en | `psychiatrya.sp@` / `demo-sp-psychiatrya` | `sp30a` done (video), `sp30b` confirmed (video) |
|  |  | Dr Magdy Maher / د. مجدي ماهر | M | New Cairo |  | ar/de/en | `psychiatryb.sp@` / `demo-sp-psychiatryb` | `sp30c` cancelled |
| 31 | Pulmonology & Chest (`pulmonology`) | Dr Sabry Rashad / د. صبري رشاد | M | New Cairo | yes | ar/en | `pulmonologya.sp@` / `demo-sp-pulmonologya` | `sp31a` done |
|  |  | Dr Hesham Wahba / د. هشام وهبة | M | Dokki |  | ar/en | `pulmonologyb.sp@` / `demo-sp-pulmonologyb` | `sp31b` confirmed, `sp31c` no-show |
| 32 | Radiology (`radiology`) | Dr Zeinab Radi / د. زينب راضي | F | Dokki |  | ar | `radiologya.sp@` / `demo-sp-radiologya` | `sp32a` done, `sp32b` confirmed |
|  |  | Dr Doaa Badawy / د. دعاء بدوي | F | Smouha |  | ar/en/fr | `radiologyb.sp@` / `demo-sp-radiologyb` | `sp32c` pending clinic |
| 33 | Rheumatology (`rheumatology`) | Dr Moataz Ghoneim / د. معتز غنيم | M | Smouha | yes | ar/en | `rheumatologya.sp@` / `demo-sp-rheumatologya` | `sp33a` done |
|  |  | Dr Radwa Morsy / د. رضوى مرسي | F | New Cairo |  | ar/de/en | `rheumatologyb.sp@` / `demo-sp-rheumatologyb` | `sp33b` confirmed (video), `sp33c` held |
| 34 | Sports Medicine (`sports_medicine`) | Dr Manal Saad / د. منال سعد | F | New Cairo | yes | ar/en | `sportsmedicinea.sp@` / `demo-sp-sportsmedicinea` | `sp34a` done, `sp34b` confirmed |
|  |  | Dr Nader Zahran / د. نادر زهران | M | Dokki |  | ar/en | `sportsmedicineb.sp@` / `demo-sp-sportsmedicineb` | `sp34c` checked in |
| 35 | Urology (`urology`) | Dr Ragab Younis / د. رجب يونس | M | Dokki |  | ar | `urologya.sp@` / `demo-sp-urologya` | `sp35a` done |
|  |  | Dr Abdallah Darwish / د. عبد الله درويش | M | Smouha |  | ar/en/fr | `urologyb.sp@` / `demo-sp-urologyb` | `sp35b` confirmed, `sp35c` confirmed |
| 36 | Vascular Surgery (`vascular_surgery`) | Dr Lamis Helmy / د. لميس حلمي | F | Smouha |  | ar/en | `vascularsurgerya.sp@` / `demo-sp-vascularsurgerya` | `sp36a` done, `sp36b` confirmed |
|  |  | Dr Salwa Nagy / د. سلوى ناجي | F | New Cairo |  | ar/de/en | `vascularsurgeryb.sp@` / `demo-sp-vascularsurgeryb` | `sp36c` done |

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

## Standalone logins (Pharmacy and Lab, added 20 Nov 2026)
- Pharmacy standalone tenant: `solo.*@demo.kiorly.local` logins (see `kiorly-pharmacy/Docs/TEST_DATA.md`); suite seed: `npm run seed:suite` in kiorly-pharmacy.
- Lab: new onboarding creates STANDALONE tenants; existing demo tenants stay INTEGRATED (see `kiorly-lab/Docs/TEST_DATA.md`).
- Feature coverage: `kiorly-pharmacy/Docs/FEATURE_MATRIX.md`, `kiorly-lab/Docs/FEATURE_MATRIX.md`.

## Kiorly (mobile staff app, added 20 Nov 2026)
App `kiorly-team` (Expo web :8082). Entitlement `mobile_staff_app` is ON for PRO/ENTERPRISE; Basic orgs see the upgrade screen but keep the safety-alert inbox. Staff password `Demo@12345` (legacy `admin@kiorly.com`: `demo`); seeds: clinic `npm run db:seed:mobile -w api`, pharmacy `npm run seed:mobile -w api`, lab `npm run db:seed:mobile -w api` (all idempotent, guarded; run by `scripts/seed-all.sh` and by `seed:all` in pharmacy). Details: `kiorly-team/Docs/TEST_DATA.md`.
| Product | Plan | Logins |
|---|---|---|
| Clinic Nile Care | PRO | `nadia.na@` (doctor), `nurse.na@`, `owner.na@`, `accountant.na@` (`@demo.kiorex.test`); solo nurse `mona@nurse-demo.kiorly.test` |
| Clinic agency / group | ENTERPRISE | `owner@nurse-demo.kiorly.test` (`Demo@12345`), `admin@kiorly.com` (password `demo`) |
| Clinic Corner Family Clinic | BASIC | `owner.basic@`, `doctor.basic@`, `nurse.basic@demo.kiorex.test` |
| Pharmacy Demo (CHAIN) | ENTERPRISE | `owner@`, `pharmacist@`, `manager@`, `cashier@demo.kiorly.local` |
| Pharmacy Solo | PRO | `solo.owner@`, `solo.pharmacist@demo.kiorly.local` |
| Pharmacy Corner (Lite) | BASIC | `owner.basic@`, `pharmacist.basic@demo.kiorly.local` |
| Lab `demo-lab` / `chain-lab` / `basic-lab` | PRO / ENTERPRISE / BASIC | org slug + `signatory|phleb|tech|director|owner@<slug>.test` (dev login, no password) |

---
Verified: 2026-11-21 (counts re-read from the dev databases with SELECT; see [DEMO_DATA.md](DEMO_DATA.md)).
