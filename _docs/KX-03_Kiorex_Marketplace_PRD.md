# KX03 — Kiorex Marketplace PRD
Source: 1DGF8VhADyM_2pzgNlJDkEJe2RYVvzQv_

> Note: transcribed from PDF text extraction. Symbols dropped by the extractor (≥, ≤, →, ×) were restored by inference where obvious; page headers/footers removed.

Subtitle: The patient-facing marketplace: discovery, booking against Kiorly's live schedules, Kiorex Pay, verified reviews, family accounts and — in phase 2 — pharmacy orders and lab tests.

Kiorex v2 · ecosystem reference. Authored in the role of Chief Product Officer. Owns the patient experience, marketplace liquidity and trust.

Tags: Egypt MVP · 120 requirements [as printed on the cover] · Booking state machine · Kiorly contract consumer · Phase-2 verticals

| Field | Value |
|---|---|
| DOCUMENT | KX03 |
| REVISION | Rev 2.2 · Reference Edition |
| DATE | 19 November 2026 |
| STATUS | Approved reference |
| AUDIENCE | Founders, investors, engineering & operations leads |
| OWNER ROLE | Chief Product Officer |
| SUPERSEDES | Kiorex v2 draft volumes 19 Nov 2026, 00000106 |

## Contents
01 Product vision and positioning · 02 Personas and jobs to be done · 03 MVP scope (Egypt, months 1–6) · 04 Functional requirements · 05 Booking state machine · 06 Key screens · 07 Analytics, SLOs and release gates · 08 Phase-2 verticals

## 01 Product vision and positioning

Kiorex is where patients in MENA find verified care they can actually get — and where providers get patients they only pay for when they show up.

> "Book a verified doctor in under two minutes, in Arabic, and know exactly what you'll pay."

Four pillars:
- **Verified, not just listed** (trust): Every LIVE doctor passed syndicate-number and licence verification in Kiorly (ON03). Unverified profiles are never bookable.
- **Real slots, certainty**: Slots come from Kiorly's canonical slot engine (KX03) with holds and idempotent bookings — no double booking, no 'we'll call you'.
- **Reviews you can believe**: Only patients with a completed Kiorex-channel visit can review (KX08). No anonymous ratings.
- **Fair to providers (economics)**: Clinics pay only for attended new patients, and never more than their Kiorly subscription in a month.

**NOTE** Build starting point (KX22): the patient web starts from the harvested kiorex-web-app screens (marketplace, doctor search, provider profile, booking, patient portal) — same React/Vite/shadcn stack as Kiorly — rewired to real APIs. The backend is new in kiorex-platform; no code is reused from the 2025 kiorex-backend. The iOS/Android app is a new Expo project.

## 02 Personas and jobs to be done

| Persona | Job to be done | Pain today | Success measure |
|---|---|---|---|
| Amira, 34, Cairo, mother of two | Book a paediatrician near home tonight for tomorrow | Phone lines busy; WhatsApp replies late; fee unknown | Search → confirmed in ≤ 2 min |
| Hassan, 61, chronic patient | Follow-up with his cardiologist and refill medicines | Repeats history at every visit; loses paper Rx | Records shared to app; refill reminder |
| Nour, 26, first job, Giza | Find a dermatologist with good reviews within budget | Fake reviews, unclear prices | Transparent fee + verified reviews |
| Caregiver for elderly parent | Manage parent's bookings and results | No shared access | Family profiles with guardian rights |
| Clinic receptionist (supply side) | Receive Kiorex bookings without double entry | Separate tablets for each platform | Bookings land in Kiorly schedule automatically |

## 03 MVP scope (Egypt, months 1–6)

Doctor discovery and booking powered by Kiorly. Everything else waits until liquidity is proven.

**MVP — must have**
- Kiorex Account sign-up/login (phone OTP, profile, family members)
- Search by specialty, area, fee, language, gender, availability
- Doctor/clinic profile from Kiorly provider sync
- Live slots, 5-min holds, idempotent booking
- Confirmation, reminders (WhatsApp + push), cancel/reschedule within policy
- Kiorex Pay deposit for high-risk bookings
- Verified reviews after completion
- Arabic-first UI, RTL, accessibility
- Support: WhatsApp + in-app ticket
- Ops console: providers, bookings, disputes, payouts

