# KIOREX responsive brand logo system (founder spec, 25 Nov 2026)

Scope: **Kiorex only** (patient web, patient mobile app, Kiorex ops console, Kiorex-branded surfaces). NOT the Kiorly products or the Kiorly app, which keep their own marks.
Geometry below is to be used **verbatim**. The founder supplied the production SVG geometries; do not redraw or "improve" them.

## 1. Brand colour tokens
- Primary Indigo (Patient / Clinical): `#3730A3` (dark mode lift: `#6366F1`)
- Secondary Ocean (Provider Network): `#0369A1` (dark mode lift: `#38BDF8`)
- Coral Pulse (Vital Signal / Accent): `#E8735E`
- Light Ground: `#F4F6FC`
- Dark Surface: `#0F172A`
- Print / Monochrome Ink: `#0F172A` or `#000000`
- WCAG rule: never use `#E8735E` for small body text or critical clinical alerts on light backgrounds. Reserve `#E8735E` strictly for the pulse SVG line, divider accent and large graphic highlights.

## 2. Typography
- Font family `"Plus Jakarta Sans"` (fallback `"Inter"`, sans-serif), weight 600 (SemiBold).
- Wordmark: `KIORE` in Indigo (`#3730A3`, or `#F4F6FC` in dark mode) + `X` in Ocean (`#0369A1`, or `#38BDF8` in dark mode).
- Tracking: `0.3em` (~8.5px at 27px font size) on desktop; tighten to `0.18em` on compact mobile headers (< 480px).

## 3. Component `<KiorexLogo />`
Reusable SVG component:
- `variant`: `"full"` (icon + vertical coral divider + wordmark), `"mark"` (icon only), `"badge"` (squircle app icon), `"monochrome"` (single-colour print/thermal).
- `theme`: `"light"` | `"dark"` | `"auto"` (follows prefers-color-scheme or dark class).
- `size`: `"sm"` (< 32px height), `"md"` (32px-48px), `"lg"` (> 48px), or numeric `height`.

Critical responsive SVG rule:
- When rendered height is < 32px (or `size="sm"` / favicon), automatically render the simplified **4-channel micro-mark** (`viewBox="0 0 32 32"`) so bars never collapse below 1.5px width.
- At >= 32px render the **Master 8-channel Horizontal Open Corridor SVG** (`viewBox="0 0 440 130"` for `"full"`, or `viewBox="20 20 110 90"` for `"mark"`).

## 4. Exact production SVG geometries

### A. Master lockup (`variant="full"`, `viewBox="0 0 440 130"`)
Left Indigo bars (`fill="#3730A3"`, dark `#6366F1`):
```
<rect x="37" y="26" width="3.6" height="22" rx="1.8"/>
<rect x="37" y="82" width="3.6" height="22" rx="1.8"/>
<rect x="45" y="33" width="3.6" height="20" rx="1.8"/>
<rect x="45" y="77" width="3.6" height="20" rx="1.8"/>
<rect x="53" y="40" width="3.6" height="17.5" rx="1.8"/>
<rect x="53" y="72.5" width="3.6" height="17.5" rx="1.8"/>
<rect x="61" y="47" width="3.6" height="13.5" rx="1.8"/>
<rect x="61" y="69.5" width="3.6" height="13.5" rx="1.8"/>
```
Horizontal Coral ECG pulse (`stroke="#E8735E"`, `strokeWidth="2.6"` [`3.2` in monochrome], `strokeLinecap="round"`, `strokeLinejoin="round"`, `fill="none"`):
```
points="24,65 64,65 68,61 72.5,51 77,79 81.5,57 85,65 126,65"
```
Right Ocean bars (`fill="#0369A1"`, dark `#38BDF8`):
```
<rect x="85.4" y="47" width="3.6" height="13.5" rx="1.8"/>
<rect x="85.4" y="69.5" width="3.6" height="13.5" rx="1.8"/>
<rect x="93.4" y="40" width="3.6" height="17.5" rx="1.8"/>
<rect x="93.4" y="72.5" width="3.6" height="17.5" rx="1.8"/>
<rect x="101.4" y="33" width="3.6" height="20" rx="1.8"/>
<rect x="101.4" y="77" width="3.6" height="20" rx="1.8"/>
<rect x="109.4" y="26" width="3.6" height="22" rx="1.8"/>
<rect x="109.4" y="82" width="3.6" height="22" rx="1.8"/>
```
Vertical divider:
```
<line x1="144" y1="26" x2="144" y2="104" stroke="#E8735E" strokeWidth="1.3" opacity="0.9"/>
```
Wordmark:
```
<text x="172" y="74" fontFamily="'Plus Jakarta Sans', 'Inter', sans-serif" fontWeight="600" fontSize="27" letterSpacing="8.5" fill="#3730A3">KIORE<tspan fill="#0369A1">X</tspan></text>
```

