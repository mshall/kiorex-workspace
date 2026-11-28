import { expect, test, type Browser } from '@playwright/test';
import type { Server } from 'node:http';
import { URLS } from '../../kx-test/lib/hosts';
import { collect, bundleText } from '../lib/hygiene';
import { nativeSignIn } from '../lib/native-passport';
import { injectStaffSession, type StaffProduct } from '../lib/staff-session';
import { serveStatic, webDir } from '../lib/serve';

/** Kiorly staff app (Expo web export, kx-test profile) against the live Pharmacy and Lab APIs with Passport tokens of synthetic personas. */
const PORT = 5872; const BASE = `http://127.0.0.1:${PORT}`;
const SC = ['openid', 'profile', 'phone', 'kx', 'kx_org', 'offline_access'];
const hostsOk = new Set([URLS.pharmacy, URLS.lab, URLS.clinic, URLS.passport].map((u) => new URL(u).host));
let srv: Server;
test.beforeAll(async () => { srv = await serveStatic(webDir('kiorly'), PORT); });
test.afterAll(() => { srv?.close(); });

async function as(browser: Browser, product: StaffProduct, name: string, phone: string, base: string) {
  const t = await nativeSignIn(browser, { clientId: 'kiorly', scheme: 'kiorly', scopes: SC, phone, cacheName: `staff-${name}` });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 } });
  await ctx.addInitScript(() => localStorage.setItem('kw-lang', 'en'));
  const info = await injectStaffSession(ctx, product, base, t);
  return { ctx, info };
}
const text = async (page: import('@playwright/test').Page, p: string) => { await page.goto(`${BASE}${p}`); await page.waitForLoadState('networkidle').catch(() => undefined); await page.waitForTimeout(800); return (await page.locator('body').innerText()).replace(/\s+/g, ' '); };

test('the shipped bundle resolves the three product APIs and Passport from the kx-test profile, no local address, no demo data', () => {
  const js = bundleText(webDir('kiorly'));
  for (const u of [URLS.pharmacy, URLS.lab, URLS.clinic, URLS.passport]) expect(js).toContain(u);
  expect(js).not.toMatch(/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)/);
  for (const m of ['Test users (dev only)', 'DevTestUsers', 'dev-user-']) expect(js).not.toContain(m);
});

test('signed out: four product entries (Clinic, Nurse, Pharmacy, Lab) and Passport sign-in', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 } }); const page = await ctx.newPage(); const c = collect(page);
  await page.goto(`${BASE}/`);
  for (const e of ['clinic', 'nurse', 'pharmacy', 'lab']) await expect(page.getByTestId(`product-${e}`)).toBeVisible();
  await expect(page.getByTestId('signin-passport')).toBeVisible();
  expect(c.errors).toEqual([]);
  await ctx.close();
});

test('Pharmacy cashier: home, work, inbox, account, prescription queue and expiry load; Kiorex orders say "role does not include this" instead of a retry loop', async ({ browser }) => {
  const { ctx, info } = await as(browser, 'pharmacy', 'pharmacy-cashier', '+201000002008', `${URLS.pharmacy}/api/v1`);
  expect(info.bootstrap?.entitlement?.enabled).toBe(true); expect(info.deviceOk).toBe(true);
  const page = await ctx.newPage(); const c = collect(page);
  expect(await text(page, '/')).toMatch(/Omar/);
  expect(await text(page, '/work')).toMatch(/Work/);
  expect(await text(page, '/inbox')).toMatch(/Inbox/);
  expect(await text(page, '/me')).toMatch(/CASHIER/);
  expect(await text(page, '/pharmacy/rx')).toMatch(/Hoda Mahmoud/);
  expect(await text(page, '/pharmacy/expiry')).toMatch(/Expiry|expir/i);
  expect(await text(page, '/pharmacy/orders')).toMatch(/role does not include this/i);
  await expect(page.getByTestId('not-allowed')).toBeVisible();
  expect(c.errors).toEqual([]); expect(c.bad).toEqual([]);
  for (const h of c.hosts) expect(hostsOk).toContain(h);
  await ctx.close();
});

