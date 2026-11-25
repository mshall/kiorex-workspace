import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { tokens } from '../src/fixtures.js';
import { KIOREX_API, KIORLY, KIORLY_API, PHARMACY, PHARMACY_API, LAB, LAB_API } from '../src/env.js';
import { probe } from '../src/http.js';

/**
 * EDGE 49: contract-driven robustness sweep of the Kiorex API. Every documented GET and POST is called with the patient and the ops token and with hostile
 * path ids, query values and bodies; the rule is "never a 5xx". The sweep reads the exported OpenAPI document, so a new endpoint is covered automatically.
 */
const spec = JSON.parse(readFileSync(new URL('../../kiorex-platform/apps/api/openapi/kiorex-api.v1.openapi.json', import.meta.url), 'utf8')) as { paths: Record<string, Record<string, any>> };
let t: Awaited<ReturnType<typeof tokens>>;
beforeAll(async () => { t = await tokens(); });
// not exercised: destructive account deletion, pay/webhook receivers that need provider signatures (covered by 40/44), the long-lived stream endpoints and anything that logs the user out
const SKIP = [/\/auth\/backchannel-logout/, /\/me\/account(\b|\/)/, /\/me\/sessions/, /\/stream/, /\/events$/, /\/webhooks\//, /\/dev\//, /fake-checkout/, /\/admin\/onboarding/, /\/admin\/flags\/.*\/(emergency|kill)/, /\/admin\/providers\/sync/];
const hostileId = ['%00', '..%2f..%2fetc', 'x'.repeat(2000), "' OR 1=1 --", '🙂', '-1', '0', 'null', 'undefined', '00000000-0000-0000-0000-000000000000'];
const hostileQuery = ['page=-1', 'page=abc&pageSize=abc', 'pageSize=100000', 'q=%00', 'from=garbage&to=worse', 'limit=-5', 'sort=;drop', 'status=%00', 'ids[]=1&ids[]=2', `q=${'x'.repeat(9_000)}`]; // 9 kB stays below Node's 16 kB header limit, so the application sees it; a 20 kB query is answered 431 by the HTTP server itself and closes the connection (churn), it is checked once per API below
const hostileBody: unknown[] = [{}, [], null, 'str', 7, { nameEn: 'a\u0000b' }, { amountMinor: -1 }, { amountMinor: 1e30 }, { id: { $ne: 1 } }, { a: { b: { c: { d: { e: { f: {} } } } } } }, JSON.parse('{"__proto__":{"admin":true}}')];
const call = async (token: string | undefined, method: string, path: string, body?: unknown) => {
  return (await probe(`${KIOREX_API}${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })).status;
};

describe('Z. Never a 5xx', () => {
  const eps = Object.entries(spec.paths).flatMap(([p, ops]) => Object.keys(ops).filter((m) => ['get', 'post', 'put', 'patch'].includes(m)).map((m) => ({ path: p.replace(/^\/api\/v1/, ''), method: m.toUpperCase() }))).filter((e) => !SKIP.some((s) => s.test(e.path)));
  it(`Z1 ${eps.length} documented operations x {patient, ops, anonymous} x hostile ids, queries and bodies answer without a 5xx`, async () => {
    const offenders: string[] = [];
    for (const e of eps) {
      const fill = (v: string) => e.path.replace(/\{[^}]+\}/g, v);
      const variants: Array<[string, string, unknown]> = [];
      for (const id of hostileId.slice(0, 5)) variants.push([fill(id), e.method, e.method === 'GET' ? undefined : {}]);
      if (e.method === 'GET') for (const qs of hostileQuery) variants.push([`${fill('x')}?${qs}`, 'GET', undefined]);
      else for (const b of hostileBody) variants.push([fill('x'), e.method, b]);
      for (const [path, method, body] of variants) for (const tok of [t.p1, t.ops, undefined]) {
        const st = await call(tok, method, path, body);
        if (st >= 500 || st === -1) offenders.push(`${st} ${method} ${path.slice(0, 80)} (${tok === t.p1 ? 'patient' : tok === t.ops ? 'ops' : 'anon'})${body !== undefined ? ' body=' + JSON.stringify(body)?.slice(0, 40) : ''}`);
      }
    }
    const unique = [...new Set(offenders.map((o) => o.replace(/ \((patient|ops|anon)\).*/, '')))];
    expect(unique.slice(0, 40), `5xx responses (${unique.length}); first 40`).toEqual([]);
  }, 900_000);
});

/**
 * The same sweep for the three provider SaaS APIs, from the live /docs-json of each running service. Staff tokens of the demo tenants; every id is a made-up one, every body
 * hostile, so nothing real is touched. Endpoints that end a session, change credentials or restore/purge data are skipped.
 */
const DANGEROUS = [/logout/i, /password/i, /sessions/i, /backup/i, /restore/i, /purge/i, /wipe/i, /seed/i, /reset/i, /\/auth\//i, /impersonat/i, /\/delete/i, /signout/i, /revoke/i, /\/me\/(account|devices)/i, /\/dev\//i, /webhook/i, /\/marketplace\/v1\//i, /\/integration\//i, /stream/i];
async function sweep(name: string, base: string, token: string) {
  const doc = (await (await fetch(`${base}/docs-json`)).json()) as { paths: Record<string, Record<string, any>> };
  const ops = Object.entries(doc.paths).flatMap(([p, o]) => Object.keys(o).filter((m) => ['get', 'post', 'put', 'patch'].includes(m)).map((m) => ({ path: p, method: m.toUpperCase() }))).filter((e) => !DANGEROUS.some((d) => d.test(e.path)));
  const offenders: string[] = []; let lastError = '';
  const hit = async (tok: string | undefined, method: string, path: string, body?: unknown) => {
    const r = await probe(`${base}${path}`, { method, headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (r.error) lastError = r.error;
    return r.status;
  };
  for (const e of ops) {
    const fill = (v: string) => e.path.replace(/\{[^}]+\}/g, v);
    const variants: Array<[string, unknown]> = [];
    for (const id of hostileId.slice(0, 4)) variants.push([fill(id), e.method === 'GET' ? undefined : {}]);
    if (e.method === 'GET') for (const qs of hostileQuery) variants.push([`${fill('x')}?${qs}`, undefined]); else for (const b of hostileBody) variants.push([fill('x'), b]);
    for (const [path, body] of variants) for (const tok of [token, undefined]) {
      const st = await hit(tok, e.method, path, body);
      if (st >= 500 || st === -1) offenders.push(`${st}${st === -1 ? ` [${lastError}]` : ''} ${e.method} ${path.slice(0, 90)}${body !== undefined ? ' body=' + JSON.stringify(body)?.slice(0, 40) : ''}`);
    }
  }
  if (process.env.EDGE_FUZZ_DUMP) (await import('node:fs')).writeFileSync(`${process.env.EDGE_FUZZ_DUMP}.${name}.txt`, [...new Set(offenders)].join('\n'));
  return { count: ops.length, offenders: [...new Set(offenders)] };
}

describe('Z2. Never a 5xx on the provider SaaS APIs', () => {
  it('Z2a Kiorly Clinic', async () => { const { staffLogin } = await import('../src/clients.js'); const r = await sweep('clinic', KIORLY, await staffLogin('owner.na@demo.kiorex.test', 'Demo@12345')); expect(r.offenders.slice(0, 40), `${r.count} operations; ${r.offenders.length} offenders`).toEqual([]); }, 900_000);
  it('Z2b Kiorly Pharmacy', async () => { const { pharmacyStaff } = await import('../src/verticals.js'); const r = await sweep('pharmacy', PHARMACY, await pharmacyStaff('owner')); expect(r.offenders.slice(0, 40), `${r.count} operations; ${r.offenders.length} offenders`).toEqual([]); }, 900_000);
  it('Z2c Kiorly Lab', async () => { const { labStaff } = await import('../src/verticals.js'); const r = await sweep('lab', LAB, await labStaff('owner')); expect(r.offenders.slice(0, 40), `${r.count} operations; ${r.offenders.length} offenders`).toEqual([]); }, 900_000);
});

describe('Z3. Oversized request lines never take a service down', () => {
  it('a 20 kB query string is refused by the HTTP layer (4xx, normally 431) on all four APIs, and the next request on a fresh connection still works', async () => {
    for (const [name, base, ready] of [['kiorex', KIOREX_API, '/health/ready'], ['clinic', KIORLY_API, '/health/ready'], ['pharmacy', PHARMACY_API, '/health/ready'], ['lab', LAB_API, '/health/ready']] as const) {
      const big = await probe(`${base}/health/live?q=${'x'.repeat(20_000)}`);
      expect(big.status, `${name}: ${big.error ?? ''}`).toBeGreaterThanOrEqual(400);
      expect(big.status, name).toBeLessThan(500); // 431 or 414, never a 5xx
      const ok = await probe(`${base}${ready}`);
      expect(ok.status, `${name} after the oversized request`).toBe(200);
    }
  });
});
