# UI/UX review: Kiorly landing page (test.kiorly.com), 28 Nov 2026

Scope: `kiorex-account/apps/kiorly-site`, both languages, widths 360 to 2560, system Chrome via Playwright, axe, keyboard, reduced motion. The site is light-theme only by design (`color-scheme: light`), so there is no dark mode to review. No cookie or consent banner exists (nothing is stored in the browser except the language choice). Screenshots: `_private/ui-review/landing/` (`before/`, `live-before/`, `live-after/`; git-ignored).

Root cause of the reported bug: `frame()` in `src/art.ts` mirrored the x coordinate of every label for Arabic AND swapped `text-anchor` start/end. SVG start/end are already relative to the text direction under `direction: rtl`, so the swap flipped them back: Arabic Kiorly Clinic, Pharmacy and Lab labels ran across the node icons. Fix: set `direction` explicitly on the svg and mirror x only. This also corrected every other illustration label.

| # | Issue | Severity | Status | Why / note |
|---|---|---|---|---|
| 1 | Arabic connection diagram: product labels on top of node icons (double-flipped text-anchor) | High | Fixed | Root cause above; e2e `diagram.spec.ts` asserts node, icon and arrow boxes mirror within 0.4% at 390/768/1440 and that labels stay inside nodes, clear of icons, unclipped |
| 2 | Connection diagram text about 4px on phones (viewBox 800 wide) in both languages | High | Fixed | Portrait variant (360 wide) shown at 640px and below; wide one hidden; same mirror test covers it |
| 3 | Illustration labels drawn over placeholder bars ("New booking", "Lab result ready", "Pharmacy order", "Rx verified", "Today", "Home visit", "14:30 Visit", "Organisation", "Branch n"), both languages | Medium | Fixed | Bars removed under text; hero "Kiorly Clinic" label moved into the window title bar; staff "View" centred on its button |
| 4 | Menu kept FAQ marked while reading Join us (and the standalone/connected section) | Medium | Fixed | Scroll spy now observes every section; sections without a link clear the mark |
| 5 | Step indicator items had no accessible name on phones (labels `display:none`) | Medium | Fixed | Labels visually hidden instead, still read by screen readers |
| 6 | Product tabs on phones/tablets: six tabs in a horizontal strip with no hint that more exist | Medium | Fixed | Grid of 2 (phone) or 3 (tablet) columns; strip kept on desktop |
| 7 | Touch targets under 44px: header Join us / Sign in (40), logo link (37), footer links (about 30) | Low | Fixed | 44px minimum |
| 8 | Provider type choices: one long column of nine on phones | Low | Fixed | Two columns |
| 9 | Preview strip outside any landmark (axe "region") | Low | Fixed | Now a labelled `aside` (preview builds only) |
| 10 | Heading widows ("ready" alone on a line) | Low | Fixed | `text-wrap: balance` |
| 11 | Hero and product mock-up text is small on phones (6 px and below) | Low | Not fixed | Decorative, illustrative, with a text alternative; enlarging needs a redesign of the art |
| 12 | Dark mode | Info | Not applicable | Light only by design |
| 13 | Plans section | Info | Not touched | Being changed by another agent; checked still present on the live page after deploy |

Checked and fine: RTL layout of header, hero, tabs (arrow keys mirror), journeys connectors, FAQ, form (Back/Next sides, step line direction, select arrow), hero CTA arrow flips, phone and e-mail fields forced LTR, review values `dir=auto`, reference `dir=ltr`, skip link, focus outlines (3px), reduced motion test, no-JavaScript fallback, no horizontal scroll at 360, 390, 768, 1024, 1440, 1920 and 2560 in both languages, axe clean (EN and AR, 390 and 1440) after the animation settles.

Not tested: real iOS Safari and Firefox rendering (only Chrome), screen reader speech, Windows high-contrast mode, language switcher on a real Arabic-locale device.
