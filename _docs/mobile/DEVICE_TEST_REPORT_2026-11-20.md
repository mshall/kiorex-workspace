# Device test report: the two Expo apps on an Android emulator (20 Nov 2026)

> **Scope.** Kiorex patient app (`kiorex-platform/apps/mobile`) and the Kiorly staff app (`kiorly-work`, still titled "Kiorly Work"; it is reworked into the single **Kiorly** app only after the founder approves [the mobile design pack](README.md)).
> **Result.** Both run on Android in light/dark and Arabic/English against live local APIs. Three real bugs found and fixed. **iOS (iPhone 18 Pro simulator, iOS 27.2, Expo Go) was run for the patient app on 21 Nov 2026**: light/dark x ar/en all render with live data and no app errors in the device log (only Expo Go's own StoreKit/Firebase noise); the first-run Arabic LTR mismatch (finding 1) reproduces on iOS too. The **staff app was also run on iOS**, signed in as the demo clinic owner (home KPIs, schedule, account; light/dark x ar/en): no layout bugs; KPI tiles and the "waiting" status pill render fully, so open finding 5 is **Android-only**. iOS reproduces findings 1 and 3 (first-run Arabic LTR, notification prompt straight after sign-in) and showed a red LogBox for the i18next plural warning (finding 2), fixed in the staff app by choosing `compatibilityJSON` explicitly when `Intl.PluralRules` is missing (patient app uses i18next 27, which has no such fallback and shows no warning).

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

1. **FIXED in code (21 Nov 2026), automatic reload still to verify on a development build.** **First-run direction mismatch (Expo Go).** The app defaults to Arabic, `I18nManager.forceRTL(true)` only takes effect after a JS reload, and `bootstrapI18n()` returns `needsRestart` that nothing acts on in production. On a fresh install Arabic text is briefly shown in an LTR layout until the next launch. Trying `expo-updates` `reloadAsync()` crashed Expo Go on startup (`EventEmitter of undefined`), so it was reverted. **Needs a development build** (EAS or `expo run:android`) to verify a proper fix.
2. **i18next plural warning.** `Your environment seems not to be Intl API compatible` is logged at startup on Hermes in Expo Go; adding `intl-pluralrules` did not change it, so it was removed. Plurals fall back to the v3 format and render correctly. Re-check in a development build.
3. **FIXED (21 Nov 2026): in-app explainer once, 14-day "Not now", Me > Notifications switch.** **Notification permission** was requested immediately after sign-in in the staff app, before any context; Android re-prompts on each launch after "Don't allow". Move the prompt behind an explanatory screen.
4. **Staff app is still titled "Kiorly Work"** (login hero, header). Intentional until the design pack is approved.
6. Only guest screens were exercised in the patient app (sign-in goes through Passport in a browser); signed-in patient flows are covered by the headless Playwright run in `UPGRADE_2026-11_REPORT.md`.

## Specialty list (21 Nov 2026, founder request)

Home showed only 11 specialties. `GET /specialties` now returns 36 (adds allergy, anaesthesia, audiology, cardiothoracic, endocrinology, emergency, family medicine, gastroenterology, general surgery, geriatrics, haematology, infectious diseases, nephrology, neurology, neurosurgery, nutrition, oncology, pain, physiotherapy, plastic surgery, pulmonology, radiology, rheumatology, sports medicine, vascular surgery), sorted A-Z by English name; mobile and web re-sort by the active language. The first six codes keep their order (WhatsApp quick list). Verified on the iOS simulator.

## Not done

* iOS: Pharmacy/Lab modules of the staff app, physical device.
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

## Update 21 Nov 2026 (staff app fixes)

* Finding 1: `handleRestart` added; reload uses `reloadAppAsync` from `expo` (no `expo-updates`, which crashed Expo Go). Expo Go shows a one-time banner (verified after `pm clear` on the Android emulator and after clearing Expo Go data on the iPhone 18 Pro simulator; no startup crash on either). In Expo Go on Android `forceRTL` does not persist across launches (`needsRestart` is true on every launch, banner only once); the reload path cannot be verified without a **development build**.
* Finding 3: in Expo Go on Android `getPermissionsAsync` reports "denied" before the first ask, so "denied with canAskAgain" is treated as "not asked yet".
* Finding 5: before/after screenshots in `/private/tmp/claude-501/pill-shots/pill-before-ar-dark.png` and `pill-after-ar-dark.png`.
* Android test used a local mock of the clinic API (the real stack was not running on :3010 in this session).

## Update 22 Nov 2026 (Android pass: Arabic labels, light mode, keyboard)

Android 15 emulator, Expo Go, production-mode Metro; screenshots in `/private/tmp/claude-501/android-pass/`.

**Checked, no clipping or truncation.** Arabic (light and dark) and English (light and dark) on the staff app, signed in as the Basic clinic owner (`owner.basic@`), the Pro clinic owner (`owner.na@`), a nurse (`nurse1@nurse-demo`), the pharmacist and the lab signatory: status pills ("في الانتظار", "مؤكدة", "تم الإقرار", "مرتفع", "حرج"), chips and role badges on the Lite upgrade screen, KPI tiles, Home open-requests notice, locked-tile cards and tool sheet, upgrade note field with counter, push primer sheet, direction banner, tab labels. The finding-5 fix (single-line Badge/Chip/Button) holds on every pill seen. Light-mode pass of the new screens: Lite UI, nursing round note, pharmacy Rx queue/detail (`rx.validate` button), lab critical-value read-back note: all render correctly. Finding 5 and finding 7 are removed from the open list above.

**Bug found and fixed (staff app): fields hidden under the keyboard on Android 15.** The Lite upgrade note field (`upgrade-note`) disappeared behind the keyboard: `Screen` and `Sheet` had no keyboard handling beyond the sign-in screen. Fix: ported the patient app's `KeyboardForm.tsx` parts (`KeyboardAvoider`, scroll-into-view, `useKeyboardVisible`) to `src/components/KeyboardForm.tsx` and used them in `Screen`, `Sheet` and `Field` (`src/components/ui.tsx`); test `src/__tests__/keyboard-form.test.tsx`. Verified on device: upgrade note, nursing round note, lab read-back note sheet stay visible above the keyboard (`upgrade-note-kb-fixed-ar-dark.png`, `round-note-kb-ar-light.png`, `lab-readback-kb-ar-light.png`).

**Patient keyboard fix verified (Android 15 edge-to-edge, mock mode).** Home specialty filter and the address-book "add address" sheet (landmark field, the last one) scroll above the keyboard (`pat-home-kb.png`, `pat-sheet-kb-ar-light.png`). No patient code change needed. Checkout/review screens were not opened on device (they need a signed-in Passport session; they use the same `Screen`/`KeyboardForm`).

**Still observed, not fixed.**
* Expo Go on Android does not persist `forceRTL`: after the first run, relaunches show Arabic text in an LTR layout (tab order flips). Needs a development build (finding 1).
* Pharmacy Rx detail shows the raw status "RECEIVED" in the badge and lab critical alert countdown "8738h 22m" is Latin-digit English text in an Arabic UI (cosmetic).
* The round "Arrive" button needs a location fix; the emulator never returns one in Expo Go (arrival was posted through the API instead). Demo visit `demo_hv_cp1_7` (Nabila, nurse1) is now ARRIVED: re-run `scripts/seed-all.sh --reset` to restore.

## Update 22 Nov 2026 (development build, push, cosmetics)

**Dev build.** `expo-dev-client` added; `expo run:ios` builds locally with Xcode 27.2 (CocoaPods installed user-level into `~/.local/gems`, Ruby 2.6 needed pinned gems; `react-native-reanimated`/`worklets` pinned to the SDK 58 versions 4.7.1 / 0.13.0, because 4.8 wants worklets 0.14 and broke `pod install`). `ios/` and `android/` are generated and git-ignored. Screenshots: `/private/tmp/claude-501/devbuild/`.

**Finding 1 (first-run Arabic direction): verified on the real iOS dev build.** Fresh install (uninstall, install, open dev-client URL): the app comes up in an RTL Arabic layout after one automatic `reloadAppAsync` with **no banner** (`02-fresh-install-rtl-applied.png`; Metro log shows a second 1-module bundle load = the reload). Terminate and relaunch keeps RTL (`03-relaunch-persist.png`). Fix made: `applyDirection()` also called `DevSettings.reload()` in dev, racing the guarded reload; it was removed so `handleRestart()` is the only reload path (it still falls back to `DevSettings.reload` in `__DEV__`). Not verified: a Release/production iOS build, and the language switch in Me (code path unchanged). `restart.ts` and `DirectionBanner` needed no other change.

**Push (iOS simulator, dev build).** Permission prompt via Me > Notifications, mock token registered and uploaded (dev card shows `mock no-project-id` and the explanation; no crash). `xcrun simctl push` fixtures in `kiorly-work/e2e-push/`: foreground banner shown, tap deep-links verified for upgrade request (`/upgrade`), SOS (`/clinic/round/demo_hv_cp1_7`), critical lab alert (`/lab/critical`), `order.received` (`/pharmacy/orders`, also from a killed app: cold-start tap, `08-cold-tap.png`). The local "Send test notification" button schedules a notification that returns through the same listener and router (verified with `order.received`). Bug found by the real payload test: remote data must be under the `body` key (expo-notifications reads `userInfo.body`); the first fixtures with root-level keys produced empty `data`. Not verified: real APNs/FCM delivery (needs credentials and an EAS projectId), badge number on the home-screen icon (code sets it; not inspected), background-state tap (only foreground and cold-start taps were exercised).

**Cosmetics.** Raw enums (`RECEIVED` etc.) in pharmacy Rx, receiving, lots, orders; lab specimens, orders, stops, priorities; clinic appointment/order/custody statuses now go through `statusLabel()` with AR+EN labels (`api.status.*`, `api.priority.*`) and a humanised fallback. Durations use `formatDuration()`: Arabic-Indic digits and Arabic unit letters in Arabic, days from 24 h, capped at `999d+` (the `8738h 22m` countdown becomes `364d` / `٣٦٤ي`). Numbers interpolated into Arabic strings, stat tiles, segmented counts and the alert counts now use Arabic-Indic digits; identifiers (order, accession, lot, MRN) stay Latin by design. Tests: `format-status.test.ts`, `notifications.test.ts`.
