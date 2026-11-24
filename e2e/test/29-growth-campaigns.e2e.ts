import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, providerBySpecialty, type Provider } from '../src/fixtures.js';
import { kiorex, q } from '../src/clients.js';
import { KIOREX_API } from '../src/env.js';
import { bookWith, freshPatient, secondSuperAdmin } from '../src/growth.js';
import { CAMPAIGNS, approvedSpend, approveCampaign, campaignBody, createCampaign, getCampaign, purgeCampaigns, runScheduler, seedCampaignTouch } from '../src/growth-p2.js';

/**
 * GRW-P2-A on the real local stack: campaign plan, maker-checker with a second Passport super admin, scheduler, tracked link resolve, spend lines approved by the other admin, utilisation alerts,
 * auto pause at 100 percent, budget increase approval, daily cap guardrail, a campaign touch followed by a real booking (decision, rollup campaign dimension, report masking), completion, archive, audit.
 * No real ad platform exists anywhere in this flow (AD-1): the module has no outbound HTTP at all. Fixtures (campaigns, spend lines, touches) are removed at the end.
 */
describe('growth campaigns: plan, approval, schedule, run, budget pause, guardrails, UTM touch to booking, spend reconciliation', () => {
  let a: string; let b: string; let drop = async () => undefined as unknown; let p: Provider; const created: string[] = [];
  beforeAll(async () => { const t = await tokens(); a = t.ops; const s = await secondSuperAdmin(); b = s.token; drop = s.drop; p = await providerBySpecialty(t.p1, 'paediatrics'); });
  afterAll(async () => { await purgeCampaigns(created).catch(() => undefined); await drop(); });
  const mk = async (o = {}) => { const k = await createCampaign(a, o); created.push(k.id); return k; };

  it('a campaign is a DRAFT plan with its UTM tag and tracked links; nothing reaches an ad platform; invalid plans and clinical audiences are refused with reasons', async () => {
    const k = await mk({ utmConfig: { targetPath: '/doctors', content: 'e2e-banner' } });
    expect(k.status).toBe('DRAFT'); expect(k.utmCampaign).toBe(`eg-${k.key}`);
    const full = await getCampaign(a, k.id);
    expect(full.links.webUrl).toBe(`https://kiorex.com/ar/eg/doctors?utm_source=kiorex&utm_medium=email&utm_campaign=eg-${k.key}&utm_content=e2e-banner`);
    expect(full.approval).toMatchObject({ required: true, reasons: ['POLICY_FLAG'] });
    const bad = await kiorex(a, 'POST', CAMPAIGNS, campaignBody({ eligibility: { specialty: ['cardiology'] }, budgetDailyMinor: 2_000_000 }));
    expect(bad.status).toBe(422); expect(bad.body.code).toBe('CAMPAIGN_INVALID'); expect(JSON.stringify(bad.body.errors)).toMatch(/not an allowed eligibility key/);
    expect((await kiorex(a, 'POST', CAMPAIGNS, campaignBody({ key: k.key }))).body.code).toBe('CAMPAIGN_KEY_TAKEN');
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/transition`, { to: 'SCHEDULED' })).body.code).toBe('CAMPAIGN_APPROVAL_REQUIRED');
  });

  it('maker-checker: the requester cannot decide, the second super admin can; the scheduler starts it; only then does the public resolve answer, with no budget in the answer', async () => {
    const k = await mk(); const ask = (await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/approvals`, { kind: 'ACTIVATE' })).body;
    expect((await getCampaign(a, k.id)).status).toBe('PENDING_APPROVAL');
    const self = await kiorex(a, 'POST', `${CAMPAIGNS}/approvals/${ask.id}/decide`, { decision: 'APPROVED', snapshotHash: ask.snapshotHash }); expect(self.status).toBe(403); expect(self.body.code).toBe('CAMPAIGN_SELF_APPROVAL');
    expect((await kiorex(b, 'POST', `${CAMPAIGNS}/approvals/${ask.id}/decide`, { decision: 'APPROVED', snapshotHash: ask.snapshotHash })).status).toBe(200);
    expect((await getCampaign(a, k.id)).status).toBe('SCHEDULED');
    expect((await kiorex(undefined, 'GET', `/growth/v1/campaign/resolve?utm_campaign=${k.utmCampaign}`)).status).toBe(404); // not started yet
    expect((await runScheduler(a)).activated).toBeGreaterThanOrEqual(1);
    expect((await getCampaign(a, k.id)).status).toBe('ACTIVE');
    const r = await kiorex(undefined, 'GET', `/growth/v1/campaign/resolve?utm_campaign=${k.utmCampaign}&locale=en`);
    expect(r.status).toBe(200); expect(r.body).toEqual({ landing: { path: '/en/eg', locale: 'en', landingPageId: null }, campaignToken: k.utmCampaign }); expect(JSON.stringify(r.body)).not.toMatch(/budget|spend|channel|eligib/i);
    const hist = (await kiorex(a, 'GET', `${CAMPAIGNS}/${k.id}/history`)).body.map((h: any) => `${h.from}>${h.to}:${h.actor}`);
    expect(hist).toEqual(expect.arrayContaining(['DRAFT>PENDING_APPROVAL:' + (await q('kiorex_platform', `select "ownerSub" from "GrowthCampaign" where id = $1`, [k.id]))[0].ownerSub, 'SCHEDULED>ACTIVE:system:scheduler']));
  });

  it('spend lines and budget: pending lines do not count, a second admin approves, alerts fire once at 50 and 80 percent, 100 percent pauses with BUDGET, resume needs a budget increase approved by the other admin; report equals the spend rows', async () => {
    const k = await mk({ budgetTotalMinor: 1_000_000, budgetDailyMinor: 1_000_000 }); await approveCampaign(a, b, k.id); await runScheduler(a);
    const pending = await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/spend`, { day: new Date().toISOString().slice(0, 10), amountMinor: 100_000 }); expect(pending.status).toBe(201);
    expect((await getCampaign(a, k.id)).budget).toMatchObject({ approvedSpendMinor: 0, pendingSpendMinor: 100_000 });
    expect((await kiorex(a, 'POST', `/ops/growth-analytics/spend/${pending.body.id}/approve`)).status).toBe(403); // not the author
    expect((await kiorex(b, 'POST', `/ops/growth-analytics/spend/${pending.body.id}/approve`)).status).toBe(200);
    await approvedSpend(a, b, k.id, 450_000); let s = await getCampaign(a, k.id); expect(s.budget.utilisationBp).toBe(5500); expect(s.thresholdsFiredBp).toEqual([5000]);
    await approvedSpend(a, b, k.id, 250_000); s = await getCampaign(a, k.id); expect(s.thresholdsFiredBp).toEqual([5000, 8000]); expect(s.status).toBe('ACTIVE');
    await approvedSpend(a, b, k.id, 200_000); s = await getCampaign(a, k.id); expect(s).toMatchObject({ status: 'PAUSED', pauseReason: 'BUDGET' }); expect(s.thresholdsFiredBp).toEqual([5000, 8000, 10000]);
    expect(Number((await q('kiorex_platform', `select count(*)::int c from "OutboxEvent" where type = 'CampaignBudgetThresholdReached' and "aggregateId" = $1`, [k.id]))[0].c)).toBe(3);
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/transition`, { to: 'ACTIVE' })).body.code).toBe('CAMPAIGN_BUDGET_EXHAUSTED');
    const inc = (await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/approvals`, { kind: 'BUDGET_INCREASE', budgetTotalMinor: 2_000_000, budgetDailyMinor: 1_000_000 })).body;
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/approvals/${inc.id}/decide`, { decision: 'APPROVED', snapshotHash: inc.snapshotHash })).status).toBe(403);
    expect((await kiorex(b, 'POST', `${CAMPAIGNS}/approvals/${inc.id}/decide`, { decision: 'APPROVED', snapshotHash: inc.snapshotHash })).status).toBe(200);
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/transition`, { to: 'ACTIVE' })).status).toBe(200);
    // reconciliation: the report, the campaign budget and the spend table agree to the piastre
    const rows = await q('kiorex_platform', `select coalesce(sum("amountMinor"), 0)::int s from "GrowthSpendEntry" where "campaignId" = $1 and status = 'APPROVED'`, [k.id]);
    const rep = (await kiorex(a, 'GET', `${CAMPAIGNS}/${k.id}/report`)).body;
    expect(rep.budget.approvedSpendMinor).toBe(Number(rows[0].s)); expect(rep.budget.approvedSpendMinor).toBe(1_000_000); expect((await getCampaign(a, k.id)).budget.approvedSpendMinor).toBe(1_000_000);
    const fin = await kiorex(a, 'GET', `/ops/growth-analytics/spend?campaignId=${k.id}`); expect(fin.status).toBe(200);
    expect(rep.external).toEqual({ connected: false, kinds: [], metrics: {} }); // no adapter: "not connected", never zero
  });

  it('the daily cap pauses the campaign until the next Cairo day; the scheduler cannot resume it before then; a person cannot either', async () => {
    const k = await mk({ budgetTotalMinor: 1_000_000, budgetDailyMinor: 100_000 }); await approveCampaign(a, b, k.id); await runScheduler(a);
    await approvedSpend(a, b, k.id, 100_000);
    const s = await getCampaign(a, k.id); expect(s).toMatchObject({ status: 'PAUSED', pauseReason: 'GUARDRAIL' });
    const until = new Date(s.pausedUntil).getTime(); expect(until).toBeGreaterThan(Date.now()); expect(until - Date.now()).toBeLessThanOrEqual(25 * 3600_000);
    expect(new Date(s.pausedUntil).toISOString().slice(14, 19)).toBe('00:00'); // a Cairo midnight is a whole UTC hour
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/transition`, { to: 'ACTIVE' })).status).toBe(409);
    expect((await runScheduler(a)).resumed).toBe(0); expect((await getCampaign(a, k.id)).status).toBe('PAUSED');
  });

  it('UTM touch to booking: a campaign touch decides the booking MARKETPLACE with the campaign as winning touch; the rollup carries the campaign id; the report keeps small counts masked; ceiling and flag contract hold', async () => {
    const k = await mk({ budgetTotalMinor: 1_000_000, budgetDailyMinor: 1_000_000 }); await approveCampaign(a, b, k.id); await runScheduler(a);
    const pat = await freshPatient('Campaign Visitor'); await seedCampaignTouch({ sub: pat.sub, campaignId: k.id, utmCampaign: k.utmCampaign });
    const { id } = await bookWith(pat.token, p);
    const decision = (await q('kiorex_platform', `select d.origin, d."reasonCode", t.kind, t."utmCampaign" from "GrowthAttributionDecision" d left join "GrowthTouchpoint" t on t.id = d."winningTouchId" where d."bookingId" = $1 and d."supersedesId" is null`, [id]))[0];
    expect(decision).toMatchObject({ origin: 'MARKETPLACE', kind: 'CAMPAIGN', utmCampaign: k.utmCampaign });
    expect((await kiorex(a, 'POST', '/ops/growth-analytics/rollup', { days: 3 })).status).toBe(200);
    const metric = await q('kiorex_platform', `select metric, sum(value)::int v, "campaign", "sourceKind" from "GrowthMetricDaily" where "campaignId" = $1 and metric = 'BookingConfirmed' group by metric, "campaign", "sourceKind"`, [k.id]);
    expect(metric[0]).toMatchObject({ v: 1, campaign: k.utmCampaign, sourceKind: 'CAMPAIGN' });
    expect((await kiorex(a, 'GET', `${CAMPAIGNS}/${k.id}/report`)).body.kpis.cpa.values.cpaMinor).toBeNull(); // no approved spend: no cost per booking (null, not zero)
    await approvedSpend(a, b, k.id, 20_000);
    const rep = (await kiorex(a, 'GET', `${CAMPAIGNS}/${k.id}/report`)).body;
    expect(rep.funnel.find((x: any) => x.stage === 'BookingConfirmed')).toMatchObject({ count: '<10', masked: true }); // one person is never shown
    expect(rep.kpis.cpa.values.cpaMinor).toBe('<10');
    // the flag contract: OFF blocks writes and the public resolve, reads still answer
    const off = await kiorex(a, 'PUT', '/admin/flags/growth.campaigns/values', { scope: 'GLOBAL', value: 'OFF', reason: 'e2e', ticket: 'E2E-29', emergency: false });
    try {
      expect([200, 202]).toContain(off.status);
      const w = await kiorex(a, 'POST', CAMPAIGNS, campaignBody()); expect(w.status).toBe(403); expect(w.body).toMatchObject({ code: 'FEATURE_DISABLED', key: 'growth.campaigns' });
      expect((await kiorex(a, 'GET', CAMPAIGNS)).status).toBe(200); expect((await kiorex(undefined, 'GET', `/growth/v1/campaign/resolve?utm_campaign=${k.utmCampaign}`)).status).toBe(403);
    } finally { await kiorex(a, 'PUT', '/admin/flags/growth.campaigns/values', { scope: 'GLOBAL', value: 'ON', reason: 'e2e restore', ticket: 'E2E-29' }); }
    expect((await kiorex(undefined, 'GET', `/growth/v1/campaign/resolve?utm_campaign=${k.utmCampaign}`)).status).toBe(200);
  });

  it('complete and archive: every step is in the history and in the audit log; an archived campaign is terminal', async () => {
    const k = await mk(); await approveCampaign(a, b, k.id); await runScheduler(a);
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/transition`, { to: 'PAUSED', reason: 'e2e pause', reasonCode: 'E2E' })).status).toBe(200);
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/transition`, { to: 'COMPLETED' })).status).toBe(200);
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/transition`, { to: 'ACTIVE' })).body.code).toBe('CAMPAIGN_INVALID_TRANSITION');
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/transition`, { to: 'ARCHIVED' })).status).toBe(200);
    expect((await kiorex(a, 'POST', `${CAMPAIGNS}/${k.id}/transition`, { to: 'ARCHIVED' })).status).toBe(409);
    const hist = (await kiorex(a, 'GET', `${CAMPAIGNS}/${k.id}/history`)).body.map((h: any) => `${h.from}>${h.to}`);
    expect(hist).toEqual(['DRAFT>PENDING_APPROVAL', 'PENDING_APPROVAL>SCHEDULED', 'SCHEDULED>ACTIVE', 'ACTIVE>PAUSED', 'PAUSED>COMPLETED', 'COMPLETED>ARCHIVED']);
    const audit = (await q('kiorex_platform', `select action from "AuditLog" where "resourceId" = $1 and action like 'growth.campaign.%'`, [k.id])).map((r: any) => r.action);
    for (const x of ['create', 'approval.request', 'approval.approved', 'transition.scheduled', 'transition.active', 'transition.paused', 'transition.completed', 'transition.archived']) expect(audit).toContain(`growth.campaign.${x}`);
    expect(await fetch(`${KIOREX_API}/admin/growth/campaigns`).then((r) => r.status)).toBe(401);
  });
});
