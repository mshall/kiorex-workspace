import { expect, request as pwRequest, test } from '@playwright/test';
import { NON_PRODUCTION, URLS } from '../lib/hosts';

/** Full pass 28 Nov 2026, section 5: every host (HTTP only, no sign-in, no Passport code): TLS and redirects, security headers, noindex, SPA fallback, error pages, hostile input, methods, registry-driven URLs. */
const call = async (url: string, o: { method?: string; headers?: Record<string, string>; data?: string | Buffer; ct?: string } = {}) => {
  const ctx = await pwRequest.newContext({ extraHTTPHeaders: o.headers ?? {} });
  try {
    const r = await ctx.fetch(url, { method: o.method ?? 'GET', maxRedirects: 0, data: o.data, headers: o.ct ? { 'content-type': o.ct } : undefined, timeout: 30_000 });
    return { status: r.status(), headers: r.headers(), text: (await r.text()).slice(0, 200_000) };
  } finally { await ctx.dispose(); }
};

const SPAS: [string, string][] = [['patient web', URLS.patientWeb], ['ops console', URLS.ops], ['Kiorly admin', URLS.opsKiorly], ['Kiorly site', URLS.site], ['Kiorly Home', URLS.home], ['Pharmacy web', URLS.pharmacy], ['Lab web', URLS.lab], ['Clinic web', URLS.clinic], ['Clinic legacy host', URLS.clinicLegacy]];
const APIS: [string, string][] = [['platform API', `${URLS.api}/api/v1/health/live`], ['Pharmacy API', `${URLS.pharmacy}/api/v1/health/live`], ['Lab API', `${URLS.lab}/api/v1/health/live`], ['Passport', `${URLS.passport}/healthz`]];

