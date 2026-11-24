# Kiorex brand kit (`_brand/`)

Single source of truth for logo, tokens and generated assets. Palette: Indigo `#3730A3`, Ocean `#0369A1`, Coral pulse `#E8735E`, Ground `#F4F6FC`. Nurse edition keeps Nurse Rose `#E11D48` as its only accent. Each Kiorly product has its OWN accent (below). **Never redraw the logo** — use the components/SVGs here.

## Layout
| Path | What |
|---|---|
| `tokens.json` | ONE source: ramps, semantic, light/dark themes, type scale, spacing, radius, elevation, motion, focus |
| `tokens.css` | generated CSS vars (`--kx-*`), `[data-theme=dark]`/`.dark` (+ `prefers-color-scheme` when `data-theme="auto"`), Arabic font switch, coral focus ring, reduced-motion, `.kx-pulse-draw`, `.kx-skeleton`, `.kx-tnum` |
| `shadcn-bridge.css` | generated HSL-triplet vars (`--background`, `--primary`, `--ring`...) for shadcn/Radix-style Tailwind configs |
| `tailwind-preset.cjs` | generated Tailwind preset (`kx-*` colours map to the CSS vars, so dark mode is automatic) |
| `theme.ts` | generated React Native theme (`theme`, `colorsFor(scheme)`, `shadow(level)`) |
| `components/web/KiorexLogo.tsx` | `<KiorexLogo variant="lockup|mark|wordmark" tone="color|mono|inverse" product="kiorex|clinic|lab|pharmacy|passport|nurse" animated />` (`"kiorly"` = deprecated alias of `clinic`), `<PulseLine/>` |
| `components/native/KiorexLogo.tsx` | same API via `react-native-svg` |
| `components/shared/` | scene geometry + outlined Jost wordmarks (KIOREX, KIORLY, CLINIC, LAB, PHARMACY, PASSPORT, NURSE, BY KIOREX) |
| `dist/` | static SVG set (`svg/`: `kiorex|clinic|lab|pharmacy|passport|nurse` x lockup/mark/wordmark x color/mono/inverse), `products/{clinic,lab,pharmacy}/` (per-product favicon, ico, apple-touch, pwa, og-image, expo set with the accent), favicons, `favicon.ico`, apple-touch, `pwa/` (192/512/maskable), `og-image.png`, `manifest.webmanifest`, `expo/` (icon, adaptive-foreground, splash-icon[-dark], favicon), `svg/letterhead.svg` |
| `scripts/` | `vendor.cjs` (copies the kit + per-product assets into the three web apps), `build-tokens.cjs`, `gen-wordmarks.cjs` (opentype.js, Jost Medium), `gen-assets.cjs` (sharp) |

Rebuild: `cd _brand && node scripts/build-tokens.cjs && node scripts/gen-wordmarks.cjs && node scripts/gen-assets.cjs && node scripts/vendor.cjs` (vendor.cjs re-copies into clinics-management, kiorly-lab, kiorly-pharmacy web apps; it never touches app code, locales or `ui-kit.tsx`). Scripts find `sharp`/`opentype.js` via `scripts/resolve.cjs` (or `npm i` here).

