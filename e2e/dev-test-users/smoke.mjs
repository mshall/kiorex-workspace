#!/usr/bin/env node
// Playwright smoke for the DEV ONLY "Test users (dev only)" panels (and an API-level check of EVERY listed credential).
// Needs the stack up (e2e/scripts/up.sh) + seeded (scripts/seed-all.sh) and the web dev servers you want covered.
//   node e2e/dev-test-users/smoke.mjs [passport|ops|clinic|pharmacy|lab|api|all]   (default all; skips an app whose web server is down)
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { chromium } = require(path.join(root, "kiorex-account/node_modules/playwright"));

const U = { patientWeb: "http://localhost:5180", ops: "http://localhost:5181", clinic: "http://localhost:5174", pharmacy: "http://localhost:5192", lab: "http://localhost:5193", passport: "http://localhost:4400" };
const API = { clinic: "http://localhost:3010/api/v1", pharmacy: "http://localhost:3100/api/v1", lab: "http://localhost:3200/api/v1" };
const want = process.argv[2] ?? "all";
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`); };
const up = async (url) => { try { return (await fetch(url)).status < 500; } catch { return false; } };

async function passport(browser, label, start, phoneName, { totp = false, expectUrl, lang } = {}) {
  const ctx = await browser.newContext({ locale: lang === "ar" ? "ar-EG" : "en-US" });
  const page = await ctx.newPage();
  try {
    await page.goto(start, { waitUntil: "domcontentloaded" });
    if (start.endsWith("/")) await page.waitForURL(/4400\/interaction|\/auth/, { timeout: 15000 }).catch(() => {});
    await page.waitForSelector("[data-dev-test-users]", { timeout: 15000 });
    const heading = await page.locator("[data-dev-test-users] h2").first().innerText();
    ok(`${label}: panel visible`, /Test users \(dev only\)|مستخدمو الاختبار \(للتطوير فقط\)/.test(heading), heading.replace(/\s+/g, " "));
    await page.locator(`[data-dev-phone="${phoneName}"]`).click();
    if (totp) {
      await page.waitForSelector("#dev-fill", { timeout: 15000 });
      await page.click("#dev-fill");
    }
    await page.waitForURL(expectUrl, { timeout: 25000 });
    ok(`${label}: signed in as ${phoneName}`, true, page.url().slice(0, 60));
    return page;
  } catch (e) { ok(`${label}: sign-in`, false, String(e.message).split("\n")[0]); await page.screenshot({ path: `/tmp/kx-smoke-${label.replace(/\W+/g, "_")}.png` }).catch(() => {}); }
  finally { await ctx.close(); }
}

const browser = await chromium.launch();
try {
  if (["all", "passport"].includes(want) && (await up(U.patientWeb))) {
    await passport(browser, "patient web (EN) Hoda", `${U.patientWeb}/account`, "+201000001001", { expectUrl: /localhost:5180\/(?!auth\/callback)/ });
    await passport(browser, "patient web (AR) Mariam", `${U.patientWeb}/account`, "+201000001006", { expectUrl: /localhost:5180\/(?!auth\/callback)/, lang: "ar" });
  }
  if (["all", "ops"].includes(want) && (await up(U.ops))) {
    await passport(browser, "ops console super admin (TOTP)", `${U.ops}/`, "+201000000099", { totp: true, expectUrl: /localhost:5181\/(?!auth\/callback)/ });
    await passport(browser, "ops console admin (TOTP)", `${U.ops}/`, "+201000009001", { totp: true, expectUrl: /localhost:5181\/(?!auth\/callback)/ });
  }
  // patient Expo app (web build): chips pass the phone as login_hint; Passport fills phone + code on its own
  if (["all", "mobile"].includes(want) && (await up("http://localhost:8081"))) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    try {
      await page.goto("http://localhost:8081/sign-in");
      await page.waitForSelector("[data-testid=dev-test-users]", { timeout: 60000 });
      ok("patient app: panel visible", true);
      await page.click('[data-testid="dev-user-+201000001006"]');
      await page.waitForURL(/localhost:8081\/(?!auth\/callback|sign-in)/, { timeout: 40000 });
      ok("patient app: Mariam signed in via login_hint", true, new URL(page.url()).pathname);
    } catch (e) { ok("patient app: quick-pick", false, String(e.message).split("\n")[0]); }
    await ctx.close();
  }
  // Kiorly staff app (Expo web): chips fill the credentials, Sign in submits
  if (["all", "team"].includes(want) && (await up(`http://localhost:${process.env.KX_TEAM_PORT ?? 8082}`))) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    try {
      await page.goto(`http://localhost:${process.env.KX_TEAM_PORT ?? 8082}/sign-in`);
      await page.waitForSelector("[data-testid=dev-test-users]", { timeout: 60000 });
      ok("staff app: panel visible", true);
      await page.click('[data-testid="demo-nadia.na@demo.kiorex.test"]');
      await page.click("[data-testid=signin-submit]");
      await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 30000 });
      ok("staff app: Dr Nadia signed in", true, new URL(page.url()).pathname);
    } catch (e) { ok("staff app: quick-pick", false, String(e.message).split("\n")[0]); }
    await ctx.close();
  }
  const web = async (key, loginPath, picks) => {
    if (!(await up(U[key]))) return console.log(`SKIP  ${key} web not running`);
    for (const [id, expectNot, lang] of picks) {
      const ctx = await browser.newContext({ locale: lang === "ar" ? "ar-EG" : "en-US" }); const page = await ctx.newPage();
      try {
        if (lang === "ar") await page.addInitScript(() => { try { localStorage.setItem("kiorly-locale", "ar"); localStorage.setItem("i18nextLng", "ar"); } catch {} });
        await page.goto(U[key] + loginPath);
        await page.waitForSelector("[data-testid=dev-test-users]", { timeout: 20000 });
        ok(`${key}: panel visible`, true);
        await page.click(`[data-testid="dev-user-${id}"]`);
        await page.waitForURL((u) => !u.pathname.startsWith(loginPath), { timeout: 20000 });
        ok(`${key}: ${id} signed in${lang === "ar" ? " (AR)" : ""}`, true, new URL(page.url()).pathname);
        if (lang === "ar") ok(`${key}: RTL`, (await page.evaluate(() => document.documentElement.dir)) === "rtl");
      } catch (e) { ok(`${key}: ${id}`, false, String(e.message).split("\n")[0]); await page.screenshot({ path: `/tmp/kx-smoke-${key}.png` }).catch(() => {}); }
      await ctx.close();
    }
  };
  if (["all", "clinic"].includes(want)) await web("clinic", "/login", [["owner.na@demo.kiorex.test"], ["nurse.na@demo.kiorex.test"], ["mona@nurse-demo.kiorly.test"]]);
  if (["all", "pharmacy"].includes(want)) await web("pharmacy", "/login", [["pharmacist@demo.kiorly.local"], ["owner.basic@demo.kiorly.local"]]);
  if (["all", "lab"].includes(want)) await web("lab", "/login", [["signatory@demo-lab.test"], ["director@basic-lab.test"]]);
} finally { await browser.close(); }