**Deferred (with trigger)**
- Telemedicine — after clinical governance sign-off (Q6)
- Pharmacy ordering — after Kiorly Pharmacy GA (M16)
- Lab tests & home collection — after Kiorly Lab GA (M21)
- Sponsored listings — after ≥ 12 attended patients/doctor/month in cluster
- Insurance comparison — after payer partnerships
- AI symptom navigation — after clinical evaluation (KX11)
- Health vault uploads by patient — phase 1b with KX11 record share

## 04 Functional requirements

IDs are stable. Priority: M = MVP, P2 = phase 2, P3 = later.

### Account & family (KXMAC)

| ID | Requirement | Pri |
|---|---|---|
| KXMAC01 | Sign up and log in with phone OTP via Kiorex Account OIDC + PKCE; optional email and passkey. | M |
| KXMAC02 | Profile: name AR/EN, date of birth, gender, national ID (optional, encrypted), preferred language. | M |
| KXMAC03 | Add family members (dependants) with guardian relationship; book on their behalf. | M |
| KXMAC04 | Consent centre: marketplace processing, reminders, record sharing — view and withdraw. | M |
| KXMAC05 | Device/session list with remote sign-out. | M |
| KXMAC06 | Account deletion in-app with data-export option (store requirement). | M |
| KXMAC07 | Link Kiorly patient record to Kiorex Account on first booking by phone/national-ID match; never auto-merge conflicts. | M |

### Discovery (KXMDS)

| ID | Requirement | Pri |
|---|---|---|
| KXMDS01 | Search by specialty, symptom keyword (mapped to specialty), doctor name, clinic name. | M |
| KXMDS02 | Filters: area/governorate, distance, fee range, next available, gender, language, rating, accepts deposit. | M |
| KXMDS03 | Sort: earliest slot (default), distance, rating, fee. Sponsored results labelled (P3). | M |
| KXMDS04 | Results show next 3 available slots inline; tap to hold. | M |
| KXMDS05 | Map view of clinics with availability pins. | P2 |
| KXMDS06 | Emergency keyword detection routes to emergency guidance (123 ambulance) — no booking. | M |
| KXMDS07 | Search index refresh from Kiorly GET /marketplace/v1/providers?updatedSince every 5 min + PROVIDER_PROFILE_UPDATED events. | M |
| KXMDS08 | Report profile analytics daily to Kiorly (POST /marketplace/v1/analytics/profile-views). | M |

### Profiles (KXMPR)

| ID | Requirement | Pri |
|---|---|---|
| KXMPR01 | Doctor profile: photo, titles, specialty, sub-specialties, languages, fee per visit type, clinic(s), verification badge. | M |
| KXMPR02 | Clinic profile: address, map, phone, hours, photos, accepted payment methods. | M |
| KXMPR03 | Ratings: average and count from verified reviews; latest 20 visible reviews with clinic replies. | M |
| KXMPR04 | Cancellation policy displayed before booking (from Kiorly settings). | M |
| KXMPR05 | Share profile link; deep link into app. | M |

### Booking (KXMBK)

| ID | Requirement | Pri |
|---|---|---|
| KXMBK01 | Slot list for a doctor, visit type and date range from Kiorly slot engine (min notice, horizon, daily cap respected). | M |
| KXMBK02 | Create a 5-minute hold (POST /marketplace/v1/holds, externalRef unique) when the patient picks a slot. | M |
| KXMBK03 | Confirm booking with Idempotency-Key = Kiorex booking ID; persist Kiorly appointment ID. | M |
| KXMBK04 | On 409 SLOT_TAKEN show the 3 alternative slots returned by Kiorly. | M |
| KXMBK05 | On timeout, query GET /marketplace/v1/bookings/:externalRef before any retry; never create a second key. | M |
| KXMBK06 | Pending state when clinic requires manual confirmation; show due time; handle MARKETPLACE_BOOKING_CONFIRM_TIMEOUT. | M |
| KXMBK07 | Patient cancel/reschedule via Kiorly endpoints; surface CANCELLATION_WINDOW_CLOSED etc. clearly. | M |
| KXMBK08 | Show clinic-initiated cancellations with reason and automatic deposit refund. | M |
| KXMBK09 | Add to calendar; directions; call clinic. | M |
| KXMBK10 | Clinic booking link widget (channel=CLINIC_LINK) embedded on kiorly.link/<slug> — commission-free. | M |
| KXMBK11 | WhatsApp booking channel (KIOREX_WHATSAPP) using the same holds/bookings API. | P2 |
| KXMBK12 | Waitlist: patient joins; Kiorly waitlist auto-fill offers slot (FS03). | P2 |

