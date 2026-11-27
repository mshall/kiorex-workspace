import { expect, request as pwRequest, test } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { passportSignIn } from '../lib/passport';
import { ssm } from '../lib/aws';
import { ensureSession, openAs, savedToken } from '../lib/session';

/**
 * The live AWS Clinic wired to kx-test (27 Nov 2026): https://clinics.test.kiorly.com (second distribution, OpenTofu) next to the legacy CloudFront host,
 * Sign in with Kiorex Passport, CORS allow-list, the signed platform to Clinic marketplace API and the provider and slot sync.
 *
 * SAFETY: every call here is READ-ONLY against the live Clinic (the real organisation Dr Ahmed Shall lives there). No organisation, patient, hold or booking is created,
 * no sign-in default is changed. The throwaway-organisation tests at the end are fixme with the reason (see the run report).
 */
const CLINIC = URLS.clinic; const LEGACY = URLS.clinicLegacy;
const get = async (url: string, headers: Record<string, string> = {}) => { const c = await pwRequest.newContext(); try { const r = await c.get(url, { headers, maxRedirects: 0 }); return { status: r.status(), headers: r.headers(), text: await r.text() }; } finally { await c.dispose(); } };
const json = (t: string) => { try { return JSON.parse(t); } catch { return null; } };

test.describe('both Clinic hosts serve the same live Clinic', () => {
  for (const [name, base] of [['canonical clinics host', CLINIC], ['legacy CloudFront host', LEGACY]] as const) {
    test(`${name}: SPA, health ready and no localhost URL`, async () => {
      const home = await get(`${base}/`); expect(home.status).toBe(200); expect(home.headers['content-type']).toContain('text/html'); expect(home.text).not.toMatch(/localhost:\d{4}/);
      const deep = await get(`${base}/login`); expect(deep.status, 'SPA deep link rewrite').toBe(200); expect(deep.text).toContain('<div id="root">');
      const ready = await get(`${base}/api/v1/health/ready`); expect(ready.status).toBe(200);
    });
  }
  test('canonical host is noindex (non-production); the legacy host is not changed by this wiring', async () => {
    expect((await get(`${CLINIC}/`)).headers['x-robots-tag']).toMatch(/noindex/);
  });
  test('the signed marketplace API is reachable on the canonical host only through App Runner (unsigned request refused with 401)', async () => {
    expect((await get(`${CLINIC}/marketplace/v1/providers`)).status).toBe(401);
  });
});

