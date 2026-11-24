import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { DB } from './env.js';
import { kiorex, q } from './clients.js';

/** GRW-P2 helpers (add-only; phase 2 lives in this file so it never conflicts with growth.ts). */
export const CAMPAIGNS = '/admin/growth/campaigns';
export const campaignKey = (prefix = 'e2e') => `${prefix}-${randomBytes(4).toString('hex')}`;
export const iso = (ms: number) => new Date(ms).toISOString();

export interface CampaignBody { key: string; name: string; objective: string; budgetTotalMinor: number; budgetDailyMinor?: number; channels: string[]; startsAt?: string; endsAt?: string; eligibility?: object; utmConfig?: object }
export const campaignBody = (o: Partial<CampaignBody> = {}): CampaignBody => ({ key: campaignKey(), name: 'E2E campaign', objective: 'ACQUISITION', budgetTotalMinor: 1_000_000, budgetDailyMinor: 600_000, channels: ['EMAIL'], startsAt: iso(Date.now() - 3_600_000), endsAt: iso(Date.now() + 30 * 86_400_000), ...o });
export const createCampaign = async (token: string, o: Partial<CampaignBody> = {}) => { const r = await kiorex(token, 'POST', CAMPAIGNS, campaignBody(o)); if (r.status !== 201) throw new Error(`create campaign ${r.status} ${JSON.stringify(r.body)}`); return r.body as { id: string; utmCampaign: string; key: string; status: string; version: number; approval: { payloadHash: string } }; };
export const getCampaign = async (token: string, id: string) => (await kiorex(token, 'GET', `${CAMPAIGNS}/${id}`)).body as any;
export const runScheduler = async (token: string) => (await kiorex(token, 'POST', `${CAMPAIGNS}/scheduler/run`)).body as Record<string, number>;
/** Activation approval by a second admin (the requester can never decide). */
export async function approveCampaign(maker: string, checker: string, id: string) {
  const a = await kiorex(maker, 'POST', `${CAMPAIGNS}/${id}/approvals`, { kind: 'ACTIVATE' }); if (a.status !== 201) throw new Error(`approval ${a.status} ${JSON.stringify(a.body)}`);
  const d = await kiorex(checker, 'POST', `${CAMPAIGNS}/approvals/${a.body.id}/decide`, { decision: 'APPROVED', snapshotHash: a.body.snapshotHash }); if (d.status !== 200) throw new Error(`decide ${d.status} ${JSON.stringify(d.body)}`);
  return { approval: a.body, decision: d.body };
}
/** A spend line entered by one admin and approved by the other. */
export async function approvedSpend(maker: string, checker: string, id: string, amountMinor: number, day = new Date().toISOString().slice(0, 10)) {
  const s = await kiorex(maker, 'POST', `${CAMPAIGNS}/${id}/spend`, { day, amountMinor }); if (s.status !== 201) throw new Error(`spend ${s.status} ${JSON.stringify(s.body)}`);
  const ok = await kiorex(checker, 'POST', `/ops/growth-analytics/spend/${s.body.id}/approve`); if (ok.status !== 200) throw new Error(`approve spend ${ok.status} ${JSON.stringify(ok.body)}`);
  return s.body as { id: string };
}
/** The campaign touch a consenting visitor would leave (the consent-gated endpoint is locked until the counsel gate, so the harness writes the same rows the endpoint writes once it is open). */
export async function seedCampaignTouch(o: { sub: string; campaignId: string; utmCampaign: string; ageMs?: number }) {
  const src = (await q('kiorex_platform', `insert into "GrowthAcquisitionSource" (id, market, "sourceKind", "sourceRef", active) values ($1, 'EG', 'CAMPAIGN', $2, true) on conflict (market, "sourceKind", "sourceRef") do update set active = true returning id`, [`gas_e2e_${randomBytes(5).toString('hex')}`, o.campaignId]))[0];
  await q('kiorex_platform', `insert into "GrowthTouchpoint" (id, market, sub, "sourceId", kind, "utmSource", "utmMedium", "utmCampaign", "landingKind", "occurredAt", "ipHash", "uaClass") values ($1, 'EG', $2, $3, 'CAMPAIGN', 'kiorex', 'email', $4, 'HOME', $5, '', 'e2e')`,
    [`gtp_e2e_${randomBytes(5).toString('hex')}`, o.sub, src.id, o.utmCampaign, new Date(Date.now() - (o.ageMs ?? 3_600_000)).toISOString()]);
}
/**
 * Removes the campaigns a test created with everything they own (spend lines, metric rows, touches, sources, outbox events, audit rows). Dev databases only: it switches triggers off for ONE transaction
 * (session_replication_role = replica), because status history and touches are append-only by design.
 */
export async function purgeCampaigns(ids: string[]) {
  if (!ids.length) return 0;
  const c = new pg.Client({ connectionString: DB('kiorex_platform') }); await c.connect();
  try {
    await c.query('begin'); await c.query(`set local session_replication_role = replica`);
    const srcs = (await c.query(`select id from "GrowthAcquisitionSource" where "sourceKind" = 'CAMPAIGN' and "sourceRef" = any($1)`, [ids])).rows.map((r) => r.id);
    await c.query(`delete from "GrowthTouchpoint" where "sourceId" = any($1)`, [srcs]);
    await c.query(`delete from "GrowthAcquisitionSource" where id = any($1)`, [srcs]);
    await c.query(`delete from "GrowthSpendEntry" where "campaignId" = any($1)`, [ids]);
    await c.query(`delete from "GrowthMetricDaily" where "campaignId" = any($1)`, [ids]);
    await c.query(`delete from "OutboxEvent" where "aggregateId" = any($1)`, [ids]);
    await c.query(`delete from "AuditLog" where "resourceId" = any($1)`, [ids]);
    const n = (await c.query(`delete from "GrowthCampaign" where id = any($1)`, [ids])).rowCount ?? 0;
    await c.query('commit'); return n;
  } catch (e) { await c.query('rollback').catch(() => undefined); throw e; } finally { await c.end(); }
}
