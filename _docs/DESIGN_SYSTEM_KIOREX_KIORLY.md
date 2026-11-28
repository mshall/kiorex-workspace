# Kiorex and Kiorly design system (one language, two products) - 28 Nov 2026

Owner: Chief UI/UX Design Officer role. Source of truth for values: `_brand/tokens.json` (generated to `tokens.css`, `tailwind-preset.cjs`, `theme.ts`, `shadcn-bridge.css`). This file says HOW to use them. Brand rules (logo, palette, type, numerals) stay in `_brand/README.md` and `_brand/KIOREX_LOGO_SPEC_v2.md`: this document never overrides them.

## 1. One language, two voices

| | Kiorex (patients, Passport, Kiorex ops) | Kiorly (Clinic, Pharmacy, Lab, Nurse, Home, site, Kiorly admin, staff app) |
|---|---|---|
| Primary | Indigo `#3730A3` (dark `#6366F1`) | Indigo `#3730A3`, Periwinkle `#818CF8` second chevron |
| Secondary | Ocean `#0369A1` (dark `#38BDF8`) | Product accent used sparingly: Clinic teal, Lab violet, Pharmacy green, Nurse rose |
| Graphic highlight | Coral `#E8735E` (graphic only, never small text; text uses `--kx-brand-coral-text` `#8F4944`) | same |
| Ground | `#F4F6FC`, dark surface `#0F172A` | same |
| Latin type | Plus Jakarta Sans 400/500/600/700 | Jost |
| Arabic type | IBM Plex Sans Arabic | IBM Plex Sans Arabic |
| Digits | Western 0-9 everywhere (Arabic UI too) | same (Clinic numerals toggle is a user choice) |
| Logo | 8-channel waveform (spec v2) | chevron marks, product lockups |

What makes them one family: the same token scale (space, radius, elevation, motion, focus), the same component anatomy (indigo primary button, white card on ground, soft status chips, the coral pulse line as the only decorative motif), the same sign-in layout (indigo brand panel with grid, card on the other side), the same motion rules below. What differs is only font, logo and accent.

## 2. Tokens (use these, never raw values)

| Group | Tokens | Rule |
|---|---|---|
| Space | 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 px (`--kx-space-*`, Tailwind 0.5 to 24) | 4 px base. Card padding 16 (phone) / 24 (desktop). Page gutter 16 phone, 24 tablet, container 1200. |
| Radius | xs 4, sm 8, md 12, lg 16, xl 24, 2xl 32, full | Inputs and buttons md (12). Cards lg (16). Sheets and hero panels xl. Chips full. |
| Elevation | 0 to 4 (light and dark variants, dark adds a 1 px light edge) | Cards 1, hover 3, popovers 3, dialogs and sheets 4. Never stack a shadow on a bordered table row. |
| Type scale | xs 12/16, sm 14/20, base 16/24, lg 18/28, xl 20/28, 2xl 24/32, 3xl 30/38, 4xl 36 | Body never below 14 (dense tables 13 only with `tabular-nums`). Arabic line-height 1.7, no letter-spacing, no uppercase. Eyebrows: 12 px, tracking 0.14em, Latin only. |
| Touch | 44 px minimum (`--kx-touch-min`); Nurse 56 | Inline links inside text are the only exception (WCAG 2.5.8 inline exemption). |
| Focus | 2 px solid `--kx-focus` (indigo), offset 2 | Always visible on keyboard focus; never `outline: none` without a replacement. |
| Blur | 6 / 12 / 24 | Glass headers only (`kx-glass`), never behind long text. |

### States (every interactive component has all of these)

default, hover (colour or 1 px lift, `@media (hover:hover)` only), pressed (scale 0.98, 80 to 150 ms), focus-visible (ring), disabled (opacity 0.5, no pointer events, never the only signal of "why"), loading (spinner inside the button, width kept, label stays), error (danger border + text under the field, `aria-describedby`), success (check, soft green chip or toast).

### Status colours

success `#15803D`, warning `#B45309`, danger `#B91C1C`, info `#0369A1`; each with a soft background and a dark-mode text lift (`semantic.*.textDark`). Status is never colour only: always icon or word.

