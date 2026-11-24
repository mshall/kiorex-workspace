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
(cd kiorly && npm run web)                    # Kiorly staff app   :8082
```

Rules: never touch ports **3000 / 5173 / 5175** (another checkout). Do not run `scripts/seed-all.sh --reset` while others use the stack. After the e2e suite (`cd e2e && npm test`) re-run `scripts/seed-all.sh` (the suite revokes some dev gate evidence). Dates are relative to the seed day, so re-run with `--reset` every few days. Tests you run yourself change data (a cancel stays cancelled): re-seed to get the starting state back.

### Kiorly Home web sign-in (http://localhost:5194/signin, same screen as the Kiorly app on phones)
Responsive: phone (<768) is the compact mobile layout; tablet (768-1023) one centred column on the light surface under a quiet brand bar (Kiorly lockup, no gradient banner); desktop (>=1024) a split screen with a solid deep-indigo brand panel with a faint grid (headline, Clinic / Nurse / Pharmacy / Lab highlights, Passport trust line) and the sign-in card centred (tiles 2x2, one row of four at 1800px+). Language (ONE globe button with the current code that opens a menu with العربية / English, current one checked) and theme (Sun / Moon / Monitor icons) are icon controls in the top bar (footer on phones); the dev Test-users panel is a collapsed corner drawer on desktop (press Show). Viewport matrix: `npm run test:e2e -w @kiorex/kiorly-home` (responsive.spec.ts).
Header with the Kiorly lockup, AR/EN toggle and "One sign-in for Clinic, Nurse, Pharmacy and Lab"; card "Sign in" with the tiles Clinic, Nurse, Pharmacy, Lab (last choice remembered; `?to=pharmacy` and `/signin/lab` preselect); two methods: **Kiorex Passport** (default; click a Passport persona in the dev panel, code 000000; the product opens signed in with no second OTP; if the person has exactly one workspace that is not the chosen tile a hint offers both) and **Password** (e-mail + password, Lab: organisation + e-mail). Password uses a single-use handoff: the product API returns a 30-second code, the browser opens `<product>/login?handoff=...`, the product web redeems it once and strips it from the URL; Home never holds a token. Dev panel: pick a tile, then click one of its logins (Clinic 21, Nurse 5, Pharmacy 15, Lab 27) to fill the form. A second-factor account lands on the product login with a notice. Theme control is in the footer. Tests: `cd kiorex-account && npx vitest run apps/kiorly-home`, `npm run test:e2e -w @kiorex/kiorly-home`, `npm run test:e2e:real -w @kiorex/kiorly-home` (Clinic on 5184/3011: see the app README).

### Sign-in methods and theme (founder decisions, 24 Nov 2026)

* **Per-organisation default sign-in method (ADR-038 amendment, 24 Nov 2026).** Every product web login (Clinic incl. Nurse, Pharmacy, Lab) is a one-product Kiorly Home-style screen (split panel "Kiorly Clinic / Kiorly Nurse / Kiorly Pharmacy / Kiorly Lab by Kiorex", centred card, Sun/Moon/Monitor theme icon, globe language control, light default, AR/EN RTL, "Switch product" link to Home `?switch=1`). Both methods are always shown when Passport is available; the org setting `defaultSignInMethod` (Automatic / Kiorex Passport / Password; Clinic Admin > Organization & settings (group admin), Pharmacy Settings > Pharmacy (owner), Lab Settings > General (owner, director)) only picks the preselected one. Automatic = Passport when the org is linked to Kiorex, else Password. Order on the login page: remembered last method on this browser > the org default from `GET /auth/config?org=<id or slug>` (Clinic `/auth/kiorex/config?org=<id>`; org from `?org=`, a tenant subdomain, or the org remembered after the last sign-in) > deployment default `SIGNIN_DEFAULT_METHOD` (PASSPORT on this local stack via `e2e/scripts/up.sh`, PASSWORD when unset). Unknown orgs get the deployment default in the same shape. Try: `http://localhost:5193/login?org=demo-lab` after setting Lab Settings > General to Password, then Passport. Tests per product web: `SIGNIN_BASE_URL=<web> npx playwright test -c playwright.signin.config.ts` (widths 360-2560, Arabic, dark, axe, org PASSWORD vs PASSPORT); API: each product's `signin-default` / `sign-in-config` tests. The line below describes the base behaviour; the preselected tab is now the one above.
* **Two sign-in methods, Passport first.** The Kiorly app (mobile and Expo web :8082; pick the Clinic / Nurse / Pharmacy / Lab tile first) and the Clinic, Pharmacy and Lab web logins offer exactly two options on the same screen: **Kiorex Passport** (preselected, primary button "Sign in with Kiorex Passport") and **Password** (toggle next to it; the dev test-user chips switch to it). A device remembers the last method (and, in the Kiorly app, the last tile) that signed in successfully (`kiorly.signin.method`, `kiorly.signin.entry`, per origin) and preselects it next time. When the API does not offer Passport (`/auth/config`, Clinic `/auth/kiorex/config`; app: `EXPO_PUBLIC_PASSPORT=off`) only the password sign-in shows. `?sso=passport` still starts Passport by itself. In e2e, click the Password toggle (`data-testid=signin-method-password`) before filling e-mail and password.
* **Light is the default theme everywhere** (a dark OS does not change it). An explicit Dark or System choice is stored per origin (`kx-theme`; Kiorly Home `kh.theme`; Clinic `cms-theme`) and restored on the next visit before first paint; in the mobile apps it is kept in AsyncStorage. Use the theme control in each header or the Me / Account screen. To test: open the app with the OS in dark mode (it shows light), choose Dark, reload (it stays dark).

