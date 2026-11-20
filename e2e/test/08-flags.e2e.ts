import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tokens, providerBySpecialty, hold, pickSlot, waitProvidersLive, type Provider } from '../src/fixtures.js';
import { kiorex, kiorly, staffLogin, waitFor } from '../src/clients.js';

/** ADR-023 flags OFF at global/market scope · OP-07/08 reason+ticket · FF03 Kiorly picks up the snapshot · ADR-025 safety controls are not flags. */
describe('g. Feature-flag control plane across Kiorex and Kiorly', () => {
  let t: Awaited<ReturnType<typeof tokens>>; let p: Provider; let staff: string;
  const set = (key: string, scope: 'GLOBAL' | 'MARKET', value: 'ON' | 'OFF', reason = 'E2E check', scopeId?: string) =>
    kiorex(t.ops, 'PUT', `/admin/flags/${key}/values`, { scope, ...(scopeId ? { scopeId } : {}), value, reason, ticket: 'E2E-1' });
  const kiorlyEffective = async (key: string) => {
    const r = await kiorly(staff, 'GET', '/feature-flags/effective');
    return r.body.flags.find((f: any) => f.key === key);
  };

  beforeAll(async () => { t = await tokens(); p = await providerBySpecialty(t.p1, 'paediatrics'); staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev'); });
  afterAll(async () => {
    await set('kiorex.marketplace', 'GLOBAL', 'ON', 'E2E restore');
    await set('clinic.kiorex_listing', 'MARKET', 'ON', 'E2E restore', 'EG');
  });

  it('a flag change needs a reason and a ticket (OP-08)', async () => {
    const r = await kiorex(t.ops, 'PUT', '/admin/flags/kiorex.marketplace/values', { scope: 'GLOBAL', value: 'OFF', reason: '', ticket: '' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('REASON_AND_TICKET_REQUIRED');
    expect((await kiorex(t.p1, 'PUT', '/admin/flags/kiorex.marketplace/values', { scope: 'GLOBAL', value: 'OFF', reason: 'x', ticket: 'y' })).status).toBe(403);
  });

  it('kiorex.marketplace OFF globally -> booking endpoints 403 FEATURE_DISABLED; data stays readable; ON restores', async () => {
    const slot = await pickSlot(t.p1, p);
    const off = await set('kiorex.marketplace', 'GLOBAL', 'OFF', 'E2E: incident drill');
    expect(off.status).toBe(200);
    const blocked = await hold(t.p1, p, slot);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('FEATURE_DISABLED');
    expect(blocked.body.key).toBe('kiorex.marketplace');
    const eff = await kiorex(t.p1, 'GET', '/flags/effective?market=EG');
    expect(eff.body.flags['kiorex.marketplace'].enabled).toBe(false);
    // OFF never hides data: the booking list and search still answer
    expect((await kiorex(t.p1, 'GET', '/bookings')).status).toBe(200);
    expect((await kiorex(t.p1, 'GET', '/search/providers?specialty=paediatrics')).status).toBe(200);
    const audit = await kiorex(t.ops, 'GET', '/admin/flags/audit');
    expect(JSON.stringify(audit.body)).toContain('E2E: incident drill');

    expect((await set('kiorex.marketplace', 'GLOBAL', 'ON', 'E2E: drill over')).status).toBe(200);
    const ok = await hold(t.p1, p, slot);
    expect(ok.status).toBe(201);
    await kiorex(t.p1, 'POST', `/bookings/${ok.body.id}/release`);
  });

  it('clinic.kiorex_listing OFF for market EG -> Kiorly picks the snapshot up and its effective value is OFF; ON restores', async () => {
    expect((await kiorlyEffective('clinic.kiorex_listing')).effective).toBe(true);
    expect((await set('clinic.kiorex_listing', 'MARKET', 'OFF', 'E2E: EG listing pause', 'EG')).status).toBe(200);
    const off = await waitFor('Kiorly effective OFF', async () => { const f = await kiorlyEffective('clinic.kiorex_listing'); return f?.effective === false ? f : undefined; }, 60_000, 1000);
    expect(off.source).toMatch(/market/i);
    const prop = await kiorex(t.ops, 'GET', '/admin/flags/propagation');
    expect(prop.status).toBe(200);
    expect((await set('clinic.kiorex_listing', 'MARKET', 'ON', 'E2E: restore', 'EG')).status).toBe(200);
    await waitFor('Kiorly effective ON', async () => (await kiorlyEffective('clinic.kiorex_listing'))?.effective === true, 60_000, 1000);
    // the paused listings come back LIVE in Kiorex via LISTING_STATUS_CHANGED
    await waitProvidersLive(t.ops);
  });

  it('a safety control cannot be registered as a flag (ADR-025)', async () => {
    for (const key of ['kiorex.emergency_routing', 'kiorex.consent_enforcement', 'clinic.tenant_isolation']) {
      const r = await kiorex(t.ops, 'POST', '/admin/flags/definitions', { key, product: 'kiorex', class: 'MODULE', scopes: ['GLOBAL'], description: 'must be refused' });
      expect(r.status, key).toBe(400);
      expect(r.body.code).toBe('SAFETY_CONTROL_NOT_A_FLAG');
    }
  });
});
