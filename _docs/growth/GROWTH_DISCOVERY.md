# Growth & Patient Acquisition Engine: Discovery

Status: DRAFT for founder review. Read-only discovery run on 24 Nov 2026 against the workspace `kiorex-v2` (clinics-management on branch `kiorex`, kiorex-platform, kiorex-account, kiorex-contracts, kiorly, kiorly-pharmacy, kiorly-lab, `_docs/rev23`, Google Drive folder "Kiorex v2"). Nothing was edited, committed, deployed or pushed.

Legend: **EXISTS** reuse as is. **PARTIAL** complete or extend. **ABSENT** build. **CONFLICT/DEBT** an as-built fact that contradicts the approved docs or the new requirement. "As-built" means verified in code in this session; "documented" means only found in a doc; "NOT VERIFIED" means I could not confirm.

Companion files: `GROWTH_ARCHITECTURE_DECISIONS.md`, `GROWTH_COMPETITIVE_RESEARCH.md`, `GROWTH_PHASE1_WORK_PACKAGES.md`.

## 1. Headline findings

1. The commission side of "providers are not charged for patients they acquire themselves" is already half built and well tested. The clinic stamps `Appointment.bookingSource` (enum `FRONT_DESK, PHONE, WALK_IN, CLINIC_LINK, KIOREX_MARKETPLACE, KIOREX_WHATSAPP, INTEGRATION, IMPORT`), freezes `isNewPatientAtBooking` with a 24-month lookback (E.164 phone and national id), and `isCommissionChargeableBooking()` makes `CLINIC_LINK` never chargeable (`clinics-management/apps/api/src/appointments/booking-attribution.ts`, `src/patients/new-patient.service.ts`, `Docs/BOOKING_ATTRIBUTION.md`). The charge engine (`src/kiorex/commission-charge.service.ts`, `KiorexCommissionCharge` states PENDING, CONFIRMED, DISPUTED, REVERSED, WAIVED, BILLED; `CommissionDispute`; rate table `KiorexCommissionRate` with `validFrom/validTo`) is idempotent per appointment (`appointmentId @unique`).
2. What is missing is everything upstream of the booking: there is no touchpoint evidence, no UTM capture, no visitor identity, no provider link tracking, no decision record, and `attributionJson` is an unvalidated free-form JSON bag (`searchId`, `campaign`, `landingPage` are only a TypeScript type).
3. The patient web (`kiorex-platform/apps/web`) is a client-side Vite SPA (`BrowserRouter`, static `index.html` with one title and description, no `robots.txt`, no sitemap, no JSON-LD, no hreflang, doctor URL `/doctors/:id` keyed by a cuid). Search engines see an empty shell. This is the largest single gap for the SEO engine and it is a CONFLICT with KX-14 §05 ("provider profiles indexed; schema markup").
4. The provider booking link is half wired: the slug system and the public page `/b/:slug` exist, but the "Book" button points to a Kiorex widget URL that does not exist yet (`KIOREX_BOOKING_WIDGET_URL`, NH-008), `kiorly.link` is not wired (`BOOKING_LINK_BASE_URL` defaults to `${APP_WEB_URL}/b`), and the Kiorex web app does not read `channel=CLINIC_LINK&slug=` (only the type `BookingChannel` exists in `apps/web/src/api/types.ts`).
5. Every Kiorly host sends `frame-ancestors 'none'` by design (`kiorex-account/config/domains.json` `frameAncestors`: "Nothing embeds another product"). Embeddable widgets therefore need a dedicated origin with an allowlist-driven CSP. This is a documented-decision CONFLICT that needs a new ADR, not a quiet exception.
6. The Kiorex analytics ingest is deliberately anonymous and cannot do funnels or attribution: 13 whitelisted event names, 7 whitelisted properties, "nothing identifying the user (no sub, no IP, no device id) is stored" (`kiorex-platform/apps/api/src/analytics/analytics.service.ts`). The growth engine needs a consent-gated pseudonymous visitor id, which is a deliberate change to that rule and must be a recorded decision.
7. The notification layer (KX-24, ADR-034/035) already models purposes `TRANSACTIONAL, REMINDER, MARKETING, SECURITY`, consent, opt-out, quiet hours, WhatsApp 24 h window, dedupe and PHI guard, and is adopted in kiorex-platform (`src/engagement/notification.layer.ts`). Lifecycle CRM must be built on it, not beside it. KX-24 §01 lists "marketing campaigns" as an explicit non-goal of that revision, so campaigns are new scope, not a contradiction.
8. WhatsApp: the Kiorex booking channel KXM-BK-11 is a deterministic state machine (`apps/api/src/channels/whatsapp-booking.service.ts`, states `IDLE, CHOOSE_SPECIALTY, CHOOSE_DOCTOR, CHOOSE_SLOT, OFFER_WAITLIST, CONFIRM`) over the `MessagingHub`, using the same `BookingService` as the app. The clinic already has an LLM receptionist on the clinic's own number (MS-06, flag `clinic.whatsapp_ai_receptionist`). A tool-based Kiorex assistant is ABSENT but can sit on the same BookingService.
9. Naming collision: `ReferralIssued` is already a published clinical event (a doctor refers a patient to a physio, contracts 1.9.0). The growth "referral" events must not reuse that name family. Also: `Referral`/`ReferralCode` in the clinic are doctor-to-doctor SaaS referrals (CR-09, "1 month free both sides"), a supply-side program that stays and must not be conflated with patient referral.
10. Next free numbers: **KX-27** (KX-00..KX-26 exist, identical set in repo and Drive), **ADR-041** (ADR-040 is the last in KX-01; ADR-039 does not appear in the repo set, see §6, so confirm in Drive before using 039), **FD-21** (FD-20 is the last), **NH-041** (clinic `KIORLY_NEEDS_HUMAN.md` ends at NH-040).

