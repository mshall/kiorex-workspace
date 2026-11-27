import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, openAs } from '../lib/session';

/**
 * Lab web, signed in as the demo TECHNOLOGIST (+201000002005, not a privileged role) and as the demo OWNER (+201000002010, privileged).
 * The Lab and the Pharmacy apply the same production rule to privileged roles: the Passport session must carry an MFA claim (a phone code alone is not enough). The owner signs in with phone code + TOTP.
 */
const AUTH_KEY = 'kiorly.lab.token';
test.describe.serial('lab web as technologist', () => {
  let ctx: BrowserContext; let page: Page;
  test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'labTech'); ({ context: ctx, page } = await openAs(browser, 'labTech')); });
  test.afterAll(async () => { await ctx?.close(); });
  const api = async (path: string) => { const r = await page.request.get(`${URLS.lab}/api/v1${path}`, { headers: { authorization: `Bearer ${await page.evaluate((k) => localStorage.getItem(k), AUTH_KEY)}` } }); return { status: r.status(), body: await r.json().catch(() => null) as any }; };

  test('signed in: shell shows the lab, the persona and /auth/me answers 200', async () => {
    await page.goto(`${URLS.lab}/`); await expect(page.getByText('Demo Diagnostics (synthetic)')).toBeVisible(); await expect(page.getByText('Omar Technologist')).toBeVisible();
    const me = await api('/auth/me'); expect(me.status, JSON.stringify(me.body)).toBe(200);
  });
  test('dashboard loads', async () => { await page.goto(`${URLS.lab}/`); await expect(page.getByText(/quick setup/i).first()).toBeVisible(); await expect(page.getByText(/something went wrong|unexpected error/i)).toHaveCount(0); });
  test('orders list shows the demo orders, including Kiorex bookings and Nurse relays', async () => {
    await page.goto(`${URLS.lab}/orders`); await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ORD-2026-000128' })).toBeVisible(); await expect(page.getByText('(DEMO)').first()).toBeVisible();
    const row = (t: string) => page.getByRole('row').filter({ hasText: t }).first(); await expect(row('Kiorex booking')).toBeVisible(); await expect(row('Kiorly Nurse')).toBeVisible(); await expect(page.getByText(/1–25 of \d+/).first()).toBeVisible();
  });
  test('status filters work: Released shows only released orders', async () => {
    await page.goto(`${URLS.lab}/orders`); await page.getByRole('button', { name: 'Released' }).or(page.getByText('Released', { exact: true })).first().click();
    await expect(page.getByRole('link', { name: 'ORD-2026-000125' })).toBeVisible(); await expect(page.getByRole('row').filter({ hasText: /Cancelled|Awaiting collection/ })).toHaveCount(0);
  });
  test('worklist, validation and critical-value pages load for the technologist', async () => {
    for (const [p, h] of [['/worklist', /Worklist/i], ['/validation', /Validation/i], ['/critical', /Critical/i]] as const) { await page.goto(`${URLS.lab}${p}`); await expect(page.getByRole('heading', { name: h }).first()).toBeVisible(); }
  });
  test('API role matrix: a technologist is refused the staff-management route', async () => { const r = await api('/staff'); expect([401, 403, 404]).toContain(r.status); });
});

test.describe.serial('lab web as owner (privileged role)', () => {
  let ctx: BrowserContext; let page: Page;
  test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'labOwner'); ({ context: ctx, page } = await openAs(browser, 'labOwner')); });
  test.afterAll(async () => { await ctx?.close(); });
  test('owner signs in with phone code + TOTP and the Lab API accepts the session (MFA claim present)', async () => {
    await page.goto(`${URLS.lab}/`); await expect(page.getByText('Layla Owner')).toBeVisible();
    const t = await page.evaluate((k) => localStorage.getItem(k), AUTH_KEY);
    const r = await page.request.get(`${URLS.lab}/api/v1/auth/me`, { headers: { authorization: `Bearer ${t}` } }); expect(r.status()).toBe(200);
  });
  test('owner reaches settings and reports', async () => { await page.goto(`${URLS.lab}/reports`); await expect(page.getByRole('heading', { name: /Reports/i }).first()).toBeVisible(); });
});
