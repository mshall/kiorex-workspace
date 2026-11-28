import { describe, expect, it } from "vitest";
import { composePageTitle } from "./use-page-title";

describe("composePageTitle", () => {
  it("joins the screen heading and the product", () => expect(composePageTitle("Kiorly Lab by Kiorex", "Worklist")).toBe("Worklist - Kiorly Lab by Kiorex"));
  it("falls back to the product", () => { expect(composePageTitle("Kiorex Ops", "")).toBe("Kiorex Ops"); expect(composePageTitle("Kiorex Ops", null)).toBe("Kiorex Ops"); });
  it("does not repeat the product and collapses whitespace", () => { expect(composePageTitle("Kiorex Ops", "Kiorex Ops")).toBe("Kiorex Ops"); expect(composePageTitle("X", "  Open \n orders ")).toBe("Open orders - X"); });
});
