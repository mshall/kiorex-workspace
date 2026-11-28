import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, liveToken, openAs } from '../lib/session';

/**
 * Plans on the Kiorly landing page, end to end on the DEPLOYED hosts: the public API (https://api.<env>), the landing page (https://test.kiorly.com) that reads it at load,
 * and the Kiorly admin (admin.test.kiorly.com) where a super admin changes plans and ops only reads.
 *
 * What changes on the live system, and how it is undone: (1) the Lab edition wording (a platform setting nobody else uses) gets a tag in one name; (2) the sort order of ONE
 * Clinic plan is moved and moved back (a metadata change, no price, nothing a subscriber is charged for, no notice is sent). Both are restored in `afterAll` even when a step
 * fails. NO price is published on the live Clinic: it holds the real organisation Dr Ahmed Shall, and a new price version schedules moves and sends notices to subscribers (that
 * path is covered by the integration tests against a private database); the price PREVIEW is run live because it writes nothing.
 */
const PUB = `${URLS.api}/api/v1/public/plans`;
const ADMIN = `${URLS.api}/api/v1/admin/kiorly-plans`;
const STAMP = `E2E${Date.now().toString(36).toUpperCase()}`;
/** platform cache 60 s + browser 60 s + one reload interval; a generous bound, the loop stops as soon as the change shows */
const WINDOW_MS = 4 * 60_000;

const plansUi = (page: Page) => page.locator('[data-plans-live]');
async function openLanding(page: Page, lang: 'en' | 'ar') {
  await page.goto(`${URLS.site}/${lang}/`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-plans]')).toHaveAttribute('data-state', 'live', { timeout: 20_000 });
}
/** reloads the landing page until `probe` is true; fails with the last seen text if the window passes */
async function untilShown(page: Page, lang: 'en' | 'ar', probe: (p: Page) => Promise<boolean>, what: string) {
  const end = Date.now() + WINDOW_MS; let last = '';
  for (;;) {
    await openLanding(page, lang);
    if (await probe(page)) return;
    last = await page.locator('#plans').innerText().catch(() => '');
    if (Date.now() > end) throw new Error(`${what}: not shown on the landing page within ${WINDOW_MS / 1000}s. Last text: ${last.slice(0, 400)}`);
    await page.waitForTimeout(15_000);
  }
}