### Every local URL

| Port | What | URL |
|---|---|---|
| 4400 | Kiorex Passport (dev IdP, sign-in, account pages, dev inbox) | http://localhost:4400/account · http://localhost:4400/dev/inbox |
| 4000 | Kiorex API | http://localhost:4000/api/v1 |
| 5180 | Kiorex patient web | http://localhost:5180 |
| 5181 | Ops console / super admin | http://localhost:5181 |
| 8081 | Patient Expo app (web build) | http://localhost:8081 |
| 3010 / 5174 | Kiorly Clinic API / web (if another checkout owns them: this workspace uses 3011 / 5184) | http://localhost:5174/login |
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
| Kiorly staff app | `/sign-in`, below the card (per product tile: Clinic, Nurse, Pharmacy, Lab) | Chip switches to the Password method and fills e-mail / password / org, then press **Sign in** |

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
9. **Telemedicine.** Chip Samir (WAITING), Mariam (SCHEDULED), Hoda (ENDED) at `/telemedicine`; Samir joins the mock room (dev `VIDEO_MODE=mock`). *Expected:* a mock video room, no media leaves the machine. Real video visits are Clinic-owned peer-to-peer calls: a booking that carries a `telehealth` block shows "Join video visit" which opens the Clinic `/v/<token>` page.
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

Run `cd kiorly && npm run web` and open http://localhost:8082 at phone width.

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
12. **Growth tab (GRW-P1-L).** Sign in as `owner.na@` (Clinic tile), Work -> **Growth**. *Expected:* the public Kiorex profile link (`http://localhost:5180/ar/eg/clinic/demo-na-maadi`) with Share, WhatsApp, SMS and Copy link; a QR code; "Your links" with 0 of 25 used; performance, suggestions and the Kiorex fee statement for the month; "Open the Growth workspace". **New link** -> name, channel -> the link appears with Visits / Bookings / Attended; tap it -> Share, WhatsApp, SMS, Copy, QR, Pause. As `nadia.na@` (doctor) the screen shows only her own profile link (no performance, no fee statement, no New link). `frontdesk1.na@` and `accountant.na@` have no Growth tile (the API answers 403 `MODULE_NOT_ALLOWED`); `owner.basic@` gets the upgrade screen (403 `FEATURE_DISABLED`). Arabic is right to left with Arabic-Indic digits; offline shows the last copy with a banner and "needs a connection" when you try to create or pause.

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

