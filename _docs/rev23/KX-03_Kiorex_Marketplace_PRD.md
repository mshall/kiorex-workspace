# KX03 — Kiorex Marketplace PRD
Source: 1jyq4wTn3bBW4xEahE3-crbpZwrJB18o7
Revision: Rev 2.7 · Reference Edition, updated 25 November 2026 (Rev 2.7: Phases 2 to 4 as-built notes refreshed, see the last sections; previous: Rev 2.3, 23 November 2026; this update adds the Rev 2.4 as-built section at the end, status-labelled)

> Cleaned from Drive text extraction; symbols restored where obvious; headers/footers removed. Owner: Chief Product Officer. Audience: Founders, investors, engineering & operations leads. Tags: Egypt MVP · Requirement IDs · Booking state machine · Kiorly contract consumer · Home visits · Phase-2 verticals. (Cover requirement-count figure not recoverable from this extraction; Rev 2.2 printed "120".)

Subtitle: The patient-facing marketplace — discovery, booking against Kiorly's live schedules in the clinic or at home, Kiorex Pay, verified reviews, family accounts and, in phase 2, physiotherapy, home nursing, pharmacy orders and lab tests.

## WHAT CHANGED IN REV 2.3
Positioning widened from doctors to verified care in clinic or at home; care types Doctors · Physiotherapy · Home nursing. New requirement group KXMHV (address book, home slots, assignment, visit tracking, family sharing, safety). Booking state machine adds home-visit sub-states; phase-2 table adds home care; new flags kiorex.home_visits, kiorex.category.*.

## 01 Product vision and positioning
Kiorex is where patients in MENA find verified care they can actually get — at the clinic or at home — and where providers get patients they only pay for when they show up.
> "Book verified care in under two minutes, in Arabic — at the clinic or at home — and know exactly what you'll pay."
Pillars:
- **Verified, not just listed (trust)**: Every LIVE provider passed syndicate-number and licence verification for their profession in Kiorly (ON03, PRVER). Unverified profiles are never bookable.
- **Real slots, certainty**: Slots come from Kiorly's canonical slot engine (KX03) with holds and idempotent bookings — no double booking, no 'we'll call you'. Home slots already include travel time.
- **Reviews you can believe (honesty)**: Only patients with a completed Kiorex-channel visit can review (KX08). No anonymous ratings.
- **Fair to providers (economics)**: Providers pay only for attended new patients, and never more than their Kiorly subscription in a month. Care-plan follow-ups are never charged.

**NOTE** Build starting point (KX22): the patient web starts from the harvested kiorex-web-app screens (marketplace, doctor search, provider profile, booking, patient portal) — same React/Vite/shadcn stack as Kiorly — rewired to real APIs. The backend is new in kiorex-platform; no code is reused from the 2025 kiorex-backend (its nurse-service is vocabulary only). The iOS/Android app is a new Expo project.

## 02 Personas and jobs to be done
| Persona | Job to be done | Pain today | Success measure |
|---|---|---|---|
| Amira, 34, Cairo, mother of two | Book a paediatrician near home tonight for tomorrow | Phone lines busy; WhatsApp replies late; fee unknown | Search → confirmed in ≤ 2 min |
| Hassan, 61, chronic patient | Follow-up with his cardiologist and refill medicines | Repeats history at every visit; loses paper Rx | Records shared to app; refill reminder |
| Nour, 26, first job, Giza | Find a dermatologist with good reviews within budget | Fake reviews, unclear prices | Transparent fee + verified reviews |
| Karim, 45, after knee surgery (NEW) | Physiotherapy at home for six weeks | Unverified therapists found through friends | Verified physio, sessions scheduled, progress visible |
| Caregiver for elderly parent | Manage parent's bookings, results and home nursing | No shared access; no idea if the nurse came | Family profiles with guardian rights; live visit status |
| Clinic receptionist (supply side) | Receive Kiorex bookings without double entry | Separate tablets for each platform | Bookings land in Kiorly schedule automatically |

