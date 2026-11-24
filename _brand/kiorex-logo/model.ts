// Framework-free render model for <KiorexLogo />: decides master vs micro, theme colours, tracking, and lists the shapes to draw.
// The web (SVG) and React Native (react-native-svg) components only map this model to elements, so both stay identical to the spec geometry.
import { ASPECT, BADGE, COLORS, COMPACT_BELOW, MASTER, MICRO, MICRO_BELOW, SIZE_HEIGHT, px, type Bar, type LogoSize } from "./geometry";

export type LogoVariant = "full" | "mark" | "badge" | "monochrome";
export type LogoTheme = "light" | "dark" | "auto";
export type ResolvedTheme = "light" | "dark";

export type Shape =
  | { t: "rect"; x: number; y: number; w: number; h: number; rx: number; fill: string }
  | { t: "polyline"; points: string; stroke: string; sw: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; opacity: number }
  | { t: "text"; x: number; y: number; size: number; spacing: number; weight: number; family: string; fill: string; text: string; tail: string; tailFill: string }
  | { t: "squircle"; x: number; y: number; w: number; h: number; rx: number; fill: "gradient" }
  | { t: "group"; transform: string; children: Shape[] };

export interface LogoModel {
  /** "master" = 8-channel, "micro" = 4-channel (height < 32), "badge" = squircle app icon (master or micro flavour). */
  mode: "master" | "micro" | "badge";
  micro: boolean;
  viewBox: string;
  width: number;
  height: number;
  shapes: Shape[];
  gradient: boolean;
  label: string;
}

export interface ModelInput {
  variant?: LogoVariant;
  theme?: ResolvedTheme;
  size?: LogoSize;
  height?: number;
  /** Viewport < 480px: tighten the wordmark tracking to 0.18em. */
  compact?: boolean;
  /** Force the micro mark regardless of height (favicon contexts). */
  forceMicro?: boolean;
  /** Inverse for flat Indigo grounds (splash, brand panels): dark-theme colours with the Indigo bars lifted to Ground #F4F6FC. */
  onBrand?: boolean;
}

/** Pixel height implied by `size` / `height`. A numeric `height` wins; the default is `md` (40). */
export const heightOf = (size?: LogoSize, height?: number): number => (typeof height === "number" && height > 0 ? height : SIZE_HEIGHT[size ?? "md"]);
/** The critical responsive rule: below 32px (or size="sm" / favicon) use the 4-channel micro mark. */
export const isMicro = (h: number, size?: LogoSize, force?: boolean): boolean => !!force || size === "sm" || h < MICRO_BELOW;

const rects = (bars: readonly Bar[], rx: number, fill: string): Shape[] => bars.map(([x, y, w, h]) => ({ t: "rect", x, y, w, h, rx, fill }));

function palette(variant: LogoVariant, theme: ResolvedTheme, onBrand = false) {
  if (variant === "monochrome") return { left: "currentColor", right: "currentColor", coral: "currentColor", word: "currentColor", wordX: "currentColor", divider: "currentColor" };
  const c = onBrand ? { ...COLORS.dark, indigo: COLORS.ground } : COLORS[theme];
  return { left: c.indigo, right: c.ocean, coral: c.coral, word: c.wordmark, wordX: c.wordmarkX, divider: c.coral };
}

export function buildModel(input: ModelInput = {}): LogoModel {
  const variant = input.variant ?? "full";
  const theme = input.theme ?? "light";
  const height = heightOf(input.size, input.height);
  // size="sm" always means micro, whatever the numeric height (the spec's sm is "< 32px"; a caller passing size="sm" height={40} still gets the favicon form)
  const micro = isMicro(height, input.size, input.forceMicro);
  const mono = variant === "monochrome";
  const p = palette(variant, theme, input.onBrand);

  if (variant === "badge") {
    const r = BADGE.rect;
    const bg: Shape = { t: "squircle", x: r.x, y: r.y, w: r.width, h: r.height, rx: r.rx, fill: "gradient" };
    if (!micro) {
      return {
        mode: "badge", micro: false, viewBox: BADGE.viewBox, width: height, height, gradient: true, label: "KIOREX",
        shapes: [bg, ...rects(BADGE.leftBars, BADGE.barRx, BADGE.barColor), ...rects(BADGE.rightBars, BADGE.barRx, BADGE.barColor),
          { t: "polyline", points: BADGE.pulsePoints, stroke: COLORS.light.coral, sw: BADGE.pulseStroke }],
      };
    }
    // Small badge (not in the spec): the gradient squircle with the 4-channel micro mark centred in it, all bars Ground, so no bar is thinner than 1.5px at 24px.
    const g: Shape = { t: "group", transform: "translate(16 16) scale(0.74) translate(-16 -16)", children: [
      ...rects(MICRO.leftBars, MICRO.barRx, BADGE.barColor), ...rects(MICRO.rightBars, MICRO.barRx, BADGE.barColor),
      { t: "polyline", points: MICRO.pulsePoints, stroke: COLORS.light.coral, sw: +(MICRO.pulseStroke / 0.74).toFixed(2) },
    ] };
    return { mode: "badge", micro: true, viewBox: MICRO.viewBox, width: height, height, gradient: true, label: "KIOREX", shapes: [{ t: "squircle", x: 1, y: 1, w: 30, h: 30, rx: 7, fill: "gradient" }, g] };
  }

  if (micro) {
    return {
      mode: "micro", micro: true, viewBox: MICRO.viewBox, width: height * ASPECT.micro, height, gradient: false, label: "KIOREX",
      shapes: [...rects(MICRO.leftBars, MICRO.barRx, p.left), { t: "polyline", points: MICRO.pulsePoints, stroke: p.coral, sw: mono ? MICRO.pulseStrokeMono : MICRO.pulseStroke }, ...rects(MICRO.rightBars, MICRO.barRx, p.right)],
    };
  }

  const wave: Shape[] = [
    ...rects(MASTER.leftBars, MASTER.barRx, p.left),
    { t: "polyline", points: MASTER.pulsePoints, stroke: p.coral, sw: mono ? MASTER.pulseStrokeMono : MASTER.pulseStroke },
    ...rects(MASTER.rightBars, MASTER.barRx, p.right),
  ];
  if (variant === "mark") {
    return { mode: "master", micro: false, viewBox: MASTER.markViewBox, width: height * ASPECT.mark, height, gradient: false, label: "KIOREX", shapes: wave };
  }
  const w = MASTER.wordmark;
  const spacing = input.compact ? +(w.fontSize * w.compactTrackingEm).toFixed(3) : w.letterSpacing;
  return {
    mode: "master", micro: false, viewBox: MASTER.fullViewBox, width: height * ASPECT.full, height, gradient: false, label: "KIOREX",
    shapes: [
      ...wave,
      { t: "line", ...MASTER.divider, stroke: p.divider, sw: MASTER.divider.strokeWidth, opacity: MASTER.divider.opacity },
      { t: "text", x: w.x, y: w.y, size: w.fontSize, spacing, weight: w.fontWeight, family: w.fontFamily, fill: p.word, text: w.text, tail: w.textX, tailFill: p.wordX },
    ],
  };
}

export { px };
export const compactBelow = COMPACT_BELOW;
