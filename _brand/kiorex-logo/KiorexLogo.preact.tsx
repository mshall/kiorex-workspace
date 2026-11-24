// <KiorexLogo /> for Preact (the embeddable booking widget). Same model and geometry as the React component; light theme only unless `theme` is passed (the widget has no dark mode).
// Vendored with geometry.ts and model.ts into apps/widget/src/brand/kiorex-logo/.
import { useId } from "preact/hooks";
import type { JSX } from "preact";
import { buildModel, type LogoTheme, type LogoVariant, type Shape } from "./model";
import type { LogoSize } from "./geometry";

export interface KiorexLogoProps { variant?: LogoVariant; theme?: Exclude<LogoTheme, "auto">; size?: LogoSize; height?: number; compact?: boolean; title?: string; class?: string; style?: string }

function draw(s: Shape, i: number, gid: string): JSX.Element {
  switch (s.t) {
    case "rect": return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill} />;
    case "polyline": return <polyline key={i} points={s.points} fill="none" stroke={s.stroke} stroke-width={s.sw} stroke-linecap="round" stroke-linejoin="round" />;
    case "line": return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} stroke-width={s.sw} opacity={s.opacity} />;
    case "squircle": return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={`url(#${gid})`} />;
    case "group": return <g key={i} transform={s.transform}>{s.children.map((c, j) => draw(c, j, gid))}</g>;
    case "text": return <text key={i} x={s.x} y={s.y} font-family={s.family} font-weight={s.weight} font-size={s.size} letter-spacing={s.spacing} fill={s.fill}>{s.text}<tspan fill={s.tailFill}>{s.tail}</tspan></text>;
  }
}

export function KiorexLogo({ variant = "full", theme = "light", size, height, compact = false, title, class: cls, style }: KiorexLogoProps) {
  const gid = `kx-grad-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const m = buildModel({ variant, theme, size, height, compact });
  const label = title === undefined ? "KIOREX" : title;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={m.viewBox} width={+m.width.toFixed(2)} height={m.height} class={cls} style={style} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} focusable="false" data-kx-logo={m.mode}>
      {m.gradient ? <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3730A3" /><stop offset="100%" stop-color="#0369A1" /></linearGradient></defs> : null}
      {m.shapes.map((s, i) => draw(s, i, gid))}
    </svg>
  );
}
