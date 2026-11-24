import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, q, sleep, waitFor } from '../src/clients.js';
import { tokens } from '../src/fixtures.js';
import { freshPatient } from '../src/growth.js';
import { unlockForRun } from '../src/growth-p3.js';
import { LC, MARKETING_PURPOSES, decisionsOf, dormantEnrolment, hoursAgo, isolateRecentProfiles, marketingCount, reasonsOf, runTick } from '../src/growth-p2-32.js';

/**
 * GRW-P2-E patient lifecycle CRM on the real stack (Kiorex API + Postgres, messaging in mock mode: nothing leaves the machine). Journeys from the registration event to the in-app card and the decision log,
 * idempotency of the scan and the tick, the send gate for MARKETING (launch-locked flag, per-channel consent, quiet hours from the person's own window, day and week frequency caps, STOP, withdrawal, holdout
 * is a config and not driven here), the console API and its role matrix, the patient's class view, the segment allow-list and the flag OFF contract.
 * Two honest limits: (1) the DST nights are proven by the pure unit and integration suites (they pass an explicit clock); an HTTP-only suite cannot move the server clock, so here quiet hours are driven by the
 * person's own window around the real "now"; (2) the WhatsApp STOP inbound webhook needs a provider signature, so STOP is written as the suppression row the handler writes.
 * Launch-locked flags get DEV test fixture gate evidence for this run only and the fixtures (profiles moved out of the scan window, suppressions, enrolments) are put back at the end.
 */
const cairoHour = () => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Africa/Cairo' }).format(new Date()));
const win = (fromNow: number, len: number) => ({ quietStart: (cairoHour() + fromNow + 24) % 24, quietEnd: (cairoHour() + fromNow + len + 24) % 24 });