## 03 MVP scope (Egypt, months 1–6)
Doctor discovery and in-clinic booking powered by Kiorly. Everything else waits until liquidity is proven.
**MVP — must have**: Kiorex Account sign-up/login (phone OTP, profile, family members) · Search by specialty, area, fee, language, gender, availability · Doctor/clinic profile from Kiorly provider sync · Live slots, 5-min holds, idempotent booking · Confirmation, reminders (WhatsApp + push), cancel/reschedule within policy · Kiorex Pay deposit for high-risk bookings · Verified reviews after completion · Arabic-first UI, RTL, accessibility · Support: WhatsApp + in-app ticket · Ops console: providers, bookings, disputes, payouts.
**Deferred (with trigger)**:
- Physiotherapy category — after gate GPR1 (M7–9)
- Home visits (doctors, physio) — after GHV1 + GHV2 and ≥50 home-enabled providers per cluster (M10–12)
- Home nursing (agencies) — after Kiorly Nurse pilot (M16–18); individual nurses after GKN2
- Telemedicine — after clinical governance sign-off (Q6)
- Pharmacy ordering — after Kiorly Pharmacy GA (M16)
- Lab tests & home collection — after Kiorly Lab GA (M21)
- Sponsored listings — after ≥12 attended patients/provider/month in cluster
- Insurance comparison — after payer partnerships
- AI symptom navigation — after clinical evaluation (KX11)
- Health vault uploads by patient — phase 1b with KX11 record share
(Extraction: "M79" = M7–9, "M1012" = M10–12, "M16 18" = M16–18; en-dashes inferred. Condition "50" before home-enabled providers read as ≥50.)

