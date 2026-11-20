import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, syncProviders } from '../src/fixtures.js';
import { kiorex, kiorly, staffLogin, q, waitFor } from '../src/clients.js';

/**
 * KXMHV08 / KNCP / KNKX01 care-plan request (P3 draft contract), REAL stack: Kiorex POST /care-plans -> Kiorly POST /marketplace/v1/care-plan-requests (HMAC,
 * idempotent on requestRef, address encrypted) -> nurse inbox -> accept creates the plan and its visits -> CARE_PLAN_CONFIRMED -> Kiorex plan CONFIRMED with
 * one booking per visit. Decline path answers DECLINED. Gates nurse.care_plans (GKN1) / kiorex.home_visits are the DEV-ONLY-NOT-A-REAL-GATE rows of the dev DB.
 */
const PROVIDER = 'demo_l_rev23_nsolo_mona';
const TYPE = 'demo_ty_nsolo_wound_dressing';
const STREET = '88 E2E Care Plan Street';

describe('p. Care-plan request Kiorex -> Kiorly Nurse -> confirmed visits (KXMHV08, KNCP)', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let nurse: string; let addr: string; let nurseUserId: string;
  const plans: string[] = [];

  beforeAll(async () => {
    t = await tokens(); await syncProviders(t.ops);
    nurse = await staffLogin('mona@nurse-demo.kiorly.test', 'Demo@12345');
    nurseUserId = (await q('kiorly', `select id from "User" where email = 'mona@nurse-demo.kiorly.test'`))[0].id;
    const a = await kiorex(t.p1, 'POST', '/me/addresses', { label: 'E2E plan', governorate: 'cairo', district: 'nasr-city', street: STREET, building: '9', floor: '1', flat: '3' });
    expect(a.status, JSON.stringify(a.body)).toBe(201); addr = a.body.id;
    expect((await kiorex(t.p1, 'POST', `/me/addresses/${addr}/confirm`)).status).toBe(200);
  });
  afterAll(async () => {
    // end the confirmed plan so its future visits do not stay on the nurse's calendar (CARE_PLAN_ENDED -> Kiorex cancels the bookings)
    for (const r of await q('kiorly', `select "carePlanId" from "CarePlanRequest" where "requestRef" = any($1) and "carePlanId" is not null`, [plans])) {
      await kiorly(nurse, 'POST', `/nurse/care-plans/${r.carePlanId}/end`, { reason: 'CANCELLED_BY_PROVIDER', dischargeNote: 'E2E cleanup' }).catch(() => undefined);
    }
    if (addr) await kiorex(t.p1, 'DELETE', `/me/addresses/${addr}`).catch(() => undefined);
  });

  async function request() {
    // day +10: beyond the +2..+9 days that 13-home-visit books on the same nurse's calendar (its CHECKED_IN visits stay) and the seeded demo visits (<= +3 days)
    const start = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
    const r = await kiorex(t.p1, 'POST', '/care-plans', { providerId: PROVIDER, typeId: TYPE, addressId: addr, preferredStartDate: start, notes: 'E2E wound-care plan' });
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    plans.push(r.body.id);
    return { id: r.body.id as string, start };
  }
  const inbox = async (requestRef: string) => waitFor('Kiorly care-plan request', async () => {
    const list = await kiorly(nurse, 'GET', '/nurse/care-plan-requests');
    return (Array.isArray(list.body) ? list.body : list.body.items ?? []).find((x: any) => x.requestRef === requestRef);
  });

  it('request lands in the nurse inbox (idempotent, address encrypted), accept creates the plan, Kiorex shows CONFIRMED with one booking per visit', async () => {
    const { id, start } = await request();
    const row = await inbox(id);
    expect(row.status).toBe('RECEIVED');
    const raw = JSON.stringify((await q('kiorly', `select * from "CarePlanRequest" where "requestRef" = $1`, [id]))[0]);
    expect(raw).not.toContain(STREET);
    expect((await q('kiorly', `select count(*)::int c from "CarePlanRequest" where "requestRef" = $1`, [id]))[0].c).toBe(1);

    const acc = await kiorly(nurse, 'POST', `/nurse/care-plan-requests/${row.id}/accept`, {
      nurseId: nurseUserId, startDate: start, items: [{ appointmentTypeId: TYPE, everyDays: 2, durationDays: 5, timeOfDay: '10:00' }],
    });
    expect(acc.status, JSON.stringify(acc.body)).toBeLessThan(300);

    const confirmed = await waitFor('Kiorex plan CONFIRMED', async () => { const p = (await kiorex(t.p1, 'GET', `/care-plans/${id}`)).body; return p.status === 'CONFIRMED' ? p : undefined; }, 60_000, 1500);
    expect(confirmed.visits.length).toBeGreaterThanOrEqual(2);
    for (const v of confirmed.visits) expect(['CONFIRMED', 'PENDING_CLINIC']).toContain(v.status);
    // the plan is listed for the patient
    expect((await kiorex(t.p1, 'GET', '/care-plans')).body.some((p: any) => p.id === id)).toBe(true);
    // a second decision on the same request is refused
    const again = await kiorly(nurse, 'POST', `/nurse/care-plan-requests/${row.id}/decline`, { reason: 'late' });
    expect(again.status).toBe(409);
  });

  it('decline: the request is DECLINED at Kiorly and the Kiorex plan does not become CONFIRMED', async () => {
    const { id } = await request();
    const row = await inbox(id);
    const dec = await kiorly(nurse, 'POST', `/nurse/care-plan-requests/${row.id}/decline`, { reason: 'Outside my schedule (E2E)' });
    expect(dec.status, JSON.stringify(dec.body)).toBeLessThan(300);
    expect((await q('kiorly', `select status from "CarePlanRequest" where id = $1`, [row.id]))[0].status).toBe('DECLINED');
    const p = (await kiorex(t.p1, 'GET', `/care-plans/${id}`)).body;
    expect(p.status).not.toBe('CONFIRMED');
  });
});
