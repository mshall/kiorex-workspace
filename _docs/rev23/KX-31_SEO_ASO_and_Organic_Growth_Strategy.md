# KX-31 — SEO, ASO and Organic Growth Strategy

Revision: Rev 2.7 · Growth Edition, SEO automation as-built locally, updated 25 November 2026 (supersedes Rev 2.4 of 24 November 2026; owner: Head of Growth and SEO lead)

Subtitle: How Kiorex becomes findable in Arabic and English: server-rendered public pages, URL and slug rules, structured data, a thin-page guard, Maps and store presence, and measurement.

Tags: SEO · ASO · Organic · SSR · hreflang · JSON-LD · Sitemaps · Core Web Vitals · Google Business Profile · App stores

> **Note** How to read this volume. The current patient web is a client-only single-page app that search engines see as an empty shell; that gap is As-built and is the largest single obstacle to organic growth. Everything else here is Proposed (ADR-043). App-store optimisation is Proposed and blocked on store accounts that do not exist yet.

| Field | Value |
|---|---|
| DOCUMENT | KX-31 |
| REVISION | Rev 2.7 · Growth Edition (25 November 2026) |
| STATUS | Server rendering, slugs, sitemaps, structured data, the guard and SEO automation As-built locally (ADR-043, ADR-053 and later Proposed); Lighthouse lab scores recorded, no field Web Vitals; Search Console and Bing run in mock; store accounts NEEDS_HUMAN |
| OWNER ROLE | Head of Growth, SEO lead; engineering for rendering |
| AUDIENCE | Marketing, engineering, content writers, CMO |
| RELATED | KX-14 section 05; KX-19 (hosts and stores); KX-27; KX-28; KX-29; KX-32 |

## Revision history
| Revision | Date | Change | Author |
|---|---|---|---|
| Rev 2.4 draft 1 | 24 Nov 2026 | First issue from architecture decisions sections 4, 5, 13 and the competitive research | Documentation agent |
| Rev 2.4 | 24 Nov 2026 | Re-verified against `public-site/*`, `growth/seo/*`, `apps/web/src/public/*` and the SEO integration suites: section 02 split into before and after Phase 1; URL, slug, guard, sitemap, JSON-LD and caching rules relabelled with the real values and deviations; Lighthouse gap stated | Documentation agent |
| Rev 2.7 | 25 Nov 2026 | Phases 2 to 4 as-built status (W5 to W8 and W9 documentation pass); ADR-049 to ADR-057 registered; statuses re-read from the as-built records and the wave 8 exit gate | Documentation agent (wave 9 lane A4) |

## What changed in Rev 2.7
New section 2.3: Phase 3 SEO automation (quality gate, internal-link graph, vitals, indexation snapshots, automatic noindex OFF by default), lab Lighthouse scores on the SSR pages, the experiment SSR slots and the thin-page finding on district pages. App-store optimisation is unchanged (blocked on store accounts).


## Contents
01 Summary · 02 As-built baseline · 03 Strategy · 04 URL and slug rules · 05 Rendering and caching · 06 Technical SEO · 07 Structured data · 08 Thin-page guard and content · 09 Maps and Business Profile · 10 ASO · 11 Measurement · 12 Acceptance, KPIs, risks, dependencies, open decisions · Rev 2.7: section 2.3 (after Phase 3)

## Key numbers
<!-- kpis -->
- **0** indexable pages today: every page is `noindex` outside production, the sitemap is empty on the local stack, and no production host exists yet
- **3,000** pages passing the guard by month 12 (hypothesis)
- **2.5 s / 200 ms / 0.1** Core Web Vitals targets (LCP, INP, CLS)
- **120 KB** gzip JavaScript budget on public routes
- **3** live providers minimum for a district page (default)

## Status legend (read first)
Every statement in this volume carries one of these labels, in a column, a prefix or a callout. Phase 1 is now built locally; the labels separate what runs from what is only designed.

