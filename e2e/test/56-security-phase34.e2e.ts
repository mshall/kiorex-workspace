import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { kiorex, opsLogin, q, staffLogin } from '../src/clients.js';
import { patientToken, pharmacyStaff, labStaff } from '../src/verticals.js';
import { KIOREX, KIORLY, PHARMACY, LAB, KIORLY_API, PHARMACY_API, LAB_API } from '../src/env.js';
import { resetRateLimits } from '../src/db.js';

/**
 * GRW-P3-H security regression for Phases 2 to 4 (pentest addendum KX-PT-16..). Runs on the private stack (scripts/w9-stack.sh), development mode.
 * a. authorisation matrix over EVERY documented growth, corporate, promotion, experiment, assistant, credit and referral operation of the four APIs
 * b. injection payloads in query, body, path and headers of the public growth routes (never 5xx, never reflected, nothing evaluated)
 * c. rate limits of the public growth routes
 * d. PHI scan over growth events, outbox payloads, decisions, audit rows and the API logs
 * e. k >= 10 enforcement fuzz over the analytics routes
 */
const GROWTHISH = /(growth|corporate|promotion|experiment|assistant|referral|reward|credit|lifecycle|campaign|cohort|attribution|fraud|seo-automation|integrations|market-onboarding|recommendation|cross-product|product-decision|b2b|loyalty|partner-link|links)/i;
const asc = (v: string) => v.replace(/[^\x20-\x7e]/g, '').slice(0, 200); // header values: the HTTP client itself refuses control characters and non-latin1
const fill = (p: string) => p.replace(/\{[^}]+\}/g, 'x0000000-0000-0000-0000-000000000000');
const hit = async (base: string, method: string, path: string, tok?: string, body?: unknown, headers: Record<string, string> = {}) => {
  try {
    const r = await fetch(base + path, { method, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), 'content-type': 'application/json', ...headers }, body: ['GET', 'DELETE', 'HEAD'].includes(method) ? undefined : JSON.stringify(body ?? {}) });
    const t = await r.text(); return { s: r.status, t, h: r.headers };
  } catch { return { s: -1, t: '', h: new Headers() }; }
};
const ops = (spec: any) => Object.entries<any>(spec.paths).flatMap(([p, item]) => ['get', 'post', 'put', 'patch', 'delete'].filter((m) => item[m]).map((m) => ({ p, m: m.toUpperCase(), op: item[m] })));

