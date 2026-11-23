# Kiorex v2 test guide (DEV ONLY)

> **DEV ONLY / synthetic.** Every name, phone (`+20100000xxxx`), e-mail (`@demo.kiorex.test`, `@demo.kiorly.local`, `@nurse-demo.kiorly.test`, `@<slug>.test`), password, OTP and TOTP seed in this guide is a fake value for the local stack. They are refused when `NODE_ENV=production`, and the quick-pick panels below are not in production builds. Never reuse any of them anywhere real. Providers are mocked everywhere (messages land in the dev inbox or logs, the PSP is `sandbox-fake`, video is `mock`). There is no tax-authority integration.
>
> Facts in this guide were checked against the seed scripts, the dev databases on `:5433` (read-only SELECTs) and the running stack on 23 Nov 2026. Deeper per-product scripts live in each repo's `DEMO_DATA.md` and `Docs/TEST_GUIDE.md`; cross-product tables are in [TEST_DATA.md](TEST_DATA.md) and [DEMO_DATA.md](DEMO_DATA.md).

## 1. Run the stack and seed it

```bash
# 1) Postgres :5433 + the five APIs (Passport :4400, Kiorly :3010, Kiorex :4000, Pharmacy :3100, Lab :3200)
e2e/scripts/up.sh --build --seed            # first time; later just e2e/scripts/up.sh   (stop: e2e/scripts/down.sh)
#    restart ONE service without touching the rest:  e2e/scripts/up.sh --restart --only=passport   (passport|kiorly|kiorex|pharmacy|lab)
# 2) demo data in dependency order (idempotent; add --reset to re-create demo rows only)
scripts/seed-all.sh
# 3) the web apps you want to click through (Vite dev servers; the APIs are already running)
(cd clinics-management && npm run dev -w web)      # Kiorly Clinic      :5174   (branch kiorex)
(cd kiorex-platform && npm run dev -w apps/web)    # Kiorex patient web :5180
(cd kiorex-platform && npm run dev -w apps/ops)    # Ops console        :5181
(cd kiorex-platform && npm run mobile:web)         # Patient Expo app   :8081
(cd kiorly-pharmacy && npm run dev -w web)         # Kiorly Pharmacy    :5192
(cd kiorly-lab && npm run dev -w web)              # Kiorly Lab         :5193
(cd kiorly-team && npm run web)                    # Kiorly staff app   :8082
```

Rules: never touch ports **3000 / 5173 / 5175** (another checkout). Do not run `scripts/seed-all.sh --reset` while others use the stack. After the e2e suite (`cd e2e && npm test`) re-run `scripts/seed-all.sh` (the suite revokes some dev gate evidence). Dates are relative to the seed day, so re-run with `--reset` every few days. Tests you run yourself change data (a cancel stays cancelled): re-seed to get the starting state back.

### Every local URL

| Port | What | URL |
|---|---|---|
| 4400 | Kiorex Passport (dev IdP, sign-in, account pages, dev inbox) | http://localhost:4400/account · http://localhost:4400/dev/inbox |
| 4000 | Kiorex API | http://localhost:4000/api/v1 |
| 5180 | Kiorex patient web | http://localhost:5180 |
| 5181 | Ops console / super admin | http://localhost:5181 |
| 8081 | Patient Expo app (web build) | http://localhost:8081 |
| 3010 / 5174 | Kiorly Clinic API / web | http://localhost:5174/login |
| 3100 / 5192 | Kiorly Pharmacy API / web | http://localhost:5192/login |
| 3200 / 5193 | Kiorly Lab API / web | http://localhost:5193/login |
| 8082 | Kiorly staff app (Expo web; use phone width) | http://localhost:8082/sign-in |
| 5433 | Postgres (`postgres` / `postgres`, DEV ONLY) | |

## 2. The "Test users (dev only)" panels

