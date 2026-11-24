# KX-31 — SEO, ASO and Organic Growth Strategy

Revision: Rev 2.4 draft 1 · Growth Edition, 24 November 2026 (new volume; owner: Head of Growth and SEO lead; supersedes: none; extends KX-14 section 05)

Subtitle: How Kiorex becomes findable in Arabic and English: server-rendered public pages, URL and slug rules, structured data, a thin-page guard, Maps and store presence, and measurement.

Tags: SEO · ASO · Organic · SSR · hreflang · JSON-LD · Sitemaps · Core Web Vitals · Google Business Profile · App stores

> **Note** How to read this volume. The current patient web is a client-only single-page app that search engines see as an empty shell; that gap is As-built and is the largest single obstacle to organic growth. Everything else here is Proposed (ADR-043). App-store optimisation is Proposed and blocked on store accounts that do not exist yet.

| Field | Value |
|---|---|
| DOCUMENT | KX-31 |
| REVISION | Rev 2.4 draft 1 · Growth Edition (24 November 2026) |
| STATUS | Proposed (ADR-043); store accounts NEEDS_HUMAN |
| OWNER ROLE | Head of Growth, SEO lead; engineering for rendering |
| AUDIENCE | Marketing, engineering, content writers, CMO |
| RELATED | KX-14 section 05; KX-19 (hosts and stores); KX-27; KX-28; KX-29; KX-32 |

## Revision history
| Revision | Date | Change | Author |
|---|---|---|---|
| Rev 2.4 draft 1 | 24 Nov 2026 | First issue from architecture decisions sections 4, 5, 13 and the competitive research | Documentation agent |

## Contents
01 Summary · 02 As-built baseline · 03 Strategy · 04 URL and slug rules · 05 Rendering and caching · 06 Technical SEO · 07 Structured data · 08 Thin-page guard and content · 09 Maps and Business Profile · 10 ASO · 11 Measurement · 12 Acceptance, KPIs, risks, dependencies, open decisions

## Key numbers
<!-- kpis -->
- **0** indexable pages today (SPA shell, no sitemap)
- **3,000** pages passing the guard by month 12 (hypothesis)
- **2.5 s / 200 ms / 0.1** Core Web Vitals targets (LCP, INP, CLS)
- **120 KB** gzip JavaScript budget on public routes
- **3** live providers minimum for a district page (default)

## Status legend (read first)
Every statement in this volume carries one of these labels, in a column, a prefix or a callout. Growth Engine Phase 1 is being implemented by other agents while this volume is written, so the labels matter more than usual.

| Label | Meaning | Rule for readers |
|---|---|---|
| **As-built** | Exists in code and tests in the workspace, verified by reading the repositories on 24 Nov 2026 (discovery) and re-checked for the items named in KX-28 §02 | Safe to rely on. Everything not listed as As-built does not exist yet |
| **Approved target** | Accepted by the founder as an ADR or founder decision (FD) | Binding. As of this revision no growth ADR is Accepted, so this label marks only rules inherited from existing Accepted ADRs |
| **Proposed** | Designed in the Growth reports of 24 Nov 2026 and written up here, not yet signed (ADR-041 to ADR-047) | Build only after sign-off, or inside a work package the founder released |
| **Roadmap** | Phase 2 to 4 capability, scoped coarsely | Do not build; estimates are ranges |
| **Open decision** | A founder or CEO choice with a stated default | Use the default, never decide silently |
| **Regulatory dependency** | Needs counsel, DPO, a regulator position or a partner approval (NEEDS_HUMAN) | Flag stays OFF in production until evidence is recorded; never mark a gate satisfied |

> **Warning** Nothing in this volume has run in production, against a real ad platform, search engine, WhatsApp number or payment provider. Messaging and provider integrations stay MOCKED until the pre-launch pass (FD-04). Numbers marked ASSUMPTION are starting hypotheses, not forecasts.

## 01 Summary
Local intent is the largest demand pool for this category (Vezeeta shows how large). Kiorex cannot win Arabic head terms against an incumbent with years of history and a very large page inventory. It can win long-tail pages for a specialty in a district where it has real live providers and real verified reviews, provided those pages are rendered on the server, quick, correct and never thin. The plan is: render public routes on the server, give every provider a stable ASCII slug and URL, publish structured data from the same data as the visible page, and protect domain reputation with a hard quality guard.

