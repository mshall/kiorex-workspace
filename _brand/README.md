# Kiorex brand kit (`_brand/`)

Single source of truth for logo, tokens and generated assets. Palette: Indigo `#3730A3`, Ocean `#0369A1`, Coral pulse `#E8735E`, Ground `#F4F6FC`. Nurse edition keeps Nurse Rose `#E11D48` as its only accent. **Never redraw the logo** — use the components/SVGs here.

## Layout
| Path | What |
|---|---|
| `tokens.json` | ONE source: ramps, semantic, light/dark themes, type scale, spacing, radius, elevation, motion, focus |
| `tokens.css` | generated CSS vars (`--kx-*`), `[data-theme=dark]`/`.dark` (+ `prefers-color-scheme` when `data-theme="auto"`), Arabic font switch, coral focus ring, reduced-motion, `.kx-pulse-draw`, `.kx-skeleton`, `.kx-tnum` |
| `shadcn-bridge.css` | generated HSL-triplet vars (`--background`, `--primary`, `--ring`...) for shadcn/Radix-style Tailwind configs |
| `tailwind-preset.cjs` | generated Tailwind preset (`kx-*` colours map to the CSS vars, so dark mode is automatic) |
| `theme.ts` | generated React Native theme (`theme`, `colorsFor(scheme)`, `shadow(level)`) |
| `components/web/KiorexLogo.tsx` | `<KiorexLogo variant="lockup|mark|wordmark" tone="color|mono|inverse" product="kiorex|kiorly|passport|nurse" animated />`, `<PulseLine/>` |
| `components/native/KiorexLogo.tsx` | same API via `react-native-svg` |
| `components/shared/` | scene geometry + outlined Jost wordmarks (KIOREX, KIORLY, PASSPORT, NURSE, BY KIOREX) |
| `dist/` | static SVG set (`svg/`), favicons, `favicon.ico`, apple-touch, `pwa/` (192/512/maskable), `og-image.png`, `manifest.webmanifest`, `expo/` (icon, adaptive-foreground, splash-icon[-dark], favicon), `svg/letterhead.svg` |
| `scripts/` | `build-tokens.cjs`, `gen-wordmarks.cjs` (opentype.js, Jost Medium), `gen-assets.cjs` (sharp) |

Rebuild: `cd _brand && node scripts/build-tokens.cjs && node scripts/gen-wordmarks.cjs && node scripts/gen-assets.cjs`. Scripts find `sharp`/`opentype.js` via `scripts/resolve.cjs` (or `npm i` here).

## Vendoring into a repo
Repos are separate git repos, so **copy** (vendor) — do not symlink. Put the files under `<app>/src/brand/` (or `apps/web/src/brand`):
1. `tokens.css`, `tailwind-preset.cjs` (web) or `theme.ts` (RN), and `components/{shared,web|native}` (keep the relative `../shared` import).
2. Web: `@import "./brand/tokens.css";` first in the global CSS; in `tailwind.config` add `presets: [require("./src/brand/tailwind-preset.cjs")]`; set `<html lang dir data-theme>`; load Jost + IBM Plex Sans Arabic (next/font or `@expo-google-fonts/*`).
3. Copy needed files from `dist/` into `public/` (favicon.ico, favicon.svg, apple-touch-icon.png, pwa/*, og-image.png, manifest) or `assets/` (Expo: `expo/icon.png`, `expo/adaptive-foreground.png` + background `#3730A3`, `expo/splash-icon.png`).
4. Re-vendor when `_brand` changes; keep the header comment of generated files so diffs are obvious.
Kiorly products use the same palette: `<KiorexLogo product="kiorly" />` shows KIORLY with "by Kiorex"; Nurse uses `product="nurse"`; Passport uses `product="passport"`.
