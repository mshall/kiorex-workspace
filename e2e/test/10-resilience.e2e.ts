import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tokens, waitProvidersLive, providerBySpecialty, hold, confirm, pickSlot, kiorlyAppointmentFor, type Provider } from '../src/fixtures.js';
import { kiorex, q, waitFor } from '../src/clients.js';
import { kiorlyMarketplace } from '../src/hmac.js';

// stdio 'ignore': the restarted daemon must not inherit a pipe the parent waits on
const svc = (act: 'stop' | 'start') => { spawnSync(fileURLToPath(new URL('../scripts/svc.sh', import.meta.url)), ['kiorly', act], { stdio: 'ignore', timeout: 120_000 }); };

/** KX-09 §05 failure table: clinic system busy -> intent stays PENDING/HELD (never a new idempotency key), circuit opens, reconciliation resolves it. */
describe('i. Resilience: Kiorly Clinic API down', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let p: Provider;
  let lost: { id: string; slot: { startsAt: string; endsAt: string } }; let never: { id: string };

  beforeAll(async () => {
    t = await tokens(); await waitProvidersLive(t.ops); p = await providerBySpecialty(t.p1, 'paediatrics');
    const s1 = await pickSlot(t.p1, p); const h1 = await hold(t.p1, p, s1); expect(h1.status).toBe(201); never = { id: h1.body.id };
    let s2 = await pickSlot(t.p1, p); while (s2.startsAt === s1.startsAt) s2 = await pickSlot(t.p1, p);
    const h2 = await hold(t.p1, p, s2); expect(h2.status).toBe(201); lost = { id: h2.body.id, slot: s2 };
  });
  afterAll(() => { svc('start'); });

  it('with Kiorly down: confirm answers 503 CLINIC_SYSTEM_BUSY and the booking stays HELD with an UNCERTAIN call; holds are refused', async () => {
    svc('stop');
    for (const b of [never, lost]) {
      const r = await confirm(t.p1, b.id);
      expect(r.status).toBe(503);
      expect(r.body).toMatchObject({ code: 'CLINIC_SYSTEM_BUSY', retryable: true, bookingId: b.id, status: 'HELD' });
      const row = (await q('kiorex_platform', `select status, "callState" from "BookingIntent" where id = $1`, [b.id]))[0];
      expect(row).toEqual({ status: 'HELD', callState: 'UNCERTAIN' });
    }
    // repeated failures open the per-clinic circuit
    for (let i = 0; i < 6; i++) await hold(t.p2, p, await pickSlot(t.p2, p).catch(() => ({ startsAt: new Date(Date.now() + 5 * 86400_000).toISOString(), endsAt: new Date(Date.now() + 5 * 86400_000 + 1800_000).toISOString() })));
    const circuits = await kiorex(t.ops, 'GET', '/admin/circuits');
    expect(circuits.body.some((c: any) => c.open)).toBe(true);
    const blocked = await hold(t.p2, p, { startsAt: new Date(Date.now() + 6 * 86400_000).toISOString(), endsAt: new Date(Date.now() + 6 * 86400_000 + 1800_000).toISOString() });
    expect(blocked.status).toBe(503);
    expect(blocked.body.code).toBe('CLINIC_SYSTEM_BUSY');
    // the catalogue keeps serving from Kiorex's own projection
    expect((await kiorex(t.p1, 'GET', '/search/providers?specialty=paediatrics&pageSize=30&sort=rating')).status).toBe(200);
  });

  it('after restart: reconciliation adopts a booking Kiorly created but whose reply was lost; the never-created intent expires; a new booking works once the circuit closes', async () => {
    svc('start');
    // the lost-reply case: Kiorly did create the appointment under the booking id, Kiorex never learned of it
    const prof = (await kiorex(t.p1, 'GET', '/me/profile')).body;
    const [first, ...rest] = String(prof.nameEn ?? 'Amira Test').split(' ');
    const row = (await q('kiorex_platform', `select "clinicId", "clinicianId", "typeId", "startsAt", "endsAt", "holdId" from "BookingIntent" where id = $1`, [lost.id]))[0];
    const direct = await kiorlyMarketplace('POST', '/bookings', {
      clinicId: row.clinicId, clinicianId: row.clinicianId, typeId: row.typeId, startsAt: row.startsAt, endsAt: row.endsAt, holdId: row.holdId, holdExternalRef: lost.id,
      patient: { phone: '+201000000001', firstNameEn: first, lastNameEn: rest.join(' ') || first }, marketplaceConsentGranted: true, remindersConsentGranted: true,
    }, { 'idempotency-key': lost.id });
    expect([200, 201], JSON.stringify(direct.body)).toContain(direct.status);

    // reconciliation only looks at calls unresolved for > 5 min: age them, then run the ops job
    await q('kiorex_platform', `update "BookingIntent" set "updatedAt" = (now() at time zone 'utc') - interval '10 minutes' where id = any($1)`, [[lost.id, never.id]]);
    // The per-clinic circuit opened while Kiorly was down and closes after ~30 s: a reconciliation that runs while it is still open counts the Kiorly call as an
    // error and leaves the intents for the next sweep (by design). Wait for it to close, and repeat the sweep until it could actually read both bookings.
    await waitFor('circuit closed', async () => !(await kiorex(t.ops, 'GET', '/admin/circuits')).body.some((c: any) => c.open), 60_000, 2000);
    let run = await kiorex(t.ops, 'POST', '/admin/reconciliation/bookings/run');
    for (let i = 0; i < 5 && run.status === 200 && run.body.errors > 0; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      await q('kiorex_platform', `update "BookingIntent" set "updatedAt" = (now() at time zone 'utc') - interval '10 minutes' where id = any($1) and status = 'HELD'`, [[lost.id, never.id]]);
      run = await kiorex(t.ops, 'POST', '/admin/reconciliation/bookings/run');
    }
    expect(run.status).toBe(200);
    expect(run.body.errors).toBe(0);
    expect(run.body.checked).toBeGreaterThanOrEqual(1);
    const adopted = await waitFor('lost-reply booking adopted', async () => (await kiorex(t.p1, 'GET', `/bookings/${lost.id}`)).body.status === 'CONFIRMED').catch(async (e) => {
      const got = await kiorex(t.p1, 'GET', `/bookings/${lost.id}`);
      throw new Error(`${e.message}: Kiorex says ${got.status} ${JSON.stringify(got.body).slice(0, 300)}; reconciliation run ${JSON.stringify(run.body)}; Kiorly row ${JSON.stringify(await q('kiorly', 'select status from "Appointment" where "externalReference" = $1', [lost.id]))}`);
    });
    expect(adopted).toBe(true);
    // Kiorly never saw the other one: reconciliation expires the intent (NEVER_CREATED) rather than guessing or duplicating
    const gone = (await kiorex(t.p1, 'GET', `/bookings/${never.id}`)).body;
    expect(gone.status).toBe('EXPIRED');
    expect(gone.failureCode).toBe('NEVER_CREATED');
    expect((await confirm(t.p1, never.id)).status).toBe(409);

    // the circuit closes after 30 s; the patient then books again end to end
    const fresh = await waitFor('new booking after the circuit closes', async () => {
      const h = await hold(t.p1, p, await pickSlot(t.p1, p));
      if (h.status !== 201) return undefined;
      const c = await confirm(t.p1, h.body.id);
      return c.status === 200 ? { id: h.body.id, status: c.body.status } : undefined;
    }, 90_000, 3000);
    expect(['CONFIRMED', 'PENDING_CLINIC']).toContain(fresh.status);
    for (const id of [lost.id, fresh.id]) {
      const n = await q('kiorly', `select count(*)::int c from "Appointment" where "externalReference" = $1`, [id]);
      expect(n[0].c).toBe(1);
    }
    expect((await q('kiorly', `select count(*)::int c from "Appointment" where "externalReference" = $1`, [never.id]))[0].c).toBe(0);
  });
});