### Kiorex Pay (KXMPAY)

| ID | Requirement | Pri |
|---|---|---|
| KXMPAY01 | Collect deposit by card / wallet / Fawry reference when visit type requires it; notify Kiorly (deposit-paid). | M |
| KXMPAY02 | Refund automatically when depositRefundable=true on cancellation events. | M |
| KXMPAY03 | Pay deposit links sent by clinics (FS04) via hosted checkout (KIOREX_PAY_LINK_BASE_URL). | M |
| KXMPAY04 | Weekly provider payouts; call POST /marketplace/v1/payouts idempotently; reconcile. | M |
| KXMPAY05 | Ledger: gross, PSP fee, refunds, payouts, held balance per clinic; daily PSP reconciliation. | M |
| KXMPAY06 | Full prepayment of visit fee (optional per clinic). | P2 |

### Notifications (KXMNT)

| ID | Requirement | Pri |
|---|---|---|
| KXMNT01 | Booking confirmed, reminder T-24h and T-2h, changed, cancelled — WhatsApp template + push + in-app. | M |
| KXMNT02 | Respect consent and quiet hours; opt-out per channel. | M |
| KXMNT03 | Review invitation on REVIEW_INVITATION_ELIGIBLE, T+2h after completion. | M |

### Reviews (KXMRV)

| ID | Requirement | Pri |
|---|---|---|
| KXMRV01 | Rating 1–5 + text; one review per completed appointment; editable for 7 days. | M |
| KXMRV02 | Moderation: PHI/abuse detection; HIDDEN status synced to Kiorly. | M |
| KXMRV03 | Sync aggregates and reviews to Kiorly (POST /marketplace/v1/reviews/aggregate); display clinic replies. | M |

### Records & continuity (KXMRC)

| ID | Requirement | Pri |
|---|---|---|
| KXMRC01 | Receive consent-based record shares from Kiorly (KX11): visit summary, Rx, orders. | P2 |
| KXMRC02 | Prescription view with verification QR (CL03). | P2 |
| KXMRC03 | Follow-up reminders from doctor-specified intervals. | P2 |

### Operations console (KXMOP)

| ID | Requirement | Pri |
|---|---|---|
| KXMOP01 | Provider directory with listing status mirrored from Kiorly; search and filters. | M |
| KXMOP02 | Booking timeline per booking: intents, holds, Kiorly responses, events, payments. | M |
| KXMOP03 | Outbox delivery monitor: lag, dead letters, replay. | M |
| KXMOP04 | Refunds, payouts, PSP reconciliation dashboard. | M |
| KXMOP05 | Review moderation queue; patient complaints with SLA. | M |
| KXMOP06 | Cluster liquidity dashboard: listed doctors, slots/day, search→book, attended, no-show. | M |
| KXMOP07 | Super admin Feature flags page: every flag of every product with effective value per scope, source of value, class, dependencies and last change. | M |
| KXMOP08 | Toggle any flag OFF/ON at global, market or organization scope; reason and ticket required; optional expiry and schedule. | M |
| KXMOP09 | Launch-locked flags: record gate evidence (gate ID, approver, date, document link) — the flag becomes effective only then. | M |
| KXMOP10 | Two-person approval for global/market OFF of money-path flags; single-admin emergency kill with 24 h review. | M |
| KXMOP11 | Flag audit trail and export; propagation status per product (snapshot version and age). | M |

## 05 Booking state machine

Kiorex keeps its own view of a booking; Kiorly's appointment status is authoritative and drives transitions through outbox events.

States and transitions (from the diagram):
- INTENT → (slot picked) → HELD [5-min hold]
- HELD → (book) → PENDING_CLINIC [manual confirm] or CONFIRMED [auto-confirm; Kiorly ID stored]
- PENDING_CLINIC → (staff confirm) → CONFIRMED
- HELD → (hold lapsed, timeout) → EXPIRED
- PENDING_CLINIC → (timeout) → EXPIRED
- CONFIRMED → (cancel by patient/clinic/system) → CANCELLED
- CONFIRMED → (check-in) → CHECKED_IN [charge PENDING]
- CONFIRMED → (no-show) → NO_SHOW [deposit forfeited]
- CHECKED_IN → (complete) → COMPLETED [review invite]

