# Growth & Patient Acquisition Engine: Architecture Decisions

Status: PROPOSED (nothing here is accepted until the founder signs the ADRs in §22). Date 24 Nov 2026. Inputs: `GROWTH_DISCOVERY.md` (as-built inventory) and `GROWTH_COMPETITIVE_RESEARCH.md`.

Convention in this file: **[AS-BUILT]** verified in code or docs, **[PROPOSED]** design, **[NEEDS_HUMAN]** a person must decide or sign, **[ASSUMPTION]** a number I chose and that must be validated.

## 1. Constraints this design must respect (existing ADRs and rules)

| Source | Rule | How the design respects it |
|---|---|---|
| ADR-001/002 | Every Kiorly product works without Kiorex | Provider links, QR, widget configuration, link counters and the clinic-side attribution fields live in Kiorly Clinic and work for a STANDALONE org; Kiorex-side evidence is additive |
| ADR-004/005, KX-22 §11 | Clinic is the only system of record for appointments; products never share a DB or import each other's source; talk by HMAC REST plus outbox via versioned contracts | New cross-product data is an additive field in existing payloads (contracts 1.10.0), never a shared table |
| ADR-007 | Flat fee per attended new patient (EGP 40 placeholder) | Attribution decides *whether* the fee applies; amount logic is untouched |
| ADR-011 | No tax-authority integration | Not touched; reward/credit accounting notes flag counsel, not ETA |
| ADR-019 | Marketing in paths, apps on subdomains, `kiorly.link` for booking links | Canonical patient SEO on `kiorex.com/{locale}/{cc}/...`, provider links on `kiorly.link` |
| ADR-023/024/025 | Every capability ships ON, switchable OFF at global/market/org scope; launch-locked flags need human gate evidence; safety controls are never flags | New `growth.*` flags; marketing sends are never a safety path; emergency/safety messaging bypass is untouched |
| ADR-026/028 | `_legacy` read-only; OpenTofu only; no `@aws-sdk/*` outside adapters | No legacy copy; any CDN/SSR infra goes through `modules/aws/*` with `tofu validate` only, no apply |
| ADR-034/035 | One notification layer package, product-owned delivery; provider adapters with `MODE=mock|real` | All growth messages go through the layer; all integrations are mock-first adapters |
| ADR-038 | `config/domains.json` is the single host table | Growth hosts are added there |
| ADR-040 | Connect to Kiorex wizard, Kiorex tab front door, partner leads and funnel | Growth workspace extends the Kiorex tab; supply-side funnel is reused as-is |
| FD-04 | Providers and messaging are mocked until the pre-launch pass | Every growth integration defaults to `MODE=mock` |
| CLAUDE.md | No PHI in logs or analytics; AR+EN with RTL; stop for prices, legal wording, consent wording | See §19 and the NEEDS_HUMAN list in the work-packages file |

## 2. The ten headline decisions

| # | Decision | Proposed ADR |
|---|---|---|
| D1 | **No new microservice, no Redis, no Kafka.** Growth is a module family inside the two modular monoliths (Kiorex API `apps/api/src/growth`, Kiorly Clinic API `apps/api/src/growth` which already exists for supply-side referral). Queues are the existing Postgres outbox. Rate limiting stays on the shared Postgres limiter. | ADR-041 |
| D2 | **Split of ownership.** Kiorly Clinic owns provider-owned assets and the money outcome (referral links, QR, widget configuration, `Appointment` attribution fields, `CommissionDecision`, commission charge and disputes). Kiorex owns demand-side evidence (touchpoints, visitor identity under consent, attribution decision, SEO pages, campaigns, patient referral, rewards, lifecycle messaging, analytics). They exchange one signed attribution block on the existing booking call. | ADR-041/042 |
| D3 | **Attribution is a deterministic pure function** of (booking, touchpoint evidence, versioned policy) producing an immutable `AttributionDecision` with reason codes and an input hash. Provider-led versus Kiorex-acquired is decided *only* by that function plus the existing 24-month new-patient rule at the clinic. Default precedence `PROVIDER_FIRST`. | ADR-042 |
| D4 | **Commission stays clinic-side and additive.** `isCommissionChargeableBooking` gains one more input (`acquisitionOrigin`); `BookingSource` enum values are not added or renamed. A `CommissionDecision` row (append-only) records why a fee was or was not applied. | ADR-042 |
| D5 | **Canonical patient URL**: `https://kiorex.com/{locale}/{cc}/{type}/{slug}` with `locale in {ar,en}`, `cc` lowercase ISO market (`eg`), ASCII slugs, 301 from legacy `/doctors/:id`. Provider links stay on `https://kiorly.link/<slug>` plus `/q/<code>` for QR. | ADR-043 |
| D6 | **SEO rendering: hybrid SSR for public routes only**, implemented as a role of the existing Kiorex API image (Vite SSR bundle + React 19 streaming), cached by CloudFront with stale-while-revalidate; the logged-in SPA stays a SPA. No Next.js migration. | ADR-043 |
| D7 | **Widgets run on a dedicated origin** (proposed `book.kiorex.com`, NEEDS_HUMAN) whose CSP `frame-ancestors` is generated per request from an exact-origin allowlist; every other host keeps `frame-ancestors 'none'`. | ADR-044 |
| D8 | **Analytics privacy**: server-side operational events are always allowed; a pseudonymous `visitorKey` is created only after analytics consent (or carried inside a signed booking token for the commission evidence, which is contractual necessity); specialty and provider never join the visitor stream; reports use k-anonymity (k >= 10). The existing anonymous `/analytics/events` endpoint is unchanged. | ADR-045 |
| D9 | **Rewards are closed-loop, non-transferable, non-cashable discount credit** held in a new append-only reward ledger (a fourth ledger, never commingled with Pay, deposit or SaaS credit ledgers). No stored-value wallet; counsel must clear it before Phase 2 ships. | ADR-046 |
| D10 | **Growth configuration is versioned data**, not code or `PolicySetting`: immutable `GrowthConfigVersion` with scope, effective dates, maker-checker and rollback-by-new-version; secrets only by reference. | ADR-047 |

## 3. Repository and module ownership

| Concern | Repo and path | Phase | Notes |
|---|---|---|---|
| Growth core API (touch, decision, events, config, SEO data, consent extension) | `kiorex-platform/apps/api/src/growth/**` (new) | 1 | Imports only `*-public.ts` barrels of other modules (existing `module-boundaries.unit.spec.ts` enforces) |
| Public SEO site (SSR role, sitemap, robots, structured data) | `kiorex-platform/apps/api/src/public-site/**` (new) plus `kiorex-platform/apps/web/src/public/**` (shared React components) and `apps/web/vite.config.ts` (SSR build) | 1 | A deploy role of the same image |
| Widget app and SDK | `kiorex-platform/apps/widget/**` (new workspace, small Vite app) | 1 | Added to root `workspaces` |
| Ops Growth pages | `kiorex-platform/apps/ops/src/pages/Growth*.tsx` and route entries in `apps/ops/src/App.tsx` | 1 | |
| Patient app deep links, consent screens | `kiorex-platform/apps/mobile/**` | 1 | |
| Provider links, QR, widget config, growth workspace UI | `clinics-management/apps/api/src/growth/**` (extend existing folder), `apps/web/src/features/growth/**` (new) | 1 | Branch `kiorex`; no push without founder approval (FD-18) |
| Commission attribution (decision, chargeability) | `clinics-management/apps/api/src/appointments/booking-attribution.ts`, `src/kiorex/**` | 1 | |
| Staff app Growth tab | `kiorly/app/(tabs)/**`, `kiorly/src/**` | 1 (thin) | Backends are `/mobile/*` in the clinic API |
| Contracts (OpenAPI, event schemas, flags) | `kiorex-contracts/**` | 1 | Additive minor 1.10.0 |
| Host table and app-link files | `kiorex-account/config/domains.json`, `config/app-links/*`, test `apps/dev-idp/test/domains.test.ts` | 1 | |
| Pharmacy and lab growth | `kiorly-pharmacy`, `kiorly-lab` | 4 | scaffolds today |

## 4. Hosts and canonical URL convention (reconciled with KX-19 and `domains.json`)

[AS-BUILT] `config/domains.json` has no `kiorex.com` patient host and no `kiorly.link`; KX-19 §03 lists both. [PROPOSED] add to `domains.json` (all environments): `patient` (`https://kiorex.com`; staging placeholder `https://www.staging.kiorex.com`, NEEDS_HUMAN), `link` (`https://kiorly.link`), `widget` (`https://book.kiorex.com`, NEEDS_HUMAN host name), and `api.kiorex` (`https://api.kiorex.com`, already in KX-19). Cookie policy unchanged: host-only cookies, never `Domain=.kiorex.com`.

