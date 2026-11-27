# Mobile testing guide: Kiorex (patient) and Kiorly (staff) against kx-test

27 Nov 2026. No secrets in this file. Accounts: the private register `_private/DEMO_ACCOUNTS.md` (git-ignored, never in git); the synthetic phone numbers of the demo seed are listed in `e2e/kx-test/README.md`.

## 0. What you are testing

| App | Repo folder | Bundle / package | Scheme | Passport client |
|---|---|---|---|---|
| Kiorex (patients) | `kiorex-platform/apps/mobile` | `com.kiorex.app` | `kiorex://` | `kiorex-mobile` |
| Kiorly (staff: Clinic, Nurse, Pharmacy, Lab) | `kiorly` | `com.kiorly.app` | `kiorly://` | `kiorly` |

Both builds are the **kx-test profile**: every host comes from `config/env/test.env` of each app, generated from the URL registry (`node _docs/registry/emit-mobile-env.mjs --write-all`; never typed by hand). kx-test hosts: API `api.test.kiorex.com`, Passport `passport.test.kiorex.com`, Clinic `clinics.test.kiorly.com`, Pharmacy `pharmacies.test.kiorly.com`, Lab `labs.test.kiorly.com`. The Passport clients already accept both schemes (`kiorex://`, `kiorex-test://`, `kiorly://`, `kiorly-test://`); no change was needed there.

Everything external is MOCK on kx-test: push, SMS, WhatsApp, payments, e-mail.

## 1. Signing in: how you get the one-time code

Passport sends a code to the phone number. On kx-test the sender is a mock, so the code is written to the Passport container log. Read it with your own AWS CLI credentials (account 990597228737):

```bash
scripts/kx-test-otp.sh +201000001001          # waits up to 60 s for a NEW code, prints only the digits
scripts/kx-test-otp.sh +201000001001 --last   # newest code of the last 20 minutes
```

Steps: in the app tap **Continue with Kiorex Passport** (patient) or pick the product and tap **Sign in with Kiorex Passport** (staff), type the phone, tap Send code, run the script, type the digits. If Passport offers a passkey or an authenticator, choose "Skip for now".

Limits (security controls, do not reset): 5 codes per phone and 20 per IP and hour. All the phones on one Wi-Fi share one IP bucket, and the automated suites also use it: if the page says "Too many requests from your network", wait an hour or test from mobile data.

Why there is no friendlier method: a fixed or bypass code on a host that also holds the real Clinic organisation would be a hole. The deploy guard (`infra/tofu/deploy/compose/kx-guard-otp.sh`) already makes mock code logging impossible in pilot and prod. A hosted-test-only "test code" screen was NOT built (it would need a change in the Passport app code, which another agent owns); proposal in section 7.

## 2. Android phone (side-load, no store account)

Built here (no paid account): `_private/builds/android/kiorex-mobile-test-0.1.0-<sha>.apk` and `kiorly-app-test-0.1.0-<sha>.apk` (git-ignored; release-mode, arm64, signed with the Android **debug** key, so they are for testing only and can never go to the Play Store).

