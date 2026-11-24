import { PATIENT_1, PATIENT_2 } from '../src/env.js';
import { kiorex, patientLogin } from '../src/clients.js';
import { providers, freeSlots, hold, confirm, tokens } from '../src/fixtures.js';
const t = await tokens();
const ps = (await providers(t.p1)).filter((p) => /KX-DEV|Hesham|Karim|Mona/.test(p.nameEn)).slice(0, 3);
console.log('providers', ps.map((p) => p.nameEn));
const p = ps[0]; const slots = await freeSlots(t.p1, p, 12, { fresh: true }); const slot = slots[Math.floor(slots.length / 2)];
// 1) same slot, 12 parallel holds, 2 patients
const rs = await Promise.all(Array.from({ length: 12 }, (_, i) => hold(i % 2 ? t.p1 : t.p2, p, slot)));
console.log('parallel holds on one slot:', rs.map((r) => r.status).join(','), '=> created', rs.filter((r) => r.status === 201).length);
const winner = rs.find((r) => r.status === 201)!;
// 2) parallel confirm with the SAME idempotency key
const cf = await Promise.all(Array.from({ length: 8 }, () => confirm(rs.indexOf(winner) % 2 ? t.p1 : t.p2, winner.body.id, 'race-key-1')));
console.log('parallel confirms same key:', cf.map((r) => r.status).join(','));
// 3) parallel confirm DIFFERENT keys on same hold
const owner = rs.indexOf(winner) % 2 ? t.p1 : t.p2;
const cf2 = await Promise.all(Array.from({ length: 6 }, (_, i) => confirm(owner, winner.body.id, 'race-key-x' + i)));
console.log('parallel confirms different keys:', cf2.map((r) => r.status).join(','));
const b = await kiorex(owner, 'GET', `/bookings/${winner.body.id}`); console.log('booking', b.body.status, b.body.deposit?.status);
// 4) parallel cancels (refund race)
await new Promise((r) => setTimeout(r, 4000));
const cc = await Promise.all(Array.from({ length: 6 }, () => kiorex(owner, 'POST', `/bookings/${winner.body.id}/cancel`, { reason: 'race' })));
console.log('parallel cancels:', cc.map((r) => r.status).join(','), JSON.stringify(cc[0].body).slice(0, 160));
const b2 = await kiorex(owner, 'GET', `/bookings/${winner.body.id}`); console.log('after', b2.body.status, JSON.stringify(b2.body.deposit ?? {}).slice(0, 200));
