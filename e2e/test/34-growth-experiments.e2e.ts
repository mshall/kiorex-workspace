import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import pg from 'pg';
import { DB } from '../src/env.js';
import { kiorex, q, sleep } from '../src/clients.js';
import { tokens } from '../src/fixtures.js';
import { secondSuperAdmin } from '../src/growth.js';
import { unlockForRun } from '../src/growth-p3.js';
import { KIOREX_API } from '../src/env.js';
import { resetRateLimits } from '../src/db.js';

/**
 * GRW-P3-A on the real local stack (W7 part of suite 34; the W9 part, P3-H, extends it): a landing-copy experiment 50/50 with two real super admins (maker-checker), consented visitors served through the
 * real endpoints, exposure and conversion facts, the evaluator with a time-travelled experiment (backdated in the dev database, the same device the campaign suite uses: triggers are switched off for ONE
 * transaction), SRM clean and a valid interval after the minimum days, the winner concluded, ship-winner recorded as a proposal that changes nothing, SRM and stop paths, and the forbidden surface refused.
 * The launch-locked visitor flag gets DEV TEST FIXTURE gate evidence for this run only.
 */
const BASE = '/admin/growth/experiments'; const PUB = '/growth/v1/experiments'; const DAY = 86_400_000;
const unitHash = (salt: string, key: string) => createHmac('sha256', salt).update(key, 'utf8').digest('hex');

