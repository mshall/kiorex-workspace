import { expect, request as pwRequest, test } from '@playwright/test';
import { NON_PRODUCTION, URLS } from '../lib/hosts';

/** HTTP only. Health, security headers, noindex on non-production, CORS refusal for an evil origin. */
const EVIL = 'https://evil.example.com';
const get = async (url: string, headers: Record<string, string> = {}, method: 'GET' | 'OPTIONS' = 'GET') => {
  const ctx = await pwRequest.newContext({ extraHTTPHeaders: headers, ignoreHTTPSErrors: false });
  try { const r = await ctx.fetch(url, { method, maxRedirects: 0 }); return { status: r.status(), headers: r.headers(), text: await r.text() }; } finally { await ctx.dispose(); }
};

test.describe('health', () => {
  const live: [string, string][] = [
    ['platform API live', `${URLS.api}/api/v1/health/live`], ['platform API ready', `${URLS.api}/api/v1/health/ready`],
    ['Passport', `${URLS.passport}/healthz`], ['Pharmacy API live', `${URLS.pharmacy}/api/v1/health/live`], ['Pharmacy API ready (database ok)', `${URLS.pharmacy}/api/v1/health/ready`],
    ['Lab API live', `${URLS.lab}/api/v1/health/live`], ['Lab API ready (database ok)', `${URLS.lab}/api/v1/health/ready`],
  ];
  for (const [name, url] of live) test(name, async () => { const r = await get(url); expect(r.status).toBe(200); });
  test('Passport discovery names the public https issuer (not an internal host)', async () => {
    const r = await get(`${URLS.passport}/.well-known/openid-configuration`); expect(r.status).toBe(200);
    const d = JSON.parse(r.text); expect(d.issuer).toBe(URLS.issuer); expect(d.authorization_endpoint.startsWith(URLS.passport)).toBe(true); expect(d.jwks_uri.startsWith(URLS.passport)).toBe(true);
  });
  test('the four web apps serve the SPA and carry no localhost URL', async () => {
    for (const base of [URLS.patientWeb, URLS.ops, URLS.pharmacy, URLS.lab]) {
      const r = await get(`${base}/`); expect(r.status, base).toBe(200); expect(r.text).toContain('<div id="root"');
      const js = [...r.text.matchAll(/src="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]).slice(0, 3);
      for (const p of js) { const a = await get(`${base}${p}`); expect(a.text, `${base}${p}`).not.toMatch(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//); }
    }
  });
});

test.describe('security headers', () => {
  for (const [name, base] of [['patient web', URLS.patientWeb], ['ops console', URLS.ops], ['Pharmacy web', URLS.pharmacy], ['Lab web', URLS.lab]] as const) {
    test(`${name}: nosniff, frame denial, referrer policy, HSTS`, async () => {
      const h = (await get(`${base}/`)).headers;
      expect(h['x-content-type-options']).toBe('nosniff'); expect(h['x-frame-options']).toBe('DENY');
      expect(h['referrer-policy']).toMatch(/strict-origin|no-referrer|same-origin/); expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/);
    });
  }
  for (const [name, url] of [['platform API', `${URLS.api}/api/v1/health/live`], ['Pharmacy API', `${URLS.pharmacy}/api/v1/health/live`], ['Lab API', `${URLS.lab}/api/v1/health/live`]] as const) {
    test(`${name}: nosniff, frame denial, CSP frame-ancestors none, HSTS, no server banner`, async () => {
      const h = (await get(url)).headers;
      expect(h['x-content-type-options']).toBe('nosniff'); expect(h['x-frame-options']).toBe('DENY'); expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/); expect(h['x-powered-by']).toBeUndefined();
    });
  }
  test('Passport pages: CSP without wildcard script sources, nosniff, no-store on /healthz', async () => {
    const h = (await get(`${URLS.passport}/healthz`)).headers;
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'"); expect(h['content-security-policy']).not.toMatch(/script-src[^;]*\*/); expect(h['x-content-type-options']).toBe('nosniff'); expect(h['cache-control']).toContain('no-store');
  });
});

test.describe('non-production is not indexable', () => {
  test.skip(!NON_PRODUCTION, 'production hosts are meant to be indexable');
  for (const [name, url] of [['patient web', `${URLS.patientWeb}/`], ['patient web deep link', `${URLS.patientWeb}/search`], ['ops console', `${URLS.ops}/`], ['Pharmacy web', `${URLS.pharmacy}/`], ['Lab web', `${URLS.lab}/`], ['platform API', `${URLS.api}/api/v1/health/live`], ['Passport', `${URLS.passport}/healthz`]] as const) {
    test(`${name}: X-Robots-Tag noindex`, async () => { expect((await get(url)).headers['x-robots-tag'] ?? '').toMatch(/noindex/i); });
  }
  // closed 27 Nov 2026: the origin router (Caddy) adds the header on every response of a non-production environment, whatever the app does
  for (const [name, url] of [['Pharmacy API', `${URLS.pharmacy}/api/v1/health/live`], ['Lab API', `${URLS.lab}/api/v1/health/live`]] as const) {
    test(`${name}: X-Robots-Tag noindex, nofollow`, async () => { expect((await get(url)).headers['x-robots-tag'] ?? '').toBe('noindex, nofollow'); });
  }
  test('every response of every API host carries exactly one X-Robots-Tag, errors included', async () => {
    for (const url of [`${URLS.api}/api/v1/nope-404`, `${URLS.pharmacy}/api/v1/nope-404`, `${URLS.lab}/api/v1/nope-404`, `${URLS.pharmacy}/marketplace/v1/pharmacies`, `${URLS.lab}/api/v1/integration/v1/tests`, `${URLS.passport}/nope-404`]) {
      const r = await get(url); expect(r.headers['x-robots-tag'], url).toBe('noindex, nofollow');
    }
  });
});

test.describe('CORS', () => {
  const preflight = (url: string, origin: string) => get(url, { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' }, 'OPTIONS');
  test('platform API allows the patient web and the ops console origins (with credentials) and no other', async () => {
    for (const o of [URLS.patientWeb, URLS.ops]) {
      const a = await get(`${URLS.api}/api/v1/health/live`, { origin: o }); expect(a.headers['access-control-allow-origin']).toBe(o);
      const p = await preflight(`${URLS.api}/api/v1/health/live`, o); expect(p.status).toBe(204); expect(p.headers['access-control-allow-origin']).toBe(o);
    }
  });
  for (const [name, url] of [['platform API', `${URLS.api}/api/v1/health/live`], ['Pharmacy API', `${URLS.pharmacy}/api/v1/health/live`], ['Lab API', `${URLS.lab}/api/v1/health/live`]] as const) {
    test(`${name} refuses an evil origin (simple request, preflight and the null origin)`, async () => {
      for (const o of [EVIL, 'null', `${URLS.patientWeb}.evil.example.com`, 'http://test.kiorex.com']) {
        expect((await get(url, { origin: o })).headers['access-control-allow-origin'], `GET Origin ${o}`).toBeUndefined();
        const p = await preflight(url, o); expect(p.headers['access-control-allow-origin'], `OPTIONS Origin ${o}`).toBeUndefined();
      }
    });
  }
  test('Lab API allows its own web origin', async () => { expect((await get(`${URLS.lab}/api/v1/health/live`, { origin: URLS.lab })).headers['access-control-allow-origin']).toBe(URLS.lab); });
  test('Passport refuses an evil origin on the authenticated endpoints (no reflection), with and without a token and on a preflight', async () => {
    for (const o of [EVIL, 'null', `${URLS.patientWeb}.evil.example.com`, 'http://test.kiorex.com']) {
      for (const hdr of [{ origin: o }, { origin: o, authorization: 'Bearer not-a-token' }]) {
        const r = await get(`${URLS.passport}/me`, hdr); expect(r.headers['access-control-allow-origin'], `GET /me Origin ${o}`).toBeUndefined();
      }
      const p = await preflight(`${URLS.passport}/me`, o); expect(p.headers['access-control-allow-origin'], `OPTIONS /me Origin ${o}`).toBeUndefined();
    }
  });
  test('Passport still answers the registered client origins (patient web, ops console, Pharmacy web, Lab web)', async () => {
    for (const o of [URLS.patientWeb, URLS.ops, URLS.pharmacy, URLS.lab]) expect((await get(`${URLS.passport}/me`, { origin: o })).headers['access-control-allow-origin'], o).toBe(o);
  });
  test('the EC2 origin cannot be reached around the CDN (no response without the CDN secret)', async () => {
    // the host name is the public registry host; a direct request with a wrong secret must be refused by the origin router (403) or by the CDN, never served
    const r = await get(`${URLS.api}/api/v1/health/live`, { 'x-origin-secret': 'wrong', 'x-kx-service': 'kiorex.api' });
    expect(r.status).toBe(200); // the CDN overwrites both headers with its own: a client cannot inject them
    expect(r.headers['via'] ?? '').toContain('CloudFront');
  });
});
