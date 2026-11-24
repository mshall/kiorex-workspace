import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, q } from '../src/clients.js';
import { tokens } from '../src/fixtures.js';
import { freshPatient, secondSuperAdmin } from '../src/growth.js';
import { unlockForRun } from '../src/growth-p3.js';
import { LC, runTick } from '../src/growth-p2-32.js';
import { AUTO, REC, TWO_STEP, dormantForAutomation, dropSeeded, dueNow, enrolment, journeyMessages, journeyReasons, seedCampaign } from '../src/growth-p3e.js';

/**
 * GRW-P3-E marketing automation and AI-assisted recommendations on the real stack (Kiorex API + Postgres, messaging in mock mode: nothing leaves the machine). The builder API and its role matrix,
 * the server validator refusing forbidden constructs, maker-checker publication over HTTP with two real super admins, the acceptance journey (a two-step win-back that sends only to consented,
 * in-window subjects and is gated again at step 2), consent withdrawn mid-journey, the per-journey kill switch, counts-only run logs; then recommendations from seeded aggregates: advisory
 * proposals, the launch lock, approval creating a DRAFT only, rejection with a reason, small cells never proposed. Launch-locked flags get DEV test fixture gate evidence for this run only.
 * Honest limit: an HTTP-only suite cannot move the server clock, so step 2 is made due by backdating its enrolment in the dev database (the technique of the campaign suite) and quiet hours are
 * driven by the person's own window around the real "now".
 */
const cairoHour = () => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date()));
const win = (fromNow: number, len: number) => ({ quietStart: (cairoHour() + fromNow + 24) % 24, quietEnd: (cairoHour() + fromNow + len + 24) % 24 });
const RUN = Math.random().toString(36).slice(2, 7);
const KEY = `e2e55-${RUN}`; const JKEY = `auto.eg.${KEY}`;