test.describe.serial('Kiorly landing plans on kx-test', () => {
  let api: APIRequestContext; let opsCtx: BrowserContext; let supCtx: BrowserContext; let sup: Page; let ops: Page;
  let supH: Record<string, string>; let opsH: Record<string, string>;
  let originalContent: { version: number; config: any } | null = null; let clinicRestore: { id: string; sortOrder: number } | null = null;

  test.beforeAll(async ({ browser, playwright }) => {
    api = await playwright.request.newContext();
    await ensureSession(browser, 'superAdmin'); await ensureSession(browser, 'ops');
    ({ context: supCtx, page: sup } = await openAs(browser, 'superAdmin')); ({ context: opsCtx, page: ops } = await openAs(browser, 'ops'));
    await sup.goto(`${URLS.ops}/kiorly-plans`); await ops.goto(`${URLS.ops}/kiorly-plans`);
    supH = { authorization: `Bearer ${await liveToken(sup)}`, origin: URLS.opsKiorly, 'content-type': 'application/json' };
    opsH = { authorization: `Bearer ${await liveToken(ops)}`, origin: URLS.opsKiorly, 'content-type': 'application/json' };
  });
  test.afterAll(async () => {
    // restore whatever a failed step left behind, in the reverse order of the changes
    try {
      if (clinicRestore) { const r = await api.patch(`${ADMIN}/clinic/${clinicRestore.id}`, { headers: supH, data: { sortOrder: clinicRestore.sortOrder } }); console.log(`restore clinic sortOrder: ${r.status()}`); }
      if (originalContent) {
        const cur = (await (await api.get(ADMIN, { headers: supH })).json()).content;
        if (JSON.stringify(cur.config) !== JSON.stringify(originalContent.config)) { const r = await api.put(`${ADMIN}/content`, { headers: supH, data: { version: cur.version, config: originalContent.config } }); console.log(`restore Lab wording: ${r.status()}`); }
      }
    } catch (e) { console.log(`RESTORE FAILED, fix by hand in the Kiorly admin Plans screen: ${(e as Error).message}`); }
    await api?.dispose(); await supCtx?.close(); await opsCtx?.close();
  });

  test('the public API: no token, contract v1, whitelisted fields, cacheable, GET only, CORS for the site origin only', async () => {
    const r = await api.get(PUB); expect(r.status()).toBe(200);
    expect(r.headers()['cache-control']).toMatch(/public, max-age=60/);
    const j = await r.json();
    expect(j.contract).toBe('kiorly.public-plans.v1');
    expect(j.modules.map((m: { id: string }) => m.id)).toEqual(['clinic', 'pharmacy', 'lab']);
    const text = JSON.stringify(j);
    expect(text).not.toMatch(/localhost|127\.0\.0\.1|cohort|entitlement|"id":"c[a-z0-9]{20,}"/i);
    for (const m of j.modules.filter((x: { id: string }) => x.id !== 'clinic')) for (const p of m.plans) { expect(p.priceStatus).toBe('TO_BE_ANNOUNCED'); expect(p.prices).toEqual([]); }
    for (const p of j.modules[0].plans) { // a plan says SET only with a real price, otherwise carries no number
      if (p.priceStatus === 'SET') expect(p.prices.length).toBeGreaterThan(0); else expect(p.prices).toEqual([]);
      expect(p.name.en && p.name.ar).toBeTruthy();
    }
    const ok = await api.get(PUB, { headers: { origin: URLS.site } }); expect(ok.headers()['access-control-allow-origin']).toBe(URLS.site);
    const evil = await api.get(PUB, { headers: { origin: 'https://evil.example.com' } }); expect(evil.status()).toBe(200); expect(evil.headers()['access-control-allow-origin']).toBeUndefined();
    const pre = await api.fetch(PUB, { method: 'OPTIONS', headers: { origin: URLS.site, 'access-control-request-method': 'GET' } }); expect(pre.status()).toBe(204); expect(pre.headers()['access-control-allow-methods']).toBe('GET, OPTIONS');
    for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) expect((await api.fetch(PUB, { method: m, data: {} })).status(), m).toBeGreaterThanOrEqual(400);
    expect((await api.get(`${PUB}?market=NOPE`)).status()).toBe(400);
  });

  test('the landing page shows exactly what the API says, in English and Arabic, with no localhost and noindex', async ({ page }) => {
    const api1 = await (await api.get(PUB)).json();
    for (const lang of ['en', 'ar'] as const) {
      const r = await page.goto(`${URLS.site}/${lang}/`); expect(r?.headers()['x-robots-tag']).toContain('noindex');
      await expect(page.locator('[data-plans]')).toHaveAttribute('data-state', 'live', { timeout: 20_000 });
      const tabs = await plansUi(page).getByRole('tab').allInnerTexts();
      expect(tabs.length).toBe(api1.modules.filter((m: { plans: unknown[] }) => m.plans.length).length);
      for (const m of api1.modules) for (const p of m.plans) {
        const card = page.locator(`[data-plan="${m.id}-${p.id}"]`); await expect(card, `${m.id}/${p.id}`).toHaveCount(1);
        expect(await card.locator('h3').innerText()).toBe(p.name[lang]);
        const status = await card.locator('[data-price-status]').first().getAttribute('data-price-status');
        expect(status).toBe(p.prices.length ? 'set' : 'tbd'); // a price on the page only where the API carries one
      }
      expect(await page.locator('#plans').innerHTML()).not.toMatch(/localhost|127\.0\.0\.1/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test('the landing page keeps its neutral text when the API cannot be reached (blocked in the browser)', async ({ page }) => {
    await page.route(PUB, (r) => r.abort());
    await page.goto(`${URLS.site}/en/`);
    await expect(page.locator('[data-plans]')).toHaveAttribute('data-state', 'fallback', { timeout: 20_000 });
    await expect(page.locator('[data-plans-fallback]')).toContainText('Plans are being finalised');
    expect(await page.locator('#plans').innerText()).not.toMatch(/\d{3,}/);
  });

  test('roles: no token 401, ops reads and cannot change plans or wording (403), a price is never published directly (409), super admin reads with canChange', async () => {
    expect((await api.get(ADMIN)).status()).toBe(401);
    const o = await api.get(ADMIN, { headers: opsH }); expect(o.status(), await o.text()).toBe(200); expect((await o.json()).canChange).toBe(false);
    const s = await api.get(ADMIN, { headers: supH }); expect(s.status()).toBe(200);
    const j = await s.json(); expect(j.canChange).toBe(true); expect(j.clinic.available).toBe(true); expect(j.clinic.plans.length).toBeGreaterThanOrEqual(3); expect(j.clinic.markets.some((m: { code: string }) => m.code === 'EG')).toBe(true);
    const planId = j.clinic.plans[0].id;
    expect((await api.patch(`${ADMIN}/clinic/${planId}`, { headers: opsH, data: { sortOrder: 99 } })).status()).toBe(403);
    expect((await api.post(`${ADMIN}/clinic/${planId}/prices`, { headers: opsH, data: { marketId: 'x', amount: '1' } })).status()).toBe(409); // a price is proposed and approved, never published directly (spec 16)
    expect((await api.post(`${ADMIN}/clinic/${planId}/prices`, { headers: supH, data: { marketId: 'x', amount: '1' } })).status()).toBe(409);
    expect((await api.put(`${ADMIN}/content`, { headers: opsH, data: { version: j.content.version, config: j.content.config } })).status()).toBe(403);
    expect((await api.patch(`${ADMIN}/clinic/${'a'.repeat(65)}`, { headers: supH, data: { sortOrder: 1 } })).status()).toBe(400);
  });

  test('the Plans screen: ops can propose a price but has no plan, wording or approval control; the super admin sees them (English)', async () => {
    await ops.goto(`${URLS.opsKiorly}/kiorly-plans`);
    await expect(ops.getByTestId('clinic-section')).toBeVisible({ timeout: 30_000 });
    await expect(ops.getByTestId('read-only-note')).toBeVisible();
    await expect(ops.locator('[data-testid^="new-price-"]').first()).toBeVisible(); await expect(ops.locator('[data-testid^="edit-"]')).toHaveCount(0); await expect(ops.locator('[data-testid^="approve-"]')).toHaveCount(0); await expect(ops.getByTestId('content-save')).toHaveCount(0);
    await sup.goto(`${URLS.opsKiorly}/kiorly-plans`);
    await expect(sup.getByTestId('clinic-section')).toBeVisible({ timeout: 30_000 });
    await expect(sup.locator('[data-testid^="new-price-"]').first()).toBeVisible(); await expect(sup.locator('[data-testid^="edit-"]').first()).toBeVisible();
    expect(await sup.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('a live price preview writes nothing: the Clinic answers the impact and the price rows are unchanged', async () => {
    const before = await (await api.get(ADMIN, { headers: supH })).json();
    const pro = before.clinic.plans.find((p: { key: string }) => p.key === 'PRO'); const eg = before.clinic.markets.find((m: { code: string }) => m.code === 'EG');
    const r = await api.post(`${ADMIN}/clinic/${pro.id}/prices`, { headers: supH, data: { marketId: eg.id, currency: 'EGP', interval: 'MONTHLY', unit: 'PER_CLINICIAN', amount: '1', preview: true } });
    expect(r.status(), await r.text()).toBe(200); const j = await r.json(); expect(j.preview).toBe(true); expect(j.impact).toBeTruthy();
    const bad = await api.post(`${ADMIN}/clinic/${pro.id}/prices`, { headers: supH, data: { marketId: eg.id, currency: 'EGP', interval: 'MONTHLY', unit: 'PER_CLINICIAN', amount: 'abc', preview: true } });
    expect(bad.status()).toBe(400);
    const after = await (await api.get(ADMIN, { headers: supH })).json();
    expect(after.clinic.plans.find((p: { key: string }) => p.key === 'PRO').prices.length).toBe(pro.prices.length);
  });

  test('a super admin changes the Lab wording and the landing page shows it within the cache window; restoring shows the original again', async ({ page }) => {
    const cur = (await (await api.get(ADMIN, { headers: supH })).json()).content; originalContent = { version: cur.version, config: JSON.parse(JSON.stringify(cur.config)) };
    const tag = `Lite ${STAMP}`; const edited = JSON.parse(JSON.stringify(cur.config)); edited.lab.plans[0].name = { en: tag, ar: `لايت ${STAMP}` };
    const put = await api.put(`${ADMIN}/content`, { headers: supH, data: { version: cur.version, config: edited } }); expect(put.status(), await put.text()).toBe(200);
    // a stale save is refused, not merged
    expect((await api.put(`${ADMIN}/content`, { headers: supH, data: { version: cur.version, config: edited } })).status()).toBe(409);
    await untilShown(page, 'en', async (p) => { await plansUi(p).getByRole('tab', { name: 'Lab' }).click(); return (await p.locator('[data-plan="lab-lite"] h3').innerText()) === tag; }, 'Lab wording');
    await openLanding(page, 'ar'); await plansUi(page).getByRole('tab', { name: 'المعمل' }).click(); await expect(page.locator('[data-plan="lab-lite"] h3')).toHaveText(`لايت ${STAMP}`);
    await expect(page.locator('[data-plan="lab-lite"] [data-price-status=tbd]')).toBeVisible(); // wording changed, still no price
    // restore
    const now = (await (await api.get(ADMIN, { headers: supH })).json()).content;
    expect((await api.put(`${ADMIN}/content`, { headers: supH, data: { version: now.version, config: originalContent.config } })).status()).toBe(200);
    const original = originalContent.config.lab.plans[0].name.en;
    await untilShown(page, 'en', async (p) => { await plansUi(p).getByRole('tab', { name: 'Lab' }).click(); return (await p.locator('[data-plan="lab-lite"] h3').innerText()) === original; }, 'Lab wording restored');
    originalContent = null; // restored: nothing left for afterAll
  });

  test('a super admin reorders a Clinic plan through the Clinic and the landing page follows; the order is restored', async ({ page }) => {
    const ov = await (await api.get(ADMIN, { headers: supH })).json();
    const sorted = [...ov.clinic.plans].filter((p: { isPublic: boolean }) => p.isPublic).sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder);
    expect(sorted.length).toBeGreaterThanOrEqual(3);
    const last = sorted[sorted.length - 1]; const first = sorted[0];
    clinicRestore = { id: last.id, sortOrder: last.sortOrder };
    const lastKey = last.key.toLowerCase();
    const r = await api.patch(`${ADMIN}/clinic/${last.id}`, { headers: supH, data: { sortOrder: first.sortOrder - 5 } }); expect(r.status(), await r.text()).toBe(200);
    await untilShown(page, 'en', async (p) => (await plansUi(p).locator('#ppanel-clinic [data-plan]').first().getAttribute('data-plan')) === `clinic-${lastKey}`, 'reordered Clinic plan first');
    const back = await api.patch(`${ADMIN}/clinic/${last.id}`, { headers: supH, data: { sortOrder: last.sortOrder } }); expect(back.status()).toBe(200); clinicRestore = null;
    await untilShown(page, 'en', async (p) => (await plansUi(p).locator('#ppanel-clinic [data-plan]').first().getAttribute('data-plan')) === `clinic-${first.key.toLowerCase()}`, 'Clinic order restored');
    const fin = await (await api.get(ADMIN, { headers: supH })).json();
    expect(fin.clinic.plans.find((p: { id: string }) => p.id === last.id).sortOrder).toBe(last.sortOrder);
  });
});
