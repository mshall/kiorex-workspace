import { expect, request as pwRequest, test } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { ssm } from '../lib/aws';
import { URLS } from '../lib/hosts';

/**
 * Signed partner routes. The partner client secrets are NOT available to this suite (and must not be): the platform holds them encrypted.
 *  - negative cases are plain HTTP against the public Pharmacy and Lab hosts: no signature, a forged signature and a replayed old timestamp are refused with the uniform 401;
 *  - the positive case runs the PLATFORM's own signing code inside its container over SSM (read-only GETs of the catalogue / test list), so the registered credentials, the signature scheme and the public routing (CloudFront, Caddy, /marketplace and /api/v1/integration paths) are exercised end to end without any secret leaving the host.
 */
const PHARMACY_PATH = '/marketplace/v1/pharmacies';
const LAB_PATH = '/api/v1/integration/v1/tests';
const H = { key: 'x-kiorly-client-key', ts: 'x-kiorly-timestamp', nonce: 'x-kiorly-nonce', sig: 'x-kiorly-signature' };

const call = async (url: string, headers: Record<string, string> = {}) => { const c = await pwRequest.newContext(); try { const r = await c.get(url, { headers, maxRedirects: 0 }); return { status: r.status(), body: await r.text() }; } finally { await c.dispose(); } };
const forged = (path: string, ts = Date.now()) => {
  const nonce = randomUUID(); const canonical = `${ts}\n${nonce}\nGET\n${path}\n`;
  return { [H.key]: 'kx_test_pharmacy', [H.ts]: String(ts), [H.nonce]: nonce, [H.sig]: createHmac('sha256', 'not-the-secret').update(canonical).digest('hex') };
};

for (const [name, base, path] of [['Pharmacy', URLS.pharmacy, PHARMACY_PATH], ['Lab', URLS.lab, LAB_PATH]] as const) {
  test.describe(`${name} partner route (negative)`, () => {
    test('no signature: uniform 401', async () => { const r = await call(`${base}${path}`); expect(r.status).toBe(401); });
    test('forged signature: 401 and the body never echoes a secret or the canonical string', async () => {
      const r = await call(`${base}${path}`, forged(path)); expect(r.status).toBe(401);
      expect(r.body).not.toMatch(/secret|canonical/i); // note: the Pharmacy names the reason (bad_signature), the Lab does not; low severity, see the report
    });
    test('stale timestamp (replay window): 401', async () => { expect((await call(`${base}${path}`, forged(path, Date.now() - 3_600_000))).status).toBe(401); });
    test('the public routing sends only the partner paths to the API, everything else is the web app', async () => {
      const spa = await call(`${base}/some/ui/route`); expect(spa.status).toBe(200); expect(spa.body).toContain('<div id="root"');
    });
  });
}

// The probe runs inside the platform container: dist/ is the compiled API. Output is status and counts only.
const PROBE = `
const { createPrismaClient } = require('./dist/prisma/client-factory');
const { PartnerRegistry } = require('./dist/partners/partners.service');
const { partnerRequest } = require('./dist/common/partner-http');
(async () => {
  const prisma = createPrismaClient(); const reg = new PartnerRegistry(prisma); const out = {};
  for (const [kind, path, key] of [['PHARMACY', '/pharmacies', 'pharmacies'], ['PHARMACY', '/catalogue', 'catalogue'], ['LAB', '/tests', 'tests']]) {
    try { const c = await reg.conn(kind); const r = await partnerRequest(c, { method: 'GET', path }); out[key] = { status: r.status, items: (r.data.items || []).length, host: new URL(c.baseUrl).host }; }
    catch (e) { out[key] = { error: String(e.message).slice(0, 80), status: e.status }; }
  }
  console.log('PROBE ' + JSON.stringify(out)); await prisma.$disconnect(); process.exit(0);
})();`;

test.describe('platform to partners (positive, signed by the platform with the registered credentials)', () => {
  let out: Record<string, { status?: number; items?: number; host?: string; error?: string }> = {};
  test.beforeAll(() => {
    const b64 = Buffer.from(PROBE).toString('base64');
    const raw = ssm(`echo ${b64} | base64 -d > /tmp/kx-e2e-probe.js && docker cp /tmp/kx-e2e-probe.js kx-test-platform-api-1:/repo/apps/api/kx-e2e-probe.js && docker exec -w /repo/apps/api kx-test-platform-api-1 node kx-e2e-probe.js 2>&1 | grep '^PROBE ' ; docker exec kx-test-platform-api-1 rm -f /repo/apps/api/kx-e2e-probe.js; rm -f /tmp/kx-e2e-probe.js`);
    out = JSON.parse(raw.replace(/^[\s\S]*PROBE /, ''));
  });
  test('platform to Pharmacy GET /pharmacies: 200 through the public host with at least one pharmacy', () => { expect(out.pharmacies.status, JSON.stringify(out.pharmacies)).toBe(200); expect(out.pharmacies.items).toBeGreaterThan(0); expect(out.pharmacies.host).toBe(new URL(URLS.pharmacy).host); });
  test('platform to Pharmacy GET /catalogue: 200 with catalogue items', () => { expect(out.catalogue.status, JSON.stringify(out.catalogue)).toBe(200); expect(out.catalogue.items).toBeGreaterThan(10); });
  test('platform to Lab GET /tests: 200 with tests through the public host', () => { expect(out.tests.status, JSON.stringify(out.tests)).toBe(200); expect(out.tests.items).toBeGreaterThan(10); expect(out.tests.host).toBe(new URL(URLS.lab).host); });
});
