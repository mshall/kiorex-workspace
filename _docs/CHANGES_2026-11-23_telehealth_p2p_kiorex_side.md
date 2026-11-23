# Change note, 23 Nov 2026: telehealth is Clinic-owned peer-to-peer (Kiorex side)

Founder decision: video-call cost must be the minimum. Our own peer-to-peer WebRTC, no media through our servers, **no paid video vendor**. Plan: `_docs/telehealth/TELEHEALTH_PLAN.md` (the Clinic side is built separately in `clinics-management`, branch `feature/telehealth`).

## Removed (kiorex-platform)
- The Daily.co adapter: `apps/api/src/common/providers/vendors/video-daily.ts`, `DailyVideoAdapter` / `UnconfiguredVideoAdapter` in `telemedicine/video.ts`, the Daily unit test, and the env keys `VIDEO_API_KEY`, `VIDEO_DOMAIN`, `VIDEO_PROVIDER`, `VIDEO_API_URL`. `VIDEO_MODE=real` is now rejected at startup.
- Docs: the VIDEO row in `Docs/PROVIDERS.md`, NEEDS_HUMAN rows 6 / 24 / video line (`Docs/NEEDS_HUMAN.md`), `Docs/VERTICALS.md`, `Docs/ARCHITECTURE.md`, `README.md`, TEST_GUIDE and the HTML test guide wording.
- No other repo referenced Daily or a video vendor (checked kiorex-contracts, kiorex-account, pharmacy, lab, e2e). The Clinic repo is untouched by this change.

## Changed
- `VIDEO_MODE=mock` (default, dev/e2e) or `clinic-p2p` (the Clinic owns the call). In `clinic-p2p` the Kiorex-owned session endpoints (create/join/end and the clinician token endpoints) answer `409 CLINIC_OWNS_CALL`; the mock path is unchanged.
- `BookingIntent.telehealth` (JSON, migration `20261123170000_telehealth_clinic_p2p`): `{sessionId, joinUrl, opensAt, closesAt, state, movedFrom}`, filled from `data.telehealth` on the Clinic confirmation / reschedule events and `GET /bookings/:ref`. `telehealth: null` or `serviceLocation: IN_CLINIC` means changed to in-person.
- Clinic `telehealth.session.created|link_regenerated|rescheduled|started|ended|missed|cancelled|converted` update the state forward only; any other `telehealth.*` type and unknown bookings are acknowledged and ignored. The join URL is a bearer token: redacted from the webhook receipt store, never logged, withheld from the API once the visit can no longer be joined.
- API: `BookingDto.telehealth` and `GET /telemedicine/visits`. The contract schemas are not published yet; the code follows the plan and tolerates missing/extra fields (re-check when `clinics-management/Docs/contracts/telehealth-contract-change.md` lands).
- Web: `TelehealthVisit` card on the appointment page and the telemedicine page ("Join video visit" opens the Clinic `/v/<token>` page in a new tab; countdown, join window, moved / cancelled / ended / missed / in-person states).
- Mobile (Expo): same card; **Join video visit** opens the Clinic page in an in-app `react-native-webview` (same origin only). Camera/microphone: iOS `NSCameraUsageDescription` / `NSMicrophoneUsageDescription` (EN + AR) and WebView `allowsInlineMediaPlayback`; Android `CAMERA` / `RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS`, requested up front and mapped by the WebView's `onPermissionRequest`. Needs a new native build (new native module `react-native-webview@14.0.1`).
- The launch-locked flag `kiorex.telemedicine` and its dev gate are unchanged (existing visits stay joinable when the flag is OFF).

## Cost model
Only TURN relay traffic costs money (calls that cannot connect directly). Cloudflare Realtime TURN includes the first 1000 GB per month free; STUN is free. The Cloudflare TURN key is issued by the Clinic backend and is the only video item in the go-live checklist, owned by the Clinic. Kiorex holds no video key.

## Tests
API unit + integration (`test/telehealth.int.spec.ts`, updated `telemedicine.int.spec.ts`, vendors unit), web vitest (`telehealth.test.tsx`), mobile jest (`telehealth.test.tsx`: phases, same-origin guard, WebView props, native permission config). Known unrelated failure on main: `openapi-contract.int.spec.ts` (missing 2xx schemas under ts-jest).
