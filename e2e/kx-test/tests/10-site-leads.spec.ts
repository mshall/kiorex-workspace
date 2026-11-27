import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, liveToken, openAs } from '../lib/session';

/**
 * Kiorly site join flow on the DEPLOYED hosts: the public form (https://test.kiorly.com) -> the platform leads endpoint -> the join requests screens of both consoles
 * (Kiorex admin and Kiorly admin) -> CSV export -> removal of the test lead. The lead is clearly tagged as test data (name prefix [TEST], reserved e-mail domain
 * example.test), so the platform marks it `isTest`, sends no notification, and the super admin removes it at the end (dry run first). Synthetic phone number, no real person.
 */
const STAMP = Date.now().toString(36).toUpperCase();
const LEGAL = `[TEST] E2E Clinic ${STAMP}`;
const PHONE = `+2010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const EMAIL = `kx-e2e-${STAMP.toLowerCase()}@example.test`;
const idem = () => `kx-e2e-${STAMP}-${Math.random().toString(36).slice(2, 10)}`;
let reference = ''; let leadId = '';

const body = (over: Record<string, unknown> = {}) => ({
  source: 'kiorly-site', env: 'test', mode: 'CONNECTED', providerType: 'CLINIC', legalName: LEGAL, contactName: 'E2E Test Person', phone: PHONE, email: EMAIL, market: 'EG', governorate: 'CAIRO', city: 'Nasr City',
  branches: 1, staffCount: 3, specialties: ['PEDIATRICS'], modules: ['CLINIC'], goLive: 'EXPLORING', locale: 'en', contactChannel: 'EMAIL', note: 'automated e2e check, safe to delete', consent: { accepted: true, textVersion: 'draft-2' }, ...over,
});

test.describe.serial('Kiorly site join requests, end to end on kx-test', () => {
  let api: APIRequestContext;
  test.beforeAll(async ({ playwright }) => { api = await playwright.request.newContext(); });
  test.afterAll(async () => { await api?.dispose(); });
  const pub = (path: string, init: { method?: string; key?: string; data?: unknown; origin?: string } = {}) => api.fetch(`${URLS.api}/api/v1/public/leads${path}`, { method: init.method ?? 'GET', headers: { origin: init.origin ?? URLS.site, ...(init.key ? { 'idempotency-key': init.key } : {}), ...(init.data ? { 'content-type': 'application/json' } : {}) }, data: init.data as never });

  test('the public form configuration is served with CORS for the site only', async () => {
    const r = await pub('/config'); expect(r.status()).toBe(200); expect(r.headers()['access-control-allow-origin']).toBe(URLS.site);
    const j = await r.json(); expect(j.providerTypes.map((t: { key: string }) => t.key)).toEqual(expect.arrayContaining(['CLINIC', 'INDEPENDENT_DOCTOR', 'CHAIN', 'HOSPITAL', 'NURSE', 'PHYSICIAN', 'LAB', 'PHARMACY', 'OTHER']));
    expect(j.markets[0]).toMatchObject({ key: 'EG', dialCode: '+20' });
    const evil = await pub('/config', { origin: 'https://evil.example.com' }); expect(evil.headers()['access-control-allow-origin']).toBeUndefined();
    const pre = await api.fetch(`${URLS.api}/api/v1/public/leads`, { method: 'OPTIONS', headers: { origin: URLS.site, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type,idempotency-key' } });
    expect(pre.status()).toBeLessThan(300); expect(pre.headers()['access-control-allow-origin']).toBe(URLS.site);
  });

  test('the home page is the single-page Kiorly experience: both languages, noindex, join form present, no localhost, endpoint on the API host', async ({ page }) => {
    for (const [lang, dir] of [['en', 'ltr'], ['ar', 'rtl']] as const) {
      const r = await page.goto(`${URLS.site}/${lang}/`); expect(r?.status()).toBe(200); expect(r?.headers()['x-robots-tag']).toContain('noindex');
      await expect(page.locator('html')).toHaveAttribute('dir', dir); await expect(page.locator('[data-join]')).toHaveAttribute('data-ready', 'true');
      await expect(page.locator('[data-join]')).toHaveAttribute('data-endpoint', `${URLS.api}/api/v1/public/leads`); expect(await page.content()).not.toMatch(/localhost|127\.0\.0\.1/);
      for (const id of ['modules', 'connected', 'workflows', 'security', 'plans', 'faq', 'join']) await expect(page.locator(`#${id}`)).toHaveCount(1);
    }
  });

  test('a visitor fills the five steps in the real form and gets a reference', async ({ page }) => {
    await page.goto(`${URLS.site}/en/`); await expect(page.locator('[data-join]')).toHaveAttribute('data-ready', 'true');
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in')));
    const next = () => page.locator('[data-next]').click();
    await page.locator('input[name=mode][value=CONNECTED]').check({ force: true }); await page.locator('input[name=providerType][value=CLINIC]').check({ force: true }); await next();
    await page.locator('#f-legalName').fill(LEGAL); await page.locator('#f-branches').fill('1'); await page.locator('#f-staffCount').fill('3'); await page.locator('input[name=specialties][value=PEDIATRICS]').check({ force: true }); await next();
    await page.locator('#f-contactName').fill('E2E Test Person'); await page.locator('#f-phone').fill(PHONE.replace('+20', '0')); await page.locator('#f-email').fill(EMAIL); await page.locator('#f-governorate').selectOption('CAIRO'); await page.locator('#f-city').fill('Nasr City'); await next();
    await page.locator('#f-licences-facilityLicence').fill(`E2E-${STAMP}`); await page.locator('input[name=modules][value=CLINIC]').check({ force: true }); await page.locator('#f-goLive').selectOption('EXPLORING'); await next();
    await page.locator('input[name=contactChannel][value=EMAIL]').check({ force: true }); await page.locator('#f-note').fill('automated e2e check, safe to delete'); await page.locator('#f-consent').check();
    const resp = page.waitForResponse((r) => r.url().endsWith('/api/v1/public/leads') && r.request().method() === 'POST');
    await page.locator('[data-submit]').click(); const r = await resp; expect(r.status()).toBe(201);
    await expect(page.locator('[data-ref]')).toHaveText(/^KL-[A-Z2-9]{8}$/); reference = (await page.locator('[data-ref]').textContent())!.trim();
    await expect(page.locator('.next-steps li')).toHaveCount(3);
  });

  test('API: replay with the same key and body returns the same reference; a different body is refused; bad input is 400 with per-field codes; the honeypot stores nothing', async () => {
    const k = idem(); const a = await pub('', { method: 'POST', key: k, data: body({ phone: `+2010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}` }) }); expect(a.status()).toBe(201);
    const ref1 = (await a.json()).reference; expect(ref1).toMatch(/^KL-/);
    const d = body({ legalName: `[TEST] E2E Replay ${STAMP}`, phone: `+2010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}` });
    const first = await pub('', { method: 'POST', key: k + 'b', data: d }); const again = await pub('', { method: 'POST', key: k + 'b', data: d });
    expect(first.status()).toBe(201); expect(again.status()).toBe(201); expect((await again.json())).toMatchObject({ reference: (await first.json()).reference, replayed: true });
    expect((await pub('', { method: 'POST', key: k + 'b', data: { ...d, legalName: '[TEST] other' } })).status()).toBe(409);
    expect((await pub('', { method: 'POST', data: d })).status()).toBe(400);
    const bad = await pub('', { method: 'POST', key: idem(), data: { ...body(), phone: 'abc', legalName: '' } }); expect(bad.status()).toBe(400); expect((await bad.json()).fields).toMatchObject({ phone: 'invalid', legalName: 'required' });
    const hp = await pub('', { method: 'POST', key: idem(), data: { ...body(), website: 'http://spam.example' } }); expect(hp.status()).toBe(201); expect((await hp.json()).reference).toMatch(/^KL-/);
    const big = await pub('', { method: 'POST', key: idem(), data: { ...body(), note: 'x'.repeat(20_000) } }); expect(big.status()).toBe(413);
  });

  test.describe('Kiorex admin (ops_admin)', () => {
    let ctx: BrowserContext; let page: Page;
    test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'ops'); ({ context: ctx, page } = await openAs(browser, 'ops')); });
    test.afterAll(async () => { await ctx?.close(); });
    test('the lead is in the inbox, tagged test, with masked phone; the detail shows decrypted data; status and note work', async () => {
      await page.goto(`${URLS.ops}/leads?q=${reference}`);
      const row = page.getByTestId('data-table').locator('tbody tr').filter({ hasText: reference }); await expect(row).toHaveCount(1); await expect(row).toContainText(LEGAL); await expect(row).toContainText('Test'); await expect(row).not.toContainText(PHONE);
      await row.getByRole('link', { name: reference }).click(); await expect(page).toHaveURL(/\/leads\/ld_/); leadId = page.url().split('/').pop()!;
      await expect(page.getByTestId('lead-phone')).toHaveText(PHONE); await expect(page.getByTestId('lead-email')).toHaveText(EMAIL); await expect(page.getByText(`E2E-${STAMP}`).first()).toBeVisible(); // the text shows in the heading and in the details
      await page.getByTestId('lead-to-CONTACTED').click(); await expect(page.getByTestId('lead-status-chip')).toHaveText('Contacted');
      await page.getByTestId('lead-note-input').fill('e2e note'); await page.getByTestId('lead-note-add').click(); await expect(page.getByTestId('lead-trail')).toContainText('e2e note');
    });
    test('ops_admin can export CSV but cannot save settings or remove test data (403); settings are readable', async () => {
      const h = { authorization: `Bearer ${await liveToken(page)}`, origin: URLS.ops };
      const csv = await page.request.get(`${URLS.api}/api/v1/admin/leads/export.csv?q=${reference}`, { headers: h }); expect(csv.status()).toBe(200); const t = await csv.text(); expect(t).toContain(reference); expect(t).toContain(PHONE);
      expect((await page.request.post(`${URLS.api}/api/v1/admin/leads/test/remove`, { headers: h, data: { confirm: true } })).status()).toBe(403);
      const s = await page.request.get(`${URLS.api}/api/v1/admin/leads/settings`, { headers: h }); expect(s.status()).toBe(200);
      expect((await page.request.put(`${URLS.api}/api/v1/admin/leads/settings`, { headers: h, data: { version: (await s.json()).version, config: (await s.json()).config } })).status()).toBe(403);
      expect((await api.fetch(`${URLS.api}/api/v1/admin/leads`)).status()).toBe(401);
    });
  });

  test.describe('Kiorly admin (admin host of kiorly.com, super_admin) and cleanup', () => {
    let ctx: BrowserContext; let page: Page;
    test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'superAdmin'); ({ context: ctx, page } = await openAs(browser, 'superAdmin')); });
    test.afterAll(async () => { await ctx?.close(); });
    test('the Kiorly edition shows the same lead (title Kiorly Admin, Join requests in the navigation)', async () => {
      await page.goto(`${URLS.opsKiorly}/leads?q=${reference}`); await page.waitForURL((u) => u.origin === new URL(URLS.opsKiorly).origin && u.pathname.startsWith('/leads'), { timeout: 60_000 });
      await expect(page).toHaveTitle('Kiorly Admin'); await expect(page.getByTestId('sidebar-nav').getByRole('link', { name: /Join requests/ })).toBeVisible();
      const row = page.getByTestId('data-table').locator('tbody tr').filter({ hasText: reference }); await expect(row).toHaveCount(1); await expect(row).toContainText('Contacted');
      await row.getByRole('link', { name: reference }).click(); await expect(page.getByTestId('lead-phone')).toHaveText(PHONE); await expect(page.getByTestId('lead-test-toggle')).toBeChecked();
      await page.goto(`${URLS.opsKiorly}/leads/settings`); await expect(page.getByTestId('set-save')).toBeVisible(); await expect(page.getByTestId('set-readonly')).toHaveCount(0);
    });
    test('the super admin removes the test leads: count first, then delete; the lead is gone from both consoles and the API', async () => {
      const h = { authorization: `Bearer ${await liveToken(page)}`, origin: URLS.opsKiorly };
      const dry = await page.request.post(`${URLS.api}/api/v1/admin/leads/test/remove`, { headers: h, data: { confirm: false } }); expect(dry.status()).toBe(200); const n = (await dry.json()).count; expect(n).toBeGreaterThanOrEqual(1);
      const real = await page.request.post(`${URLS.api}/api/v1/admin/leads/test/remove`, { headers: h, data: { confirm: true } }); expect(real.status()).toBe(200); expect(await real.json()).toMatchObject({ dryRun: false, count: n });
      expect((await page.request.get(`${URLS.api}/api/v1/admin/leads/${leadId}`, { headers: h })).status()).toBe(404);
      await page.goto(`${URLS.opsKiorly}/leads?q=${reference}`); await expect(page.getByTestId('data-table').locator('tbody tr').filter({ hasText: reference })).toHaveCount(0);
      const left = await page.request.post(`${URLS.api}/api/v1/admin/leads/test/remove`, { headers: h, data: { confirm: false } }); expect((await left.json()).count).toBe(0);
    });
  });
});