## 2. Capability inventory

Paths are relative to `/Users/shall/Documents/Peraonal/Work/kiorex-v2/`. `CM` = clinics-management (branch kiorex), `KP` = kiorex-platform, `KA` = kiorex-account, `KC` = kiorex-contracts, `KL` = kiorly (staff app).

| # | Capability | Class | Evidence (as-built unless stated) | Gap to close |
|---|---|---|---|---|
| 1 | Clinic and doctor booking link (provider referral link) | PARTIAL | `CM/apps/api/src/marketplace/booking-slug.ts` (pattern, reserved words, 3 to 40 chars), `clinic-booking-page.service.ts` (`bookingPageUrl`, `kiorexWidgetUrl`), `public-booking-page.controller.ts` (`GET /public/booking-pages/:slug`, cached 60 s), web route `/b/:slug` (`CM/apps/web/src/app/router.tsx`), `Clinic.bookingSlug` and `MarketplaceListing.bookingSlug` (migration `20261119050000_kx09_booking_slugs`) | No branch or desk links, no per-link identity or counters, no UTM, `kiorly.link` not wired, Kiorex side does not consume `channel=CLINIC_LINK` yet, slugs are ASCII only (Arabic-only names fall back to `clinic`/`doctor` plus suffix), no slug history/redirects |
| 2 | Branch / reception-desk links | ABSENT | no code | build |
| 3 | QR codes for patient booking | ABSENT | QR exists only as a scanner in the staff app (`KL/app/scan.tsx`, `KL/src/components/scanner.tsx`) and a documented "QR signup with rep code" (KX-14 §04) | generate and print QR (A4/A5 AR/EN posters promised in KX-14 §05) |
| 4 | Supply-side referral and rep codes (doctor to doctor, field reps) | EXISTS | `CM` models `ReferralCode`, `Referral` (PENDING/REWARDED/REJECTED), `src/growth/*` (`referral-code.service.ts`, `referral-attribution.service.ts`, `referral-reward.service.ts`, `referral-fraud.ts`: same phone, same national id, shared payment fingerprint), flag `clinic.referral_rewards`, signup accepts `ref`/`referralCode`/`salesRepCode`/`rep` (`src/signup/public-signup.controller.ts`), `src/sales-reps/*` | reuse patterns (fraud signals, caps by market pack via `referralConfigFromMarket`) |
| 5 | Embeddable booking widget (iframe, JS SDK, domain allowlist) | ABSENT | only a URL placeholder `KIOREX_BOOKING_WIDGET_URL` (NH-008); unrelated `role-assistant-widget` in CM web | build; CONFLICT with `frame-ancestors 'none'` (see §5) |
| 6 | Universal Links / App Links | PARTIAL | `KA/config/app-links/apple-app-site-association.json` (template, `TODO_NEEDS_HUMAN_APPLE_TEAM_ID.com.kiorly.app`, paths `/signin/*`, `/open/*`) and `assetlinks.json` for the Kiorly staff app on `www.kiorly.com`; `KA/config/domains.json` `appLinks`; Kiorex patient app has only URL scheme `kiorex` (`KP/apps/mobile/app.json`) | patient app links on the Kiorex host, store accounts and Team ID are NEEDS_HUMAN (KX-19 §04) |
| 7 | Deferred deep links | ABSENT | none | Android Play Install Referrer; iOS strategy |
| 8 | Market-aware bootstrap routing | PARTIAL | Kiorex market gate `MarketService` (`market.<cc>.live` flags, `KP/apps/api/src/market/market.service.ts`), clinic `Market` table with `hostCell`, `dataRegion`; selectors hidden while one market is live (CLAUDE.md, 23 Nov 2026) | no URL-level or app-level market resolution; no `/{cc}` in URLs |
| 9 | Open-redirect protection for link redirects | PARTIAL | OIDC redirect allow-lists derived from `KA/config/domains.json`; Kiorex `sign-in-default.ts` in the three product webs handles `kiorly.link`-style hosts (`CM/apps/web/src/lib/sign-in-default.ts`) | a generic `/open` and `/r` resolver with an allowlist is ABSENT |
| 10 | First-party touchpoint capture (UTM, referrer, click ids, QR, widget, WhatsApp, offline) | ABSENT | grep for `utm` returns nothing in source; `ref=` appears only in supply-side signup | build |
| 11 | Booking-level source stamp | EXISTS | `Appointment.bookingSource`, `attributionJson`, `isNewPatientAtBooking`, `newPatientCheckedAt`; Kiorex `BookingIntent.channel` (`MARKETPLACE|CLINIC_LINK|WHATSAPP`), `patientSnapshot.bookingPageSlug`; Kiorex sends `attribution: { source: 'kiorex' | 'kiorex_whatsapp' }` and maps WhatsApp to `KIOREX_WHATSAPP` only when `KIORLY_ACCEPTS_WHATSAPP_CHANNEL` is set (`KP/apps/api/src/booking/booking.service.ts` lines about 256 to 259) | richer, validated, immutable evidence and a decision record |
| 12 | Commission attribution and charge | EXISTS | see headline 1; also `KiorexCommissionRate` narrowing by profession, service location, specialty; EGP 40 flat placeholder (KX-13 line "EGP 40 per attended new patient, indexed", KX-12 §BR55 care plans charged once); `KiorexCommissionCharge.disputeDeadline`; auto-dispute rules `commission-dispute-auto.ts`; `COMMISSION_CHARGE_CREATED/REVERSED` events in contracts | policy versioning of the attribution rules, `AttributionDecision` and `CommissionDecision` evidence, a dispute reason for provider-led evidence |
| 13 | Versioned commercial policy | PARTIAL | rate rows are effective-dated (`validFrom/validTo`); market pack `featureDefaults.kiorex` (benchmark ratio, lite cap, dispute days) and `featureDefaults.newPatient.lookbackMonths` (24 default); `PolicySetting` (KP) has key, scope GLOBAL/MARKET/ORG, audit log entry, but one row per key (no version history, no effective date, no maker-checker) | `GrowthConfigVersion` |
| 14 | Campaign management engine | ABSENT | `attributionJson.campaign` is a free string; clinic recall messaging is marketing-consent gated (`CM/apps/api/src/messaging/*`) | build (Phase 2) |
| 15 | Patient referral program | ABSENT | none for patients | build (Phase 2) |
| 16 | Rewards ledger and promotional credits | PARTIAL | tenant-level `CreditWallet` and append-only `CreditLedgerEntry` (types GRANT/CONSUME/EXPIRE/REVERSE; reasons include REFERRAL, PROMO, GOODWILL) for SaaS invoices only (`CM/apps/api/src/credits/*`, `Docs/CREDIT_WALLET.md`); Kiorex Pay ledger (`LedgerTx/LedgerEntry`) is for money | patient-side closed-loop reward ledger is ABSENT |
| 17 | Fraud safeguards | PARTIAL | `referral-fraud.ts` (supply side), `RateLimitBucket` shared Postgres limiter (KP), per-IP/org limits on partner leads | patient-level signals and review queue ABSENT |
| 18 | SEO: server rendering | ABSENT / CONFLICT | `KP/apps/web` is Vite 8 SPA, `BrowserRouter` in `src/App.tsx`, `index.html` is static AR/RTL with `lang="ar"` and a render-blocking Google Fonts link | see architecture decision |
| 19 | SEO: sitemap, robots, canonical, hreflang, schema.org | ABSENT | none in `KP/apps/web/public` or API; hreflang exists only in the static store pages `KL/Docs/store-pages/*.html` | build |
| 20 | Localized public landing pages | PARTIAL | signed-out `LandingPage.tsx` (SPA), Kiorly Home sign-in (`KA/apps/kiorly-home`); KX-19 says marketing site on `kiorly.com/clinic|nurse|pharmacy|lab|pricing|help` (documented, no code found in this workspace) | NOT VERIFIED whether a separate marketing site repo exists; none under the 7 repos |
| 21 | Doctor/clinic slugs for Kiorex pages | PARTIAL | Kiorly slugs exist (row 1); Kiorex `Provider` has no slug and `DoctorCard` links `/doctors/${doctor.id}` | Kiorex-owned slug and history |
| 22 | Trust content usable by SEO (reviews, rating, verification) | EXISTS | `Review`, `ratingAvg/ratingCount` on `Provider`, verified-visit reviews (KX-08 review invitation), `verificationRegister` | expose in structured data under Google's review-snippet rules |
| 23 | Provider Growth workspace | PARTIAL | the state-aware Kiorex tab (ADR-040 amendment): dashboard with listings, month bookings, fees charged, rating; "Your booking link" card; ops Partner leads and funnel (`KP` models `PartnerLead`, `PartnerFunnelMark`) | link/QR/widget/analytics/campaign tools |
| 24 | WhatsApp booking (Kiorex) | EXISTS (deterministic) | `KP/apps/api/src/channels/whatsapp-booking.service.ts`, test `test/whatsapp-booking.int.spec.ts`, `ChannelConversation` model, flag `kiorex.whatsapp_booking`, `ChannelBadge.tsx` | LLM/tool layer ABSENT |
| 25 | WhatsApp AI receptionist (clinic) | EXISTS | `CM/Docs/MS06_AI_RECEPTIONIST.md`, flag `clinic.whatsapp_ai_receptionist`, `WhatsAppReceptionistTurn` | none for growth; keep separate from Kiorex assistant |
| 26 | Notification layer | EXISTS | KX-24; `KP/apps/api/src/engagement/notification.layer.ts` and `templates.ts` (25 `NotifyKind`s); clinic adoption is "Planned (step 5)" | marketing templates and caps |
| 27 | Consent: transactional vs marketing | PARTIAL | clinic `MessagingConsent` (patient, channel, purpose `TRANSACTIONAL|MARKETING`; marketing default not granted; STOP/إلغاء) `Docs/MESSAGING_CONSENT.md`; Kiorex `ConsentRecord` (purposes `MARKETPLACE_PROCESSING|REMINDERS|RECORD_SHARING|AI_PROCESSING`, version `TODO_NEEDS_HUMAN_v0`), `NotificationPreference` (per channel, `quietStart/quietEnd`) | marketing and analytics purposes on Kiorex, frequency caps, suppression list, preference centre, versioned consent text (NEEDS_HUMAN) |
| 28 | Lifecycle CRM journeys | ABSENT | reminders, review invites, waitlist offers exist as transactional (`EngagementService.processDue`, `FollowUpReminder`) | build (Phase 2) |
| 29 | Cookie/analytics consent banner | ABSENT | none | build |
| 30 | A/B experimentation | ABSENT | flags control plane (`FlagDefinition/FlagValue/FlagChangeRequest/FlagAudit`) is on/off by scope, not assignment | build (Phase 3) |
| 31 | Growth analytics (funnel, CAC, LTV, ROAS, cohorts) | PARTIAL | anonymous `AnalyticsEvent` (13 names), `ProfileViewDaily`, ops `LiquidityPage`, `PartnerFunnelMark` | canonical events, visitor key under consent, rollups |
| 32 | Super Admin versioned config with maker-checker | PARTIAL | flags: `FlagChangeRequest` PENDING/APPROVED/REJECTED with `approvedBy`, `emergency`, `reviewDueAt`; launch-locked gates `FlagGateEvidence`; `FlagAudit`; `PolicySetting` | `GrowthConfigVersion` reuses the two-person pattern |
| 33 | Ops console pages to host Growth | EXISTS | routes in `KP/apps/ops/src/App.tsx`: providers, bookings, outbox, finance, moderation, liquidity, messaging, orders, fees, policy, operations, safety, held-deposits, home-gate, flags, onboarding, partner-onboarding, partner-leads | add Growth group |
| 34 | Feature flags control plane | EXISTS | `KC/flags/catalogue.json` (57 keys, ADR-023/024/025); `kiorex.sponsored_listings`, `kiorex.whatsapp_booking`, `kiorex.ai_navigation`, `clinic.referral_rewards` already exist | add `growth.*` keys |
| 35 | Outbox and event contracts | EXISTS | `KC/events/index.json` (44 event types; naming mix: SCREAMING_SNAKE for Kiorly appointment events, PascalCase for Rev 2.3 events, dotted for Passport/control plane); `KP` `OutboxEvent`, `WebhookReceipt` | growth events additive; no growth event exists |
| 36 | Sponsored placement | PARTIAL | `sponsored` labelling in `KP/apps/api/src/catalog/*`; flag `kiorex.sponsored_listings` (launch after liquidity per KX-03) | not a growth P1 item |
| 37 | Third-party ad/analytics integrations (Google Ads, GA4, Search Console, Meta, TikTok, Play Console, App Store Connect) | ABSENT | none; FCM/APNs, WhatsApp, SMS, email exist as mock-first adapters (`MODE=mock|real`, FD-04) | adapter ports and PHI-free conversion payloads |
| 38 | i18n AR/EN RTL | EXISTS | i18next in all webs, `lang`/`dir` handling in `index.html`, Kiorex `rtl-flip` utilities | locale-aware public routes |
| 39 | Pharmacy / lab / nurse acquisition | ABSENT | flags `kiorex.pharmacy_orders`, `kiorex.lab_bookings`, `nurse.individual_kiorex_listing` (launch-locked GKN2); partner onboarding wizard (ADR-040) covers supply connection | Phase 4 |
| 40 | Corporate programmes and loyalty | ABSENT | KX-14 §05 lists employers and insurers (M15) | Phase 4 |