### 4.1 Patient SEO URLs (Kiorex)

`https://kiorex.com/{locale}/{cc}/{path}`; locale `ar|en`; cc lowercase.

| Page | Path (after locale/cc) | Indexable rule |
|---|---|---|
| Home | `/` | yes |
| Specialty in city | `/doctors/{specialty}/{city}` e.g. `/ar/eg/doctors/cardiology/cairo` | yes if >= `minLiveProviders` (default 3) LIVE with slots |
| Specialty in district | `/doctors/{specialty}/{city}/{district}` | same threshold, evaluated at district level, else `noindex,follow` and not in sitemap |
| Care type in district | `/home-nursing/{city}/{district}`, `/physiotherapy/{city}/{district}` | same; nurse pages additionally gated by flag `nurse.individual_kiorex_listing` effective (GKN2) |
| Specialty hub | `/doctors/{specialty}` | yes |
| Doctor | `/doctor/{slug}` | yes if LIVE |
| Clinic | `/clinic/{slug}` | yes if >= 1 LIVE doctor |
| Pharmacy / Lab | `/pharmacy/{slug}`, `/lab/{slug}` | yes if registry LIVE (flags `kiorex.pharmacy_orders`/`kiorex.lab_bookings` effective); Phase 4 |
| Static company/help | `/about`, `/help/{article}`, `/safety` | yes |
| Search results, checkout, appointments, records, account, visit-status | existing SPA routes | `noindex` and `Disallow` |

