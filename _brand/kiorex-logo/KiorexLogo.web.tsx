// <KiorexLogo /> for React web (Vite apps, SSR pages, Passport). Geometry: ./geometry.ts (founder spec, verbatim). Behaviour: ./model.ts.
// Vendored copy: src/brand/kiorex-logo/ in each app (keep the relative imports). Do not fork the numbers.
import * as React from "react";
import { COMPACT_BELOW, type LogoSize } from "./geometry";
import { buildModel, type LogoTheme, type LogoVariant, type ResolvedTheme, type Shape } from "./model";

export interface KiorexLogoProps extends Omit<React.SVGProps<SVGSVGElement>, "ref" | "height" | "width" | "title"> {
  /** `full` icon + coral divider + wordmark (default) | `mark` icon only | `badge` squircle app icon | `monochrome` one colour (currentColor), print / thermal. */
  variant?: LogoVariant;
  /** `auto` follows `.dark` / `data-theme="dark"` on <html>, else prefers-color-scheme. */
  theme?: LogoTheme;
  /** `sm` (<32px, micro mark) | `md` (32-48) | `lg` (>48). Ignored for the pixel height when `height` is numeric. */
  size?: LogoSize;
  /** Pixel height; < 32 renders the 4-channel micro mark. */
  height?: number;
  /** Force compact (0.18em) wordmark tracking; default `auto` = viewport narrower than 480px. */
  compact?: boolean | "auto";
  /** Inverse for flat Indigo grounds (splash, brand panels): Ground bars + Ocean-lift, coral pulse. */
  onBrand?: boolean;
  /** theme="auto" only: also follow the OS colour scheme when the page sets no `.dark` / `data-theme` (default true). Apps whose light theme ignores the OS setting pass false. */
  followSystem?: boolean;
  /** Accessible name (default "KIOREX"). Pass "" to mark the logo decorative when adjacent text names it. */
  title?: string;
  /** Draws the coral pulse in on mount (`.kx-pulse-draw` from tokens.css; honours prefers-reduced-motion). Decorative hero use. */
  animated?: boolean;
}

/** Total length of a `points` polyline, for the stroke-dash draw-in animation. */
const polylineLength = (points: string): number => {
  const p = points.trim().split(/\s+/).map((q) => q.split(",").map(Number));
  return Math.ceil(p.slice(1).reduce((sum, c, i) => sum + Math.hypot(c[0] - p[i][0], c[1] - p[i][1]), 0)) + 2;
};

const subscribeMQ = (query: string) => (cb: () => void) => {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(query);
  mq.addEventListener?.("change", cb);
  return () => mq.removeEventListener?.("change", cb);
};
const matchesMQ = (query: string) => () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(query).matches : false);

/** True below 480px viewport width (compact mobile header tracking). Server and first paint = false. */
export function useCompactViewport(): boolean {
  const q = `(max-width: ${COMPACT_BELOW - 0.02}px)`;
  return React.useSyncExternalStore(subscribeMQ(q), matchesMQ(q), () => false);
}

const subscribeDark = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  const off = subscribeMQ("(prefers-color-scheme: dark)")(cb);
  const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(cb) : null;
  mo?.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
  return () => { off(); mo?.disconnect(); };
};
const darkNow = (followSystem: boolean) => (): boolean => {
  if (typeof document === "undefined") return false;
  const el = document.documentElement;
  if (el.classList.contains("dark") || el.dataset.theme === "dark") return true;
  if (el.classList.contains("light") || el.dataset.theme === "light" || !followSystem) return false;
  return matchesMQ("(prefers-color-scheme: dark)")();
};
/** Resolves theme="auto": the app's dark class / data-theme wins, else prefers-color-scheme. Server and first paint = light. */
export function useResolvedTheme(theme: LogoTheme = "auto", followSystem = true): ResolvedTheme {
  const auto = React.useSyncExternalStore(subscribeDark, React.useMemo(() => darkNow(followSystem), [followSystem]), () => false);
  return theme === "auto" ? (auto ? "dark" : "light") : theme;
}

function draw(s: Shape, i: number, gid: string, animated = false): React.ReactNode {
  switch (s.t) {
    case "rect": return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill} />;
    case "polyline": return (
      <polyline key={i} points={s.points} fill="none" stroke={s.stroke} strokeWidth={s.sw} strokeLinecap="round" strokeLinejoin="round"
        className={animated ? "kx-pulse-draw" : undefined} style={animated ? ({ ["--kx-pulse-len" as string]: polylineLength(s.points) } as React.CSSProperties) : undefined} />
    );
    case "line": return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} />;
    case "squircle": return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={`url(#${gid})`} />;
    case "group": return <g key={i} transform={s.transform}>{s.children.map((c, j) => draw(c, j, gid, animated))}</g>;
    case "text": return (
      <text key={i} x={s.x} y={s.y} fontFamily={s.family} fontWeight={s.weight} fontSize={s.size} letterSpacing={s.spacing} fill={s.fill}>{s.text}<tspan fill={s.tailFill}>{s.tail}</tspan></text>
    );
  }
}

/** The KIOREX logo: 8-channel waveform bars with the coral ECG pulse. Below 32px it switches to the 4-channel micro mark. */
export function KiorexLogo({ variant = "full", theme = "auto", size, height, compact = "auto", followSystem = true, onBrand = false, title, animated = false, style, className, ...rest }: KiorexLogoProps) {
  const rawId = React.useId();
  const gid = `kx-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const resolved = useResolvedTheme(theme, followSystem);
  const narrow = useCompactViewport();
  const m = buildModel({ variant, theme: resolved, size, height, compact: compact === "auto" ? narrow : compact, onBrand });
  const label = title === undefined ? "KIOREX" : title;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={m.viewBox}
      width={+m.width.toFixed(2)}
      height={m.height}
      className={className}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-kx-logo={m.mode}
      data-kx-variant={variant}
      {...rest}
    >
      {m.gradient ? (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#3730A3" /><stop offset="100%" stopColor="#0369A1" /></linearGradient>
        </defs>
      ) : null}
      {m.shapes.map((s, i) => draw(s, i, gid, animated))}
    </svg>
  );
}

export default KiorexLogo;