| Label | Meaning | Rule for readers |
|---|---|---|
| **As-built** | Exists in code with a passing test in the workspace, verified by reading the repositories and re-running the suites on 24 Nov 2026 (Rev 2.4). Local only: not deployed, not run against a real provider | Safe to rely on for behaviour in the local stack |
| **Approved target** | Accepted by the founder as an ADR or founder decision (FD) | Binding. No growth ADR (ADR-041 to ADR-047) has been accepted, so this label marks only rules inherited from existing Accepted ADRs |
| **Proposed** | Designed in the Growth reports of 24 Nov 2026 and written up here, not yet signed (ADR-041 to ADR-047) | Build only after sign-off, or inside a work package the founder released |
| **Roadmap** | Phase 2 to 4 capability, scoped coarsely | Do not build; estimates are ranges |
| **Open decision** | A founder or CEO choice with a stated default | Use the default, never decide silently |
| **Regulatory dependency** | Needs counsel, DPO, a regulator position or a partner approval (NEEDS_HUMAN) | Flag stays OFF in production until evidence is recorded; never mark a gate satisfied |

> **Warning** Nothing in this volume has run in production, against a real ad platform, search engine, WhatsApp number or payment provider. Messaging and provider integrations stay MOCKED until the pre-launch pass (FD-04). Numbers marked ASSUMPTION are starting hypotheses, not forecasts.

## 01 Summary
Local intent is the largest demand pool for this category (Vezeeta shows how large). Kiorex cannot win Arabic head terms against an incumbent with years of history and a very large page inventory. It can win long-tail pages for a specialty in a district where it has real live providers and real verified reviews, provided those pages are rendered on the server, quick, correct and never thin. The plan is: render public routes on the server, give every provider a stable ASCII slug and URL, publish structured data from the same data as the visible page, and protect domain reputation with a hard quality guard.

## 02 As-built baseline
### 2.1 Before Phase 1 (discovery, 24 Nov 2026, kept for the record)
| Item | Fact | Label |
|---|---|---|
| Rendering | `kiorex-platform/apps/web` is a Vite 8 SPA with `BrowserRouter`; one static title and description; `lang="ar" dir="rtl"` | As-built (CONFLICT with KX-14 "provider profiles indexed; schema markup") |
| Crawl files | No `robots.txt`, no sitemap, no JSON-LD, no hreflang; hreflang exists only in static store pages of the staff app | As-built |
| URLs | Doctor pages by opaque id `/doctors/:id`; language in `localStorage` key `kx-lang`, not in the URL | As-built |
| Fonts | Google Fonts loaded render-blocking | As-built (debt C14) |
| Trust data | Reviews, `ratingAvg`, `ratingCount`, verification register exist | As-built |
| Slugs | Kiorly `bookingSlug` exists (ASCII, reserved words); Kiorex `Provider` has no slug | As-built |
| Marketing site | KX-19 lists `kiorly.com/clinic` etc.; no marketing site code was found in the seven repos | As-built (NOT VERIFIED whether a separate repo exists) |

### 2.2 After Phase 1 (verified 24 Nov 2026)
| Item | Fact | Label |
|---|---|---|
| Rendering | Express handlers at the host root (`SITE_ROLE=all|api|site`) render the public routes with a Vite SSR bundle (`entry-server.tsx`, hydrated by `entry-client.tsx`); flag OFF or a render error returns the SPA shell. Only `SITE_ENVIRONMENT=production` is indexable | As-built |
| URLs | Canonical `https://kiorex.com/{ar|en}/{cc}/{path}`, lowercase, no trailing slash, no tracking query; legacy `/doctors/:id` 301; 14 page types (home, specialty hub, specialty+city, specialty+district, care type+district, city hub, district hub, same-day, telemedicine, doctor, clinic, nurse, pharmacy, lab); the `static` type is declared but disabled | As-built |
| Slugs | `GrowthSlug` and `GrowthSlugHistory`; bootstrap job every 15 minutes; Kiorly `bookingSlug`, else transliterated English or Arabic name, else `<type>-<short id>`; rename keeps the old URL as a 301; Arabic, underscore and percent-encoded variants 301 to one clean URL | As-built |
| Guard | `thin-page-guard.ts`, one function used by render and sitemap, parameters from the SEO config | As-built |
| Structured data | Organization, WebSite, BreadcrumbList, CollectionPage, ItemList, Physician or Dentist, MedicalBusiness (nurse, physio, lab), MedicalClinic, Pharmacy; privacy-forbidden keys enforced by a test | As-built |
| Crawl files | `robots.txt` per environment, segmented sitemaps with lastmod and alternates, verification meta and files from config, Search Console and Bing through a mock adapter | As-built (mock adapter) |
| Performance | Public JS 102.0 KB gzip against the 120 KB budget; self-hosted fonts; SSR 3 to 7 ms on the throwaway smoke. Lighthouse and field Web Vitals are NOT measured (CLI not installed) | As-built (budget), Open (lab scores) |
| Infra | `cdn-edge` and product-stack modules gained `site_enabled`, `site_origin_domain`, `spa_noindex_header` (default off); `apps/api/Dockerfile` added; `tofu fmt` and `validate` only | As-built (validated, not applied) |