### B. Micro-scale favicon / icon (`size="sm"` or `<link rel="icon">`, `viewBox="0 0 32 32"`)
Left Indigo bars (`fill="#3730A3"`):
```
<rect x="5" y="4" width="3.4" height="8" rx="1.7"/>
<rect x="5" y="20" width="3.4" height="8" rx="1.7"/>
<rect x="10.2" y="7.5" width="3.4" height="5.5" rx="1.7"/>
<rect x="10.2" y="19" width="3.4" height="5.5" rx="1.7"/>
```
Horizontal Coral ECG pulse (`stroke="#E8735E"`, `strokeWidth="2.2"`, round caps and joins, `fill="none"`):
```
points="2.5,16 12.8,16 14.5,12 16.5,20 18.2,14 19.5,16 29.5,16"
```
Right Ocean bars (`fill="#0369A1"`):
```
<rect x="18.4" y="7.5" width="3.4" height="5.5" rx="1.7"/>
<rect x="18.4" y="19" width="3.4" height="5.5" rx="1.7"/>
<rect x="23.6" y="4" width="3.4" height="8" rx="1.7"/>
<rect x="23.6" y="20" width="3.4" height="8" rx="1.7"/>
```

### C. App icon badge (`variant="badge"`, `viewBox="0 0 120 120"`)
Background squircle: `<rect x="4" y="4" width="112" height="112" rx="26" fill="url(#kiorexAppGrad)"/>` where `#kiorexAppGrad` is a diagonal linear gradient from `#3730A3` (0%) to `#0369A1` (100%).
All 16 waveform bars in `#F4F6FC` (`rx="1.7"`, `(x, y, width, height)`):
- Left: `(26,24,3.4,20)`, `(26,76,3.4,20)`, `(33.5,30.5,3.4,18)`, `(33.5,71.5,3.4,18)`, `(41,37,3.4,16)`, `(41,67,3.4,16)`, `(48.5,43.5,3.4,12.5)`, `(48.5,64,3.4,12.5)`
- Right: `(68.1,43.5,3.4,12.5)`, `(68.1,64,3.4,12.5)`, `(75.6,37,3.4,16)`, `(75.6,67,3.4,16)`, `(83.1,30.5,3.4,18)`, `(83.1,71.5,3.4,18)`, `(90.6,24,3.4,20)`, `(90.6,76,3.4,20)`
Horizontal Coral ECG pulse (`stroke="#E8735E"`, `strokeWidth="3"`, round caps and joins, `fill="none"`):
```
points="14,60 51,60 54.5,56.5 58,47 62,73 65.5,53 68.5,60 106,60"
```

## 5. Deliverables
1. `<KiorexLogo />` component with TypeScript props and accessible `role="img"` + `aria-label="KIOREX"`.
2. Standalone static `.svg` files for `public/favicon.svg` (the 4-channel 32x32 SVG) and `public/apple-touch-icon` / app icon badge.
3. Unique gradient `<defs>` IDs (e.g. via `useId()` in React) so multiple `<KiorexLogo variant="badge" />` instances on one page never clash.