## 04 Functional requirements
IDs are stable. Priority: M = MVP, P2 = phase 2, P3 = later.
### Account & family (KXMAC)
| ID | Requirement | Pri |
|---|---|---|
| KXMAC01 | Sign up and log in with phone OTP via Kiorex Account OIDC + PKCE; optional email and passkey. | M |
| KXMAC02 | Profile: name AR/EN, date of birth, gender, national ID (optional, encrypted), preferred language. | M |
| KXMAC03 | Add family members (dependants) with guardian relationship; book on their behalf. | M |
| KXMAC04 | Consent centre: marketplace processing, reminders, record sharing, visit-status sharing — view and withdraw. | M |
| KXMAC05 | Device/session list with remote sign-out. | M |
| KXMAC06 | Account deletion in-app with data-export option (store requirement). | M |
| KXMAC07 | Link Kiorly patient record to Kiorex Account on first booking by phone/national-ID match; never auto-merge conflicts. | M |
### Discovery (KXMDS)
| ID | Requirement | Pri |
|---|---|---|
| KXMDS01 | Search by care type (Doctors · Physiotherapy · Home nursing, from provider profession), then specialty, symptom keyword (mapped to specialty), provider name, clinic or agency name. | M (doctors); P2 (others) |
| KXMDS02 | Filters: area/governorate, distance, fee range, next available, gender, language, rating, accepts deposit; P2 adds "Home visit", visit location, nursing service type. | M |
| KXMDS03 | Sort: earliest slot (default), distance, rating, fee. Sponsored results labelled (P3). | M |
| KXMDS04 | Results show next 3 available slots inline; tap to hold. | M |
| KXMDS05 | Map view of clinics with availability pins; home providers shown by coverage area, never by home address. | P2 |
| KXMDS06 | Emergency keyword detection routes to emergency guidance (123 ambulance) — no booking, including home-nursing search. | M |
| KXMDS07 | Search index refresh from Kiorly GET /marketplace/v1/providers?updatedSince every 5 min + PROVIDER_PROFILE_UPDATED events. | M |
| KXMDS08 | Report profile analytics daily to Kiorly (POST /marketplace/v1/analytics/profile-views). | M |
### Profiles (KXMPR)
| ID | Requirement | Pri |
|---|---|---|
| KXMPR01 | Provider profile: photo, profession, titles, specialty, sub-specialties, languages, fee per visit type (incl. home surcharge), clinic(s), "Visits at home in: …", verification badge naming the profession. | M |
| KXMPR02 | Clinic / agency profile: address (clinics only), map, phone, hours, photos, accepted payment methods. | M |
| KXMPR03 | Ratings: average and count from verified reviews; latest 20 visible reviews with provider replies. | M |
| KXMPR04 | Cancellation policy displayed before booking (from Kiorly settings). | M |
| KXMPR05 | Share profile link; deep link into app. | M |
### Booking (KXMBK)
| ID | Requirement | Pri |
|---|---|---|
| KXMBK01 | Slot list for a provider, visit type and date range from Kiorly slot engine (min notice, horizon, daily cap respected). | M |
| KXMBK02 | Create a 5-minute hold (POST /marketplace/v1/holds, externalRef unique) when the patient picks a slot. | M |
| KXMBK03 | Confirm booking with Idempotency-Key = Kiorex booking ID; persist Kiorly appointment ID. | M |
| KXMBK04 | On 409 SLOT_TAKEN show the 3 alternative slots returned by Kiorly. | M |
| KXMBK05 | On timeout, query GET /marketplace/v1/bookings/:externalRef before any retry; never create a second key. | M |
| KXMBK06 | Pending state when the provider requires manual confirmation; show due time; handle MARKETPLACE_BOOKING_CONFIRM_TIMEOUT. | M |
| KXMBK07 | Patient cancel/reschedule via Kiorly endpoints; surface CANCELLATION_WINDOW_CLOSED etc. clearly. | M |
| KXMBK08 | Show provider-initiated cancellations with reason and automatic deposit refund. | M |
| KXMBK09 | Add to calendar; directions (clinic visits); call provider. | M |
| KXMBK10 | Clinic booking link widget (channel=CLINIC_LINK) embedded on kiorly.link/<slug> — commission-free. | M |
| KXMBK11 | WhatsApp booking channel (KIOREX_WHATSAPP) using the same holds/bookings API. | P2 |
| KXMBK12 | Waitlist: patient joins; Kiorly waitlist auto-fill offers slot (FS03). | P2 |
### Home visits (KXMHV) — v2.3
| ID | Requirement | Pri |
|---|---|---|
| KXMHV01 | Address book in the Kiorex patient profile: label, governorate, district, street, building, floor, flat, landmark, map pin; one address confirmed with the OTP-verified phone before the first home booking. | P2 |
| KXMHV02 | Home slot search sends serviceLocation=HOME + district (+ coordinates when given); only in-zone providers return; 422 OUT_OF_COVERAGE explained. | P2 |
| KXMHV03 | Hold carries the address; address sent to Kiorly on booking; Kiorex stores addresses under the patient, never on the provider projection. | P2 |
| KXMHV04 | Fee shown as visit fee incl. home surcharge (BR56); deposit required by default (BR54). | P2 |
| KXMHV05 | Agency bookings: patient books a service from an agency; assigned nurse's name, photo and badge appear once assigned (HOME_VISIT_ASSIGNED). | P2 |
| KXMHV06 | Visit status timeline: Confirmed → On the way → Arrived → Finished, driven by Kiorly events; ETA only if the provider shares location. | P2 |
| KXMHV07 | Share visit status with up to 3 family contacts by WhatsApp link (BR59). | P2 |
| KXMHV08 | Care plans booked from Kiorex appear as one booking with a schedule; each visit has its own status; reviews after the first completed visit and at plan end. | P3 |
| KXMHV09 | Patient safety: provider photo + name + badge before arrival; "Report a problem" during and after a visit routes to ops with a 1 h SLA. | P2 |
| KXMHV10 | Address hidden from the provider 24 h after the visit (mirrors Kiorly HV-PRV-01). | P2 |
### Kiorex Pay (KXMPAY)
| ID | Requirement | Pri |
|---|---|---|
| KXMPAY01 | Collect deposit by card / wallet / Fawry reference when visit type requires it; notify Kiorly (deposit-paid). | M |
| KXMPAY02 | Refund automatically when depositRefundable=true on cancellation events. | M |
| KXMPAY03 | Pay deposit links sent by providers (FS04) via hosted checkout (KIOREX_PAY_LINK_BASE_URL). | M |
| KXMPAY04 | Weekly provider payouts; call POST /marketplace/v1/payouts idempotently; reconcile. | M |
| KXMPAY05 | Ledger: gross, PSP fee, refunds, payouts, held balance per provider; daily PSP reconciliation. | M |
| KXMPAY06 | Full prepayment of visit fee (optional per provider). | P2 |
| KXMPAY07 | Unsafe-aborted home visit: deposit held for ops review, never auto-forfeited. | P2 |
| KXMPAY08 | (Proposed, ADR-048, not built) Refund destination chosen by the patient at refund time: "refund to original payment method" preselected by default, or "keep as credit" as an option, never forced; irreversible once executed; only when the credit flags are on. | P2 |
| KXMPAY09 | (Proposed, not built) Checkout shows every line in the order sponsored discount (if any), credit, deposit held, card; credit applies to a deposit or prepayment. | P2 |
### Notifications (KXMNT)
| ID | Requirement | Pri |
|---|---|---|
| KXMNT01 | Booking confirmed, reminder T-24h and T-2h, changed, cancelled — WhatsApp template + push + in-app; home visits add "on the way". | M |
| KXMNT02 | Respect consent and quiet hours; opt-out per channel. | M |
| KXMNT03 | Review invitation on REVIEW_INVITATION_ELIGIBLE, T+2h after completion. | M |
### Reviews (KXMRV)
| ID | Requirement | Pri |
|---|---|---|
| KXMRV01 | Rating 1–5 + text; one review per completed appointment; editable for 7 days. | M |
| KXMRV02 | Moderation: PHI/abuse detection; HIDDEN status synced to Kiorly. | M |
| KXMRV03 | Sync aggregates and reviews to Kiorly (POST /marketplace/v1/reviews/aggregate); display provider replies. | M |
### Records & continuity (KXMRC)
| ID | Requirement | Pri |
|---|---|---|
| KXMRC01 | Receive consent-based record shares from Kiorly (KX11): visit summary, Rx, orders, nursing discharge notes. | P2 |
| KXMRC02 | Prescription view with verification QR (CL03). | P2 |
| KXMRC03 | Follow-up reminders from provider-specified intervals. | P2 |
### Operations console (KXMOP)
| ID | Requirement | Pri |
|---|---|---|
| KXMOP01 | Provider directory with listing status and profession mirrored from Kiorly; search and filters. | M |
| KXMOP02 | Booking timeline per booking: intents, holds, Kiorly responses, events, payments. | M |
| KXMOP03 | Outbox delivery monitor: lag, dead letters, replay. | M |
| KXMOP04 | Refunds, payouts, PSP reconciliation dashboard. | M |
| KXMOP05 | Review moderation queue; patient complaints with SLA (home visits 1 h). | M |
| KXMOP06 | Cluster liquidity dashboard by care type and location: listed providers, home-enabled providers per district, slots/day, search→book, attended, no-show, safety alerts. | M |
| KXMOP07 | Super admin Feature flags page: every flag of every product with effective value per scope, source of value, class, dependencies and last change. | M |
| KXMOP08 | Toggle any flag OFF/ON at global, market or organization scope; reason and ticket required; optional expiry and schedule. | M |
| KXMOP09 | Launch-locked flags: record gate evidence (gate ID, approver, date, document link) — the flag becomes effective only then. | M |
| KXMOP10 | Two-person approval for global/market OFF of money-path flags; single-admin emergency kill with 24 h review. | M |
| KXMOP11 | Flag audit trail and export; propagation status per product (snapshot version and age). | M |
| KXMOP12 | Home-visit safety console: live safety alerts for Kiorex bookings, unsafe aborts, escalation log. | P2 |