Figure: Kiorex booking states mapped to Kiorly events (APPOINTMENT_CONFIRMED, CHECKED_IN, COMPLETED, NO_SHOW, CANCELLED_BY_*).

| Kiorly event | Kiorex transition | Side effects in Kiorex |
|---|---|---|
| APPOINTMENT_CONFIRMED | → CONFIRMED | Notify patient; schedule reminders |
| RESCHEDULED | CONFIRMED → CONFIRMED (new time) | Update calendar; reminders |
| CANCELLED_BY_CLINIC | → CANCELLED | Refund deposit; apology + 3 alternatives |
| CANCELLED_BY_PATIENT | → CANCELLED | Refund if depositRefundable |
| CHECKED_IN / CHECK_IN_REVERTED | → CHECKED_IN / back | Attribution metrics |
| COMPLETED | → COMPLETED | Review invitation; follow-up |
| NO_SHOW | → NO_SHOW | Deposit forfeited; no-show score |
| SLOTS_CHANGED / PROVIDER_PROFILE_UPDATED / LISTING_STATUS_CHANGED | — | Invalidate cache; reindex; hide if PAUSED |

## 06 Key screens

Mobile app (Expo/React Native) and responsive web share one design system.

- **Home:** Search bar with specialty chips · Upcoming appointment card · Family switcher · Recently viewed doctors
- **Results:** Doctor cards with 3 next slots · Filters sheet · Verified + fee + distance · Sponsored label (P3)
- **Doctor profile:** Badge, reviews, fees · Slot calendar · Policy before booking · Clinic map
- **Checkout:** Who is the patient · Deposit if required · Consent checkboxes · Confirm
- **Appointment:** Status timeline · Directions / call · Cancel / reschedule · Pay deposit link
- **Account:** Family · Consents · Sessions · Delete account

## 07 Analytics, SLOs and release gates

| Event (privacy-safe) | Purpose |
|---|---|
| search_started / results_viewed | Demand by specialty and cluster |
| slot_viewed / hold_created | Supply freshness |
| booking_confirmed / booking_failed(code) | Conversion and error causes |
| visit_attended / no_show | Liquidity and commission |
| review_submitted | Trust |
| refund_settled / payout_sent | Money integrity |

**RULE** No symptoms, diagnoses or free-text clinical data in product analytics. Search keywords are mapped to specialty codes before logging.

SLO tiles (comparison symbols inferred):
- SEARCH → CONFIRMED (MEDIAN): ≤ 2 min
- BOOKING API AVAILABILITY: ≥ 99.5%
- UNRECONCILED BOOKINGS AT 24 H: ≤ 1%
- NO-SHOW RATE (DEPOSIT COHORT): ≤ 15%

| Gate | Criteria |
|---|---|
| Closed beta (M4) | ≥ 50 listed doctors in 2 clusters; golden flow green on iOS/Android/web; RTL screens approved; support roster |
| Public Egypt launch (M6) | ≥ 300 LIVE doctors; ≥ 95% booking concordance; refunds reconcile; Meta templates approved; counsel sign-off on terms |
| Phase 2 verticals | Kiorly Pharmacy / Lab GA + vertical-specific legal review (merchant of record, delivery) |

**RULE** All Kiorex capabilities ship ON by default and are switchable from the super admin (catalogue in KX08). Pharmacy orders, lab bookings, telemedicine and AI navigation are launch-locked: ON by default but effective only once their legal or clinical gate is recorded.

## 08 Phase-2 verticals

Each marketplace surface consumes the vertical's operational API; it never becomes the operational system.

| Vertical | Kiorex owns | Kiorly product owns | Revenue (test point) |
|---|---|---|---|
| Pharmacy | Search, cart, order intent, delivery choice, payment | Rx validation, stock reservation, dispensing, pharmacist sign-off | 4% of fulfilled order value |
| Lab tests | Test catalogue search, booking, home-collection slot, payment | Accession, collection, QC, result release | 8% of booking value |
| Telemedicine | Matching, video session orchestration | Clinician record in Kiorly Clinic | Per-consult fee (P3) |
