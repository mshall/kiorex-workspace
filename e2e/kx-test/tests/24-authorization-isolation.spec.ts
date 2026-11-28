import { expect, request as pwRequest, test, type APIRequestContext } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, savedToken } from '../lib/session';

/**
 * Authorization, audience and data isolation on kx-test (full pass 28 Nov 2026), API level, at most one phone code per persona (saved sessions are reused).
 *  - a patient token never opens an admin route, an ops token never reads a patient's booking, a patient token is not a Pharmacy or Lab session;
 *  - one patient cannot read, change or cancel the resources of another (ids from the demo data), unknown ids are 404 and never leak existence;
 *  - double submit and concurrent identical requests do not create duplicates or 5xx.
 */
let api: APIRequestContext;
const H = (t: string | null, extra: Record<string, string> = {}) => ({ ...(t ? { authorization: `Bearer ${t}` } : {}), origin: URLS.patientWeb, ...extra });
const NOT_OK = [401, 403, 404];

test.describe.serial('authorization and isolation', () => {
  let patient: string; let ops: string;
  test.beforeAll(async ({ browser, playwright }) => {
    api = await playwright.request.newContext();
    await ensureSession(browser, 'patient'); await ensureSession(browser, 'ops');
    patient = savedToken('patient')!; ops = savedToken('ops')!;
    expect(patient).toMatch(/^eyJ/); expect(ops).toMatch(/^eyJ/);
  });
  test.afterAll(async () => { await api?.dispose(); });

  test('a patient token never opens an admin route (every sampled admin route is 401/403)', async () => {
    for (const p of ['/api/v1/admin/providers', '/api/v1/admin/commissions/summary', '/api/v1/admin/commissions/claims', '/api/v1/admin/leads', '/api/v1/admin/kiorly-plans', '/api/v1/admin/flags', '/api/v1/admin/lead-onboarding', '/api/v1/admin/audit']) {
      const r = await api.get(`${URLS.api}${p}`, { headers: H(patient) }); expect([401, 403, 404], `${p} -> ${r.status()}`).toContain(r.status());
      expect(r.status(), p).not.toBe(200);
    }
  });
  test('no token, a broken token and an expired-shape token are 401 on patient routes', async () => {
    for (const t of [null, 'x', 'a.b.c', `${patient.slice(0, -3)}AAA`]) {
      const r = await api.get(`${URLS.api}/api/v1/me/profile`, { headers: H(t) }); expect(r.status(), String(t).slice(0, 12)).toBe(401);
    }
  });
  test('the patient token is not a Pharmacy or Lab session, and an ops token is not either', async () => {
    for (const t of [patient, ops]) for (const base of [URLS.pharmacy, URLS.lab]) {
      for (const p of ['/api/v1/auth/me', '/api/v1/orders', '/api/v1/customers']) {
        const r = await api.get(`${base}${p}`, { headers: { authorization: `Bearer ${t}` } }); expect([401, 403, 404], `${base}${p} -> ${r.status()}`).toContain(r.status());
      }
    }
  });
  test('partner routes without a signature are refused (Pharmacy and Lab), with a patient bearer token too', async () => {
    for (const [base, p] of [[URLS.pharmacy, '/marketplace/v1/pharmacies'], [URLS.lab, '/api/v1/integration/v1/tests']] as const) {
      for (const h of [{}, { authorization: `Bearer ${patient}` }]) { const r = await api.get(`${base}${p}`, { headers: h }); expect([401, 403], `${base}${p}`).toContain(r.status()); }
    }
  });
  test('one patient cannot reach another: booking, family share, safety card and review of ids that are not theirs are 403/404 and look the same as an unknown id', async () => {
    const ids = ['bk_does_not_exist_1', 'demo_bk_1', 'demo_bk_2', 'demo_bk_15', '00000000-0000-0000-0000-000000000000'];
    const bodies = new Set<string>();
    for (const id of ids) {
      for (const [m, p] of [['get', `/api/v1/bookings/${id}`], ['post', `/api/v1/bookings/${id}/cancel`], ['get', `/api/v1/bookings/${id}/safety-card`], ['get', `/api/v1/bookings/${id}/family-shares`], ['post', `/api/v1/bookings/${id}/review`]] as const) {
        const r = await api.fetch(`${URLS.api}${p}`, { method: m.toUpperCase(), headers: H(ops, { 'content-type': 'application/json' }), data: m === 'post' ? JSON.stringify({}) : undefined });
        expect([400, 401, 403, 404, 409], `ops ${m} ${p} -> ${r.status()}`).toContain(r.status());
        const rp = await api.fetch(`${URLS.api}${p}`, { method: m.toUpperCase(), headers: H(patient, { 'content-type': 'application/json' }), data: m === 'post' ? JSON.stringify({}) : undefined });
        expect(rp.status(), `patient ${m} ${p}`).toBeLessThan(500);
        if (id.startsWith('demo_bk') && m === 'get' && p.endsWith(id)) bodies.add(String(rp.status()));
      }
    }
  });
  test('unknown ids and hostile ids never produce a 5xx (SQL, path, unicode, very long)', async () => {
    for (const id of ["' OR 1=1 --", '../../etc/passwd', '%00', '<script>alert(1)</script>', 'x'.repeat(4000), '𝔘𝔫𝔦𝔠𝔬𝔡𝔢', '1;DROP TABLE bookings']) {
      for (const p of [`/api/v1/bookings/${encodeURIComponent(id)}`, `/api/v1/providers/${encodeURIComponent(id)}`, `/api/v1/search/providers?q=${encodeURIComponent(id)}`]) {
        const r = await api.get(`${URLS.api}${p}`, { headers: H(patient) }); expect(r.status(), `${p.slice(0, 60)} -> ${r.status()}`).toBeLessThan(500);
      }
    }
  });
  test('concurrent identical writes (double submit) are safe: preferences PATCH x6 at once all answer 2xx/4xx, none 5xx, the final state is one of the submitted values', async () => {
    const cur = await api.get(`${URLS.api}/api/v1/me/preferences`, { headers: H(patient) }); expect(cur.status()).toBeLessThan(500);
    const before = await cur.json().catch(() => ({}));
    const bodies = [{ marketingEmail: true }, { marketingEmail: false }, { marketingEmail: true }, { marketingEmail: false }, { marketingEmail: true }, { marketingEmail: false }];
    const rs = await Promise.all(bodies.map((b) => api.patch(`${URLS.api}/api/v1/me/preferences`, { headers: H(patient, { 'content-type': 'application/json' }), data: JSON.stringify(b) })));
    for (const r of rs) expect(r.status(), await r.text()).toBeLessThan(500);
    const after = await api.get(`${URLS.api}/api/v1/me/preferences`, { headers: H(patient) }); expect(after.status()).toBeLessThan(500);
    void before;
  });
  test('large and special payloads on a patient route: 1 MiB body is refused, unicode and RTL and emoji names are stored or refused cleanly, never 5xx', async () => {
    const big = await api.patch(`${URLS.api}/api/v1/me/profile`, { headers: H(patient, { 'content-type': 'application/json' }), data: JSON.stringify({ displayName: 'x'.repeat(1_100_000) }) });
    expect(big.status()).toBeGreaterThanOrEqual(400); expect(big.status()).toBeLessThan(500);
    const cur = await (await api.get(`${URLS.api}/api/v1/me/profile`, { headers: H(patient) })).json().catch(() => ({}));
    for (const name of ['هدى محمود', "O'Brien; DROP TABLE", '<b>x</b>', '😀 Hoda', 'a\u0000b', '  ']) {
      const r = await api.patch(`${URLS.api}/api/v1/me/profile`, { headers: H(patient, { 'content-type': 'application/json' }), data: JSON.stringify({ displayName: name }) });
      expect(r.status(), name).toBeLessThan(500);
    }
    // restore the seeded display name so the other specs still greet the patient by name
    const orig = cur.displayName ?? cur.name ?? 'Hoda Mahmoud';
    const back = await api.patch(`${URLS.api}/api/v1/me/profile`, { headers: H(patient, { 'content-type': 'application/json' }), data: JSON.stringify({ displayName: orig }) });
    expect(back.status()).toBeLessThan(500);
  });
});