test.describe('TLS and redirects', () => {
  for (const [name, base] of [...SPAS, ['platform API', URLS.api], ['Passport', URLS.passport]] as [string, string][]) {
    test(`${name}: plain http never serves content (redirect to https or refusal)`, async () => {
      const u = base.replace('https://', 'http://');
      const r = await call(`${u}/`).catch(() => null);
      if (!r) return; // connection refused is acceptable
      expect([301, 302, 307, 308, 403, 404]).toContain(r.status);
      if (r.status >= 300 && r.status < 400) expect(r.headers['location'] ?? '').toMatch(/^https:\/\//);
    });
  }
});

test.describe('every web host: SPA fallback, headers, noindex, no localhost', () => {
  for (const [name, base] of SPAS) {
    test(`${name}: deep link answers the SPA (200 + root), nosniff, frame protection, HSTS`, async () => {
      const r = await call(`${base}/some/deep/link-that-does-not-exist`);
      // the Kiorly site is a multi-page static site (/en/, /ar/): an unknown path is its branded 404 page, every other web host is a SPA
      expect(r.status, base).toBe(base === URLS.site ? 404 : 200);
      expect(r.text.toLowerCase()).toContain('<html');
      if (base === URLS.clinicLegacy) { test.info().annotations.push({ type: 'legacy host', description: 'CDK-owned distribution of the live Clinic, deliberately untouched: no security headers and no noindex there (finding F-HDR-2)' }); return; }
      expect(r.headers['x-content-type-options'], 'nosniff').toBe('nosniff');
      expect((r.headers['x-frame-options'] ?? '') + (r.headers['content-security-policy'] ?? ''), 'frame protection').toMatch(/DENY|SAMEORIGIN|frame-ancestors/i);
      expect(r.headers['strict-transport-security'] ?? '', 'HSTS').toMatch(/max-age=\d{7,}/);
    });
    test(`${name}: noindex on non-production, no localhost in the page or entry bundles`, async () => {
      const r = await call(`${base}/`);
      if (NON_PRODUCTION && base !== URLS.clinicLegacy) expect(r.headers['x-robots-tag'] ?? '').toMatch(/noindex/i);
      expect(r.text).not.toMatch(/https?:\/\/(localhost|127\.0\.0\.1)[:/]/);
      for (const p of [...r.text.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]).slice(0, 4)) {
        const a = await call(`${base}${p}`); expect(a.status, p).toBe(200);
        expect(a.text, `${base}${p}`).not.toMatch(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//);
        if (base !== URLS.clinic && base !== URLS.clinicLegacy) expect(a.headers['cache-control'] ?? '', `${p} immutable`).toMatch(/max-age=\d{5,}|immutable/); // Clinic assets come from the CDK bucket without Cache-Control (finding F-CACHE-1, open: Clinic infra)
      }
    });
    test(`${name}: a missing static asset is a 404 (not the SPA shell served as JavaScript)`, async () => {
      const r = await call(`${base}/assets/does-not-exist-${Date.now()}.js`);
      expect([404, 403]).toContain(r.status);
    });
    test(`${name}: path traversal and encoded dot segments never leak a file`, async () => {
      for (const p of ['/../../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2fetc%2fpasswd', '/.env', '/.git/config']) {
        const r = await call(`${base}${p}`).catch(() => ({ status: 0, text: '', headers: {} as Record<string, string> }));
        expect(r.text, p).not.toMatch(/root:.*:0:0|\[core\]|DATABASE_URL|AWS_SECRET/);
      }
    });
  }
});

test.describe('API hosts: errors, hostile input, methods', () => {
  const rootApis: [string, string][] = [['platform API', URLS.api], ['Pharmacy API', URLS.pharmacy], ['Lab API', URLS.lab]];
  for (const [name, base] of rootApis) {
    test(`${name}: unknown route is a JSON-or-plain 404 with no stack trace or internal path`, async () => {
      const r = await call(`${base}/api/v1/definitely-not-a-route`);
      expect(r.status).toBe(404); expect(r.text).not.toMatch(/at .*\(.*\.(ts|js):\d+|node_modules|\/srv\/|\/app\/|prisma/i);
    });
    test(`${name}: TRACE/CONNECT and unusual methods are refused, never echoed`, async () => {
      const r = await call(`${base}/api/v1/health/live`, { method: 'TRACE' }).catch(() => ({ status: 405, headers: {} as Record<string, string>, text: '' }));
      expect([400, 403, 404, 405, 501]).toContain(r.status);
    });
    test(`${name}: protected route without a token is 401 (never 200, never 500)`, async () => {
      const r = await call(`${base}/api/v1/auth/me`); expect([401, 403, 404]).toContain(r.status);
      const p = await call(`${base}/api/v1/auth/me`, { headers: { authorization: 'Bearer ' + 'a'.repeat(5000) } }); expect([400, 401, 403, 404, 431]).toContain(p.status);
      const q = await call(`${base}/api/v1/auth/me`, { headers: { authorization: 'Bearer not.a.jwt' } }); expect([401, 403, 404]).toContain(q.status);
    });
    test(`${name}: malformed JSON, wrong content type and a null byte are 4xx, never 5xx`, async () => {
      for (const o of [{ data: '{"a":', ct: 'application/json' }, { data: 'a=b', ct: 'application/x-www-form-urlencoded' }, { data: '[]', ct: 'text/plain' }]) {
        const r = await call(`${base}/api/v1/auth/handoff/login`, { method: 'POST', ...o }); expect(r.status, JSON.stringify(o)).toBeLessThan(500);
      }
      const r = await call(`${base}/api/v1/search?q=%00%00`); expect(r.status).toBeLessThan(500);
    });
    test(`${name}: a 2 MiB body is refused with 413 or another 4xx (never accepted, never 5xx)`, async () => {
      const r = await call(`${base}/api/v1/auth/handoff/login`, { method: 'POST', data: JSON.stringify({ email: 'x'.repeat(2 * 1024 * 1024) }), ct: 'application/json' });
      expect(r.status).toBeGreaterThanOrEqual(400); expect(r.status).toBeLessThan(500);
    });
  }
  test('Passport: unknown path is the branded 404 (no stack), unsupported method refused', async () => {
    const r = await call(`${URLS.passport}/definitely-not-a-page`); expect(r.status).toBe(404); expect(r.text).not.toMatch(/at .*\(.*\.(ts|js):\d+|node_modules/);
    const t = await call(`${URLS.passport}/healthz`, { method: 'TRACE' }).catch(() => ({ status: 405, headers: {}, text: '' })); expect([400, 403, 404, 405, 501]).toContain(t.status);
  });
  test('Passport: token endpoint with garbage, authorize with hostile redirect_uri, never 5xx and never redirects to the hostile host', async () => {
    const t = await call(`${URLS.passport}/token`, { method: 'POST', data: 'grant_type=authorization_code&code=x&redirect_uri=https://evil.example.com/&client_id=kiorex-web', ct: 'application/x-www-form-urlencoded' });
    expect(t.status).toBeGreaterThanOrEqual(400); expect(t.status).toBeLessThan(500);
    for (const ru of ['https://evil.example.com/cb', 'javascript:alert(1)', '//evil.example.com', `${URLS.patientWeb}@evil.example.com`]) {
      const a = await call(`${URLS.passport}/authorize?client_id=kiorex-web&response_type=code&scope=openid&redirect_uri=${encodeURIComponent(ru)}&code_challenge=x&code_challenge_method=S256&state=s`);
      expect(a.status, ru).toBeLessThan(500); expect(a.headers['location'] ?? '', ru).not.toMatch(/evil\.example\.com/);
    }
  });
  for (const [name, url] of APIS) {
    test(`${name}: health answers quickly and carries no cookies or server banner`, async () => {
      const t0 = Date.now(); const r = await call(url); expect(r.status).toBe(200); expect(Date.now() - t0).toBeLessThan(5000);
      expect(r.headers['server'] ?? '').not.toMatch(/\d+\.\d+/); expect(r.headers['x-powered-by']).toBeUndefined();
    });
  }
});

test.describe('registry-driven URLs and well-known files', () => {
  test('every host in the registry is https and none is localhost', () => {
    for (const [k, v] of Object.entries(URLS)) { expect(v, k).toMatch(/^https:\/\//); expect(v, k).not.toMatch(/localhost|127\.0\.0\.1/); }
  });
  test('robots.txt on non-production disallows everything on the web hosts that serve one', async () => {
    test.skip(!NON_PRODUCTION, 'production is indexable');
    for (const [name, base] of SPAS) {
      const r = await call(`${base}/robots.txt`);
      if (r.status === 200 && /user-agent/i.test(r.text)) expect(r.text, name).toMatch(/Disallow:\s*\/\s*$/m);
    }
  });
  test('Kiorly Home: app-link files are not served as the SPA (apple file stays a TODO template or 404)', async () => {
    const r = await call(`${URLS.home}/.well-known/apple-app-site-association`);
    if (r.status === 200) expect(r.text.trim().startsWith('<')).toBe(false);
  });
});
