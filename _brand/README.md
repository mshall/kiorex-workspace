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
| Kiorly Clinic | `clinic` | Teal `#0D9488` | `#0F766E` | `#2DD4BF` | Kiorly Clinic by Kiorex / كيورلي للعيادات من كيوركس |
| Kiorly Lab | `lab` | Violet `#7C3AED` | `#6D28D9` | `#A78BFA` | Kiorly Lab by Kiorex / كيورلي لاب من كيوركس |
| Kiorly Pharmacy | `pharmacy` | Green `#16A34A` | `#15803D` | `#4ADE80` | Kiorly Pharmacy by Kiorex / كيورلي للصيدليات من كيوركس |
| Kiorly Nurse (edition of Clinic) | `nurse` | Nurse Rose `#E11D48` (unchanged look, `NURSE` sub-line) | | `#FB7185` | Kiorly Nurse by Kiorex |
| Kiorex Passport | `passport` | Ocean (unchanged) | | | Kiorex Passport |

Tokens: `--kx-product-{clinic,lab,pharmacy}` (graphic use: logo, chevrons, large marks; >= 3:1 on Ground `#F4F6FC`: teal 3.47, violet 5.27, green 3.05) and `--kx-product-*-text` (AA for body text on light; equals the dark value in dark mode); Tailwind `kx-product-*`; `theme.products` in `theme.ts`. Use accents sparingly (logo, product badge, active-tab underline), never as the primary action colour: Indigo stays primary.

In an app, the one product-specific line is `KIORLY_PRODUCT` in `src/brand/ui-kit.tsx` (`KiorlyBrand` / `KiorlyMark` read it); the web logo is `<KiorexLogo product="clinic|lab|pharmacy" />`. In text lockups (login footers) `KiorlyFootText` colours the whole product word incl. the Arabic one (`heroFootWord` / `ux.login.footWord`). Arabic product text lives in the locales (`heroFoot` / `ux.login.foot`), the SVG artwork is Latin only.
