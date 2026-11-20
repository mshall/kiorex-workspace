// tokens.json -> tokens.css, tailwind-preset.cjs, theme.ts, tokens.resolved.json
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const T = JSON.parse(fs.readFileSync(path.join(root, "tokens.json"), "utf8"));
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// target mix amounts relative to anchor: lighter steps mix toward white, darker toward near-black tinted w/ base
const LIGHT = { 50: 0.93, 100: 0.85, 200: 0.72, 300: 0.55, 400: 0.3, 500: 0.0 };
function ramp(base, anchor) {
  const b = hex2(base), W = [255, 255, 255];
  const idx = STEPS.indexOf(anchor);
  const out = {};
  STEPS.forEach((s, i) => {
    const d = i - idx;
    if (d === 0) out[s] = toHex(b);
    else if (d < 0) { const t = 0.93 * Math.pow((idx - i) / idx, 0.9); out[s] = toHex(mix(b, W, Math.min(0.95, t))); }
    else { const t = 0.88 * Math.pow(d / (STEPS.length - 1 - idx), 0.85); const dark = mix(b, [12, 12, 30], 1); out[s] = toHex(mix(b, dark, t)); }
  });
  return out;
}
const ramps = {};
for (const [k, v] of Object.entries(T.ramps)) ramps[k] = v.explicit || ramp(v.base, v.anchor);
const L = T.themes.light, D = T.themes.dark;
const kebab = (s) => s;
const themeVars = (th, el, sem, elev) => {
  let s = Object.entries(th).map(([k, v]) => `  --kx-${k}: ${v};`).join("\n");
  s += "\n" + Object.entries(T.products).filter(([k]) => k[0] !== "$").map(([k, v]) => el === "dark"
    ? `  --kx-product-${k}: ${v.dark};\n  --kx-product-${k}-text: ${v.dark};` : `  --kx-product-${k}: ${v.graphic};\n  --kx-product-${k}-text: ${v.text};`).join("\n");
  s += "\n" + Object.entries(T.semantic).map(([k, v]) => el === "dark"
    ? `  --kx-${k}: ${v.textDark};\n  --kx-${k}-soft: ${v.softDark};` : `  --kx-${k}: ${v.base};\n  --kx-${k}-soft: ${v.soft};`).join("\n");
  s += "\n" + Object.entries(elev).map(([k, v]) => `  --kx-shadow-${k}: ${v};`).join("\n");
  return s;
};
const ty = T.typography;
const staticVars = [
  ...Object.entries(ramps).flatMap(([n, r]) => Object.entries(r).map(([s, v]) => `  --kx-${n}-${s}: ${v};`)),
  `  --kx-font: ${ty.stack};`, `  --kx-font-ar: ${ty.stackAr};`, `  --kx-font-mono: ${ty.mono};`,
  ...Object.entries(ty.scale).flatMap(([k, v]) => [`  --kx-text-${k}: ${v.size / 16}rem;`, `  --kx-leading-${k}: ${v.line / 16}rem;`, `  --kx-tracking-${k}: ${v.tracking}em;`]),
  ...Object.entries(T.space).map(([k, v]) => `  --kx-space-${k.replace(".", "_")}: ${v / 16}rem;`),
  ...Object.entries(T.radius).map(([k, v]) => `  --kx-radius-${k}: ${v === 9999 ? "9999px" : v + "px"};`),
  ...Object.entries(T.blur).map(([k, v]) => `  --kx-blur-${k}: ${v}px;`),
  ...Object.entries(T.motion.duration).map(([k, v]) => `  --kx-dur-${k}: ${v}ms;`),
  ...Object.entries(T.motion.easing).map(([k, v]) => `  --kx-ease-${k}: ${v};`),
  `  --kx-focus-width: ${T.focus.width}px;`, `  --kx-focus-offset: ${T.focus.offset}px;`,
  `  --kx-touch-min: ${T.layout.touchMin}px;`, `  --kx-touch-nurse: ${T.layout.nurseTouchMin}px;`,
  `  --kx-gradient: linear-gradient(135deg, ${T.brand.indigo} 0%, ${T.brand.ocean} 100%);`,
  `  --kx-nurse-rose: ${T.brand.nurseRose};`,
  // legacy aliases kept so existing consumers of the v1 tokens.css keep working
  `  --kx-ink: var(--kx-primary);`, `  --kx-ink-2: var(--kx-secondary);`, `  --kx-pulse: var(--kx-accent);`, `  --kx-ground: var(--kx-bg);`,
  `  --kx-text-muted-legacy: var(--kx-text-muted);`, `  --kx-radius: var(--kx-radius-md);`,
].join("\n");
const css = `/* GENERATED from tokens.json by scripts/build-tokens.cjs — do not edit. */
:root {
  color-scheme: light;
${staticVars}
${themeVars(L, "light", 0, T.elevation.light)}
}
:root[data-theme="dark"], .dark {
  color-scheme: dark;
${themeVars(D, "dark", 0, T.elevation.dark)}
}
@media (prefers-color-scheme: dark) {
  :root[data-theme="auto"] {
    color-scheme: dark;
${themeVars(D, "dark", 0, T.elevation.dark).replace(/^/gm, "  ")}
  }
}
/* Arabic: switch family, add line-height for tall Arabic glyphs */
:root[lang="ar"], [dir="rtl"] { --kx-font: var(--kx-font-ar); }
:root[lang="ar"] body, [dir="rtl"] body { line-height: ${ty.arabicLineHeight}; letter-spacing: 0; }
/* Focus ring — coral, always visible for keyboard users */
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: var(--kx-focus-width) solid var(--kx-focus);
  outline-offset: var(--kx-focus-offset);
}
/* Motion: collapse durations for reduced-motion users */
@media (prefers-reduced-motion: reduce) {
  :root { --kx-dur-instant: 0ms; --kx-dur-fast: 0ms; --kx-dur-base: 0ms; --kx-dur-slow: 0ms; --kx-dur-slower: 0ms; --kx-dur-pulse: 0ms; }
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
/* Pulse-line brand motif: apply to an SVG path to draw it in */
@keyframes kx-pulse-draw { from { stroke-dashoffset: var(--kx-pulse-len, 1000); } to { stroke-dashoffset: 0; } }
.kx-pulse-draw { stroke-dasharray: var(--kx-pulse-len, 1000); animation: kx-pulse-draw var(--kx-dur-pulse) var(--kx-ease-standard) both; }
.kx-pulse-loop { stroke-dasharray: var(--kx-pulse-len, 1000); animation: kx-pulse-draw var(--kx-dur-pulse) var(--kx-ease-standard) infinite alternate; }
@keyframes kx-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
.kx-skeleton { background: linear-gradient(90deg, var(--kx-bg-subtle) 25%, var(--kx-surface-raised) 50%, var(--kx-bg-subtle) 75%); background-size: 200% 100%; animation: kx-shimmer 1.6s linear infinite; border-radius: var(--kx-radius-sm); }
.kx-tnum { font-variant-numeric: tabular-nums; }
`;
fs.writeFileSync(path.join(root, "tokens.css"), css);

