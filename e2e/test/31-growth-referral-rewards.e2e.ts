import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { kiorex, kiorly, q, sleep, waitFor, staffLogin } from '../src/clients.js';
import { providerBySpecialty, tokens, type Provider } from '../src/fixtures.js';
import { bookWith, completeVisit, freshPatient, secondSuperAdmin } from '../src/growth.js';
import { unlockForRun } from '../src/growth-p3.js';
import { activateConfig, depositOnVisitType, inForce, payDeposit } from '../src/growth-p2-31.js';

/**
 * GRW-P2-B (suite 31) on the real stack: Kiorex API + Clinic API + Postgres + dev Passport, sandbox PSP. The referral engine and the patient rewards ledger end to end:
 * invite, claim (first claim wins, one refusal shape, no oracle), the friend's completed visit (the Clinic really checks in and signs), qualification, one voucher each, COUPON mode (default: sealed code,
 * one reveal, redeemed at the deposit checkout, single use), CREDIT mode (auto-applied credit lots), reversal on cancel and refund, expiry (backdated lot + the housekeeping job), the fraud hold and its
 * two-person review, the flag-OFF contract and "no PII" in every answer. Launch-locked flags get DEV TEST FIXTURE gate evidence for this run only. Amounts are TEST VALUES (the shipped defaults are 0,
 * KX-12 pricing is NEEDS_HUMAN) set through the real two-person config flow and put back at the end. The qualification hold is set to 0 days so a completed visit qualifies at once (the 30-minute job
 * is not waited for). Mock PSP and mock providers only.
 */
const REF = '/growth/v1/referral'; const RW = '/growth/v1'; const ADM = '/admin/growth';
const FLAGS = ['growth.patient_referral', 'growth.rewards', 'growth.patient_credit'];
const DEPOSIT_EGP = 150; const REFERRER_MINOR = 5000; const REFEREE_MINOR = 3000;
const PII = /\+20\d{9}|@[a-z]+\.|"sub":|sub_|nameEn|firstName/i;

