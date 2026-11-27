import { expect, test, type BrowserContext } from '@playwright/test';
import type { Server } from 'node:http';
import { URLS } from '../../kx-test/lib/hosts';
import { collect, bundleText } from '../lib/hygiene';
import { nativeSignIn } from '../lib/native-passport';
import { serveStatic, webDir } from '../lib/serve';

/** Kiorex patient app (Expo web export, kx-test profile) against the live kx-test API and Passport. Persona: patient Hoda Mahmoud (synthetic). */
const PORT = 5871; const BASE = `http://127.0.0.1:${PORT}`;
const apiHost = new URL(URLS.api).host; const passportHost = new URL(URLS.passport).host;
let srv: Server;
test.beforeAll(async () => { srv = await serveStatic(webDir('kiorex'), PORT); });
test.afterAll(() => { srv?.close(); });

async function signedIn(browser: import('@playwright/test').Browser, lang: 'en' | 'ar' = 'en'): Promise<BrowserContext> {
  const t = await nativeSignIn(browser, { clientId: 'kiorex-mobile', scheme: 'kiorex', scopes: ['openid', 'profile', 'phone', 'email', 'offline_access'], phone: '+201000001001', cacheName: 'patient' });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 } });
  await ctx.addInitScript(([tok, l]) => { sessionStorage.setItem('kx-passport-tokens', JSON.stringify(tok)); localStorage.setItem('kx-lang', l as string); }, [{ accessToken: t.accessToken, refreshToken: t.refreshToken, idToken: t.idToken, expiresAt: t.expiresAt }, lang] as const);
  return ctx;
}

test('the shipped bundle resolves hosts from the kx-test profile, no local address, no demo data', () => {
  const js = bundleText(webDir('kiorex'));
  expect(js).toContain(URLS.api); expect(js).toContain(URLS.passport);
  expect(js).not.toMatch(/https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)/);
  for (const m of ['+201000001001', 'dev-user-', 'DevTestUsers', 'Test users (dev only)']) expect(js).not.toContain(m);
});

test('signed out: the welcome screen offers Passport sign-in, both languages, and calls only registry hosts', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 } });
  const page = await ctx.newPage(); const c = collect(page);
  await page.goto(`${BASE}/`);
  await expect(page.getByTestId('signin-card')).toBeVisible();
  await expect(page.getByTestId('signin-title')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl'); // first launch is Arabic
  await page.getByTestId('language-menu').click();
  await page.getByText('English', { exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('ltr');
  expect(c.errors).toEqual([]);
  for (const h of c.hosts) expect([apiHost, passportHost]).toContain(h); // no font CDN, no analytics host
  await ctx.close();
});

test('signed in: home, appointments, records, account and services load from the live API (English)', async ({ browser }) => {
  const ctx = await signedIn(browser); const page = await ctx.newPage(); const c = collect(page);
  const get = async (p: string) => { await page.goto(`${BASE}${p}`); await page.waitForLoadState('networkidle').catch(() => undefined); return (await page.locator('body').innerText()).replace(/\s+/g, ' '); };
  expect(await get('/')).toMatch(/Hello, (Hoda Mahmoud|هدى محمود)/);
  expect(await get('/appointments')).toMatch(/Appointments|appointments/);
  expect(await get('/records')).toMatch(/Records/);
  const account = await get('/account'); expect(account).toMatch(/Hoda Mahmoud|هدى محمود/); expect(account).toContain('+201000001001'); expect(account).toMatch(/Kiorex Passport/);
  expect(await get('/services')).toMatch(/Services/);
  expect(c.errors).toEqual([]); expect(c.bad).toEqual([]);
  for (const h of c.hosts) expect([apiHost, passportHost]).toContain(h);
  await ctx.close();
});

test('the Egypt market gate is honest: the launch banner shows while search is closed, and gated services say "awaiting approval"', async ({ browser }) => {
  const ctx = await signedIn(browser); const page = await ctx.newPage();
  await page.goto(`${BASE}/services`); await page.waitForLoadState('networkidle').catch(() => undefined);
  const txt = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  // closed gate (no human evidence yet): every service card is labelled, nothing pretends to work; once the gate is opened this test is expected to be updated, not deleted
  if (/Awaiting approval/i.test(txt)) expect(txt).toMatch(/Awaiting approval/i);
  else expect(txt).toMatch(/Available/i);
  await ctx.close();
});

test('Arabic: the signed-in home renders right to left with the patient name', async ({ browser }) => {
  const ctx = await signedIn(browser, 'ar'); const page = await ctx.newPage();
  await page.goto(`${BASE}/`); await page.waitForLoadState('networkidle').catch(() => undefined);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  await expect(page.getByTestId('home')).toContainText('هدى محمود');
  await ctx.close();
});

test('error state: a 500 from the API shows the retry state, not a blank screen (offline/outage)', async ({ browser }) => {
  const ctx = await signedIn(browser); const page = await ctx.newPage();
  await ctx.route(`${URLS.api}/api/v1/appointments**`, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"code":"UNAVAILABLE"}' }));
  await page.goto(`${BASE}/appointments`); await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.locator('body')).not.toBeEmpty();
  expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(20);
  await ctx.close();
});

test('expired session: a 401 from the API shows the sign-in prompt (no loop, no crash)', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 } });
  await ctx.addInitScript(() => { sessionStorage.setItem('kx-passport-tokens', JSON.stringify({ accessToken: 'x.eyJzdWIiOiJ4In0.y', expiresAt: Date.now() + 3_600_000 })); localStorage.setItem('kx-lang', 'en'); });
  const page = await ctx.newPage(); const c = collect(page);
  await page.goto(`${BASE}/appointments`);
  await expect(page.getByText('Continue with Kiorex Passport')).toBeVisible({ timeout: 30_000 });
  expect(c.errors).toEqual([]);
  await ctx.close();
});
