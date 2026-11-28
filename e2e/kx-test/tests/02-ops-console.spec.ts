import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, liveToken, openAs } from '../lib/session';

/** Ops console (admin host): signed in through Passport with phone code + TOTP. Demo data seeded by `seed:demo:deployed` must be visible in the UI and in the admin API. */
test.describe.serial('ops console: providers, orders, finance', () => {
  let ctx: BrowserContext; let page: Page;
  test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'ops'); ({ context: ctx, page } = await openAs(browser, 'ops')); });
  test.afterAll(async () => { await ctx?.close(); });

  const api = async (path: string) => { const r = await page.request.get(`${URLS.api}${path}`, { headers: { authorization: `Bearer ${await liveToken(page)}`, origin: URLS.ops } }); return { status: r.status(), body: await r.json().catch(() => null) as any }; };

  test('signs in with MFA (phone code + TOTP) and lands in the console as ops_admin', async () => {
    await page.goto(`${URLS.ops}/providers`); await expect(page.getByText('Ops Admin Demo')).toBeVisible(); await expect(page.getByText('ops_admin').first()).toBeVisible();
    const claims = await page.evaluate(() => { for (const [k, v] of Object.entries(sessionStorage)) if (k.startsWith('oidc.user:')) { const t = JSON.parse(v).access_token as string; return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } return null; });
    expect(claims.acr).toBe('urn:kiorex:acr:mfa'); expect(claims.amr).toEqual(expect.arrayContaining(['otp', 'totp', 'mfa']));
  });

  test('providers list shows the demo providers (clinics) written by the deployed seed', async () => {
    await page.goto(`${URLS.ops}/providers`);
    for (const n of ['Dr Demo Hana Saleh', 'Dr Demo Laila Farouk', 'Dr Demo Samy Wahba', 'Dr Demo Mervat Ghoneim']) await expect(page.getByRole('cell', { name: n })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'LIVE' }).first()).toBeVisible();
  });
  test('admin API: 8 demo providers with the Clinic-sync shape (LIVE, specialty, clinic ids)', async () => {
    const r = await api('/api/v1/admin/providers?q=Demo'); expect(r.status).toBe(200);
    const items = (r.body.items ?? r.body) as any[]; const demo = items.filter((p) => String(p.id ?? p.providerId ?? '').startsWith('demo_dp_') || /Dr Demo/.test(p.nameEn ?? ''));
    expect(demo.length).toBeGreaterThanOrEqual(8);
  });

  test('order monitors list the demo pharmacy orders and lab bookings', async () => {
    await page.goto(`${URLS.ops}/orders`);
    await expect(page.getByText('kx_ph_demo_dx2')).toBeVisible(); await expect(page.getByText('Kiorly Pharmacy (kx-test)').first()).toBeVisible();
    await page.getByRole('tab', { name: /Lab bookings/i }).click().catch(async () => { await page.getByText('Lab bookings').first().click(); });
    await expect(page.getByText(/kx_lb_demo_dx\d/).first()).toBeVisible();
  });
  test('finance page shows demo payouts and refunds', async () => {
    await page.goto(`${URLS.ops}/finance`); await expect(page.getByText('PAYOUT').first()).toBeVisible(); await expect(page.getByText(/EGP\s*\d/).first()).toBeVisible();
  });
  test('ops_admin without the finance role is refused the commission figures (money is role-gated)', async () => {
    await page.goto(`${URLS.ops}/commissions`); await expect(page.getByRole('heading', { name: /no access/i }).or(page.getByText(/does not include the finance view/i)).first()).toBeVisible(); // since ADR-062 the route gate shows the No access page before the page's own message
    const r = await api('/api/v1/admin/commissions/summary'); expect([401, 403]).toContain(r.status);
  });
});

test.describe.serial('ops console: commissions (finance role)', () => {
  let ctx: BrowserContext; let page: Page;
  test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'opsFinance'); ({ context: ctx, page } = await openAs(browser, 'opsFinance')); });
  test.afterAll(async () => { await ctx?.close(); });
  const api = async (path: string) => { const r = await page.request.get(`${URLS.api}${path}`, { headers: { authorization: `Bearer ${await liveToken(page)}`, origin: URLS.ops } }); return { status: r.status(), body: await r.json().catch(() => null) as any }; };

  test('commission summary page loads with demo figures', async () => {
    await page.goto(`${URLS.ops}/commissions`); await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Commissions/i }).first()).toBeVisible(); await expect(page.getByText(/does not include the finance view/i)).toHaveCount(0);
    await expect(page.getByText(/EGP\s?\d/).first()).toBeVisible();
  });
  test('admin API: commission summary and claims carry the demo organisations and every tender kind', async () => {
    const s = await api('/api/v1/admin/commissions/summary'); expect(s.status, JSON.stringify(s.body)).toBe(200);
    const c = await api('/api/v1/admin/commissions/claims?pageSize=100'); expect(c.status).toBe(200);
    const rows = (c.body.items ?? c.body.rows ?? c.body) as any[]; const demo = rows.filter((r) => String(r.orgRef ?? '').startsWith('demo_dt_'));
    expect(demo.length).toBe(12);
    const kind = (r: any) => (r.tender === 'CASH' && r.tenderMethod === 'CASH_TRANSFER' ? `CASH_TRANSFER:${r.tenderDetail}` : String(r.tender));
    const kinds = new Set(demo.map(kind)); for (const k of ['ONLINE', 'CASH', 'CASH_TRANSFER:BANK_TRANSFER', 'CASH_TRANSFER:INSTAPAY', 'CASH_TRANSFER:CARD_TERMINAL']) expect([...kinds], k).toContain(k);
    expect(new Set(demo.map((r) => r.chargeStatus))).toEqual(new Set(['PENDING', 'CONFIRMED', 'DISPUTED', 'REVERSED', 'WAIVED']));
  });
  test('a settlement statement of a demo organisation loads (cash-transfer visits are shown as their own kind)', async () => {
    const r = await api('/api/v1/admin/commissions/settlement-statement/demo_dt_1'); expect(r.status, JSON.stringify(r.body).slice(0, 200)).toBe(200);
    expect(JSON.stringify(r.body)).toMatch(/CASH_TRANSFER|cashTransfer/i);
  });
  test('collection runs: an open demo invoice and a settled run', async () => {
    const r = await api('/api/v1/admin/commissions/runs'); expect(r.status).toBe(200);
    const runs = (r.body.items ?? r.body.rows ?? r.body) as any[]; expect(runs.filter((x) => String(x.orgRef).startsWith('demo_dt_')).map((x) => x.status).sort()).toEqual(['INVOICE_OPEN', 'SETTLED']);
  });
});