## 05 Booking state machine
Kiorex keeps its own view of a booking; Kiorly's appointment status is authoritative and drives transitions through outbox events. Home visits add sub-states that never affect commission.
States: INTENT → (slot picked) HELD [5-min hold] → PENDING_CLINIC [manual confirm] / CONFIRMED [Kiorly ID stored · on the way] → CHECKED_IN [charge PENDING · arrived] → COMPLETED [review invite]. Terminal alternatives: EXPIRED (hold lapsed), CANCELLED (by patient / provider / system / unsafe abort), NO_SHOW (deposit forfeited).
| Kiorly event | Kiorex transition | Side effects in Kiorex |
|---|---|---|
| APPOINTMENT_CONFIRMED | → CONFIRMED | Notify patient; schedule reminders |
| RESCHEDULED | CONFIRMED → CONFIRMED (new time) | Update calendar; reminders |
| CANCELLED_BY_CLINIC | → CANCELLED | Refund deposit; apology + 3 alternatives |
| CANCELLED_BY_PATIENT | → CANCELLED | Refund if depositRefundable |
| CHECKED_IN / CHECK_IN_REVERTED | → CHECKED_IN / back | Attribution metrics (home: arrival geostamp) |
| COMPLETED | → COMPLETED | Review invitation; follow-up; home address hidden after 24 h |
| NO_SHOW | → NO_SHOW | Deposit forfeited; no-show score |
| HOME_VISIT_ASSIGNED | CONFIRMED (assignee set) | Show provider card |
| HOME_VISIT_EN_ROUTE | CONFIRMED (on the way) | Notify patient and shared family contacts |
| HOME_VISIT_ABORTED_UNSAFE | → CANCELLED (unsafe) | Deposit held for ops review; never a no-show |
| SLOTS_CHANGED / PROVIDER_PROFILE_UPDATED / LISTING_STATUS_CHANGED | — | Invalidate cache; reindex; hide if PAUSED |

