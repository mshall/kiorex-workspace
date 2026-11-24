// Jest (jest-expo) tests for the React Native <KiorexLogo /> (react-native-svg). Vendored with the component into the Expo app (src/brand/kiorex-logo/).
import * as React from "react";
import TestRenderer, { act } from "react-test-renderer";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RN = require("react-native") as typeof import("react-native"); // the real module object (an `import *` namespace would be a copy, and spies on it would not reach the component)
import { Defs, LinearGradient, Line, Polyline, Rect, Stop, Text as SvgText, TSpan } from "react-native-svg";
import Svg from "react-native-svg";
import { KiorexLogo } from "./KiorexLogo.native";
import { SPEC_SECTION_4 } from "./spec-fixture";

const section = (title: string) => { const i = SPEC_SECTION_4.indexOf(title); const j = SPEC_SECTION_4.indexOf("\n### ", i + 5); return SPEC_SECTION_4.slice(i, j < 0 ? undefined : j); };
const specRects = (s: string) => [...s.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)"\/>/g)].map((m) => m.slice(1, 6).map(Number));
const specPoints = (s: string) => /points="([^"]+)"/.exec(s)![1];
const A = section("### A."), B = section("### B."), C = section("### C.");
const tuples = (s: string) => [...s.matchAll(/\((\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\)/g)].map((m) => [...m.slice(1, 5).map(Number), 1.7]);
const num = (v: unknown) => Number(v);
const tail = (r: { UNSAFE_getAllByType: (t: React.ElementType) => { props: Record<string, unknown> }[] }) => r.UNSAFE_getAllByType(TSpan).find((t) => t.props.children === "X")!; // SvgText renders an inner TSpan too
// react-test-renderer shim exposing the few queries these tests need (RNTL 14 renders asynchronously)
const render = (ui: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer; act(() => { r = TestRenderer.create(ui); });
  const root = r.root;
  return {
    UNSAFE_getAllByType: (t: React.ElementType) => root.findAllByType(t as never), UNSAFE_getByType: (t: React.ElementType) => root.findByType(t as never),
    UNSAFE_queryAllByType: (t: React.ElementType) => root.findAllByType(t as never),
  };
};
const rectsOf = (r: ReturnType<typeof render>, skip = 0) => r.UNSAFE_getAllByType(Rect).slice(skip).map((x) => ["x", "y", "width", "height", "rx"].map((k) => num(x.props[k])));

let scheme: "light" | "dark" | null = "light";
let winW = 390;
beforeEach(() => {
  scheme = "light"; winW = 390;
  // react-native exposes these as lazy getters, so the getter is spied (the hook itself returns the current test values)
  const spyGet = jest.spyOn as unknown as (o: object, n: string, a: "get") => jest.SpyInstance;
  spyGet(RN, "useColorScheme", "get").mockReturnValue(() => scheme);
  spyGet(RN, "useWindowDimensions", "get").mockReturnValue(() => ({ width: winW, height: 800, scale: 2, fontScale: 1 }));
});
afterEach(() => jest.restoreAllMocks());

describe("KiorexLogo (React Native) geometry parity with the founder spec", () => {
  it("master full lockup equals spec A", () => {
    const r = render(<KiorexLogo variant="full" theme="light" height={130} compact={false} />);
    expect(rectsOf(r)).toEqual(specRects(A));
    const pl = r.UNSAFE_getByType(Polyline);
    expect(pl.props.points).toBe(specPoints(A)); expect(num(pl.props.strokeWidth)).toBe(2.6); expect(pl.props.stroke).toBe("#E8735E");
    const line = r.UNSAFE_getByType(Line); expect([line.props.x1, line.props.y1, line.props.x2, line.props.y2, num(line.props.strokeWidth), num(line.props.opacity)].map(String)).toEqual(["144", "26", "144", "104", "1.3", "0.9"]);
    const t = r.UNSAFE_getByType(SvgText); expect([t.props.x, t.props.y, t.props.fontSize, t.props.letterSpacing, t.props.fill].map(String)).toEqual(["172", "74", "27", "8.5", "#3730A3"]);
    expect(String(t.props.fontWeight)).toBe("600"); expect(String(t.props.fontFamily)).toContain("PlusJakartaSans_600SemiBold");
    expect(tail(r).props.fill).toBe("#0369A1");
    expect(r.UNSAFE_getByType(Svg).props.viewBox).toBe("0 0 440 130");
  });
  it("mark and micro mark", () => {
    const m = render(<KiorexLogo variant="mark" theme="light" height={90} />);
    expect(m.UNSAFE_getByType(Svg).props.viewBox).toBe("20 20 110 90"); expect(rectsOf(m)).toEqual(specRects(A)); expect(m.UNSAFE_queryAllByType(SvgText)).toHaveLength(0);
    const u = render(<KiorexLogo variant="mark" theme="light" height={24} />);
    expect(u.UNSAFE_getByType(Svg).props.viewBox).toBe("0 0 32 32"); expect(rectsOf(u)).toEqual(specRects(B));
    expect(u.UNSAFE_getByType(Polyline).props.points).toBe(specPoints(B)); expect(num(u.UNSAFE_getByType(Polyline).props.strokeWidth)).toBe(2.2);
  });
  it("badge equals spec C", () => {
    const r = render(<KiorexLogo variant="badge" height={120} />);
    const all = r.UNSAFE_getAllByType(Rect); expect(["x", "y", "width", "height", "rx"].map((k) => num(all[0].props[k]))).toEqual([4, 4, 112, 112, 26]);
    expect(rectsOf(r, 1)).toEqual(tuples(C)); expect(r.UNSAFE_getByType(Polyline).props.points).toBe(specPoints(C)); expect(num(r.UNSAFE_getByType(Polyline).props.strokeWidth)).toBe(3);
    expect(r.UNSAFE_getAllByType(Stop).map((s) => s.props.stopColor)).toEqual(["#3730A3", "#0369A1"]);
  });
});

describe("responsive rule, theme, tracking, a11y (React Native)", () => {
  it.each([[31, "0 0 32 32"], [32, "0 0 440 130"]])("full at %ipx uses viewBox %s", (h, vb) => {
    expect(render(<KiorexLogo variant="full" height={h} />).UNSAFE_getByType(Svg).props.viewBox).toBe(vb);
  });
  it("size sm is always micro", () => { expect(render(<KiorexLogo variant="full" size="sm" height={48} />).UNSAFE_getByType(Svg).props.viewBox).toBe("0 0 32 32"); });
  it("theme light, dark and auto (device colour scheme)", () => {
    const fill = (r: ReturnType<typeof render>) => r.UNSAFE_getAllByType(Rect)[0].props.fill;
    expect(fill(render(<KiorexLogo variant="mark" theme="light" height={64} />))).toBe("#3730A3");
    expect(fill(render(<KiorexLogo variant="mark" theme="dark" height={64} />))).toBe("#6366F1");
    scheme = "dark"; expect(fill(render(<KiorexLogo variant="mark" theme="auto" height={64} />))).toBe("#6366F1");
    scheme = "light"; expect(fill(render(<KiorexLogo variant="mark" theme="auto" height={64} />))).toBe("#3730A3");
    const d = render(<KiorexLogo variant="full" theme="dark" height={64} />); expect(d.UNSAFE_getByType(SvgText).props.fill).toBe("#F4F6FC"); expect(tail(d).props.fill).toBe("#38BDF8");
  });
  it("monochrome pulse is 3.2 and everything uses the given colour source", () => {
    const r = render(<KiorexLogo variant="monochrome" height={130} color="#112233" />);
    expect(num(r.UNSAFE_getByType(Polyline).props.strokeWidth)).toBe(3.2); expect(new Set(r.UNSAFE_getAllByType(Rect).map((x) => x.props.fill))).toEqual(new Set(["currentColor"]));
    expect(r.UNSAFE_getByType(Svg).props.color).toBe("#112233");
  });
  it("tracking tightens to 0.18em below 480 wide", () => {
    winW = 390; expect(num(render(<KiorexLogo variant="full" height={64} />).UNSAFE_getByType(SvgText).props.letterSpacing)).toBeCloseTo(4.86, 2);
    winW = 768; expect(num(render(<KiorexLogo variant="full" height={64} />).UNSAFE_getByType(SvgText).props.letterSpacing)).toBe(8.5);
    expect(num(render(<KiorexLogo variant="full" height={64} compact />).UNSAFE_getByType(SvgText).props.letterSpacing)).toBeCloseTo(0.18 * 27, 2);
  });
  it("three badges get three different gradient ids that their fills reference", () => {
    const r = render(<><KiorexLogo variant="badge" /><KiorexLogo variant="badge" /><KiorexLogo variant="badge" size="sm" /></>);
    const ids = r.UNSAFE_getAllByType(LinearGradient).map((g) => g.props.id); expect(new Set(ids).size).toBe(3); expect(r.UNSAFE_getAllByType(Defs)).toHaveLength(3);
    const squircleFills = r.UNSAFE_getAllByType(Rect).filter((x) => String(x.props.fill).startsWith("url(")).map((x) => x.props.fill); expect(squircleFills.sort()).toEqual(ids.map((i) => `url(#${i})`).sort());
  });
  it('is an accessible image named "KIOREX" (or decorative with title="")', () => {
    const r = render(<KiorexLogo />); const s = r.UNSAFE_getByType(Svg); expect(s.props.accessibilityRole).toBe("image"); expect(s.props.accessibilityLabel).toBe("KIOREX");
    const d = render(<KiorexLogo title="" />).UNSAFE_getByType(Svg); expect(d.props.accessibilityLabel).toBeUndefined(); expect(d.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});