## Vendoring into a repo
Repos are separate git repos, so **copy** (vendor) — do not symlink. Put the files under `<app>/src/brand/` (or `apps/web/src/brand`):
1. `tokens.css`, `tailwind-preset.cjs` (web) or `theme.ts` (RN), and `components/{shared,web|native}` (keep the relative `../shared` import).
2. Web: `@import "./brand/tokens.css";` first in the global CSS; in `tailwind.config` add `presets: [require("./src/brand/tailwind-preset.cjs")]`; set `<html lang dir data-theme>`; load Jost + IBM Plex Sans Arabic (next/font or `@expo-google-fonts/*`).
3. Copy needed files from `dist/` into `public/` (favicon.ico, favicon.svg, apple-touch-icon.png, pwa/*, og-image.png, manifest) or `assets/` (Expo: `expo/icon.png`, `expo/adaptive-foreground.png` + background `#3730A3`, `expo/splash-icon.png`).
4. Re-vendor when `_brand` changes; keep the header comment of generated files so diffs are obvious.
## Product lockups and accents
The Kiorly product lockup always reads **"Kiorly <Product> by Kiorex"**: line 1 `KIORLY`, line 2 `<PRODUCT>` then `BY KIOREX` (muted). Each product has its own accent, applied the way the X of KIOREX is Ocean: the right-hand chevron of the mark, the last letter of KIORLY (Y) and the ENTIRE product word (Clinic / Lab / Pharmacy), all in the one accent; K-I-O-R-L stay Indigo. Indigo left chevron, coral pulse, coral rule and wordmark rules are unchanged.

| Product | `product=` | Accent (light) | Text-safe (light, AA) | Dark / inverse | Lockup text (EN / AR) |
|---|---|---|---|---|---|
| Kiorly Clinic | `clinic` | Teal `#0D9488` | `#0F766E` | `#2DD4BF` | Kiorly Clinic by Kiorex / كيورلي للعيادات من كيوريكس |
| Kiorly Lab | `lab` | Violet `#7C3AED` | `#6D28D9` | `#A78BFA` | Kiorly Lab by Kiorex / كيورلي لاب من كيوريكس |
| Kiorly Pharmacy | `pharmacy` | Green `#16A34A` | `#15803D` | `#4ADE80` | Kiorly Pharmacy by Kiorex / كيورلي للصيدليات من كيوريكس |
| Kiorly Nurse (edition of Clinic) | `nurse` | Nurse Rose `#E11D48` (unchanged look, `NURSE` sub-line) | | `#FB7185` | Kiorly Nurse by Kiorex |
| Kiorex Passport | `passport` | Ocean (unchanged) | | | Kiorex Passport |

Tokens: `--kx-product-{clinic,lab,pharmacy}` (graphic use: logo, chevrons, large marks; >= 3:1 on Ground `#F4F6FC`: teal 3.47, violet 5.27, green 3.05) and `--kx-product-*-text` (AA for body text on light; equals the dark value in dark mode); Tailwind `kx-product-*`; `theme.products` in `theme.ts`. Use accents sparingly (logo, product badge, active-tab underline), never as the primary action colour: Indigo stays primary.

In an app, the one product-specific line is `KIORLY_PRODUCT` in `src/brand/ui-kit.tsx` (`KiorlyBrand` / `KiorlyMark` read it); the web logo is `<KiorexLogo product="clinic|lab|pharmacy" lang={i18n.language} />`.

## Kiorly staff app identity (founder, 23 Nov 2026, ADR-037)
The staff app is plain **Kiorly** (modules Clinic, Nurse, Pharmacy, Lab). Store title `Kiorly: Clinic, Pharmacy & Lab`; home-screen label `Kiorly`; Arabic `كيورلي`. "by Kiorex" appears only on the splash screen and in About, never in the icon label or the store name. The icon is the Kiorex mark (two chevrons and the coral pulse) with the **Kiorly accent**, not a product colour (no Clinic teal, Lab violet or Pharmacy green). The web products keep their `Kiorly Clinic by Kiorex` / `Kiorly Lab by Kiorex` / `Kiorly Pharmacy by Kiorex` lockups. Artwork for the app icon is made from the existing SVG assets, never redrawn.

## Arabic lockups (founder, 20 Nov 2026)
The ARTWORK (chevrons + coral pulse + rule) is identical; every WORD is Arabic in the Arabic UI. Spelling of Kiorex is **كيوريكس** everywhere (the founder's form; it matches the Passport name «كيوريكس باسبورت» and the Latin letters; older strings used كيوركس and were normalised in the three Kiorly web apps' `ar.json`; the Kiorex platform apps still use كيوركس: align them separately).
| Product | Arabic lockup |
|---|---|
| Kiorly Clinic | كيورلي للعيادات / من كيوريكس |
| Kiorly Lab | كيورلي لاب / من كيوريكس |
| Kiorly Pharmacy | كيورلي للصيدليات / من كيوريكس |
Layout (RTL): words | coral rule | mark, so the mark sits on the right (start side); the artwork is not mirrored. Line 1 `كيورلي`, line 2 product word (accent) then `من كيوريكس` (muted), right-aligned. Colour rule mirrors Latin: the final `ي` of كيورلي + the ENTIRE product word in the product accent, `كيورل` Indigo. Kiorly Nurse, Kiorex and Passport have no Arabic wordmark yet (Nurse's Arabic name is open question Q12): they stay Latin.
- Select it with `lang`: `buildScene(variant, product, "ar")` or `<KiorexLogo lang="ar" />` (any `ar*`); `KiorlyBrand` follows `i18n.language`. Aria-label becomes the Arabic name.
- Static files: `dist/svg/<product>-{lockup,wordmark}-ar[-mono|-inverse].svg`; vendored as `public/kiorly-lockup-ar[-mono|-inverse].svg`.
- Shaping: `scripts/gen-wordmarks-ar.cjs` shapes with HarfBuzz (`harfbuzzjs`, full Arabic GSUB/GPOS + joining; opentype.js cannot) and emits outlined paths to `components/shared/wordmarks-ar.generated.ts` (rebuild: `node scripts/gen-wordmarks-ar.cjs && node -e 'require("./scripts/gen-svgs.cjs")("dist/svg")'`; needs `npm i harfbuzzjs` in `_brand`). Colour is per shaped glyph, so the accented `ي` never breaks joining. The font's required `ل+ي` ligature is switched off for the word كيورلي (otherwise one glyph could not take two colours).
- Font: **IBM Plex Sans Arabic** (Medium for كيورلي, SemiBold for line 2), the Arabic face the apps already load next to Jost/Inter; licence **SIL OFL 1.1** (copyright IBM Corp.; `@expo-google-fonts/ibm-plex-sans-arabic`, `LICENSE_FONT`). Only outlines are embedded, no font file ships.
- Text lockups (login footers): `KiorlyFootText` + `components/shared/foot-text.ts` colour the last letter of the brand word (`Y` / `ي`) and the whole product word (`heroFootWord` / `ux.login.footWord`); the Arabic brand span disables `rlig` (and changes colour only) so the join stays intact. Arabic footer strings: `heroFoot` / `ux.login.foot`; page titles come from `app.docTitle` (set on language change by each app's `lib/i18n.ts`).

## Kiorly (staff app + Kiorly Home) colours: Indigo + Periwinkle (founder, 24 Nov 2026)
Product key `staff` in `logo-scene.ts` (files `dist/svg/kiorly-{mark,lockup,wordmark}[-ar][-mono|-inverse].svg`, plus `kiorly-app-icon.svg`, `kiorly-splash[-dark].svg`; the Expo set is `dist/products/kiorly/expo`). All generated from the shared scene by `gen-svgs.cjs` / `gen-assets.cjs` (never redrawn).
| Surface | Left chevron | Right chevron + final Y / ي | Pulse + rule |
|---|---|---|---|
| Light | Indigo `#3730A3` | Periwinkle `#818CF8` | Coral `#E8735E` |
| Inverse (dark / indigo grounds) | White | Light periwinkle `#A5B4FC` | `#F08A75` |
| App icon | solid Indigo tile (`#4338CA` to `#3730A3`, a whisper of depth), white chevrons, coral pulse | | |
Lockup = mark | thin coral rule | KIORLY (Arabic UI: كيورلي, mark on the right, word set 1.28x). No "by Kiorex" line: that stays on the splash and About only (ADR-037). Kiorex keeps Indigo + Ocean; Clinic/Lab/Pharmacy keep their product accents. Native splash images (`splash-icon*.png`) are now the INVERSE mark for every brand (the old light-tone one was Indigo on Indigo, i.e. invisible).
Shared UI pieces: `KxLanguageToggle` is now ONE globe button (code + chevron) opening a menu with العربية / English (menu-button pattern, RTL-safe); `KxBrandBackdrop` is the solid-indigo sign-in brand panel (hairline grid + faint chevron watermark) that replaced the indigo-to-ocean gradient.