## 02 As-built baseline (24 Nov 2026)
| Item | Fact | Label |
|---|---|---|
| Rendering | `kiorex-platform/apps/web` is a Vite 8 SPA with `BrowserRouter`; one static title and description; `lang="ar" dir="rtl"` | As-built (CONFLICT with KX-14 "provider profiles indexed; schema markup") |
| Crawl files | No `robots.txt`, no sitemap, no JSON-LD, no hreflang; hreflang exists only in static store pages of the staff app | As-built |
| URLs | Doctor pages by opaque id `/doctors/:id`; language in `localStorage` key `kx-lang`, not in the URL | As-built |
| Fonts | Google Fonts loaded render-blocking | As-built (debt C14) |
| Trust data | Reviews, `ratingAvg`, `ratingCount`, verification register exist | As-built |
| Slugs | Kiorly `bookingSlug` exists (ASCII, reserved words); Kiorex `Provider` has no slug | As-built |
| Marketing site | KX-19 lists `kiorly.com/clinic` etc.; no marketing site code was found in the seven repos | As-built (NOT VERIFIED whether a separate repo exists) |

## 03 Strategy
| Pillar | What | Label |
|---|---|---|
| P1 Indexable profile pages | Doctor and clinic pages, rendered on the server, with structured data and reviews that are visible on the page | Proposed |
| P2 Local landing pages | Specialty-in-district and care-type-in-district pages only where live providers exist | Proposed |
| P3 Provider-owned links | Every provider link and widget doubles as a backlink and a referral source; Google Business Profile booking links | Proposed |
| P4 Trust | Verified-visit reviews as the moat; profile completeness nudges for providers | As-built data, Proposed exposure |
| P5 Speed | Public routes small and cached; self-hosted fonts | Proposed |
| P6 Arabic first | Egyptian dialect for patient copy, Modern Standard Arabic for clinical and legal, English second; one slug for both languages | Approved target (KX-14 section 10) |

Rejected options (ADR-043 context): migrate to Next.js (breaks the Vite 8 and TanStack Query stack, second framework to secure); a third-party prerender service (data flow of provider content, cost, cloaking-adjacent risk); build-time static generation for directory pages (slots and status change continuously, acceptable for static content pages only).

## 04 URL and slug rules
Canonical host `kiorex.com`; structure `https://kiorex.com/{locale}/{cc}/{path}` with locale `ar` or `en` and `cc` the lowercase ISO market (`eg`). Provider links stay on `https://kiorly.link/<slug>`.

| Page | Path after locale and market | Indexable rule |
|---|---|---|
| Home | `/` | yes |
| Specialty hub | `/doctors/{specialty}` | yes |
| Specialty in city | `/doctors/{specialty}/{city}` | yes if live providers with slots at or above the threshold (default 3) |
| Specialty in district | `/doctors/{specialty}/{city}/{district}` | same threshold at district level, else `noindex,follow` and not in the sitemap |
| Care type in district | `/home-nursing/{city}/{district}`, `/physiotherapy/{city}/{district}` | same; nurse pages also need `nurse.individual_kiorex_listing` effective (GKN2) |
| Doctor | `/doctor/{slug}` | yes if LIVE |
| Clinic | `/clinic/{slug}` | yes if at least one LIVE doctor |
| Pharmacy, lab | `/pharmacy/{slug}`, `/lab/{slug}` | Phase 4, flags launch-locked |
| Static | `/about`, `/help/{article}`, `/safety` | yes |
| Search results, checkout, appointments, records, account, visit status | existing SPA routes | `noindex` and disallowed |

Rules (Proposed):
1. Slugs are lowercase ASCII `[a-z0-9-]`, 3 to 60 characters, one namespace per market per entity type, identical in Arabic and English. Arabic names appear in title, H1, content and structured data. Transliteration is stable, links stay shareable in WhatsApp, and one slug avoids a second history table.
2. Kiorex owns `GrowthSlug` and `GrowthSlugHistory`; the Kiorly `bookingSlug` is the default proposal so a provider renaming a link does not silently change the SEO URL. Old slugs 301 to the current one; history is kept while the entity exists. Reserved words stay (`admin api app b book kiorex kiorly login public www`) plus growth words.
3. The canonical URL is clean, absolute and free of query parameters. Only `page` and `sort` may change content. `utm_*`, `gclid`, `fbclid`, `s`, `ref` are stripped from the canonical and the cache key and consumed by the first-party touch endpoint.
4. `hreflang`: each page lists `ar`, `en` and `x-default`, self-referencing, reciprocal, fully qualified, mirrored in the sitemap with `xhtml:link`.
5. Root `/`: 301 to `/ar/eg/` while one market is live; a 200 selector when two or more are live.
6. Legacy `/doctors/:id` 301s to the new URL; locale from `kx-lang` cookie, then Accept-Language, then `ar`.
7. Lifecycle: LIVE is 200 and indexable; paused is 200 with `noindex` and the booking button replaced by "not accepting bookings"; delisted is 301 to the specialty hub if one exists, else 410 after 30 days.
8. Never indexed: authenticated pages, visit-status tokens, record shares, addresses, home-visit provider locations (districts only), review text beyond what moderation already publishes.

