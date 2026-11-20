# Device test report: the two Expo apps on an Android emulator (20 Nov 2026)

> **Scope.** Kiorex patient app (`kiorex-platform/apps/mobile`) and the Kiorly staff app (`kiorly-work`, still titled "Kiorly Work"; it is reworked into the single **Kiorly** app only after the founder approves [the mobile design pack](README.md)).
> **Result.** Both run on Android in light/dark and Arabic/English against live local APIs. Three real bugs found and fixed. **iOS (iPhone 18 Pro simulator, iOS 27.2, Expo Go) was run for the patient app on 21 Nov 2026**: light/dark x ar/en all render with live data and no app errors in the device log (only Expo Go's own StoreKit/Firebase noise); the first-run Arabic LTR mismatch (finding 1) reproduces on iOS too. The staff app on iOS is still to do.

## How it was run

| Item | Value |
|---|---|
| Device | Android 15 (API 35, Google APIs, arm64) emulator "Pixel 2", software GPU |
| Host tooling | JDK 17 + Android cmdline-tools + emulator in `~/.local/` (nothing installed system-wide) |
| App runner | **Expo Go** (SDK 58) against Metro in *production mode* (`expo start --localhost --no-dev --minify`) |
| Networking | `EXPO_PUBLIC_*_API=http://10.0.2.2:<port>/api/v1` (emulator → host) and `adb reverse` for Metro |
| Data | Kiorex API :4000, Passport :4400, Kiorly Clinic API :3010 (seeded demo org, test credentials from `TEST_DATA.md`) |
| Colour scheme | `adb shell cmd uimode night yes|no` |
| Language | in-app switch (Arabic default, English) |

Screens captured per app in all four combinations (light/dark x ar/en): sign-in, home, appointments/records/account (patient), home/work/inbox/me (staff), search results, schedule.

### Why production mode, not dev mode
Dev-mode bundles never finished loading in Expo Go on this emulator (stuck at "downloading"), and `Updates`-style reloads are unavailable in Expo Go. Production mode logs only `console.warn/error`, so errors were found by reading screens plus `adb logcat`.

## Bugs found and fixed

| # | App | Symptom on device | Root cause | Fix |
|---|---|---|---|---|
| 1 | Patient (also web, ops) | Home showed **no specialties or care types**; every API call silently failed | `openapi-fetch` 0.17 throws `onResponse: must return new Response() when modifying the response` when middleware returns RN's own `Response` class | Middleware returns nothing (`apps/{mobile,web,ops}/src/api/client.ts`); regression test `api-client.test.ts` fails on the old code |
| 2 | Staff + patient | Home KPI tiles collapsed to ~25% width, labels truncated ("زيارات…") | Pressable `Card` applied `flex`/`minWidth`/`alignSelf` to the inner `Pressable`, not to its outer animated wrapper | `splitLayoutStyle()` in `src/components/ui.tsx` (both apps); tests `card-layout.test.ts` |
| 3 | Staff | Sign-in fields hidden under the keyboard | Android 15 is edge-to-edge (no window resize) and `KeyboardAvoidingView` had `behavior` unset on Android | `behavior="padding"` on both platforms (`app/sign-in.tsx`) |

Unit tests after the fixes: patient app 119 passed, staff app 76 passed, `tsc` clean in both.

## Open findings (not fixed)

1. **First-run direction mismatch (Expo Go).** The app defaults to Arabic, `I18nManager.forceRTL(true)` only takes effect after a JS reload, and `bootstrapI18n()` returns `needsRestart` that nothing acts on in production. On a fresh install Arabic text is briefly shown in an LTR layout until the next launch. Trying `expo-updates` `reloadAsync()` crashed Expo Go on startup (`EventEmitter of undefined`), so it was reverted. **Needs a development build** (EAS or `expo run:android`) to verify a proper fix.
2. **i18next plural warning.** `Your environment seems not to be Intl API compatible` is logged at startup on Hermes in Expo Go; adding `intl-pluralrules` did not change it, so it was removed. Plurals fall back to the v3 format and render correctly. Re-check in a development build.
3. **Notification permission** is requested immediately after sign-in in the staff app, before any context; Android re-prompts on each launch after "Don't allow". Move the prompt behind an explanatory screen.
4. **Staff app is still titled "Kiorly Work"** (login hero, header). Intentional until the design pack is approved.
5. **Clipped status pill (staff app, Arabic).** On the schedule screen the "waiting" pill shows "في" instead of "في الانتظار" while "في الكشف" renders fully. `flexShrink: 0` on `Badge` did not change it (reverted), so the cause is elsewhere (label text or Android RTL text measurement). Needs a closer look with a development build.
6. Only guest screens were exercised in the patient app (sign-in goes through Passport in a browser); signed-in patient flows are covered by the headless Playwright run in `UPGRADE_2026-11_REPORT.md`.
7. Patient forms (checkout, review, address) have no `KeyboardAvoidingView`; likely affected by the same Android 15 behaviour as #3. Verify on device.

## Specialty list (21 Nov 2026, founder request)

Home showed only 11 specialties. `GET /specialties` now returns 36 (adds allergy, anaesthesia, audiology, cardiothoracic, endocrinology, emergency, family medicine, gastroenterology, general surgery, geriatrics, haematology, infectious diseases, nephrology, neurology, neurosurgery, nutrition, oncology, pain, physiotherapy, plastic surgery, pulmonology, radiology, rheumatology, sports medicine, vascular surgery), sorted A-Z by English name; mobile and web re-sort by the active language. The first six codes keep their order (WhatsApp quick list). Verified on the iOS simulator.

## Not done

* **iOS Simulator, staff app** (`kiorly-work`): patient app done, staff app pending.
* A physical device.
* Push notifications (unavailable in Expo Go on Android since SDK 53; needs a development build).
* Pharmacy and Lab modules of the staff app (need `3100`/`3200` APIs signed in with the right role).

## Reproduce

```bash
export JAVA_HOME=~/.local/jdk17/jdk-17.0.21.1+2/Contents/Home ANDROID_HOME=~/.local/android/sdk
export PATH=$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH
emulator -avd kx_pixel -no-window -gpu swiftshader_indirect &      # or drop -no-window to watch it
adb reverse tcp:8082 tcp:8082                                      # Metro for the patient app
cd kiorex-platform/apps/mobile
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000/api/v1 EXPO_PUBLIC_OIDC_ISSUER=http://10.0.2.2:4400 \
  npx expo start --localhost --port 8082 --no-dev --minify --clear
adb shell am start -a android.intent.action.VIEW -d exp://localhost:8082
```