**Counts: EXISTS 11, PARTIAL 14, ABSENT 15 (total 40 rows; rows 5, 18 and 19 are also CONFLICT). Row lists are in §3.**

## 3. Tally

- EXISTS (11): rows 4, 11, 12, 22, 24, 25, 26, 33, 34, 35, 38.
- PARTIAL (14): rows 1, 6, 8, 9, 13, 16, 17, 20, 21, 23, 27, 31, 32, 36.
- ABSENT (15): rows 2, 3, 5, 7, 10, 14, 15, 18, 19, 28, 29, 30, 37, 39, 40. Of these, 5 (widget vs frame-ancestors), 18 and 19 (SPA vs SEO promise) are also CONFLICT items, detailed in §5.
- CONFLICT/DEBT register: 18 items in §5 (C1 to C18).

## 4. Existing assets worth reusing, with the exact seams

| Seam | Where | Use for growth |
|---|---|---|
| Slug namespace | `CM/.../booking-slug.ts` plus unique `bookingSlug` on Clinic and MarketplaceListing | provider link identity; extend with link records, keep the reserved list (`admin api app b book kiorex kiorly login public www`) and add growth-reserved words |
| Public page cache | `public-booking-page.controller.ts` `Cache-Control: public, max-age=60, stale-while-revalidate=300` | pattern for cached public JSON |
| Idempotent booking | Kiorex `BookingIntent.id` is the Kiorly Idempotency-Key and `externalReference` | attribution decision keyed by booking id gives idempotency for free |
| Partner HMAC | `KP/apps/api/src/common/hmac.ts`, `kiorex-contracts/src/hmac.ts`, Kiorly `marketplace-hmac.ts` | sign provider link tokens and the attribution block |
| Partner registry and signed intake | `PartnerRegistration`, `PartnerConnection`, `PartnerLead` signing (`partner-leads/lead-signing.ts`) | sign widget and link claims; domain allowlist sync |
| Rate limiting | `RateLimitBucket` | public touch endpoint limits without Redis |
| Flags with market and org scope | control plane | every growth capability ships ON and can be switched OFF (ADR-023); OFF returns 403 FEATURE_DISABLED |
| PHI guard | `detectPhi` in `KP/src/safety`, notification layer PHI guard | reject patient identifiers in ad-platform payloads and event props |
| Erasure | `subject.deleted` event from Passport | erase visitor/touchpoint rows tied to a `sub` |
| Quiet hours | `NotificationPreference.quietStart/quietEnd` | already per channel; reuse |
| Ops audit | `AuditLog` (KP) with `actor, action, resource, metadata` | audit growth config changes |
| Test discipline | `no-tax-authority.unit.spec.ts`, `module-boundaries.unit.spec.ts` | add `no-health-targeting.unit.spec.ts` and `growth-no-phi.unit.spec.ts` |

