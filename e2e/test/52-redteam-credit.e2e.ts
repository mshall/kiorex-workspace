import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes, randomInt } from 'node:crypto';
import { kiorex, kiorly, opsLogin, q, sleep, staffLogin, waitFor } from '../src/clients.js';
import { confirmBody, hold, kiorlyAppointmentFor, pickSlot, providerBySpecialty, tokens, type Provider } from '../src/fixtures.js';
import { bookWith, completeVisit, freshPatient, kxdevGrowthTenant, secondSuperAdmin } from '../src/growth.js';
import { forgeJwt, hasMarkup, INJECTION_CORPUS, unlockForRun } from '../src/growth-p3.js';
import { activateViaCommands, clinicCommand, directBooking, exposure, isolate, kxLine, PROMO_ADMIN, promoBody, providerFacts, reserveBody, walletBalance } from '../src/growth-p2s.js';

/**
 * GRW-GC-4 red team, credit and promotion abuse (suite 52), on the real local stack. PART A is the PATIENT credit system (live): there is no route to transfer, withdraw, top up or gift; every amount
 * shape is validated; another person's lot or coupon is never usable or visible; a coupon shows once; goodwill split across accounts is stopped by the agent's daily cap; the same person cannot be paid
 * their own goodwill; manual issue needs a second person above the threshold and the requester never approves, also with a second token of the same user; household credit cannot be pointed at someone
 * else's dependant. Launch-locked flags get DEV TEST FIXTURE gate evidence for this run only.
 * PART B is the PROVIDER-SPONSORED promotion system (GRW-P2-S, Clinic side, lane A2), live since the Clinic routes merged: budget race of 20 parallel reservations, replayed and malformed reserves, forged
 * `sponsoredDiscount` blocks, debit without attendance evidence (PF_NO_ATTENDANCE), price inflation (PF_PRICE_INFLATION), self-dealing with a staff phone (PF_SELF_DEAL), another tenant's wallet and promotion,
 * insufficient wallet, no stacking, high-value maker-checker and the replayed reversal. It needs a Clinic and a Kiorex that carry GRW-P2-S (a build of `main` after 25 Nov 2026, see `scripts/promo-stack.sh`);
 * the Clinic review decisions arrive as the same signed commands Kiorex sends. Fixtures (all undone): a CLINIC_ADMIN and a slug on the KX-DEV clinic, one Employee row, fee changes restored, a wallet grant.
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
    await q('kiorex_platform', `insert into "RewardLot" (id, market, sub, kind, mode, "amountMinor", "ruleVersionId", "expiresAt", status, funding, scope, "issuedBy", "createdAt") values ($1,'EG',$2,'PROMO',$3,$4,'rv-e2e', timezone('UTC', now()) + interval '30 days','ACTIVE','PLATFORM_MARKETING','{}'::jsonb,'e2e', timezone('UTC', now()))`, [id, sub, o.mode ?? 'CREDIT', amountMinor]);
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
    const total = Number((await q('kiorex_platform', `select coalesce(sum("amountMinor"),0)::int s from "GoodwillGrant" where "grantedBy" = $1 and "ticketRef" like 'E2E-52-%' and "createdAt" > now() - interval '24 hours'`, [opsSub]).catch(() => [{ s: 0 }]))[0].s); expect(total).toBeLessThanOrEqual(50_000);
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
    // The Clinic is the system of record of the budget and the wallet. Kiorex asks with SIGNED commands (the same HMAC call Kiorex makes); the owner console is the staff API. Mock providers only.
    let owner: string; let platform: string; let staff: string; let ops2: Awaited<ReturnType<typeof secondSuperAdmin>>; let p: Provider; let facts: Awaited<ReturnType<typeof providerFacts>>; let restoreTenant: () => Promise<void> = async () => undefined; let otherOwner: string;
    const cleanup: (() => Promise<void>)[] = []; const created: string[] = []; const sponsorUndo: (() => Promise<void>)[] = [];
    const mn = (egp: number) => egp * 100;
    const promo = async (o: Record<string, unknown> = {}, kinds: Array<'CONTENT' | 'SCOPE' | 'HIGH_VALUE'> = ['CONTENT', 'SCOPE']) => { const id = await activateViaCommands(owner, promoBody(facts.clinicianId, o), kinds); created.push(id); return id; };
    const reserve = (id: string, o: Record<string, unknown> = {}) => clinicCommand(id, 'reserve', reserveBody(o));
    const openReservations = async (id: string) => Number((await q('kiorly', `select count(*)::int c from "PromotionReservation" where "promotionId" = $1 and state in ('RESERVED','BOOKED','DEBITED')`, [id]))[0].c);
    const slotsBooked: string[] = [];
    async function holdFor(token: string) { const slot = await pickSlot(token, p); const h = await hold(token, p, slot); if (h.status !== 201) throw new Error(`hold ${h.status} ${JSON.stringify(h.body)}`); slotsBooked.push(h.body.id); const row = (await q('kiorex_platform', `select "holdId" from "BookingIntent" where id = $1`, [h.body.id]))[0]; return { holdId: h.body.id as string, clinicHoldId: row?.holdId as string | undefined, slot }; }
    const phone = () => `+2012${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

    beforeAll(async () => {
      ops2 = await secondSuperAdmin(); p = await providerBySpecialty(t.p1, 'cardiology'); facts = await providerFacts(p.id);
      sponsorUndo.push(await unlockForRun((await opsLogin()).accessToken, 'growth.sponsored_promotions'));
      const fx = await kxdevGrowthTenant(p.id); owner = fx.admin; restoreTenant = fx.restore;
      platform = await staffLogin('superadmin@kiorly.com'); staff = await staffLogin('kxdev.hesham.nabil@kiorly.dev'); otherOwner = await staffLogin('admin@drahmedshall.com');
      const g = await kiorly(platform, 'POST', `/admin/platform/tenants/${facts.tenantId}/credits`, { amount: 3000, reason: 'GOODWILL', note: 'e2e suite 52 part B sponsor wallet' }); expect([200, 201], JSON.stringify(g.body)).toContain(g.status);
    });
    afterAll(async () => {
      for (const id of created) await kiorly(owner, 'POST', `/promotions/${id}/pause`, { reason: 'e2e done' }).catch(() => undefined);
      for (const id of slotsBooked) await kiorex(t.p1, 'POST', `/bookings/${id}/release`).catch(() => undefined);
      for (const u of cleanup.reverse()) await u().catch(() => undefined);
      for (const u of sponsorUndo.reverse()) await u().catch(() => undefined);
      await restoreTenant(); await ops2?.drop();
    });

    it('20 parallel reservations against a cap that fits 7 produce exactly 7; the rest are BUDGET_EXHAUSTED; the exposure never passes the cap; the promotion turns EXHAUSTED', async () => {
      const id = await promo({ budgetCapMinor: 70_000, perPatientLimit: 1 });
      // The burst is 20 real HTTP calls on ONE promotion; the Clinic serialises them on the promotion row. On a loaded machine the tail of the queue can run into the 20 s transaction limit (Prisma P2028, answered
      // 500/503 by the Clinic; see the as-built record): such a call changed NOTHING and is retried, so the invariants are asserted on the burst and the exact split after the retries.
      const burst = await Promise.all(Array.from({ length: 20 }, (_, i) => reserve(id, { bookingRef: `kx_bk_e2e_race_${i}`, patientRef: `pref_race_${i}`, idempotencyKey: `spr:e2e:race:${id}:${i}` })));
      const burstOk = burst.filter((r) => r.status === 200).length; const burst5xx = burst.filter((r) => r.status >= 500).length;
      expect(burstOk).toBeLessThanOrEqual(7); expect(burst.filter((r) => r.status !== 200 && r.status !== 409 && r.status < 500)).toEqual([]);
      expect((await exposure(id)).exposure).toBeLessThanOrEqual(70_000); // never over the cap, however the burst ended
      const rs = [...burst];
      for (let i = 0; i < 20; i++) if (burst[i]!.status >= 500) { for (let k = 0; k < 4 && rs[i]!.status >= 500; k++) rs[i] = await reserve(id, { bookingRef: `kx_bk_e2e_race_${i}`, patientRef: `pref_race_${i}`, idempotencyKey: `spr:e2e:race:${id}:${i}` }); } // the SAME idempotency key: a call that did commit answers with its reservation, never a second hold
      console.info(`[52 B1] burst of 20: ${burstOk} reserved, ${burst5xx} answered 5xx and were retried`);
      const ok = rs.filter((r) => r.status === 200); const no = rs.filter((r) => r.status === 409);
      const dist = JSON.stringify(rs.reduce((m: Record<string, number>, r) => { const k = `${r.status}:${r.body?.code ?? ''}`; m[k] = (m[k] ?? 0) + 1; return m; }, {}));
      expect(ok, dist).toHaveLength(7); expect(no, dist).toHaveLength(13); expect(new Set(no.map((r) => r.body.code))).toEqual(new Set(['BUDGET_EXHAUSTED']));
      expect(new Set(ok.map((r) => r.body.reservationRef)).size).toBe(7);
      expect((await exposure(id)).exposure).toBeLessThanOrEqual(70_000); expect((await exposure(id)).exposure).toBe(70_000);
      expect((await kiorly(owner, 'GET', `/promotions/${id}`)).body.status).toBe('EXHAUSTED');
      for (const r of ok) await clinicCommand(id, 'release', { reservationRef: r.body.reservationRef, idempotencyKey: `rel:${r.body.reservationRef}`, reason: 'E2E_CLEANUP' });
      expect((await exposure(id)).exposure).toBe(0); // every release returned the budget, once
    }, 120_000);

    it('a replayed reserve with the same idempotency key returns the same reservation and holds the budget once; a different key for the same booking is a new, separate hold', async () => {
      const id = await promo({ budgetCapMinor: 70_000 }); const b = reserveBody();
      const a1 = await clinicCommand(id, 'reserve', b); const a2 = await clinicCommand(id, 'reserve', b); const a3 = await clinicCommand(id, 'reserve', b);
      expect([a1.status, a2.status, a3.status]).toEqual([200, 200, 200]); expect(a2.body.reservationRef).toBe(a1.body.reservationRef); expect(a3.body.reservationRef).toBe(a1.body.reservationRef);
      expect((await exposure(id)).exposure).toBe(10_000); expect(await openReservations(id)).toBe(1);
      await clinicCommand(id, 'release', { reservationRef: a1.body.reservationRef, idempotencyKey: `rel:${a1.body.reservationRef}` });
      const after = await clinicCommand(id, 'reserve', b); expect(after.status).toBe(409); // a released reservation is never silently revived by a replay
      expect((await exposure(id)).exposure).toBe(0);
    });

    it('zero, negative, fractional, huge, wrong-type and unknown-field reserve bodies are refused (400/409), never a 5xx, and never hold budget', async () => {
      const id = await promo({ budgetCapMinor: 70_000 });
      for (const amountMinor of [0, -1, -10_000, 1.5, '100', null, 2 ** 31, 1e21, 10_001]) { const r = await reserve(id, { amountMinor }); expect([400, 409], JSON.stringify(amountMinor)).toContain(r.status); }
      for (const bad of [{ currency: 'USD' }, { currency: 'EG' }, { careType: 'SURGERY' }, { version: 0 }, { version: 99 }, { unknownField: 1 }, { bookingRef: '' }, { patientRef: 'x'.repeat(500) }]) { const r = await reserve(id, bad); expect(r.status, JSON.stringify(bad)).toBeLessThan(500); expect(r.status).not.toBe(200); }
      expect((await clinicCommand(id, 'reserve', 'not an object')).status).toBeLessThan(500); expect((await clinicCommand('prm_does_not_exist', 'reserve', reserveBody())).status).toBe(404);
      expect((await exposure(id)).exposure).toBe(0);
    });

    it('a forged sponsoredDiscount block on a booking (wrong promotion, version, amount, someone else\'s or an unknown reservation) never refuses the booking and never gives the discount; the held budget comes back', async () => {
      const id = await promo({ budgetCapMinor: 200_000 }); const other = await promo({ budgetCapMinor: 200_000 });
      const base = { clinicId: facts.clinicId, clinicianId: facts.clinicianId, typeId: p.defaultTypeId };
      const cases: Array<{ name: string; make: (holdId: string) => Promise<unknown> }> = [
        { name: 'wrong version', make: async (h) => { const r = await reserve(id, { bookingRef: h }); return { promotionId: id, promotionVersion: 7, reservationRef: r.body.reservationRef, amountMinor: 10_000, currency: 'EGP' }; } },
        { name: 'amount above the reservation', make: async (h) => { const r = await reserve(id, { bookingRef: h }); return { promotionId: id, promotionVersion: 1, reservationRef: r.body.reservationRef, amountMinor: 50_000, currency: 'EGP' }; } },
        { name: 'another promotion id for the reservation', make: async (h) => { const r = await reserve(id, { bookingRef: h }); return { promotionId: other, promotionVersion: 1, reservationRef: r.body.reservationRef, amountMinor: 10_000, currency: 'EGP' }; } },
        { name: 'a reservation held for ANOTHER booking', make: async () => { const r = await reserve(id, { bookingRef: 'kx_bk_someone_else' }); return { promotionId: id, promotionVersion: 1, reservationRef: r.body.reservationRef, amountMinor: 10_000, currency: 'EGP' }; } },
        { name: 'an unknown reservation', make: async () => ({ promotionId: id, promotionVersion: 1, reservationRef: 'prs_00000000-0000-0000-0000-000000000000', amountMinor: 10_000, currency: 'EGP' }) },
      ];
      for (const c of cases) {
        const { holdId, clinicHoldId, slot } = await holdFor(t.p1); const block = await c.make(holdId);
        const r = await directBooking({ holdId, clinicHoldId, slot, ...base, phone: phone(), block });
        expect([200, 201], `${c.name}: ${JSON.stringify(r.body)}`).toContain(r.status); expect(r.body.sponsoredDiscount, c.name).toMatchObject({ applied: false });
        const apt = await kiorlyAppointmentFor(holdId); expect(apt, c.name).toBeTruthy();
        expect(Number((await q('kiorly', `select count(*)::int c from "PromotionReservation" where "appointmentId" = $1 and state in ('BOOKED','DEBITED')`, [apt.id]))[0].c), c.name).toBe(0); // no reservation became this appointment's discount
      }
      for (const bad of [{ promotionId: id }, { promotionId: id, promotionVersion: 1, reservationRef: 'x', amountMinor: -5, currency: 'EGP' }, { promotionId: id, promotionVersion: 1, reservationRef: 'x', amountMinor: 1, currency: 'EGP', extra: true }]) {
        const { holdId, clinicHoldId, slot } = await holdFor(t.p1); const r = await directBooking({ holdId, clinicHoldId, slot, ...base, phone: phone(), block: bad }); expect(r.status, JSON.stringify(bad)).toBe(400); // a MALFORMED block is a contract violation
      }
      expect(Number((await q('kiorly', `select count(*)::int c from "PromotionReservation" where "promotionId" = $1 and state = 'BOOKED'`, [id]))[0].c)).toBe(0);
      expect(Number((await q('kiorly', `select count(*)::int c from "PromotionBudgetEntry" where "promotionId" = $1 and type = 'DEBIT'`, [id]))[0].c)).toBe(0);
    }, 180_000);

    it('a debit without attendance evidence is refused (PF_NO_ATTENDANCE): a completed appointment with no check-in leaves the wallet untouched and a hard audit row', async () => {
      const id = await promo({ budgetCapMinor: 200_000 }); const { holdId, clinicHoldId, slot } = await holdFor(t.p1);
      const r = await reserve(id, { bookingRef: holdId }); const block = { promotionId: id, promotionVersion: 1, reservationRef: r.body.reservationRef, amountMinor: 10_000, currency: 'EGP' };
      const bk = await directBooking({ holdId, clinicHoldId, slot, clinicId: facts.clinicId, clinicianId: facts.clinicianId, typeId: p.defaultTypeId, phone: phone(), block });
      expect(bk.body.sponsoredDiscount, JSON.stringify(bk.body)).toMatchObject({ applied: true });
      const apt = await kiorlyAppointmentFor(holdId); const before = await walletBalance(facts.tenantId);
      await q('kiorly', `update "Appointment" set status = 'COMPLETED', "checkedInAt" = null where id = $1`, [apt.id]); // a completion nobody checked in
      const audit = await waitFor('the no-attendance hold', async () => (await q('kiorly', `select action, snapshot from "PromotionAudit" where "promotionId" = $1 and action = 'fraud.hold'`, [id]))[0], 170_000, 3000);
      expect(JSON.stringify(audit.snapshot)).toContain('PF_NO_ATTENDANCE');
      expect(Number((await q('kiorly', `select count(*)::int c from "PromotionBudgetEntry" where "promotionId" = $1 and type = 'DEBIT'`, [id]))[0].c)).toBe(0);
      expect(Number((await walletBalance(facts.tenantId)).toFixed(2))).toBe(Number(before.toFixed(2)));
      await q('kiorly', `update "Appointment" set status = 'CANCELLED' where id = $1`, [apt.id]); // leave nothing that could be debited later
      await clinicCommand(id, 'release', { reservationRef: r.body.reservationRef, idempotencyKey: `rel:${r.body.reservationRef}` });
    }, 240_000);

    it('raising the visit fee above the reference before the last approval blocks activation (PF_PRICE_INFLATION): the promotion stays APPROVED and is not offered; the audit says why', async () => {
      const types = await q('kiorly', `select id, "feeAmount"::float f from "AppointmentType" where "clinicId" = $1 and "marketplaceBookable"`, [facts.clinicId]);
      const c = await kiorly(owner, 'POST', '/promotions', promoBody(facts.clinicianId, { budgetCapMinor: 70_000 })); expect([200, 201]).toContain(c.status); const id = c.body.id as string; created.push(id);
      expect((await kiorly(owner, 'POST', `/promotions/${id}/submit`)).status).toBe(200);
      cleanup.push(async () => { for (const ty of types) await q('kiorly', `update "AppointmentType" set "feeAmount" = $2 where id = $1`, [ty.id, ty.f]); });
      for (const ty of types) await q('kiorly', `update "AppointmentType" set "feeAmount" = $2 where id = $1`, [ty.id, Math.round(ty.f * 1.5)]); // +50 percent after the reference was taken
      for (const k of ['CONTENT', 'SCOPE']) expect((await clinicCommand(id, 'review-decision', { version: 1, reviewKind: k, decision: 'APPROVED', decidedBy: `ops:e2e_${k}_rev` })).status).toBe(200);
      expect((await kiorly(owner, 'GET', `/promotions/${id}`)).body.status).toBe('APPROVED');
      expect(JSON.stringify(await q('kiorly', `select action, snapshot from "PromotionAudit" where "promotionId" = $1 and action = 'fraud.hold'`, [id]))).toContain('PF_PRICE_INFLATION');
      expect((await reserve(id)).status).toBe(409); // nothing can be reserved against a promotion that is not ACTIVE
      for (const ty of types) await q('kiorly', `update "AppointmentType" set "feeAmount" = $2 where id = $1`, [ty.id, ty.f]);
    });

    it('a patient whose phone matches a clinic employee cannot use the clinic\'s promotion (PF_SELF_DEAL): the booking stands at the full price, the discount is dropped and the hold is released', async () => {
      const empPhone = phone(); const empId = `e2e_emp_${randomBytes(4).toString('hex')}`;
      await q('kiorly', `insert into "Employee" (id, "tenantId", "clinicId", "employeeNumber", "firstNameEn", "lastNameEn", phone, "jobTitle", "employmentType", "hireDate", "salaryBase", "updatedAt") values ($1,$2,$3,$4,'E2E','Staff',$5,'Receptionist','FULL_TIME', now(), 0, now())`, [empId, facts.tenantId, facts.clinicId, `E2E-${empId.slice(-6)}`, empPhone]);
      cleanup.push(async () => { await q('kiorly', `delete from "Employee" where id = $1`, [empId]); });
      const id = await promo({ budgetCapMinor: 70_000 }); const { holdId, clinicHoldId, slot } = await holdFor(t.p1);
      const r = await reserve(id, { bookingRef: holdId }); const block = { promotionId: id, promotionVersion: 1, reservationRef: r.body.reservationRef, amountMinor: 10_000, currency: 'EGP' };
      const bk = await directBooking({ holdId, clinicHoldId, slot, clinicId: facts.clinicId, clinicianId: facts.clinicianId, typeId: p.defaultTypeId, phone: empPhone, block });
      expect([200, 201]).toContain(bk.status); expect(bk.body.sponsoredDiscount).toMatchObject({ applied: false, reason: 'PF_SELF_DEAL' });
      expect(await kiorlyAppointmentFor(holdId)).toBeTruthy(); expect((await exposure(id)).exposure).toBe(0);
      expect(JSON.stringify(await q('kiorly', `select snapshot from "PromotionAudit" where "promotionId" = $1`, [id]))).toContain('PF_SELF_DEAL');
    });

    it('another clinic cannot read, change or debit this clinic\'s promotion or wallet: 403/404 on every owner route, the wallet balances do not move, and a signed command for a promotion that does not exist is 404', async () => {
      const id = await promo({ budgetCapMinor: 70_000 });
      const mine = await walletBalance(facts.tenantId); const otherTenant = (await q('kiorly', `select "tenantId" from "User" where email = 'admin@drahmedshall.com'`))[0].tenantId as string; const theirs = await walletBalance(otherTenant);
      for (const [m, path, body] of [['GET', `/promotions/${id}`], ['GET', `/promotions/${id}/ledger`], ['POST', `/promotions/${id}/pause`, {}], ['POST', `/promotions/${id}/resume`, {}], ['POST', `/promotions/${id}/archive`, {}], ['POST', `/promotions/${id}/submit`, {}], ['POST', `/promotions/${id}/versions`, promoBody(facts.clinicianId)]] as const) {
        const r = await kiorly(otherOwner, m, path, body); expect([403, 404], `${m} ${path}`).toContain(r.status);
      }
      expect(JSON.stringify((await kiorly(otherOwner, 'GET', '/promotions')).body)).not.toContain(id);
      expect((await kiorly(owner, 'GET', `/promotions/${id}`)).body.status).toBe('ACTIVE'); // untouched
      expect((await kiorly(otherOwner, 'GET', '/credits/wallet')).body).not.toMatchObject({ tenantId: facts.tenantId });
      expect(Number((await walletBalance(facts.tenantId)).toFixed(2))).toBe(Number(mine.toFixed(2))); expect(Number((await walletBalance(otherTenant)).toFixed(2))).toBe(Number(theirs.toFixed(2)));
      expect((await kiorly(undefined, 'GET', `/promotions/${id}`)).status).toBe(401);
    });

    it('WALLET_ONLY with an insufficient wallet refuses the reserve (WALLET_INSUFFICIENT) and holds nothing; WALLET_THEN_INVOICE accepts it and the shortfall is invoiced later', async () => {
      const wallet = await walletBalance(facts.tenantId); const bigMinor = Math.ceil((wallet + 500) * 100); // more than the whole wallet, in minor units
      const only = await promo({ discount: { kind: 'FIXED_MINOR', value: bigMinor }, budgetCapMinor: bigMinor * 2, fundingMode: 'WALLET_ONLY' }, ['CONTENT', 'SCOPE', 'HIGH_VALUE']);
      const r = await reserve(only, { amountMinor: bigMinor }); expect(r.status).toBe(409); expect(r.body.code).toBe('WALLET_INSUFFICIENT'); expect((await exposure(only)).exposure).toBe(0);
      const inv = await promo({ discount: { kind: 'FIXED_MINOR', value: bigMinor }, budgetCapMinor: bigMinor * 2, fundingMode: 'WALLET_THEN_INVOICE' }, ['CONTENT', 'SCOPE', 'HIGH_VALUE']);
      const ok = await reserve(inv, { amountMinor: bigMinor }); expect(ok.status, JSON.stringify(ok.body)).toBe(200); expect((await exposure(inv)).exposure).toBe(bigMinor);
      await clinicCommand(inv, 'release', { reservationRef: ok.body.reservationRef, idempotencyKey: `rel:${ok.body.reservationRef}` });
    });

    it('the same patient cannot stack two promotions on one booking: with two active promotions Kiorex quotes and reserves ONE (the larger), one line and one open hold exist for the booking', async () => {
      const small = await promo({ discount: { kind: 'FIXED_MINOR', value: 5_000 }, budgetCapMinor: 70_000 }); const big = await promo({ discount: { kind: 'FIXED_MINOR', value: 12_000 }, budgetCapMinor: 70_000 });
      await isolate(owner, created, [small, big]);
      await waitFor('both promotions in the Kiorex projection', async () => (await q('kiorex_platform', `select count(*)::int c from "SponsoredPromotionProjection" where "promotionId" = any($1) and status = 'ACTIVE'`, [[small, big]]))[0].c === 2, 60_000, 1000);
      const pt = await freshPatient('Stack Tester'); const b = await bookWith(pt.token, p);
      const line = await kxLine(b.id); expect(line).toMatchObject({ promotionId: big, amountMinor: 12_000 });
      expect(Number((await q('kiorex_platform', `select count(*)::int c from "BookingSponsoredDiscount" where "bookingIntentId" = $1`, [b.id]))[0].c)).toBe(1);
      expect(Number((await q('kiorly', `select count(*)::int c from "PromotionReservation" where "bookingRef" = $1 and state in ('RESERVED','BOOKED')`, [b.id]))[0].c)).toBe(1);
      await expect(q('kiorex_platform', `insert into "BookingSponsoredDiscount" (id, "bookingIntentId", "promotionId", "promotionVersion", "amountMinor", "reservationRef") values ('bsd_e2e_dup', $1, $2, 1, 5000, 'prs_dup_e2e')`, [b.id, small])).rejects.toThrow(/unique|duplicate/i); // the database refuses a second line on a booking
      const again = await kiorex(pt.token, 'POST', `/bookings/${b.id}/confirm`, confirmBody, { 'Idempotency-Key': b.id }); expect(again.status).toBe(200);
      expect(Number((await q('kiorly', `select count(*)::int c from "PromotionReservation" where "bookingRef" = $1`, [b.id]))[0].c)).toBe(1); // a replayed confirm reserves nothing more
      await kiorex(pt.token, 'POST', `/bookings/${b.id}/cancel`, { reason: 'test' });
    }, 120_000);

    it('a high-value promotion needs a THIRD review by a second approver; the same ops person cannot approve both, and the author (the organisation) cannot decide any review', async () => {
      const c = await kiorly(owner, 'POST', '/promotions', promoBody(facts.clinicianId, { budgetCapMinor: 6_000_000 })); expect([200, 201]).toContain(c.status); const id = c.body.id as string; created.push(id);
      const s = await kiorly(owner, 'POST', `/promotions/${id}/submit`); expect(s.status).toBe(200);
      expect((s.body.reviews ?? []).map((r: any) => r.kind).sort()).toEqual(['CONTENT', 'HIGH_VALUE', 'SCOPE']);
      await waitFor('promotion in the Kiorex review queue', async () => (await kiorex((await opsLogin()).accessToken, 'GET', `${PROMO_ADMIN}/${id}`)).status === 200, 60_000, 1000);
      const reqBy = (await q('kiorly', `select "requestedBy" from "PromotionComplianceReview" where "promotionId" = $1 limit 1`, [id]).catch(() => [{ requestedBy: '' }]))[0]?.requestedBy as string;
      if (reqBy) { const selfApprove = await clinicCommand(id, 'review-decision', { version: 1, reviewKind: 'CONTENT', decision: 'APPROVED', decidedBy: reqBy }); expect(selfApprove.status).toBe(403); } // the author never decides
      for (const k of ['CONTENT', 'SCOPE']) expect((await kiorex((await opsLogin()).accessToken, 'POST', `${PROMO_ADMIN}/${id}/decisions`, { version: 1, kind: k, decision: 'APPROVED' })).status).toBe(200);
      const same = await kiorex((await opsLogin()).accessToken, 'POST', `${PROMO_ADMIN}/${id}/decisions`, { version: 1, kind: 'HIGH_VALUE', decision: 'APPROVED' }); expect(same.status).toBe(403); expect(same.body.code).toBe('SECOND_APPROVER_REQUIRED');
      expect((await kiorly(owner, 'GET', `/promotions/${id}`)).body.status).toBe('IN_REVIEW');
      const second = await kiorex(ops2.token, 'POST', `${PROMO_ADMIN}/${id}/decisions`, { version: 1, kind: 'HIGH_VALUE', decision: 'APPROVED' }); expect(second.status, JSON.stringify(second.body)).toBe(200);
      await waitFor('ACTIVE after the second approver', async () => (await kiorly(owner, 'GET', `/promotions/${id}`)).body?.status === 'ACTIVE', 30_000, 1000);
      expect((await kiorex(t.p1, 'POST', `${PROMO_ADMIN}/${id}/decisions`, { version: 1, kind: 'CONTENT', decision: 'APPROVED' })).status).toBe(403); // a patient is not a reviewer
    }, 150_000);

    it('a replayed reversal after completion returns the credit ONCE: the wallet gets the discount back one time, the budget is freed one time, and the patient is never paid', async () => {
      const id = await promo({ budgetCapMinor: 70_000 });
      await isolate(owner, created, [id]);
      await waitFor('promotion in the Kiorex projection', async () => (await q('kiorex_platform', `select 1 from "SponsoredPromotionProjection" where "promotionId" = $1 and status = 'ACTIVE'`, [id]))[0], 60_000, 1000);
      const before = await walletBalance(facts.tenantId); const pt = await freshPatient('Reverse Tester'); const b = await bookWith(pt.token, p);
      const line0 = await kxLine(b.id); expect(line0?.promotionId, 'the quote picks the best promotion; this suite has several active ones').toBeTruthy();
      await completeVisit(pt.token, b.id, staff);
      await waitFor('the Clinic debit', async () => (await kxLine(b.id))?.state === 'DEBITED' ? true : undefined, 170_000, 3000);
      const line = await kxLine(b.id); const promoOfLine = line.promotionId as string; const amount = Number(line.amountMinor) / 100;
      const afterDebit = await walletBalance(facts.tenantId); expect(Number((before - afterDebit).toFixed(2))).toBe(Number(amount.toFixed(2)));
      const exp1 = await exposure(promoOfLine);
      const rev = { reservationRef: line.reservationRef, idempotencyKey: `rev:${line.reservationRef}`, reason: 'REFUNDED' };
      const r1 = await clinicCommand(promoOfLine, 'reverse', rev); const r2 = await clinicCommand(promoOfLine, 'reverse', rev); const r3 = await clinicCommand(promoOfLine, 'reverse', { ...rev, idempotencyKey: `rev2:${line.reservationRef}` });
      expect([r1.status, r2.status, r3.status]).toEqual([200, 200, 200]);
      expect(Number((await walletBalance(facts.tenantId)).toFixed(2))).toBe(Number((afterDebit + amount).toFixed(2))); // exactly once, however often it is replayed
      const exp2 = await exposure(promoOfLine); expect(exp2.reverse - exp1.reverse).toBe(Number(line.amountMinor)); expect(Number((await q('kiorly', `select count(*)::int c from "PromotionBudgetEntry" where "promotionId" = $1 and type = 'REVERSE_DEBIT' and "reservationId" = (select id from "PromotionReservation" where "reservationRef" = $2)`, [promoOfLine, line.reservationRef]))[0].c)).toBe(1);
      await waitFor('Kiorex line REVERSED', async () => (await kxLine(b.id))?.state === 'REVERSED' ? true : undefined, 60_000, 1000);
      expect(Number((await q('kiorex_platform', `select coalesce(sum(r."amountMinor"),0)::int s from "Refund" r join "PaymentIntent" p on p.id = r."paymentId" where p."bookingId" = $1`, [b.id]))[0].s)).toBe(0); // nobody was refunded by a reversal: it moves the clinic's credit, not the patient's money
    }, 300_000);
  });
});
