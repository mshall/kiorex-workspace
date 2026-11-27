import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { dropSession, ensureSession, openAs } from '../lib/session';

/**
 * Pharmacy web, signed in as the demo CASHIER (+201000002008). The cashier is not a privileged role, so the production MFA rule does not apply to this persona.
 * Privileged roles (OWNER, PHARMACIST, BRANCH_MANAGER, CHAIN_OPS) are covered in 06-privileged-mfa.spec.ts.
 */
test.describe.serial('pharmacy web as cashier', () => {
  let ctx: BrowserContext; let page: Page;
  test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'pharmacyCashier'); ({ context: ctx, page } = await openAs(browser, 'pharmacyCashier')); });
  test.afterAll(async () => { await ctx?.close(); });
  const token = () => page.evaluate(() => localStorage.getItem('kiorly.token'));
  const api = async (path: string) => { const r = await page.request.get(`${URLS.pharmacy}/api/v1${path}`, { headers: { authorization: `Bearer ${await token()}` } }); return { status: r.status(), body: await r.json().catch(() => null) as any }; };

  test('signed in: the shell shows the persona and role, and /auth/me answers 200 (no MFA demand for a non-privileged role)', async () => {
    await page.goto(`${URLS.pharmacy}/`); await expect(page.getByText('Omar Cashier · Cashier')).toBeVisible();
    const me = await api('/auth/me'); expect(me.status, JSON.stringify(me.body)).toBe(200); expect(JSON.stringify(me.body)).toContain('CASHIER');
  });
  test('dashboard loads with the setup checklist and no error banner', async () => {
    await page.goto(`${URLS.pharmacy}/`); await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible(); await expect(page.getByText(/quick setup/i).first()).toBeVisible();
    await expect(page.getByText(/something went wrong|unexpected error/i)).toHaveCount(0);
  });
  test('customers list shows the demo customers (tagged DEMO)', async () => {
    await page.goto(`${URLS.pharmacy}/customers`); await expect(page.getByText('Hoda Mahmoud (DEMO)')).toBeVisible(); await expect(page.getByText('+201000001001').first()).toBeVisible();
  });
  test('catalogue shows demo drugs with price and substitutes action', async () => {
    await page.goto(`${URLS.pharmacy}/catalogue`); await expect(page.getByText('Amlorex 5mg')).toBeVisible(); await expect(page.getByText('Price & substitutes').first()).toBeVisible();
  });
  test('inventory page loads', async () => { await page.goto(`${URLS.pharmacy}/inventory`); await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible(); });
  test('Growth & links: Kiorex marketplace orders counted and the commission statement section is present', async () => {
    await page.goto(`${URLS.pharmacy}/growth`); await expect(page.getByRole('heading', { name: 'Growth & links' })).toBeVisible();
    await expect(page.getByText('Orders from Kiorex marketplace')).toBeVisible(); await expect(page.getByText('Commission statement')).toBeVisible();
  });
  test('Orders and Finance are denied to a cashier (role matrix), with the friendly page and not an error', async () => {
    for (const p of ['/orders', '/finance']) { await page.goto(`${URLS.pharmacy}${p}`); await expect(page.getByText("You don't have access to this page")).toBeVisible(); }
  });
  test('the API enforces the same matrix (not only the UI): a cashier token is refused on the orders and finance routes', async () => {
    for (const p of ['/marketplace/orders', '/finance/summary', '/staff']) { const r = await api(p); expect([401, 403, 404], `${p} -> ${r.status}`).toContain(r.status); expect(r.status === 200, p).toBe(false); }
  });
  test('sign out returns to the login page', async () => {
    await page.goto(`${URLS.pharmacy}/`); await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL(/\/login|passport/, { timeout: 30000 }); dropSession('pharmacyCashier');
  });
});
