# UI/UX review: Kiorex landing, entry and onboarding (28 Nov 2026)

Reviewer role: senior UI/UX designer. Subject: the patient web `test.kiorex.com` (platform commits `26c8441` and `bbc9827`, live on kx-test). Screenshots: `_private/ui-review/kiorex-landing/before/` (the live page before, 16 files) and `after/` (landing at 360/390/768/1024/1440/1920 x EN/AR x light/dark; entry, the six onboarding steps, done and home at 390 and 1440 x EN/AR x light/dark). The "after" set is produced by `e2e/onboarding/review.spec.ts` against a mock Passport and API (so it is repeatable and costs no phone codes); the live behaviour is proven by `e2e/kx-test/tests/18-patient-onboarding.spec.ts`.

## What was covered, and what was not

| Covered | Not covered |
|---|---|
| Widths 360, 390, 768, 1024, 1440, 1920; English and Arabic (RTL); light and dark | A real phone, Safari, a screen reader (VoiceOver/TalkBack/NVDA), 200 percent zoom |
| axe-core 4 (WCAG 2 A/AA/2.1 AA, colour contrast on) on the landing (4 combinations), the entry page and every onboarding step in EN and AR, desktop and Pixel 7 profile: 40 specs pass | Lighthouse score (CPU/network traces below are Playwright CDP, not Lighthouse) |
| Keyboard: skip link first, tab order, visible focus ring, tabs on the entry page with arrow keys | Dark-mode screenshots of every onboarding step (step 3 and the entry page only) |
| Reduced motion: content visible at once, logo pulse animation duration collapses (asserted) | Real-device motion smoothness |
| Throttled performance on the LIVE page (390 px, DPR 2): fast, fast 4G + CPU x4, slow 3G + CPU x4 | Perf of signed-in screens (unchanged by this work) |
| Onboarding edge cases: save failure keeps the answer and retries, resume at the stored step, skip all, existing member skips, cancelled and expired and required sign-in, hostile `returnTo` | Passport's own pages (another agent owns them; only the hand-off was exercised live) |

## Findings on the OLD page (before) and what was done