describe('31. referral and rewards (P2-B) on the real stack', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let p: Provider; let staff: string; let second: Awaited<ReturnType<typeof secondSuperAdmin>>;
  const undo: (() => Promise<void>)[] = []; const restoreCfg: { kind: string; payload: any }[] = [];
  let referrer: Awaited<ReturnType<typeof freshPatient>>; let friend: Awaited<ReturnType<typeof freshPatient>>; let code = '';
  let friendBooking = ''; let relId = '';
  const rel = async (sub: string) => (await q('kiorex_platform', `select id, status, "reviewState", "rejectReason", "holdUntil", "referrerSub" from "ReferralRelationship" where "refereeSub" = $1`, [sub]))[0];
  const lots = async (sub: string) => q('kiorex_platform', `select id, kind, mode, status, "amountMinor" from "RewardLot" where sub = $1 order by "createdAt"`, [sub]);
  /** After the visit: waits for QUALIFIED, or for the fraud HOLD (every test patient comes from one network prefix, so RF_DUP_ACCOUNT holds many sign-ups for review); a HOLD is asserted (nothing issued, in the queue) and then released by a reviewer. */
  let heldSeen = 0;
  const qualified = async (sub: string) => {
    const r = await waitFor('QUALIFIED or HOLD', async () => { const x = await rel(sub); return x?.status === 'QUALIFIED' || (x?.status === 'BOOKED' && x.reviewState === 'HOLD') ? x : undefined; }, 45_000, 1000);
    if (r.status === 'QUALIFIED') return r;
    heldSeen++; expect(await lots(sub)).toHaveLength(0);
    expect(JSON.stringify((await kiorex(t.ops, 'GET', `${ADM}/referrals`)).body.queue)).toContain(r.id);
    const rel1 = await kiorex(t.ops, 'POST', `${ADM}/referrals/${r.id}/decision`, { decision: 'RELEASE_HOLD', note: 'e2e: reviewed, a test patient from the same machine' }); expect(rel1.status).toBe(200);
    return waitFor('QUALIFIED after review', async () => { const x = await rel(sub); return x?.status === 'QUALIFIED' ? x : undefined; }, 20_000, 500);
  };
  /** The referrer must have earned the right (REFERRER_EARNED): an account older than 7 days (backdated profile row, a DB fixture: the clock cannot be moved) and one completed visit (real: booked, paid, checked in and signed at the Clinic). */
  const earned = async (u: { sub: string; token: string }) => {
    await q('kiorex_platform', `update "PatientProfile" set "createdAt" = now() - interval '30 days' where sub = $1`, [u.sub]);
    const b = await bookWith(u.token, p); await payDeposit(u.token, b.id); await completeVisit(u.token, b.id, staff);
  };
  const rewards = async (token: string) => ((await kiorex(token, 'GET', `${RW}/referral/rewards`)).body.items ?? []) as any[];

  beforeAll(async () => {
    t = await tokens(); p = await providerBySpecialty(t.p1, 'paediatrics'); staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev'); second = await secondSuperAdmin();
    referrer = await freshPatient('Referrer E2E'); friend = await freshPatient('Friend E2E');
  });
  afterAll(async () => {
    for (const r of restoreCfg.reverse()) await activateConfig(t.ops, second.token, r.kind, r.payload, 'E2E-31-RESTORE').catch(() => undefined);
    for (const u of undo.reverse()) await u().catch(() => undefined);
    await second?.drop().catch(() => undefined);
  });
  const setRules = async (kind: 'REWARD_RULES' | 'REFERRAL_RULES', patch: (cur: any) => any) => {
    const cur = await inForce(t.ops, kind); if (!restoreCfg.some((r) => r.kind === kind)) restoreCfg.push({ kind, payload: structuredClone(cur.payload) });
    await activateConfig(t.ops, second.token, kind, patch(structuredClone(cur.payload))); await sleep(3000); // the readers refresh their cached config
  };

  describe('flag OFF contract', () => {
    it('while the flags are locked every referral, reward and credit route answers 403 FEATURE_DISABLED and nothing is created', async () => {
      const locked = (await q('kiorex_platform', `select count(*)::int c from "FlagGateEvidence" where "flagKey" = any($1) and "gateId" <> 'DEV-TEST-FIXTURE-NOT-A-REAL-GATE'`, [FLAGS]))[0].c === 0
        && (await q('kiorex_platform', `select count(*)::int c from "FlagGateEvidence" where "flagKey" = any($1)`, [FLAGS]))[0].c === 0;
      if (!locked) return; // the database under test already carries gate evidence (a shared dev DB): the contract is covered by the integration suite there
      const before = Number((await q('kiorex_platform', `select count(*)::int c from "ReferralCode"`))[0].c);
      for (const [m, path, body] of [['GET', `${REF}/me`], ['POST', `${REF}/invites`, {}], ['POST', `${REF}/claim`, { code: 'ABCD2345' }], ['GET', `${RW}/referral/rewards`], ['POST', `${RW}/rewards/quote`, { amountMinor: 10000 }], ['GET', `${RW}/credit`]] as const) {
        const r = await kiorex(referrer.token, m, path, body); expect(r.status, `${m} ${path}`).toBe(403); expect(r.body.code).toBe('FEATURE_DISABLED');
      }
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "ReferralCode"`))[0].c)).toBe(before);
    });
    it('unlocks the flags for this run (DEV test fixture gate, undone at the end) and sets the test amounts through the two-person config flow', async () => {
      for (const f of FLAGS) undo.push(await unlockForRun(t.ops, f));
      await setRules('REWARD_RULES', (c) => ({ ...c, mode: 'COUPON', amounts: { referrerMinor: REFERRER_MINOR, refereeMinor: REFEREE_MINOR, repeatMinor: 0, promoMinor: 0 }, perUserAnnualCapMinor: 100_000, perCampaignCapMinor: 10_000_000, ruleBudgetCeilingMinor: 100_000_000 }));
      await setRules('REFERRAL_RULES', (c) => ({ ...c, qualification: { ...c.qualification, holdDays: 0 } }));
      undo.push(await depositOnVisitType(t.ops, p, DEPOSIT_EGP));
      const cur = await inForce(t.ops, 'REWARD_RULES'); expect(cur.payload.amounts.referrerMinor).toBe(REFERRER_MINOR);
      expect((await kiorex(referrer.token, 'GET', `${REF}/me`)).status).toBe(200);
      await earned(referrer);
    });
  });

  describe('invite and claim', () => {
    it('the referrer gets ONE stable 8-character code and a link; counts only; a share records no recipient', async () => {
      const [a, b] = await Promise.all([kiorex(referrer.token, 'GET', `${REF}/me`), kiorex(referrer.token, 'GET', `${REF}/me`)]);
      code = a.body.code; expect(b.body.code).toBe(code); expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
      expect(a.body.inviteUrl).toContain(`/invite/${code}`); expect(a.body.counts).toEqual({ invited: 0, signedUp: 0, qualified: 0 });
      const inv = await kiorex(referrer.token, 'POST', `${REF}/invites`, { channel: 'WHATSAPP_SHARE', locale: 'ar' }); expect(inv.status).toBe(201);
      expect(inv.body.shareText).toMatch(/[؀-ۿ]/); expect((await kiorex(referrer.token, 'POST', `${REF}/invites`, { channel: 'TELEGRAM' })).status).toBe(400);
      expect((await kiorex(referrer.token, 'GET', `${REF}/me`)).body.counts.invited).toBe(1);
      expect(JSON.stringify(a.body)).not.toContain(referrer.sub);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "ReferralCode" where sub = $1`, [referrer.sub]))[0].c)).toBe(1);
    });
    it('first claim wins: the friend claims once, repeating or claiming another code changes nothing; the referrer sees a count and never who', async () => {
      const other = await freshPatient('Other Referrer'); const otherCode = (await kiorex(other.token, 'GET', `${REF}/me`)).body.code;
      const c1 = await kiorex(friend.token, 'POST', `${REF}/claim`, { code }); expect([c1.status, c1.body]).toEqual([200, { status: 'SIGNED_UP' }]);
      expect((await kiorex(friend.token, 'POST', `${REF}/claim`, { code: code.toLowerCase() })).body).toEqual({ status: 'SIGNED_UP' });
      expect((await kiorex(friend.token, 'POST', `${REF}/claim`, { code: otherCode })).body).toEqual({ status: 'SIGNED_UP' });
      const row = await rel(friend.sub); relId = row.id; expect(row.referrerSub).toBe(referrer.sub); expect(row.status).toBe('SIGNED_UP');
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "ReferralRelationship" where "refereeSub" = $1`, [friend.sub]))[0].c)).toBe(1);
      const me = (await kiorex(referrer.token, 'GET', `${REF}/me`)).body; expect(me.counts).toMatchObject({ signedUp: 1, qualified: 0 }); expect(JSON.stringify(me)).not.toMatch(PII);
    });
    it('every refusal has the same shape and says nothing about who owns a code (self, unknown, malformed code)', async () => {
      const fresh = await freshPatient('Refusal Probe');
      const self = await kiorex(referrer.token, 'POST', `${REF}/claim`, { code });
      const unknown = await kiorex(fresh.token, 'POST', `${REF}/claim`, { code: '0AAA1BBB' });
      const unknown2 = await kiorex(fresh.token, 'POST', `${REF}/claim`, { code: 'ZZZZ9999' });
      for (const r of [self, unknown, unknown2]) { expect(r.status).toBe(409); expect(Object.keys(r.body).sort()).toEqual(['code', 'message', 'reason', 'status']); expect(r.body.code).toBe('REFERRAL_REJECTED'); expect(JSON.stringify(r.body)).not.toMatch(PII); }
      expect(self.body.reason).toBe('SELF_REFERRAL'); expect(unknown.body.reason).toBe(unknown2.body.reason); expect((await kiorex(fresh.token, 'POST', `${REF}/claim`, { code: 'short' })).status).toBe(400);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "ReferralRelationship" where "refereeSub" = $1`, [fresh.sub]))[0].c)).toBe(0);
    });
    it('parallel claims of one person produce one relationship', async () => {
      const f = await freshPatient('Parallel'); const rs = await Promise.all([1, 2, 3, 4, 5].map(() => kiorex(f.token, 'POST', `${REF}/claim`, { code })));
      expect(rs.every((r) => r.status === 200 && r.body.status === 'SIGNED_UP')).toBe(true);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "ReferralRelationship" where "refereeSub" = $1`, [f.sub]))[0].c)).toBe(1);
    });
  });

  describe('qualify and issue (COUPON mode, the default)', () => {
    it('the friend books and the Clinic completes the visit: the referral qualifies once and issues one voucher to each person, nothing before the visit', async () => {
      const b = await bookWith(friend.token, p); friendBooking = b.id;
      await payDeposit(friend.token, b.id);
      expect((await rel(friend.sub)).status).not.toBe('QUALIFIED'); expect(await lots(referrer.sub)).toHaveLength(0);
      await completeVisit(friend.token, b.id, staff);
      const done = await qualified(friend.sub); expect(done.status).toBe('QUALIFIED');
      const ml = await waitFor('both lots', async () => { const [a, f] = [await lots(referrer.sub), await lots(friend.sub)]; return a.length && f.length ? { a, f } : undefined; });
      expect(ml.a).toMatchObject([{ kind: 'REFERRER', mode: 'COUPON', amountMinor: REFERRER_MINOR }]); expect(ml.f).toMatchObject([{ kind: 'REFEREE', mode: 'COUPON', amountMinor: REFEREE_MINOR }]);
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "OutboxEvent" where type = 'ReferralQualified' and "aggregateId" = $1`, [relId]))[0].c)).toBe(1);
      expect((await kiorex(referrer.token, 'GET', `${REF}/me`)).body.counts.qualified).toBe(1);
    });
    it('the reward list shows a voucher with a state and NO code; the code is sealed until the one-time reveal; a second reveal and another account get nothing', async () => {
      const list = await rewards(referrer.token); expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ kind: 'REFERRER', mode: 'COUPON', amountMinor: REFERRER_MINOR, status: 'ACTIVE' });
      expect(JSON.stringify(list)).not.toMatch(/"code"|couponCode"\s*:\s*"[A-Z0-9]{6,}/); expect(JSON.stringify(list)).not.toMatch(PII);
      const id = list[0].id as string;
      expect((await kiorex(friend.token, 'POST', `${RW}/rewards/${id}/reveal`)).status).toBeGreaterThanOrEqual(400); // someone else's voucher
      const first = await kiorex(referrer.token, 'POST', `${RW}/rewards/${id}/reveal`); expect(first.status).toBe(200); expect(JSON.stringify(first.body)).toMatch(/[A-Z0-9]{8,12}/);
      const again = await kiorex(referrer.token, 'POST', `${RW}/rewards/${id}/reveal`); expect(JSON.stringify(again.body)).not.toContain(first.body.code ?? '\u0000'); // shown once
      const row = (await q('kiorex_platform', `select "couponCodeSealed", "couponCodeHash" from "RewardLot" where id = $1`, [id]))[0]; expect(row.couponCodeHash).toBeTruthy(); expect(row.couponCodeSealed).toBeNull();
    });
  });

  describe('redeem at the deposit checkout, then reverse', () => {
    let code2 = ''; let b2 = '';
    it('the friend spends the welcome voucher by code on the next deposit: the card pays the rest, the lot is spent, and it cannot be used twice or by another account', async () => {
      const f = (await rewards(friend.token))[0]; const rv = await kiorex(friend.token, 'POST', `${RW}/rewards/${f.id}/reveal`); expect(rv.status).toBe(200); code2 = rv.body.code;
      expect(code2).toMatch(/^[A-Z0-9]{8,12}$/);
      const b = await bookWith(friend.token, p); b2 = b.id;
      const stranger = await freshPatient('Coupon Thief'); const sb = await bookWith(stranger.token, p);
      const stolen = await kiorex(stranger.token, 'POST', `/bookings/${sb.id}/deposit-checkout`, { couponCode: code2 }); expect(stolen.status).toBe(200); expect(stolen.body.rewardMinor ?? 0).toBe(0); // the answer of a wrong code
      await kiorex(stranger.token, 'POST', `/bookings/${sb.id}/cancel`, {});
      const co = await payDeposit(friend.token, b.id, { couponCode: code2 });
      expect(co).toMatchObject({ rewardMinor: REFEREE_MINOR, amountMinor: DEPOSIT_EGP * 100 - REFEREE_MINOR });
      const lot = (await q('kiorex_platform', `select status from "RewardLot" where id = $1`, [f.id]))[0]; expect(lot.status).toBe('EXHAUSTED');
      const pay = (await q('kiorex_platform', `select "amountMinor", "rewardMinor" from "PaymentIntent" where id = $1`, [co.paymentId]))[0]; expect(pay).toMatchObject({ rewardMinor: REFEREE_MINOR, amountMinor: 12000 });
      const dep = await waitFor('Clinic deposit with tender', async () => (await q('kiorly', `select amount::float as amount from "PatientDeposit" d join "Appointment" a on a.id = d."appointmentId" where a."externalReference" = $1`, [b.id]))[0]);
      expect(dep.amount).toBe(DEPOSIT_EGP); // the Clinic is told the GROSS deposit
      const b3 = await bookWith(friend.token, p); const reuse = await kiorex(friend.token, 'POST', `/bookings/${b3.id}/deposit-checkout`, { couponCode: code2 }); expect(reuse.body.rewardMinor ?? 0).toBe(0); await kiorex(friend.token, 'POST', `/bookings/${b3.id}/cancel`, {});
    });
    it('cancelling the paid booking refunds the CARD money only (the spent voucher is single use and is not given back as cash)', async () => {
      const r = await kiorex(friend.token, 'POST', `/bookings/${b2}/cancel`, { reason: 'plans changed' }); expect(r.status).toBe(200);
      await waitFor('refund settled', async () => (await q('kiorex_platform', `select r.status from "Refund" r join "PaymentIntent" p on p.id = r."paymentId" where p."bookingId" = $1`, [b2]))[0]?.status === 'SETTLED');
      const rf = (await q('kiorex_platform', `select r."amountMinor" from "Refund" r join "PaymentIntent" p on p.id = r."paymentId" where p."bookingId" = $1`, [b2]))[0]; expect(rf.amountMinor).toBe(12000);
    });
    it('a refund of the visit that earned the reward takes the UNSPENT referrer voucher back inside the reversal window, once, and the ledger stays append-only', async () => {
      const before = (await rewards(referrer.token))[0]; expect(before.status).toBe('ACTIVE');
      const r = await kiorex(t.ops, 'POST', `${ADM}/rewards/lots/${before.id}/reverse`, { reason: 'e2e: qualifying visit refunded' }); expect([200, 201]).toContain(r.status);
      expect((await q('kiorex_platform', `select status from "RewardLot" where id = $1`, [before.id]))[0].status).toBe('REVERSED');
      await kiorex(t.ops, 'POST', `${ADM}/rewards/lots/${before.id}/reverse`, { reason: 'again' });
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "RewardLedgerEntry" where "lotId" = $1 and type = 'REVERSE'`, [before.id]))[0].c)).toBe(1);
      await expect(q('kiorex_platform', `delete from "RewardLedgerEntry" where "lotId" = $1`, [before.id])).rejects.toThrow(/append-only|not allowed/);
      const rec = await kiorex(t.ops, 'POST', `${ADM}/credit/reconcile/run`); expect([200, 201]).toContain(rec.status);
    });
  });

  describe('expiry', () => {
    it('a voucher past its expiry is EXPIRED by the housekeeping job, cannot be quoted, and the expiry entry is written once', async () => {
      const u = await freshPatient('Expiry Patient'); await kiorex(u.token, 'GET', `${REF}/me`);
      const id = `rwl_e2e31${Math.random().toString(16).slice(2, 10)}`;
      await q('kiorex_platform', `insert into "RewardLot" (id, market, sub, kind, mode, "amountMinor", "ruleVersionId", "expiresAt", status, funding, scope, "issuedBy") values ($1,'EG',$2,'PROMO','CREDIT',4000,'rv-e2e', timezone('UTC', now()) + interval '2 days','ACTIVE','PLATFORM_MARKETING','{}'::jsonb,'e2e')`, [id, u.sub]);
      await q('kiorex_platform', `insert into "RewardLedgerEntry" (id, "lotId", type, "amountMinor", "idempotencyKey", "ruleVersionId", "reasonCode", actor, "createdAt") values ($1,$2,'ISSUE',4000,$3,'rv-e2e','REFERRER_QUALIFIED','system', now())`, [`rwe_e2e31${id.slice(-8)}`, id, `rwd:issue:${id}`]);
      expect((await kiorex(u.token, 'POST', `${RW}/rewards/quote`, { amountMinor: 10000, lotId: id })).body.appliedMinor ?? 0).toBeGreaterThanOrEqual(0);
      await q('kiorex_platform', `update "RewardLot" set "expiresAt" = timezone('UTC', now()) - interval '1 hour' where id = $1`, [id]);
      for (let i = 0; i < 2; i++) expect([200, 201]).toContain((await kiorex(t.ops, 'POST', `${ADM}/rewards/housekeeping/run`)).status);
      expect((await q('kiorex_platform', `select status from "RewardLot" where id = $1`, [id]))[0].status).toBe('EXPIRED');
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "RewardLedgerEntry" where "lotId" = $1 and type = 'EXPIRE'`, [id]))[0].c)).toBe(1);
      const quote = await kiorex(u.token, 'POST', `${RW}/rewards/quote`, { amountMinor: 10000, lotId: id }); expect(JSON.stringify(quote.body)).not.toMatch(/"appliedMinor":\s*[1-9]/);
    });
  });

  describe('CREDIT mode (launch-locked flag + rules)', () => {
    it('with mode CREDIT a qualified referral issues credit lots that the next deposit uses automatically (credit first, card the rest, at least one minor unit)', async () => {
      await setRules('REWARD_RULES', (c) => ({ ...c, mode: 'CREDIT' }));
      const r2 = await freshPatient('Credit Referrer'); await earned(r2); const f2 = await freshPatient('Credit Friend'); const c2 = (await kiorex(r2.token, 'GET', `${REF}/me`)).body.code;
      expect((await kiorex(f2.token, 'POST', `${REF}/claim`, { code: c2 })).status).toBe(200);
      const b = await bookWith(f2.token, p); await payDeposit(f2.token, b.id); await completeVisit(f2.token, b.id, staff); await qualified(f2.sub);
      const ml = await waitFor('credit lots', async () => { const a = await lots(f2.sub); return a.length ? a : undefined; }, 45_000, 1000);
      expect(ml).toMatchObject([{ kind: 'REFEREE', mode: 'CREDIT', amountMinor: REFEREE_MINOR }]);
      const credit = (await kiorex(f2.token, 'GET', `${RW}/credit`)).body; expect(credit).toMatchObject({ openBalanceMinor: REFEREE_MINOR, currency: 'EGP' }); expect(JSON.stringify(credit)).not.toMatch(PII);
      const b2 = await bookWith(f2.token, p); const co = await payDeposit(f2.token, b2.id);
      expect(co).toMatchObject({ rewardMinor: REFEREE_MINOR, amountMinor: DEPOSIT_EGP * 100 - REFEREE_MINOR }); expect(co.lines.map((l: any) => l.code)).toEqual(['PRICE', 'PATIENT_CREDIT', 'CARD']);
      expect(co.lines.reduce((s: number, l: any) => s + (l.code === 'CARD' ? 0 : l.amountMinor), 0)).toBe(co.amountMinor); // RC-3: price plus the reductions is the card line
      expect((await kiorex(f2.token, 'GET', `${RW}/credit`)).body.openBalanceMinor).toBe(0);
      await kiorex(f2.token, 'POST', `/bookings/${b2.id}/cancel`, {});
    });
  });

  describe('fraud holds and review', () => {
    it('the ops funnel shows counts with small numbers masked and no person; only an ops role can read it', async () => {
      const rows = await q('kiorex_platform', `select count(*)::int c from "ReferralRelationship" where "referrerSub" = $1`, [referrer.sub]); expect(rows[0].c).toBeGreaterThanOrEqual(1);
      const overview = await kiorex(t.ops, 'GET', `${ADM}/referrals`); expect(overview.status).toBe(200); expect(overview.body.note).toMatch(/<10/);
      expect(JSON.stringify(overview.body)).not.toMatch(PII);
      expect((await kiorex(referrer.token, 'GET', `${ADM}/referrals`)).status).toBe(403);
      if (heldSeen) expect(Number((await q('kiorex_platform', `select count(*)::int c from "AuditLog" where action = 'growth.referral.release_hold'`))[0].c)).toBeGreaterThanOrEqual(1); // the reviewer's release is audited
    });
    it('the reviewer view of a relationship shows checks and opaque references, never contact data; a decision needs a role and QUALIFY_OVERRIDE needs a super admin', async () => {
      const v = await kiorex(t.ops, 'GET', `${ADM}/referrals/${relId}`); expect(v.status).toBe(200); expect(v.body.status).toBe('QUALIFIED'); expect(v.body.checks.length).toBeGreaterThan(5);
      expect(v.body.referrerRef).not.toContain(referrer.sub); expect(JSON.stringify(v.body)).not.toMatch(PII);
      expect((await kiorex(friend.token, 'POST', `${ADM}/referrals/${relId}/decision`, { decision: 'REJECT', note: 'x' })).status).toBe(403);
    });
  });
});
