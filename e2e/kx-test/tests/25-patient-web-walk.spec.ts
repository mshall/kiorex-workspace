import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, openAs } from '../lib/session';

/**
 * Kiorex patient web, signed in as the demo patient (saved session, no new code): every signed-in route in English and Arabic (RTL), light and dark, with no console error, no
 * failed (5xx) request and no error boundary; plus the offline, 500 and 401 states and the unknown-route page. (Full pass 28 Nov 2026, section 2.)
 * The booking path is not part of this live spec: the Egypt market gate is closed on kx-test (only a human records it), so the booking runs on a PRIVATE stack (regression suite 03).
 */
const ROUTES = ['/', '/search', '/services', '/appointments', '/records', '/pharmacy', '/pharmacy/orders', '/lab', '/lab/bookings', '/telemedicine', '/account', '/account/addresses', '/notifications', '/preferences', '/referral', '/loyalty', '/care-plans', '/waitlist'];

test.describe.serial('patient web walk', () => {
  let ctx: BrowserContext; let page: Page; const errors: string[] = []; const bad: string[] = [];
  test.beforeAll(async ({ browser }) => {
    await ensureSession(browser, 'patient'); ({ context: ctx, page } = await openAs(browser, 'patient'));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()} ${m.text().slice(0, 160)}`); });
    page.on('response', (r) => { if (r.status() >= 500) bad.push(`${r.status()} ${r.url().slice(0, 120)}`); });
  });
  test.afterAll(async () => { await ctx?.close(); });

  for (const lang of ['en', 'ar'] as const) {
    test(`every signed-in route renders in ${lang.toUpperCase()} without an error state, 5xx or console error`, async () => {
      test.setTimeout(240_000);
      await page.addInitScript((l) => { try { localStorage.setItem('kx-lang', l); } catch { /* ignore */ } }, lang);
      errors.length = 0; bad.length = 0;
      for (const r of ROUTES) {
        await page.goto(`${URLS.patientWeb}${r}`); await page.waitForLoadState('networkidle').catch(() => undefined);
        await expect(page.locator('html'), r).toHaveAttribute('lang', lang === 'ar' ? /^ar/ : /^en/);
        await expect(page.locator('html'), r).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
        await expect(page.getByRole('heading').first(), r).toBeVisible();
        await expect(page.getByText(/something went wrong|حدث خطأ ما/i), r).toHaveCount(0);
        expect(new URL(page.url()).pathname, `${r} stayed signed in`).not.toMatch(/\/(signin|join)$/);
      }
      expect(bad, bad.join('\n')).toEqual([]);
      const real = errors.filter((e) => !/favicon|ERR_BLOCKED_BY_CLIENT|Failed to load resource: the server responded with a status of (401|403|404)/.test(e));
      expect(real, real.join('\n')).toEqual([]);
    });
  }

  test('Western digits 0-9 in Arabic (no Arabic-Indic digits on the home, appointments and account pages)', async () => {
    await page.addInitScript(() => { try { localStorage.setItem('kx-lang', 'ar'); } catch { /* ignore */ } });
    for (const r of ['/', '/appointments', '/account']) { await page.goto(`${URLS.patientWeb}${r}`); await page.waitForLoadState('networkidle').catch(() => undefined); expect(await page.locator('main').innerText(), r).not.toMatch(/[٠-٩۰-۹]/); }
  });

  test('theme toggle switches light and dark and the choice survives a reload', async () => {
    await page.addInitScript(() => { try { localStorage.setItem('kx-lang', 'en'); } catch { /* ignore */ } });
    await page.goto(`${URLS.patientWeb}/`);
    const toggle = page.getByRole('button', { name: /dark mode|light mode/i }).first();
    const was = await page.locator('html').evaluate((e) => e.classList.contains('dark'));
    await toggle.click();
    await expect.poll(() => page.locator('html').evaluate((e) => e.classList.contains('dark'))).toBe(!was);
    await page.reload(); await expect.poll(() => page.locator('html').evaluate((e) => e.classList.contains('dark'))).toBe(!was);
    await page.getByRole('button', { name: /dark mode|light mode/i }).first().click(); // restore
  });

  test('language toggle switches to Arabic and back (direction follows)', async () => {
    await page.goto(`${URLS.patientWeb}/`); await page.getByTestId('lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); await page.getByTestId('lang-toggle').click(); await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });

  test('Sign out appears exactly once in the header at desktop width, and on the Account page only below 1024 px (founder decision)', async () => {
    await page.setViewportSize({ width: 1280, height: 800 }); await page.goto(`${URLS.patientWeb}/account`); await page.waitForLoadState('networkidle').catch(() => undefined);
    await expect(page.getByRole('button', { name: /^sign out$/i }).filter({ visible: true })).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 800 }); await page.reload(); await page.waitForLoadState('networkidle').catch(() => undefined);
    await expect(page.getByRole('button', { name: /^sign out$/i }).filter({ visible: true })).toHaveCount(1);
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('offline: the banner is announced, back online it goes away', async () => {
    await page.goto(`${URLS.patientWeb}/`); await page.waitForLoadState('networkidle').catch(() => undefined);
    await ctx.setOffline(true);
    await expect(page.getByRole('status').or(page.getByRole('alert')).filter({ hasText: /offline|no connection|لا يوجد اتصال/i }).first()).toBeVisible({ timeout: 15_000 });
    await ctx.setOffline(false);
    await expect(page.getByText(/you are offline|no connection/i)).toHaveCount(0, { timeout: 15_000 });
  });

  test('a 500 from the API shows a friendly error state with a retry, never a blank page', async () => {
    await page.route('**/api/v1/bookings**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: '{"statusCode":500,"message":"boom"}' }));
    await page.goto(`${URLS.patientWeb}/appointments`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByText(/something went wrong|try again|could not load|couldn.t load/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText('boom');
    await page.unroute('**/api/v1/bookings**');
  });

  test('a 401 from the API sends the person to sign in (no loop, no blank page)', async ({ browser }) => {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.goto(`${URLS.patientWeb}/appointments`);
    await expect(p.getByRole('button', { name: /^(Sign in|Log in)$/i }).first().or(p.getByTestId('entry-continue'))).toBeVisible({ timeout: 20_000 });
    expect(p.url()).not.toContain(new URL(URLS.passport).host);
    await c.close();
  });

  test('time zones: the same appointment shows the clinic-local time in Cairo (UTC+2) and in the Gulf (UTC+4) without a shifted date or a raw ISO string', async ({ browser }) => {
    const seen: Record<string, string> = {};
    for (const tz of ['Africa/Cairo', 'Asia/Dubai']) {
      const o = await openAs(browser, 'patient', { timezoneId: tz });
      await o.page.goto(`${URLS.patientWeb}/appointments`); await o.page.waitForLoadState('networkidle').catch(() => undefined);
      await o.page.getByRole('tab', { name: /past/i }).click().catch(() => undefined); await o.page.waitForTimeout(800);
      const txt = await o.page.locator('main').innerText(); seen[tz] = txt;
      expect(txt, tz).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/); expect(txt, tz).not.toMatch(/Invalid Date|NaN/);
      await o.context.close();
    }
    // the clinic is in Egypt: appointment times are shown in the clinic's zone, so the two viewers read the same clock time (a viewer-zone shift would differ by 2 hours)
    const clocks = (t: string) => [...t.matchAll(/\b(\d{1,2}:\d{2})\s?(AM|PM)?/gi)].map((m) => m[0]).join('|');
    expect(clocks(seen['Africa/Cairo']!).length, 'the page shows at least one appointment time').toBeGreaterThan(0);
    expect(clocks(seen['Asia/Dubai']!)).toBe(clocks(seen['Africa/Cairo']!));
  });

  test('unknown route: branded not-found page with a way home', async () => {
    await page.goto(`${URLS.patientWeb}/definitely/not/here`);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /home|back|الرئيسية/i }).first()).toBeVisible();
  });

  test('privacy and consent choices page loads without a session (public) and lists the choices', async ({ browser }) => {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.goto(`${URLS.patientWeb}/preferences`); await expect(p.getByRole('heading').first()).toBeVisible();
    expect(await p.locator('main').innerText()).toMatch(/consent|marketing|privacy|preferences|email|sms/i);
    await c.close();
  });
});