Rules:
1. Slugs are lowercase ASCII `[a-z0-9-]`, 3 to 60 chars, one namespace per market per entity type, **identical in AR and EN**; Arabic names appear in `<title>`, `<h1>`, content and structured data. Rationale: transliteration is stable, URLs stay shareable in WhatsApp, and one slug avoids a second history table.
2. Source of truth: Kiorly `bookingSlug` is reused as the *default proposal* for the Kiorex slug (reserved words and pattern in `booking-slug.ts` stay), but Kiorex owns `growth_slug` plus `growth_slug_history` so a provider renaming their Kiorly link does not change the SEO URL silently. Old slugs 301 to the current one; history is never deleted while the entity exists.
3. Canonical is always the clean URL, absolute, without query parameters. The only allowed query keys that change content: `page`, `sort`, `lang`-free; everything else (`utm_*`, `gclid`, `fbclid`, `s`, `ref`) is stripped from the canonical and from the CDN cache key and is consumed by the first-party touch endpoint.
4. `hreflang`: each page lists `ar`, `en` (and `ar-EG`/`en-EG` only if a second market makes regional variants necessary), self-referencing, reciprocal, fully qualified, plus `x-default`. Mirrored in the sitemap with `xhtml:link` (Google's localized-versions guidance, accessed 24 Nov 2026).
5. Root `/` : while one market is live, 301 to `/ar/eg/`. When more than one market is live, `/` becomes a 200 market/locale selector and the `x-default` target. This matches the rule that selectors are hidden until more than one market is live.
6. Legacy `/doctors/:id` (SPA, cuid) 301 to `/{locale}/{cc}/doctor/{slug}`; locale from `kx-lang` cookie else Accept-Language else `ar`.
7. Sitemaps: `/sitemap.xml` index, shards by type and market and locale, <= 10,000 URLs per file (well under Google's 50,000/50 MB), `lastmod` = real provider-profile change time, regenerated within 15 minutes of a `LISTING_STATUS_CHANGED` or `PROVIDER_PROFILE_UPDATED` event. `robots.txt` references the index and disallows private routes; **robots is not a privacy control** (private pages also send `X-Robots-Tag: noindex` and require auth).
8. Lifecycle: LIVE = 200 indexable. PAUSED or temporarily ineligible = 200, `noindex`, booking CTA replaced by "not accepting bookings". DELISTED = 301 to the specialty-city hub when one exists, else 410 after 30 days.
9. Thin-page guard (no doorway pages): a generated page is indexable only if it passes the guard: `liveProviders >= minLiveProviders`, at least `minUniqueBlocks` data-derived blocks (counts, median fee range, next available slot, languages, rating distribution, neighbouring districts) and no more than `maxSiblingSimilarity` overlap with a sibling page's provider list (default 70%). Otherwise `noindex,follow` and no internal links from navigation. This follows Google's doorway and scaled-content policies (accessed 24 Nov 2026) and the KX-14 promise of "local SEO ... in Arabic".
10. Never indexed: anything authenticated, visit-status tokens, record shares, addresses, home-visit provider home locations (districts only, KXMDS05), patient review text beyond what the review module already publishes after moderation.

### 4.2 Provider links (Kiorly)

| Form | URL | Behaviour |
|---|---|---|
| Public page (existing) | `https://kiorly.link/<slug>` (today `${APP_WEB_URL}/b/<slug>`) | clinic-branded page `GET /public/booking-pages/:slug`; commission-free channel |
| Tracked variant | `https://kiorly.link/<slug>?s=<code>` | `s` = `ProviderReferralLink.code` (8 chars, Crockford base32 without I L O U); validated server-side; unknown code is ignored |
| QR short form | `https://kiorly.link/q/<code>` | 302 to the tracked variant; shorter payload = less dense QR |
| Desk/branch | same, `ownerScope` DESK or BRANCH | |
| Booking | page loads the widget (D7) with a signed token `lt` carrying `{org, link code, ts}` | |

QR rules: server-side SVG, error correction M, 4-module quiet zone, no third-party QR service (privacy), static content (the code is the only variable), print kit A4/A5 AR/EN (KX-14 §05).

Open-redirect protection: `kiorly.link` never redirects to a caller-supplied URL. It resolves `slug` or `code` to an entity and redirects only to hosts in `domains.json`. The `open` route for apps accepts `route-key:id` pairs (`doctor:<slug>`), never URLs.

## 5. SEO rendering strategy

[AS-BUILT] `kiorex-platform/apps/web` is a Vite 8 SPA, React 19, `react-router-dom` 7 `BrowserRouter`, static `index.html` (title, description, `lang="ar" dir="rtl"`, render-blocking Google Fonts), no `robots.txt`, no sitemap, no JSON-LD, ids not slugs. Googlebot can render JavaScript but a client-only SPA is slow to index, unreliable for per-page metadata, poor for Core Web Vitals and invisible to non-Google crawlers and link-preview bots (WhatsApp, Facebook) that do not run JS. WhatsApp link previews matter for this business because provider links are shared on WhatsApp.

Options considered:

| Option | Verdict |
|---|---|
| A. Migrate patient web to Next.js | Rejected. Breaks the binding stack (Vite 8, TanStack Query, shadcn), large rewrite, second framework to secure |
| B. Pure client SPA plus a prerender service (Prerender.io style) | Rejected. Third-party data flow of provider content, cost, cloaking-adjacent risk, no control of status codes |
| C. Build-time static generation | Rejected for directory pages (slots and status change continuously); acceptable only for static content pages |
| D. **Vite SSR bundle served by the Kiorex API image in `ROLE=site`, cached at CloudFront** | **Chosen.** Reuses React components, i18n and TanStack Query hydration; no new framework; same image can scale separately by running a second container service later |

Design:
1. `apps/web` gets a second entry (`entry-server.tsx`) and `vite build --ssr`; public routes are defined once in a shared route table consumed by both entries.
2. Nest module `public-site` (Express 5 handler) renders with `renderToPipeableStream`, loads data through in-process service barrels (CatalogService, trust/reviews, GrowthSeoService), sets status codes (200, 301, 404, 410), `Link`, `Cache-Control`, `Vary: Accept-Encoding` only (locale is in the path, never in `Vary`), `ETag`.
3. Hydration is partial: header, search box and booking island hydrate; the rest is static HTML. Public route JS budget <= 120 KB gzip, fonts self-hosted with `font-display: swap` and preload of the primary Arabic subset (fixes C14).
4. CDN (`modules/aws/cdn-edge`, `tofu validate` only): behaviours `/{ar,en}/*`, `/sitemap*.xml`, `/robots.txt`, `/.well-known/*` go to the site role; `/api/*` to the API role; everything else (existing SPA assets and routes) unchanged. HTML cached 5 minutes at the edge with `stale-while-revalidate=3600`, doctor and clinic pages invalidated by a tag/path purge from the outbox consumer on `PROVIDER_PROFILE_UPDATED` and `LISTING_STATUS_CHANGED`. Cache key: path only, query whitelist `page`, `sort`.
5. Slots and prices on public pages are *indicative* ("next available" from `Provider.nextSlotAt`, already indexed) and the booking island fetches live slots; the HTML never promises a slot.
6. Fallback if SSR misbehaves: flag `growth.ssr_public_pages` OFF returns the existing SPA shell (still serves `robots.txt`/`sitemap`), so SEO regression never takes booking down.

Core Web Vitals targets (field, p75, mobile 4G, Egypt): LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 (Google's "good" thresholds; confirm current thresholds when building). Lab budget in CI (Lighthouse CI on three templates): performance >= 90, TTFB (cached) <= 200 ms, image weights with explicit width/height, avatar and clinic images through the existing storage path with responsive `srcset` (KX-25 storage rules apply).

Structured data (JSON-LD, one block per page, generated from the same data as the visible content; never data not shown to the user):

| Page | schema.org types | Notes |
|---|---|---|
| Doctor | `Physician` with `medicalSpecialty`, `knowsLanguage`, `priceRange`, `address` at district level only, `aggregateRating` only from verified reviews that are visible on the page | review snippet eligibility must be checked against Google's current review-snippet guidelines (NOT VERIFIED here) |
| Clinic | `MedicalClinic` (or `MedicalBusiness`), `openingHoursSpecification`, `geo` only for in-clinic sites | |
| Pharmacy / Lab | `Pharmacy`, `MedicalLaboratory` | Phase 4 |
| Listings | `ItemList` of provider URLs, `BreadcrumbList` | Vezeeta emits `BreadcrumbList` and `Physician` (observed 24 Nov 2026) |
| Home | `Organization`, `WebSite` with `SearchAction` | |

Forbidden in markup: phone numbers of individual doctors unless the provider opted in on the profile, home addresses, patient names, free-text reviews flagged by moderation, any health claim ("cures").

## 6. Attribution model

### 6.1 Concepts

- **AcquisitionSource**: a stable label `(sourceKind, sourceRef)`, e.g. `PROVIDER_LINK:<linkCode>`, `PROVIDER_QR:<code>`, `WIDGET:<widgetId>`, `ORGANIC_SEARCH:google`, `DIRECT`, `REFERRAL:<patientReferralCode>`, `CAMPAIGN:<campaignCode>`, `WHATSAPP:<entry>`, `OFFLINE:<enteredBy>`. Source taxonomy is config (Growth config version).
- **AttributionTouchpoint**: one immutable observation `(visitor or sub, source, occurredAt, landing kind, normalised UTM, referrer host, provider org if provider-owned)`.
- **AttributionDecision**: one immutable result per `bookingId` and per policy version.
- **Origin** (`acquisitionOrigin`): the commission-relevant class: `PROVIDER_LED`, `MARKETPLACE`, `UNATTRIBUTED`.
- **Reporting attribution** (separate): first touch, last touch, last non-direct touch pointers stored on the decision for analytics, never used for commission.

### 6.2 Identity and consent (what may be stored)

| Situation | Identity used | Legal handling [NEEDS_HUMAN counsel] |
|---|---|---|
| Visitor loads a provider link and goes straight to book (same browser session) | A signed, short-lived `lt` token (<= 30 min) carried in the widget/handoff, no cookie, no storage before consent. Stored on the booking intent only | Treated as the booking's own contractual data (the patient asked to book with that provider) |
| Visitor returns later (up to the window) | `visitorKey` cookie `kxv` (host-only, `Secure`, `SameSite=Lax`, 180 days max) created **only after analytics/attribution consent** | PDPL consent for non-essential identification (counsel to confirm) |
| Logged-in patient | Passport `sub` | linked to earlier visitor touches only with consent |
| No consent | Only the in-session `lt` token and the booking channel; the decision falls back to the explicit channel rule | accepted loss of cross-session provider credit, see §6.5 |

Stored never: IP address (a keyed hash with daily-rotating salt is used for rate limiting and fraud, kept 24 h), full user agent (browser family and platform class only), full referrer URL (host only, because query strings can contain search terms), unknown query parameters, device fingerprints, any health information, search text.

### 6.3 Windows (all configurable per market in `GrowthConfigVersion kind=ATTRIBUTION_POLICY`; values are [ASSUMPTION] defaults)

| Parameter | Default | Meaning |
|---|---|---|
| `providerTouchWindowDays` | 30 | provider link, QR, desk, widget, provider-owned deep link |
| `patientReferralWindowDays` | 30 | patient referral link click to registration or booking |
| `campaignClickWindowDays` | 7 | paid or owned campaign click |
| `campaignViewWindowHours` | 0 (view-through off) | |
| `visitorKeyMaxDays` | 180 | cookie lifetime cap |
| `newPatientLookbackMonths` | 24 | already exists, `Market.featureDefaults.newPatient.lookbackMonths` |
| `touchEvidenceRetentionMonths` | 25 | raw touches linked to a decision; unlinked touches 13 months |
| `minDwellMsForProviderTouch` | 1000 | a provider touch counts only if the landing page was actually rendered (not a bare redirect or prefetch) |
| `precedence` | `PROVIDER_FIRST` | alternatives `LAST_NON_DIRECT`, `FIRST_TOUCH` (reporting only) |

### 6.4 Deterministic decision algorithm (commission origin)

Input: `booking {id, orgId, clinicId, doctorId, createdAt, channel, sub?, visitorKey?, ltToken?}`, `touches` (those whose `occurredAt < booking.createdAt`, same visitorKey or sub, within window), `policy` (version `V`).

1. If `channel = CLINIC_LINK` or a valid `ltToken` for the same org is present: `PROVIDER_LED`, reason `EXPLICIT_PROVIDER_CHANNEL`. (Today's `CLINIC_LINK` rule is this special case.)
2. Else, filter provider-owned touches for the same `orgId` inside `providerTouchWindowDays` and with dwell >= `minDwellMsForProviderTouch`: if any exist and `precedence = PROVIDER_FIRST`: `PROVIDER_LED`, reason `PRIOR_PROVIDER_TOUCH`, evidence = the latest such touch. If `precedence = LAST_NON_DIRECT`: provider-led only when the latest non-direct touch is provider-owned.
3. Else, if a patient-referral touch exists in window: `MARKETPLACE`, reason `PATIENT_REFERRAL` (Kiorex-acquired; reward qualification continues separately).
4. Else, if any marketplace touch exists (search, SEO, campaign, direct app): `MARKETPLACE`, reason `MARKETPLACE_TOUCH`.
5. Else `UNATTRIBUTED`, treated as `MARKETPLACE` for chargeability because the booking came through Kiorex with no provider evidence, reason `NO_PROVIDER_EVIDENCE`.

Ties: within a class pick the touch with the greatest `occurredAt`, then smallest id (stable). The function is pure; the decision stores `policyVersionId`, `inputsHash = sha256(canonical JSON of booking subset and ordered touch ids with timestamps)` and `reasonCode`. Replaying the function on stored inputs must reproduce the stored result (CI property test, SLI "decision determinism 100%").

Chargeability at the clinic (extends `isCommissionChargeableBooking`):

```
chargeable = origin != PROVIDER_LED
          && isNewPatientAtBooking == true          // existing 24-month rule, frozen at booking
          && bookingSource in {KIOREX_MARKETPLACE, KIOREX_WHATSAPP, INTEGRATION}
          && !(bookingSource == CLINIC_LINK)        // unchanged
```

So provider-led protection is an *extra* way to be non-chargeable, never a way to charge more. A fee that would be charged today can only be removed by evidence, never added by this engine. (Any rule that charges more than today is a provider-terms change, NEEDS_HUMAN.)

### 6.5 Honest limits

Cross-session provider credit depends on the consent-gated visitor key and on a patient using the same browser or logged-in account. Without consent only same-session links count. This is a deliberate privacy trade, so the *explicit channel* rule (provider link opens the widget, books in that flow) carries most volume. The product should therefore steer providers to share links that book directly rather than "find us on Kiorex" mentions.

### 6.6 Immutability and audit

- `growth_touchpoint` and `growth_attribution_decision` are append-only: a DB trigger raises on `UPDATE` and `DELETE`; erasure runs through a `SECURITY DEFINER` function used by the `subject.deleted` consumer and the retention job, which writes an `AuditLog` row.
- Corrections create a new decision with `supersedesId`, `actor`, `reason`; the old row stays.
- Evidence is exportable per booking (`GET /growth/v1/evidence/:bookingId`, ops and the provider's own org on the clinic side) so a dispute can be resolved by reading facts, not by recomputing.

### 6.7 How it feeds the existing EGP 40 charge

[AS-BUILT] Charge lifecycle: booking stamped (source, new-patient) then check-in creates `KiorexCommissionCharge` PENDING with `rateId` and amount from `KiorexCommissionRate` (market, profession, location, specialty narrowing, `validFrom/validTo`), `disputeDeadline` (30 days default via market pack), CONFIRMED on completion or after 24 h (`AUTO_CONFIRM_MS`), billed monthly at max(subscription S, commission C). [PROPOSED] additions only:

1. Kiorex sends the attribution block on `POST /marketplace/v1/bookings` as an additive optional field `acquisition: { origin, decisionId, policyVersion, reason, evidenceHash, touch: { kind, ref, at } }` (contracts 1.10.0). Clinic validates the HMAC (existing), stores columns `Appointment.acquisitionOrigin`, `acquisitionDecisionRef`, `acquisitionPolicyVersion`, and keeps `attributionJson` for display. If absent (older Kiorex), origin = `UNATTRIBUTED` and today's rules apply unchanged (backwards compatible).
2. At check-in, `KiorexCommissionChargeService` calls the extended chargeability function; the `CommissionDecision` row (append-only, 1:1 per appointment, per policy version) stores `{origin, isNewPatient, bookingSource, rateId, amount, decision: CHARGE|NO_CHARGE, reasonCodes[], inputsHash}`. When no charge, no `KiorexCommissionCharge` is created (as today) but the decision row exists, so "why was I not charged" and "why was I charged" are both answerable.
3. New dispute reason `PROVIDER_LED_EVIDENCE` (enum addition). Auto-approval rule in `commission-dispute-auto.ts`: if the provider opens a dispute on a charge and Kiorex evidence (fetched via the signed partner API) shows a provider touch for that org in window that the original decision missed (e.g. consent was granted later), approve and write `CommissionAdjusted`.
4. Late evidence: a provider can add an *offline* source (`OFFLINE`, e.g. a printed card the patient brought) only before check-in and only with a staff user id; offline evidence is lower weight: it makes the decision `PROVIDER_LED` only when `allowOfflineEvidence` is ON in policy and is sampled in audit.
5. Reversal path unchanged (`COMMISSION_CHARGE_REVERSED`).
6. Reporting to providers: the Kiorex tab dashboard shows "booked through your links: N (no fee), through Kiorex: M (fee applies to new patients)" from decisions.

## 7. Logical entities mapped to existing tables or new tables

Schema names are proposals; Prisma models follow the existing naming (PascalCase model, `@@map` snake case is not used today, so models stay PascalCase). "KP" Kiorex DB, "CM" Clinic DB.

| Logical entity | Class | Home | Table or change | Phase |
|---|---|---|---|---|
| GrowthCampaign | NEW | KP | `GrowthCampaign` | 2 |
| CampaignChannel | NEW | KP | `GrowthCampaignChannel` | 2 |
| CampaignBudget | NEW | KP | `GrowthCampaignBudget` (caps, spent, threshold events) | 2 |
| AcquisitionSource | NEW | KP | `GrowthAcquisitionSource` (taxonomy) | 1 |
| AttributionTouchpoint | NEW | KP | `GrowthTouchpoint` (append-only) | 1 |
| AttributionDecision | NEW | KP | `GrowthAttributionDecision` (append-only) | 1 |
| ProviderReferralLink | NEW | CM | `ProviderReferralLink` + `ProviderReferralLinkDaily` (visits, bookings counters) | 1 |
| PatientReferralLink | NEW | KP | `PatientReferralLink` | 2 |
| ReferralRelationship | NEW | KP | `PatientReferralRelationship` (referrer sub, referee sub, status) | 2 |
| ReferralQualification | NEW | KP | `PatientReferralQualification` (attended visit, no refund, delay passed) | 2 |
| RewardProgram | NEW | KP | `RewardProgram` | 2 |
| RewardRule | NEW | KP | `RewardRule` (versioned via config) | 2 |
| RewardLedgerEntry | NEW | KP | `RewardLedgerEntry` (append-only, idempotency key, never mutated) | 2 |
| PromotionalCredit | NEW | KP | `RewardCreditLot` (balance view per lot, expiry); applies to Kiorex Pay deposits/fees only | 2 |
| BookingAttribution | EXTEND | KP + CM | KP `BookingIntent.acquisitionOrigin`, `attributionDecisionId`; CM `Appointment.acquisitionOrigin`, `acquisitionDecisionRef`, `acquisitionPolicyVersion` (existing `attributionJson` kept) | 1 |
| CommissionPolicy | EXTEND | CM + KP | rate rows `KiorexCommissionRate` (existing, effective-dated) + attribution rules in `GrowthConfigVersion kind=ATTRIBUTION_POLICY` | 1 |
| CommissionDecision | NEW | CM | `KiorexCommissionDecision` (append-only, 1:1 appointment per policy version) | 1 |
| MarketingConsent | EXTEND | KP | `ConsentRecord` gains purposes `ANALYTICS_MEASUREMENT`, `MARKETING_WHATSAPP`, `MARKETING_SMS`, `MARKETING_EMAIL`, `MARKETING_PUSH`; versioned text id; CM keeps `MessagingConsent` | 1 |
| CommunicationPreference | EXTEND | KP | `NotificationPreference` (existing quiet hours) plus `CommunicationFrequencyCap`, `CommunicationSuppression` | 1 (suppression), 2 (caps) |
| LandingPage | NEW | KP | `GrowthLandingPage` (generated page descriptors: type, market, locale, params, `indexable`, guard result, `lastRenderedAt`) | 1 |
| SEOConfiguration | NEW | KP | `GrowthConfigVersion kind=SEO` | 1 |
| BookingWidget | NEW | CM + KP | CM `BookingWidgetConfig` (org-owned settings, allowlist); KP `WidgetRegistration` (verified origins synced from CM via profile projection) | 1 |
| GrowthExperiment | NEW | KP | `GrowthExperiment` | 3 |
| ExperimentAssignment | NEW | KP | `GrowthExperimentAssignment` (deterministic hash, stored for audit only when conversion occurs) | 3 |
| ConversionEvent | NEW | KP | `GrowthEvent` (canonical funnel events, pseudonymous key) | 1 |
| GrowthMetric | NEW | KP | `GrowthMetricDaily` (rollups by source, market, day; k-anonymity applied at read) | 1 |
| MarketGrowthConfiguration | NEW | KP | `GrowthConfigVersion scope=MARKET`; CM mirror in `Market.featureDefaults.growth` (link base URL, QR on/off only) | 1 |
| FraudSignal | NEW | KP | `GrowthFraudSignal` (rule id, subject hash, score, evidence ref) | 1 (touch/decision rules), 3 (rewards) |
| FraudReview | NEW | KP | `GrowthFraudReview` (queue, decision, reviewer, two-person for reward reversal) | 2 |
| ConfigurationVersion | NEW | KP | `GrowthConfigVersion` (see §16) | 1 |
| AuditEvent | EXISTING | KP + CM | reuse `AuditLog` (`actor, action, resource, metadata`); actions prefixed `growth.` | 1 |

## 8. Event catalogue

Naming: [AS-BUILT] contracts mix SCREAMING_SNAKE (Kiorly appointment events), PascalCase (Rev 2.3: `ReferralIssued`, `OrderReady`, `LabResultReleased`) and dotted (`flag.changed`, Passport). **Decision: growth events are PascalCase** (matching the founder's list and Rev 2.3), carried in the existing envelope (`envelope.schema.json`), with outbox `type` equal to the PascalCase name. Cross-product events are additive in `@kiorex/contracts` 1.10.0; Kiorex-internal events use the same names on the internal outbox (`OutboxEvent`) and are not published to partners.

Mapping of the founder's names to the existing facts:

| Founder event | Decision | Producer | Notes |
|---|---|---|---|
| PatientAcquisitionRecorded | NEW | KP | first time a `sub` receives an acquisition origin (registration or first booking), props `{origin, sourceKind, market}` |
| ReferralLinkCreated | NEW | CM (internal; mirrored to KP only as aggregate when connected) | `{linkCode, ownerScope, channelKind}` no PII |
| ReferralLinkVisited | NEW | CM counters, KP touch | counters only on CM; KP stores touches |
| PatientRegistered | NEW (growth view) | KP | derived from Passport/`PatientProfile` creation; no new Passport event |
| AttributionAssigned | NEW | KP | `{bookingId, decisionId, origin, reason, policyVersion}` |
| BookingInitiated | MAP | KP | `BookingEvent kind=INTENT` already exists; growth consumer maps it to a `GrowthEvent` |
| BookingConfirmed | MAP | existing `APPOINTMENT_CONFIRMED` | no duplicate event |
| BookingCompleted | MAP | existing `COMPLETED` | |
| BookingCancelled | MAP | existing `CANCELLED_BY_PATIENT`/`CANCELLED_BY_CLINIC` | |
| BookingRefunded | MAP | Kiorex Pay refund (`Refund` model) | internal |
| ReferralQualified | NEW | KP | patient referral, Phase 2 |
| RewardIssued / RewardRedeemed / RewardReversed | NEW | KP | Phase 2, ledger entries |
| CampaignActivated / CampaignPaused / CampaignBudgetThresholdReached | NEW | KP | Phase 2 |
| CommissionAttributed | EXTEND | CM | the existing `COMMISSION_CHARGE_CREATED` gains `decisionRef`, `origin`, `policyVersion` (additive); no second event |
| CommissionAdjusted | NEW | CM | amount waived or changed by dispute, with `decisionRef`; `COMMISSION_CHARGE_REVERSED` stays for full reversal |
| PatientConsentUpdated | NEW | KP | `{purpose, granted, textVersion}`; no PII in payload beyond opaque `sub` ref used internally |
| CommunicationDispatched | MAP | KX-24 `AuditRecord` | already written per channel attempt; growth reads it |
| ExperimentAssigned / ExperimentConversionRecorded | NEW | KP | Phase 3 |

Canonical funnel events recorded in `GrowthEvent` (names stable, props minimal): `PageViewed` (landing kind only), `SearchStarted`, `ResultsViewed`, `ProviderViewed`, `SlotSelected`, `BookingInitiated`, `BookingConfirmed`, `BookingAttended` (from `COMPLETED`/`CHECKED_IN`), `BookingCancelled`, `AppInstalled`, `PatientRegistered`, `WidgetLoaded`, `WidgetBookingStarted`, `WhatsAppConversationStarted`, `ConsentGranted`. Funnel steps up to `ProviderViewed` are measured on the anonymous stream by `careType` and market only; from `SlotSelected` on, events are server-side operational facts keyed to the booking.

## 9. Consent, communication preferences and lifecycle CRM

Purposes (extends KX-24 `purpose`): `TRANSACTIONAL` (booking confirmation, receipts), `SECURITY` (OTP, new-device), `CLINICAL` (care-critical: result ready, safety; follows KX-24 severity CRITICAL/IMPORTANT rules, bypasses quiet hours for CRITICAL), `REMINDER`, `MARKETING` (per channel). A message template is bound to exactly one purpose at definition time; a marketing template can never be sent under another purpose (unit test).

Gate order (reuses the layer, adds two checks): consent for purpose and channel, channel opt-out, **suppression list**, quiet hours (default 21:00 to 09:00 `Africa/Cairo`, per-person override already in `NotificationPreference`), **frequency cap** (defaults [ASSUMPTION]: <= 1 marketing message per day and <= 3 per week per person across channels), WhatsApp window rule (outside 24 h only approved templates), address present, PHI guard, dedupe.

Lifecycle journeys (Phase 2): welcome after registration (transactional if registration asked for it, otherwise none); post-visit review invite (existing `REVIEW_INVITATION_ELIGIBLE`, stays transactional); rebooking nudge for non-clinical reasons only; dormant-user re-engagement (marketing consent required); abandoned-booking reminder (only if the patient started a booking and consented to REMINDERS). Segments may use only non-clinical attributes: registration age, last booking recency, platform, language, city/district, referral status, consent flags. **No segment may be built from specialty, doctor, visit reason, diagnosis, prescription, lab, or pharmacy data**, and no ad audience is built from any patient list (enforced by a type-level allowlist and a unit test, `growth-segment-allowlist.unit.spec.ts`).

Preference centre: one screen in web and app (`/{locale}/{cc}/preferences`, SPA route, noindex) with per-purpose, per-channel toggles, quiet hours, "unsubscribe from all marketing", and STOP/إلغاء handling on WhatsApp and SMS (existing words). Every marketing message carries the sender identity and a one-step opt-out (PDPL Article 17/18 content as reported by counsel notes; counsel to confirm).

Consent record fields: `sub`, `purpose`, `channel`, `granted`, `textVersion` (id of the exact approved wording, AR and EN), `source` (`web|app|whatsapp|widget|ops-import`), `at`, `ipHash` (rotating), `evidence` (button id). History is append-only; the latest row wins; a withdrawn consent is effective for the send gate within 60 seconds (SLO). Legal wording is NEEDS_HUMAN (`ConsentRecord.version` is `TODO_NEEDS_HUMAN_v0` today).

Marketing licence: Egypt commentary says direct electronic marketing may require a licence (NEEDS_HUMAN, counsel); until confirmed, `growth.marketing_messaging` stays launch-locked OFF in production and the engine runs in `MODE=mock`.

## 10. Rewards, patient referral and compliance guardrails

[PROPOSED, Phase 2, counsel-gated] Reward credit properties: closed loop (usable only against Kiorex bookings: deposits or the patient share of a Kiorex-collected fee), non-transferable, non-cashable, no top-up by the patient, no interest, expiry (default 12 months, mirrors the SaaS credit expiry in BR12), capped per person per year, discount-only. This is designed to stay outside "stored value" definitions, but whether any Egyptian central-bank or fintech licensing applies is **unknown to me and must be assessed before build** (NEEDS_HUMAN). If counsel says a wallet is regulated, the fallback is a plain coupon code applied at checkout (no balance object) with the same ledger as audit.

Ledger: `RewardLedgerEntry(id, lotId, type ISSUE|REDEEM|REVERSE|EXPIRE, amountMinor, currency, idempotencyKey unique, ruleVersionId, subRef, bookingId?, relationshipId?, createdAt, createdBy)`, append-only, balance = sum, never edited. A fourth ledger by design: separate from Kiorex Pay (`LedgerTx`), held deposits, and SaaS `CreditLedgerEntry` in the clinic (CLAUDE.md "Three ledgers never commingled"). Accounting treatment of issued credits (marketing expense vs liability) is NEEDS_HUMAN with finance.

Referral qualification (anti-fraud by construction): reward issues only after the referee's first **attended** visit, outside the refund/dispute window, referee phone verified through Passport OTP, referee not an existing patient of that provider network within the lookback, referrer and referee not sharing phone, payment fingerprint or Passport device sessions (reusing the shape of `referral-fraud.ts`), velocity caps per referrer per 30 days, and a review queue for scored cases. The referrer never sees who the referee is, which provider, or any health detail; only "a friend you invited completed their first visit".

## 11. Booking widgets and embedding

[PROPOSED] Two integration styles from one app: (a) `<script src="https://book.kiorex.com/v1/sdk.js" async></script>` plus `<div data-kx-widget data-org="<slug>" data-doctor="<slug>" data-locale="ar">`; (b) plain `<iframe src="https://book.kiorex.com/v1/embed/<slug>?...">`. The SDK is a ~3 KB loader that creates the iframe, resizes via `postMessage`, and forwards `bookingConfirmed` to the host page *without patient data* (only `{status, bookingRef}`).

Security: exact-origin allowlist per org (https only, no wildcards, <= 10 origins, no `localhost` in production, TXT-record domain verification optional in Phase 2); `Content-Security-Policy: frame-ancestors <allowlist>` generated per response (fallback `'none'`); `postMessage` target and `event.origin` are always checked; SDK served from an immutable versioned URL with an SRI hash published in the docs; session via a short-lived token (not third-party cookies, which Safari blocks), sign-in via popup to Passport with PKCE, deposit 3-D Secure via popup or top-level hand-off to `pay.kiorex.com`; `X-Frame-Options` not used (superseded by CSP).

No double booking: the widget calls the same `BookingService` endpoints as the app: hold (5 minutes), idempotent confirm with `Idempotency-Key`, clinic confirms against the canonical slot engine (ADR-005). A widget cannot create an appointment itself. Per-phone and per-IP-hash hold limits (default 3 active holds) prevent slot hoarding.

Attribution: the widget always carries `lt`, so widget bookings are `PROVIDER_LED` by rule 1 and commission-free, which is the same promise as the clinic link. Allowlist changes by providers are audit-logged and pushed to Kiorex via a field on the existing profile projection (`PROVIDER_PROFILE_UPDATED`, additive `widgetOrigins`).

Decision needed: amend the `frameAncestors` statement of ADR-038 ("Nothing embeds another product") with an explicit exception for the widget origin only (ADR-044).

## 12. WhatsApp AI booking assistant (Phase 2)

Reuse, do not rebuild: [AS-BUILT] inbound goes through `MessagingHub.onInbound('WHATSAPP', ...)`; `WhatsAppBookingService` is a state machine with the same `BookingService`; clinic's MS-06 receptionist is separate and stays on the clinic's own number; `AiUsage` (KP) tracks AI cost; `kiorex.ai_navigation` and `ai-gateway` exist; `detectEmergency` and `detectPhi` exist in `safety`.

Design: keep the deterministic machine as the always-available path; add an **orchestrator in `ai-gateway`** that (1) classifies the turn, (2) may only act through a closed tool registry bound to existing services: `search_providers(specialty, district)`, `get_slots(providerId, date)`, `hold_slot`, `confirm_booking` (requires an interactive-button payload "Confirm" from the user in the *same* turn context, plus `Idempotency-Key`), `cancel_booking` (owner only), `join_waitlist`, `handoff_to_human`; (3) renders every fact (fee, time, doctor name) from tool output through fixed AR/EN templates, never from model free text. Safeguards: emergency detection short-circuits to emergency copy; no medical advice (reply routes to specialty choice or human); prompt-injection defences (inbound text is data; model output validated against JSON schema; tool arguments validated by existing DTOs; only tools allowed for the current state; no tool reads another patient's data because every tool takes the verified `sub` from the conversation, not from text); per-conversation and per-day token budgets and a global daily cost cap per market (circuit breaker returns to the deterministic machine); human escalation to the clinic/Kiorex support inbox (existing ops messaging page); consent: first message opens the 24 h service window, outbound proactive messages follow the marketing gate; meta pricing categories (marketing, utility, authentication, service) change cost, so templates are classified correctly (Meta pricing page, accessed 24 Nov 2026). Flag `kiorex.whatsapp_ai_assistant` (new, launch-locked until the safety review). Contract with KXM-BK-11: `KIOREX_WHATSAPP` booking source and the `KIORLY_ACCEPTS_WHATSAPP_CHANNEL` toggle already exist; this design adds nothing to the clinic contract.

## 13. Deep links and mobile

- Patient app (Kiorex Expo): add `associatedDomains: applinks:kiorex.com` (iOS) and `intentFilters` with `autoVerify` for `https://kiorex.com/{ar,en}/*/doctor/*`, `/clinic/*` (Android). AASA and `assetlinks.json` served by the SSR role at `/.well-known/` (no redirect, `application/json`). Apple Team ID and Play signing SHA-256 are NEEDS_HUMAN (KX-19 §04: store accounts not created).
- Staff app (Kiorly): [AS-BUILT] template AASA and `assetlinks.json` for `www.kiorly.com` paths `/signin/*`, `/open/*`; extend `paths` with `/growth/*` only if a share-back link is needed; otherwise unchanged.
- **Deferred deep links**: Android via Play Install Referrer (data available 90 days, read once on first run; Android developer docs accessed 24 Nov 2026); landing page appends `referrer=kxref%3D<lt>` to the Play URL. iOS has no equivalent; use first-launch "claim code" (short code shown on the landing page after the click, typed/pasted once) and Universal Links after install. Paid-campaign iOS attribution via AdAttributionKit is Phase 3 and aggregate only.
- **Market-aware bootstrap routing**: app start calls `GET /api/v1/bootstrap` returning `{markets[], defaultMarket, liveMarkets[], locales, minAppVersion}` from the existing `MarketService`; with one live market it returns `EG` and the app never shows a selector; with several, device region, last choice and link `cc` decide. Link `cc` always wins for deep links.
- Open redirect: the app resolves a deep link by matching the path against the route table; unknown paths open Home. No URL-valued parameters are honoured.

## 14. Third-party integration abstractions

Port: `GrowthIntegrationPort { kind; mode: 'mock'|'real'; health(); pushConversion?(c: AnonymizedConversion); pullSpend?(range); pullPerformance?(range) }` registered in `apps/api/src/growth/integrations/*`, real adapters only under `src/platform/adapters/*` if they need `@aws-sdk` (ADR-028). Secrets: configuration stores `secretRef` names resolved at runtime from Secrets Manager; the admin UI can never display or accept a raw secret (field type is `secretRef`, validated against `^[a-z0-9/_-]+$`).

| Integration | Phase | Direction | Allowed payload |
|---|---|---|---|
| Google Search Console | 1 (read, manual) / 2 (API) | pull | performance by page and query (no user data) |
| Google Ads | 3 | push conversions, pull spend | `AnonymizedConversion` only |
| GA4 | not planned (first-party analytics is the source of truth) | | |
| Meta Ads / TikTok | 3 | spend pull, aggregate conversion | `AnonymizedConversion` only |
| Play Console / App Store Connect | 2 | pull installs, ratings, store listing metrics | aggregates |
| WhatsApp Cloud | existing adapter | | KX-24 |
| FCM / APNs | existing adapter | | KX-24 |

`AnonymizedConversion = { eventName, occurredAtHour, market, valueMinor?, currency?, campaignRef, clickId? }`. It contains **no** phone, email, name, `sub`, hashed identifier, booking id, provider id, specialty or any health-related field. A runtime guard `assertAdSafe()` rejects any extra key and any value matching `detectPhi`, and a repo test (`no-health-targeting.unit.spec.ts`, modelled on `no-tax-authority.unit.spec.ts`) fails the build if integration code references patient models or segment builders. Rationale: ad platforms restrict health-based targeting and personalised ads; the risk is regulatory and reputational, and the first-party model does not need it. No third-party pixels or tags on any authenticated page or on the booking flow.

## 15. Internationalisation and multi-market (no country forks)

- Every growth table has `market` (ISO alpha-2); every config resolves `(kind, scope MARKET cc)` with fallback to GLOBAL; code contains no `if (market == 'EG')`.
- Locale content: AR and EN from i18next catalogues for chrome, from provider-entered AR/EN fields for content; missing translation falls back to the other locale with `x-default` unaffected; never machine-translate provider content without labelling.
- A new market is configuration plus data: `market.<cc>.live` flag, `GrowthConfigVersion(MARKET, cc)` with locales, canonical host/segment, quiet hours, windows, thresholds, consent regime id, geography lists (needs the market-pack district list, NH-040/FD-14 open), WhatsApp phone-number ids, integrations on/off, marketing-licence flag. Data cell routing follows `Market.hostCell`/data-cells.json; Kiorex today runs one cell (`frankfurt`), so cross-cell routing of growth data is out of scope until a second cell exists.
- Currency and phone region come from the market (`+20`, EGP for `eg`); reward amounts and fees are in minor units with currency.

## 16. Super Admin: versioned growth configuration

`GrowthConfigVersion(id, kind, scope GLOBAL|MARKET, scopeId, version, status, payload jsonb, schemaVersion, effectiveFrom, effectiveTo?, createdBy, createdAt, approvedBy?, approvedAt?, ticket, reason, checksum, supersedesId?)`, unique `(kind, scope, scopeId, version)`.

- States: `DRAFT -> PENDING_APPROVAL -> APPROVED -> ACTIVE -> SUPERSEDED`; `REJECTED`; `ROLLED_BACK` (a rollback creates a *new* version copying an older payload; old rows are never edited).
- Maker-checker: `approvedBy != createdBy`, both super admins; mirrors `FlagChangeRequest` and the ADR-040 two-person rule. Changes to `ATTRIBUTION_POLICY` or `COMMISSION` kinds additionally require `effectiveFrom >= now + 7 days` and an announcement text to providers (provider terms wording is NEEDS_HUMAN).
- Resolution: `resolve(kind, scope, at)` returns the single ACTIVE version whose window contains `at`; decisions store the version id; so an old booking is always explained by the policy that was active then.
- Validation: JSON Schema per `kind` (in `kiorex-contracts` so ops UI and API share it); secrets are `secretRef` only; unknown keys rejected.
- Audit: every transition writes `AuditLog action='growth.config.<transition>'` with before/after checksum; no secret values exist to leak.
- Kinds: `ATTRIBUTION_POLICY`, `SEO`, `WIDGET_POLICY`, `CONSENT_DEFAULTS` and `COMMS_CAPS`, `CAMPAIGN_GUARDRAILS` (P2), `REWARDS` (P2), `INTEGRATIONS`, `EXPERIMENT_GUARDRAILS` (P3), `MARKET_GROWTH`.
- Feature switches stay in the existing flags control plane (`growth.*`), not in config versions.

New flags (all `defaultEnabled` per ADR-023 conventions, launch-locked where noted): `growth.provider_links`, `growth.attribution`, `growth.ssr_public_pages`, `growth.seo_landing_pages`, `growth.widgets`, `growth.deep_links`, `growth.analytics_visitor` (launch-locked until counsel), `growth.marketing_messaging` (launch-locked), `growth.campaigns`, `growth.patient_referral` (launch-locked), `growth.rewards` (launch-locked), `kiorex.whatsapp_ai_assistant` (launch-locked), `growth.experiments`, `growth.integrations.<kind>`.

## 17. Growth analytics definitions (so the numbers cannot be gamed)

| Metric | Definition | Source |
|---|---|---|
| Gross booking value (GBV) | sum of visit fees `feeMinor` of CONFIRMED bookings | `BookingIntent` (informational; **not revenue**) |
| Kiorex revenue | sum of commission charges in CONFIRMED or BILLED (EGP 40 flat today), plus sponsored fees later, **net of reversals and waivers**, excluding provider SaaS revenue (separate line in KX-13) | `KiorexCommissionCharge` |
| Attended new patient (ANP) | appointment attended with `isNewPatientAtBooking = true` | clinic stamp |
| Provider-led share | `PROVIDER_LED / (PROVIDER_LED + MARKETPLACE + UNATTRIBUTED)` bookings | decisions |
| Incremental Kiorex bookings | `MARKETPLACE` origin bookings (what Kiorex monetises) | decisions |
| CAC (patient) | `acquisition spend in period / new patients first-attended in period attributed to paid or owned campaigns` | spend from integrations/manual entries (Phase 2) |
| Blended patient CAC | `total patient-acquisition spend / all ANP` | |
| Provider CAC | KX-13 blended (EGP 12,500 assumption) kept separate | |
| LTV (patient, Kiorex) | `sum of Kiorex revenue per patient cohort over 12 months, undiscounted`; because the fee is per *new patient* once, Kiorex patient LTV is dominated by the first-visit fee and by deposits/pay margin; repeat visits at the same clinic earn Kiorex nothing under ADR-007 | cohort |
| ROAS | `Kiorex revenue attributed to a campaign / spend of the campaign` (not GBV) | |
| MER | `total Kiorex revenue / total marketing spend` in period | |
| Funnel conversion | stage counts per source, with the stage definitions in §8 | |
| Cohort retention | share of a registration-month cohort booking again within 30/90/180 days | |

Observation that changes the plan: under ADR-007 Kiorex earns EGP 40 only on attended *new* patients. Repeat bookings are not monetised, so the ROI of patient marketing must be read against *first-visit fees*, not GBV, and patient referral and retention spend only pays back through supply-side effects (liquidity, provider retention, sponsored listings, Pay margin). That belongs in KX-13 (WP doc §Financial model).

## 18. Privacy impact assessment (summary; DPO must complete the formal PIA, NEEDS_HUMAN)

| Data | Purpose | Basis (proposed) | Retention | Identifiable | Health-related | Minimisation |
|---|---|---|---|---|---|---|
| In-session link token `lt` | credit provider-led booking | contract necessity | with booking | no (opaque) | no | org id + link code + ts only |
| `visitorKey` cookie and `GrowthTouchpoint` | cross-session attribution, SEO/campaign measurement | consent (analytics/attribution) | 13 months, 25 if linked to a decision | pseudonymous | no | no IP, no search text, no specialty, no provider id |
| `AttributionDecision` | commission fairness | legitimate interest + contract (provider terms) | 25 months (24-month lookback + dispute) | yes via booking | **indirect** (a booking exists) | stored in KP next to existing `BookingIntent`; no extra clinical fields |
| `GrowthEvent` | funnel analytics | consent for visitor-keyed, operational for server facts | 13 months | pseudonymous | no (careType only) | specialty never joined |
| Anonymous `AnalyticsEvent` (existing) | product analytics | legitimate interest | existing | no | specialty only (aggregate) | existing PHI whitelist; k >= 10 on reports |
| `ConsentRecord` history | proof of consent | legal obligation | life of relationship + limitation period (counsel) | yes | no | append-only |
| Marketing preference, suppression | honour opt-outs | legal obligation | while suppressed | phone/email hash for suppression across channels | no | store hash of address for suppression match |
| Reward ledger, referral relationship | rewards | contract (programme terms) | 5 years financial record [NEEDS_HUMAN] | yes | no | referrer never learns referee identity |
| Fraud signals | prevent abuse | legitimate interest | 12 months | pseudonymous hashes | no | no fingerprinting; keyed hashes with rotating salt |
| WhatsApp conversation context (existing `ChannelConversation.context`) | booking | contract | **existing policy unknown: NOT VERIFIED** | phone | **yes**: specialty choice implies a health interest | add expiry job (`expiresAt` exists) and purge context after the booking completes |
| Experiment assignment | A/B | consent when visitor-keyed | 6 months | pseudonymous | no | hash of key, not stored unless converted |

Key risks and mitigations: (1) *Inference of health from marketing data*: segments are limited to non-clinical attributes; specialty never in the visitor stream; ad payloads anonymised; no remarketing. (2) *Cookies/consent in Egypt*: PDPL commentary requires consent for direct marketing; for analytics cookies the position is not settled in my sources; default is consent-gated. (3) *Children and dependants*: no marketing to dependants; `Dependant` records are excluded from growth tables. (4) *Cross-border*: Kiorex data stays in the Frankfurt cell today (documented residency decision `Docs/DATA_RESIDENCY_DECISION.md`, existing; PDPL transfer rules, counsel); no growth data to non-AWS processors except aggregate integrations. (5) *Referral graph*: a referral edge discloses a relationship between two people; stored minimal, never shown to the other side. (6) *Subject rights*: access, correction and erasure covered by the `subject.deleted` consumer (deletes touchpoints, events, preferences; decisions are anonymised to `origin + reason` only if needed for the provider's financial record, counsel to confirm).

## 19. Threat model summary

| Threat | Asset | Mitigation |
|---|---|---|
| Forged provider token to dodge the fee | commission | HMAC token bound to org, link code, ts, expiry; verified server-side; evidence hash; random audit sampling |
| Provider gaming: tag marketplace patients as provider-led | commission | touch must precede booking intent; dwell minimum; distinct visitor; anomaly rule (provider-led share jumps, clicks without page renders, repeated same-IP-hash); `FraudSignal`; clinic cannot create `acquisitionOrigin`, only Kiorex does |
| Kiorex bias towards charging | trust | rules are public (provider help page), deterministic, replayable; decision evidence visible to the provider; auto-approve evidence-backed disputes |
| Open redirect via `kiorly.link` or `/open` | phishing | resolve by id; allowlist hosts from `domains.json`; no URL parameters |
| Widget clickjacking / hostile embed | patients | exact origin CSP per org; `postMessage` origin checks; short-lived tokens; popups for sign-in and pay |
| SDK supply chain | all widget hosts | immutable versioned URLs, SRI, no third-party scripts inside the widget |
| Slug enumeration and scraping | provider data | rate limit (`RateLimitBucket`), no phone numbers in HTML by default, bot UA throttle |
| Cache poisoning / cache key abuse on SSR | SEO | path-only cache key, query whitelist, no `Vary` on headers an attacker controls, canonical absolute from config not from `Host` header |
| SEO spam or thin pages | domain reputation | thin-page guard, verified reviews only, no UGC pages, sitemap from the same guard |
| Private page indexed | privacy | auth + `noindex` header + disallow; visit-status tokens high-entropy; snapshot test that every non-public route sends `noindex` |
| Reward farming (many Egyptian SIMs) | money | reward after attended visit + refund window; phone OTP; velocity caps; payment fingerprint; review queue; reversal rights |
| Consent forgery or silent opt-in | compliance | explicit unticked controls, versioned text, source and time, `ipHash`, append-only |
| WhatsApp prompt injection and tool abuse | patients, cost | §12 safeguards; schema-validated tool args; confirmation button; per-sub holds; budget caps |
| Spam through marketing (WhatsApp quality rating) | channel health | consent, caps, opt-out, template review; monitor Meta quality rating |
| Insider changes policy to favour a provider | commission | maker-checker, effective-dated versions, audit, 7-day lead for money policy |
| Secrets in integrations | ad accounts | `secretRef` only; no secret in DB, logs or UI; rotation runbook |
| PII in URLs (UTM carrying emails) | privacy | strip unknown params; only `utm_source|medium|campaign|content|term` and `gclid|fbclid|ttclid|msclkid` kept, each length-capped and pattern-checked; values rejected if `detectPhi` hits |

## 20. Observability: SLIs and SLOs [ASSUMPTION targets, to ratify]

| SLI | SLO |
|---|---|
| Public page availability (SSR role + CDN) | 99.9% monthly |
| Public HTML TTFB (edge hit) / (origin miss) | p95 <= 150 ms / <= 800 ms |
| Core Web Vitals (field, mobile, p75) | LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1 on >= 75% of URL groups |
| Touch ingestion latency / loss | p99 <= 300 ms / <= 0.1% dropped after accept |
| Attribution decision latency (inline in booking) | p99 <= 150 ms; adds <= 5% to booking p95 |
| Decision determinism | 100% replay equality on a daily sample of 1,000 decisions; any mismatch pages the on-call |
| Sitemap freshness | provider status change reflected within 15 minutes |
| Indexation health | >= 90% of indexable URLs "Indexed" in Search Console after 60 days (diagnostic, not contractual) |
| Widget ready time | iframe interactive p75 <= 1.5 s on 4G |
| Consent propagation | withdrawal honoured by the send gate within 60 s |
| Marketing send correctness | 0 sends without consent (audited daily); 0 sends in quiet hours |
| WhatsApp assistant | p95 reply <= 8 s; wrong-booking incidents 0; human-escalation response within the clinic's SLA |
| Commission dispute rate attributable to attribution | < 3% of charges per month |
| Outbox lag for growth consumers | p95 <= 60 s |

Dashboards in the existing observability module (`modules/aws/observability`) and ops `OperationsPage`; metrics emitted without patient identifiers.

## 21. Phase map

| Phase | Capabilities |
|---|---|
| 1 Launch-critical | provider/doctor/branch/desk links and QR; attribution engine v1 (touch, decision, evidence, replay); commission integration (`acquisitionOrigin`, `CommissionDecision`, dispute reason); first-party acquisition events and basic analytics; SEO-ready doctor/clinic profiles and core localized landing pages (SSR, sitemap, robots, hreflang, JSON-LD, slug history); booking widgets and SDK; deep links and bootstrap; consent management (analytics + marketing purposes, preference centre, suppression); Super Admin growth config v1 (versioned, maker-checker) |
| 2 Conversion and retention | campaign engine (UTM builder, budgets, lifecycle of campaign states); patient referral and rewards; provider Growth workspace v2 (analytics, campaign tools); WhatsApp assistant; lifecycle CRM and frequency caps; advanced analytics (CAC, ROAS, cohorts); Search Console, Play Console, App Store Connect adapters |
| 3 Optimisation | experiments with guardrails; advanced attribution views; fraud scoring and review; automation rules; AI recommendations (aggregate only); SEO automation (internal-link graph, content QA); Google Ads/Meta/TikTok adapters; international tooling |
| 4 Ecosystem | cross-product journeys; pharmacy, lab, nurse acquisition pages and links; corporate programmes (M15 per KX-14); loyalty |

## 22. Super Admin navigation mapping

[AS-BUILT] ops routes: providers, bookings, outbox, finance, moderation, liquidity, messaging, orders, fees, policy, operations, safety, held-deposits, home-gate, flags, onboarding, partner-onboarding, partner-leads (`kiorex-platform/apps/ops/src/App.tsx`). Proposed **Growth & Patient Acquisition** group:

| Nav item | Route | Status | Reuses |
|---|---|---|---|
| Overview (funnel, sources, provider-led share) | `/growth` | NEW P1 | `liquidity` layout |
| Attribution and commission | `/growth/attribution` | NEW P1 | `fees` page for rates; clinic `platform-commission-disputes` for disputes (existing in clinic platform console) |
| Provider links and widgets | `/growth/links` | NEW P1 (read-only monitoring) | `providers` |
| SEO and landing pages | `/growth/seo` | NEW P1 | |
| Consent and communications | `/growth/consent` and existing `/messaging` | EXTEND P1 | `messaging` |
| Campaigns | `/growth/campaigns` | NEW P2 | |
| Referrals and rewards | `/growth/rewards` | NEW P2 | `held-deposits` style ledger view |
| Experiments | `/growth/experiments` | NEW P3 | |
| Integrations | `/growth/integrations` | NEW P2 | |
| Configuration versions | `/growth/config` | NEW P1 | `flags` (maker-checker UI pattern) |
| Feature flags (growth filter) | `/flags` | EXISTING | |
| Policy | `/policy` | EXISTING | |
| Partner leads and funnel (supply side) | `/partner-leads` | EXISTING | |
| Audit | filter on audit log | EXISTING | |

## 23. ADRs to write (proposed numbers start at ADR-041; confirm that 039 is not used in Drive)

| ADR | Title | Status when written |
|---|---|---|
| ADR-041 | Growth engine ownership: modules inside the monoliths, no new service, ownership split | Proposed |
| ADR-042 | Attribution model, commission origin and evidence | Proposed (money: needs founder decision) |
| ADR-043 | Public SEO rendering (hybrid SSR role) and canonical URL convention | Proposed |
| ADR-044 | Embeddable widget origin and the `frame-ancestors` exception | Proposed |
| ADR-045 | Growth analytics privacy: consent-gated visitor key and k-anonymity | Proposed (needs counsel) |
| ADR-046 | Closed-loop reward credits | Proposed (blocked on legal assessment) |
| ADR-047 | Growth configuration versioning and maker-checker | Proposed |
| ADR-048 | WhatsApp assistant tool architecture | Proposed (Phase 2) |

Volumes: **KX-27** "Growth and Patient Acquisition Architecture" (this set, edited), optionally **KX-28** "Growth Operations and Egypt GTM Playbook". Amend: KX-19 §03 (hosts), KX-24 §01 (marketing campaigns no longer a non-goal), KX-13 (acquisition inputs), KX-14 §05/§09 (channel mix and budget), KX-03 KXMBK10 (widget origin), KX-15 (marketing consent, licence).

## 24. ADR-058 WhatsApp AI booking assistant: model abstraction, tool confirmation and fallback (Proposed, unsigned; 24 Nov 2026)

Numbering: this is the decision once reserved as ADR-048 (the assistant tool architecture, never written) and listed as ADR-051 in the P2-H table; ADR-048 is now the credit decision, so the founder is asked to confirm **ADR-058**. Status **Proposed**: nothing here binds anything until it is signed. Implementation status: built locally with a mock model (GRW-P2-D), not deployed, flags locked.

**Context.** Patients ask for bookings on WhatsApp in Arabic (Egyptian and Modern Standard) and English. A large language model could understand them, but a model can also be talked into things, can invent, and costs money. Booking is a money and clinical-safety path (ADR-025: safety controls are never flags; the Clinic is the only system of record for appointments, ADR-005).

**Decision.**
1. **The model is a port that returns structured steps, never text for the patient.** `AssistantModel.step()` returns a JSON-schema-constrained `ModelStep` (`tool`, `reply_intent`, `clarify`, `handoff`); anything else is invalid (one clarify, then the deterministic machine). Every sentence a patient reads is a fixed template (EN, Egyptian AR, MSA) filled from tool output.
2. **Actions that change a booking are executed by code, on a button.** The patient presses Confirm or Cancel on a message that carries a one-time nonce bound to the session, the verified subject and the target; the current inbound message must be that exact payload. Typed text never confirms. The model can request the buttons and cannot press them.
3. **A closed tool registry with no identity arguments.** Tools call the existing `BookingService`, `CatalogService` and `WaitlistService` (one canonical booking path). No tool takes a subject, phone or tenant; every id must have been shown in the session; dates are within 30 days; a specialty must be named by the patient (the model never maps a symptom to a specialty); the only URLs are one-time 15-minute links made by the platform.
4. **Fail closed to the existing machine.** A router in front of the deterministic WhatsApp machine returns `DETERMINISTIC` for a locked flag, a missing `AI_PROCESSING` consent, an exhausted budget, a tripped cost breaker, rate or concurrency limits, a model timeout or invalid answer, or any error. The machine answers exactly as before. Emergency language and opt-out never depend on the assistant.
5. **Mock by default, real only through four gates.** Policy `model.mode = real`, the locked flag `growth.assistant_real_model`, endpoint and model configuration and a key in Secrets Manager; any missing gate silently selects the mock. No paid vendor call exists in CI, and a test proves no other file in the module can reach the network.
6. **Minimal data.** The model receives redacted text; stored turn text is redacted and marker-only for health content; outbound bodies are never stored; phone numbers only as a keyed hash; 30-day turn retention, 12-month tool-call audit, erasure by subject.

**Consequences.** Cost, abuse and clinical risk are bounded by construction rather than by prompt wording; the assistant can be switched off (or can fail) without a booking ever being blocked; a real model can be swapped in later without changing any safety control. Costs: fixed templates need native-speaker and CMO review; interactive WhatsApp buttons need the real adapter; the lexicon of the mock model is not a substitute for a real model's understanding.

**Open (NEEDS_HUMAN).** CMO clinical-safety sign-off (gate for `kiorex.whatsapp_ai_assistant`), counsel on automated messaging and retention, vendor and DPA for a real model, wording approval, Clinic acceptance of the `KIOREX_WHATSAPP` channel (NH-042). Detail: `kiorex-platform/Docs/ASSISTANT.md`, launch guide 11.13a to 11.13l.