### 2.3 After Phase 3 (Rev 2.7, GRW-P3-F, verified 25 Nov 2026 locally)
| Item | Fact | Label |
|---|---|---|
| Quality gate | Nine checks per page and locale: thin content (boilerplate removed; entity floors 15 words for doctor and nurse, 12 clinic, 10 pharmacy and lab; listing templates hub 100, city 90, district 70), near duplicate (shingle similarity, limit 85 percent), Arabic and English parity, title and meta, JSON-LD validity, canonical, hreflang reciprocity, orphan, medical claims, empty page; score, failed checks and content hash stored | As-built locally |
| Automatic noindex | `SEO_AUTOMATION.autoNoindex` is **OFF** by default; the gate only reports until a human switches it on after reading about a week of reports | As-built, locked by default |
| Internal links | Computed link graph with caps (50 per page, 3 per cross-link role), stable order, linkable targets only, orphan repair, anchor variety; rendered in SSR templates as `nav[data-computed-links]` without repeating an existing link | As-built locally |
| Vitals | Lighthouse summary and CrUX rows into `SeoVitalSnapshot`, budgets from `lighthouserc.json`; lab run on ten SSR audits (home, specialty hub, city hub, doctor, clinic; Arabic and English): performance 100, accessibility 100, best practices 96, SEO 100, LCP about 630 ms, CLS 0 to 0.026. Lab numbers on loopback, **not field data** | As-built (lab), field Open |
| Indexation | Submitted and excluded counts are real; "indexed" reads "not measured" until a Search Console coverage adapter exists | As-built, gap |
| Finding | District pages of the eight-provider seed list the same doctors as their city pages and fail the near-duplicate check (86 to 88 percent): a content decision (does such a page deserve to exist) is open for the CMO | Open decision |
| Not wired | Running the gate on publish, profile update and slug change (only the nightly job and a manual run exist); the crawl renders pages serially (fine for the launch catalogue, a scale note beyond a few thousand pages) | Not built |
| Experiment slots | Two SSR slots can show a variant (`landing.home.hero_copy`, `landing.provider.cta_label`) only when the visitor holds both the analytics cookie and the `kxe` cookie; no consent means no cookie and no cache-key change; CloudFront must include `kxe` in the cache key (human infra item) | As-built, infra open |
| Market by configuration | A new market's canonical segment and locales come from `MARKET_PROFILE`; the SSR markup for a live new market is not proven | Open |

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
Status: As-built unless a row says otherwise (`url-policy.ts`, `slugs/slug.ts`). Canonical host `kiorex.com`; structure `https://kiorex.com/{locale}/{cc}/{path}` with locale `ar` or `en` and `cc` the lowercase ISO market (`eg`). Provider links stay on `https://kiorly.link/<slug>`.

