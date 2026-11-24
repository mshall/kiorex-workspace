import { randomBytes } from 'node:crypto';
import { kiorex, q } from './clients.js';

/** GRW-P3-E (suite 55) helpers. Add-only; a new file so growth.ts, growth-p2-32.ts and growth-p3.ts never conflict. */
export const AUTO = '/admin/growth/automation';
export const REC = '/admin/growth/recommendations';
export const DAYMS = 86_400_000;

export const TWO_STEP = {
  schema: 1,
  nodes: [
    { id: 'start', type: 'TRIGGER', event: 'STAGE_DORMANT' },
    { id: 'send1', type: 'SEND', template: 'REENGAGE_DORMANT', channels: ['PUSH'] },
    { id: 'wait1', type: 'WAIT', minutes: 7 * 24 * 60 },
    { id: 'send2', type: 'SEND', template: 'REENGAGE_DORMANT', channels: ['PUSH'] },
    { id: 'done', type: 'END' },
  ],
  edges: [{ from: 'start', to: 'send1' }, { from: 'send1', to: 'wait1' }, { from: 'wait1', to: 'send2' }, { from: 'send2', to: 'done' }],
};

/**
 * A dormant person for the automation scan (the lifecycle row the stage job writes, a registration 200 days old) WITHOUT any enrolment, and an ENDED placeholder for the static re-engagement journey
 * of the same day, so the P2-E journey cannot enrol (and message) the same person: the suite measures the builder journey alone.
 */
export async function dormantForAutomation(sub: string) {
  const now = Date.now();
  await q('kiorex_platform', `update "PatientProfile" set "createdAt" = $2 where sub = $1`, [sub, new Date(now - 200 * DAYMS).toISOString()]);
  await q('kiorex_platform', `insert into "PatientLifecycle" (sub, market, stage, "stageAt", "registeredAt", language) values ($1,'EG','DORMANT',$2,$3,'en') on conflict (sub, market) do update set stage = 'DORMANT', "stageAt" = $2`, [sub, new Date(now).toISOString(), new Date(now - 200 * DAYMS).toISOString()]);
  const day = Math.floor(now / DAYMS);
  await q('kiorex_platform', `insert into "LifecycleEnrollment" (id, sub, market, "journeyKey", "journeyVersion", state, step, "endedAt", "endReason") values ($1,$2,'EG',$3,1,'ENDED',0,(now() at time zone 'utc'),'E2E_PLACEHOLDER') on conflict do nothing`, [`kx_lce_e2e${randomBytes(5).toString('hex')}`, sub, `reengagement#d${day}.e2e55`]);
}
export const journeyDecisions = (sub: string, key: string) => q('kiorex_platform', `select channel, decision, reason, "templateKey" from "LifecycleMessageDecision" where sub = $1 and "journeyKey" = $2 order by at, id`, [sub, key]);
export const journeyReasons = async (sub: string, key: string) => (await journeyDecisions(sub, key)).map((d) => `${d.channel}:${d.decision}:${d.reason}`);
export const journeyMessages = async (sub: string, key: string) => Number((await q('kiorex_platform', `select count(*)::int c from "Message" where sub = $1 and "dedupeKey" like $2`, [sub, `lc:${key}:%`]))[0].c);
export const enrolment = async (sub: string, key: string) => (await q('kiorex_platform', `select state, step, "endReason" from "LifecycleEnrollment" where sub = $1 and "journeyKey" like $2`, [sub, `${key}#%`]))[0];
export const dueNow = (sub: string, key: string) => q('kiorex_platform', `update "LifecycleEnrollment" set "nextRunAt" = (now() at time zone 'utc') - interval '1 second' where sub = $1 and "journeyKey" like $2 and state = 'ACTIVE'`, [sub, `${key}#%`]);

/** Aggregates the recommendation rules read: a campaign with approved spend and attended new patients inside the 28 day window (rows are tagged e2e55 and removed afterwards). */
export async function seedCampaign(key: string, channel: string, o: { spend: number; attended: number; status?: string; activeDays?: number }) {
  const id = `e2e55c${randomBytes(6).toString('hex')}`; const day = new Date(Date.now() - 3 * DAYMS).toISOString().slice(0, 10);
  await q('kiorex_platform', `insert into "GrowthCampaign" (id, market, key, "utmCampaign", name, objective, status, "budgetTotalMinor", "budgetDailyMinor", channels, "policyVersionId", "ownerSub", "activatedAt", "updatedAt") values ($1,'EG',$2,$3,$2,'ACQUISITION',$4,5000000,500000,$5,'e2e','e2e55',$6, now())`,
    [id, key, `eg-${key}`, o.status ?? 'ACTIVE', [channel], new Date(Date.now() - (o.activeDays ?? 20) * DAYMS).toISOString()]);
  if (o.spend) await q('kiorex_platform', `insert into "GrowthSpendEntry" (id, market, day, campaign, "campaignId", channel, "amountMinor", status, "createdBy", source) values ($1,'EG',$2,$3,$4,$5,$6,'APPROVED','e2e55','MANUAL')`, [`e2e55s${randomBytes(6).toString('hex')}`, day, `eg-${key}`, id, channel, o.spend]);
  if (o.attended) await q('kiorex_platform', `insert into "GrowthMetricDaily" (id, market, day, metric, "sourceKind", campaign, "campaignId", value, "updatedAt") values ($1,'EG',$2,'AttendedNewPatient','CAMPAIGN',$3,$4,$5, now())`, [`e2e55m${randomBytes(6).toString('hex')}`, day, `eg-${key}`, id, o.attended]);
  return id;
}
export async function dropSeeded() {
  await q('kiorex_platform', `delete from "GrowthMetricDaily" where "campaignId" like 'e2e55c%'`);
  await q('kiorex_platform', `delete from "GrowthSpendEntry" where "campaignId" like 'e2e55c%'`);
  await q('kiorex_platform', `delete from "GrowthCampaign" where id like 'e2e55c%' or key like 'rec-%' and "ownerSub" like 'e2e%'`);
}
export const mk = kiorex;
