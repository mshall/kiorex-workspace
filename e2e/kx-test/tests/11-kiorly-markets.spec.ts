import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, liveToken, openAs } from '../lib/session';

/**
 * Kiorly admin, Market launch (ADR-060) on the DEPLOYED hosts. READ-ONLY against the live Clinic (it holds the real organisation Dr Ahmed Shall): the specs list the
 * markets, read the details and the history, and prove the change path with calls the Clinic REFUSES or answers as "nothing to change" (a missing reason, Go live on a
 * market that is already live, Enable on an active market): nothing is written. No market is created, launched, paused or disabled here.
 */
const B = `${URLS.api}/api/v1/admin/kiorly-markets`;

test.describe.serial('Kiorly admin: Market launch on kx-test (read-only against the live Clinic)', () => {
  let ctx: BrowserContext; let page: Page; let api: APIRequestContext; let h: Record<string, string>;
  test.beforeAll(async ({ browser, playwright }) => {
    await ensureSession(browser, 'superAdmin'); ({ context: ctx, page } = await openAs(browser, 'superAdmin'));
    await page.goto(`${URLS.ops}/kiorly-markets`);
    api = await playwright.request.newContext();
    h = { authorization: `Bearer ${await liveToken(page)}`, origin: URLS.opsKiorly, 'content-type': 'application/json' };
  });
  test.afterAll(async () => { await api?.dispose(); await ctx?.close(); });

  test('the API door needs a token and the right role', async () => {
    expect((await api.get(B)).status()).toBe(401);
  });

  test('the list shows the Clinic markets with readiness and the read-only Kiorex state of the same country', async () => {
    const r = await api.get(B, { headers: h }); expect(r.status(), await r.text()).toBe(200);
    const j = await r.json();
    expect(j.canChange).toBe(true);
    const eg = j.items.find((m: { code: string }) => m.code === 'EG'); expect(eg, 'the Egypt market exists in the live Clinic').toBeTruthy();
    expect(eg.status).toBe('LIVE');
    expect(eg.readiness).toBeTruthy();
    expect(eg.kiorex).toMatchObject({ known: true, flag: 'market.eg.live' });
    expect(typeof eg.organizationCount).toBe('number');
    const d = await api.get(`${B}/country-defaults`, { headers: h }); expect(d.status()).toBe(200);
    expect((await d.json()).find((c: { code: string }) => c.code === 'SA')).toMatchObject({ defaultCurrency: 'SAR', defaultLocale: 'ar-SA' });
  });

  test('details and history are readable; hostile ids are refused before any call', async () => {
    const eg = (await (await api.get(B, { headers: h })).json()).items.find((m: { code: string }) => m.code === 'EG');
    const one = await api.get(`${B}/${eg.id}`, { headers: h }); expect(one.status()).toBe(200);
    expect((await one.json()).legal).toBeTruthy();
    const audit = await api.get(`${B}/${eg.id}/audit?limit=5`, { headers: h }); expect(audit.status()).toBe(200);
    expect(Array.isArray((await audit.json()).items)).toBe(true);
    expect((await api.get(`${B}/${'a'.repeat(65)}`, { headers: h })).status()).toBe(400);
    expect((await api.get(`${B}/nope`, { headers: h })).status()).toBe(404);
  });

  test('the change path works end to end without changing anything: refusals and "already in that state"', async () => {
    const eg = (await (await api.get(B, { headers: h })).json()).items.find((m: { code: string }) => m.code === 'EG');
    const post = (verb: string, data: unknown) => api.post(`${B}/${eg.id}/${verb}`, { headers: h, data });
    const noReason = await post('launch', {}); expect(noReason.status()).toBe(400); expect((await noReason.json()).code).toBe('REASON_REQUIRED');
    const live = await post('launch', { reason: 'e2e check: refused, Egypt is already live' }); expect(live.status()).toBe(409); expect((await live.json()).code).toBe('MARKET_ALREADY_LIVE');
    const badDays = await post('pause', { reason: 'e2e check: refused', days: 0 }); expect(badDays.status()).toBe(400); expect((await badDays.json()).code).toBe('PAUSE_DAYS_INVALID');
    const link = await post('pause', { reason: 'e2e check: refused', approvalLink: 'http://not-https.example' }); expect(link.status()).toBe(400); expect((await link.json()).code).toBe('APPROVAL_LINK_INVALID');
    const unchanged = await post('enable', { reason: 'e2e check: already active, nothing to change' }); expect(unchanged.status()).toBe(200); expect((await unchanged.json()).unchanged).toBe(true);
    const eg2 = (await (await api.get(B, { headers: h })).json()).items.find((m: { code: string }) => m.code === 'EG');
    expect(eg2.status).toBe('LIVE'); expect(eg2.operability).toBe('active');
    const trail = await (await api.get(`${B}/${eg.id}/audit?limit=50`, { headers: h })).json();
    expect(trail.items.filter((e: { reason: string }) => e.reason.startsWith('e2e check'))).toHaveLength(0); // nothing was written
  });

  test('the screen in the Kiorly admin: tab title, Egypt row live and active, Kiorex state shown without a control, change buttons for a super admin', async () => {
    await page.goto(`${URLS.ops}/kiorly-markets`);
    await expect(page.getByTestId('market-EG')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('state-EG')).toHaveText('Live');
    await expect(page.getByTestId('op-EG')).toContainText(/active/i);
    await expect(page.getByTestId('kiorex-EG')).toContainText(/read-only/i);
    await expect(page.getByTestId('new-market')).toBeVisible();
    await expect(page.getByTestId('pause-EG')).toBeVisible();
    await page.getByTestId('details-EG').click();
    await expect(page.getByTestId('details-dialog')).toBeVisible();
    await expect(page.getByTestId('details-kiorex')).toBeVisible();
    await page.keyboard.press('Escape');
    // Go live is not offered for a live market; Pause opens a dialog that demands a reason (closed without sending)
    await page.getByTestId('pause-EG').click();
    await page.getByTestId('action-confirm').click();
    await expect(page.getByTestId('action-error')).toContainText(/at least 3 characters/i);
    await page.getByRole('button', { name: /cancel/i }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('Arabic: the screen is right-to-left and translated', async () => {
    await page.addInitScript(() => { try { localStorage.setItem('kx-lang', 'ar'); } catch { /* ignore */ } });
    await page.goto(`${URLS.ops}/kiorly-markets`);
    await expect(page.getByTestId('market-EG')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('state-EG')).toHaveText('مباشر');
  });
});

test.describe('Kiorly admin: Market launch is read-only for Kiorly ops', () => {
  let ctx: BrowserContext; let page: Page; let api: APIRequestContext; let h: Record<string, string>;
  test.beforeAll(async ({ browser, playwright }) => {
    await ensureSession(browser, 'ops'); ({ context: ctx, page } = await openAs(browser, 'ops'));
    await page.goto(`${URLS.ops}/kiorly-markets`);
    api = await playwright.request.newContext();
    h = { authorization: `Bearer ${await liveToken(page)}`, origin: URLS.opsKiorly, 'content-type': 'application/json' };
  });
  test.afterAll(async () => { await api?.dispose(); await ctx?.close(); });

  test('ops reads the markets but every change is refused (403) and the screen offers no change control', async () => {
    const list = await api.get(B, { headers: h }); expect(list.status()).toBe(200);
    const j = await list.json(); expect(j.canChange).toBe(false);
    const eg = j.items.find((m: { code: string }) => m.code === 'EG');
    for (const [verb, data] of [['launch', { reason: 'e2e check' }], ['pause', { reason: 'e2e check', days: 1 }], ['disable', { reason: 'e2e check' }], ['enable', { reason: 'e2e check' }]] as const) {
      expect((await api.post(`${B}/${eg.id}/${verb}`, { headers: h, data })).status(), verb).toBe(403);
    }
    expect((await api.post(B, { headers: h, data: { code: 'JO', reason: 'e2e check' } })).status()).toBe(403);
    expect((await api.put(`${B}/${eg.id}/tax-pack`, { headers: h, data: { invoiceVatPercent: 1, saasVatPercent: 1, defaultVisitFee: 1, reason: 'e2e check' } })).status()).toBe(403);
    await page.goto(`${URLS.ops}/kiorly-markets`);
    await expect(page.getByTestId('market-EG')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('read-only-note')).toBeVisible();
    for (const id of ['new-market', 'pause-EG', 'disable-EG', 'launch-EG']) await expect(page.getByTestId(id)).toHaveCount(0);
    await expect(page.getByTestId('details-EG')).toBeVisible();
  });
});