| Page | Path after locale and market | Indexable rule |
|---|---|---|
| Home | `/` | yes |
| Specialty hub | `/doctors/{specialty}` | yes |
| Specialty in city | `/doctors/{specialty}/{city}` | yes if live providers at or above `minLiveProviders` (default 3), at least `minUniqueBlocks` (3) data-derived blocks and sibling overlap at most 70 percent |
| Specialty in district | `/doctors/{specialty}/{city}/{district}` | same guard, else `noindex,follow` and not in the sitemap |
| Care type in district | `/home-nursing/{city}/{district}`, `/physiotherapy/{city}/{district}` | same; nurse pages also need `nurse.individual_kiorex_listing` effective (GKN2) |
| Doctor | `/doctor/{slug}` | yes if LIVE |
| Clinic | `/clinic/{slug}` | yes if at least one LIVE doctor |
| City hub, district hub | `/locations/{city}`, `/locations/{city}/{district}` | yes unless the page equals its parent set (a one-city market does not index the city hub) |
| Same day, telemedicine | `/same-day/{specialty}`, `/telemedicine/{specialty}` | yes if at least `minAvailableProviders` (default 2) with a slot in 24 hours or declared video, and not a duplicate of the specialty hub |
| Pharmacy, lab | `/pharmacy/{slug}`, `/lab/{slug}` | built in Phase 1 (F) but served only for a LIVE partner with the launch-locked flags `kiorex.pharmacy_orders` or `kiorex.lab_bookings` effective, else 404 and absent from sitemaps. They are brand pages (name only), not local listings |
| Static | `/about`, `/help/{article}`, `/safety` | Not built (the route type exists and is disabled) |
| Search results, checkout, appointments, records, account, visit status | existing SPA routes | `noindex` and disallowed |

Rules (As-built unless noted):
1. Slugs are lowercase ASCII `[a-z0-9-]`, the helper accepts 3 to 60 characters while the route pattern accepts 2 to 60; one namespace per market per entity type, identical in Arabic and English. Arabic names appear in title, H1, content and structured data. Transliteration is stable, links stay shareable in WhatsApp, and one slug avoids a second history table.
2. Kiorex owns `GrowthSlug` and `GrowthSlugHistory`; the Kiorly `bookingSlug` is the default proposal so a provider renaming a link does not silently change the SEO URL. Old slugs 301 to the current one; history is kept while the entity exists. Reserved words stay (`admin api app b book kiorex kiorly login public www`) plus growth words.
3. The canonical URL is clean, absolute and free of query parameters. Only `page` and `sort` may change content. `utm_*`, `gclid`, `fbclid`, `s`, `ref` are stripped from the canonical and the cache key and consumed by the first-party touch endpoint.
4. `hreflang`: each page lists `ar`, `en` and `x-default`, self-referencing, reciprocal, fully qualified, mirrored in the sitemap with `xhtml:link`.
5. Root `/`: 301 to `/ar/eg/` while one market is live; a 200 selector when two or more are live.
6. Legacy `/doctors/:id` 301s to the new URL; locale from `kx-lang` cookie, then Accept-Language, then `ar`.
7. Lifecycle: LIVE is 200 and indexable; paused is 200 with `noindex` (`PAUSED_LISTING`); delisted is 301 to the specialty hub when one exists and is indexable, else 404 and 410 once `delistedGoneAfterDays` (30) passed. The edge-case sweep saw 404 for unpublished providers (no 301 to the clinic page). The "not accepting bookings" button state is not verified.
8. Never indexed: authenticated pages, visit-status tokens, record shares, addresses, home-visit provider locations (districts only), review text beyond what moderation already publishes.

## 05 Rendering and caching
Chosen design (ADR-043 is Proposed; the design is As-built): a Vite SSR bundle served by the existing Kiorex API image in `ROLE=site`, cached by CloudFront. The logged-in SPA stays a SPA.