## 05 Rendering and caching
Chosen design (ADR-043, Proposed): a Vite SSR bundle served by the existing Kiorex API image in `ROLE=site`, cached by CloudFront. The logged-in SPA stays a SPA.

| Aspect | Design |
|---|---|
| Code | Second entry `entry-server.tsx`, `vite build --ssr`; a single shared route table for server and client entries; React 19 streaming |
| Status codes | 200, 301, 404, 410; `Link`, `ETag`; `Vary: Accept-Encoding` only (locale is in the path) |
| Hydration | Partial: header, search box and booking island; rest is static HTML |
| Budget | At most 120 KB gzip JavaScript on public routes; fonts self-hosted with `font-display: swap` and preload of the primary Arabic subset |
| CDN | Behaviours for `/{ar,en}/*`, `/sitemap*.xml`, `/robots.txt`, `/.well-known/*` to the site role; `/api/*` to the API role; existing SPA assets unchanged. HTML `s-maxage=300`, `stale-while-revalidate=3600`; cache key is the path with a query whitelist; purge on `LISTING_STATUS_CHANGED` and `PROVIDER_PROFILE_UPDATED` |
| Indicative data | Slots and prices on public pages are indicative ("next available" from the indexed `nextSlotAt`); the booking island fetches live slots; HTML never promises a slot |
| Fallback | Flag `growth.ssr_public_pages` OFF returns the existing SPA shell while still serving `robots.txt` and the sitemap |
| Targets | Field p75 on mobile 4G in Egypt: LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1 (confirm current Google thresholds when building); lab budget in CI (Lighthouse CI on three templates): performance at least 90, cached TTFB at most 200 ms |