## 06 Key screens
Mobile app (Expo/React Native) and responsive web share one design system.
- Home: search bar with care-type and specialty chips; "Home visit" toggle with saved address; upcoming appointment card; family switcher.
- Results: provider cards with 3 next slots; filters sheet; verified + fee + distance or "visits your area"; sponsored label (P3).
- Provider profile: badge naming profession, reviews, fees incl. home surcharge; slot calendar; policy before booking; clinic map or coverage districts.
- Checkout: who is the patient; address (home); deposit if required; consent checkboxes; confirm.
- Appointment: status timeline (home: on the way → arrived → finished); provider card; share with family; report a problem; cancel / reschedule; pay deposit link.
- Account: family; addresses; consents; sessions; delete account.

## 07 Analytics, SLOs and release gates
| Event (privacy-safe) | Purpose |
|---|---|
| search_started / results_viewed | Demand by care type, specialty and cluster |
| slot_viewed / hold_created | Supply freshness |
| booking_confirmed / booking_failed(code) | Conversion and error causes |
| visit_attended / no_show (by location) | Liquidity and commission |
| home_visit_safety_alert / aborted_unsafe | Home-visit safety |
| review_submitted | Trust |
| refund_settled / payout_sent | Money integrity |
**RULE** No symptoms, diagnoses, free-text clinical data or patient addresses in product analytics. Search keywords are mapped to specialty codes before logging; locations are logged at district level only.
SLOs: SEARCH → CONFIRMED (median) ≤ 2 min · BOOKING API AVAILABILITY ≥ 99.5% · UNRECONCILED BOOKINGS AT 24 H ≤ 1% · NO-SHOW RATE (DEPOSIT COHORT) ≤ 15%.
| Gate | Criteria |
|---|---|
| Closed beta (M4) | ≥ 50 listed doctors in 2 clusters; golden flow green on iOS/Android/web; RTL screens approved; support roster |
| Public Egypt launch (M6) | ≥ 300 LIVE doctors; ≥ 95% booking concordance; refunds reconcile; Meta templates approved; counsel sign-off on terms |
| Home visits (M10–12) | GHV1 counsel memo and GHV2 CMO safety protocol recorded; ≥ 50 home-enabled providers per launch cluster; safety console live |
| Phase 2 verticals | Kiorly Nurse / Pharmacy / Lab GA + vertical-specific legal review (merchant of record, delivery, home care) |
**RULE** All Kiorex capabilities ship ON by default and are switchable from the super admin (catalogue in KX08). Pharmacy orders, lab bookings, home visits, physiotherapy category, individual nurse listing, telemedicine and AI navigation are launch-locked: ON by default but effective only once their legal or clinical gate is recorded.

## 08 Phase-2 verticals
Each marketplace surface consumes the vertical's operational API; it never becomes the operational system.
| Vertical | Kiorex owns | Kiorly product owns | Revenue (test point) |
|---|---|---|---|
| Home care (doctors, physio, nursing) | Search, address, booking intent, deposit, status timeline, family sharing | Kiorly Clinic / Kiorly Nurse: scheduling, zones, dispatch, visit record, MAR, safety timer | Flat fee per attended new patient (ADR007); per-profession override |
| Pharmacy | Search, cart, order intent, delivery choice, payment | Rx validation, stock reservation, dispensing, pharmacist sign-off | 4% of fulfilled order value |
| Lab tests | Test catalogue search, booking, home-collection slot, payment | Accession, collection, QC, result release | 8% of booking value |
| Telemedicine | Matching, video session orchestration | Clinician record in Kiorly Clinic | Per-consult fee (P3) |