## 3. Motion guidelines

Principle: motion explains a change or draws the eye to ONE thing; it never delays work. Everything below animates `transform` and `opacity` only (no layout properties, no box-shadow animation on large areas except a hover on cards).

### Tokens

| Token | Value | Use |
|---|---|---|
| `--kx-dur-instant` | 80 ms | press feedback, checkbox ticks |
| `--kx-dur-fast` | 150 ms | hover, focus, chip toggles, tooltip |
| `--kx-dur-base` | 200 ms | cards, tabs, accordion, dropdown |
| `--kx-dur-slow` | 250 ms | page entry, sheets, dialogs, toasts |
| `--kx-dur-slower` | 400 ms | hero entrances, step changes in onboarding |
| `--kx-dur-pulse` | 1400 ms | the coral pulse line drawing in (brand moment) |
| `--kx-ease-standard` | `cubic-bezier(.2,0,0,1)` | most transitions |
| `--kx-ease-decelerate` | `cubic-bezier(0,0,0,1)` | things that ENTER (page, sheet, toast, reveal) |
| `--kx-ease-accelerate` | `cubic-bezier(.3,0,1,1)` | things that LEAVE |
| `--kx-ease-spring` | `cubic-bezier(.34,1.4,.64,1)` | small confirmations only (check pop, code cell) |

### What animates, when, how long

| Pattern | Spec | Where |
|---|---|---|
| Button press | scale .98, 80-150 ms | every button (`Button` component) |
| Hover | colour/border 150 ms; interactive cards lift 1-3 px with shadow 3, pointer devices only | cards, plan cards, chips |
| Page entry | `kx-page`: 8-12 px rise + fade, 250 ms decelerate, once per route | signed-in layouts |
| Scroll reveal | 18 px rise + fade, 600 ms decelerate, 80 ms stagger per item (`--i`), max 6 items per group, once | public landing pages only, never inside work screens |
| Bottom sheet (consent, mobile menus) | translate 24 px + fade, 250 ms decelerate, delayed 400 ms after load so it never competes with first paint | `kx-sheet-up` |
| Dialog | fade + 4 % scale, 200 ms | all dialogs |
| Toast | slide 12 px + fade 250 ms in, 150 ms out; success 4 s, error stays until dismissed; `role="status"` (error `role="alert"`) | `sonner` toasts |
| Skeleton | shimmer 1.6 s linear, shapes match the final layout; show after 300 ms of waiting, never for under 300 ms | lists, cards, tables |
| Progress | determinate bars animate width via `transform: scaleX`; onboarding steps 400 ms slide, previous answer kept on failure | onboarding, imports |
| Number counters | ONLY for real, fetched data, once, 700 ms; never for marketing claims or placeholders | dashboards, never landing |
| Brand pulse | the coral ECG line draws once (1.4 s) on the first view of a hero or sign-in; loops only on `kx-pulse-loop` splash/empty-state, max 1 per screen | logo, hero, sign-in panel |
| Ambient (orbs, float) | 6-9 s ease-in-out, transform only, decorative, hidden from reduced-motion users | hero panels only |
| Error | 300 ms horizontal shake on the field (translateX 4 px), plus text; never colour only | Passport, forms |

### Never

animate more than one attention-grabber per viewport; loop animation in a work screen (tables, forms, queues); animate on every keystroke; auto-play anything with sound; animate layout (width/height/top/left) or `filter` on large areas; run animation while the tab is hidden; delay content more than 400 ms for an effect; use motion as the only indication of a state.

### Reduced motion (hard rule)

`@media (prefers-reduced-motion: reduce)`: tokens.css collapses every duration token to 0 and forces `animation-duration` and `transition-duration` to .01 ms, one iteration. Reveals show their final state immediately (`.kx-reveal`, `.reveal.is-in` fallbacks). Looping and ambient motion is removed, not slowed. Information that motion conveyed (progress, success) must still appear as text or an icon. Every new animation is tested by emulating `reduced-motion: reduce` once.