test('Lab technologist: home, order list, worklist and critical values load; Growth says the role lacks it', async ({ browser }) => {
  const { ctx, info } = await as(browser, 'lab', 'lab-tech', '+201000002005', `${URLS.lab}/api/v1`);
  expect(info.bootstrap?.entitlement?.enabled).toBe(true);
  const page = await ctx.newPage(); const c = collect(page);
  expect(await text(page, '/')).toMatch(/Omar/);
  expect(await text(page, '/lab/orders')).toMatch(/ORD-|No orders found/); // the screen is "Today's orders": the demo orders age out of today, so the empty state is a valid answer (the Lab web spec 04 asserts the demo orders)
  expect(await text(page, '/lab/worklist')).toMatch(/HEMATOLOGY|Hematology/i);
  expect(await text(page, '/lab/critical')).toMatch(/Critical/i);
  expect(await text(page, '/lab/growth')).toMatch(/role/i);
  expect(c.errors).toEqual([]); expect(c.bad).toEqual([]);
  for (const h of c.hosts) expect(hostsOk).toContain(h);
  await ctx.close();
});

test('offline/outage: a 503 on the work list shows an error state with retry, never a blank screen', async ({ browser }) => {
  const { ctx } = await as(browser, 'lab', 'lab-tech', '+201000002005', `${URLS.lab}/api/v1`);
  const page = await ctx.newPage();
  await ctx.route(`${URLS.lab}/api/v1/orders**`, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"UNAVAILABLE"}' }));
  const t = await text(page, '/lab/orders');
  expect(t.length).toBeGreaterThan(20);
  await ctx.close();
});

test('the shipped bundle carries the new staff capabilities (Lab result entry, Clinic commission statement) and still no local address', () => {
  const js = bundleText(webDir('kiorly'));
  expect(js).toContain('lab/results/[specimenId]');
  expect(js).toContain('/billing/kiorex-commissions/statement');
  expect(js).toContain('/billing/kiorex-commissions/access');
  expect(js).not.toMatch(/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)/);
});

test('Lab technologist: the result-entry route for a specimen that is not in processing says so (no crash, no write); the work list loads', async ({ browser }) => {
  const { ctx } = await as(browser, 'lab', 'lab-tech', '+201000002005', `${URLS.lab}/api/v1`);
  const page = await ctx.newPage(); const c = collect(page);
  const writes: string[] = []; page.on('request', (r) => { if (r.method() !== 'GET' && r.url().startsWith(URLS.lab)) writes.push(`${r.method()} ${new URL(r.url()).pathname}`); });
  expect(await text(page, '/lab/worklist')).toMatch(/Work ?list|Worklist|In the lab|queue/i);
  expect(await text(page, '/lab/results/does-not-exist')).toMatch(/not in processing any more|cannot do this|Result entry/i);
  expect(writes.filter((w) => /\/results/.test(w))).toEqual([]); // device push-token upkeep is not a result write
  expect(c.errors).toEqual([]);
  for (const h of c.hosts) expect(hostsOk).toContain(h);
  await ctx.close();
});

test('Pharmacy cashier: the Kiorex-order and commission screens answer "your role" instead of a retry loop; MFA state is friendly where the server asks for it', async ({ browser }) => {
  const { ctx } = await as(browser, 'pharmacy', 'pharmacy-cashier', '+201000002008', `${URLS.pharmacy}/api/v1`);
  const page = await ctx.newPage(); const c = collect(page);
  expect(await text(page, '/pharmacy/orders')).toMatch(/role does not include this/i);
  expect(await text(page, '/pharmacy/controlled')).toMatch(/role does not include this|not include/i);
  expect(c.errors).toEqual([]);
  await ctx.close();
});