| Aspect | Design |
|---|---|
| Code | Second entry `entry-server.tsx`, `vite build --ssr`; a single shared route table for server and client entries; React 19 streaming |
| Status codes | 200, 301, 404, 410; `Link`, `ETag`; `Vary: Accept-Encoding` only (locale is in the path) |
| Hydration | The public tree hydrates without mismatch for all page types (test); the booking island and live slots are not a separate hydration boundary: HTML never promises a slot |
| Budget | At most 120 KB gzip JavaScript on public routes: 102.0 KB measured by `check:public-budget`; fonts self-hosted (As-built) |
| CDN | As designed (module flags added, not applied): behaviours for `/{ar,en}/*`, `/sitemap*.xml`, `/robots.txt`, `/.well-known/*` to the site role; `/api/*` to the API role; existing SPA assets unchanged. HTML `s-maxage=300`, `stale-while-revalidate=3600`; cache key is the path with a query whitelist; purge on `LISTING_STATUS_CHANGED` and `PROVIDER_PROFILE_UPDATED` |
| Indicative data | Slots and prices on public pages are indicative ("next available" from the indexed `nextSlotAt`); the booking island fetches live slots; HTML never promises a slot |
| Fallback | Flag `growth.ssr_public_pages` OFF returns the existing SPA shell while still serving `robots.txt` and the sitemap |
| Targets (NOT MEASURED: no Lighthouse run, no field data) | Field p75 on mobile 4G in Egypt: LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1 (confirm current Google thresholds when building); lab budget in CI (Lighthouse CI on three templates): performance at least 90, cached TTFB at most 200 ms |

## 06 Technical SEO
| Item | Rule |
|---|---|
| Sitemaps | As-built: index at `/sitemap.xml` and shards `/sitemaps/{type}-{cc}-{locale}-{n}.xml`, at most 10,000 URLs each (hard cap 50,000 URLs and 50 MB), `lastmod`, `xhtml:link` alternates, built from the same table as the renderer; cache purge on `PROFILE_UPDATED` and `LISTING_STATUS_CHANGED` (the CDN purge itself is a mock). The 15-minute freshness SLO is not measured |
| `robots.txt` | References the sitemap index; disallows private routes; robots is not a privacy control (private pages also send `X-Robots-Tag: noindex` and require sign-in) |
| Link previews | Open Graph and Twitter tags on every public page so WhatsApp and Facebook previews work; these crawlers do not run JavaScript |
| Images | Explicit width and height, responsive `srcset`, through the existing storage path (KX-25 rules) |
| Internal links | Hub to city to district to doctor; breadcrumbs; neighbouring districts; no sitewide footer link farms |
| Pagination | As-built: self-canonical, no `rel=prev/next`, page 2 and later `noindex,follow` unless `paginatedIndexable`, never in sitemaps |
| Well-known files (As-built; the answer is 404 in production until `APPLE_TEAM_ID` and the Android SHA-256 are configured) | `apple-app-site-association` and `assetlinks.json` served without redirect as `application/json` by the site role |
| Self-hosting | Fonts and scripts first-party on public pages; no third-party tags on authenticated or booking pages |

## 07 Structured data
One JSON-LD block per page, generated from the same data as the visible content; never data the user cannot see.

| Page | schema.org types | Notes |
|---|---|---|
| Doctor | As-built: `Physician` (`Dentist` by profession) with `knowsLanguage`; NO `medicalSpecialty`, `priceRange`, `address`, telephone, hours or `sameAs` (the audit test forbids them). `aggregateRating` only with at least `reviewMarkupMinCount` (5) reviews, one VISIBLE review on the page and `reviewMarkupEnabled` (default true in the config) | Review-snippet eligibility under Google's guidelines is NOT VERIFIED (Regulatory dependency): decide whether to set `reviewMarkupEnabled` false at launch |
| Clinic | As-built: `MedicalClinic`; nurse, physio and lab use `MedicalBusiness`; no hours and no `geo` (no provider has opted in) | Proposed: hours and `geo` after provider opt-in |
| Pharmacy, lab | As-built: `Pharmacy`; the lab page uses `MedicalBusiness`, not `MedicalLaboratory` | Brand pages only |
| Listings | `ItemList` of provider URLs, `BreadcrumbList` | |
| Home | As-built: `Organization`, `WebSite` (no `SearchAction`); FAQPage markup is deliberately not emitted | |

Forbidden in markup: doctor phone numbers unless the provider opted in, home addresses, patient names, flagged reviews, health claims such as "cures".