### Performance budget

Only `transform` and `opacity`; `will-change` only during an active animation; no animation library on public pages (CSS and one IntersectionObserver); no animation work while a page is loading data; target 60 fps on a mid-range phone (4x CPU throttle check in the landing review).

## 4. Components (anatomy shared across products)

| Component | Rule |
|---|---|
| Primary button | Indigo fill, white text, radius 12, min height 44, one per view. Secondary: outline indigo. Destructive: danger fill only inside a confirm dialog. |
| Fields | Label above (never placeholder-only), 44 px high, border `--kx-input` (3:1), error text under the field with icon, hint under label, `autocomplete` set, correct `inputmode` (tel, numeric, email), auto-focus the first field of a flow only when it is the single purpose of the screen. Inline validation on blur, never on first keystroke. |
| Phone and code | Phone: `+20` default country, LTR even in Arabic, spaced groups. Code: six cells over ONE real input (paste, SMS autofill), focus moves to Verify on the sixth digit, resend with a visible 30 s countdown. |
| Tables | Sticky header, 48 px rows (40 compact), hover row tint, tabular numerals, right-aligned amounts (start-aligned in RTL logic: use logical properties), machine codes shown as words, empty state with next action, bulk actions appear in a bar above the table after selection, selection count announced to screen readers, 24 px minimum checkbox hit area. |
| Filters | Chips for the 3 most used, "More filters" in a sheet on phones; active filters shown and clearable; result count always visible. |
| Empty state | Icon, one sentence on why it is empty, one primary action. Never a blank panel. |
| Error state | What happened, whether data is safe, one retry action; keep the user's input. |
| Success state | Short, specific ("Booked for Sun 10:30"), next step offered; toast for background success, inline for a completed flow. |
| Navigation | Top bar + sidebar (desktop) / bottom tabs or drawer (phone). Active item has icon + weight + indicator (not colour only). Page title (h1) matches the nav label and the tab title `<screen> - <product>`. |
| Brand panel | Indigo ground, hairline grid, faint chevron watermark, three trust lines, coral pulse at the bottom: used by Passport, Kiorly Home, Clinic, Pharmacy, Lab sign-in. |

## 5. RTL, dark mode, responsive, accessibility

* RTL: logical properties only (`ms-*`, `ps-*`, `inset-inline-start`), icons that imply direction (arrows, chevrons) mirror, the logo and numbers/phones/codes do not; Arabic copy is written, not machine-mirrored.
* Dark mode: `[data-theme=dark]` / `.dark` or system; surfaces `#0F172A` family, accent lifts (`#6366F1`, `#38BDF8`, coral `#F08A75`), elevation by edge light not shadow, images and mock-ups checked, no pure black.
* Breakpoints: 360 (floor, no horizontal scroll), 390, 768, 1024, 1440, 1920 (content capped at 1200 container, backgrounds full-bleed).
* Accessibility: WCAG 2.2 AA: text contrast 4.5:1 (large 3:1, UI components 3:1), focus ring always, skip link first, landmarks (`header`, `nav`, `main`, `footer`), one `h1`, heading order, label-in-name, per-screen titles, `lang`/`dir`, live regions for toasts and async results, target size 44 (24 absolute floor), no content only on hover.
* Copy: plain, specific, no invented numbers, prices, claims or legal wording; the legal and commission text only from the approved sources (counsel gate).

## 6. How to add or change UI

1. Use tokens; if a value is missing, add it to `_brand/tokens.json` and rebuild (`node scripts/build-tokens.cjs`), do not hard-code it in an app.
2. Reuse the app's component before writing a new one; follow section 4.
3. Add motion only from section 3, state why it helps (attention or comprehension) in the commit message.
4. Run the app's unit tests, the axe and overflow checks (`e2e/kx-test/ui-review/cdo-probe.mjs` for public pages), emulate reduced motion, check EN/AR and light/dark at 360 and 1440.
5. Kiorly static site: no inline `style="..."` attributes (CloudFront CSP is `style-src 'self'`); use classes or attribute selectors (a test enforces it).