describe('55. growth automation and recommendations: builder, maker-checker, gates, kill switch, advisory proposals', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let two: Awaited<ReturnType<typeof secondSuperAdmin>>; const undo: (() => Promise<void>)[] = []; const patients: Awaited<ReturnType<typeof freshPatient>>[] = [];
  let jid = '';
  const mk = async (name: string) => { const p = await freshPatient(name); patients.push(p); return p; };
  const consentPush = (token: string, on = true) => kiorex(token, 'PUT', '/me/preferences', { marketing: { PUSH: on }, source: 'app' });

  beforeAll(async () => { t = await tokens(); two = await secondSuperAdmin(); });
  afterAll(async () => {
    const subs = patients.map((p) => p.sub);
    if (jid) await kiorex(t.ops, 'POST', `${AUTO}/journeys/${jid}/kill`, { reason: 'e2e 55 cleanup' }).catch(() => undefined);
    if (subs.length) { await q('kiorex_platform', `update "LifecycleEnrollment" set state = 'ENDED', "nextRunAt" = null, "endReason" = 'E2E_CLEANUP' where sub = any($1) and state = 'ACTIVE'`, [subs]).catch(() => undefined); await q('kiorex_platform', `delete from "PatientLifecycle" where sub = any($1)`, [subs]).catch(() => undefined); }
    await dropSeeded().catch(() => undefined);
    await two?.drop().catch(() => undefined);
    for (const u of undo.reverse()) await u().catch(() => undefined);
  });

  describe('API surface', () => {
    it('every automation and recommendation route needs a session and an ops role; a patient is refused (401 / 403); a plain ops role cannot write', async () => {
      const p = await mk('A55 Roles');
      for (const [m, path] of [['GET', `${AUTO}/catalog`], ['GET', `${AUTO}/status`], ['GET', `${AUTO}/journeys`], ['POST', `${AUTO}/validate`], ['POST', `${AUTO}/dry-run`], ['POST', `${AUTO}/journeys`], ['POST', `${AUTO}/scan`], ['GET', REC], ['GET', `${REC}/catalog`], ['POST', `${REC}/run`], ['POST', `${REC}/x/decision`]] as const) {
        expect((await kiorex(undefined, m, path, m === 'POST' ? {} : undefined)).status, `anon ${m} ${path}`).toBe(401);
        expect((await kiorex(p.token, m, path, m === 'POST' ? {} : undefined)).status, `patient ${m} ${path}`).toBe(403);
      }
    });

    it('the catalogue is the closed vocabulary: six node types, no security or money template, no health attribute', async () => {
      const c = (await kiorex(t.ops, 'GET', `${AUTO}/catalog`)).body;
      expect(c.nodeTypes).toEqual(['TRIGGER', 'WAIT', 'CONDITION', 'SEND', 'BRANCH_EXPERIMENT', 'END']);
      const keys = c.templates.map((x: { key: string }) => x.key).join(' '); expect(keys).not.toMatch(/REWARD|NEW_DEVICE|BOOKING_CONFIRMED|DEPOSIT/);
      expect(JSON.stringify(c.attributes)).not.toMatch(/specialty|doctor|diagnos|provider|prescription/i);
      expect(c.policy).toMatchObject({ maxNodes: 12, minWaitMinutes: 15, maxSendsPerJourney: 3 });
    });

    it('the validator refuses every forbidden construct with a code and a path, and stores nothing', async () => {
      const bad = (f: (g: any) => void) => { const g = JSON.parse(JSON.stringify(TWO_STEP)); f(g); return g; };
      const cases: Array<[string, any, string]> = [
        ['a clinical condition', bad((g) => { g.nodes.splice(3, 0, { id: 'c', type: 'CONDITION', segment: { specialty: ['x'] } }); g.edges = [{ from: 'start', to: 'send1' }, { from: 'send1', to: 'wait1' }, { from: 'wait1', to: 'c' }, { from: 'c', to: 'send2' }, { from: 'send2', to: 'done' }]; }), 'CLINICAL_REFERENCE'],
        ['a GATE node', bad((g) => { g.nodes.push({ id: 'g', type: 'GATE' }); }), 'UNKNOWN_NODE_TYPE'],
        ['a 5 minute wait', bad((g) => { g.nodes[2].minutes = 5; }), 'WAIT_RANGE'],
        ['a status template', bad((g) => { g.nodes[1].template = 'REWARD_ISSUED'; }), 'TEMPLATE_NOT_ALLOWED'],
        ['a trigger outside the allowlist', bad((g) => { g.nodes[0].event = 'DIAGNOSIS_RECORDED'; }), 'TRIGGER_EVENT_NOT_ALLOWED'],
        ['an unknown top-level field', bad((g) => { g.exitConditions = []; }), 'UNKNOWN_FIELD'],
        ['a hidden fork', bad((g) => { g.edges.push({ from: 'send1', to: 'done' }); }), 'EDGE_INVALID'],
      ];
      const before = Number((await q('kiorex_platform', `select count(*)::int c from "LifecycleJourneyDefinition"`))[0].c);
      for (const [name, g, code] of cases) {
        const r = await kiorex(t.ops, 'POST', `${AUTO}/journeys`, { key: `${KEY}-bad`, name: 'bad', graph: g }); expect(r.status, name).toBe(422); expect(r.body.code).toBe('JOURNEY_INVALID');
        expect(r.body.errors.map((e: { code: string }) => e.code), name).toContain(code); expect(r.body.errors[0].path).toMatch(/^\//);
      }
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "LifecycleJourneyDefinition"`))[0].c)).toBe(before);
    });
  });

  describe('publication: maker-checker', () => {
    it('create, dry-run, submit; the author cannot approve (403); a second super admin publishes; a published journey is immutable', async () => {
      const c = await kiorex(t.ops, 'POST', `${AUTO}/journeys`, { key: KEY, name: 'E2E win-back, two steps', graph: TWO_STEP }); expect(c.status, JSON.stringify(c.body)).toBe(201); jid = c.body.id;
      const d1 = await kiorex(t.ops, 'POST', `${AUTO}/journeys/${jid}/dry-run`, { size: 400, seed: 5 }); const d2 = await kiorex(t.ops, 'POST', `${AUTO}/journeys/${jid}/dry-run`, { size: 400, seed: 5 });
      expect(d1.status).toBe(200); expect(d1.body.result).toEqual(d2.body.result); expect(d1.body.result.steps).toHaveLength(2); expect(d1.body.compiled.gateNodes).toHaveLength(2);
      expect((await kiorex(t.ops, 'POST', `${AUTO}/journeys/${jid}/approve`)).status).toBe(409); // not submitted
      expect((await kiorex(t.ops, 'POST', `${AUTO}/journeys/${jid}/submit`)).status).toBe(200);
      const self = await kiorex(t.ops, 'POST', `${AUTO}/journeys/${jid}/approve`); expect(self.status).toBe(403); expect(self.body.code).toBe('JOURNEY_TWO_PERSON_RULE');
      const ok = await kiorex(two.token, 'POST', `${AUTO}/journeys/${jid}/approve`); expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body).toMatchObject({ status: 'PUBLISHED', approvedBy: two.sub }); expect(ok.body.warnings).toContain('MARKETING_FLAG_OFF');
      expect((await kiorex(t.ops, 'PATCH', `${AUTO}/journeys/${jid}`, { name: 'changed' })).status).toBe(409);
      await expect(q('kiorex_platform', `update "LifecycleJourneyDefinition" set graph = '{}'::jsonb where id = $1`, [jid])).rejects.toThrow(/immutable/);
    });
  });

  describe('the journey runs through the P2-E send gate', () => {
    it('ACCEPTANCE (flag OFF): with growth.marketing_messaging at its launch-locked default no marketing message is created, even with consent; the decision says why', async () => {
      const p = await mk('A55 FlagOff'); await consentPush(p.token); await dormantForAutomation(p.sub);
      expect((await kiorex(t.ops, 'POST', `${AUTO}/scan`)).status).toBe(200); await runTick(t.ops);
      expect(await journeyReasons(p.sub, JKEY)).toEqual(['PUSH:SKIP:MARKETING_FLAG_OFF']); expect(await journeyMessages(p.sub, JKEY)).toBe(0);
    });

    let yes: Awaited<ReturnType<typeof freshPatient>>; let no: Awaited<ReturnType<typeof freshPatient>>; let withdrawn: Awaited<ReturnType<typeof freshPatient>>;
    it('ACCEPTANCE (flag ON): only the consented person in-window is sent step 1; the person without consent leaves the journey; nothing is sent twice', async () => {
      undo.push(await unlockForRun(t.ops, 'growth.marketing_messaging'));
      yes = await mk('A55 Yes'); no = await mk('A55 No'); withdrawn = await mk('A55 Withdrawn');
      for (const p of [yes, withdrawn]) { expect((await consentPush(p.token)).status).toBe(200); expect((await kiorex(p.token, 'PUT', '/me/notification-preferences/PUSH', win(6, 2))).status).toBe(200); } // quiet 6 to 8 hours from now: now is outside it
      for (const p of [yes, no, withdrawn]) await dormantForAutomation(p.sub);
      expect((await kiorex(t.ops, 'POST', `${AUTO}/scan`)).body.enrolled).toBeGreaterThanOrEqual(3);
      await runTick(t.ops); await runTick(t.ops);
      expect(await journeyReasons(yes.sub, JKEY)).toEqual(['PUSH:SEND:OK']); expect(await journeyMessages(yes.sub, JKEY)).toBe(1);
      expect(await journeyReasons(no.sub, JKEY)).toEqual(['PUSH:SKIP:STOPPED']); expect(await journeyMessages(no.sub, JKEY)).toBe(0);
      expect((await enrolment(no.sub, JKEY))?.endReason).toBe('STOPPED:MARKETING_CONSENT_LOST');
      const row = (await q('kiorex_platform', `select params from "Message" where sub = $1 and "dedupeKey" like $2`, [yes.sub, `lc:${JKEY}:%`]))[0]; expect(JSON.stringify(row.params)).not.toMatch(/specialty|doctor|diagnos|provider/i);
    });

    it('step 2 is gated again: due the same day, the daily marketing cap holds it back (CAP_DAY); the gate is the same one every journey passes', async () => {
      await dueNow(yes.sub, JKEY); await runTick(t.ops);
      expect(await journeyReasons(yes.sub, JKEY)).toEqual(['PUSH:SEND:OK', 'PUSH:SKIP:CAP_DAY']); expect(await journeyMessages(yes.sub, JKEY)).toBe(1);
    });

    it('consent withdrawn mid-journey: the next evaluation ends the journey and nothing more is sent', async () => {
      expect(await journeyMessages(withdrawn.sub, JKEY)).toBe(1);
      expect((await consentPush(withdrawn.token, false)).status).toBe(200);
      await dueNow(withdrawn.sub, JKEY); await runTick(t.ops);
      expect((await enrolment(withdrawn.sub, JKEY))?.endReason).toBe('STOPPED:MARKETING_CONSENT_LOST'); expect(await journeyMessages(withdrawn.sub, JKEY)).toBe(1);
    });

    it('the run log holds counts only, per day', async () => {
      const j = (await kiorex(t.ops, 'GET', `${AUTO}/journeys/${jid}`)).body;
      expect(j.runLog.length).toBeGreaterThan(0); expect(j.runLog[0]).toHaveProperty('sent'); expect(Object.keys(j.runLog[0]).sort()).toEqual(['byReason', 'day', 'ended', 'enrolled', 'sent', 'skipped']);
      expect(j.runLog.reduce((a: number, r: { sent: number }) => a + r.sent, 0)).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(j.runLog)).not.toContain(yes.sub);
    });

    it('the per-journey kill switch: the next tick ends every enrolment with KILLED, nothing is sent, and a new person is not enrolled', async () => {
      const late = await mk('A55 Late'); await consentPush(late.token); await kiorex(late.token, 'PUT', '/me/notification-preferences/PUSH', win(-1, 2)); await dormantForAutomation(late.sub); await kiorex(t.ops, 'POST', `${AUTO}/scan`);
      expect((await kiorex(t.ops, 'POST', `${AUTO}/journeys/${jid}/kill`, { reason: '' })).status).toBe(400);
      expect((await kiorex(t.ops, 'POST', `${AUTO}/journeys/${jid}/kill`, { reason: 'e2e kill switch check' })).status).toBe(200);
      const before = await journeyMessages(late.sub, JKEY);
      expect((await enrolment(late.sub, JKEY))?.endReason).toBeNull(); // still running (deferred by quiet hours or waiting): it is the one the kill switch must stop
      await dueNow(late.sub, JKEY); await runTick(t.ops);
      expect((await enrolment(late.sub, JKEY))?.endReason).toBe('KILLED'); expect(await journeyMessages(late.sub, JKEY)).toBe(before); expect(before).toBe(0);
      const another = await mk('A55 After'); await consentPush(another.token); await dormantForAutomation(another.sub);
      await kiorex(t.ops, 'POST', `${AUTO}/scan`); expect(await enrolment(another.sub, JKEY)).toBeUndefined();
    });

    it('the lifecycle console lists nothing new to send: no automation message exists for a person who never consented', async () => {
      expect((await q('kiorex_platform', `select count(*)::int c from "Message" where sub = any($1) and "dedupeKey" like $2`, [[no.sub], `lc:${JKEY}:%`]))[0].c).toBe(0);
      expect((await kiorex(t.ops, 'GET', LC)).status).toBe(200);
    });
  });

  describe('recommendations: advisory, aggregate-only, human approved', () => {
    it('LOCKED: growth.ai_recommendations is launch-locked: without gate evidence running proposals answers 403 FEATURE_DISABLED and reading keeps working', async () => {
      const r = await kiorex(t.ops, 'POST', `${REC}/run`, {}); expect(r.status).toBe(403); expect(r.body.code).toBe('FEATURE_DISABLED');
      expect((await kiorex(t.ops, 'GET', REC)).status).toBe(200);
    });

    let rid = ''; let pauseId = '';
    it('builds proposals from aggregates only: a budget move and a pause, a small cell (5 patients) is never proposed, a health word in a campaign key is dropped, nothing changes', async () => {
      undo.push(await unlockForRun(t.ops, 'growth.ai_recommendations'));
      await seedCampaign(`e2e55-ref-${RUN}`, 'REFERRAL', { spend: 100_000, attended: 50 }); await seedCampaign(`e2e55-search-${RUN}`, 'PAID_SEARCH', { spend: 800_000, attended: 40 });
      await seedCampaign(`e2e55-quiet-${RUN}`, 'PAID_SOCIAL', { spend: 200_000, attended: 0 }); await seedCampaign(`e2e55-small-${RUN}`, 'PAID_VIDEO', { spend: 400_000, attended: 5 }); await seedCampaign(`e2e55-cardiology-${RUN}`, 'EMAIL', { spend: 300_000, attended: 0 });
      const before = Number((await q('kiorex_platform', `select count(*)::int c from "GrowthCampaign" where status = 'ACTIVE' and key like 'e2e55-%'`))[0].c);
      const r = await kiorex(t.ops, 'POST', `${REC}/run`, {}); expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.dropped.map((d: { fingerprint: string }) => d.fingerprint).join(' ')).toContain('cardiology');
      const list = (await kiorex(t.ops, 'GET', `${REC}?status=PROPOSED`)).body as any[];
      const mine = list.filter((x) => JSON.stringify(x.payload).includes(RUN) || x.kind === 'REALLOCATE_BUDGET');
      expect(mine.length).toBeGreaterThanOrEqual(2); for (const x of mine) { expect(x.status).toBe('PROPOSED'); expect(x.rationale.en.length).toBeGreaterThan(20); expect(x.rationale.ar).toMatch(/[؀-ۿ]/); expect(JSON.stringify(x)).not.toMatch(/small-|cardiology/); }
      rid = mine.find((x) => x.kind === 'REALLOCATE_BUDGET')?.id; pauseId = mine.find((x) => x.kind === 'PAUSE_CAMPAIGN' && JSON.stringify(x.payload).includes(`e2e55-quiet-${RUN}`))?.id;
      expect(rid).toBeTruthy(); expect(pauseId).toBeTruthy();
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "GrowthCampaign" where status = 'ACTIVE' and key like 'e2e55-%'`))[0].c)).toBe(before); // proposals changed nothing
      expect((await kiorex(t.ops, 'POST', `${REC}/run`, {})).body.created).toBe(0); // idempotent per open fingerprint
    });

    it('approving a pause proposal changes nothing; rejecting needs a reason; a second decision is refused', async () => {
      const a = await kiorex(t.ops, 'POST', `${REC}/${pauseId}/decision`, { decision: 'APPROVE' }); expect(a.status).toBe(200); expect(a.body).toMatchObject({ status: 'APPROVED', convertedRef: null, next: { screen: '/growth/campaigns' } });
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "GrowthCampaign" where status = 'ACTIVE' and key = $1`, [`e2e55-quiet-${RUN}`]))[0].c)).toBe(1);
      expect((await kiorex(t.ops, 'POST', `${REC}/${pauseId}/decision`, { decision: 'REJECT', note: 'again' })).status).toBe(409);
      expect((await kiorex(two.token, 'POST', `${REC}/${rid}/decision`, { decision: 'REJECT' })).status).toBe(400);
    });

    it('ACCEPTANCE: approving the budget move creates a DRAFT campaign only: not active, no spend, no budget change; activating it still needs its own approval', async () => {
      const spendBefore = Number((await q('kiorex_platform', `select coalesce(sum("amountMinor"),0)::int s from "GrowthSpendEntry"`))[0].s);
      const r = await kiorex(two.token, 'POST', `${REC}/${rid}/decision`, { decision: 'APPROVE', note: 'e2e' }); expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body).toMatchObject({ status: 'CONVERTED', conversionError: null }); expect(r.body.convertedRef).toMatch(/^campaign:/);
      const id = r.body.convertedRef.split(':')[1]; const c = (await q('kiorex_platform', `select status, "activatedAt", channels, key, "approvedPayloadHash" from "GrowthCampaign" where id = $1`, [id]))[0];
      expect(c.status).toBe('DRAFT'); expect(c.activatedAt).toBeNull(); expect(c.channels).toEqual(['REFERRAL']); expect(c.key).toMatch(/^rec-/); expect(c.approvedPayloadHash).toBeNull();
      expect(Number((await q('kiorex_platform', `select coalesce(sum("amountMinor"),0)::int s from "GrowthSpendEntry"`))[0].s)).toBe(spendBefore);
      await q('kiorex_platform', `update "GrowthCampaign" set "ownerSub" = 'e2e55' where id = $1`, [id]);
      const act = await kiorex(two.token, 'POST', `/admin/growth/campaigns/${id}/transition`, { to: 'ACTIVE' }); expect(act.status).toBeGreaterThanOrEqual(400);
      expect((await q('kiorex_platform', `select status from "GrowthCampaign" where id = $1`, [id]))[0].status).toBe('DRAFT');
      const rec = (await kiorex(t.ops, 'GET', `${REC}/${rid}`)).body; expect(rec.status).toBe('CONVERTED'); expect(['mock', 'rules']).toContain(rec.modelMode); if (rec.aiAssisted) expect(rec.aiSummary.label).toBe('AI-assisted'); // the daily cap of 20 summaries per market can switch a busy dev database to rules-only: that is the cost breaker working
      expect((await kiorex(t.ops, 'POST', `${REC}/${rid}/feedback`, { value: 'USEFUL' })).body.feedback).toBe('USEFUL');
    });
  });
});