## 09 Build status: patient app, notifications and demo data (23 Nov 2026)
Observed in `kiorex-platform` (API, web, ops, Expo app `apps/mobile`) and its `DEMO_DATA.md`. All with mock providers and seeded data; nothing deployed.

| Capability | Status | Evidence and caveat |
|---|---|---|
| Patient Expo app (iOS, Android, web), Passport sign-in client `kiorex-mobile` (PKCE), Arabic and English with RTL | Done (dev) | Jest 157 tests pass (re-run 23 Nov), tsc clean; verified on iOS simulator and Android emulator in Expo Go and on web in mock mode |
| Services screen: Telemedicine, Pharmacy, Lab, Safety, Reminders cards with Available, Awaiting approval, Temporarily unavailable from `GET /flags/effective`; WhatsApp booking card | Done (dev) | The `wa.me` button shows only when `EXPO_PUBLIC_WHATSAPP_NUMBER` is set; otherwise "announced at launch" |
| Public family visit-status link `kiorex://visit-status/<token>`, no login: steps timeline, ETA, provider name, stop sharing | Done (dev) | Fields are whitelisted so address, fee, phone and reason cannot render. Only the custom scheme is registered; universal links need a decided domain (Open) |
| Push-tap routing from the payload under the `body` key: booking, results, pharmacy order, lab booking, telemedicine; replay after sign-in | Done (dev) | The API's real push data keys for the patient app are assumed and must be confirmed with the backend (Open). Not exercised on a device |
| Tab bar on every screen, sign-out sheet that removes this device's push registration, keyboard-aware forms | Done (dev) | Verified on web and the iPhone simulator; checkout and the telemedicine room stay full-screen on purpose |
| Specialty list | Done | `GET /specialties` returns 36 specialties sorted A-Z; the provider mapper folds legacy codes (for example OBSTETRICS_GYNECOLOGY and PHYSIO_THERAPY) onto obgyn and physiotherapy; a full provider sync always re-upserts and stale rows refresh when the derived specialty changes |
| Notifications through the shared layer (KXMNT01..03) | Done (mock) | `EngagementService.deliver()` dispatches intents via `@kiorex/contracts/notify` 1.7.0; 25 templates; consent, opt-out, quiet hours, PHI guard; in-app inbox is a channel (KX24) |
| Real SMS, email, WhatsApp, payment adapters | Done (not live) | Env-driven, HMAC webhooks, dev simulators; Blocked on vendor credentials and WhatsApp template approval |
| Real push delivery to the patient app | Blocked | Platform push has no HTTP provider (stays mock); needs EAS project id, APNs and FCM keys |
| Patient app on a physical device or dev build | Open | Expo Go 58 lacks the `ExpoCrypto` module; there is no patient dev build yet |

Demo data (DEV ONLY, synthetic): every one of the 36 specialties has 2 LIVE verified doctors with bookable slots, 3 demo bookings in varied states (108 in total), 14 home-visit doctors and 11 video bookings, for 12 demo patients (phones `+201000001001` to `+201000001012`). Test values and logins are in `TEST_DATA.md` and `kiorex-platform/Docs/TEST_DATA.md`, not in this document.

> **Open question** Do universal links (`/visit-status/:token`) and a `wa.me` number ship at launch? Both depend on a domain and a number the founder has not fixed.

## What changed in this revision (23 Nov 2026)
- Added §09 build status of the patient app, notifications and demo data (Done, Open, Blocked).
- KXMNT notification requirements now run through the shared layer (KX24); channel list unchanged.
- Product scope, booking state machine and fee design are unchanged.
- Not verified: patient app on a device, real push, real vendors, the backend's real push `data` keys.

## Growth Engine update (24 Nov 2026)
Labels: **As-built** (in code today), **Approved target** (Accepted ADR or FD), **Proposed** (ADR-041 to ADR-047, unsigned), **Roadmap**, **Open decision**, **Regulatory dependency**. Full legend in KX-27. Source: `_docs/growth/` reports of 24 Nov 2026. Nothing here is implemented unless marked As-built. Rev 2.4: where this section differs from the Rev 2.4 as-built update at the end of the volume, the end section wins.