describe('34. growth experiments: assignment, SRM, stop, ship-winner via maker-checker', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let two: Awaited<ReturnType<typeof secondSuperAdmin>>; const undo: (() => Promise<void>)[] = []; const ids: string[] = []; const RUN = randomBytes(3).toString('hex');
  const spec = (o: Record<string, unknown> = {}) => ({ key: `e2e34-${RUN}-${Math.random().toString(36).slice(2, 6)}`, name: 'E2E hero copy', surface: 'landing.home.hero_copy', hypothesis: 'A shorter headline raises booking starts', variants: [{ key: 'control', weightBp: 5000 }, { key: 'b', weightBp: 5000 }], primaryMetric: 'booking_started', minSample: 500, plannedDays: 14, ...o });
  const create = async (o: Record<string, unknown> = {}) => { const r = await kiorex(t.ops, 'POST', BASE, spec(o)); expect(r.status, JSON.stringify(r.body)).toBe(201); ids.push(r.body.id); return r.body; };
  const start = async (o: Record<string, unknown> = {}) => { const e = await create(o); expect((await kiorex(t.ops, 'POST', `${BASE}/${e.id}/submit`)).status).toBe(200); expect((await kiorex(two.token, 'POST', `${BASE}/${e.id}/approve`)).status).toBe(200); return e as { id: string; key: string }; };
  const visitor = (i: number) => `kxv_e2e34${RUN}${String(i).padStart(14, '0')}`;
  let calls = 0; const pace = async () => { if (++calls % 40 === 0) await resetRateLimits(); }; // the public endpoints are rate limited per network and minute; the suite resets the shared buckets between batches
  const serve = async (i: number) => { await pace(); return serve_(i); };
  const serve_ = (i: number) => fetch(`${KIOREX_API}${PUB}/assignments`, { headers: { 'x-kx-consent': 'analytics', cookie: `kxv=${visitor(i)}` } }).then(async (r) => ({ status: r.status, body: await r.json() as any, setCookie: r.headers.get('set-cookie') }));
  const expose = async (i: number, key: string) => { await pace(); return expose_(i, key); };
  const expose_ = (i: number, key: string) => fetch(`${KIOREX_API}${PUB}/exposures`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-kx-consent': 'analytics', cookie: `kxv=${visitor(i)}` }, body: JSON.stringify({ experiment: key }) }).then((r) => r.json() as Promise<any>);
  /** Dev-database time travel: backdate a started experiment and its exposures by `days`, with the immutability triggers off for ONE transaction. */
  async function backdate(id: string, days: number) {
    const c = new pg.Client({ connectionString: DB('kiorex_platform') }); await c.connect();
    try { await c.query('begin'); await c.query(`set local session_replication_role = replica`);
      await c.query(`update "GrowthExperiment" set "startedAt" = "startedAt" - ($2 || ' days')::interval where id = $1`, [id, String(days)]);
      await c.query(`update "GrowthExperimentExposure" set "firstAt" = "firstAt" - ($2 || ' days')::interval, "day" = ("firstAt" - ($2 || ' days')::interval)::date where "experimentId" = $1`, [id, String(days)]); await c.query('commit'); }
    finally { await c.end(); }
  }

  beforeAll(async () => { await resetRateLimits(); t = await tokens(); two = await secondSuperAdmin(); undo.push(await unlockForRun(t.ops, 'growth.analytics_visitor')); await sleep(1500); });
  afterAll(async () => { for (const id of ids) await kiorex(t.ops, 'POST', `${BASE}/${id}/stop`, { reason: 'e2e 34 cleanup' }).catch(() => undefined); for (const u of undo.reverse()) await u().catch(() => undefined); await two?.drop().catch(() => undefined); });

  it('a forbidden surface is refused (422) and the closed catalogue lists none of them', async () => {
    for (const surface of ['emergency.guidance.banner', 'consent.analytics.banner', 'booking.price.disclosure', 'clinical.content.card']) { const r = await kiorex(t.ops, 'POST', BASE, spec({ surface })); expect(r.status).toBe(422); expect(r.body.code).toBe('EXPERIMENT_SURFACE_FORBIDDEN'); }
    const cat = (await kiorex(t.ops, 'GET', `${BASE}/catalog`)).body; expect(cat.surfaces.map((x: any) => x.key).join(' ')).not.toMatch(/emergency|triage|consent|privacy|price|clinical|cancellation|fee\b/i);
  });

  it('maker-checker over HTTP: the author cannot approve, a second super admin can; the experiment then runs', async () => {
    const e = await create(); await kiorex(t.ops, 'POST', `${BASE}/${e.id}/submit`);
    expect((await kiorex(t.ops, 'POST', `${BASE}/${e.id}/approve`)).body.code).toBe('SECOND_APPROVER_REQUIRED');
    const ok = await kiorex(two.token, 'POST', `${BASE}/${e.id}/approve`); expect(ok.status).toBe(200); expect(ok.body).toMatchObject({ status: 'RUNNING', approvedBy: two.sub });
    expect((await kiorex(t.ops, 'POST', `${BASE}/${e.id}/stop`, { reason: 'one at a time on this surface' })).status).toBe(200);
  });

  it('a landing-copy experiment at 50/50: stable assignment, consent matrix, exposure idempotent; after the minimum days a valid interval and the winner; ship-winner is a proposal only', async () => {
    const e = await start({ minSample: 50 });
    expect((await fetch(`${KIOREX_API}${PUB}/assignments`)).status).toBe(200); expect(((await (await fetch(`${KIOREX_API}${PUB}/assignments`)).json()) as any).assignments).toEqual([]); // no consent: control, nothing recorded
    const arm: Record<string, string> = {}; for (let i = 0; i < 160; i++) { const r = await serve(i); expect(r.status).toBe(200); expect(r.setCookie).toMatch(/kxe=/); arm[visitor(i)] = r.body.assignments[0].variant; }
    for (let i = 0; i < 160; i += 20) expect((await serve(i)).body.assignments[0].variant).toBe(arm[visitor(i)]); // stickiness
    for (let i = 0; i < 160; i++) { const r = await expose(i, e.key); expect(r.recorded).toBe(true); expect((await expose(i, e.key)).recorded).toBe(false); }
    const rows = await q('kiorex_platform', `select variant, count(*)::int n from "GrowthExperimentExposure" where "experimentId" = $1 group by 1`, [e.id]); const n = Object.fromEntries(rows.map((r: any) => [r.variant, r.n])); expect(n.control + n.b).toBe(160); expect(Math.abs(n.control - 80)).toBeLessThan(26);
    // a real treatment effect from the funnel facts: control converts 10 percent, variant b 30 percent (visitor-keyed facts, after the exposure)
    const seen: Record<string, number> = { control: 0, b: 0 }; // the split is a keyed hash (server-only random salt): count inside the ARM so the conversion rates are exactly 30 and 10 percent whatever the split is (deterministic effect, no statistical flake)
    for (let i = 0; i < 160; i++) { const a = arm[visitor(i)]; const k = seen[a]++; const hit = a === 'b' ? k % 10 < 3 : k % 10 < 1; if (hit) await q('kiorex_platform', `insert into "GrowthEvent" (id, market, name, "visitorKey", props, "dedupeKey", "occurredAt") values ($1,'EG','BookingInitiated',$2,'{}'::jsonb,$3, now() + interval '1 minute')`, [`gev_e2e34_${RUN}_${i}`, visitor(i), `e2e34|${e.id}|${i}`]); }
    expect((await kiorex(t.ops, 'POST', `${BASE}/evaluator/run`)).status).toBe(200);
    const early = (await kiorex(t.ops, 'GET', `${BASE}/${e.id}/results`)).body[0]; expect(early.verdict).toBe('COLLECTING'); expect(early.payload.hidden).toBe(true); expect(early.payload.treatments).toBeUndefined();
    await backdate(e.id, 15); await q('kiorex_platform', `update "GrowthEvent" set "occurredAt" = "occurredAt" - interval '15 days' where "dedupeKey" like $1`, [`e2e34|${e.id}|%`]).catch(() => undefined);
    const run = await kiorex(t.ops, 'POST', `${BASE}/evaluator/run`); expect(run.status).toBe(200);
    const res = (await kiorex(t.ops, 'GET', `${BASE}/${e.id}/results`)).body[0];
    expect(res.verdict).toBe('WINNER'); expect(res.payload.srm.detected).toBe(false);
    const flagsBefore = Number((await q('kiorex_platform', `select count(*)::int c from "FlagValue"`))[0].c); const cfgBefore = Number((await q('kiorex_platform', `select count(*)::int c from "GrowthConfigVersion"`))[0].c);
    const detail = (await kiorex(t.ops, 'GET', `${BASE}/${e.id}`)).body; expect(JSON.stringify(detail)).not.toMatch(/kxv_e2e34|"salt"|unitHash/);
    {
      expect(detail.status).toBe('CONCLUDED'); expect(res.payload.treatments[0].ci.low).toBeGreaterThan(0);
      const ship = await kiorex(t.ops, 'POST', `${BASE}/${e.id}/ship-winner`); expect(ship.status).toBe(200); expect(ship.body.proposal).toMatchObject({ winner: 'b', autoApplied: false });
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "FlagValue"`))[0].c)).toBe(flagsBefore); expect(Number((await q('kiorex_platform', `select count(*)::int c from "GrowthConfigVersion"`))[0].c)).toBe(cfgBefore);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "AuditLog" where action = 'growth.experiment.ship_requested' and "resourceId" = $1`, [e.id]))[0].c)).toBe(1);
    }
    const hist = (await kiorex(t.ops, 'GET', `${BASE}/${e.id}/history`)).body.map((x: any) => x.kind); expect(hist).toEqual(expect.arrayContaining(['CREATED', 'APPROVED', 'STARTED']));
  });

  it('SRM: a skewed split hides the results, stops the experiment and writes the SRM event; stop reverts everyone to control at once', async () => {
    const e = await start({ surface: 'signup.value_proposition' }); const salt = (await q('kiorex_platform', `select salt from "GrowthExperiment" where id = $1`, [e.id]))[0].salt as string; // the salt is server-only: never in a response
    const c = new pg.Client({ connectionString: DB('kiorex_platform') }); await c.connect();
    try { for (let i = 0; i < 700; i++) await c.query(`insert into "GrowthExperimentExposure" (id, "experimentId", market, day, variant, "unitKind", "unitHash", "firstAt") values ($1,$2,'EG',current_date,$3,'VISITOR',$4, now())`, [`gex_e2e34_${RUN}_${i}`, e.id, i < 500 ? 'control' : 'b', unitHash(salt, `v:skew${i}`)]); } finally { await c.end(); }
    await backdate(e.id, 9);
    await kiorex(t.ops, 'POST', `${BASE}/evaluator/run`);
    const d = (await kiorex(t.ops, 'GET', `${BASE}/${e.id}`)).body; expect(d.status).toBe('STOPPED'); expect(d.stopReason).toMatch(/^SRM_DETECTED/);
    const res = (await kiorex(t.ops, 'GET', `${BASE}/${e.id}/results`)).body[0]; expect(res.verdict).toBe('SRM_DETECTED'); expect(res.payload.hidden).toBe(true); expect(JSON.stringify(res.payload)).not.toMatch(/"winner"|"ci"/);
    expect((await kiorex(t.ops, 'GET', `${BASE}/${e.id}/history`)).body.map((x: any) => x.kind)).toContain('SRM');
    const live = await start({ surface: 'landing.search.empty_state' }); expect((await serve(1)).body.assignments.some((a: any) => a.experiment === live.key)).toBe(true);
    expect((await kiorex(t.ops, 'POST', `${BASE}/${live.id}/stop`, { reason: 'e2e stop to control' })).status).toBe(200); expect((await serve(1)).body.assignments.some((a: any) => a.experiment === live.key)).toBe(false);
  });
});
