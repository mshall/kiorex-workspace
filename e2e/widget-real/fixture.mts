// Fixture for the REAL Passport widget run (kiorex-platform/apps/widget/e2e/real-passport.spec.ts), no stand-ins:
//   up   registers the widget origin for the KX-DEV clinic through the real Clinic API (PUT /growth/widget), waits until the real Kiorex API serves the embed with that origin in frame-ancestors, writes .cache/widget-real.json
//   down cancels the appointments the run booked (through the Clinic, as production would) and restores the clinic row / disables the widget
// Needs the dev stack (e2e/scripts/up.sh, with Passport restarted so the `kiorex-widget` client is loaded) and seeded demo data.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tokens, providerBySpecialty } from '../src/fixtures.js';
import { kxdevGrowthTenant } from '../src/growth.js';
import { kiorly, q, staffLogin, waitFor } from '../src/clients.js';
import { closeAll } from '../src/db.js';

const HOST_ORIGIN = 'https://widget-host.example.test';
const FILE = new URL('../.cache/widget-real.json', import.meta.url);
const mode = process.argv[2];

if (mode === 'up') {
  const t = await tokens();
  const p = await providerBySpecialty(t.p1, 'paediatrics');
  const fx = await kxdevGrowthTenant(p.id);
  const put = await kiorly(fx.admin, 'PUT', '/growth/widget', { clinicId: fx.clinicId, enabled: true, allowedOrigins: [HOST_ORIGIN], theme: 'light', locale: 'en' });
  if (put.status !== 200) throw new Error(`PUT /growth/widget ${put.status} ${JSON.stringify(put.body)}`);
  await waitFor('widget registration reaches the real Kiorex API', async () => {
    const r = await fetch(`http://localhost:4000/v1/embed/${fx.slug}`, { headers: { 'sec-fetch-dest': 'iframe' } });
    await r.arrayBuffer();
    return r.status === 200 && (r.headers.get('content-security-policy') ?? '').includes(HOST_ORIGIN);
  }, 60_000, 1000);
  mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
  writeFileSync(FILE, JSON.stringify({ slug: fx.slug, clinicId: fx.clinicId, origin: HOST_ORIGIN, startedAt: new Date().toISOString() }));
  console.log(JSON.stringify({ slug: fx.slug, clinicId: fx.clinicId, origin: HOST_ORIGIN }));
} else if (mode === 'down') {
  const f = existsSync(FILE) ? (JSON.parse(readFileSync(FILE, 'utf8')) as { slug: string; clinicId: string; startedAt: string }) : null;
  const staff = await staffLogin('kxdev.mona.fahmy@kiorly.dev');
  const rows = await q('kiorly', `select a.id from "Appointment" a where a."externalReference" like 'kx_bk_%' and a.status in ('SCHEDULED','CONFIRMED') and a."createdAt" >= $1`, [f?.startedAt ?? new Date(Date.now() - 3600_000).toISOString()]);
  for (const r of rows) await kiorly(staff, 'PATCH', `/appointments/${r.id}/status`, { status: 'CANCELLED', cancellationReason: 'e2e widget cleanup' }).catch(() => undefined);
  if (f) {
    const admin = await staffLogin('e2e.growth.admin@kiorly.dev').catch(() => null);
    if (admin) await kiorly(admin, 'PUT', '/growth/widget', { clinicId: f.clinicId, enabled: false, allowedOrigins: [] }).catch(() => undefined);
    await q('kiorly', `delete from "User" where id = 'e2e_growth_admin'`).catch(() => undefined);
    await q('kiorly', `update "Clinic" set "bookingSlug" = null where id = $1 and "bookingSlug" = $2`, [f.clinicId, f.slug]).catch(() => undefined);
  }
  console.log(`cancelled ${rows.length} appointment(s)`);
} else { console.error('usage: fixture.mts up|down'); process.exit(2); }
await closeAll();