const tw = {
  colors: {
    ...Object.fromEntries(Object.entries(ramps).map(([n, r]) => [n === "neutral" ? "kx-neutral" : "kx-" + n, r])),
    "kx-bg": "var(--kx-bg)", "kx-bg-subtle": "var(--kx-bg-subtle)", "kx-surface": "var(--kx-surface)", "kx-raised": "var(--kx-surface-raised)",
    "kx-sunken": "var(--kx-surface-sunken)", "kx-border": "var(--kx-border)", "kx-border-strong": "var(--kx-border-strong)",
    "kx-text": "var(--kx-text)", "kx-muted": "var(--kx-text-muted)", "kx-subtle": "var(--kx-text-subtle)",
    "kx-primary": "var(--kx-primary)", "kx-primary-hover": "var(--kx-primary-hover)", "kx-primary-soft": "var(--kx-primary-soft)", "kx-on-primary": "var(--kx-on-primary)",
    "kx-secondary": "var(--kx-secondary)", "kx-secondary-soft": "var(--kx-secondary-soft)", "kx-accent": "var(--kx-accent)", "kx-accent-soft": "var(--kx-accent-soft)",
    "kx-link": "var(--kx-link)", "kx-focus": "var(--kx-focus)",
    ...Object.fromEntries(Object.keys(T.products).filter((k) => k[0] !== "$").flatMap((k) => [["kx-product-" + k, `var(--kx-product-${k})`], ["kx-product-" + k + "-text", `var(--kx-product-${k}-text)`]])),
    ...Object.fromEntries(Object.keys(T.semantic).flatMap((k) => [["kx-" + k, `var(--kx-${k})`], ["kx-" + k + "-soft", `var(--kx-${k}-soft)`]])),
  },
  fontFamily: { kx: [ "var(--kx-font)" ], "kx-ar": ["var(--kx-font-ar)"], "kx-mono": ["var(--kx-font-mono)"] },
  fontSize: Object.fromEntries(Object.entries(ty.scale).map(([k, v]) => ["kx-" + k, [`${v.size / 16}rem`, { lineHeight: `${v.line / 16}rem`, letterSpacing: `${v.tracking}em` }]])),
  borderRadius: Object.fromEntries(Object.entries(T.radius).map(([k, v]) => ["kx-" + k, v === 9999 ? "9999px" : v + "px"])),
  boxShadow: Object.fromEntries(Object.keys(T.elevation.light).filter((k) => k !== "0").map((k) => ["kx-" + k, `var(--kx-shadow-${k})`])),
  transitionDuration: Object.fromEntries(Object.keys(T.motion.duration).map((k) => ["kx-" + k, `var(--kx-dur-${k})`])),
  transitionTimingFunction: Object.fromEntries(Object.keys(T.motion.easing).map((k) => ["kx-" + k, `var(--kx-ease-${k})`])),
  backdropBlur: Object.fromEntries(Object.keys(T.blur).map((k) => ["kx-" + k, `var(--kx-blur-${k})`])),
  minHeight: { "kx-touch": "var(--kx-touch-min)", "kx-nurse": "var(--kx-touch-nurse)" },
  minWidth: { "kx-touch": "var(--kx-touch-min)", "kx-nurse": "var(--kx-touch-nurse)" },
};
fs.writeFileSync(path.join(root, "tailwind-preset.cjs"), `// GENERATED from tokens.json by scripts/build-tokens.cjs — do not edit.
// Usage: presets: [require("./brand/tailwind-preset.cjs")], plus import tokens.css. Use \`dark:\` via data-theme="dark" or .dark.
module.exports = {
  darkMode: ["variant", [":root[data-theme='dark'] &", ".dark &"]],
  theme: { extend: ${JSON.stringify(tw, null, 2)} },
};
`);