- **KXMBK10 (clinic booking link, "embedded widget on kiorly.link/<slug>")**: As-built is a page `/b/:slug` whose Book button points to `KIOREX_BOOKING_WIDGET_URL`, which does not exist yet (NH-008); the Kiorex web does not read `channel=CLINIC_LINK&slug=` (only the type exists). Proposed (ADR-044): the widget runs on its own origin (proposed `book.kiorex.com`, Open decision) with an exact-origin `frame-ancestors` allowlist; widget bookings are `CLINIC_LINK` with a signed `lt` token and are commission-free.
- **Public pages**: the patient web remains a SPA for signed-in flows. Proposed (ADR-043): public routes (home, specialty and district pages, doctor, clinic, help) are server rendered under `/{locale}/{cc}/...` with slugs, canonical, hreflang, JSON-LD and a sitemap; legacy `/doctors/:id` 301s to the slug URL. As-built today: none of this exists.
- **Analytics (section 07)**: the existing anonymous ingest (13 events, 7 properties) is unchanged. Proposed (ADR-045): a consent-gated pseudonymous visitor key and canonical funnel events in a separate table; specialty never joins the visitor stream; k at least 10 (KX-32).
- **Booking**: Proposed additive `acquisition` block on the signed booking call (contracts 1.10.0). A missing block behaves as today.
- **Deep links**: Proposed Universal and App Links for `kiorex.com` doctor and clinic URLs; Android install referrer and iOS claim code; bootstrap endpoint with no market selector while one market is live (As-built rule).
- **WhatsApp**: KXM-BK-11 deterministic machine is As-built. A tool-based assistant is Roadmap (Phase 2, flag `kiorex.whatsapp_ai_assistant`, launch-locked until the safety review).
- Not verified: any of the above running; store accounts and Team ID (NEEDS_HUMAN).

## Rev 2.4 as-built update (24 Nov 2026)
Rev 2.4 verification (24 Nov 2026): checked against the repositories, with the suites re-run the same day (counts in KX-33 section 04). As-built means in code with a passing test on the local stack; nothing is deployed or pushed and every provider is mocked. This section wins over the Growth Engine update above wherever they differ.

- **Widget, KXMBK10 (As-built).** The widget host is a role of the Kiorex API image (default host `book.kiorex.com`, DNS NEEDS_HUMAN). Routes: `GET /v1/embed/:orgSlug`, `/v1/sdk.js`, `/v1/sdk.json`, `/v1/sandbox`. The CSP `frame-ancestors` is generated per request from the organisation's `WidgetRegistration` (exact https origins, at most 10) and is `'none'` for everything else. A widget booking is forced to channel `CLINIC_LINK`, carries the signed `lt` and is `PROVIDER_LED` and commission-free; 12 widgets racing for one slot give one hold and one booking. Sign-in is a Passport popup (client `kiorex-widget`, PKCE). Not verified: the real Passport popup (a hermetic stand-in IdP was used), DNS and CDN for the host. The clinic booking page `/b/:slug` links to the embed URL; whether `kiorly.link` serves the page or redirects is still an Open decision (NH-008).
- **Public pages (As-built locally).** The public routes are server rendered under `/{ar|en}/eg/...` (14 page types, slugs with history, guard, JSON-LD, robots, sitemaps); the signed-in flows stay a SPA. Every page is `noindex` outside production and the sitemap is empty on the local stack. No Lighthouse score exists (KX-31).
- **Analytics (As-built).** The anonymous ingest (13 events, 7 properties) is unchanged. A separate `GrowthEvent` stream carries the 15 canonical names; specialty never joins the visitor stream; every report applies k of at least 10 (KX-32). The visitor key stays locked behind the counsel gate.
- **Booking (As-built).** Kiorex decides the attribution origin once per booking, stores it on `BookingIntent` and sends the optional `acquisition` block (contracts 1.10.0) plus the verified `lt` (optional field added in 1.11.0). Flag `growth.attribution` OFF sends neither.
- **Deep links and bootstrap (As-built in code, not verified on a device).** `GET /api/v1/bootstrap` returns the live markets and `showMarketSelector` (true only when more than one market is live). `/.well-known/apple-app-site-association` and `assetlinks.json` answer 404 in production until `APPLE_TEAM_ID` and the Android SHA-256 are configured. Fallback pages `/r/:code`, `/q/:code`, `/a/:id`, `/appointment/:id` are consent-first.
- **Telehealth, Kiorex side (As-built, ADR-039).** The Clinic owns the peer-to-peer session. Kiorex keeps `BookingIntent.telehealth` (session id, join URL, window, state) filled from the Clinic events, exposes `GET /telemedicine/visits`, and answers `409 CLINIC_OWNS_CALL` on its own session endpoints when `VIDEO_MODE=clinic-p2p`. The Daily.co adapter was removed. The web card and the patient app open the Clinic join page (in-app WebView on the phone, new native module `react-native-webview`, native rebuild needed). The launch-locked flag `kiorex.telemedicine` is unchanged. Not verified: a real call over TURN on devices.
- **Connect, front door and partner leads (As-built, ADR-040 and its amendment).** Kiorex serves the signed connection request (`POST /partners/v1/connection-requests`, published in contracts `kiorex-partner-intake.v1`), the low-privilege signed lead (`POST /partners/v1/leads`) and the funnel marker (`POST /partners/v1/funnel`), which are not in the published OpenAPI files. Ops console pages: Partner onboarding (automated and human steps, two-person approval, Go live) and Partner leads with a funnel (interested, started, submitted, live). Lead alerts reach the Kiorex team through the shared notification layer (e-mail, WhatsApp, push; mock providers). Pharmacy and lab traffic is routed per registration, so a second live pharmacy or lab is served.
- **Consent and preferences (As-built).** `/preferences` and `/{locale}/{cc}/preferences` in the web, a preferences screen in the patient app, marketing consent per channel, suppression on STOP. Wording is a draft (NEEDS_HUMAN).
- **WhatsApp.** The deterministic booking machine is unchanged; STOP now writes suppression even when the booking flag is OFF. The tool-based assistant is Roadmap.
- **Not verified:** any production behaviour; store accounts and Team ID (NEEDS_HUMAN); the real Search Console and Bing integrations (mock adapter).

