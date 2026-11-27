import { expect, request as pwRequest, test, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { dropSession, ensureSession, liveToken, openAs } from '../lib/session';

/**
 * Patient web (test.kiorex.com), signed in as the demo patient Hoda Mahmoud (+201000001001) through Passport.
 *
 * THE MARKET GATE: Egypt (`market.eg.live`) is launch-locked until a HUMAN records gate evidence (ADR-024). The deployed demo seed deliberately records none (no dev gate evidence in
 * kx-test), so search and the provider page are correctly empty / closed until the founder records the gate in the ops console. The data tests below detect the state at run time:
 * gate closed -> the closed-gate behaviour is asserted; gate open -> the same suite asserts the demo providers are searchable and bookable.
 */
const publicGet = async (path: string) => { const c = await pwRequest.newContext(); try { const r = await c.get(`${URLS.api}${path}`); return { status: r.status(), body: await r.json().catch(() => null) as any }; } finally { await c.dispose(); } };

test.describe.serial('patient web', () => {
  let ctx: BrowserContext; let page: Page; let live = false;
  test.beforeAll(async ({ browser }) => {
    await ensureSession(browser, 'patient'); ({ context: ctx, page } = await openAs(browser, 'patient'));
    live = ((await publicGet('/api/v1/search/providers?q=Demo')).body?.total ?? 0) > 0;
  });
  test.afterAll(async () => { await ctx?.close(); });

  test('signed in through Passport: the home page greets the demo patient by name', async () => {
    await page.goto(`${URLS.patientWeb}/`); await expect(page.getByText('Hello, Hoda Mahmoud')).toBeVisible();
    expect(await liveToken(page)).toMatch(/^eyJ/);
  });
  test('account page shows the Passport identity (name and phone) and no secrets', async () => {
    await page.goto(`${URLS.patientWeb}/account`); await expect(page.getByText('Hoda Mahmoud').first()).toBeVisible(); await expect(page.getByText('+201000001001')).toBeVisible();
    await expect(page.getByText(/Sign-in details are managed by Kiorex Passport/)).toBeVisible();
  });
  test('the search page loads and states the market status truthfully', async () => {
    await page.goto(`${URLS.patientWeb}/search?q=Demo`); await expect(page.getByRole('heading', { name: 'Find a doctor' })).toBeVisible();
    if (live) await expect(page.getByText('Dr Demo').first()).toBeVisible();
    else { await expect(page.getByText(/not live in any market yet/i)).toBeVisible(); await expect(page.getByText('No doctors').first()).toBeVisible(); }
  });
  test('search API: closed gate answers an empty result, never an error; open gate returns the demo providers', async () => {
    const r = await publicGet('/api/v1/search/providers?q=Demo'); expect(r.status).toBe(200);
    if (live) { expect(r.body.total).toBeGreaterThanOrEqual(8); expect(JSON.stringify(r.body)).toContain('Dr Demo'); } else expect(r.body.total).toBe(0);
  });
  test('provider page: demo provider is reachable when the market is live, and the closed gate is reported as FEATURE_DISABLED / AWAITING_GATE otherwise', async () => {
    const r = await publicGet('/api/v1/providers/demo_dp_3');
    if (live) { expect(r.status).toBe(200); expect(r.body.nameEn ?? r.body.provider?.nameEn).toContain('Laila'); await page.goto(`${URLS.patientWeb}/doctors/demo_dp_3`); await expect(page.getByText(/Laila Farouk/)).toBeVisible(); await expect(page.getByText(/Dermatology/i).first()).toBeVisible(); }
    else { expect(r.status).toBe(403); expect(r.body).toMatchObject({ code: 'FEATURE_DISABLED', key: 'market.eg.live', reason: 'AWAITING_GATE' }); await page.goto(`${URLS.patientWeb}/doctors/demo_dp_3`); await expect(page.getByText(/not live in Egypt yet/i)).toBeVisible(); }
  });
  test.fixme('book a slot: needs the market gate recorded by a human and a Clinic wired to kx-test (booking calls the Clinic, none is wired)', async () => undefined);
  test('appointments page loads and the Past tab lists the completed demo visit', async () => {
    await page.goto(`${URLS.patientWeb}/appointments`); await expect(page.getByRole('heading', { name: 'My appointments' })).toBeVisible();
    await page.getByRole('tab', { name: 'Past' }).or(page.getByText('Past', { exact: true })).first().click();
    await expect(page.getByText(/Hana Saleh/).first()).toBeVisible();
  });
  test('pharmacy orders: the demo order of this patient is listed', async () => {
    await page.goto(`${URLS.patientWeb}/pharmacy/orders`); await expect(page.getByRole('heading', { name: 'My pharmacy orders' })).toBeVisible();
    await expect(page.getByText('Aspirex 81mg').first()).toBeVisible(); await expect(page.getByText('Awaiting payment')).toBeVisible();
  });
  test('services page shows the launch-locked verticals as awaiting approval (pharmacy, lab, video)', async () => {
    await page.goto(`${URLS.patientWeb}/services`); await expect.poll(() => page.getByText('Awaiting approval').count()).toBeGreaterThanOrEqual(3); await expect(page.getByText('Records').first()).toBeVisible();
  });
  test('the browser never calls localhost or a host outside the registry', async () => {
    const hosts = new Set<string>(); page.on('request', (rq) => hosts.add(new URL(rq.url()).host));
    await page.goto(`${URLS.patientWeb}/`); await page.waitForLoadState('networkidle');
    const allowed = new Set([new URL(URLS.patientWeb).host, new URL(URLS.api).host, new URL(URLS.passport).host]);
    for (const h of hosts) expect(allowed.has(h) || /^(fonts\.|www\.)/.test(h), `unexpected host ${h}`).toBe(true);
  });
  test('sign out ends the session', async () => {
    await page.goto(`${URLS.patientWeb}/`); await page.getByRole('button', { name: 'Sign out' }).first().click();
    await page.waitForURL((u) => u.host !== new URL(URLS.patientWeb).host || u.pathname === '/', { timeout: 30000 }).catch(() => undefined);
    dropSession('patient');
    await page.goto(`${URLS.patientWeb}/appointments`); await expect(page.getByRole('heading', { name: 'My appointments' })).toHaveCount(0, { timeout: 15000 });
  });
});