## 06 Technical SEO
| Item | Rule |
|---|---|
| Sitemaps | Index plus shards by type, market and locale, at most 10,000 URLs each; `lastmod` is the real profile change time; regenerated within 15 minutes of a status change |
| `robots.txt` | References the sitemap index; disallows private routes; robots is not a privacy control (private pages also send `X-Robots-Tag: noindex` and require sign-in) |
| Link previews | Open Graph and Twitter tags on every public page so WhatsApp and Facebook previews work; these crawlers do not run JavaScript |
| Images | Explicit width and height, responsive `srcset`, through the existing storage path (KX-25 rules) |
| Internal links | Hub to city to district to doctor; breadcrumbs; neighbouring districts; no sitewide footer link farms |
| Pagination | Capped (the incumbent's 865-page listing is a weakness to avoid); consistent canonical |
| Well-known files | `apple-app-site-association` and `assetlinks.json` served without redirect as `application/json` by the site role |
| Self-hosting | Fonts and scripts first-party on public pages; no third-party tags on authenticated or booking pages |

## 07 Structured data
One JSON-LD block per page, generated from the same data as the visible content; never data the user cannot see.

| Page | schema.org types | Notes |
|---|---|---|
| Doctor | `Physician` with `medicalSpecialty`, `knowsLanguage`, `priceRange`, district-level `address`, `aggregateRating` only from verified reviews visible on the page | Review-snippet eligibility under Google's current guidelines is NOT VERIFIED; omit `aggregateRating` until checked (Regulatory dependency) |
| Clinic | `MedicalClinic` or `MedicalBusiness`, `openingHoursSpecification`, `geo` for in-clinic sites only | |
| Pharmacy, lab | `Pharmacy`, `MedicalLaboratory` | Phase 4 |
| Listings | `ItemList` of provider URLs, `BreadcrumbList` | |
| Home | `Organization`, `WebSite` with `SearchAction` | |

Forbidden in markup: doctor phone numbers unless the provider opted in, home addresses, patient names, flagged reviews, health claims such as "cures".

## 08 Thin-page guard and content
A generated page is indexable only if all hold (parameters in `GrowthConfigVersion kind=SEO`):
- `liveProviders` at or above `minLiveProviders` (default 3), with slots.
- At least `minUniqueBlocks` data-derived blocks: counts, median fee range, next available slot, languages, rating distribution, neighbouring districts.
- Overlap with a sibling page's provider list at most `maxSiblingSimilarity` (default 70 percent).
Otherwise the page is `noindex,follow`, absent from the sitemap and not linked from navigation. This follows Google's doorway and scaled-content policies and is a hard requirement, not a preference.

Content plan (Proposed): FAQ blocks per template written once in Arabic and English and reviewed by the CMO for clinical accuracy; no medical advice; no "best doctor" claims (KX-14 voice rules); provider content published only under the provider-content licence in the provider terms (Regulatory dependency). No user-generated pages. Reviews appear only as published after moderation.

Content calendar (hypothesis): month 0 to 3, templates and 100 pages in the pilot cluster; month 6, 600 pages; month 12, 3,000 pages, cluster by cluster, never ahead of live supply.

## 09 Maps and Business Profile
| Action | Detail | Label |
|---|---|---|
| "Book" link guide | A guide for providers to place the tracked provider link on their Google Business Profile appointment URL; the profile and its link belong to the provider and Kiorex does not automate it | Proposed |
| Why | Zocdoc reports large booking lifts from Google profiles (self-reported and unverified in the competitive research); it is the first lever to test, not a promise | Evidence grade A for the claim, unverified result |
| Kiorex presence | Kiorex's own Business Profile and Search Console and Bing Webmaster ownership | Open decision (marketing) |

## 10 ASO (app-store optimisation)
Scope: the Kiorex patient app and the Kiorly staff app. Store accounts, Apple Team ID and Play signing certificates do not exist yet (KX-19 section 04, NEEDS_HUMAN), so nothing here is live.

| Element | Plan | Label |
|---|---|---|
| Names | Staff app title "Kiorly: Clinic, Pharmacy & Lab", display name Kiorly, bundle `com.kiorly.app` (ADR-037); patient app name per KX-19 | As-built naming for the staff app; patient store name Open decision |
| Listing text | Arabic and English listings, keywords from Search Console and store search terms, no health claims | Proposed |
| Screenshots | Arabic and English, RTL, light and dark; show real flows only | Proposed |
| Deep links | Universal and App Links for `kiorex.com` doctor and clinic URLs; Android install referrer for deferred links; iOS claim code | Proposed (needs Team ID and SHA-256) |
| Ratings | In-app prompt after a completed visit, never during a safety or error state | Proposed |
| Measurement | Play Console and App Store Connect adapters (Phase 2, mock first) for installs and ratings, aggregate only | Roadmap |
| Static store pages | Already exist with hreflang in the staff app docs | As-built |

## 11 Measurement
Search Console (manual in Phase 1, API in Phase 2): impressions, clicks, indexed pages by template, queries by page, Core Web Vitals field data. First-party: touches of kind `ORGANIC_SEARCH`, organic share of attended new patients, organic bookings per provider (KX-32). Diagnostic only: indexation health of at least 90 percent of indexable URLs after 60 days. Rich Results Test and Search Console verification are a manual checklist (NEEDS_HUMAN).

## 12 Acceptance criteria, KPIs, risks, dependencies, open decisions
- Acceptance (GRW-P1-E and F): view-source of a doctor URL shows title, description, H1, JSON-LD and content without JavaScript; every route in the SPA is public-table or `noindex` (snapshot test); pages below the guard are `noindex,follow` and absent from sitemaps; `hreflang` pairs are reciprocal in AR and EN; no phone number unless the provider opted in; CWV lab budget met on three templates; legacy ids 301.
- KPIs: indexed pages passing the guard; impressions; organic share; organic bookings per provider; CWV pass rate; guard rejection rate.
- Risks: thin or duplicate pages (guard, no UGC); Arabic query uncertainty (validate first); review markup ineligible (omit); SSR on the shared image affecting API latency (role split, flag); incumbent dominance (long tail).
- Dependencies: slugs and thin-page guard (GRW-P1-F), SSR infrastructure (GRW-P1-E), `kiorex.com` host in the domain table, CDN module (`modules/aws/cdn-edge`, validate only), district list (NH-040), consent for any analytics.
- Open decisions: SSR as a separate service from day one; Kiorex Business Profile owner; patient store name; indexation of care-type pages before GKN2.
- Cross-references: KX-14 section 05, KX-19 section 03, KX-24 (previews and sends), KX-28 sections 04 and 05.