test.describe('CORS allow-list (CORS_ALLOWED_ORIGINS from the registry)', () => {
  const preflight = async (base: string, origin: string) => { const c = await pwRequest.newContext(); try { const r = await c.fetch(`${base}/api/v1/auth/login`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' } }); return { status: r.status(), acao: r.headers()['access-control-allow-origin'] }; } finally { await c.dispose(); } };
  for (const origin of [CLINIC, LEGACY, URLS.pharmacy]) test(`allowed origin ${new URL(origin).host} is answered`, async () => { const r = await preflight(CLINIC, origin); expect(r.status).toBe(204); expect(r.acao).toBe(origin); });
  test('an unknown origin gets no CORS headers (on both hosts)', async () => {
    for (const base of [CLINIC, LEGACY]) { const r = await preflight(base, 'https://evil.example.com'); expect(r.acao, base).toBeUndefined(); expect(r.status).not.toBe(204); }
  });
});

test.describe('Sign in with Kiorex Passport is offered, organisations keep their own default', () => {
  for (const [name, base] of [['canonical', CLINIC], ['legacy', LEGACY]] as const) {
    test(`${name}: Passport available, deployment default stays PASSWORD (an organisation without its own choice, such as Dr Ahmed Shall, preselects the password)`, async () => {
      const r = await get(`${base}/api/v1/auth/kiorex/config`); expect(r.status).toBe(200);
      expect(json(r.text)).toMatchObject({ enabled: true, passportAvailable: true, defaultMethod: 'PASSWORD', defaultSignIn: 'PASSWORD', edition: 'CLINIC' });
    });
    test(`${name}: the authorization URL points at the Passport issuer with the canonical callback, and Passport accepts it`, async () => {
      const c = await pwRequest.newContext();
      try {
        const r = await c.post(`${base}/api/v1/auth/kiorex/start`, { data: {} }); expect(r.status()).toBe(200);
        const a = new URL((await r.json()).authorizationUrl); expect(a.host).toBe(new URL(URLS.passport).host);
        expect(a.searchParams.get('client_id')).toBe('kiorly-clinic'); expect(a.searchParams.get('redirect_uri')).toBe(`${CLINIC}/auth/kiorex/callback`); expect(a.searchParams.get('code_challenge_method')).toBe('S256');
        const p = await c.get(a.toString(), { maxRedirects: 0 }); expect(p.status(), 'Passport accepted the registered redirect URI').toBe(303);
      } finally { await c.dispose(); }
    });
  }
  test('Passport also accepts the legacy host callback and still refuses an unregistered one', async () => {
    const c = await pwRequest.newContext();
    try {
      const base = `${URLS.passport}/auth?client_id=kiorly-clinic&response_type=code&scope=openid&code_challenge=${'a'.repeat(43)}&code_challenge_method=S256&state=s&nonce=n`;
      expect((await c.get(`${base}&redirect_uri=${encodeURIComponent(`${LEGACY}/auth/kiorex/callback`)}`, { maxRedirects: 0 })).status()).toBe(303);
      expect((await c.get(`${base}&redirect_uri=${encodeURIComponent('https://evil.example.com/auth/kiorex/callback')}`, { maxRedirects: 0 })).status()).toBe(400);
    } finally { await c.dispose(); }
  });
  test('browser: Clinic login page, Passport (existing SSO session, else phone code), back on the canonical callback (server-side token exchange through the NAT), unlinked identity is told to link', async ({ browser }) => {
    // The saved ops session carries the Passport SSO cookie, so no new one-time code is spent (Passport limits codes per phone and per IP and hour).
    await ensureSession(browser, 'ops');
    const { context, page } = await openAs(browser, 'ops');
    try {
      await page.goto(`${CLINIC}/login`);
      await expect(page.getByText('Password', { exact: true }).first()).toBeVisible(); // both methods are offered, the password stays preselected
      await page.getByText('Kiorex Passport', { exact: true }).first().click();
      await page.getByTestId('kiorex-passport-button').click();
      const passportHost = new URL(URLS.passport).host;
      await page.waitForURL((u) => u.host === passportHost || u.pathname.startsWith('/auth/kiorex/callback'), { timeout: 30_000 });
      if (new URL(page.url()).host === passportHost && (await page.locator('#phone').isVisible().catch(() => false))) await passportSignIn(page, { phone: '+201000001001' });
      await page.waitForURL((u) => u.origin === new URL(CLINIC).origin && u.pathname.startsWith('/auth/kiorex/callback'), { timeout: 60_000 });
      await expect(page.getByTestId('kiorex-callback')).toBeVisible();
      // no staff row of the Clinic is linked to a demo Passport identity, so the exchange succeeded and the Clinic asks for the password link flow (never auto-created)
      await expect(page.getByText(/not linked to a Kiorly account yet|غير مرتبط بحساب كيورلي/)).toBeVisible({ timeout: 45_000 });
    } finally { await context.close(); }
  });
});

// Runs inside the platform container with the platform's own signing code and the registered Clinic client (read-only calls).
const PROBE = `
const { KiorlyClient } = require('./dist/kiorly/kiorly.client');
(async () => {
  const c = new KiorlyClient(); const out = {};
  try {
    const r = await c.listProviders({ page: 1, pageSize: 50 }); const items = r.data.items || [];
    out.providers = { status: r.status, total: r.data.total, live: items.filter((i) => i.status === 'LIVE').length };
    const i = items[0]; const typeId = Object.keys(((i || {}).provider || {}).feesByAppointmentTypeId || {})[0];
    const s = await c.slots(i.clinicId, { clinicianId: i.clinicianId, typeId, from: new Date(Date.now() + 86400000).toISOString(), to: new Date(Date.now() + 8 * 86400000).toISOString() });
    out.slots = { status: s.status, n: (s.data.slots || []).length, channel: s.data.channel };
  } catch (e) { out.error = String(e.message).slice(0, 100); }
  console.log('PROBE ' + JSON.stringify(out)); process.exit(0);
})();`;

test.describe('platform to Clinic: signed marketplace API, provider and slot sync (read-only)', () => {
  let out: { providers?: { status: number; total: number; live: number }; slots?: { status: number; n: number; channel: string }; error?: string } = {};
  test.beforeAll(() => {
    const b64 = Buffer.from(PROBE).toString('base64');
    const raw = ssm(`echo ${b64} | base64 -d > /tmp/kx-e2e-clinic.js && docker cp /tmp/kx-e2e-clinic.js kx-test-platform-api-1:/repo/apps/api/kx-e2e-clinic.js && docker exec -w /repo/apps/api kx-test-platform-api-1 node kx-e2e-clinic.js 2>&1 | grep '^PROBE ' ; docker exec kx-test-platform-api-1 rm -f /repo/apps/api/kx-e2e-clinic.js; rm -f /tmp/kx-e2e-clinic.js`);
    out = JSON.parse(raw.replace(/^[\s\S]*PROBE /, ''));
  });
  test('the platform authenticates to the Clinic marketplace API with the registered client and reads LIVE providers', () => { expect(out.error).toBeUndefined(); expect(out.providers?.status).toBe(200); expect(out.providers?.total).toBeGreaterThanOrEqual(1); expect(out.providers?.live).toBeGreaterThanOrEqual(1); });
  test('the Clinic returns bookable slots for a LIVE provider (marketplace channel)', () => { expect(out.slots?.status).toBe(200); expect(out.slots?.n).toBeGreaterThan(0); expect(out.slots?.channel).toBe('MARKETPLACE'); });

  test('ops: the provider sync runs against the Clinic without error and the synced Clinic providers are listed', async ({ browser }) => {
    await ensureSession(browser, 'ops');
    const token = savedToken('ops')!; const c = await pwRequest.newContext({ extraHTTPHeaders: { authorization: `Bearer ${token}` } });
    try {
      const sync = await c.post(`${URLS.api}/api/v1/admin/providers/sync?full=true`); expect(sync.status(), await sync.text()).toBe(200);
      const body = await sync.json(); expect(body.upserted + body.skipped).toBeGreaterThanOrEqual(out.providers?.total ?? 1);
      const list = await c.get(`${URLS.api}/api/v1/admin/providers?q=Nile`); expect(list.status()).toBe(200);
      const l = await list.json(); expect(JSON.stringify(l)).toMatch(/Dr Karim Adel/); expect(JSON.stringify(l)).toMatch(/Dr Mona Fahmy/);
    } finally { await c.dispose(); }
  });
});

test.describe('booking and throwaway organisation', () => {
  test('patient search and provider page: the Egypt market gate is a HUMAN gate, so the closed state is asserted (it switches to a booking assertion when a human opens it)', async () => {
    const c = await pwRequest.newContext();
    try {
      const r = await c.get(`${URLS.api}/api/v1/search/providers?q=Nile`); const b = await r.json().catch(() => null);
      if ((b?.total ?? 0) > 0) expect(JSON.stringify(b)).toMatch(/Nile/); else expect([200, 403]).toContain(r.status());
    } finally { await c.dispose(); }
  });
  test.fixme('throwaway organisation: create it, link Passport from Profile, sign in with Passport, list a provider, book from test.kiorex.com (needs: a way to create an organisation and approve its doctor; public signup needs a real WhatsApp OTP; the Platform tab needs a platform admin credential; and the market gate)', async () => undefined);
});
