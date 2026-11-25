import { describe, it, expect, beforeAll } from 'vitest';
import { tokens } from '../src/fixtures.js';
import { kiorex, q } from '../src/clients.js';
import { KIOREX } from '../src/env.js';
import { partnerCall } from '../src/hmac.js';
import { WEBHOOK_SECRET } from '../src/env.js';

const today = () => new Date().toISOString().slice(0, 10);
const from = () => new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const Q = () => `from=${from()}&to=${today()}`;
const mask = (n: number) => (n > 0 && n < 10 ? '<10' : n);

/** GRW-P1-J against the real stack: rollup, definitions reconciled to the database, k >= 10, roles, tenant isolation, CSV, spend maker-checker. Runs after 25 (it needs real booking facts). */
describe('growth analytics v1: numbers reconcile to bookings and commission charges, masked under k = 10', () => {
  let ops: string; let patient: string;
  beforeAll(async () => { const t = await tokens(); ops = t.ops; patient = t.p1; });

  it('roles: no token 401, a patient 403, ops 200', async () => {
    expect((await kiorex(undefined, 'GET', `/ops/growth-analytics/overview?${Q()}`)).status).toBe(401);
    expect((await kiorex(patient, 'GET', `/ops/growth-analytics/overview?${Q()}`)).status).toBe(403);
    expect((await kiorex(ops, 'GET', `/ops/growth-analytics/overview?${Q()}`)).status).toBe(200);
  });

  it('rollup is idempotent and the overview reconciles to BookingIntent facts and commission charges', async () => {
    // every column of the table's unique key (GrowthMetricDaily_dim2_key) is selected AND ordered by: a snapshot that left doctorRef, branchRef, campaign ... out compared rows in the arbitrary order the database
    // returned the ties in, which differed between two identical reads (the repeat-run failure of this test)
    const DIMS = `market, day, metric, "sourceKind", "landingKind", "careType", origin, city, district, specialty, "providerRef", "doctorRef", "branchRef", campaign, channel, platform, product, "campaignId"`;
    const snap = async () => JSON.stringify((await q('kiorex_platform', `select ${DIMS.replace(' day,', ' day::text as day,')}, value from "GrowthMetricDaily" order by ${DIMS}`)));
    // Idempotent means: the SAME input gives the SAME output. The facts this rollup reads keep arriving from the stack's own workers for a while after the earlier suites (outbox handlers, lifecycle
    // jobs), so the pair of rollups is compared only when no fact changed between them (a fingerprint of the input tables); a pair that straddled new facts is repeated, a pair over unchanged facts must be identical.
    const facts = async () => JSON.stringify((await q('kiorex_platform', `select (select count(*) from "GrowthEvent") e, (select max("occurredAt") from "GrowthEvent") et, (select count(*) from "GrowthRevenueFact") r, (select count(*) from "BookingIntent") b, (select max("updatedAt") from "BookingIntent") bu`))[0]);
    let compared = false;
    for (let attempt = 0; attempt < 6 && !compared; attempt++) {
      const f0 = await facts();
      expect((await kiorex(ops, 'POST', '/ops/growth-analytics/rollup', { days: 2 })).status).toBe(200);
      const a = await snap(); const f1 = await facts();
      expect((await kiorex(ops, 'POST', '/ops/growth-analytics/rollup', { days: 2 })).status).toBe(200);
      const b = await snap(); const f2 = await facts();
      if (f0 === f1 && f1 === f2) { expect(b).toBe(a); compared = true; } else await new Promise((r) => setTimeout(r, 4000)); // facts moved between the two rollups: wait for the stack to settle and repeat
    }
    expect(compared, 'the input facts never settled long enough to compare two rollups').toBe(true);
    const o = (await kiorex(ops, 'GET', `/ops/growth-analytics/overview?${Q()}`)).body;
    const confirmed = (await q('kiorex_platform', `select count(*)::int c from "GrowthEvent" e join "BookingIntent" b on b.id = e."bookingId" where e.name = 'BookingConfirmed' and b."dependantId" is null and e."occurredAt" >= $1::date and e."occurredAt" < ($2::date + 1)`, [from(), today()]))[0].c;
    expect(o.bookings).toBe(mask(confirmed));
    const anp = (await q('kiorex_platform', `select count(*)::int c from "GrowthEvent" where name = 'BookingAttended' and props->>'bucket' = 'new' and "occurredAt" >= $1::date and "occurredAt" < ($2::date + 1)`, [from(), today()]))[0].c;
    expect(o.attendedNewPatients).toBe(mask(anp));
    const win = `"occurredAt" >= $1::date and "occurredAt" < ($2::date + 1)`;
    // a charge counts once, on the day it first reached CONFIRMED or BILLED; a reversal counts only for a charge that had counted (KX-32 section 04)
    const rev = (await q('kiorex_platform', `with counted as (select distinct on ("chargeId") "chargeId", "amountMinor" from "GrowthRevenueFact" where kind = 'CHARGE' and status in ('CONFIRMED','BILLED') and ${win} order by "chargeId", "occurredAt")
      select (coalesce((select sum("amountMinor") from counted), 0) - coalesce((select sum(f."amountMinor") from "GrowthRevenueFact" f where f.kind = 'REVERSAL' and ${win.replace(/"occurredAt"/g, 'f."occurredAt"')} and exists (select 1 from "GrowthRevenueFact" c where c."chargeId" = f."chargeId" and c.kind = 'CHARGE' and c.status in ('CONFIRMED','BILLED'))), 0))::int s`, [from(), today()]))[0].s;
    if (typeof o.kiorexRevenueMinor === 'number') expect(o.kiorexRevenueMinor).toBe(rev);
    // GBV is its own labelled volume figure, never the revenue figure
    expect(o.grossBookingValue.isRevenue).toBe(false);
    if (typeof o.grossBookingValueMinor === 'number' && typeof o.kiorexRevenueMinor === 'number') expect(o.grossBookingValueMinor).not.toBe(o.kiorexRevenueMinor);
    expect(JSON.stringify(o)).not.toMatch(/"sub"|\+20\d{9}|kxv_/);
  });

  it('funnel stages match the facts and every cell is a number >= 10 or "<10"; a place filter drops the visitor stages', async () => {
    const f = (await kiorex(ops, 'GET', `/ops/growth-analytics/funnel?${Q()}`)).body;
    expect(f.stages.map((s: any) => s.stage)).toEqual(['PageViewed', 'SearchStarted', 'ResultsViewed', 'ProviderViewed', 'SlotSelected', 'BookingInitiated', 'BookingConfirmed', 'BookingAttended']);
    for (const s of f.stages) expect(s.count === '<10' || (typeof s.count === 'number' && (s.count === 0 || s.count >= 10))).toBe(true);
    const n = (await q('kiorex_platform', `select count(*)::int c from "GrowthEvent" e join "BookingIntent" b on b.id = e."bookingId" where e.name = 'BookingInitiated' and b."dependantId" is null and e."occurredAt" >= $1::date and e."occurredAt" < ($2::date + 1)`, [from(), today()]))[0].c;
    expect(f.stages.find((s: any) => s.stage === 'BookingInitiated').count).toBe(mask(n));
    const narrowed = (await kiorex(ops, 'GET', `/ops/growth-analytics/funnel?${Q()}&city=Cairo`)).body;
    expect(narrowed.stages.map((s: any) => s.stage)).not.toContain('PageViewed');
  });

  it('breakdowns, channels and cohorts answer with the same masking; CSV export carries the same cells', async () => {
    for (const dim of ['city', 'specialty', 'provider', 'branch', 'doctor', 'district', 'channel', 'campaign']) {
      const r = await kiorex(ops, 'GET', `/ops/growth-analytics/breakdown/${dim}?${Q()}`); expect(r.status).toBe(200);
      for (const row of r.body.rows) expect(row.bookings === '<10' || row.bookings === 0 || row.bookings >= 10).toBe(true);
    }
    expect((await kiorex(ops, 'GET', `/ops/growth-analytics/breakdown/sub?${Q()}`)).status).toBe(400); // only closed dimensions
    const ch = (await kiorex(ops, 'GET', `/ops/growth-analytics/channels?${Q()}`)).body;
    for (const r of ch.rows) expect(r.bookings === '<10' || r.bookings === 0 || r.bookings >= 10).toBe(true);
    const co = (await kiorex(ops, 'GET', `/ops/growth-analytics/cohorts`)).body; expect(Array.isArray(co.rows)).toBe(true);
    const res = await fetch(`${KIOREX}/api/v1/ops/growth-analytics/export/channels.csv?${Q()}`, { headers: { authorization: `Bearer ${ops}` } });
    expect(res.status).toBe(200); expect(res.headers.get('content-type')).toMatch(/text\/csv/);
    const csv = await res.text(); expect(csv.split('\n')[0]).toContain('sourceKind');
    for (const r of ch.rows) if (r.bookings === '<10') expect(csv).toContain('<10');
    expect((await fetch(`${KIOREX}/api/v1/ops/growth-analytics/export/channels.csv?${Q()}`, { headers: { authorization: `Bearer ${patient}` } })).status).toBe(403);
  });

  it('provider reporting is a signed Clinic request for ONE organisation: its own rows only, no Kiorex money, replay refused', async () => {
    const org = (await q('kiorex_platform', `select "tenantId" from "Provider" where "tenantId" is not null limit 1`))[0].tenantId;
    const creds = { key: 'kx_dev_client', secret: WEBHOOK_SECRET };
    const mine = await partnerCall(KIOREX, creds, 'GET', `/api/v1/growth/v1/provider-analytics/overview?${Q()}`, undefined, { 'x-kiorly-org-ref': org });
    expect(mine.status).toBe(200); expect(mine.body.audience).toBe('PROVIDER');
    for (const k of ['kiorexRevenueMinor', 'spendMinor', 'blendedCacMinor', 'grossBookingValueMinor', 'merRatio']) expect(mine.body[k]).toBeUndefined();
    const none = await partnerCall(KIOREX, creds, 'GET', `/api/v1/growth/v1/provider-analytics/overview?${Q()}`, undefined, { 'x-kiorly-org-ref': 'org_that_does_not_exist' });
    expect(none.status).toBe(200); expect(none.body.bookings).toBe(0);
    expect((await partnerCall(KIOREX, { key: 'kx_dev_client', secret: 'wrong' }, 'GET', `/api/v1/growth/v1/provider-analytics/overview`, undefined, { 'x-kiorly-org-ref': org })).status).toBe(401);
    expect((await kiorex(ops, 'GET', `/growth/v1/provider-analytics/overview`)).status).toBe(401); // an ops session is not a partner
  });

  it('spend is maker-checker and counts only when approved (the same person cannot approve their own line)', async () => {
    const made = await kiorex(ops, 'POST', '/ops/growth-analytics/spend', { day: today(), amountMinor: 123456, campaign: 'e2e-ramadan', channel: 'meta', sourceKind: 'CAMPAIGN', note: 'e2e' });
    expect(made.status).toBe(201); expect(made.body.status).toBe('PENDING');
    const own = await kiorex(ops, 'POST', `/ops/growth-analytics/spend/${made.body.id}/approve`);
    expect(own.status).toBe(403); expect(own.body.code).toBe('MAKER_CHECKER');
    const before = (await kiorex(ops, 'GET', `/ops/growth-analytics/overview?${Q()}`)).body;
    expect(before.spendMinor).toBe(Number((await q('kiorex_platform', `select coalesce(sum("amountMinor"),0)::int s from "GrowthSpendEntry" where status = 'APPROVED' and day >= $1::date and day <= $2::date`, [from(), today()]))[0].s));
    expect((await kiorex(ops, 'POST', '/ops/growth-analytics/spend', { day: today(), amountMinor: 5, note: 'call 01001234567' })).status).toBe(400);
    await q('kiorex_platform', `delete from "GrowthSpendEntry" where id = $1`, [made.body.id]);
  });
});