## 5. Conflicts and debt (as-built versus approved docs and the new requirement)

| ID | Conflict / debt | Evidence | Resolution proposed in Architecture doc |
|---|---|---|---|
| C1 | Patient web is a client-only SPA but KX-14 promises indexed provider profiles and local SEO | `KP/apps/web/index.html`, `App.tsx` | D-SEO-1 hybrid SSR for public routes |
| C2 | `frame-ancestors 'none'` on every product versus embeddable widgets | `KA/config/domains.json` `frameAncestors`; KX-08 §host security | new origin and ADR (D-WID-1) |
| C3 | Anonymous-only analytics rule versus attribution funnel | `analytics.service.ts` header comment; KX-03 §07 | consent-gated pseudonymous `visitorId` in a separate table; keep the old endpoint unchanged |
| C4 | Domains: KX-19 §03 lists `app.kiorly.com`, `nurse.kiorly.com`, `kiorly.link`, `kiorex.com` (AR/EN via `/ar`, `/en`); the as-built `domains.json` (ADR-038) lists `clinic.kiorly.com` (with `app.kiorly.com` as alias), `www.kiorly.com` home, `api.clinic.kiorly.com`; KX-19 says `api.kiorly.com`; neither file lists `kiorex.com` patient web or `kiorly.link` | `KX-19` table vs `KA/config/domains.json` | domains.json becomes the single source for growth hosts too (add `patient`, `link`, `widget`); KX-19 amended by KX-27 |
| C5 | KX-19 says Marketing in paths and apps on subdomains (ADR-019) but SEO pages for patients (`kiorex.com`) are not in the host table | KX-01 ADR-019 | canonical host `kiorex.com`, locale and market in path |
| C6 | `kiorly.link/<slug>` is documented as the commission-free short link (KX-03 KXMBK10, KX-14, KX-19) but code serves `${APP_WEB_URL}/b/<slug>`; NH-008 open | `clinic-booking-page.service.ts` | wire kiorly.link as redirect host; `/b/` stays the canonical page |
| C7 | Kiorex `Provider` URL is an opaque cuid `/doctors/:id` | `DoctorCard.tsx` | slug table plus 301 |
| C8 | `BookingSource` has no value for "provider-led but booked through the marketplace" and `KIOREX_WHATSAPP` is only sent when `KIORLY_ACCEPTS_WHATSAPP_CHANNEL` is on (feature toggle in code, KP `cfg().kiorlyAcceptsWhatsappChannel`) | `booking.service.ts` | add an orthogonal `acquisitionOrigin` instead of new enum values |
| C9 | Event naming is inconsistent across contracts | `KC/events/index.json` | growth events use PascalCase (matches the founder's list and Rev 2.3) with a `growth.` topic prefix on the outbox type; no rename of old events |
| C10 | Name collision `ReferralIssued` (clinical) and `Referral` model (SaaS doctor-to-doctor) versus patient referral | contracts, `schema.prisma` line ~1009 | growth uses `PatientReferral*` and `ProviderReferralLink*` |
| C11 | Consent text is a placeholder: `ConsentRecord.version default "TODO_NEEDS_HUMAN_v0"` | `KP schema.prisma` | legal wording NEEDS_HUMAN before any marketing send |
| C12 | `PolicySetting` is not versioned or effective-dated, so it cannot hold attribution windows or reward rules that must be reproducible | `KP schema.prisma` model `PolicySetting` | new `GrowthConfigVersion` (immutable versions) |
| C13 | Clinic notification-layer adoption is "Planned (step 5)", so marketing sends from Kiorly Clinic would bypass KX-24 | KX-24 §07 | Phase 1 and 2 growth messaging is sent from Kiorex Engagement only (patient-delivery owner rule, KX-24 §08.1); clinic-side recall stays on its current consent gate |
| C14 | Google Fonts are loaded render-blocking from `fonts.googleapis.com` in `index.html`, bad for LCP and a third-party data transfer | `index.html` | self-host fonts in the public SSR pages |
| C15 | KX-13 has no acquisition-channel model; KX-14 §07 targets are "attended visits", not new patients | KX-13, KX-14 | KX-13 update inputs in the Architecture doc §17 |
| C16 | KX-14 §09 budget lines (Patient acquisition 30%, Content and SEO 12%) have no unit economics per channel | KX-14 | channel CAC inputs |
| C17 | Pharmacy, lab and Passport have no growth surface; `kiorly-pharmacy` and `kiorly-lab` are scaffolds with notification and consent registries still to adopt KX-24 | KX-24 §07 | Phase 4 |
| C18 | `_docs/rev23` KX-24 states "Drive KX24 draft says Rev 2.4" (Q17 open); document revision labels are inconsistent | KX-01 Q17 | not a growth issue; record only |

## 6. Document inventory (repo and Google Drive)

Repo set: `_docs/rev23/KX-00..KX-26.md` (27 files). The `_docs/KX-*.md` copies in `_docs/` are the earlier Rev 2.3 extraction (KX-00..KX-24; `rev23` additionally has KX-25 and KX-26). Drive: the "Kiorex v2" folder (id `1Pk__yq04TSGzWwAsiWQB--bVgu8WGd_L`) holds the PDFs below in numbered subfolders (`00 Executive & Governance`, `06 Kiorly`, etc.). Last-modified times are from the Drive API; the latest revision for each is the one with the newest `modifiedTime`. Where two files have the same name I list both and mark the older as superseded (I did not open them; the duplicates are KX-01, KX-13, KX-21, KX-22 in different folders).

| Doc | Drive file (latest) | Drive modified | Repo copy | Note |
|---|---|---|---|---|
| KX-00 Master Blueprint | [link](https://drive.google.com/file/d/1z1fwrJuJ5q4UeoWxevba-aQddMfnXOTy/view) | 2026-11-23 22:34 | `_docs/rev23/KX-00_Master_Blueprint.md` | |
| KX-01 Decision Log and ADRs | [link](https://drive.google.com/file/d/1a13mxMhxF7XAuZ0YG485CZhijGDW9YXl/view) | 2026-11-23 22:34 | `rev23/KX-01...` includes ADR-040 (24 Nov) | Drive PDF predates ADR-040 text in repo (Drive last modified 23 Nov 22:34, repo ADR-040 is dated 24 Nov). Older duplicate [1UUDU4...](https://drive.google.com/file/d/1UUDU4pfGDad_L86v6UZL5h7tvsiDYeTA/view) 22 Nov |
| KX-02 Ecosystem Business Requirements | [link](https://drive.google.com/file/d/1YCnxmSbm-JIp0pu8iEm_F2XAINqyXAEr/view) | 2026-11-23 22:33 | yes | |
| KX-03 Kiorex Marketplace PRD | [link](https://drive.google.com/file/d/1jyq4wTn3bBW4xEahE3-crbpZwrJB18o7/view) | 2026-11-23 22:19 | yes | |
| KX-04 Account Identity PRD | [link](https://drive.google.com/file/d/1yBWJ39HQkbeYBohg41bvLBMGyGeSKK6s/view) | 2026-11-23 22:20 | yes | |
| KX-05 Kiorly Clinic PRD | [link](https://drive.google.com/file/d/1JIhEl6TDzm69GR9lZLFpwUTH66mMtrVY/view) | 2026-11-23 22:21 | yes | |
| KX-06 Pharmacy PRD | [link](https://drive.google.com/file/d/16xpvUfI-F2iI1IR6lk461_o6B0qIcsRw/view) | 2026-11-23 22:21 | yes | |
| KX-07 Lab PRD | [link](https://drive.google.com/file/d/1sPyClcmk-Yxo3TgKsYq7kE-Pzxv490Al/view) | 2026-11-23 22:22 | yes | |
| KX-08 Target Architecture | [link](https://drive.google.com/file/d/1pWD0uuBmwphBVzkEpvhvN9K_nweiKlKX/view) | 2026-11-23 22:24 | yes | |
| KX-09 Integration Contracts, Events, Money Flows | [link](https://drive.google.com/file/d/1Mv-2QVdv7TfPap3a2BnVfw2gcLpbotn5/view) | 2026-11-23 22:24 | yes | |
| KX-10 Platform DevOps Security | [link](https://drive.google.com/file/d/1nvTvP6tei2htg2HKuWWIxRPnzqQUTmio/view) | 2026-11-23 22:25 | yes | |
| KX-11 AI Strategy | [link](https://drive.google.com/file/d/1LYFxWtIA7exJ_T40E_pR-QzOB1AnH2un/view) | 2026-11-23 22:30 | yes | |
| KX-12 Monetization Pricing | [link](https://drive.google.com/file/d/1hTRK4WdabuUHyCHl8NvsTWfpXADeOMyA/view) | 2026-11-23 22:27 | yes | |
| KX-13 Financial Model | [link](https://drive.google.com/file/d/1FBBBnCWZ4RlIY71XahyLPRwTTbvFVHdf/view) | 2026-11-23 22:27 | yes | older duplicate [14JZjg...](https://drive.google.com/file/d/14JZjgNr0A8rTS_Cv4lD9pea-jpmkDnFT/view) 22 Nov |
| KX-14 GTM and Marketing Plan | [link](https://drive.google.com/file/d/1y50CZ9gxFGp8e-pzGTWwX2INUCWfchVJ/view) | 2026-11-23 22:28 | yes | |
| KX-15 Risk and Compliance | [link](https://drive.google.com/file/d/189VvrWvsSTnBwRpDHdGVuXSYkjx7YXZU/view) | 2026-11-23 22:29 | yes | |
| KX-16 Clinical Safety | [link](https://drive.google.com/file/d/1tK0CiOSRABzHtwlzT5D5eH4SXqWiWEb5/view) | 2026-11-23 22:29 | yes | |
| KX-17 Launch Readiness | [link](https://drive.google.com/file/d/1E_k-LfPno58jm3Ljiuj1jhTaWlSwbG1_/view) | 2026-11-23 22:31 | yes | |
| KX-18 36-Month Roadmap | [link](https://drive.google.com/file/d/1agB72kMlqgTC4JTaiu3UhEanK_YF792e/view) | 2026-11-23 22:31 | yes | |
| KX-19 Brand, Domains, Store Accounts | [link](https://drive.google.com/file/d/1aTb7g8qsYtcLMTS1muWTRHCXfQKTluxs/view) | 2026-11-23 22:32 | yes | domain table is stale vs ADR-038 |
| KX-20 Investor Brief | [link](https://drive.google.com/file/d/1l3JjCKl-DuU5ZpSh1pISynrLCOqpQY0W/view) | 2026-11-23 22:30 | yes | |
| KX-21 AWS Hosting | [link](https://drive.google.com/file/d/1qBB59VYAV9hRKsQ0iE-vN46lyqc4qgq0/view) | 2026-11-23 22:25 | yes | older duplicate [1NOKb0...](https://drive.google.com/file/d/1NOKb0kS8LsFWRzD1JYvc4LyeLnVqW7q1/view) 22 Nov |
| KX-22 Repo Map and Build Agent Handoff | [link](https://drive.google.com/file/d/1OlpA3ZW_PMWzNNHQOYBQLgKZx_aV36tQ/view) | 2026-11-23 22:25 | yes | older duplicate [1HYpuk...](https://drive.google.com/file/d/1HYpuko1UtD5ANnD9130XrReEd9Ljak_j/view) 22 Nov |
| KX-23 Kiorly Nurse PRD | [link](https://drive.google.com/file/d/1KmhUM-11TEpgqAQfD-loqUbv0s3YUnCm/view) | 2026-11-23 22:22 | yes | |
| KX-24 Notifications and Messaging | [link](https://drive.google.com/file/d/1rq8mtVnxcpp3o0rPzv9ejk5wQ4gnug5W/view) | 2026-11-23 22:26 | yes | KX-01 Q17: Drive draft label "Rev 2.4" vs repo numbering |
| KX-25 Document Storage Growth and Retention | [link](https://drive.google.com/file/d/1zh3hiNesJ4ZWVMinFMVtwiKX6i0bJO3N/view) | 2026-11-23 22:23 | yes | "Growth" here means storage growth, not acquisition |
| KX-26 System Architecture Reference | [link](https://drive.google.com/file/d/1eohhBfSpcGzH07-mpRGH_wQsLUMLzBlR/view) | 2026-11-23 22:23 | yes | read-only (cannot edit) in Drive |

All file ids were copied from the Drive API (`search_files`) results and the two earliest-doubt rows (KX-05, KX-14) were re-queried and confirmed.

Drive documents that are not KX volumes and exist in the broader "Kiorex" folder (read-only awareness, not opened): `Kiorex_Investor_Pitch.pptx` (27 Jun 2026), `Kiorex_Comprehensive_PRD.docx` (28 May 2026), Google Docs "01 Kiorex Marketplace V2 PRD" and "03 Kiorly, Pharmacy & Laboratory SaaS PRD" (19 Nov 2026), a spreadsheet "Accounts" (19 Nov 2026), and the October 2025 PDFs (AI governance, financial model and GTM strategy, risk and compliance, technical architecture, roadmap, BRD). These predate Rev 2.3 and are superseded by KX-00..26; I did not mine them. **No Drive document about growth, SEO, attribution or acquisition engines was found** (search of titles and full text for Kiorex, Kiorly and Growth outside `KX-` returned only the above).

### Numbering
- Next free volume: **KX-27**. Proposed: KX-27 "Growth & Patient Acquisition Architecture" (this work, final form) and KX-28 "Growth Operations and Egypt GTM Playbook" (optional split).
- ADRs: last is **ADR-040**. ADR-039 is not present in the repo KX-01, in `CLAUDE.md`, or in any doc grep (searched `ADR-039`/`ADR039`, zero hits). Either it was reserved or lives only in Drive: **verify in the Drive KX-01 PDF before assigning**. Growth ADRs proposed starting at **ADR-041**.
- Founder decisions: last FD-20; next FD-21. Needs-human: clinic NH-040; Kiorex `Docs/NEEDS_HUMAN.md` numbering not checked.

### Stale or conflicting statements to fix when KX-27 is written
1. KX-19 §03 hostnames versus `config/domains.json` (C4 above): `app.kiorly.com` vs `clinic.kiorly.com`; `api.kiorly.com` vs `api.clinic.kiorly.com`; missing `kiorex.com` rows in the JSON.
2. KX-14 §05 says "Every provider shares kiorly.link/<slug>" but the code default is `${APP_WEB_URL}/b/<slug>`.
3. KX-03 KXMBK10 says the widget is "embedded on kiorly.link/<slug>"; code puts only a link to a widget URL.
4. KX-08/KX-19 say "Kiorex web at kiorex.com, AR/EN via /ar and /en paths" but the SPA has no locale in the URL (language in `localStorage` key `kx-lang`).
5. KX-24 §01 non-goal "marketing campaigns" versus the new requirement: add an explicit scope line in KX-24 revision.
6. KX-12/KX-02 BR12 "referral reward: one free month for both sides" is provider-only; patient referral has no BR number.
7. Country cells: KX-21 §04 lists cells `frankfurt` (live) and `cairo` (`me-south-1`, prepared). Regional API bootstrap is not implemented anywhere (market resolution is a flag lookup).
8. KX-14 §07 states attended Kiorex visits per month (2,900 at M6; 13,667 at M12), while the commission engine charges new patients only; the two series are never reconciled (see Architecture doc §17).

## 7. Regulatory facts checked
- Egypt PDPL Law 151 of 2020: direct electronic marketing needs the data subject's approval and sender identity; a registry of approvals must be kept; a licence is reported for direct electronic marketing (Article 28 per practitioner commentary); executive regulations were reported as issued in 2025 with a one-year compliance period (decision number reported as 816 of 2025 by several sources; one source gives a different number). The legal position is secondary information from law-firm notes (links in the Competitive Research doc); counsel must confirm. Marked NEEDS_HUMAN.
- No tax-authority work is touched by this scope (ADR-011).