| # | Finding | Severity | Status |
|---|---|---|---|
| L1 | Hero art: the KIOREX mark was scaled 2.1x inside an orb, so its bars ran past the orb, the coral pulse was clipped or missing mid-draw and drew outside the disc; the three claim chips were absolutely positioned over the pulse and bars ("Real slots" sat on the pulse tail, "Verified, not just listed" over the bars) | Major (the founder's report) | Fixed: the hero visual is a CSS phone showing the real shape of the booking screen; the claims left the artwork |
| L2 | The three claims existed only inside that artwork and only from 1024 px up: on phones and tablets they were absent from the hero | Major | Fixed: one dedicated row of three equal cards under the hero at every width (stacked below 768), start edge shared with the logo and the headline in LTR and RTL (asserted by a test that measures the logo's INK edge, the h1 and the row) |
| L3 | The hero text sat inside an inset card, ~50 px right of the header logo's edge | Moderate | Fixed: no inset card, logo, headline and claims share the page gutter |
| L4 | Header logo static; hero mark's pulse draw ran under a scale transform | Moderate | Fixed: `animated` on the header lockup and the phone's mark: the pulse draws once on load (geometry from `KiorexLogo`, verbatim from the logo spec, files untouched), then the bars breathe very slightly (4 staggered groups, 4.8 s); `prefers-reduced-motion` removes both |
| L5 | Sign in jumped straight to Passport; no Join us; provider link was a bare text URL at the bottom | Major | Fixed: header Sign in and Join us, hero Find care and Join us, "For providers" in the header nav, in the Kiorly section and in the footer, all to the Kiorly site join form (the form is not duplicated) |
| L6 | Kiorly logo on the page | n/a | Checked: no Kiorly logo or asset exists in the patient web (images, SVG labels, manifest, favicon, og image checked on the live page); the only Kiorly reference was the text link to the Clinic host. The new page shows the word Kiorly in text only, as the brand rule asks |
| L7 | "Book a verified doctor in under two minutes" is an unmeasured promise | Moderate | Replaced by "Find a verified doctor. Book a real slot." |
| L8 | Footer: no legal links | Minor | Preferences link kept; terms of use and privacy policy do not exist yet, so the footer says so plainly instead of linking to nothing (open founder item) |

## Issues found while building and fixed before release

| Issue | Severity | Fix |
|---|---|---|
| Header at 390 and 360 px (Arabic): Join us clipped off the screen edge | Major | Theme toggle moves to the footer below 480 px for signed-out visitors, Sign in becomes a text button; no overflow at 360 (asserted) |
| Warning and success text on the soft tints measured 3.68:1 (axe) | Serious | Notices use the foreground colour with a coloured dot or border |
| "Skip setup" unmounted the flow before the confirmation (the save made the member look onboarded) | Moderate | The flow marks itself started before saving; covered by a test |
| First onboarding draft pre-ticked reminders | Privacy | Nothing is pre-ticked, marketing included; asserted (`prefsPuts` contains no marketing) |
| Screenshots showed blank sections (scroll reveal) | Tooling only | The matrix scrolls slowly; the page itself reveals correctly (checked: every `.kx-reveal` ends visible) |

## Design decisions worth knowing

* Mockup content is an illustration (skeleton bars, three example slot times, no price, no doctor, no rating, labelled `role="img"` with an illustration name). No counters: no number on the page is a statistic; a test fails the build on a number followed by `+`, `%`, `k`, an EGP amount, "testimonial" or a star.
* Market status is read from `/markets`: while `market.eg.live` is closed the hero shows "Pilot: booking opens when Egypt launches. Browsing is open now."; the entry page and the onboarding country step say "Launching soon". Verified on the live host against the API.
* The three claims keep the founder's wording and are true in the product: bookable = LIVE listing after Kiorex verification (ON-03), slots from the clinic's own schedule (Clinic wired), fee and deposit shown before booking. The old line "passed syndicate-number and licence checks" was softened to what the code guarantees ("completed Kiorex verification").
* Digits are Western in Arabic and English; Plus Jakarta Sans for Latin with IBM Plex Sans Arabic; Arabic spelled كيوريكس; tokens only (no new colours); coral is used for the pulse, divider and the one CTA fill, never for body text.

## Performance (LIVE, 390 px, DPR 2, headless Chromium, 28 Nov 2026)

| Profile | LCP EN | LCP AR | CLS |
|---|---|---|---|
| no throttle | 1.13 s | 1.30 s | 0.000 |
| fast 4G (9 Mbit, 70 ms) + CPU x4 (a mid phone) | 1.56 s | 1.63 s | 0.000 |
| slow 3G (400 kbit, 400 ms) + CPU x4 | 7.8 s | 9.3 s | 0.000 |

Target LCP < 2.5 s on a mid phone is met on 4G. On slow 3G it is not: the page is a client-rendered SPA (about 158 KB gzip entry chunk plus the shared chunks and fonts), so first content waits for JavaScript. The map library (about 300 KB gzip) is not loaded on the landing page. Recommendation: serve the landing page as a prerendered or server-rendered public page (the repo already has the SSR public-site pipeline for `/ar/eg` pages) and keep the SPA for signed-in screens; not done here because it changes hosting and routing of `/` (founder/engineering decision). No image is used on the page (CSS and SVG only), so there is nothing to compress; fonts are the existing self-hosted woff2 with `font-display: swap`.

## Open items (not fixed)

1. Slow-3G LCP (above): needs prerendering of `/`.
2. The cookie banner (existing component) covers the bottom of the first viewport on short screens; the claims row sits just below the fold at 900 px high. Not changed (consent UI belongs to the consent work); the row is reachable by scroll and keyboard.
3. Terms of use and privacy policy pages do not exist: footer states "published at launch, after legal review". Founder/counsel decision; no wording invented.
4. Passport may ignore `intent=register` until `intent` is added to its `extraParams` (see `_docs/PASSPORT_ENTRY_CONTRACT.md`); the flow does not depend on it.
5. Not run: screen reader, real devices, Safari/Firefox, 200 percent zoom.
6. Draft-wording chip ("not yet approved") on the cookie banner is an existing non-production marker.
