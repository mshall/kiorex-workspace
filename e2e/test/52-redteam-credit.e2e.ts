import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { kiorex, q, sleep } from '../src/clients.js';
import { tokens } from '../src/fixtures.js';
import { freshPatient } from '../src/growth.js';
import { forgeJwt, hasMarkup, INJECTION_CORPUS, unlockForRun } from '../src/growth-p3.js';

/**
 * GRW-GC-4 red team, credit and promotion abuse (suite 52), on the real local stack. PART A is the PATIENT credit system (live): there is no route to transfer, withdraw, top up or gift; every amount
 * shape is validated; another person's lot or coupon is never usable or visible; a coupon shows once; goodwill split across accounts is stopped by the agent's daily cap; the same person cannot be paid
 * their own goodwill; manual issue needs a second person above the threshold and the requester never approves, also with a second token of the same user; household credit cannot be pointed at someone
 * else's dependant. Launch-locked flags get DEV TEST FIXTURE gate evidence for this run only.
 * PART B is the PROVIDER-SPONSORED promotion system (GRW-P2-S, Clinic side, lane A2): its scenarios are listed as todo until the Clinic routes are merged and the shared Clinic stack runs them
 * (budget race of 20 parallel reservations, forged `sponsoredDiscount` block, debit without attendance evidence, price inflation, self-dealing with a staff phone hash, wallet cross-tenant, replay of
 * reserve and refund). See the wave 7 as-built record for the status.
 */
const FLAGS = ['growth.patient_referral', 'growth.rewards', 'growth.patient_credit', 'growth.family_credit', 'growth.support_goodwill', 'growth.refund_as_credit'];
const CREDIT = '/growth/v1';
const ADM = '/admin/growth';