## 10 Patient credit, coupons and sponsored discounts (Proposed, 24 Nov 2026)
Labels: **Proposed** (ADR-048, founder-approved design of 24 Nov 2026, unsigned), **As-built**, **Regulatory dependency**. **As-built note (Rev 2.7, 25 Nov 2026):** the patient credit ledger, coupon mode (default), credit mode, refund-as-credit with the original payment method preselected, family credit and goodwill are **built locally in the Kiorex platform and launch-locked** (flags `growth.patient_credit`, `growth.refund_as_credit`, `growth.family_credit`, `growth.support_goodwill`; all amounts zero until a human sets them); the Clinic wallet is untouched by them. Not deployed; counsel and accounting gates open (KX-30 section 15). Design: KX-30 section 14, ADR-048, packages P2-B2 and P2-S. Patient CREDIT mode (any stored balance) is **launch-locked and counsel-gated; coupon mode is the default.**

| Capability | Behaviour the patient sees |
|---|---|
| Rewards | After a friend's first completed visit (or your own first completed visit) you receive a voucher (default) or credit with an expiry date; nothing on sign-up or an unfinished booking |
| Goodwill | If a provider cancels late, you wait too long or a booking fails, support can grant a voucher or credit with a reason |
| Refund choice | When you cancel or request a refund the screen offers **"Refund to original payment method" (selected by default)** and **"Keep as credit"**; you choose; credit can only be used on Kiorex and cannot be withdrawn or sent to anyone |
| Checkout | Lines are shown separately: price, discount sponsored by the clinic (if any), credit, deposit already held, card; the credit is applied before the card |
| Family | One owner holds the credit and dependants can use it; no transfer between families |
| Campaign credit | Time-limited credit usable for certain visit types (and an allowlisted set of specialties) |
| Provider-sponsored discount | Some clinics fund a discount on their own visit fee; it is labelled "sponsored by <clinic>" with an end date, never a Kiorex discount, and never applies to drugs, tests or procedures |
Rules: closed loop; no withdrawal, transfer, cash conversion or top-up; expiry and caps on every grant; issuance only after a verified completed visit; reversal when the qualifying booking is refunded or cancelled; never Kiorex revenue. Status of each: Proposed.
