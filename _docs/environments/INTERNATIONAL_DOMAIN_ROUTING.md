# International domain routing

ADR-059 (Proposed). A new country is launched by configuration, not by a new codebase, host or deployment. Market configuration itself is ADR-055 (`MARKET_PROFILE`, Proposed) and the per-market packs of ADR-014. This document only fixes how countries appear in URLs. Hostnames: `../registry/service-url-registry.yaml` (no country-specific host exists or is needed).

## 1. Kiorex (patients): country in the path of the marketplace host

| Item | Rule |
|---|---|
| Host | the marketplace host of the environment (`kiorex.com` in production, `test.kiorex.com` in kx-test); one host for every country |
| Canonical URL (existing, as built) | `/{locale}/{cc}/...` for example `/ar/eg/doctor/<slug>`, locale `ar` or `en`, country code lowercase ISO 3166-1 alpha-2 (`kiorex-account/config/domains.json` `appLinks.patient` paths; patient app link patterns; SEO canonical host) |
| Short entry routes (founder brief) | `/eg`, `/sa`, `/ae`, `/kw`, `/qa`, `/bh`, `/om`, `/gb` |
| Entry route behaviour | `GET /{cc}` answers **302** to `/{locale}/{cc}/` where locale comes from the saved preference, then `Accept-Language`, then the market's default language. It is a convenience and marketing URL, never the canonical SEO URL, so there is no duplicate content. The bare apex `/` shows a country chooser or redirects by saved choice, never by IP alone |
| Unknown or disabled country | 404 with a country chooser; a country becomes routable only when its market configuration is published and its launch gate recorded |
| SEO | `hreflang` alternates for every enabled `{locale}/{cc}` combination plus `x-default`; sitemap per country; canonical always the long form (ADR-055 stores the "canonical URL segment" per market); non-production serves no sitemap |
| Deep links | patient app association paths cover `/{locale}/{cc}/doctor/*`, `/clinic/*`, `/invite/*` and the existing short paths; the entry routes `/{cc}` are not claimed by the app |

Why not country subdomains (`eg.kiorex.com`) or country domains: one certificate wildcard level, one SEO domain authority, no per-country DNS and certificates, and consistent with the existing as-built URLs. Country domains (`kiorex.com.eg`) are a later, optional marketing decision; they would be additional entries in the registry that 301 to the path form.

Initial set: only Egypt is live. SA and AE exist in code defaults; KW, QA, BH, OM and GB are listed by the founder as targets and do not exist in configuration yet (ADR-055 lists EG, SA, AE and the synthetic ZY). Adding a country is a configuration publication, not a release.

## 2. Kiorly (providers): country comes from the tenant, not the host

Kiorly hosts (`app`, `clinics`, `pharmacies`, `labs`, `api`) are the same for every country. The country of a session is resolved from the **organisation and tenant configuration** (market pack and `MARKET_PROFILE` bound to the organisation), never from the subdomain. Reasons: a clinic group may span countries, hosts stay bookmarkable when a clinic moves country, and no per-country certificates or deployments are needed.

## 3. What is country-specific (all configuration)

Language and direction; currency and tax lines (never tax-authority integration, rule 1); payment providers and settlement rails (for example CBE bank-only payout in Egypt); communication providers (WhatsApp, SMS aggregator, e-mail, push); healthcare regulation, licensing and professional verification; data residency and regional infrastructure; subscription pricing; marketplace commission models (rate policy is per organisation type and per market, maker-checker, counsel gate per market); feature availability (flags with country scope); working days and time zones; legal agreements and consent text per market (AR/EN versioned, no wording shipped).

## 4. Public domain names versus hosting region

The URL says nothing about where data lives. A market's `data cell` (ADR-055, ADR-015) decides the origin region: today every market maps to the Frankfurt cell, and there is one cell. When a market needs residency in another region, the cell is added behind the same hostname:
- CloudFront origin selection by cell attribute (path or a lookup at the API), or
- a second regional API origin chosen by the tenant's cell, with Route 53 latency or geolocation records **only if** the founder and counsel approve (a decision still open, ADR-055 "Open").
No hostname changes for end users in either case. Until a second cell exists, do not build cell routing (cost and complexity).

## 5. Currency, locale and time zone are not derived from the host

They come from the market configuration and the user's explicit settings. The host and the path are routing hints only.

## 6. Launching a country (checklist, no code release)

1. Counsel work for the market (licence, consent regime, health-advertising rules, data residency): ADR-055 and KX-15; nothing is invented here.
2. Market profile drafted in the wizard, approved by a second super admin (maker-checker).
3. Languages, currency, tax lines, providers (mock first), time zone and working week set.
4. Launch gate recorded by a person; flags with the country scope enabled for a cohort.
5. The `/{cc}` entry route and the `{locale}/{cc}` pages become routable; sitemap and `hreflang` publish; registry unchanged.