## 08 Thin-page guard and content
A generated page is indexable only if all hold (As-built; parameters in `GrowthConfigVersion kind=SEO`, extension keys allowed by contracts 1.11.0):
- `liveProviders` at or above `minLiveProviders` (default 3), with slots.
- At least `minUniqueBlocks` data-derived blocks: counts, median fee range, next available slot, languages, rating distribution, neighbouring districts.
- Overlap with a sibling page's provider list at most `maxSiblingSimilarity` (default 70 percent).
Otherwise the page is `noindex,follow`, absent from the sitemap and not linked from navigation. Entity pages (doctor, clinic, nurse, pharmacy, lab, home) are gated by LIVE status, not by counts; the specialty hub needs one LIVE provider. This follows Google's doorway and scaled-content policies and is a hard requirement, not a preference.

Content plan (As-built templates are PROPOSED copy and need CMO review; the calendar below is a hypothesis): FAQ blocks per template written once in Arabic and English and reviewed by the CMO for clinical accuracy; no medical advice; no "best doctor" claims (KX-14 voice rules); provider content published only under the provider-content licence in the provider terms (Regulatory dependency). No user-generated pages. Reviews appear only as published after moderation.

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
| Names | Staff app title "Kiorly: Clinic, Pharmacy & Lab", display name Kiorly, bundle `com.kiorly.app` (ADR-037; the repository and folder are now `kiorly`); patient app name per KX-19 | As-built naming for the staff app; patient store name Open decision |
| Listing text | Arabic and English listings, keywords from Search Console and store search terms, no health claims | Proposed |
| Screenshots | Arabic and English, RTL, light and dark; show real flows only | Proposed |
| Deep links | Universal and App Links for `kiorex.com` doctor and clinic URLs; Android install referrer for deferred links; iOS claim code | As-built in code and unit tests (package H); NOT verified on a device; needs Team ID and SHA-256 and a native rebuild |
| Ratings | In-app prompt after a completed visit, never during a safety or error state | Proposed |
| Measurement | Play Console and App Store Connect adapters (Phase 2, mock first) for installs and ratings, aggregate only | Roadmap |
| Static store pages | Already exist with hreflang in the staff app docs | As-built |

## 11 Measurement
Search Console (manual in Phase 1, API in Phase 2; the Phase 1 adapter returns labelled sample rows in mock mode and the real adapter refuses until credentials exist): impressions, clicks, indexed pages by template, queries by page, Core Web Vitals field data. First-party: touches of kind `ORGANIC_SEARCH`, organic share of attended new patients, organic bookings per provider (KX-32). Diagnostic only: indexation health of at least 90 percent of indexable URLs after 60 days. Rich Results Test and Search Console verification are a manual checklist (NEEDS_HUMAN).

## 12 Acceptance criteria, KPIs, risks, dependencies, open decisions
- Acceptance (GRW-P1-E and F), status in Rev 2.4: met locally except the Core Web Vitals lab budget, which is unmeasured. View-source of a doctor URL shows title, description, H1, JSON-LD and content without JavaScript; every route in the SPA is public-table or `noindex` (snapshot test); pages below the guard are `noindex,follow` and absent from sitemaps; `hreflang` pairs are reciprocal in AR and EN; no phone number unless the provider opted in; CWV lab budget met on three templates (NOT MET: unmeasured); legacy ids 301.
- KPIs: indexed pages passing the guard; impressions; organic share; organic bookings per provider; CWV pass rate; guard rejection rate.
- Risks: thin or duplicate pages (guard, no UGC); Arabic query uncertainty (validate first); review markup ineligible (omit); SSR on the shared image affecting API latency (role split, flag); incumbent dominance (long tail).
- Dependencies: slugs and thin-page guard (GRW-P1-F), SSR infrastructure (GRW-P1-E), `kiorex.com` host in the domain table, CDN module (`modules/aws/cdn-edge`, validate only), district list (NH-040), consent for any analytics.
- Open decisions: SSR as a separate service from day one; Kiorex Business Profile owner; patient store name; indexation of care-type pages before GKN2.
- Cross-references: KX-14 section 05, KX-19 section 03, KX-24 (previews and sends), KX-28 sections 04 and 05.