## Connect a standalone organisation to Kiorex (ADR-040)
1. **Clinic.** Sign up a new clinic at http://localhost:5174/signup (dev OTP `424242`). Open **Kiorex** and the new **Connect to Kiorex** banner (`/kiorex/connect`). *Expected:* a checklist with a status per step (Done, Action needed, Waiting on Kiorex, Blocked), a Fix it link on each open step, per-doctor progress, and **Request to go live** disabled until every required step is done. Accept the marketplace terms (the fee wording reads the published market fee schedule). *Expected:* the doctor's listing stays DRAFT (blocker `connection`) even when everything else is green. Press **Request to go live**: the listing becomes PENDING_VERIFICATION and the page says Waiting for Kiorex.
2. **Pharmacy / Lab.** Sign up a new pharmacy (http://localhost:5192/signup) or onboard a lab (dev), open **Connect to Kiorex** in the menu. Opt a branch in (hours, pin, licence number), add a priced item, upload a licence, add a payout LABEL (a long digit string is refused: no bank data is stored), accept the terms, **Request registration**. *Expected:* status Waiting for Kiorex.
5. **Front door (state-aware Kiorex tab / Connect to Kiorex).** The wording is NEEDS_HUMAN (founder and counsel). Sign up a standalone clinic, pharmacy or lab and open **Kiorex** (Clinic) or **Connect to Kiorex** (Pharmacy, Lab). *Expected:* the landing "Reach more patients with Kiorex" with true benefits, how it works, a readiness count from real state, reassurance and a fee line (the published schedule, or "confirmed by the Kiorex team"). The first view sends one anonymous marker. Press **Talk to us**: an inline form (no pop-up), the Send button stays disabled until consent is ticked and a phone or e-mail is given; after sending, Ops > **Partner leads** (http://localhost:5181/partner-leads) lists one lead (NEW, then STARTED once you press **Start connecting**, SUBMITTED and LIVE follow the onboarding request) with assignee and notes, and the funnel tiles above it count interested, started, submitted and live with conversion. Press **Start connecting**: the state becomes In progress with the next step highlighted. After the request: Waiting for Kiorex with what happens next. After Go live: the dashboard (this month, listings, recent, settings link). Dismiss the card on the home dashboard; it stays hidden until you press "Show the Kiorex card again" on the tab. Nav item hidden for non-owner roles (cashier, reception). Automated: `e2e/test/24-kiorex-front-door.e2e.ts`; per product `npx playwright test -c playwright.kiorex-tab.config.ts` in each web app (screenshots with `KIOREX_TAB_SHOTS_DIR=_docs/test-flow/kiorex-tab`).
3. **Ops.** Open http://localhost:5181 as **Ops admin** (`+201000009001`) and choose **Partner onboarding**. *Expected:* the request is queued with a progress percentage and a highlighted "Needs a person" column. Open it: automated checks have already run (signed handshake, dry run, flags, market, duplicates, documents); press **Run automated checks again** to repeat them. The human steps (Review documents, Verify licence, Confirm fees, and for pharmacy/lab Record launch-gate evidence) carry an **Action needed** badge. The launch-gate step only links to Feature flags: gate evidence is recorded by a human super admin there, never by the wizard. Finish the steps, **Request approval**, then switch to **Ops super admin** (`+201000000099`): **Approve** is disabled for the requester and works for a second person. Press **Go live** (it stays hidden until every gate is green).
4. **Back in the product.** Press **Refresh status** (or reopen the page). *Expected:* Approved/Live, progress 100 %, and the offer to make Kiorex Passport the default sign-in and to invite staff. A clinic's doctor now appears in Kiorex search after the provider sync. Pharmacy/Lab can **Rotate credentials**: the new secrets are shown once, Kiorex applies them only after a passing handshake (ops page banner **Apply rotation**).
5. **Pause, changes, reject.** In ops use **Request changes** / **Reject** (a reason is required) or **Pause** on a live partner; the partner sees the reason code and a clinic's listings pause until **Resume**. Switch the console and the product to Arabic to see RTL.
Automated: `e2e/test/22-standalone-connect.e2e.ts` (clinic, pharmacy and lab to LIVE, signature and two-person checks, PHI-free audit), unit tests in each repo (`kiorex-connect*.test`, `partner-onboarding/steps.unit.spec.ts`, ops `partner-onboarding.test.tsx`).


## Quick setup ("Welcome - quick setup") in every product
Inventory, rules and per-step results: `_docs/test-flow/quick-setup-inventory.md`, `_docs/test-flow/quick-setup-results.md`.
1. **Fresh organisation.** Clinic: sign up at http://localhost:5174/signup (Pro; dev OTP `424242`). Nurse: same public sign-up API with `edition: "NURSE"` (`nurseKind` SOLO or AGENCY, plan `NURSE_LITE` / `NURSE_AGENCY`). Pharmacy: `POST :3100/api/v1/onboarding/signup` then sign in at :5192 and press "Finish setup" on the first-run page. Lab: http://localhost:5193/onboarding. Never use the demo tenants for this (they are already set up).
2. **Where it shows.** Clinic and Pharmacy and Lab: the dashboard (`/`). Clinic and Nurse: also the full page `/onboarding` (Nurse: `/nurse/onboarding`). Each row has one primary button (the highlighted next step is "Start"); done rows turn green and collapse; optional rows have "Skip".
3. **Click a step.** *Expected:* the exact screen opens (for example Clinic hours: `/clinics/<id>?tab=settings`), the first field is focused and outlined, and a bar says "Step 3 of 13: Set working hours - <clinic>" with **Back to checklist** and **Skip for now**. Do the work (save the form). *Expected:* within about a second the bar turns green ("Done. Taking you back..."), you land on the checklist, the row shows a check that draws in with a soft green tint, the progress bar eases to the new percentage and the next step is scrolled to, outlined and focused. Nothing needs a reload. With "reduce motion" on, the same happens without animation.
4. **Two clinics / branches / labs.** Add a second one (Clinic: Clinics > Add clinic; Pharmacy: Settings > Branches, CHAIN edition; Lab: Settings > Labs, CHAIN edition). Per-entity steps show "1 of 2" and a "Show 2" button; each entity row has its own Open / Skip and its own deep link (`...&entity=<id>`). Finish one: the step stays pending until all are done. Add a third later: the finished step reopens.
5. **Roles and plans.** Sign in as a branch manager (Clinic), cashier (Pharmacy) or reception (Lab): owner-only steps show a disabled button and "Ask the owner. Can be done by: ..."; **Connect to Kiorex** is hidden. On the Clinic Lite plan "WhatsApp reminders" is marked "Upgrade to unlock" and is not counted.
6. **Finished.** When every step is done or skipped the card turns into "You're all set" with **Dismiss**; it stays dismissed for the organisation (server side) and returns when new work appears (for example a new clinic).
7. **Arabic / dark / sizes.** Switch language and theme; check 360, 768, 1440 and 2560 px: no horizontal scroll, RTL mirrored, Tab reaches every button.
Automated: Clinic `cd clinics-management/apps/web && PLAYWRIGHT_NO_SERVER=1 npx playwright test e2e/quick-setup-clinic.spec.ts e2e/quick-setup-nurse.spec.ts --project=chromium` (needs the API :3010 and web :5174 up); Pharmacy `cd kiorly-pharmacy/apps/web && npx playwright test -c playwright.setup.config.ts`; Lab `cd kiorly-lab/apps/web && npx playwright test -c playwright.setup.config.ts`; rules: `node --import tsx --test src/onboarding/onboarding-plan.node.test.ts` (Clinic) and `src/modules/setup/setup-plan.node.test.ts` (Pharmacy, Lab).

## Mobile deep links and regional bootstrap (GRW-P1-H)
Scope: patient app (`kiorex-platform/apps/mobile`, scheme `kiorex`, host `kiorex.com`) and the Kiorly staff app (`kiorly`, scheme `kiorly`, host `www.kiorly.com`). Universal and App Links need a **native build** (associated domains entitlement and verified intent filters are native config) and, for real verification, the Apple Team ID and the Play app-signing SHA-256 in the well-known files (NEEDS_HUMAN, launch guide section 2.5). Until then the checks below use the custom scheme, which needs no association, and a development build or Expo Go for the scheme.

**Automated (run these first)**
- `cd kiorex-platform/apps/mobile && npx jest src/__tests__/deepLink.test.ts src/__tests__/deferredLink.test.ts src/__tests__/nativeIntent.test.tsx src/__tests__/appLinksConfig.test.ts src/__tests__/bootstrap.test.ts` (parser with malicious inputs, install referrer fixtures, consent gate, native config).
- `cd kiorly && npx jest src/__tests__/deep-link.test.ts`.
- `cd kiorex-platform/apps/api && npm run test:unit -- src/market` and `NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects integration --runInBand --testPathPatterns deep-links` (bootstrap, well-known files, fallback pages).
- `cd kiorex-platform/apps/web && npx playwright test -c playwright.deeplinks.config.ts` (fallback page in Pixel 7 and desktop Chromium, own server on :4391).
- `cd kiorex-account && npx vitest run test/domains.test.ts` (hosts and association templates).

**Bootstrap (any machine with the API on :4000)**
1. `curl -s localhost:4000/api/v1/bootstrap | jq` *Expected:* `liveMarkets` has one entry, `showMarketSelector:false`, an `apiEndpoint` ending in `/api/v1`, `capabilities`, header `Cache-Control: public, max-age=60`. `curl -s 'localhost:4000/api/v1/bootstrap?cc=sa'` *Expected:* still the live market (SA is not live). Adding `-H 'X-Forwarded-For: 8.8.8.8' -H 'CloudFront-Viewer-Country: US'` changes nothing: the market never follows the caller location.
2. `curl -si localhost:4000/.well-known/apple-app-site-association` and `.../assetlinks.json` *Expected:* 200, `application/json`, no redirect, `X-Kiorex-App-Links: placeholder` and the `TODO_NEEDS_HUMAN_*` values until `APPLE_TEAM_ID` and `ANDROID_SHA256_CERT_FINGERPRINTS` are set (production answers 404 until they are).

**iOS simulator (`xcrun simctl`)** (patient app installed from a development build; boot the simulator first)
1. `xcrun simctl openurl booted 'kiorex://doctor/<doctor-id>'` *Expected:* the doctor profile opens. With `https://kiorex.com/ar/eg/doctor/<doctor-id>` the same screen opens only after the association is verified (Team ID needed); without it Safari opens the website.
2. `xcrun simctl openurl booted 'kiorex://r/AB12CD3456'` *Expected:* the invitation screen with **Allow** and **Not now** (equal weight, draft wording). Nothing is sent before the choice (watch the API log: no `POST /growth/v1/touch`). **Allow** sends one touch; **Not now** discards the code.
3. `xcrun simctl openurl booted 'kiorex://q/7XK2M9QP'` *Expected:* the same screen for a provider QR code. `'kiorex://q/7XK2M9QI'` (invalid character) *Expected:* Home.
4. `xcrun simctl openurl booted 'kiorex://appointment/<booking-id>'` signed out *Expected:* sign-in first, then the appointment opens. The link never signs you in.
5. `xcrun simctl openurl booted 'kiorex://doctor/x?to=https://evil.example'` and `'kiorex://doctor/..%2f..%2fetc'` *Expected:* no navigation to the URL; the second opens Home.
6. `xcrun simctl openurl booted 'kiorex://claim'` *Expected:* the claim code screen (iOS has no install referrer): a valid code is accepted, `https://evil.example` shows "This code is not valid".
7. Staff app: `xcrun simctl openurl booted 'kiorly://open/visit:<appointment-id>'` *Expected:* Home, then (signed in) the visit; signed out you sign in first. `'kiorly://open/https:evil.example'` *Expected:* Home.

**Android (`adb`)**
1. `adb shell am start -W -a android.intent.action.VIEW -d 'kiorex://r/AB12CD3456' com.kiorex.app` and the same for `kiorex://doctor/<id>`, `kiorex://q/<code>`, `kiorex://appointment/<id>`. *Expected:* as the iOS steps.
2. App Links (needs the signing fingerprint published): `adb shell pm verify-app-links --re-verify com.kiorex.app` then `adb shell pm get-app-links com.kiorex.app` *Expected:* `kiorex.com: verified`. Then `adb shell am start -W -a android.intent.action.VIEW -d 'https://kiorex.com/ar/eg/doctor/<id>'`.
3. Deferred link (Play install referrer): needs a build installed from the Play internal testing track through the fallback page after **Allow**; the first launch then shows the invitation screen with the code and a second cold start shows nothing (read once). There is no reliable local `adb` simulation of the Play referrer, so the parsing and read-once behaviour are covered by the jest fixtures (`deferredLink.test.ts`); the on-device path is NOT verified until a Play build exists.
4. Staff app: `adb shell am start -W -a android.intent.action.VIEW -d 'kiorly://open/rx:<id>' com.kiorly.app`.

**Web fallback and store pages (browser on a phone or device emulation)**
1. Open `http://localhost:4000/r/AB12CD3456?l=en` (API on :4000; set `ANDROID_PLAY_STORE_URL` and `IOS_APP_STORE_URL` to see the store buttons). *Expected:* "Open in the app", "Continue on the web", consent with **Allow** and **Not now**; the network tab shows no `touch` call and the Play link has no `referrer=` before the choice. **Allow:** one `POST /api/v1/growth/v1/touch` (`landingKind`, `ref`, `dwellMs` only), the Play link gains `referrer=kxref%3Dr.AB12CD3456` and the claim code appears. **Not now:** nothing is sent.
2. `/q/7xk2m9qp` (provider QR), `/a/<id>` (appointment, no consent block), `/r/abc` and `/q/7XK2M9QI` *Expected:* 404, nothing echoed. Add `?to=https://evil.example&next=//evil.example` to a valid link *Expected:* ignored, no redirect.
3. With `growth.deep_links` OFF in the ops console, `/r/<code>` redirects (302) to the website; the well-known files stay served.

## Growth & Patient Acquisition engine, end to end (GRW-P1-L and GRW-P1-M)
Scope: provider links and QR, attribution decision PROVIDER_LED / MARKETPLACE, Kiorex commission (EGP) and statement, consent, widget, deep links, SSR pages and sitemap, Super Admin configuration, analytics, erasure, the staff app Growth tab. Everything is mock or dev data; **marketing stays launch-locked** (`growth.analytics_visitor`, `growth.marketing_messaging`, `growth.patient_referral`, `growth.rewards` OFF, no gate is recorded by any test). Wording of consent texts is NEEDS_HUMAN.

**Automated (run these first; the stack must be up, see section 1)**
- `cd e2e && npx vitest run test/25-growth-booking.e2e.ts test/26-growth-analytics.e2e.ts test/27-growth-provider-journeys.e2e.ts test/28-growth-platform-journeys.e2e.ts` (about 1 minute; they add test-only fixtures and remove them: a `CLINIC_ADMIN` user and a booking slug on the KX-DEV clinic, a second Passport super admin `+201000009777`, a throw-away rate only when none is in force; approved `ZZ`-market configuration versions are immutable history and stay).
- `cd kiorly && npx jest` (staff app, incl. `growth-helpers`, `growth-screen`) and, with the Expo web build served (`npx expo export -p web --output-dir /tmp/kw-web && node e2e-web/serve.mjs /tmp/kw-web 8096`): `cd kiorly/e2e-web && WEB_URL=http://localhost:8096 API_URL=http://localhost:3010/api/v1 npx playwright test -c clinic.config.ts clinic-growth` (4 tests: owner, doctor, no-access roles, Arabic RTL).
- `cd clinics-management/apps/api && node --import tsx --test src/mobile/growth-mobile.node.test.ts` (module per role, doctor scoping, writes, QR) and `cd kiorex-platform/apps/api && NODE_OPTIONS=--experimental-vm-modules npx jest --selectProjects unit` (includes the back-channel `subject.deleted` detection).

**Flows (test users in section 3; links are local)**

*G1 Provider link, QR and a fee-free booking (provider-led).* `owner.na@` (or the KX-DEV clinic admin created by test 27): open `http://localhost:5174/kiorex/growth`, **New link** (scope Reception desk, channel QR), note the 8-character code. Open `http://localhost:3010/api/v1/public/links/q/<CODE>` *Expected:* 302 to `.../b/<clinic-slug>?s=<CODE>`; an unknown code is 404. Open the page JSON `http://localhost:3010/api/v1/public/booking-pages/<clinic-slug>?s=<CODE>` *Expected:* `commissionFree: true`, `tracked: true`, a signed `lt`; the link shows 1 visit in the workspace and in the staff app. Open the doctor on Kiorex with the token: `http://localhost:5180/ar/eg/doctor/<doctor-slug>?lt=<LT>`, sign in with a NEW phone (any `+2012xxxxxxxx`, OTP in `.e2e/logs/passport.log`), book. *Expected:* the booking has decision `PROVIDER_LED` (`GrowthAttributionDecision.origin`), the Clinic appointment `acquisitionOrigin = PROVIDER_LED`. Check the patient in at the Clinic, finish the visit. *Expected:* no `KiorexCommissionCharge`; `GET /kiorex/commission-decisions?appointmentId=` says "Your own channel: no fee"; the statement `GET /kiorex/commission-statement?period=YYYY-MM` counts it under `providerLedBookings` and the active charges do not change; the link row shows 1 booking and 1 attended; the staff app Growth tab shows the same numbers.

*G2 Kiorex marketplace booking and the EGP fee.* A NEW patient finds the doctor through Kiorex search (`http://localhost:5180`), books without any link, the visit is completed. *Expected:* decision `MARKETPLACE` or `UNATTRIBUTED` (no evidence: still chargeable like before), exactly one `KiorexCommissionCharge` for the rate in force (EGP 40 in ADR-007; the dev database may carry another NEEDS_HUMAN placeholder rate, compare with `KiorexCommissionRate` where `validTo` is null), the statement's active charges rise by exactly that amount, the staff app fee card shows it. The same patient booking again (returning patient) is attributed but **no second fee**.

*G3 Dispute with evidence (PROVIDER_LED_EVIDENCE).* In the Clinic open Billing -> Kiorex charges, dispute a charge with reason "The patient came through our own link" (evidence mode `mock` reads the Clinic's own facts: the booking must carry one of the organisation's link codes, test 27 writes that fact). *Expected:* dispute `AUTO_APPROVED`, the charge is reversed, a new append-only decision `...+PLE` (origin `PROVIDER_LED`, `NO_CHARGE`), a `CommissionAdjusted` event on the outbox, the statement still reconciles for that appointment. Without the evidence the dispute stays `OPEN` for a human. Evidence can only remove a fee, never add one.

*G4 Consent and touches.* `curl -si -XPOST localhost:4000/api/v1/growth/v1/touch -H 'content-type: application/json' -H 'X-KX-Consent: analytics' -d '{"landingKind":"HOME","utm":{"source":"google"}}'` *Expected:* 202 `{"accepted":true,"visitorKeySet":false}` and no `Set-Cookie`: the visitor key is locked while `growth.analytics_visitor` is OFF (counsel gate). `POST /api/v1/growth/v1/consent {"analytics":false,...}` with a `kxv` cookie *Expected:* 201 and a `Set-Cookie` that clears it. A UTM value that looks like an e-mail is rejected; unknown keys are dropped. A patient without touches is `UNATTRIBUTED`; with a referral or campaign touch (written by the test) `MARKETPLACE` (referral 30 days, campaign click 7 days).

*G5 Booking widget from another origin.* As the clinic admin set the widget on in the workspace with the origin `https://clinic-site.example.test` (https only, no wildcard, no path, at most 10). `POST localhost:4000/api/v1/widget/v1/session` with `Origin: http://localhost:4000` and `{"org":"<clinic slug>","parentOrigin":"https://clinic-site.example.test"}` *Expected:* 200 with a short-lived token; another origin 403 `GROWTH_WIDGET_ORIGIN_NOT_ALLOWED` (audited under Ops -> widget audit). A booking made with the token (`X-KX-Widget`) is forced to the clinic channel: decision `PROVIDER_LED`, no fee. The token cannot call any other API route (403 `WIDGET_ROUTE_NOT_ALLOWED`). Remove the origin: the token stops working at once.

*G6 Deep links and bootstrap.* `curl localhost:4000/api/v1/bootstrap?cc=EG` (one live market, no selector), `/.well-known/apple-app-site-association` (paths `/q/*`, `/r/*`, doctor and clinic pages, `TODO_NEEDS_HUMAN_*` ids), `http://localhost:4000/q/<CODE>?l=en` (fallback page, LTR) and without `l` (Arabic, RTL), `/q/!!bad!!` (404, nothing echoed), `?next=https://evil.example` (never followed). Staff app: `xcrun simctl openurl booted 'kiorly://open/growth:me'` opens the Growth screen after sign-in (see the GRW-P1-H section).

*G7 SSR pages, robots and sitemap.* `curl -si localhost:4000/en/eg/doctor/mona-fahmy` *Expected:* 200, `<html lang="en" dir="ltr">`, `link rel=canonical` without tracking parameters, `hreflang` ar / en / x-default, valid JSON-LD (Physician), and in this non-production stack `X-Robots-Tag: noindex` and `<meta name="robots" content="noindex,follow">`. The Arabic page is `lang="ar" dir="rtl"`. `/ar/eg/me`, `/ar/eg/account`, `/ar/eg/doctor/not-a-real-doctor`, `/xx/eg` are 404. `localhost:4000/robots.txt` disallows everything outside production; `localhost:4000/sitemap.xml` is a well-formed `sitemapindex` (empty until the environment is indexable, see `Docs/SEO.md`). Ops -> Growth -> SEO shows page counts and the guard reasons.

*G8 Super Admin configuration (maker-checker).* Ops console `http://localhost:5181` as `ops_super` (+201000000099, OTP 000000, TOTP `REMOVED-OLD-DEMO-TOTP-SECRET`) -> Growth -> Configuration: create a DRAFT, Submit. *Expected:* **you cannot approve your own version** (403); a second super admin approves; the version is active at its effective time (a money policy such as the attribution windows must be dated at least 7 days ahead and needs a provider announcement text; a decision made before the change still cites the old version); Propagation lists which readers serve which version; Roll back creates a NEW version through the same approval path; raw secrets and unknown keys are rejected. (Test 28 runs this in the isolated market `ZZ` with a fixture second admin so no live setting changes.)

*G9 Analytics.* Ops -> Growth -> Overview after G1-G3 and `POST /api/v1/ops/growth-analytics/rollup {"days":2}`. *Expected:* the rollup is idempotent, attended new patients equal the facts, any cell below 10 shows `<10`, no person-level field anywhere, CSV export carries the same cells; a provider sees only its own organisation (signed request).

*G10 Erasure.* Delete a patient's Passport account (`DELETE localhost:4400/api/account` with the access token, or Passport -> Account -> Delete). *Expected:* Passport sends the back-channel `subject.deleted`, Kiorex runs the growth anonymiser within seconds: the person's touches and visitor keys are deleted, touches that a decision cites become anonymous evidence (no `sub`, no visitor key, empty IP hash), the decision and the Clinic's fee record stay (they hold no personal data), and the audit row `growth.erase_subject` stores `sha256(sub)`, never the sub. (Found and fixed by this suite: Kiorex read `subject.deleted` as a plain session revoke, so erasure never ran.)

*G11 Arabic and English.* Every flow above in Arabic and English: SSR pages and fallback pages (lang, dir), the Clinic poster `.../growth/links/<id>/poster?lang=ar|en&size=A5`, the staff app Growth tab (Arabic default, RTL, Arabic-Indic digits), the consent versions. Arabic spells Kiorex as كيوريكس; "by Kiorex" appears only on the splash and About in the staff app.

**Honest gaps.** The visitor-key touch endpoint is locked until the counsel gate, so the touches a consenting visitor would leave are written by the harness. Real evidence mode (`GROWTH_EVIDENCE_MODE=real`), real search-engine and ad-platform integrations, the Pharmacy and Lab Growth tabs, PDF posters (browser "Save as PDF"), native share on iOS and Android devices (the share sheet is the platform's; Copy on web uses the clipboard API), and app-link verification (needs the Apple Team ID and Android certificate, NEEDS_HUMAN) are not covered.

## Edge cases (EDGE-40..49, 24 Nov 2026)
Scope: the things that go wrong at the edges, not the happy path. Full scenario list, results, root causes of the 24 defects fixed and the remaining risks: `_docs/test-flow/EDGE_CASE_REPORT_2026-11.md`; guided manual module "Edge cases" in `_docs/test-flow/index.html` (iCloud copy kept in step). Everything is mock or dev data; fixtures use the `edge_<tag>_` prefix and remove themselves.

Automated (needs the seeded stack up; about 4 minutes):
`cd e2e && npx vitest run test/40-edge-money.e2e.ts test/41-edge-booking.e2e.ts test/42-edge-growth.e2e.ts test/43-edge-identity.e2e.ts test/44-edge-vertical.e2e.ts test/45-edge-public-privacy.e2e.ts test/46-edge-tenant.e2e.ts test/47-edge-import.e2e.ts test/48-edge-data.e2e.ts test/49-edge-fuzz.e2e.ts`
Unit and integration regressions: Kiorex `cd kiorex-platform/apps/api && npx jest --selectProjects unit` (pay-edge, policy-edge, market-time, errors, reject-nul-bytes) and `--selectProjects integration --runInBand --testPathPatterns "pay-edge|onboarding-import-edge"`; Clinic `node --import tsx --test src/kiorex/edge-commission-boundaries.node.test.ts src/marketplace/edge-policy-boundaries.node.test.ts src/common/*.node.test.ts` and `src/telehealth/telehealth-edge.integration.test.ts` (kiorly_test database). Browser: `kiorex-platform/apps/web` `npx playwright test e2e/edge-ui.spec.ts --project=chromium`; sign-in screens `SIGNIN_BASE_URL=http://localhost:5174 npx playwright test -c playwright.signin.config.ts e2e/signin-edge.spec.ts` in Clinic (Pharmacy :5192, Lab :5193).

By hand (what a human still checks, each *Expected* is what the automation asserts):
- *E1 Double pay.* Open a deposit booking, click **Pay** twice quickly and complete both tabs. *Expected:* one payment, one deposit; the second tab says already paid; no second charge in Ops -> Payments.
- *E2 Pay after cancel.* Start the deposit checkout, cancel the booking in another tab, then complete the payment. *Expected:* the payment is captured and refunded automatically (Ops -> Payments shows one refund of the full amount), the booking stays cancelled.
- *E3 Last slot.* Two browsers (two patients) pick the same last slot and press Hold together. *Expected:* one hold, the other sees "slot taken" with three alternatives; after the winner cancels the slot is free.
- *E4 Reschedule collision.* Two patients move different bookings onto one free slot together. *Expected:* one moves, the other gets "slot taken" (not "clinic system busy").
- *E5 Summer times.* With a booking in July, trigger the WhatsApp booking flow (log channel) and compare the slot time in the message with the doctor's slot in Kiorly. *Expected:* identical wall-clock time (Cairo +3); winter identical too. Quiet hours 22:00 to 08:00 are Cairo wall-clock all year.
- *E6 Link token.* Take a provider link, edit one character of the `lt` in the URL, book. *Expected:* the booking works and is NOT fee-free. Revoke the link in the Clinic Growth tab, book again with the old URL: still not fee-free.
- *E7 Cancel against accept.* In Pharmacy open a paid Kiorex order, press Accept while the patient presses Cancel. *Expected:* one wins; cancelled means refunded in full and the pharmacy order is cancelled; accepted means the patient is told it is too late to cancel.
- *E8 Narrow and wide.* Patient web at 320 px, at 200 % browser zoom and at 2560 px, in Arabic and English, with a 60-character Arabic doctor name. *Expected:* no horizontal scroll (the specialty chips scroll on purpose), every button reachable, Tab shows a focus ring on every stop.
- *E9 Offline.* Load the search, switch the network off, press a filter, switch it on. *Expected:* the page stays readable, no crash; results return.
- *E10 Hostile text.* Paste 80 emoji, a zero-width run, `%00` and 5 000 characters into a search box and into a clinic patient name. *Expected:* nothing breaks; the NUL character is refused with a clear 400 message.
- *E11 Bad ranges.* `curl 'localhost:4000/api/v1/search/providers?pageSize=abc'` and `.../providers/<id>/slots?typeId=<t>&from=2026-12-01&to=2026-11-01`. *Expected:* a page of at most 30, and a 400 `INVALID_RANGE`.

**Honest gaps.** 10 000-row lists (the demo data is small, caps asserted instead), Kiorly Home / staff app / ops console / Quick Setup and Connect wizards under 320 px, 2560 px and offline, waitlist offers racing a manual booking, the three-channel last-slot race, TURN failure on the live stack, lab sample-rejection edges, browser-level widget postMessage forgery.
