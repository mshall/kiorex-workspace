import { randomBytes } from 'node:crypto';
import { kiorex, q } from './clients.js';

/** GRW-P2-E (suite 32) helpers. Add-only; nothing here is imported by another suite. */
export const LC = '/admin/growth/lifecycle';
export const MARKETING_PURPOSES = ['MARKETING_PUSH', 'MARKETING_WHATSAPP', 'MARKETING_SMS', 'MARKETING_EMAIL'] as const;
const H = 3_600_000;

export const runTick = async (ops: string) => { const r = await kiorex(ops, 'POST', `${LC}/run`); if (r.status !== 200) throw new Error(`run ${r.status} ${JSON.stringify(r.body)}`); return r.body as { triggers: Record<string, number>; runs: Record<string, number> }; };

/**
 * The welcome trigger scans at most 500 profiles created in the last 48 h, unordered. A dev database that other suites filled with recent people would hide a brand-new one, so this moves every OTHER recent
 * profile 60 days into the past (remembering the old value) and returns the restore function. Only used when more than 300 recent profiles exist.
 */
export async function isolateRecentProfiles(keep: string[]): Promise<() => Promise<void>> {
  const n = Number((await q('kiorex_platform', `select count(*)::int c from "PatientProfile" where "createdAt" > (now() at time zone 'utc') - interval '48 hours'`))[0].c);
  if (n < 300) return async () => undefined;
  const moved = await q('kiorex_platform', `update "PatientProfile" set "createdAt" = "createdAt" - interval '60 days' where "createdAt" > (now() at time zone 'utc') - interval '48 hours' and not (sub = any($1)) returning sub`, [keep]);
  const subs = moved.map((r) => r.sub as string);
  return async () => { if (subs.length) await q('kiorex_platform', `update "PatientProfile" set "createdAt" = "createdAt" + interval '60 days' where sub = any($1)`, [subs]); };
}

/** A dormant person: the lifecycle row the stage job writes, plus an anchored re-engagement enrolment due now (the same row `enrol` writes). */
export async function dormantEnrolment(sub: string, o: { dueMs?: number; anchor?: string } = {}) {
  // registered 200 days ago, so the stage the tick derives itself is DORMANT too (and the person is outside the 48 h welcome scan)
  await q('kiorex_platform', `update "PatientProfile" set "createdAt" = (now() at time zone 'utc') - interval '200 days' where sub = $1`, [sub]);
  await q('kiorex_platform', `insert into "PatientLifecycle" (sub, market, stage, "stageAt", "registeredAt") values ($1,'EG','DORMANT', now(), now() - interval '200 days') on conflict (sub, market) do update set stage = 'DORMANT', "stageAt" = now()`, [sub]);
  const anchor = Buffer.from(JSON.stringify({ at: Date.now() - 1000, p: {} })).toString('base64url');
  const id = `kx_lce_e2e${randomBytes(5).toString('hex')}`;
  await q('kiorex_platform', `insert into "LifecycleEnrollment" (id, sub, market, "journeyKey", "journeyVersion", state, step, "nextRunAt") values ($1,$2,'EG',$3,1,'ACTIVE',0,$4)`, [id, sub, `reengagement#${o.anchor ?? 'e2e1'}.${anchor}`, new Date(Date.now() + (o.dueMs ?? -1000)).toISOString()]);
  return id;
}
export const decisionsOf = (sub: string, journey?: string) => q('kiorex_platform', `select "journeyKey", channel, decision, reason, "messageClass" from "LifecycleMessageDecision" where sub = $1 ${journey ? 'and "journeyKey" = $2' : ''} order by at, id`, journey ? [sub, journey] : [sub]);
export const reasonsOf = async (sub: string, journey?: string) => (await decisionsOf(sub, journey)).map((d) => `${d.channel}:${d.decision}:${d.reason}`);
export const marketingCount = async (sub: string) => Number((await q('kiorex_platform', `select count(*)::int c from "Message" where sub = $1 and status in ('SENT','QUEUED','DELIVERED') and "templateId" in (select unnest($2::text[]))`, [sub, await marketingTemplateIds()]))[0].c);
let ids: string[] | undefined;
async function marketingTemplateIds() {
  if (ids) return ids;
  const t = (await kiorex(await (await import('./clients.js')).opsLogin().then((l) => l.accessToken), 'GET', `${LC}/templates`)).body as Array<{ templateId: string; messageClass: string }>;
  ids = t.filter((x) => x.messageClass === 'MARKETING').map((x) => x.templateId); return ids;
}
export const hoursAgo = (n: number) => new Date(Date.now() - n * H);