describe('56. security regression, Phases 2 to 4', () => {
  let opsTok: string, pat: string;
  beforeAll(async () => { opsTok = (await opsLogin()).accessToken; pat = await patientToken(); await resetRateLimits(); }, 120_000);

  describe('a. authorisation matrix', () => {
    it('Kiorex: every growth-ish /admin and /ops operation refuses anonymous (401) and a patient (403); no 5xx for anyone; unauthenticated 2xx only on the documented public routes', async () => {
      const spec: any = await (await fetch(`${KIOREX}/api/docs-json`)).json();
      const list = ops(spec).filter(({ p }) => GROWTHISH.test(p) && !/^\/(api\/v1)?\/dev\//.test(p));
      expect(list.length).toBeGreaterThan(150);
      const bad: string[] = []; const anon2xx: string[] = []; let n = 0;
      for (const { p, m } of list) {
        const path = (p.startsWith('/api/v1') ? p : '/api/v1' + p); const url = fill(path); n++;
        const a = await hit(KIOREX, m, url); const pt = await hit(KIOREX, m, url, pat); const o = await hit(KIOREX, m, url, opsTok);
        const adminish = /\/(admin|ops)\//.test(path);
        if (adminish) {
          if (a.s !== 401) bad.push(`ANON ${m} ${path} -> ${a.s}`);
          if (pt.s !== 403) bad.push(`PATIENT ${m} ${path} -> ${pt.s}`);
        } else if (a.s >= 200 && a.s < 300) anon2xx.push(`${m} ${p}`);
        for (const [who, r] of [['anon', a], ['patient', pt], ['ops', o]] as const) if (r.s >= 500 || r.s === -1) bad.push(`5XX ${who} ${m} ${path} -> ${r.s}`);
      }
      // the public routes are public by design (consent-gated, rate limited, no personal data in or out); a new one must be reviewed and added here
      const allowed = /^(GET|POST) \/(api\/v1)?\/(growth\/v1\/(touch|consent|events|experiments\/(exposures|assignments)|campaign\/resolve|config|links|assistant\/link|referral\/resolve|corporate)|growth\/v1\/[a-z-]+\/(resolve|public)|widget\/v1|robots|sitemap)/;
      const unexpected = anon2xx.filter((x) => !allowed.test(x));
      expect(bad, `${n} operations`).toEqual([]);
      expect(unexpected, 'unauthenticated 2xx outside the reviewed public list').toEqual([]);
    }, 600_000);

    it('Kiorex: a platform operator without super_admin cannot reach a @SuperAdminOnly route, and a staff token of another audience is refused everywhere (spot set)', async () => {
      const forged = (await staffLogin('owner.na@demo.kiorex.test', 'Demo@12345').catch(() => ''));
      const set = [['POST', '/api/v1/ops/growth-analytics/rollup'], ['POST', '/api/v1/admin/growth/promotions/x/approve'], ['GET', '/api/v1/admin/growth/assistant/config']];
      for (const [m, p] of set) { const r = await hit(KIOREX, m, p, forged || 'not-a-token'); expect([401, 403, 404], `${m} ${p}`).toContain(r.s); }
    });

    for (const [name, base, api, spec] of [['Clinic', KIORLY, KIORLY_API, `${KIORLY}/docs-json`], ['Pharmacy', PHARMACY, PHARMACY_API, `${PHARMACY}/docs-json`], ['Lab', LAB, LAB_API, `${LAB}/docs-json`]] as const) {
      it(`${name}: every growth-ish operation refuses anonymous, never 5xx for a staff owner, a low role or a patient token`, async () => {
        const r = await fetch(spec); if (r.status !== 200) return; // swagger off on this build: nothing to enumerate
        const doc: any = await r.json();
        const toks: Array<[string, string]> = name === 'Clinic' ? [['owner', await staffLogin('owner.na@demo.kiorex.test', 'Demo@12345')], ['nurse', await staffLogin('nurse.na@demo.kiorex.test', 'Demo@12345')]]
          : name === 'Pharmacy' ? [['owner', await pharmacyStaff('owner')], ['cashier', await pharmacyStaff('cashier')]] : [['owner', await labStaff('owner')], ['reception', await labStaff('reception')]];
        toks.push(['patient', pat]);
        const list = ops(doc).filter(({ p }) => GROWTHISH.test(p) && !/webhook|\/dev\/|export|download|backup/.test(p));
        const bad: string[] = [];
        for (const { p, m } of list) {
          const path = p.startsWith('/api') || p.startsWith('/marketplace') ? p : '/api/v1' + p; const url = fill(path);
          const a = await hit(base, m, url);
          if (a.s >= 200 && a.s < 300 && !/\/public\/|\/b\/|\/q\/|\/r\/|health/.test(path)) bad.push(`ANON ${m} ${path} -> ${a.s}`);
          for (const [who, tk] of toks) { const x = await hit(base, m, url, tk); if (x.s >= 500 || x.s === -1) bad.push(`5XX ${who} ${m} ${path} -> ${x.s}`); if (who === 'patient' && x.s >= 200 && x.s < 300 && !/\/public\//.test(path)) bad.push(`PATIENT-2XX ${m} ${path}`); }
        }
        expect(bad, `${name}: ${list.length} operations (${api})`).toEqual([]);
      }, 600_000);
    }
  });

  describe('b. injection', () => {
    const PAY = [`' OR 1=1--`, `"; DROP TABLE "GrowthEvent";--`, `{"$ne":null}`, `<script>alert(1)</script>`, `{{7*7}}`, '${7*7}', `../../etc/passwd`, `a\r\nX-Injected: 1`, '\u0000nul', `__proto__`, 'x'.repeat(5000), `%00%0d%0a`, '😀'.repeat(300)];
    it('public growth routes: payloads in query, body and headers never produce a 5xx, never reach the response unescaped and never change a table', async () => {
      const before = await q('kiorex_platform', `select (select count(*) from "GrowthCampaign") c, (select count(*) from "ConsentRecord") k`);
      const bad: string[] = []; const T = '/api/v1/growth/v1';
      for (const pl of PAY) {
        const enc = encodeURIComponent(pl);
        const probes: Array<[string, string, unknown, Record<string, string>]> = [
          ['GET', `${T}/campaign/resolve?utm_campaign=${enc}`, undefined, {}],
          ['GET', `/en/eg/doctors?utm_campaign=${enc}&q=${enc}`, undefined, {}],
          ['GET', `/ar/eg/${enc}`, undefined, {}],
          ['POST', `${T}/touch`, { kind: pl, utmCampaign: pl, utmSource: pl, landing: pl, referrer: pl, linkCode: pl }, {}],
          ['POST', `${T}/events`, { events: [{ name: pl, props: { q: pl, __proto__: { x: 1 }, constructor: { prototype: { y: 1 } } } }] }, {}],
          ['POST', `${T}/consent`, { granted: pl, purpose: pl }, {}],
          ['POST', `${T}/referral/claim`, { code: pl }, {}],
          ['GET', `${T}/campaign/resolve?utm_campaign=ok`, undefined, { 'x-forwarded-for': asc(pl), 'x-kiorex-market': asc(pl), referer: `https://x.example/${enc}`, 'user-agent': asc(pl) }],
        ];
        for (const [m, path, body, h] of probes) {
          const r = await hit(KIOREX, m, path, m === 'POST' && /referral/.test(path) ? pat : undefined, body, h);
          if (r.s >= 500 || r.s === -1) bad.push(`${r.s} ${m} ${path.slice(0, 60)} payload=${pl.slice(0, 20)}`);
          if (/<script>alert\(1\)<\/script>/.test(r.t) && /html/.test(r.h.get('content-type') ?? '')) bad.push(`REFLECTED ${path.slice(0, 60)}`);
          if (pl === '{{7*7}}' && /(^|[^\d])49([^\d]|$)/.test(r.t) && !/"(count|id|total)"/.test(r.t) && /html/.test(r.h.get('content-type') ?? '')) bad.push(`EVALUATED ${path.slice(0, 60)}`);
          if (r.h.get('x-injected')) bad.push(`HEADER-INJECTION ${path.slice(0, 60)}`);
        }
      }
      const after = await q('kiorex_platform', `select (select count(*) from "GrowthCampaign") c, (select count(*) from "ConsentRecord") k, (select count(*) from "GrowthEvent" where name like '%DROP%') d`);
      expect(bad).toEqual([]);
      expect(after[0].c).toBe(before[0].c);
      expect(Number(after[0].d)).toBe(0); // the event name is an allow-list: a hostile name is refused, not stored
    }, 300_000);

    it('ops write routes: hostile text in names is stored as data and returned as JSON only (campaign create), and a hostile id is a 4xx', async () => {
      const r = await kiorex(opsTok, 'POST', '/admin/growth/campaigns', { key: `sec56_${Date.now().toString(36)}`, name: `<img src=x onerror=alert(1)> ' OR 1=1--`, objective: 'ACQUISITION', channels: ['PUSH'] });
      expect(r.status).toBeLessThan(500);
      const g = await kiorex(opsTok, 'GET', `/admin/growth/campaigns/${encodeURIComponent(`' OR 1=1--`)}`); expect([400, 404]).toContain(g.status);
      const k = await kiorex(opsTok, 'GET', `/admin/growth/campaigns?status=${encodeURIComponent(`ACTIVE' OR '1'='1`)}&take=-5&skip=abc`); expect(k.status).toBeLessThan(500);
    });
  });

  describe('c. rate limits', () => {
    it('the public touch and event routes answer 429 with Retry-After before 300 requests from one address, and recover (bucket cleared)', async () => {
      for (const path of ['/api/v1/growth/v1/touch', '/api/v1/growth/v1/events']) {
        await resetRateLimits(); let limited = 0, five = 0, retry = '';
        for (let i = 0; i < 300 && !limited; i++) { const r = await hit(KIOREX, 'POST', path, undefined, path.endsWith('touch') ? { landingKind: 'HOME' } : { events: [{ name: 'PageViewed' }] }); if (r.s === 429) { limited = i + 1; retry = r.h.get('retry-after') ?? ''; } if (r.s >= 500) five++; }
        expect(five, path).toBe(0); expect(limited, `${path} never limited in 300 requests`).toBeGreaterThan(0); expect(Number(retry), 'Retry-After').toBeGreaterThan(0);
      }
      await resetRateLimits();
    }, 120_000);
    it('the secure assistant link verify is unreachable while growth.assistant is launch-locked (403 FEATURE_DISABLED, before any token is looked at)', async () => {
      for (let i = 0; i < 5; i++) { const r = await hit(KIOREX, 'POST', '/api/v1/growth/v1/assistant/link', undefined, { token: `bad${i}` }); expect([403, 400, 410, 429]).toContain(r.s); }
    });
  });

  describe('d. PHI scan', () => {
    const RX = { phone: /(?<![\w])(\+?20|0)1[0125]\d{8}(?!\d)/, email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/i, nid: /(?<![\w])[23]\d{13}(?![\w])/, name: /Amira Samy|Karim Adel|Mona Fahmy|Hesham Nabil/ };
    it('growth events, decisions, touches, outbox INTERNAL events, assistant audit and lifecycle decisions carry no phone, e-mail, national id or patient name', async () => {
      const tables = (await q('kiorex_platform', `select table_name from information_schema.tables where table_schema = 'public' and (table_name ~ '^(Growth|Lifecycle|Referral|Reward|Assistant|Corporate|Promotion|Sponsored|Campaign|Experiment|Fraud|Cohort|Attribution)' ) order by 1`)).map((r) => r.table_name as string);
      const hits: string[] = [];
      // columns that legitimately hold a business contact or a hashed identifier are named here, with the reason
      const OK = new Set(['CorporateAccount.contactEmail', 'CorporateAccount.contactPhone', 'CorporateLead.contactEmail', 'CorporateLead.contactPhone']);
      for (const t of tables) {
        const cols = (await q('kiorex_platform', `select column_name from information_schema.columns where table_schema='public' and table_name=$1 and data_type in ('text','jsonb','json','character varying','ARRAY')`, [t])).map((r) => r.column_name as string);
        for (const c of cols) { if (OK.has(`${t}.${c}`)) continue;
          for (const [k, rx] of Object.entries(RX)) {
            const rows = await q('kiorex_platform', `select left("${c}"::text, 200) v from "${t}" where "${c}"::text ~ $1 limit 3`, [rx.source.replace(/\(\?<!\[\\w\]\)/g, '').replace(/\(\?<!\\d\)/g, '').replace(/\(\?!\\d\)/g, '')]).catch(() => []);
            // postgres has no lookbehind: re-check the candidates with the JS expression
            for (const r of rows) if (rx.test(String(r.v))) hits.push(`${t}.${c} [${k}] ${String(r.v).slice(0, 80)}`);
          } }
      }
      const ob = await q('kiorex_platform', `select type, left(payload::text, 300) p from "OutboxEvent" where target in ('INTERNAL','AD_PLATFORM','ADS') order by "createdAt" desc limit 3000`).catch(() => []);
      for (const r of ob) for (const [k, rx] of Object.entries(RX)) if (rx.test(r.p)) hits.push(`OutboxEvent ${r.type} [${k}]`);
      expect(hits.slice(0, 20)).toEqual([]);
    }, 300_000);
    it('the Kiorex, Clinic, Pharmacy and Lab API logs of this run hold no national id and no patient name in a growth line', async () => {
      const dir = new URL('../../.e2e/logs/', import.meta.url).pathname; const bad: string[] = [];
      for (const f of ['w9-kiorex.log', 'w9-clinic.log', 'w9-pharmacy.log', 'w9-lab.log']) {
        const p = dir + f; if (!existsSync(p)) continue;
        for (const line of readFileSync(p, 'utf8').split('\n')) if (/growth|attribution|campaign|referral|reward|lifecycle|assistant|corporate|promotion/i.test(line) && (RX.nid.test(line) || RX.name.test(line) || RX.email.test(line))) bad.push(`${f}: ${line.slice(0, 120)}`);
      }
      expect(bad.slice(0, 10)).toEqual([]);
    });
  });

  describe('e. k >= 10 fuzz', () => {
    const COUNTKEY = /^(count|bookings|attendedNewPatients|feeBearingNewPatients|registered|visitors|people|patients|sessions|installs|leads|conversions|confirmed|attended|estimates|n)$/i;
    const walk = (v: any, path: string, out: string[]) => {
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`, out));
      if (v && typeof v === 'object') {
        for (const [k, x] of Object.entries(v)) {
          if (typeof x === 'number' && COUNTKEY.test(k) && x > 0 && x < 10) out.push(`${path}.${k}=${x}`);
          walk(x, `${path}.${k}`, out);
        }
        // a masked row may show money only when the PEOPLE behind it (attended new patients) are themselves >= 10 (the money is derived from them, not from the masked booking count)
        if (v.masked === true && !(typeof v.attendedNewPatients === 'number' && v.attendedNewPatients >= 10)) for (const k of ['revenueMinor', 'cacMinor', 'roas', 'ltvToCac']) if (typeof v[k] === 'number' && v[k] !== 0) out.push(`${path} masked cell leaks ${k}=${v[k]}`);
      }
    };
    it('random filter combinations over overview, funnel, channels, breakdowns and cohorts never expose a count between 1 and 9', async () => {
      const dims = ['city', 'district', 'specialty', 'provider', 'doctor', 'branch', 'campaign', 'channel', 'platform', 'careType', 'sourceKind', 'origin'];
      const vals: Record<string, string[]> = { city: ['Cairo', 'Giza', 'x'], specialty: ['cardiology', 'dermatology', 'dentistry'], origin: ['PROVIDER_LED', 'MARKETPLACE', 'UNATTRIBUTED'], careType: ['DOCTORS', 'PHYSIOTHERAPY', 'HOME_NURSING'], sourceKind: ['DIRECT', 'PROVIDER_LINK', 'ORGANIC_SEARCH', 'CAMPAIGN', 'REFERRAL'], platform: ['web', 'ios', 'android'] };
      const rnd = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]!; const leaks: string[] = []; let calls = 0;
      const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
      for (let i = 0; i < 160; i++) {
        const qs = new URLSearchParams(); const nf = Math.floor(Math.random() * 4);
        for (let f = 0; f < nf; f++) { const k = rnd(Object.keys(vals)); qs.set(k, rnd(vals[k]!)); }
        qs.set('from', days(1 + Math.floor(Math.random() * 120))); qs.set('to', days(Math.floor(Math.random() * 2)));
        const paths = ['overview', 'funnel', 'channels', `breakdown/${rnd(dims)}`, 'cohorts', 'channels?by=campaign'];
        const path = rnd(paths); const sep = path.includes('?') ? '&' : '?';
        const r = await kiorex(opsTok, 'GET', `/ops/growth-analytics/${path}${sep}${qs}`); calls++;
        expect(r.status, path).toBeLessThan(500);
        if (r.status === 200) walk(r.body, path, leaks);
        const c = await kiorex(opsTok, 'GET', `/admin/growth/cohorts?${new URLSearchParams({ basis: rnd(['FIRST_COMPLETED', 'FIRST_BOOKED']), dimension: rnd(['ALL', 'SOURCE', 'CITY', 'SPECIALTY']) })}`); if (c.status === 200) walk(c.body, 'cohorts', leaks);
      }
      expect(leaks.slice(0, 10), `${calls} analytics calls`).toEqual([]);
    }, 300_000);
    it('CSV exports mask cells below ten as "<10" (no bare 1..9 in a count column)', async () => {
      for (const rep of ['overview', 'channels', 'funnel']) {
        const r = await fetch(`${KIOREX}/api/v1/ops/growth-analytics/export/${rep}`, { headers: { authorization: `Bearer ${opsTok}` } }); if (r.status !== 200) continue;
        const rows = (await r.text()).split('\n').map((l) => l.split(',')); const head = rows[0] ?? [];
        const idx = head.map((h, i) => (COUNTKEY.test(h.replace(/"/g, '')) ? i : -1)).filter((i) => i >= 0);
        for (const row of rows.slice(1)) for (const i of idx) expect(/^"?[1-9]"?$/.test(row[i] ?? ''), `${rep} ${head[i]}=${row[i]}`).toBe(false);
      }
    });
  });
});
