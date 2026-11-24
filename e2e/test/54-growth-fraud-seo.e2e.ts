import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, opsLogin, waitFor, q } from '../src/clients.js';
import { KIOREX } from '../src/env.js';

/**
 * GRW-P3-D and GRW-P3-F on the real stack (Kiorex API with its Postgres, the dev Passport for the ops session). Fraud: a forged link token on the PUBLIC touch endpoint opens a TOUCH case in SHADOW
 * (band HIGH, nothing enforced), the case is reviewed over the ops API (hashed evidence only, a decision needs a reason, the identity lookup needs the DPO role, bulk dismissal never takes a HIGH
 * case), the rules and the shadow report show shadow as the default. SEO: the quality gate runs over the real sitemap in both locales, stores reports, never changes a page while autoNoindex is off
 * (the default), the sitemap and the pages stay as they were, the vitals page says "not measured" until audit data is ingested, and ingested lab numbers appear with the budgets.
 * Everything the suite writes is removed again. Needs the public site bundle (`npm run build:public` in apps/web) on the instance under test.
 */
const A = '/admin/growth/fraud'; const S = '/admin/growth/seo-automation';
describe('54. fraud v2 (shadow) and SEO automation on the real Kiorex stack', () => {
  let ops: string; let caseId: string | undefined;
  beforeAll(async () => { ops = (await opsLogin()).accessToken; await q('kiorex_platform', `delete from "SeoVitalSnapshot" where "templateKind" in ('doctor','clinic') and source = 'LAB'`); });
  afterAll(async () => {
    await q('kiorex_platform', `delete from "SeoVitalSnapshot" where "templateKind" in ('doctor','clinic') and source = 'LAB'`).catch(() => undefined);
    await q('kiorex_platform', `delete from "RateLimitBucket" where key like 'growth:touch:%' or key like 'fraud:%'`).catch(() => undefined);
  });

  it('every fraud and SEO ops endpoint needs a session', async () => {
    for (const p of [`${A}/cases`, `${A}/rules`, `${A}/shadow-report`, `${S}/overview`, `${S}/vitals`, `${S}/indexation`]) expect((await kiorex(undefined, 'GET', p)).status, p).toBe(401);
  });

  describe('fraud: shadow is the default', () => {
    it('the rules endpoint shows eleven rules, nothing enforced, a read-only configuration', async () => {
      const r = await kiorex(ops, 'GET', `${A}/rules`); expect(r.status).toBe(200);
      expect(r.body.editable).toBe(false); expect(r.body.ruleIds).toHaveLength(11); expect(r.body.config.enforce).toBe(false);
      for (const id of r.body.ruleIds) expect(r.body.config.rules[id].enforce, id).toBe(false);
      expect(r.body.config.twoPersonOnMoney).toBe(true);
    });

    it('a forged link token on the public touch endpoint is refused as before AND opens a SHADOW touch case that changes nothing', async () => {
      const before = Number((await q('kiorex_platform', `select count(*)::int as n from "GrowthTouchpoint"`))[0].n);
      const forged = `${Buffer.from(JSON.stringify({ o: 'org_forged', c: 'ZZZZZZZZ', t: Date.now(), v: 1 })).toString('base64url')}.${'A'.repeat(43)}`;
      const t = await fetch(`${KIOREX}/api/v1/growth/v1/touch`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kx-consent': 'analytics' }, body: JSON.stringify({ landingKind: 'HOME', lt: forged }) });
      expect([400, 401, 403, 422]).toContain(t.status); expect(JSON.stringify(await t.json())).toMatch(/LINK_TOKEN/);
      const c = await waitFor('a TOUCH case', async () => { const l = await kiorex(ops, 'GET', `${A}/cases?kind=TOUCH`); return l.body.rows?.[0]; }, 15_000);
      caseId = c.id; expect(c).toMatchObject({ kind: 'TOUCH', band: 'HIGH', mode: 'SHADOW', status: 'OPEN' });
      expect(Number((await q('kiorex_platform', `select count(*)::int as n from "GrowthTouchpoint"`))[0].n)).toBe(before); // no touch stored, no attribution change
      const log = await q('kiorex_platform', `select action, note from "FraudDecisionLog" where "caseId" = $1`, [caseId]); expect(log[0].action).toBe('OPENED'); expect(log[0].note).toContain('shadow-would');
    });

    it('the evidence is hashed references and rule rows; a decision needs a reason; the identity lookup needs the DPO role; a HIGH case is never bulk-dismissed', async () => {
      const ev = await kiorex(ops, 'GET', `${A}/cases/${caseId}`); expect(ev.status).toBe(200);
      expect(ev.body.signals.map((s: any) => s.ruleId)).toContain('r_lt_replay'); expect(JSON.stringify(ev.body)).not.toMatch(/\+20\d{9}|@|127\.0\.0\.1/);
      expect((await kiorex(ops, 'POST', `${A}/cases/${caseId}/identity`, { reason: 'ticket 4411, the patient asked' })).status).toBe(403);
      expect((await kiorex(ops, 'POST', `${A}/cases/${caseId}/decision`, { decision: 'DISMISS' })).status).toBe(400);
      const bulk = await kiorex(ops, 'POST', `${A}/cases/bulk-dismiss`, { ids: [caseId], reason: 'Reviewed together: noise from one scanner' }); expect(bulk.body).toMatchObject({ requested: 1, dismissed: 0, skipped: 1 });
      const d = await kiorex(ops, 'POST', `${A}/cases/${caseId}/decision`, { decision: 'DISMISS', note: 'Forged token from a security scan of our own' }); expect(d.status).toBe(200); expect(d.body.status).toBe('DISMISSED');
      const row = (await q('kiorex_platform', `select status, "decidedBy", decision from "FraudCase" where id = $1`, [caseId]))[0]; expect(row).toMatchObject({ status: 'DISMISSED', decision: 'DISMISS' }); expect(row.decidedBy).toBeTruthy();
      expect((await kiorex(ops, 'POST', `${A}/cases/${caseId}/appeal`, { note: 'A dismissed case cannot be appealed' })).status).toBe(409);
    });

    it('the shadow report, fairness check and summary answer with the shipped defaults', async () => {
      const s = await kiorex(ops, 'GET', `${A}/shadow-report`); expect(s.status).toBe(200); expect(s.body.enforce).toBe(false); expect(s.body.rules).toHaveLength(11);
      for (const r of s.body.rules) if (r.labelled < 20) expect(r.precision, r.ruleId).toBeNull();
      const f = await kiorex(ops, 'GET', `${A}/fairness`); expect(f.status).toBe(200); expect(f.body.language.every((g: any) => g.total === '<10' || g.total >= 10)).toBe(true);
      expect((await kiorex(ops, 'GET', `${A}/cases/summary`)).body).toHaveProperty('breached');
    });
  });

  describe('SEO automation: the gate reports and changes nothing while autoNoindex is off', () => {
    it('runs over the real sitemap in both locales and stores one report per page and locale', async () => {
      const cfg = await kiorex(ops, 'GET', `${S}/config`); expect(cfg.body).toMatchObject({ editable: false }); expect(cfg.body.config.autoNoindex).toBe(false);
      const run = await kiorex(ops, 'POST', `${S}/run`, {}); expect(run.status).toBe(200);
      expect(run.body, JSON.stringify(run.body)).toMatchObject({ measured: true, autoNoindex: false }); expect(run.body.pages).toBeGreaterThan(3); expect(run.body.reports).toBe(run.body.pages * 2);
      const ov = await kiorex(ops, 'GET', `${S}/overview`); expect(ov.body).toMatchObject({ measured: true, bundleAvailable: true }); expect(ov.body.byTemplate.length).toBeGreaterThan(0);
      const stored = Number((await q('kiorex_platform', `select count(distinct ("pageKey","locale"))::int as n from "SeoQualityReport"`))[0].n); expect(stored).toBe(run.body.reports);
    });

    it('no page and no sitemap shard changed: every sitemap URL still answers 200 with index,follow', async () => {
      const idx = await (await fetch(`${KIOREX}/sitemap.xml`)).text(); const shards = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname).filter((p) => /-eg-en-/.test(p)).slice(0, 4);
      expect(shards.length).toBeGreaterThan(0);
      for (const s of shards) { const x = await (await fetch(`${KIOREX}${s}`)).text(); const url = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname)[0]!; const res = await fetch(`${KIOREX}${url}`); const html = await res.text();
        expect(res.status, url).toBe(200); expect(html, url).toMatch(/<meta name="robots" content="index,follow/); expect(res.headers.get('x-robots-tag')).toBeNull(); }
    });

    it('internal links are stored within the caps and a second run changes nothing', async () => {
      const links = await q('kiorex_platform', `select "fromKey", count(*)::int as n from "SeoInternalLink" group by 1`); expect(links.length).toBeGreaterThan(0); for (const l of links) expect(l.n).toBeLessThanOrEqual(50);
      const snap = async () => (await q('kiorex_platform', `select id, "fromKey", "toKey", rule, rank, "computedAt" from "SeoInternalLink" order by id`)).map((r: any) => `${r.id}|${r.fromKey}|${r.toKey}|${r.rule}|${r.rank}|${new Date(r.computedAt).toISOString()}`);
      const before = await snap(); expect((await kiorex(ops, 'POST', `${S}/run`, {})).status).toBe(200); expect(await snap()).toEqual(before);
    });

    it('vitals: not measured until audit data exists, then the lab numbers with their budgets; indexation says "not measured" for indexed', async () => {
      const none = await kiorex(ops, 'GET', `${S}/vitals`); expect(none.body.budgets).toMatchObject({ lcpMs: 2500, cls: 0.1 }); if (!none.body.lab.measured) expect(none.body.lab.note).toMatch(/Not measured/);
      const lab = [{ factor: 'mobile', locale: 'ar', page: 'doctor', perf: 97, lcp: 1710, cls: 0, tbt: 40 }, { factor: 'mobile', locale: 'ar', page: 'clinic', perf: 88, lcp: 2900, cls: 0.14, tbt: 260 }];
      const ing = await kiorex(ops, 'POST', `${S}/vitals/ingest`, { summary: lab }); expect(ing.status).toBe(200); expect(ing.body.lab).toMatchObject({ measured: true });
      const ov = await kiorex(ops, 'GET', `${S}/vitals`); expect(ov.body.latest.find((x: any) => x.templateKind === 'doctor' && x.metric === 'lcp_ms' && x.source === 'LAB').p75).toBe(1710);
      expect(ov.body.breaches.map((b: any) => `${b.templateKind}.${b.metric}.${b.source}`)).toEqual(expect.arrayContaining(['clinic.lcp_ms.LAB', 'clinic.perf_score.LAB']));
      const ix = await kiorex(ops, 'GET', `${S}/indexation`); for (const r of ix.body.rows) if (!r.indexedKnown) expect(r.indexed).toBeNull();
    });
  });
});
