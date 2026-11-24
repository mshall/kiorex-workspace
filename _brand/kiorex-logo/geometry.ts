// KIOREX responsive logo system, geometry. Source: founder spec _brand/KIOREX_LOGO_SPEC_v2.md (25 Nov 2026).
// USED VERBATIM. Do not redraw, round or "improve" any number here: kiorex-logo.test.ts parses the rendered component and compares it to these values.
// Pure data, no framework imports, shared by the web (SVG) and React Native (react-native-svg) components and by _brand/scripts/gen-kiorex-v2.cjs.

export type Bar = readonly [x: number, y: number, width: number, height: number];

export const COLORS = {
  light: { indigo: "#3730A3", ocean: "#0369A1", coral: "#E8735E", wordmark: "#3730A3", wordmarkX: "#0369A1" },
  dark: { indigo: "#6366F1", ocean: "#38BDF8", coral: "#E8735E", wordmark: "#F4F6FC", wordmarkX: "#38BDF8" },
  /** Monochrome (print / thermal): one colour, `currentColor` in components. Spec ink: #0F172A or #000000. */
  mono: { ink: "#0F172A" },
  ground: "#F4F6FC",
  darkSurface: "#0F172A",
  badgeGradient: { from: "#3730A3", to: "#0369A1" },
} as const;

/** A. Master lockup (variant="full", viewBox 0 0 440 130) and the mark (variant="mark", viewBox 20 20 110 90): the same artwork, the mark just crops the viewBox. */
export const MASTER = {
  fullViewBox: "0 0 440 130",
  markViewBox: "20 20 110 90",
  /** Left (Indigo) bars, rx 1.8, outside in. */
  leftBars: [
    [37, 26, 3.6, 22], [37, 82, 3.6, 22], [45, 33, 3.6, 20], [45, 77, 3.6, 20],
    [53, 40, 3.6, 17.5], [53, 72.5, 3.6, 17.5], [61, 47, 3.6, 13.5], [61, 69.5, 3.6, 13.5],
  ] as readonly Bar[],
  /** Right (Ocean) bars, rx 1.8, inside out. */
  rightBars: [
    [85.4, 47, 3.6, 13.5], [85.4, 69.5, 3.6, 13.5], [93.4, 40, 3.6, 17.5], [93.4, 72.5, 3.6, 17.5],
    [101.4, 33, 3.6, 20], [101.4, 77, 3.6, 20], [109.4, 26, 3.6, 22], [109.4, 82, 3.6, 22],
  ] as readonly Bar[],
  barRx: 1.8,
  pulsePoints: "24,65 64,65 68,61 72.5,51 77,79 81.5,57 85,65 126,65",
  pulseStroke: 2.6,
  pulseStrokeMono: 3.2,
  divider: { x1: 144, y1: 26, x2: 144, y2: 104, strokeWidth: 1.3, opacity: 0.9 },
  wordmark: {
    x: 172, y: 74, fontSize: 27, letterSpacing: 8.5, fontWeight: 600, text: "KIORE", textX: "X",
    /** Compact mobile headers (< 480px wide): tracking 0.18em instead of the default ~0.3em (8.5 / 27 = 0.31em). */
    compactTrackingEm: 0.18,
    fontFamily: "'Plus Jakarta Sans', 'Plus Jakarta Sans Fallback', 'Inter', sans-serif",
  },
} as const;

/** B. Micro mark (favicon, size="sm", rendered height < 32px), viewBox 0 0 32 32. 4 channels so no bar ever collapses below 1.5px. */
export const MICRO = {
  viewBox: "0 0 32 32",
  leftBars: [[5, 4, 3.4, 8], [5, 20, 3.4, 8], [10.2, 7.5, 3.4, 5.5], [10.2, 19, 3.4, 5.5]] as readonly Bar[],
  rightBars: [[18.4, 7.5, 3.4, 5.5], [18.4, 19, 3.4, 5.5], [23.6, 4, 3.4, 8], [23.6, 20, 3.4, 8]] as readonly Bar[],
  barRx: 1.7,
  pulsePoints: "2.5,16 12.8,16 14.5,12 16.5,20 18.2,14 19.5,16 29.5,16",
  pulseStroke: 2.2,
  /** Not in the spec: monochrome micro pulse, proportional to the master's 2.6 -> 3.2 step (x1.23, 2.2 -> 2.7) so the thin pulse does not vanish in one-colour print. */
  pulseStrokeMono: 2.7,
} as const;

/** C. App icon badge (variant="badge"), viewBox 0 0 120 120. */
export const BADGE = {
  viewBox: "0 0 120 120",
  rect: { x: 4, y: 4, width: 112, height: 112, rx: 26 },
  barRx: 1.7,
  barColor: "#F4F6FC",
  leftBars: [
    [26, 24, 3.4, 20], [26, 76, 3.4, 20], [33.5, 30.5, 3.4, 18], [33.5, 71.5, 3.4, 18],
    [41, 37, 3.4, 16], [41, 67, 3.4, 16], [48.5, 43.5, 3.4, 12.5], [48.5, 64, 3.4, 12.5],
  ] as readonly Bar[],
  rightBars: [
    [68.1, 43.5, 3.4, 12.5], [68.1, 64, 3.4, 12.5], [75.6, 37, 3.4, 16], [75.6, 67, 3.4, 16],
    [83.1, 30.5, 3.4, 18], [83.1, 71.5, 3.4, 18], [90.6, 24, 3.4, 20], [90.6, 76, 3.4, 20],
  ] as readonly Bar[],
  pulsePoints: "14,60 51,60 54.5,56.5 58,47 62,73 65.5,53 68.5,60 106,60",
  pulseStroke: 3,
  pulseStrokeMono: 3.2,
} as const;

/** Rendered height (px) below which the 4-channel micro mark replaces the 8-channel master. */
export const MICRO_BELOW = 32;
/** Viewport width (px) below which the wordmark tracking tightens. */
export const COMPACT_BELOW = 480;

export type LogoSize = "sm" | "md" | "lg";
/** Default heights for the named sizes: sm < 32 (micro mark), md 32-48, lg > 48. */
export const SIZE_HEIGHT: Record<LogoSize, number> = { sm: 24, md: 40, lg: 64 };

/** Aspect ratios (width / height) of the three viewBoxes. */
export const ASPECT = { full: 440 / 130, mark: 110 / 90, micro: 1, badge: 1 } as const;

export const px = (n: number): string => String(+n.toFixed(2));