Every sign-in screen has a clearly labelled panel (a coral **DEV** tag) that signs you in with one click or tap. It is shown only in local dev builds, in English and Arabic (RTL), light and dark, and works at phone width. It is **absent from production builds**: each repo has a build check (`npm run check:dev-test-users`, also run by that repo's unit tests) that builds production and development bundles and fails if the panel text or any credential is in the production one. Hide it in a dev build with `VITE_DEV_TEST_USERS=false` (Clinic, Pharmacy, Lab web), `EXPO_PUBLIC_DEV_TEST_USERS=false` (patient app, staff app) or `KX_DEV_TEST_USERS=false` (Passport).

| Screen | Where | What a click does |
|---|---|---|
| **Kiorex Passport** sign-in (used by patient web :5180, ops console :5181 and Kiorly web "Sign in with Kiorex Passport") | http://localhost:4400 (reached when you press Sign in in those apps; neither the patient web nor the ops console has its own login form, they redirect here) | Patient and staff chips: phone is submitted and the dev code `000000` is entered for you. Ops chips: after the code, the ops TOTP page shows the **current 6-digit code** and the **seed** with a copy button; one click fills it and signs in |
| Patient app (Expo, :8081 / device) | `/sign-in` below "Continue with Kiorex Passport" | The chip passes the phone as `login_hint`; Passport pre-fills it and signs in by itself |
| Kiorly Clinic web | http://localhost:5174/login (below the card) | Signs in directly with the persona's e-mail and dev password |
| Kiorly Pharmacy web | http://localhost:5192/login | Same, 15 logins |
| Kiorly Lab web | http://localhost:5193/login | Dev-login (no password), 27 logins |
| Kiorly staff app | `/sign-in`, below the form (per product tab: Clinic, Nurse, Pharmacy, Lab) | Chip fills e-mail / password / org, then press **Sign in** |

Dev-only secrets in one place: Passport OTP for every seeded phone **`000000`**; staff password **`Demo@12345`**; the three older Clinic accounts (`admin@kiorly.com`, `superadmin@kiorly.com`, `admin@drahmedshall.com`) use **`demo`**; Lab dev-login has no password; Postgres `postgres` / `postgres`.

## 3. Every test user

### 3.1 Passport phones (OTP `000000`)

| Phone | Name | Use it for |
|---|---|---|
| `+201000001001` | Hoda Mahmoud / هدى محمود | richest history: completed visits, expired hold, 2 dependants (Yassin 8y, Laila 4y), 4 addresses, home bookings with Mona, an OFFERED waitlist entry, telemedicine ENDED, pharmacy order PENDING_PAYMENT |
| `+201000001002` | Samir Ali Nassar | co-guardian of Yassin; `mk03` CONFIRMED with deposit PAID (cancel/refund test); telemedicine WAITING; pharmacy PAID |
| `+201000001003` | Karim Mostafa | guardian of Salma (15y, court order); pharmacy REJECTED; physio |
| `+201000001004` | Nourhan Fathy / نورهان فتحي | pharmacy order `kx_ph_demo_4` READY; `mk26` pending clinic; lab `kx_lb_demo_1` PENDING_PAYMENT |
| `+201000001005` | Mahmoud El-Sayed / محمود السيد | cardiology, guardian of Adam (2y), uploaded ECG, 10-session physio series, care-plan request |
| `+201000001006` | Mariam Adel | `mk05` CONFIRMED (reschedule), telemedicine SCHEDULED, pharmacy DISPENSED, lab SUBMITTED |
| `+201000001007` | Omar Hegazy | lab `kx_lb_demo_4` COLLECTED (release it in Lab), pharmacy REJECTED |
| `+201000001008` | Dalia Ibrahim | **no-show with forfeited deposit** (`mk06`), lab result released, pharmacy CANCELLED |
| `+201000001009` | Tarek Zaki | **checked-in** today (`mk09`), lab result released; Passport link request `pending_review` |
| `+201000001010` | Heba Salah | cancelled and refunded (`mk12`); pending Nile Care nurse invitation |
| `+201000001011` / `…1012` / `…1013` | Youssef Ramadan / Rana Khaled / Nabila Hamdy | dentistry + lab cancelled / refunded, agency client / home-care plan `kx_cp_demo_1` (10 visits, 4 done) |
| `+201000000001` / `…0002` | Amira (ar) / Hassan (en) | plain patients |
| `+201000002001` .. `…2010` | Ahmed Fawzy (Nile Care owner), Sara, Dr Amr Salem, Mostafa Reda (pharmacist), Dina Wagdy (lab tech), Dr Nadia Fouad, Demo Pharmacy Owner, Omar Cashier, Dr Salma (lab signatory), Demo Lab Owner | provider-side people with a Passport identity (organisations, invitations, Sign in with Kiorex Passport on Kiorly) |
| `+201000003001` .. `…3011` | Mona (solo nurse), Agency Owner, Dina Dispatcher, Heba / Salma / Aya / Nadine / Rawan / Yara, Dr Mai Hassan (physio), Noha (pending invite) | Nurse edition personas; `…3004` Heba is the verified agency nurse |

### 3.2 Ops console (Passport phone + `000000` + authenticator code)

| Phone | Role | TOTP seed (Base32, DEV ONLY) |
|---|---|---|
| `+201000000099` | Ops **super admin** (flags, gates, two-person approvals) | `REMOVED-OLD-DEMO-TOTP-SECRET` |
| `+201000009001` | Ops admin (everything except changing flags) | `REMOVED-OLD-DEMO-TOTP-SECRET` |
| `+201000009002` | Ops finance (role claim only; API treats it as `ops_admin`) | `REMOVED-OLD-DEMO-TOTP-SECRET` |
| `+201000009003` | Ops support (claim only) | none seeded: it enrols a new authenticator on first sign-in (the page shows the setup key) |

The Passport dev panel computes the current code for you (the dev IdP knows the seed). To do it by hand: any authenticator app with the seed, or `node -e "console.log(require('otplib').generateSync({secret:'REMOVED-OLD-DEMO-TOTP-SECRET',strategy:'totp'}))"` from `kiorex-account/`. A code can be used once: if "wrong code" appears right after a quick sign-in, wait for the next 30-second code.

### 3.3 Kiorly Clinic web (:5174, password `Demo@12345`)

| Group | Logins |
|---|---|
| Nile Care Medical Center (PRO, 2 branches, Kiorex listings LIVE) | `owner.na@` Ahmed Fawzy (group admin), `manager.na@`, `frontdesk1.na@` / `frontdesk2.na@` (receptionist), `nurse.na@`, `accountant.na@` (finance officer), `callcenter.na@`, doctors `nadia.na@` (paediatrics, also home), `walid.na@` (dermatology), `tamer.na@` (cardiology), `rania.na@`, `khaled.na@`, `hossam.na@`, `ingy.na@`, `sherif.na@`, physio `mai.na@` — all `@demo.kiorex.test` |
| Delta Family Clinics (PRO) | `owner.df@`, `manager.df@`, `frontdesk1.df@`, `nurse.df@`, `accountant.df@`, `callcenter.df@`, doctors `ola.df@`, `medhat.df@`, `samah.df@` (listing PAUSED, licence expired), `hany.df@` |
| Smile & Skin Studio (Lite base, trialing) | `owner.ss@` (also HR + operations tabs), `lamia.ss@` (listing paused by org flag), `adham.ss@` (verification pending) and the same staff roles with `.ss@` |
| Corner Family Clinic (**Basic**) | `owner.basic@` Ramy Hafez, `doctor.basic@` Dr Heba Lotfy, `nurse.basic@` Mervat Adel |
| Nurse edition (`@nurse-demo.kiorly.test`) | `mona@` solo nurse, `owner@` agency owner, `dispatch@` dispatcher, `nurse1@` Heba (verified), `nurse2@` (licence expires in 18 days), `nurse3@` (rejected), `nurse4@` (expired), `nurse5@` (unverified), `aide@` (refused by dispatch) |
| Older accounts, password **`demo`** | `admin@kiorly.com` (Enterprise group admin), `superadmin@kiorly.com` (platform super admin: Platform tab, create orgs), `admin@drahmedshall.com` (42 users) |
| 36 specialties tenant `demo_t_sp` | `<key>.sp@demo.kiorex.test`, owner `owner.sp@` (table in TEST_DATA.md) |

The panel lists 26 of these (every group); all 26 were logged in through the API on 23 Nov 2026. First login of a staff user shows the legal-terms banner.

### 3.4 Kiorly Pharmacy web (:5192, password `Demo@12345`, all `@demo.kiorly.local`)

Chain "Kiorly Demo Pharmacy" (Enterprise, Kiorex orders on): `owner@`, `pharmacist@` (can sign off), `pharmacist2@` (witness), `manager@`, `cashier@`, `assistant@`, `chain@`. Solo "Kiorly Solo Pharmacy" (Pro, no Kiorex): `solo.owner@`, `solo.pharmacist@`, `solo.manager@`, `solo.cashier@`, `solo.assistant@`. "Kiorly Corner Pharmacy" (Lite = Basic): `owner.basic@`, `pharmacist.basic@`, `cashier.basic@`. All 15 verified.

### 3.5 Kiorly Lab web (:5193, dev-login, no password)

Three labs times nine roles = 27: `demo-lab` (Cairo Diagnostics Lab, Pro, full demo data), `chain-lab` (Delta Diagnostics Group, Enterprise), `basic-lab` (Starter Lab, Lite). Logins are `<role>@<slug>.test` with role in `owner`, `director`, `signatory` (pathologist), `tech`, `phleb`, `reception`, `manager`, `supervisor`, `finance`. All 27 verified.

### 3.6 Kiorly staff app (:8082)

The sign-in has four tiles: Clinic, Nurse, Pharmacy, Lab; the chips are per tile. Clinic: Dr Nadia, nurse.na, owner.na, receptionist, accountant, Basic owner / doctor / nurse. Nurse: Mona (solo), Heba (agency), Aya (aide), Dina (dispatcher), agency owner, nurse.na. Pharmacy: owner, pharmacist, manager (witness), cashier, solo owner, Basic owner. Lab: owner, signatory, tech, phleb, reception, Basic-lab director (org field is filled by the chip).

## 4. Flows: how to test each one

"Chip" means the dev quick-pick. Expected results were taken from the seeded data and the code paths; dates are relative to the seed day.

### 4.1 Passport sign-in, sign-out and account pages (P1-P9)

1. **Sign in (patient).** Open http://localhost:5180 and press Sign in (or open http://localhost:4400/account). On Passport tap the chip **Hoda Mahmoud**. *Expected:* you land back signed in as Hoda; the code is also in http://localhost:4400/dev/inbox.
2. **By hand.** Enter `+201000001001`, continue, enter `000000`, choose "Not now" for the passkey. Same result. A wrong code shows an inline error with the attempts left; asking for a code six times for one phone is refused (5 per hour; `npm run db:reset` in `kiorex-account` clears it).
3. **Sign out.** In the patient web account menu choose Sign out. *Expected:* back signed out, and the Passport session ends too (pressing Sign in shows the phone page again, not an automatic sign-in).
4. **Family.** Chip Hoda, http://localhost:4400/account/family: Yassin and Laila active with "act as"; chip Samir shows Yassin as co-guardian; Karim shows Salma (court-order evidence); Tarek shows Zeina ended; dependants have no phone, so nothing to sign in with.
5. **Organisations.** Chip Ahmed Fawzy (`+201000002001`): `/account/orgs` lists Nile Care with members and invitations (pending, consumed, expired, with masked phones). Chip Heba Salah (`+201000001010`): accept the pending nurse invitation (token `demo-invite-nile-nurse`) and she becomes a nurse member (re-seed to repeat). Chip Mona (`+201000003001`): two organisations (solo and agency).
6. **Security.** Chip Hoda, `/account/security`: two synthetic passkeys, sessions (revoke one), events; revoking all sessions asks for step-up.
7. **Ops link review.** Chip Ops super admin, `/account/ops/links`: one pending request (secondary `+201000001009`). Do not approve unless you intend to change data.

### 4.2 Kiorex patient web (K1-K12)

Patient web :5180; chips on Passport. Routes: `/search`, `/doctors/:id`, `/appointments`, `/appointments/:id`, `/records`, `/pharmacy`, `/pharmacy/orders`, `/lab`, `/lab/bookings`, `/telemedicine`, `/waitlist`, `/care-plans`, `/account`, `/account/addresses`.

1. **Search and book with a deposit (Hoda to Dr Nadia).** Chip Hoda. Search (filter Cardiology: Dr Tamer Shawky has live slots; the map shows mock pins). Open Dr Nadia Fouad, pick a slot, continue to checkout, pay the deposit on the sandbox PSP (`sandbox-fake`, no card). *Expected:* booking CONFIRMED and deposit PAID, a confirmation in Ops -> Messaging and the dev inbox, and in Kiorly (`frontdesk1.na@`) an appointment with source Kiorex marketplace. A second patient taking the same slot before you confirm gets a slot-taken error.
2. **Pay a deposit later.** Open a booking whose deposit is not paid and press "Pay deposit"; you go to the sandbox checkout and return to `/appointments/:id` with the chip PAID.
3. **Booking states.** Hoda `/appointments`: completed (`mk01`, `mk02`), expired hold (`mk28`). Dalia: no-show, deposit FORFEITED. Tarek: checked-in today. Heba Salah: cancelled, deposit REFUNDED. Nourhan: `mk26` pending clinic confirmation.
4. **Reschedule.** Chip Mariam (`+201000001006`), `/appointments`, open `mk05` (confirmed, future), press **Reschedule**, choose another slot. *Expected:* toast "rescheduled" and the new time; the clinic sees it in Kiorly. Doing it again past the free limit shows the "reached the number of free reschedules" message; inside the policy window closing shows "window closed".
5. **Cancel and refund.** Chip Samir (`+201000001002`), open `mk03` (deposit PAID, 5 days ahead), **Cancel appointment**, confirm. *Expected:* CANCELLED and the deposit refund requested then REFUNDED (Ops -> Finance shows the REFUND ledger rows). Outside the free window the cancel works but the deposit is kept.
6. **Review.** Chip Hoda, open the completed visit `mk02`, leave stars and text. *Expected:* a verified review; the rating aggregate updates; the clinic can reply in Kiorly (Kiorex tab); Ops -> Moderation shows the HIDDEN demo review.
7. **Records and family.** Chip Hoda, `/records`: visit summary, prescription QR, share consents (toggle a share: Kiorly receives it). Family: book Dr Ola for Yassin (Hoda pays). Mahmoud: Adam (2y) and the uploaded ECG.
8. **Waitlist.** Chip Hoda, `/waitlist`: an OFFERED entry with a countdown. Accept (5-minute hold), confirm: booking confirmed in Kiorly; decline returns it to WAITING. Joining while slots are open is refused (409 `SLOTS_AVAILABLE`). Delta's autofill is OFF by flag.
9. **Telemedicine.** Chip Samir (WAITING), Mariam (SCHEDULED), Hoda (ENDED) at `/telemedicine`; Samir joins the mock room. *Expected:* a mock video room, no media leaves the machine.
10. **Pharmacy order and delivery.** Chip Nourhan, `/pharmacy/orders`: `kx_ph_demo_4` READY. Place a new order: pick a pharmacy, add items, choose **Pickup** or **Delivery** (address needed; delivery fee shown when the pharmacy enables it), pay. In Pharmacy (:5192, `pharmacist@`) accept, mark Ready, for delivery orders **Out for delivery**, then dispense. *Expected:* the patient sees each state, including OUT_FOR_DELIVERY; seeded orders: `_1` PENDING_PAYMENT, `_2` PAID, `_3` / `_7` REJECTED, `_5` / `_6` DISPENSED, `_8` CANCELLED.
11. **Lab booking and result.** Chip Omar (`+201000001007`), `/lab`: book a test, pick a slot, pay. His seeded `kx_lb_demo_4` is COLLECTED: in Lab, `tech@demo-lab.test` then `signatory@demo-lab.test` validate and release. *Expected:* RESULT_RELEASED and the PDF in `/records` (Vault). Dalia and Tarek already have released results; `kx_lb_demo_7` is REJECTED, `_8` CANCELLED.
12. **Home visit.** Chip Hoda, `/account/addresses` (confirmed defaults, an unconfirmed one needing an OTP, a deleted one), then book a home visit with Nurse Mona: an address outside her districts (Maadi) gives `OUT_OF_COVERAGE`. Pay the deposit; the booking shows the timeline (assigned, en route with ETA, arrived), the safety card (photo, badge, emergency number, report a problem), and the address only within 24 hours of the visit.
13. **Care plan.** Chip Nabila (`+201000001013`), `/care-plans`: 10 visits, 4 done. Mahmoud's request `kx_cp_demo_2` turns CONFIRMED when the agency owner accepts it in Kiorly (4.6 step 6).
14. **Arabic and RTL.** Switch language in the header (or open Passport with `?lang=ar`). *Expected:* `<html dir="rtl" lang="ar">`, mirrored layout, Arabic digits setting, all labels translated; names such as هدى محمود display correctly; switch back to English.

### 4.3 Patient app (Expo)

1. `cd kiorex-platform && npm run mobile:web` (http://localhost:8081), or `EXPO_PUBLIC_MOCK=1` for offline fixtures. On `/sign-in` tap a chip, for example **Mariam Adel**. *Expected:* the browser opens Passport, the phone and code are filled automatically and you return signed in. Tabs: home, appointments, records, account; settings: sessions, family, consents, addresses, delete account. On a device use `npm run ios` / `android` (the dev client opens Passport in the system browser the same way).
2. Sign out from Account: confirmed sheet, app and Passport sessions end.

### 4.4 Ops console, flags and gates (K13-K15)

1. Open http://localhost:5181, on Passport tap **Ops super admin** (`+201000000099`) and then **Fill current code and verify**. *Expected:* lands on Flags. Other pages: Providers (sync from Kiorly), Bookings (search `demo_bk_mk05` and read the timeline), Finance, Moderation, Outbox, Messaging, Orders, Fees, Operations, Onboarding.
2. **Flag OFF gives 403.** Flags: search `kiorex.marketplace`, switch OFF at global scope. As Hoda open Search. *Expected:* 403 `FEATURE_DISABLED {key, scope}` shown as a disabled notice (data not hidden). Switch it back ON. Safety controls are never flags: switching one off is refused. Launch-locked flags show evidence labelled `DEV-ONLY-NOT-A-REAL-GATE`; no seed records a real gate.
3. **Role limits.** Sign in as Ops admin (`+201000009001`): console loads, flag changes are refused (super admin only). A patient (Hoda) opening :5181 sees the no-access page.
4. **Safety and held deposits.** Safety: SOS (resolved), timer expired (acknowledged), unsafe abort raised, escalated (SLO breach 95 s), resolved. Held deposits: two rows (35 min, 46 h); release one to the nurse, refund the other. The home-visit gate metric stays unmet with demo data.
5. **Organisation onboarding import (ops, two-person rule).** Create the 100 % fake sample files once: `cd kiorex-platform/apps/api && npx tsx -e "import {buildSample} from './src/onboarding-import/sample/sample-data'; import {mkdirSync,writeFileSync} from 'node:fs'; const s=buildSample(); mkdirSync('/tmp/onb-sample',{recursive:true}); writeFileSync('/tmp/onb-sample/clinicpro_dump.sql',s.sql); for (const f of s.files) writeFileSync('/tmp/onb-sample/'+f.name,f.bytes)"`. Sign in as **Ops admin** (`+201000009001`), open **Onboarding imports**, create a batch, upload the files. *Expected:* each file is sniffed and scanned (the SQL is parsed, never run), tables are mapped to patients / appointments / visits / billing / documents, and ambiguous items become tasks (confirm mapping, confirm file match, duplicate, orphan file); resolve the blockers (ignoring needs a reason), check the dry-run counts and report hash, then **Request commit**. Switch to **Ops super admin**: Approve (it must be a different person than the requester; the hash must match), Commit. *Expected:* status COMMITTED with per-entity counts (target `mock` by default, nothing leaves the platform); the super admin can Roll back with a reason. Switch the console to Arabic to see RTL.
6. **Org flag for the staff app.** Switch `mobile_staff_app` OFF at org scope for Nile Care: the staff-app bootstrap reports `FLAG_OFF` (4.8 step 4).

### 4.5 Kiorly Clinic (C1-C12)

All at http://localhost:5174/login, chips grouped by organisation.

1. **Front desk day (`frontdesk1.na@`).** Accept the legal banner. Appointments -> Front desk board shows waiting / called / in-exam tickets; call the next ticket (CALLED); New appointment for Hoda Mahmoud with Dr Nadia, first free slot, source Phone (SCHEDULED); check her in (CHECKED_IN and a queue ticket).
2. **Doctor consultation (`nadia.na@`).** Appointments: only her own; open a CHECKED_IN patient and run the encounter; a signed prescription appears in Hoda's vault.
3. **Owner dashboard and money (`owner.na@`).** Dashboard over 60 days shows KPIs; Revenue, Expenses, Reports, Clinics tabs are present.
4. **Plan gates.** `owner.basic@` has no Clinics, Expenses or Reports tabs and opening them shows the upgrade notice; `owner.ss@` is a trial with 14-day entitlements.
5. **Kiorex booking arrives.** Book as Hoda on the patient web (4.2 step 1) and see it at `frontdesk1.na@` with source Kiorex marketplace; Kiorex tab and reviews.
6. **Listing states.** `owner.df@` -> Kiorex: Dr Samah PAUSED (licence expired), `lamia.ss@` paused by org flag, `adham.ss@` verification pending.
7. **Clinic self-service import.** As a group admin (`owner.na@`) open `/onboarding` (checklist) and `/onboarding/import`: pick Patients, Appointments, Price list or Staff, download the CSV template, upload a file, choose the duplicate handling, review the preview and the error report, commit; **Undo** reverts the batch. *Expected:* history lists the job with counts; invalid rows are reported with row, field and code, not silently dropped. (The ops-side import of another organisation's legacy dump is 4.4 step 5.)
8. **Nurse day (`nurse1@nurse-demo.kiorly.test`, Heba).** `/home-visits/today`: her route; open a visit (address readable for the assigned nurse); depart, arrive, record vitals with a systolic far out of range. *Expected:* a CRITICAL vitals alert and escalation; fill and sign the visit record; administer a shared doctor order (a controlled one asks for a witness); SOS on a test visit appears in `/nurse/safety` and the agency owner's inbox.
9. **Dispatch (`dispatch@`).** Dispatch lists the unassigned agency queue; assigning nurses 3 to 5 and the aide is refused (rejected / expired / unverified / not a nurse).
10. **Care-plan requests (`owner@nurse-demo`).** `/nurse/inbox`: accept `kx_cp_demo_2`; `kx_cp_demo_1` accepted and `kx_cp_demo_3` declined are read-only.
11. **Nurse sample to Lab and back (KNLAB01).** Heba `/nurse/lab`: `nl1` released with custody timeline and report link, `nl2` awaiting validation, `nl3` in transit, `nl4` rejected. In Lab: `tech@demo-lab.test` receives `DEMO-NL3-EDTA`, `signatory@` validates and releases `nl2`; the nurse sees the report. A new sample for Hoda or Nabila works; Rana (consent revoked) and Nourhan (none) show named refusals.
12. **Physio (`mai.na@`).** Mahmoud El-Sayed: assessment, plan, progress notes, outcome trends, HEP link, 10-session series.
13. **Accountant limits (`accountant.na@`).** Revenue, Expenses, Reports reachable; no Admin, Clinics, Patients, Encounters.
14. **Arabic and RTL.** Use the language toggle on the login page or inside the app; the layout mirrors and `dir="rtl"`.

### 4.6 Kiorly Pharmacy (PH1-PH8)

http://localhost:5192/login.

1. **Till (`cashier@`).** POS: open a shift, scan or search a drug, add 2, pay cash. *Expected:* receipt and stock decremented; an expired lot (`DMEXP0`) is refused; a return needs `pos.refund_approve` (manager); close the shift to see the variance.
2. **Rx validate and dispense (`pharmacist@`).** Prescriptions: validate a RECEIVED one, safety checks (allergy, interaction, dose) appear, an override needs a reason; dispense and sign off (licensed pharmacist only) gives DISPENSED; reject another with a reason. As `cashier@` the list is readable but validate and sign-off are refused.
3. **Inventory (`manager@`).** Filter expiring (near-expiry lots), blocked (expired x4, quarantined x4, recalled `DM00013` with "Recalled (DEMO-RECALL-001)"); quarantining then releasing creates movement rows and audit entries; a stock count needs `inventory.count.approve`.
4. **Purchasing.** PO list in every state; send the DRAFT, receive the SENT one with lot and expiry (becomes RECEIVED / PARTIALLY_RECEIVED); `chain@` can create but not receive.
5. **Kiorex orders and delivery.** See 4.2 step 10: accept, ready, out for delivery, dispense, or reject with a reason.
6. **Controlled discrepancy.** `pharmacist@` -> Controlled: Morphicure expected 40 counted 38 is OPEN; the reporter cannot countersign; `manager@` or `pharmacist2@` countersigns and it closes with the witness in the audit.
7. **Editions.** `solo.owner@` is standalone (no Kiorex orders); `owner.basic@` web works, the staff app shows the upgrade screen; `chain@` switches branches and transfers stock. Turn `pharmacy.kiorex_orders` OFF in ops to see the outage behaviour.

### 4.7 Kiorly Lab (L1-L9)

http://localhost:5193/login.

1. **Reception (`reception@demo-lab.test`).** New order for a registered patient (for example Hala Fouad): CBC plus a lipid panel, routine: order AWAITING_COLLECTION, invoice created, take a cash payment; issue a STAT queue ticket (appears on `/queue-board`).
2. **Phlebotomy (`phleb@`).** `/phleb`: today's home-collection stops; collect a specimen with labels. *Expected:* COLLECTED with a custody event; Validation is not available to this role (7 permissions).
3. **Accession, enter, validate, release.** `tech@`: receive `DEMO-NL3-EDTA`, enter and technically validate results (a delta check may flag); `signatory@`: medically validate and Release. *Expected:* report version, order RELEASED, report in the Kiorex vault, public link `/r/<token>`.
4. **Critical value (`signatory@`).** Open `DEMO-OPEN-ALERT-001` (K 6.9), acknowledge with a note; it closes with who and when; the other alerts are ESCALATED or ACKNOWLEDGED.
5. **QC failure.** The TSH run (rule `1_3s`) is FAIL and the analyte is blocked; `tech@` runs a passing QC, `signatory@` clears the block.
6. **Kiorex lab booking** (4.2 step 11), **merge duplicates** (`supervisor@` or `manager@`: the two `Ahmed Samy` records), **editions** (`director@chain-lab.test` small chain, `director@basic-lab.test` Basic).

### 4.8 Kiorly staff app (W1-W15)

Run `cd kiorly-team && npm run web` and open http://localhost:8082 at phone width.

1. **Bootstrap.** Clinic tile, chip **Doctor (Nile Care)**, Sign in. *Expected:* Home with quick actions and the Work tab tiles.
2. **Sign a prescription (Dr Nadia).** Work -> Prescriptions -> pending Cetirizine 10 mg for Hoda -> Sign: moves to signed; signing is online-only; `nurse.na@` sees no sign action.
3. **Critical lab result.** Work -> Lab results: potassium 6.9 CRITICAL_HIGH for Hoda; approve with a note: reviewed and audited, idempotent.
4. **Flag off / Basic.** Chips **Owner (Basic clinic)**, Basic pharmacy, Basic lab: each lands on the upgrade screen with only the safety-alert inbox; with `mobile_staff_app` OFF for an org (4.4 step 6) the bootstrap returns `FLAG_OFF`.
5. **Nurse round.** Nurse tile, chip **Solo nurse Mona** (lands on rounds): depart, arrive, finish, SOS.
6. **Vitals.** `nurse.na@`: enter systolic 220 or SpO2 80: a CRITICAL_VITALS alert shows in Inbox and the Home strip.
7. **Pharmacy.** Pharmacist: Rx queue and override with reason; manager: barcode, receiving, stock count, expiry; witness rule for the controlled discrepancy (4.6 step 6).
8. **Lab.** Phlebotomist collects a specimen; Technologist accessions; Signatory acknowledges criticals and validates/releases.
9. **Offline queue.** Go offline in devtools, save vitals and mark an alert read: "Saved offline (n waiting)"; go online: the queue syncs.
10. **Owner revenue and devices.** `owner.na@`: Revenue today / 7 / 30 days; Me -> Devices, remote sign-out.
11. **Language, theme, sign-out.** Arabic default (RTL) and English; light and dark; Sign out asks for confirmation from Home and Me.

## 5. Expected results for the panels themselves

* The panel heading reads "Test users (dev only)" (EN) / "مستخدمو الاختبار (للتطوير فقط)" (AR) with the DEV tag; the page keeps `dir=rtl` in Arabic and the phone / e-mail text stays left-to-right.
* After a chip, the destination screen shows the chosen persona (name in the header or account menu); no password or code is typed.
* Production: `npm run check:dev-test-users` (Clinic web `apps/web`, Pharmacy `apps/web`, Lab `apps/web`, patient app `apps/mobile`, staff app root) builds production + development bundles and fails when the panel or credentials leak.

## 6. Automated smoke test of the panels

`node e2e/dev-test-users/smoke.mjs [passport|ops|mobile|team|clinic|pharmacy|lab|api|all]` (Playwright, needs the stack, the seeds and the web servers up; `KX_TEAM_PORT` picks the staff-app port). It clicks the panel in each app (patient web EN and AR, ops super admin and admin with TOTP, patient app, staff app, Clinic, Pharmacy, Lab) and checks that **every** credential in the panels (26 Clinic + 15 Pharmacy + 27 Lab) logs in through its API. Run on 23 Nov 2026: 68 API logins and every UI check passed.

## 7. Troubleshooting

* Passport shows no panel: it was started before the change. `e2e/scripts/up.sh --restart --only=passport > /tmp/up.log 2>&1`.
* "Too many requests" on the Clinic login: wait `retryAfterSec`; the smoke script does.
* Ops "wrong code": that 30-second code was used already; press the fill button again after the next code.
* Counts in the docs are snapshots: the e2e suites add rows (`kx-e2e-*`, `E2E ...`). The states named here are what the seeds guarantee.