1. Get the file to the phone (AirDrop does not work to Android: use USB, Google Drive, or `adb`).
2. With a USB cable, Developer options and USB debugging on: `adb install -r <file>.apk`. Without a cable: open the APK on the phone, allow "Install unknown apps" for the app you used (Files or Chrome), install. Play Protect may warn about an unknown developer: "Install anyway".
3. Open the app. Passport opens in Chrome Custom Tabs; after the code the browser returns to the app by the `kiorex://` or `kiorly://` scheme.
4. Rebuild: `cd kiorly && npm run build:android:test` (same for the patient app in `kiorex-platform/apps/mobile`). Toolchain used: JDK 17 (`~/.local/jdk17`), Android SDK 35/37 (`~/.local/android/sdk`), Gradle 9, `expo prebuild` in a copy under `~/kx-mobile-build` (the checkout's `ios/`, `android/` and `.env.local` are never touched). Needs about 4 GB of disk and 3 to 5 minutes.

## 3. iPhone: what works now and what needs an Apple account

A real iPhone cannot run an app without Apple signing. Without an Apple Developer account you can do the following today:

* **iOS Simulator on the Mac** (done, works): `_private/builds/ios-simulator/kiorly-app-test.app` and `kiorex-mobile-test.app` (arm64). `xcrun simctl boot <device>`, `xcrun simctl install booted <path>.app`, `xcrun simctl launch booted com.kiorly.app`. Rebuild: `npm run build:ios-sim:test`.
* **Web build in iPhone Safari** (works for everything except native-only parts: secure storage, push, universal links, camera): serve the export (`npm run export:web:test`, then any static host) and open it. Passport redirects back to `<origin>/auth/callback`, which is **not** registered on kx-test (only the native schemes and the real web hosts are). To use it, the founder would register one more redirect URI (see section 7) or host the web build on a registered host. Not recommended as the main route.

For the real iPhone you need (the founder creates these; nothing was created here):
1. **Apple Developer Program** membership. Organisation enrolment needs the registered legal entity and a D-U-N-S number (waiting on that, see handoff); an **individual** account (USD 99 per year, identity check, about a day) is enough to start TestFlight testing and can be replaced later. Use the `apple@` group address.
2. **Expo account + EAS** (free tier is enough for a few builds): `npx eas-cli login`, `eas init` in each app (writes the project id into `app.json`, a commit by you).
3. Register the iPhone (ad hoc) or use TestFlight: `eas build -p ios --profile kx-test` (ad hoc: `eas device:create`, then build) or `eas build ... && eas submit -p ios` for TestFlight, then install TestFlight on the iPhone and accept the invitation.
Until then: do your iPhone-flavoured testing in the Simulator (same code, same hosts), and Android on the phone.

Push needs Firebase files and an APNs key; it stays mock (the guide section 6 says what you can still check).

## 4. What to test: Kiorex (patient)

Account: synthetic patient `+201000001001` (Hoda Mahmoud). Other patient demo phones are in the private register.

| Area | Check | Expected on kx-test today |
|---|---|---|
| Sign-in | Welcome screen, language AR/EN (first launch is Arabic, RTL), Passport phone code, return to the app | works (Android emulator verified up to the Passport page; web build verified end to end) |
| Home | greeting with the name, specialties, services tiles | works; yellow banner "Kiorex is not live in your market yet" |
| Search and booking | search a doctor, open the provider, pick a slot, deposit in mock mode | **blocked**: the Egypt market gate `market.eg.live` is closed until a human records the gate evidence in the Ops console (admin.test.kiorex.com, role with permission). Until then search is empty and the provider page says "awaiting approval". Founder step to unlock booking tests |
| Appointments | upcoming, past, waitlist | "No upcoming appointments" (no booking possible yet); the demo bookings exist for other accounts |
| Pharmacy orders / Lab bookings | list and detail | tiles read "Unavailable / awaiting approval" while the gate is closed |
| Records / vault | list, add a record, share records, follow-ups | empty list for the demo patient; add-record flow can be exercised |
| Notifications | settings, consent text | push is mock: no real push arrives; the screen shows "Registered devices" |
| Account | name, phone, sign-out, devices and sessions, delete account | sign-out ends the Passport session too: the next sign-in asks for the phone again |
| Dark / light | Account > Appearance | |
| AR / RTL | switch language in the header menu | |
| Offline | airplane mode while open | content errors show a retry state, not a blank screen |
| Deep links | `adb shell am start -a android.intent.action.VIEW -d "kiorex://visit-status/demo-token"` (Android), `xcrun simctl openurl booted kiorex://visit-status/demo-token` (Simulator) | opens the family visit-status screen. https universal links for `test.kiorex.com` are compiled in but unverified until the Apple Team ID and Android SHA-256 are published (founder step) |

## 5. What to test: Kiorly (staff)

Pick the product tile, sign in with Passport. Staff accounts are linked to a Passport identity by verified phone.

| Persona (phone, see `e2e/kx-test/README.md`) | Product | Notes |
|---|---|---|
| `+201000002008` Omar Cashier | Pharmacy | not a privileged role: Home, Work, Inbox, Rx queue, expiry, customers, Growth work. **Kiorex orders show "Your role does not include this"** (orders need a privileged role) |
| `+201000002005` Omar Technologist | Lab | orders, worklist, critical values, TAT, QC; Growth says the role lacks it |
| Pharmacy / Lab owner or pharmacist | Pharmacy, Lab | privileged roles get **403 MFA_REQUIRED** unless Passport gave an MFA claim: the app now shows "Two-step verification needed". Owners need an authenticator enrolled (see `e2e/kx-test/README.md` section on privileged roles; the TOTP secrets live only in AWS Secrets Manager `/kx/test/e2e`) |
| Clinic / Nurse | Clinic | Passport sign-in links by phone to a Clinic staff row; the demo organisation has none for the synthetic phones, so use the **Password** method for a Clinic account you own. The real organisation Dr Ahmed Shall is live on this host: do not create, edit or delete anything there; use a throwaway account only |

Also check: commission statement cards (Pharmacy and Lab Growth tab, cash vs cash-transfer split, "not connected" state), AR/RTL and dark mode, offline banner and the sync centre, lock screen (biometric), sign-out per product and "everything", barcode scan (camera permission).

## 6. Known limits (honest list)

* Push notifications: mock. Local simulation card in Me > Notifications (dev builds only); `e2e-push/send.sh` works on the iOS Simulator only.
* WhatsApp, SMS, e-mail, payments (Paymob, Fawry): mock. Payment screens run in mock mode.
* Booking and the patient pharmacy/lab ordering are gated by `market.eg.live` (human step).
* The release APKs still include the `expo-dev-client` plugin (the `exp+kiorly` scheme and the SYSTEM_ALERT_WINDOW permission are in the manifest). Fine for testing; remove from the production profile before a store build.
* Universal links / app links: configured per environment (`test.kiorex.com`, `app.test.kiorly.com`), not verifiable until the `/.well-known/` files carry the Apple Team ID and the signing SHA-256 (founder).
* Debug-key APK: for testing only. Production needs the Play app-signing key and the Firebase files.
* Passport code limits per IP (section 1).
* Staff Clinic sign-in by Passport needs a linked Clinic staff member.

## 7. Founder follow-ups

1. Apple Developer (individual to start) + Expo/EAS account (section 3).
2. Record the `market.eg.live` gate evidence in the Ops console when you want patient booking tests.
3. Publish the Apple Team ID and Android signing SHA-256 for app links (NEEDS_HUMAN D9).
4. Optional, for an iPhone-Safari/PWA run: ask for one extra redirect URI for `kiorex-mobile`/`kiorly` (the web origin); entry goes through `KX_CLIENT_OVERRIDES_JSON` (`client-overrides:emit`). Not applied.
5. Proposal for a friendlier tester sign-in: a hosted-test-only Passport "show my code" page, enabled only when `KIOREX_ENV=test` AND mock messaging, blocked by the same `kx-guard-otp.sh` rule in pilot and prod, limited to the synthetic demo numbers. It touches Passport app code (kiorex-account), so it was handed off rather than built.

## 8. Automated smoke (no phone needed)

`./e2e/kx-test-mobile/scripts/build-web.sh && npx playwright test -c e2e/kx-test-mobile` exports both apps as web builds with the kx-test profile and drives them against the live hosts with Passport tokens obtained exactly like the apps do (code + PKCE, custom-scheme redirect read from the 303). 15 tests (3 added 28 Nov: new-capability bundle check, Lab result-entry route with no write, Pharmacy cashier role states); reuses saved tokens (refresh) so it costs one code per persona per hour.

## 9. Staff app: the full private-stack run (28 Nov 2026)

Role by role coverage of the staff app is in `STAFF_APP_COVERAGE.md`. What was added: Lab result entry and second entry, Clinic Kiorex commission statement, Clinic no-show, deep link `kiorly://open/specimen:<id>`.

**Private stack (never the shared ports).** `bash e2e/scripts/clinic-clone.sh`, then in `.e2e/clinic-clone` `DATABASE_URL=<any private db url> npm run build -w api`, then `REG_STAFF_WEB_PORT=8867 REG_CORS_ORIGINS=http://localhost:8867,http://127.0.0.1:8867 bash e2e/scripts/stf-stack.sh up` (tag `stf`, Passport 4860, Clinic 4862, Kiorex 4863, Pharmacy 4864, Lab 4865; own databases `stf_*`; the Clinic is built from the throw-away clone and takes its dev placeholders from `.env.example`; `SKIP_BUILD=1` reuses `dist-stf`; `down` removes everything). Passport mock code is `000000`.

**Web (Playwright, `kiorly/e2e-web`).** A DEV Expo server from a COPY of the app without `.env.local` (a dev server reads it even with `EXPO_NO_DOTENV=1`): `EXPO_NO_DOTENV=1 EXPO_PUBLIC_CLINIC_API=http://localhost:4862/api/v1 EXPO_PUBLIC_PHARMACY_API=http://localhost:4864/api/v1 EXPO_PUBLIC_LAB_API=http://localhost:4865/api/v1 EXPO_PUBLIC_PASSPORT_ISSUER=http://localhost:4860 npx expo start --web --port 8867 -c` (port 8867 is the one the private Passport allows; use `-c` after copying new sources, Metro served a stale route chunk otherwise). Then `LAB_API=http://localhost:4865/api/v1 WEB_URL=http://localhost:8867 npx playwright test -c lab.config.ts`, `PHARMACY_API=http://localhost:4864/api/v1 ... -c pharmacy.config.ts`, `API_URL=http://localhost:4862/api/v1 DB_NAME=stf_kiorly PSQL=~/.local/bin/psql ... -c clinic.config.ts`, `... -c edge.config.ts` (401, 403, MFA_REQUIRED, 409, 5xx, slow, offline, 300 rows, long names, double tap) and `PASSPORT_URL=http://localhost:4860 REAL_CLINIC_PORT=4862 REAL_PHARMACY_PORT=4864 REAL_LAB_PORT=4865 ... -c real.config.ts`. Always set `DB_NAME` for the Clinic specs.

**Native on a private emulator.** Own AVD on its own port (`emulator -avd kx_mobile -port 5560 -no-window -read-only`), never the one other people use (5554). Build a profile `stf` (file `config/env/stf.env`, not committed: hosts `http://localhost:<private ports>`): `KX_CLEARTEXT=1 node scripts/build-native.mjs android stf` (the flag only patches the throw-away copy's manifest to allow http, refused for test, pilot and prod), `adb -s emulator-5560 reverse tcp:4860 tcp:4860` (and 4862, 4864, 4865), install, sign in with the Passport page (phone `+201000002005` is the Lab technologist, `+201000002004` the pharmacist, `+201000002001` the Clinic owner; code 000000; "Not now" on the passkey offer). Product choice matters: a phone that is not linked to the chosen product returns to the sign-in screen. `build-native.mjs ios-sim stf` for the Simulator (http to localhost is allowed by the Expo template).

**What the native smoke covered** (Android emulator, private stack): first launch Arabic and RTL, Passport sign-in in Chrome Custom Tab and return by `kiorly://auth/callback`, push explanation sheet ("Not now" path), home for the Lab technologist, dark mode, font scale 1.8, 540x960 at density 240, network cut (API port reverse removed): offline chip and cached home, a deep link to an unknown path opens Home (closed route table by design). iOS Simulator (own device iPhone 17e): launch, Arabic RTL sign-in, content size accessibility XXXL, system dark appearance (the app keeps its light default; Account > Appearance switches it). Not covered natively: iOS input (the simulator control was not granted), real push, universal links.

**Findings fixed.** Lab result entry could not open a specimen beyond the oldest 200 (Lab `GET /worklist?specimenId=`, needs the Lab deploy); the home plan pill ran off the screen at large fonts.

**Test counts (honest, this pass).** Jest 443 (was 382): role matrix 24, result-entry logic 10, result-entry screens 16, Clinic commission and no-show 9, plus changed suites. Playwright on the private stack: Lab 34 (22 existing, 12 new), Pharmacy 21, Clinic 20 (9 growth, 6 roles, 5 new), edge states 11, real Passport 3. Lab API e2e `mobile.e2e.test.ts` 11. kx-test-mobile: written, see the report for the run result.