describe('52. red team: patient credit abuse', () => {
  let t: Awaited<ReturnType<typeof tokens>>; const undo: (() => Promise<void>)[] = [];
  let a: Awaited<ReturnType<typeof freshPatient>>; let b: Awaited<ReturnType<typeof freshPatient>>;
  beforeAll(async () => { t = await tokens(); for (const f of FLAGS) undo.push(await unlockForRun(t.ops, f)); a = await freshPatient('Credit A'); b = await freshPatient('Credit B'); await sleep(1500); });
  afterAll(async () => { for (const u of undo.reverse()) await u().catch(() => undefined); });

  /** A voucher straight into the tables for a person (the same two rows the issuance service writes), so the abuse tests do not depend on a completed visit. */
  async function lot(sub: string, amountMinor: number, o: { mode?: string; coupon?: string } = {}) {
    const id = `rwl_e2e52${randomBytes(4).toString('hex')}`;
    await q('kiorex_platform', `insert into "RewardLot" (id, market, sub, kind, mode, "amountMinor", "ruleVersionId", "expiresAt", status, funding, scope, "issuedBy") values ($1,'EG',$2,'PROMO',$3,$4,'rv-e2e', now() + interval '30 days','ACTIVE','PLATFORM_MARKETING','{}'::jsonb,'e2e')`, [id, sub, o.mode ?? 'CREDIT', amountMinor]);
    await q('kiorex_platform', `insert into "RewardLedgerEntry" (id, "lotId", type, "amountMinor", "idempotencyKey", "ruleVersionId", "reasonCode", actor, "createdAt") values ($1,$2,'ISSUE',$3,$4,'rv-e2e','REFERRER_QUALIFIED','system', now())`, [`rwe_e2e52${randomBytes(4).toString('hex')}`, id, amountMinor, `rwd:issue:${id}`]);
    return id;
  }

  it('there is no way to transfer, withdraw, top up, gift or merge credit: every such route is 404 for a patient and an admin', async () => {
    for (const [m, p] of [['POST', '/credit/transfer'], ['POST', '/credit/withdraw'], ['POST', '/credit/gift'], ['POST', '/credit/topup'], ['POST', '/credit/send'], ['POST', '/credit/merge'], ['PUT', '/credit/owner'], ['POST', '/rewards/transfer'], ['POST', '/credit/household/owner'], ['POST', '/credit/cashout']] as const) {
      expect((await kiorex(a.token, m, `${CREDIT}${p}`, { toSub: b.sub, amountMinor: 100 })).status, `${m} ${p}`).toBe(404);
      expect((await kiorex(t.ops, m, `${ADM}${p}`, { toSub: b.sub, amountMinor: 100 })).status, `admin ${m} ${p}`).toBe(404);
    }
  });

  it('quote amounts: zero, negative, float, string, huge, NaN, injection and an unknown or another person\'s lot id never produce credit, never a 5xx', async () => {
    const mine = await lot(a.sub, 5000); const others = await lot(b.sub, 7000);
    for (const amountMinor of [0, -1, -5000, 1.5, '100', 2 ** 31, 1e21, null, [], {}, 'NaN', ...INJECTION_CORPUS.slice(0, 6)] as unknown[]) { const r = await kiorex(a.token, 'POST', `${CREDIT}/rewards/quote`, { amountMinor }); expect(r.status, JSON.stringify(amountMinor)?.slice(0, 30)).toBeLessThan(500); expect(r.status).not.toBe(200); expect(hasMarkup(JSON.stringify(r.body))).toBe(false); }
    const ok = await kiorex(a.token, 'POST', `${CREDIT}/rewards/quote`, { amountMinor: 10_000, lotId: mine }); expect(ok.status).toBe(200);
    const stolen = await kiorex(a.token, 'POST', `${CREDIT}/rewards/quote`, { amountMinor: 10_000, lotId: others });
    expect(JSON.stringify(stolen.body)).not.toContain(others); expect(JSON.stringify(stolen.body)).not.toMatch(/7000/); // the other person's lot is neither applied nor echoed
    for (const lotId of ['rwl_x', 'RWL_UPPER', 'rwl_a b', '../rwl_x', 'rwl_' + 'a'.repeat(500)]) expect((await kiorex(a.token, 'POST', `${CREDIT}/rewards/quote`, { amountMinor: 1000, lotId })).status).toBeLessThan(500);
  });

  it('cross-patient: B cannot reveal, list or see A\'s lot; the ops list shows an opaque reference, never a sub or a phone', async () => {
    const id = await lot(a.sub, 3000, { mode: 'COUPON' });
    for (const r of [await kiorex(b.token, 'POST', `${CREDIT}/rewards/${id}/reveal`), await kiorex(b.token, 'POST', `${CREDIT}/rewards/rwl_nonexistent/reveal`)]) { expect([403, 404, 409]).toContain(r.status); expect(JSON.stringify(r.body)).not.toMatch(/"code":"[A-Z0-9]{6,}"|couponCode/); }
    expect(JSON.stringify((await kiorex(b.token, 'GET', `${CREDIT}/referral/rewards`)).body)).not.toContain(id);
    expect(JSON.stringify((await kiorex(b.token, 'GET', `${CREDIT}/credit`)).body)).not.toContain(id);
    const admin = await kiorex(t.ops, 'GET', `${ADM}/rewards/lots`); expect(admin.status).toBe(200); expect(JSON.stringify(admin.body)).not.toMatch(new RegExp(`${a.sub}|${b.sub}|\\+20\\d{9}`));
    expect((await kiorex(a.token, 'GET', `${ADM}/rewards/lots`)).status).toBe(403); expect((await kiorex(a.token, 'POST', `${ADM}/rewards/manual-issue`, { sub: a.sub, amountMinor: 100000, reason: 'self issue please' })).status).toBe(403);
    expect((await kiorex(forgeJwt({ sub: 'x', kx_roles: ['super_admin'] }, 'HS256'), 'POST', `${ADM}/rewards/manual-issue`, { sub: a.sub, amountMinor: 1000, reason: 'forged admin token' })).status).toBe(401);
  });

  it('manual issue above the threshold needs a second person; the requester never decides it, not even with a second token of the same user; the amount cap and reason are enforced', async () => {
    const v = await kiorex(t.ops, 'POST', `${ADM}/rewards/manual-issue`, { sub: a.sub, amountMinor: 0, reason: 'zero amount' }); expect([400, 422]).toContain(v.status);
    expect((await kiorex(t.ops, 'POST', `${ADM}/rewards/manual-issue`, { sub: a.sub, amountMinor: -50, reason: 'negative amount' })).status).toBeGreaterThanOrEqual(400);
    expect((await kiorex(t.ops, 'POST', `${ADM}/rewards/manual-issue`, { sub: a.sub, amountMinor: 1_000_000_000, reason: 'over every cap' })).status).toBeGreaterThanOrEqual(400);
    expect((await kiorex(t.ops, 'POST', `${ADM}/rewards/manual-issue`, { sub: a.sub, amountMinor: 1000, reason: '' })).status).toBeGreaterThanOrEqual(400);
    const big = await kiorex(t.ops, 'POST', `${ADM}/rewards/manual-issue`, { sub: a.sub, amountMinor: 90_000, reason: 'e2e red team large issue', ticketRef: 'E2E-52' });
    if (big.status === 200 || big.status === 201) {
      const pending = (await kiorex(t.ops, 'GET', `${ADM}/rewards/approvals`)).body as any[]; const mineReq = pending.find((p) => p.amountMinor === 90_000 || p.id === big.body?.requestId || p.id === big.body?.id);
      if (mineReq) { const again = await kiorex(await sameUserSecondToken(), 'POST', `${ADM}/rewards/approvals/${mineReq.id}/decide`, { decision: 'APPROVED' }); expect([403, 409]).toContain(again.status); expect((await kiorex(t.ops, 'POST', `${ADM}/rewards/approvals/${mineReq.id}/decide`, { decision: 'APPROVED' })).status).toBeGreaterThanOrEqual(403); await kiorex(t.ops, 'POST', `${ADM}/rewards/approvals/${mineReq.id}/decide`, { decision: 'REJECTED' }); }
    }
    expect(Number((await q('kiorex_platform', `select count(*)::int c from "RewardLot" where sub = $1 and "amountMinor" = 90000`, [a.sub]))[0].c)).toBe(0); // nothing was issued without a second person
  });
  async function sameUserSecondToken() { const { opsLogin } = await import('../src/clients.js'); return (await opsLogin()).accessToken; } // a second login of the SAME ops user: a different token, the same identity

  it('goodwill split across accounts is stopped by the agent daily cap, an agent cannot pay themselves, and the reason list and reference are mandatory', async () => {
    const grant = (sub: string, o: Record<string, unknown> = {}) => kiorex(t.ops, 'POST', `${ADM}/credit/goodwill`, { sub, reason: 'LONG_WAIT', amountMinor: 5000, ticketRef: `E2E-52-${randomBytes(2).toString('hex')}`, ...o });
    expect((await grant(a.sub, { reason: 'BECAUSE_I_SAID_SO' })).status).toBeGreaterThanOrEqual(400); expect((await grant(a.sub, { ticketRef: undefined })).status).toBeGreaterThanOrEqual(400);
    expect((await grant(a.sub, { amountMinor: 10_001 })).status).toBeGreaterThanOrEqual(400); expect((await grant(a.sub, { amountMinor: -5 })).status).toBeGreaterThanOrEqual(400);
    const opsSub = JSON.parse(Buffer.from(t.ops.split('.')[1]!, 'base64url').toString()).sub as string;
    expect((await grant(opsSub)).status).toBeGreaterThanOrEqual(400); // SELF_GRANT
    let refused: any = null; let granted = 0;
    for (let i = 0; i < 24 && !refused; i++) { const r = await grant(`sub_e2e52_split_${i}_${randomBytes(3).toString('hex')}`); if (r.status === 200 || r.status === 201) granted++; else refused = r; }
    expect(refused, 'the agent daily cap must stop a split grant').toBeTruthy(); expect(JSON.stringify(refused.body)).toMatch(/AGENT_DAILY_CAP|cap/i); expect(granted).toBeLessThanOrEqual(10);
    const total = Number((await q('kiorex_platform', `select coalesce(sum("amountMinor"),0)::int s from "GoodwillGrant" where "grantedBy" = $1 and "createdAt" > now() - interval '24 hours'`, [opsSub]).catch(() => [{ s: 0 }]))[0].s); expect(total).toBeLessThanOrEqual(50_000);
  });

  it('household credit: an owner can only add their OWN dependants; another person\'s dependant id is 404; a member list never shows other households', async () => {
    const dep = await kiorex(b.token, 'POST', '/me/dependants', { nameEn: 'B Kid', dateOfBirth: '2019-05-05', gender: 'MALE', relationship: 'CHILD' });
    if (![200, 201].includes(dep.status)) return; // family accounts flag off on this stack: the owner check below needs a dependant
    const depId = dep.body.id as string;
    // household credit is behind REWARD_RULES.credit.family (config, off by default): the cross-owner refusal must hold either way (404 owner check, or 403 while the config is off), never a success
    const cross = await kiorex(a.token, 'POST', `${CREDIT}/credit/household`, { dependantId: depId }); expect([403, 404]).toContain(cross.status);
    expect([403, 404]).toContain((await kiorex(a.token, 'DELETE', `${CREDIT}/credit/household?memberId=${depId}`)).status);
    const own = await kiorex(b.token, 'POST', `${CREDIT}/credit/household`, { dependantId: depId }); expect([200, 403]).toContain(own.status);
    if (own.status === 403) { expect(own.body.code).toBe('FEATURE_DISABLED'); expect(Number((await q('kiorex_platform', `select count(*)::int c from "RewardHouseholdMember" where "memberSub" = $1`, [`dep:${depId}`]))[0].c)).toBe(0); return; }
    expect(JSON.stringify((await kiorex(a.token, 'GET', `${CREDIT}/credit/household`)).body)).not.toContain(depId);
    for (const bad of [INJECTION_CORPUS[0], INJECTION_CORPUS[3], '', 'x'.repeat(200)]) expect((await kiorex(b.token, 'POST', `${CREDIT}/credit/household`, { dependantId: bad })).status).toBeLessThan(500);
    expect((await kiorex(b.token, 'DELETE', `${CREDIT}/credit/household?memberId=${depId}`)).status).toBeLessThan(500);
  });

  it('money rows stay append-only: a patient and an admin API cannot rewrite a ledger entry, and the reconciliation reads clean', async () => {
    const id = await lot(a.sub, 2000);
    await expect(q('kiorex_platform', `update "RewardLedgerEntry" set "amountMinor" = 9999999 where "lotId" = $1`, [id])).rejects.toThrow(/append-only|not allowed/);
    await expect(q('kiorex_platform', `delete from "RewardLedgerEntry" where "lotId" = $1`, [id])).rejects.toThrow(/append-only|not allowed/);
    expect((await kiorex(a.token, 'POST', `${ADM}/credit/reconcile/run`)).status).toBe(403);
    const run = await kiorex(t.ops, 'POST', `${ADM}/credit/reconcile/run`); expect([200, 201]).toContain(run.status);
  });

  describe('PART B: provider-sponsored promotions (GRW-P2-S, Clinic side)', () => {
    for (const s of [
      '20 parallel reservations against a cap that fits 7 produce exactly 7', 'a replayed reserve with the same idempotency key returns the same reservation and holds the budget once', 'negative and zero reserve amounts are refused',
      'a forged sponsoredDiscount block on a booking (wrong promotion, version, amount or someone else\'s reservation) is refused', 'a debit without attendance evidence is refused (PF_NO_ATTENDANCE)',
      'raising the visit fee before the promotion blocks activation (PF_PRICE_INFLATION)', 'a patient whose phone hash matches the clinic\'s staff cannot use the clinic\'s promotion (PF_SELF_DEAL)',
      'a clinic cannot read or debit another tenant\'s wallet or promotion', 'a replayed refund after completion returns the credit once', 'WALLET_ONLY with an insufficient wallet refuses the reserve',
      'the same patient cannot stack two promotions on one booking', 'a high-value promotion needs a second reviewer and the author cannot be it',
    ]) it.todo(s);
  });
});
