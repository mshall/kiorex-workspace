// <KiorexLogo /> for React Native / Expo (react-native-svg). Same props, geometry and responsive rules as the web component (./model.ts).
// Vendored copy: src/brand/kiorex-logo/ in the Expo app. Load the wordmark font once at app start (see KX_RN_FONT).
import * as React from "react";
import { useColorScheme, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, G, Line, LinearGradient, Polyline, Rect, Stop, Text as SvgText, TSpan } from "react-native-svg";
import { COMPACT_BELOW, type LogoSize } from "./geometry";
import { buildModel, type LogoTheme, type LogoVariant, type Shape } from "./model";

/** Family name registered by `@expo-google-fonts/plus-jakarta-sans` (`PlusJakartaSans_600SemiBold`) when loaded with expo-font. Falls back to the system face until loaded. */
export const KX_RN_FONT = "PlusJakartaSans_600SemiBold";

export interface KiorexLogoProps {
  variant?: LogoVariant;
  /** `auto` follows the device colour scheme (apps with their own theme switch pass `light` / `dark`). */
  theme?: LogoTheme;
  size?: LogoSize;
  height?: number;
  /** Force compact (0.18em) tracking; default `auto` = window narrower than 480dp. */
  compact?: boolean | "auto";
  /** Accessible name (default "KIOREX"). "" = decorative. */
  title?: string;
  /** Inverse for flat Indigo grounds (splash, brand panels): Ground bars + Ocean-lift, coral pulse. */
  onBrand?: boolean;
  /** Colour for variant="monochrome" (default: black). */
  color?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function draw(s: Shape, i: number, gid: string): React.ReactNode {
  switch (s.t) {
    case "rect": return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill} />;
    case "polyline": return <Polyline key={i} points={s.points} fill="none" stroke={s.stroke} strokeWidth={s.sw} strokeLinecap="round" strokeLinejoin="round" />;
    case "line": return <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} />;
    case "squircle": return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={`url(#${gid})`} />;
    case "group": return <G key={i} transform={s.transform}>{s.children.map((c, j) => draw(c, j, gid))}</G>;
    case "text": return (
      <SvgText key={i} x={s.x} y={s.y} fontFamily={KX_RN_FONT} fontWeight={String(s.weight) as "600"} fontSize={s.size} letterSpacing={s.spacing} fill={s.fill}>{s.text}<TSpan fill={s.tailFill}>{s.tail}</TSpan></SvgText>
    );
  }
}

export function KiorexLogo({ variant = "full", theme = "auto", size, height, compact = "auto", onBrand = false, title, color = "#000000", style, testID }: KiorexLogoProps) {
  const rawId = React.useId();
  const gid = `kxgrad${rawId.replace(/[^a-zA-Z0-9]/g, "")}`; // useId is stable per instance and unique per tree
  const scheme = useColorScheme();
  const { width: winW } = useWindowDimensions();
  const resolved = theme === "auto" ? (scheme === "dark" ? "dark" : "light") : theme;
  const m = buildModel({ variant, theme: resolved, size, height, compact: compact === "auto" ? winW < COMPACT_BELOW : compact, onBrand });
  const label = title === undefined ? "KIOREX" : title;
  return (
    <Svg
      width={+m.width.toFixed(2)} height={m.height} viewBox={m.viewBox} color={color} style={style} testID={testID}
      accessible={!!label} accessibilityRole={label ? "image" : undefined} accessibilityLabel={label || undefined} importantForAccessibility={label ? "yes" : "no-hide-descendants"}
    >
      {m.gradient ? (
        <Defs><LinearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><Stop offset="0%" stopColor="#3730A3" /><Stop offset="100%" stopColor="#0369A1" /></LinearGradient></Defs>
      ) : null}
      {m.shapes.map((s, i) => draw(s, i, gid))}
    </Svg>
  );
}

export default KiorexLogo;