const rn = (th, el) => ({
  ...th,
  ...Object.fromEntries(Object.entries(T.semantic).flatMap(([k, v]) => el === "dark" ? [[k, v.textDark], [k + "Soft", v.softDark]] : [[k, v.base], [k + "Soft", v.soft]])),
});
const camel = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/-(\w)/g, (_, c) => c.toUpperCase()), v]));
const theme = {
  brand: T.brand, ramps,
  products: Object.fromEntries(Object.entries(T.products).filter(([k]) => k[0] !== "$")),
  light: camel(rn(L, "light")), dark: camel(rn(D, "dark")),
  font: { latin: ty.latin, arabic: ty.arabic, weights: ty.weights },
  type: ty.scale, arabicLineHeight: ty.arabicLineHeight,
  space: T.space, radius: T.radius, blur: T.blur, motion: T.motion, layout: T.layout,
  focus: T.focus,
};
fs.writeFileSync(path.join(root, "theme.ts"), `// GENERATED from tokens.json by scripts/build-tokens.cjs — do not edit.
// React Native theme. Shadows for RN are derived from elevation levels via \`shadow()\`.
export const theme = ${JSON.stringify(theme, null, 2)} as const;
export type KxTheme = typeof theme;
export type KxScheme = "light" | "dark";
export type KxColors = KxTheme["light"];
export const colorsFor = (scheme: KxScheme | null | undefined): KxColors => (scheme === "dark" ? (theme.dark as unknown as KxColors) : theme.light);
/** RN elevation helper (iOS shadow* + Android elevation). */
export const shadow = (level: 0 | 1 | 2 | 3 | 4, scheme: KxScheme = "light") => ({
  shadowColor: scheme === "dark" ? "#00000A" : "#1E1B4B",
  shadowOpacity: [0, 0.06, 0.08, 0.1, 0.16][level] * (scheme === "dark" ? 4 : 1),
  shadowRadius: [0, 2, 6, 24, 48][level],
  shadowOffset: { width: 0, height: [0, 1, 2, 8, 20][level] },
  elevation: [0, 1, 3, 6, 12][level],
});
export default theme;
`);
// shadcn/Radix bridge: HSL triplets so existing Tailwind `hsl(var(--x) / <alpha>)` setups consume the same source
function hsl(hex) { const [r, g, b] = hex2(hex).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let h = 0, s = 0; const d = mx - mn;
  if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`; }
const bridge = (th, el) => {
  const sem = (k, key) => (el === "dark" ? T.semantic[k][key === "base" ? "textDark" : "softDark"] : T.semantic[k][key]);
  const m = { background: th.bg, foreground: th.text, card: th.surface, "card-foreground": th.text, popover: th["surface-raised"], "popover-foreground": th.text,
    primary: th.primary, "primary-foreground": th["on-primary"], secondary: th.secondary, "secondary-foreground": th["on-secondary"], ocean: th.secondary,
    muted: th["bg-subtle"], "muted-foreground": th["text-muted"], accent: th["primary-soft"], "accent-foreground": el === "dark" ? th["primary-hover"] : T.themes.light["primary-hover"],
    pulse: th.accent, "pulse-foreground": el === "dark" ? "#0F1024" : "#1E1B4B", destructive: sem("danger", "base"), "destructive-foreground": el === "dark" ? "#0F1024" : "#FFFFFF",
    success: sem("success", "base"), "success-soft": sem("success", "soft"), warning: sem("warning", "base"), "warning-soft": sem("warning", "soft"), info: sem("info", "base"), "info-soft": sem("info", "soft"),
    border: th.border, input: th.input, ring: th.focus };
  return Object.entries(m).map(([k, v]) => `  --${k}: ${hsl(v)};`).join("\n");
};
fs.writeFileSync(path.join(root, "shadcn-bridge.css"), `/* GENERATED from tokens.json by scripts/build-tokens.cjs — do not edit. HSL triplets for shadcn-style Tailwind configs. */
:root {\n${bridge(L, "light")}\n  --radius: 14px;\n}
:root[data-theme="dark"], .dark {\n${bridge(D, "dark")}\n}
`);
fs.writeFileSync(path.join(root, "tokens.resolved.json"), JSON.stringify({ ramps }, null, 2));
console.log("tokens built", Object.keys(ramps));
