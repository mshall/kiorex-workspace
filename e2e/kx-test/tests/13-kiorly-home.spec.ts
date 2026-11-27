import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, openAs } from '../lib/session';
import { passportSignIn } from '../lib/passport';

/**
 * Kiorly Home (ADR-038) on kx-test, hosted at the registry host kiorly.app (static site, SPA fallback, /idp/* proxied to Passport).
 * Covers: the host exists and serves the SPA on /signin and /signin/<product>; the Lab and Pharmacy "Switch product" link opens Home with the four tiles;
 * the Passport client accepts Home's redirect URI and refuses a foreign one; the same-origin /idp path reaches Passport; the product APIs answer the password
 * handoff preflight for Home's origin only; a Passport sign-in for the Lab tile ends in the Lab (at most ONE phone code: a saved Passport session is reused).
 * No demo credential is typed anywhere; the persona is the same synthetic lab technician every other live spec uses.
 */
const HOME = URLS.home;
const preflight = (api: string, origin: string) => fetch(`${api}/api/v1/auth/handoff/login`, { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });

test.describe.serial('Kiorly Home on kx-test', () => {
  test('the host resolves and serves the SPA on /signin, /signin/<product> and deep links; noindex; no localhost in the bundle', async () => {
    for (const p of ['/signin', '/signin/lab', '/signin?switch=1', '/signin/callback']) {
      const r = await fetch(`${HOME}${p}`); expect(r.status, p).toBe(200);
      expect(r.headers.get('content-type') ?? '', p).toMatch(/text\/html/); expect(r.headers.get('x-robots-tag') ?? '', p).toMatch(/noindex/);
    }
    const html = await (await fetch(`${HOME}/signin`)).text();
    const js = html.match(/\/assets\/index-[^"]+\.js/)?.[0]; expect(js).toBeTruthy();
    const bundle = await (await fetch(`${HOME}${js}`)).text();
    expect(bundle).not.toMatch(/localhost|127\.0\.0\.1/); expect(bundle).not.toContain('Test users (dev only)');
    expect(bundle).toContain(new URL(URLS.issuer).host); expect(bundle).toContain(new URL(URLS.lab).host); expect(bundle).toContain(new URL(URLS.pharmacy).host); expect(bundle).toContain(new URL(URLS.clinic).host);
  });

  test('Passport: the kiorly-home client accepts the Home redirect URI and refuses a foreign one', async () => {
    const q = (redirect: string) => new URLSearchParams({ client_id: 'kiorly-home', redirect_uri: redirect, response_type: 'code', scope: 'openid', code_challenge: 'a'.repeat(43), code_challenge_method: 'S256', state: 'x' });
    const ok = await fetch(`${URLS.passport}/auth?${q(`${HOME}/signin/callback`)}`, { redirect: 'manual' }); expect(ok.status).toBe(303);
    const bad = await fetch(`${URLS.passport}/auth?${q('https://evil.example.com/signin/callback')}`, { redirect: 'manual' }); expect(bad.status).toBe(400);
  });

  test('same-origin /idp reaches Passport (prefix removed): discovery-style paths answer, workspaces refuses a missing token', async () => {
    const jwks = await fetch(`${HOME}/idp/jwks`); expect(jwks.status).toBe(200); expect(((await jwks.json()) as { keys: unknown[] }).keys.length).toBeGreaterThan(0);
    const ws = await fetch(`${HOME}/idp/api/workspaces`); expect(ws.status).toBe(401);
    const tok = await fetch(`${HOME}/idp/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: 'kiorly-home', code: 'nope', redirect_uri: `${HOME}/signin/callback`, code_verifier: 'x'.repeat(43) }) });
    expect(tok.status).toBe(400);
  });

  test('product APIs: the password handoff preflight allows Home and no foreign origin (Clinic, Pharmacy, Lab)', async () => {
    for (const api of [URLS.clinic, URLS.pharmacy, URLS.lab]) {
      const ok = await preflight(api, HOME); expect(ok.headers.get('access-control-allow-origin'), `${api} for Home`).toBe(HOME);
      const bad = await preflight(api, 'https://evil.example.com'); expect(bad.headers.get('access-control-allow-origin'), `${api} for a foreign origin`).toBeNull();
    }
  });

  for (const [name, url] of [['Lab', URLS.lab], ['Pharmacy', URLS.pharmacy]] as const) {
    test(`${name}: "Switch product" opens Kiorly Home with the four tiles`, async ({ page }) => {
      await page.addInitScript(() => { try { localStorage.setItem('kiorly.lang', 'en'); } catch { /* ignore */ } });
      await page.goto(`${url}/login`);
      const link = page.getByTestId('switch-product'); await expect(link).toBeVisible();
      expect(await link.getAttribute('href')).toBe(`${HOME}/signin?switch=1`);
      await link.click();
      await page.waitForURL((u) => u.origin === HOME && u.pathname === '/signin', { timeout: 30_000 });
      for (const k of ['clinic', 'nurse', 'pharmacy', 'lab']) await expect(page.getByTestId(`product-${k}`), k).toBeVisible();
      await expect(page.getByTestId('switch-note')).toBeVisible(); await expect(page.getByTestId('signin-passport')).toBeVisible();
      await expect(page.getByText(/Test users/i)).toHaveCount(0);
    });
  }

  test('Passport sign-in from Home for the Lab tile lands in the Lab (silent code flow, no second code)', async ({ browser }) => {
    await ensureSession(browser, 'labTech'); // at most one phone code, and none while the saved session is fresh
    const { context, page } = await openAs(browser, 'labTech'); const ctx: BrowserContext = context;
    try {
      await page.goto(`${HOME}/signin/lab`);
      await page.getByTestId('signin-passport').click();
      // either the Passport session is alive (straight back to Home, then the Lab) or Passport asks for the phone once
      await page.waitForURL((u) => u.origin === URLS.lab || u.host === new URL(URLS.passport).host, { timeout: 45_000 });
      if (new URL(page.url()).host === new URL(URLS.passport).host) await passportSignIn(page, { phone: '+201000002005' });
      await page.waitForURL((u) => u.origin === URLS.lab && !u.pathname.startsWith('/login'), { timeout: 60_000 });
      await expect(page.getByText('Omar Technologist')).toBeVisible();
    } finally { await ctx.close(); }
  });
});
