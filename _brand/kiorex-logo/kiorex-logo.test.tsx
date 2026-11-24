// Unit tests for <KiorexLogo /> (web). Vendored with the component into each web app (src/brand/kiorex-logo/). Compares the rendered SVG to the founder spec text itself.
import { act, render, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { KiorexLogo } from "./KiorexLogo.web";
import { SPEC_SECTION_4 } from "./spec-fixture";

// ---- spec parsing -------------------------------------------------------------------------------------------------------------------------------------------------
const section = (title: string) => { const i = SPEC_SECTION_4.indexOf(title); const j = SPEC_SECTION_4.indexOf("\n### ", i + 5); return SPEC_SECTION_4.slice(i, j < 0 ? undefined : j); };
const RECT = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="([\d.]+)"\/>/g;
const specRects = (s: string) => [...s.matchAll(RECT)].map((m) => m.slice(1, 6).map(Number));
const specPoints = (s: string) => /points="([^"]+)"/.exec(s)![1];
const A = section("### A."), B = section("### B."), C = section("### C.");
const badgeTuples = (s: string) => [...s.matchAll(/\((\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\)/g)].map((m) => [...m.slice(1, 5).map(Number), 1.7]);

const rectsOf = (root: ParentNode) => [...root.querySelectorAll("rect")].map((r) => ["x", "y", "width", "height", "rx"].map((a) => Number(r.getAttribute(a))));
const mount = (ui: React.ReactElement) => { const { container } = render(ui); return container.querySelector("svg")!; };

function mockMedia(matches: Record<string, boolean>) {
  const listeners = new Map<string, Set<() => void>>();
  window.matchMedia = ((q: string) => ({
    get matches() { return !!matches[q] || (q.includes("max-width") && !!matches["compact"]); }, media: q, onchange: null,
    addEventListener: (_: string, cb: () => void) => { (listeners.get(q) ?? listeners.set(q, new Set()).get(q)!).add(cb); },
    removeEventListener: (_: string, cb: () => void) => { listeners.get(q)?.delete(cb); },
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return { fire: () => listeners.forEach((s) => s.forEach((cb) => cb())) };
}

beforeEach(() => { document.documentElement.className = ""; document.documentElement.removeAttribute("data-theme"); mockMedia({}); });
afterEach(cleanup);

describe("KiorexLogo geometry parity with the founder spec", () => {
  it("master full lockup: 16 bars, pulse, divider and wordmark equal spec A", () => {
    const svg = mount(<KiorexLogo variant="full" theme="light" height={130} />);
    expect(svg.getAttribute("viewBox")).toBe("0 0 440 130");
    const expected = specRects(A); expect(expected).toHaveLength(16);
    expect(rectsOf(svg)).toEqual(expected);
    expect(svg.querySelector("polyline")!.getAttribute("points")).toBe(specPoints(A));
    const pl = svg.querySelector("polyline")!;
    expect(pl.getAttribute("stroke")).toBe("#E8735E"); expect(pl.getAttribute("stroke-width")).toBe("2.6");
    expect(pl.getAttribute("stroke-linecap")).toBe("round"); expect(pl.getAttribute("stroke-linejoin")).toBe("round"); expect(pl.getAttribute("fill")).toBe("none");
    const line = svg.querySelector("line")!;
    expect([line.getAttribute("x1"), line.getAttribute("y1"), line.getAttribute("x2"), line.getAttribute("y2"), line.getAttribute("stroke"), line.getAttribute("stroke-width"), line.getAttribute("opacity")]).toEqual(["144", "26", "144", "104", "#E8735E", "1.3", "0.9"]);
    const t = svg.querySelector("text")!;
    expect([t.getAttribute("x"), t.getAttribute("y"), t.getAttribute("font-weight"), t.getAttribute("font-size"), t.getAttribute("letter-spacing"), t.getAttribute("fill")]).toEqual(["172", "74", "600", "27", "8.5", "#3730A3"]);
    expect(t.getAttribute("font-family")).toContain("'Plus Jakarta Sans'"); expect(t.getAttribute("font-family")).toContain("'Inter'");
    expect(t.textContent).toBe("KIORE" + "X"); expect(t.querySelector("tspan")!.textContent).toBe("X"); expect(t.querySelector("tspan")!.getAttribute("fill")).toBe("#0369A1");
    // spec colours: left bars Indigo, right bars Ocean
    const fills = [...svg.querySelectorAll("rect")].map((r) => r.getAttribute("fill"));
    expect(fills.slice(0, 8).every((f) => f === "#3730A3")).toBe(true); expect(fills.slice(8).every((f) => f === "#0369A1")).toBe(true);
  });

  it("mark uses viewBox 20 20 110 90 with the same bars and pulse and no wordmark", () => {
    const svg = mount(<KiorexLogo variant="mark" theme="light" height={90} />);
    expect(svg.getAttribute("viewBox")).toBe("20 20 110 90");
    expect(rectsOf(svg)).toEqual(specRects(A)); expect(svg.querySelector("polyline")!.getAttribute("points")).toBe(specPoints(A));
    expect(svg.querySelector("text")).toBeNull(); expect(svg.querySelector("line")).toBeNull();
  });

  it("micro mark equals spec B (4 channels, viewBox 0 0 32 32, pulse 2.2)", () => {
    const svg = mount(<KiorexLogo variant="mark" theme="light" height={24} />);
    expect(svg.getAttribute("viewBox")).toBe("0 0 32 32"); expect(svg.dataset.kxLogo).toBe("micro");
    const expected = specRects(B); expect(expected).toHaveLength(8);
    expect(rectsOf(svg)).toEqual(expected);
    const pl = svg.querySelector("polyline")!; expect(pl.getAttribute("points")).toBe(specPoints(B)); expect(pl.getAttribute("stroke-width")).toBe("2.2");
    const fills = [...svg.querySelectorAll("rect")].map((r) => r.getAttribute("fill"));
    expect(fills.slice(0, 4)).toEqual(Array(4).fill("#3730A3")); expect(fills.slice(4)).toEqual(Array(4).fill("#0369A1"));
    // smallest bar width at 24px is still >= 1.5px (the reason for the micro mark)
    expect(3.4 * (24 / 32)).toBeGreaterThanOrEqual(1.5);
  });

  it("badge equals spec C: squircle, 16 Ground bars, pulse 3", () => {
    const svg = mount(<KiorexLogo variant="badge" height={120} />);
    expect(svg.getAttribute("viewBox")).toBe("0 0 120 120");
    const rects = [...svg.querySelectorAll("rect")];
    const sq = rects[0]; expect([sq.getAttribute("x"), sq.getAttribute("y"), sq.getAttribute("width"), sq.getAttribute("height"), sq.getAttribute("rx")]).toEqual(["4", "4", "112", "112", "26"]);
    expect(sq.getAttribute("fill")).toMatch(/^url\(#kx-grad-/);
    const bars = rects.slice(1).map((r) => ["x", "y", "width", "height", "rx"].map((a) => Number(r.getAttribute(a))));
    const tuples = badgeTuples(C); expect(tuples).toHaveLength(16);
    expect(bars).toEqual(tuples);
    expect(rects.slice(1).every((r) => r.getAttribute("fill") === "#F4F6FC")).toBe(true);
    const pl = svg.querySelector("polyline")!; expect(pl.getAttribute("points")).toBe(specPoints(C)); expect(pl.getAttribute("stroke-width")).toBe("3");
    const stops = [...svg.querySelectorAll("stop")]; expect(stops.map((s) => s.getAttribute("stop-color"))).toEqual(["#3730A3", "#0369A1"]); expect(stops.map((s) => s.getAttribute("offset"))).toEqual(["0%", "100%"]);
  });
});

describe("responsive rule: micro mark below 32px, master from 32px", () => {
  it.each([["full", 31, "micro"], ["full", 32, "master"], ["mark", 12, "micro"], ["mark", 31.9, "micro"], ["mark", 32, "master"], ["mark", 240, "master"], ["monochrome", 16, "micro"], ["monochrome", 64, "master"]] as const)(
    "%s at %ipx renders %s", (variant, h, mode) => {
      const svg = mount(<KiorexLogo variant={variant} height={h} />);
      expect(svg.dataset.kxLogo).toBe(mode); expect(svg.getAttribute("height")).toBe(String(h));
      expect(svg.getAttribute("viewBox")).toBe(mode === "micro" ? "0 0 32 32" : variant === "mark" ? "20 20 110 90" : "0 0 440 130");
    });
  it("size sm always renders the micro mark, md and lg the master", () => {
    expect(mount(<KiorexLogo variant="full" size="sm" />).dataset.kxLogo).toBe("micro"); cleanup();
    expect(mount(<KiorexLogo variant="full" size="sm" height={48} />).dataset.kxLogo).toBe("micro"); cleanup();
    const md = mount(<KiorexLogo variant="full" size="md" />); expect(md.dataset.kxLogo).toBe("master"); expect(Number(md.getAttribute("height"))).toBeGreaterThanOrEqual(32); expect(Number(md.getAttribute("height"))).toBeLessThanOrEqual(48); cleanup();
    expect(Number(mount(<KiorexLogo variant="full" size="lg" />).getAttribute("height"))).toBeGreaterThan(48);
  });
  it("width follows the viewBox aspect ratio", () => {
    expect(mount(<KiorexLogo variant="full" height={130} />).getAttribute("width")).toBe("440"); cleanup();
    expect(Number(mount(<KiorexLogo variant="mark" height={90} />).getAttribute("width"))).toBeCloseTo(110, 1);
  });
});

describe("theme", () => {
  it("light and dark colours follow the spec", () => {
    const l = mount(<KiorexLogo variant="full" theme="light" height={64} />); const dark = (() => { cleanup(); return mount(<KiorexLogo variant="full" theme="dark" height={64} />); })();
    const f = (s: SVGElement) => [...s.querySelectorAll("rect")].map((r) => r.getAttribute("fill"));
    expect(new Set(f(l))).toEqual(new Set(["#3730A3", "#0369A1"]));
    expect(new Set(f(dark))).toEqual(new Set(["#6366F1", "#38BDF8"]));
    const t = dark.querySelector("text")!; expect(t.getAttribute("fill")).toBe("#F4F6FC"); expect(t.querySelector("tspan")!.getAttribute("fill")).toBe("#38BDF8");
    expect(dark.querySelector("polyline")!.getAttribute("stroke")).toBe("#E8735E");
  });
  it("auto follows the .dark class, data-theme and prefers-color-scheme", async () => {
    const { container, rerender } = render(<KiorexLogo variant="mark" theme="auto" height={64} />);
    const first = () => container.querySelector("rect")!.getAttribute("fill");
    expect(first()).toBe("#3730A3");
    await act(async () => { document.documentElement.classList.add("dark"); });
    expect(first()).toBe("#6366F1");
    await act(async () => { document.documentElement.classList.remove("dark"); });
    expect(first()).toBe("#3730A3");
    await act(async () => { document.documentElement.dataset.theme = "dark"; });
    expect(first()).toBe("#6366F1");
    document.documentElement.removeAttribute("data-theme");
    const mm = mockMedia({ "(prefers-color-scheme: dark)": true });
    rerender(<KiorexLogo variant="mark" theme="auto" height={64} />); act(() => mm.fire());
    expect(first()).toBe("#6366F1");
    rerender(<KiorexLogo variant="mark" theme="auto" followSystem={false} height={64} />); act(() => mm.fire()); expect(first()).toBe("#3730A3"); // app themes that ignore the OS setting
    rerender(<KiorexLogo variant="mark" theme="light" height={64} />); expect(first()).toBe("#3730A3");
  });
});

describe("monochrome", () => {
  it("uses currentColor everywhere and a 3.2 pulse stroke", () => {
    const svg = mount(<KiorexLogo variant="monochrome" height={130} />);
    expect(svg.querySelector("polyline")!.getAttribute("stroke-width")).toBe("3.2");
    const colours = [...svg.querySelectorAll("rect")].map((r) => r.getAttribute("fill")).concat(svg.querySelector("polyline")!.getAttribute("stroke")!, svg.querySelector("line")!.getAttribute("stroke")!, svg.querySelector("text")!.getAttribute("fill")!, svg.querySelector("tspan")!.getAttribute("fill")!);
    expect(new Set(colours)).toEqual(new Set(["currentColor"]));
    expect(rectsOf(svg)).toEqual(specRects(A));
  });
});

describe("badge gradient ids", () => {
  it("three badge instances on one page never share a gradient id", () => {
    const { container } = render(<div><KiorexLogo variant="badge" /><KiorexLogo variant="badge" /><KiorexLogo variant="badge" size="sm" /></div>);
    const ids = [...container.querySelectorAll("linearGradient")].map((g) => g.id); expect(ids).toHaveLength(3); expect(new Set(ids).size).toBe(3);
    container.querySelectorAll("svg").forEach((s) => { const id = s.querySelector("linearGradient")!.id; expect(id).not.toContain(":"); expect(s.querySelector("rect")!.getAttribute("fill")).toBe(`url(#${id})`); });
  });
  it("ids are unique across server markup too", () => {
    const html = renderToStaticMarkup(<div><KiorexLogo variant="badge" /><KiorexLogo variant="badge" /></div>);
    const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((m) => m[1]); expect(new Set(ids).size).toBe(2);
  });
});

describe("accessibility", () => {
  it('has role="img" and aria-label="KIOREX" by default', () => {
    const svg = mount(<KiorexLogo />); expect(svg.getAttribute("role")).toBe("img"); expect(svg.getAttribute("aria-label")).toBe("KIOREX");
  });
  it("accepts a custom title and can be decorative", () => {
    expect(mount(<KiorexLogo title="Kiorex home" />).getAttribute("aria-label")).toBe("Kiorex home"); cleanup();
    const d = mount(<KiorexLogo title="" />); expect(d.getAttribute("role")).toBeNull(); expect(d.getAttribute("aria-hidden")).toBe("true");
  });
  it("passes className and style through", () => {
    const svg = mount(<KiorexLogo className="x y" style={{ opacity: 0.5 }} />); expect(svg.getAttribute("class")).toBe("x y"); expect(svg.style.opacity).toBe("0.5");
  });
});

describe("wordmark tracking", () => {
  const spacing = (svg: SVGElement) => Number(svg.querySelector("text")!.getAttribute("letter-spacing"));
  it("is 8.5 by default and 0.18em (4.86 at 27px) when compact", () => {
    expect(spacing(mount(<KiorexLogo variant="full" height={64} compact={false} />))).toBe(8.5); cleanup();
    const c = spacing(mount(<KiorexLogo variant="full" height={64} compact />)); expect(c).toBeCloseTo(0.18 * 27, 2); expect(c / 27).toBeCloseTo(0.18, 3);
  });
  it("auto tightens below 480px viewport width only", () => {
    mockMedia({ compact: true }); expect(spacing(mount(<KiorexLogo variant="full" height={64} />))).toBeCloseTo(4.86, 2); cleanup();
    mockMedia({}); expect(spacing(mount(<KiorexLogo variant="full" height={64} />))).toBe(8.5);
  });
  it("tracking is scale-correct: letter-spacing is in viewBox units, so it scales with the height", () => {
    const a = mount(<KiorexLogo variant="full" height={64} compact />); cleanup(); const b = mount(<KiorexLogo variant="full" height={128} compact />);
    expect(spacing(a)).toBe(spacing(b));
  });
});

void vi;