// API level: EVERY credential listed in the panels must really log in.
if (["all", "api"].includes(want)) {
  // the Clinic login endpoint is rate limited: honour retryAfterSec instead of failing
  const post = async (url, body) => {
    for (let i = 0; i < 6; i++) {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (r.status !== 429) return r.status;
      const j = await r.json().catch(() => ({})); await new Promise((res) => setTimeout(res, ((j.retryAfterSec ?? 30) + 1) * 1000));
    }
    return 429;
  };
  const { DEV_USERS: cu } = await import("../../clinics-management/apps/web/src/dev/dev-test-users-data.ts").catch(() => ({ DEV_USERS: [] }));
  for (const u of cu) { const s = await post(`${API.clinic}/auth/login`, { email: u.email, password: u.password }); ok(`API clinic ${u.email}`, s === 200 || s === 201, String(s)); }
  const { DEV_USERS: pu, DEMO_PASSWORD } = await import("../../kiorly-pharmacy/apps/web/src/dev/dev-test-users-data.ts").catch(() => ({ DEV_USERS: [] }));
  for (const u of pu) { const s = await post(`${API.pharmacy}/auth/login`, { email: u.email, password: DEMO_PASSWORD }); ok(`API pharmacy ${u.email}`, s === 200 || s === 201, String(s)); }
  const { DEV_USERS: lu } = await import("../../kiorly-lab/apps/web/src/dev/dev-test-users-data.ts").catch(() => ({ DEV_USERS: [] }));
  for (const u of lu) { const s = await post(`${API.lab}/auth/dev-login`, { orgSlug: u.slug, email: u.email }); ok(`API lab ${u.email}`, s === 200 || s === 201, String(s)); }
}
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