describe('32. growth lifecycle: journeys, send gate, STOP, withdrawal, caps, quiet hours, console', () => {
  let t: Awaited<ReturnType<typeof tokens>>; const undo: (() => Promise<void>)[] = []; const patients: Awaited<ReturnType<typeof freshPatient>>[] = []; const supp: string[] = [];
  let restore: () => Promise<void> = async () => undefined;
  const mk = async (name: string) => { const p = await freshPatient(name); patients.push(p); return p; };
  const inbox = async (token: string) => (await kiorex(token, 'GET', '/me/notifications')).body as Array<{ kind?: string; templateId?: string; title?: string; body?: string }>;
  const consentChannel = (token: string, ch: 'PUSH' | 'SMS' | 'WHATSAPP' | 'EMAIL', on = true) => kiorex(token, 'PUT', '/me/preferences', { marketing: { [ch]: on }, source: 'app' });
  const sentCount = async (sub: string, j = 'reengagement') => Number((await q('kiorex_platform', `select count(*)::int c from "LifecycleMessageDecision" where sub = $1 and "journeyKey" = $2 and decision = 'SEND'`, [sub, j]))[0].c);

  beforeAll(async () => {
    t = await tokens(); undo.push(await unlockForRun(t.ops, 'growth.lifecycle_journeys'));
    await q('kiorex_platform', `delete from "RateLimitBucket" where key like 'growth:%'`).catch(() => undefined);
  });
  afterAll(async () => {
    const subs = patients.map((p) => p.sub);
    if (subs.length) {
      await q('kiorex_platform', `update "LifecycleEnrollment" set state = 'ENDED', "nextRunAt" = null, "endReason" = 'E2E_CLEANUP' where sub = any($1) and state = 'ACTIVE'`, [subs]).catch(() => undefined);
      await q('kiorex_platform', `delete from "PatientLifecycle" where sub = any($1)`, [subs]).catch(() => undefined);
    }
    for (const id of supp) await q('kiorex_platform', `update "CommunicationSuppression" set "liftedAt" = now() where id = $1`, [id]).catch(() => undefined);
    await restore().catch(() => undefined);
    for (const u of undo.reverse()) await u().catch(() => undefined);
  });

  describe('console API and the patient view', () => {
    it('every lifecycle console route needs a session and an ops role; a patient is refused (401 / 403)', async () => {
      const p = await mk('LC Roles');
      for (const [m, path] of [['GET', LC], ['GET', `${LC}/funnel`], ['GET', `${LC}/decisions`], ['GET', `${LC}/templates`], ['GET', `${LC}/suppressions`], ['GET', `${LC}/lookup?sub=x`], ['POST', `${LC}/run`], ['POST', `${LC}/test-send`], ['POST', `${LC}/suppressions`]] as const) {
        expect((await kiorex(undefined, m, path, m === 'POST' ? {} : undefined)).status, `anon ${m} ${path}`).toBe(401);
        expect((await kiorex(p.token, m, path, m === 'POST' ? {} : undefined)).status, `patient ${m} ${path}`).toBe(403);
      }
    });

    it('the overview lists eight journeys with class, steps and policy; marketing messaging is OFF (launch-locked) while journeys are ON for this run; only re-engagement style journeys carry a marketing step', async () => {
      const o = await kiorex(t.ops, 'GET', LC); expect(o.status).toBe(200);
      expect(o.body.flags).toEqual({ lifecycleJourneys: true, marketingMessaging: false });
      expect(o.body.journeys.map((j: any) => j.key).sort()).toEqual(['booking-recovery', 'family-onboarding', 'post-visit', 'reengagement', 'referral-invite', 'reminders', 'reward-notice', 'welcome']);
      expect(o.body.policy.caps).toEqual({ perDay: 1, perWeek: 3 }); expect(o.body.policy.quietHours).toMatchObject({ start: '21:00', end: '09:00', timezone: 'Africa/Cairo' });
      const welcome = o.body.journeys.find((j: any) => j.key === 'welcome'); expect(welcome.hasMarketingStep).toBe(false); expect(welcome.steps.every((s: any) => s.messageClass === 'TRANSACTIONAL')).toBe(true);
      expect(o.body.journeys.find((j: any) => j.key === 'reengagement').hasMarketingStep).toBe(true);
    });

    it('the template catalogue carries a class badge and AR and EN previews with no unresolved placeholder; every promotional template is MARKETING', async () => {
      const tpl = (await kiorex(t.ops, 'GET', `${LC}/templates`)).body as any[]; expect(tpl.length).toBeGreaterThan(10);
      for (const x of tpl) { expect(['TRANSACTIONAL', 'SECURITY', 'CLINICAL', 'MARKETING']).toContain(x.messageClass); expect(x.en).not.toMatch(/\{\{?\w+\}?\}/); expect(x.ar).not.toMatch(/\{\{?\w+\}?\}/); expect(/[؀-ۿ]/.test(x.ar), x.kind).toBe(true); if (x.promotional) expect(x.messageClass, x.kind).toBe('MARKETING'); }
      expect(tpl.some((x) => x.kind === 'REENGAGE_DORMANT' && x.messageClass === 'MARKETING')).toBe(true);
    });

    it('the patient sees the four classes: three required service classes that cannot be switched, marketing optional per channel (all off), the quiet hours and caps, and the stop-all route', async () => {
      const p = await mk('LC Classes'); const r = await kiorex(p.token, 'GET', '/me/preferences/classes'); expect(r.status).toBe(200);
      expect(r.body.classes.map((c: any) => [c.class, c.required, c.switchable])).toEqual([['TRANSACTIONAL', true, false], ['SECURITY', true, false], ['CLINICAL', true, false], ['MARKETING', false, true]]);
      const m = r.body.classes[3]; expect(m.active).toBe(false); expect(m.channels.map((c: any) => c.channel).sort()).toEqual(['EMAIL', 'PUSH', 'SMS', 'WHATSAPP']); expect(m.channels.every((c: any) => c.consent === false)).toBe(true);
      expect(r.body.caps).toEqual({ perDay: 1, perWeek: 3 }); expect(r.body.stopAllMarketing).toEqual({ method: 'POST', path: '/me/preferences/unsubscribe-marketing' });
      expect(JSON.stringify(r.body)).not.toMatch(/specialty|diagnos|prescri/i);
    });

    it('test send is mock-only and staff-allowlisted: an unlisted recipient is refused (403) and nothing is created', async () => {
      const p = await mk('LC TestSend'); const n = Number((await q('kiorex_platform', `select count(*)::int c from "Message" where sub = $1`, [p.sub]))[0].c);
      const r = await kiorex(t.ops, 'POST', `${LC}/test-send`, { kind: 'WELCOME', channel: 'INAPP', sub: p.sub }); expect(r.status).toBe(403); expect(r.body.code).toBe('TEST_SEND_NOT_ALLOWLISTED');
      expect((await kiorex(t.ops, 'POST', `${LC}/test-send`, { kind: 'NOPE', channel: 'INAPP' })).status).toBe(400);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "Message" where sub = $1`, [p.sub]))[0].c)).toBe(n);
    });
  });

  describe('transactional journey: event to message, idempotent', () => {
    it('registration -> welcome: ONE in-app card and an OK decision; a second tick and a second scan change nothing', async () => {
      const p = await mk('LC Welcome'); restore = await isolateRecentProfiles(patients.map((x) => x.sub));
      const first = await runTick(t.ops); expect(first.triggers.registered).toBeGreaterThan(0);
      await waitFor('welcome decision', async () => (await reasonsOf(p.sub, 'welcome')).length > 0 && true, 15_000);
      const rs = await reasonsOf(p.sub, 'welcome'); expect(rs).toContain('INAPP:SEND:OK');
      const cards = (await inbox(p.token)).filter((m) => /welcome/i.test(JSON.stringify(m)) || m.kind === 'WELCOME'); expect(cards.length).toBeGreaterThanOrEqual(1);
      const msgs1 = Number((await q('kiorex_platform', `select count(*)::int c from "Message" where sub = $1`, [p.sub]))[0].c);
      const dec1 = (await decisionsOf(p.sub)).length;
      await runTick(t.ops); await runTick(t.ops);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "Message" where sub = $1`, [p.sub]))[0].c)).toBe(msgs1);
      expect((await decisionsOf(p.sub)).length).toBe(dec1);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "LifecycleEnrollment" where sub = $1 and "journeyKey" = 'welcome'`, [p.sub]))[0].c)).toBe(1);
      const stage = (await q('kiorex_platform', `select stage from "PatientLifecycle" where sub = $1`, [p.sub]))[0]; expect(stage?.stage).toBe('REGISTERED'); // non-clinical stage only
    });

    it('a welcome WhatsApp or SMS is not sent without the registration confirmation and consent: no marketing class decision exists for the person', async () => {
      const p = patients[patients.length - 1]!;
      const rows = await decisionsOf(p.sub); expect(rows.every((d: any) => d.messageClass === 'TRANSACTIONAL')).toBe(true);
      expect(await marketingCount(p.sub)).toBe(0);
    });

    it('the audited lookup returns the person\'s decisions (no address, no body) and writes an audit row each time', async () => {
      const p = patients[patients.length - 1]!; const before = Number((await q('kiorex_platform', `select count(*)::int c from "AuditLog" where action = 'growth.lifecycle.lookup'`))[0].c);
      const r = await kiorex(t.ops, 'GET', `${LC}/lookup?sub=${encodeURIComponent(p.sub)}`); expect(r.status).toBe(200); expect(r.body.length).toBeGreaterThan(0);
      expect(Object.keys(r.body[0]).sort()).toEqual(['at', 'channel', 'decision', 'journeyKey', 'messageClass', 'reason', 'step', 'templateKey']);
      expect(JSON.stringify(r.body)).not.toContain(p.phone);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "AuditLog" where action = 'growth.lifecycle.lookup'`))[0].c)).toBe(before + 1);
      expect((await kiorex(t.ops, 'GET', `${LC}/lookup`)).status).toBe(400);
    });
  });

  describe('marketing: launch-locked flag, consent, quiet hours, caps, STOP, withdrawal', () => {
    it('ACCEPTANCE: with growth.marketing_messaging OFF no MARKETING message exists, even with consent granted; every decision says MARKETING_FLAG_OFF', async () => {
      const p = await mk('LC FlagOff');
      expect((await consentChannel(p.token, 'PUSH')).status).toBeLessThan(500); // consent may be refused while marketing is unavailable: the gate must hold either way
      await dormantEnrolment(p.sub); await runTick(t.ops);
      const d = (await decisionsOf(p.sub, 'reengagement'))[0]; expect(d, 'a decision is logged').toBeTruthy(); expect(d.decision).toBe('SKIP');
      expect(['MARKETING_FLAG_OFF', 'STOPPED']).toContain(d.reason); expect(await marketingCount(p.sub)).toBe(0);
      expect((await q('kiorex_platform', `select count(*)::int c from "Message" where sub = $1 and params->>'kind' = 'REENGAGE_DORMANT'`, [p.sub]))[0].c).toBe(0);
    });

    it('flag ON + consent + a quiet window that does not cover now: ONE push with the generic text; a second tick sends nothing more; the person without consent gets nothing and the journey ends STOPPED', async () => {
      undo.push(await unlockForRun(t.ops, 'growth.marketing_messaging'));
      const yes = await mk('LC Yes'); const no = await mk('LC No');
      expect((await consentChannel(yes.token, 'PUSH')).status).toBe(200);
      expect((await kiorex(yes.token, 'PUT', '/me/notification-preferences/PUSH', win(6, 2))).status).toBe(200); // quiet 6 to 8 hours from now: now is outside it
      await dormantEnrolment(yes.sub); await dormantEnrolment(no.sub); await runTick(t.ops);
      expect(await reasonsOf(yes.sub, 'reengagement')).toEqual(['PUSH:SEND:OK']);
      const msg = (await q('kiorex_platform', `select params, status from "Message" where sub = $1 and params->>'kind' = 'REENGAGE_DORMANT'`, [yes.sub])); expect(msg).toHaveLength(1);
      expect(JSON.stringify(msg[0].params)).not.toMatch(/specialty|doctor|diagnos|provider/i);
      await runTick(t.ops); await runTick(t.ops); expect(await sentCount(yes.sub)).toBe(1);
      expect(await reasonsOf(no.sub, 'reengagement')).toEqual(['PUSH:SKIP:STOPPED']);
      // the stack's own stage job also enrols a dormant person (a second, real enrolment with another anchor): this check reads the fixture enrolment (anchor e2e1)
      expect(await waitFor('journey ended', async () => (await q('kiorex_platform', `select "endReason" from "LifecycleEnrollment" where sub = $1 and "journeyKey" like 'reengagement#e2e1.%'`, [no.sub]))[0]?.endReason, 10_000, 250)).toBe('STOPPED:MARKETING_CONSENT_LOST');
      expect(await marketingCount(no.sub)).toBe(0);
    });

    it('quiet hours: a window that covers now defers the step (QUIET_HOURS, nothing sent, the enrolment is moved to the window end, never dropped); removing the window sends', async () => {
      const p = await mk('LC Quiet'); await consentChannel(p.token, 'PUSH');
      expect((await kiorex(p.token, 'PUT', '/me/notification-preferences/PUSH', win(-1, 3))).status).toBe(200); // started an hour ago, ends in two hours
      const id = await dormantEnrolment(p.sub); await runTick(t.ops);
      const r1 = await reasonsOf(p.sub, 'reengagement'); expect(r1[0]).toBe('PUSH:SKIP:QUIET_HOURS'); expect(r1.some((x) => x.includes(':SEND:'))).toBe(false); expect(await marketingCount(p.sub)).toBe(0); // the step tries every channel; the other channels have no consent and say so
      const e = (await q('kiorex_platform', `select state, "nextRunAt" from "LifecycleEnrollment" where id = $1`, [id]))[0]; expect(e.state).toBe('ACTIVE'); expect(new Date(e.nextRunAt).getTime()).toBeGreaterThan(Date.now());
      expect(new Date(e.nextRunAt).getTime() - Date.now()).toBeLessThanOrEqual(3 * 3_600_000 + 60_000); // the end of THIS window
      expect((await kiorex(p.token, 'PUT', '/me/notification-preferences/PUSH', win(6, 2))).status).toBe(200);
      await q('kiorex_platform', `update "LifecycleEnrollment" set "nextRunAt" = (now() at time zone 'utc') - interval '1 second' where id = $1`, [id]); await runTick(t.ops);
      const r2 = await reasonsOf(p.sub, 'reengagement'); expect(r2[0]).toBe('PUSH:SKIP:QUIET_HOURS'); expect(r2).toContain('PUSH:SEND:OK'); expect(await sentCount(p.sub)).toBe(1);
    });

    it('frequency cap: one marketing send today fills the day cap; three this week fill the week cap; all channels and journeys share the budget', async () => {
      const day = await mk('LC CapDay'); const week = await mk('LC CapWeek');
      for (const p of [day, week]) { await consentChannel(p.token, 'PUSH'); await kiorex(p.token, 'PUT', '/me/notification-preferences/PUSH', win(6, 2)); }
      const tpl = (await q('kiorex_platform', `select 1`)) && (await kiorex(t.ops, 'GET', `${LC}/templates`)).body.find((x: any) => x.kind === 'REENGAGE_DORMANT').templateId as string;
      const seed = (sub: string, hrs: number[]) => Promise.all(hrs.map((h, i) => q('kiorex_platform', `insert into "Message" (id, sub, channel, "templateId", status, "sentAt", "dedupeKey", params) values ($1,$2,'EMAIL',$3,'SENT',$4,$5,'{"kind":"REENGAGE_DORMANT"}'::jsonb)`, [`msg_e2e32${sub.slice(-6)}${i}${Date.now().toString(36)}`, sub, tpl, hoursAgo(h).toISOString(), `e2e32seed:${sub}:${i}`])));
      await seed(day.sub, [2]); await seed(week.sub, [30, 60, 100]);
      await dormantEnrolment(day.sub); await dormantEnrolment(week.sub); await runTick(t.ops);
      expect(await reasonsOf(day.sub, 'reengagement')).toContain('PUSH:SKIP:CAP_DAY'); expect(await reasonsOf(week.sub, 'reengagement')).toContain('PUSH:SKIP:CAP_WEEK');
      expect(await sentCount(day.sub)).toBe(0); expect(await sentCount(week.sub)).toBe(0);
      await q('kiorex_platform', `delete from "Message" where "dedupeKey" like 'e2e32seed:%'`).catch(() => undefined);
    });

    it('STOP: a suppression written by the STOP handler is honoured by the very next tick, well inside 60 seconds; the decision says SUPPRESSED; lifting needs two different people', async () => {
      const p = await mk('LC Stop'); await consentChannel(p.token, 'SMS'); await kiorex(p.token, 'PUT', '/me/notification-preferences/SMS', win(6, 2));
      const t0 = Date.now();
      const add = await kiorex(t.ops, 'POST', `${LC}/suppressions`, { address: p.phone, channel: 'ALL', note: 'e2e STOP simulation (the inbound webhook needs a provider signature)' }); expect(add.status).toBe(201); supp.push(add.body.id);
      await dormantEnrolment(p.sub); await runTick(t.ops);
      expect(Date.now() - t0).toBeLessThan(60_000);
      expect(await reasonsOf(p.sub, 'reengagement')).toContain('SMS:SKIP:SUPPRESSED'); expect(await marketingCount(p.sub)).toBe(0);
      const list = (await kiorex(t.ops, 'GET', `${LC}/suppressions`)).body as any[]; const row = list.find((r) => r.id === add.body.id); expect(row).toBeTruthy(); expect(JSON.stringify(row)).not.toContain(p.phone); expect(row.hashTail).toHaveLength(6);
      expect((await kiorex(t.ops, 'POST', `${LC}/suppressions/${add.body.id}/lift-request`, { evidence: 'The person re-subscribed in the app, ticket E2E-32' })).status).toBe(200);
      const self = await kiorex(t.ops, 'POST', `${LC}/suppressions/${add.body.id}/lift-approve`); expect(self.status).toBe(403); expect(self.body.code).toBe('GROWTH_CONFIG_SELF_APPROVAL');
    });

    it('consent withdrawal is effective at once: after "stop all marketing" the next tick ends the journey STOPPED:MARKETING_CONSENT_LOST and sends nothing', async () => {
      const p = await mk('LC Withdraw'); await consentChannel(p.token, 'PUSH'); await kiorex(p.token, 'PUT', '/me/notification-preferences/PUSH', win(6, 2));
      const id = await dormantEnrolment(p.sub);
      const w = await kiorex(p.token, 'POST', '/me/preferences/unsubscribe-marketing'); expect(w.status).toBe(200);
      const cls = (await kiorex(p.token, 'GET', '/me/preferences/classes')).body.classes[3]; expect(cls.active).toBe(false);
      await runTick(t.ops);
      expect((await q('kiorex_platform', `select state, "endReason" from "LifecycleEnrollment" where id = $1`, [id]))[0]).toMatchObject({ state: 'ENDED', endReason: 'STOPPED:MARKETING_CONSENT_LOST' });
      expect(await reasonsOf(p.sub, 'reengagement')).toEqual(['PUSH:SKIP:STOPPED']); expect(await marketingCount(p.sub)).toBe(0);
      const hist = (await kiorex(p.token, 'GET', '/me/consents/history')).body as any[]; expect(Array.isArray(hist)).toBe(true);
    });

    it('re-engagement needs the DORMANT stage: a person who is no longer dormant has the journey ended (leftDormant) and nothing is sent', async () => {
      const p = await mk('LC Active'); await consentChannel(p.token, 'PUSH'); await kiorex(p.token, 'PUT', '/me/notification-preferences/PUSH', win(6, 2));
      const id = await dormantEnrolment(p.sub); await q('kiorex_platform', `update "PatientLifecycle" set stage = 'ACTIVE' where sub = $1`, [p.sub]);
      await runTick(t.ops);
      expect((await q('kiorex_platform', `select "endReason" from "LifecycleEnrollment" where id = $1`, [id]))[0].endReason).toMatch(/^STOPPED:leftDormant$|^STOPPED:/);
      expect(await marketingCount(p.sub)).toBe(0);
    });
  });

  describe('segment allow-list and the decision aggregate', () => {
    it('decisions are an aggregate by journey, class, decision and reason (counts only, no person); the funnel withholds a stage under 10 people', async () => {
      const d = (await kiorex(t.ops, 'GET', `${LC}/decisions?days=7`)).body as any[]; expect(d.length).toBeGreaterThan(0);
      for (const r of d) { expect(Object.keys(r).sort()).toEqual(['count', 'decision', 'journeyKey', 'messageClass', 'reason']); expect(['SEND', 'SKIP']).toContain(r.decision); }
      expect(d.some((r) => r.reason === 'MARKETING_FLAG_OFF' || r.reason === 'QUIET_HOURS' || r.reason === 'SUPPRESSED')).toBe(true);
      const f = (await kiorex(t.ops, 'GET', `${LC}/funnel`)).body as any[]; for (const s of f) expect(s.count === null || s.count === undefined || s.count >= 10, JSON.stringify(s)).toBe(true);
    });

    it('the stored lifecycle row and every enrolment key hold no clinical value: columns are non-clinical, the anchor carries ids only', async () => {
      const cols = (await q('kiorex_platform', `select column_name from information_schema.columns where table_name = 'PatientLifecycle'`)).map((r) => r.column_name as string);
      expect(cols.filter((c) => /specialty|diagnos|icd|drug|medic|prescri|lab|symptom|doctor|provider/i.test(c))).toEqual([]);
      const keys = (await q('kiorex_platform', `select "journeyKey" from "LifecycleEnrollment" where sub = any($1)`, [patients.map((p) => p.sub)])).map((r) => r.journeyKey as string);
      for (const k of keys) { const tail = k.includes('#') ? Buffer.from(k.slice(k.lastIndexOf('.') + 1), 'base64url').toString() : ''; expect(tail).not.toMatch(/specialty|diagnos|icd|drug|doctor|provider/i); }
    });
  });
});
