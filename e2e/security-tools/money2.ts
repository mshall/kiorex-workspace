import { kiorex, q, waitFor, syncProviders } from '../src/clients.js';
import { tokens, providerBySpecialty, book, kiorlyAppointmentFor } from '../src/fixtures.js';
const t = await tokens(); const p = await providerBySpecialty(t.p1, 'paediatrics');
const apt0 = await kiorlyAppointmentFor((await book(t.p1, p)).id);
await q('kiorly', `update "AppointmentType" set "depositAmount" = 150 where "clinicId" = $1 and "marketplaceBookable"`, [apt0.clinicId]);
await q('kiorly', `update "MarketplaceListing" set "updatedAt" = now() at time zone 'utc' + interval '1 second' where "clinicId" = $1`, [apt0.clinicId]);
await syncProviders(t.ops);
const b = await book(t.p1, p); const co = await kiorex(t.p1, 'POST', `/bookings/${b.id}/deposit-checkout`); const pid = co.body.paymentId;
await kiorex(undefined, 'POST', `/pay/fake-checkout/${pid}/complete`, { outcome: 'pay' });
await waitFor('PAID', async () => (await kiorex(t.p1, 'GET', `/bookings/${b.id}`)).body.depositStatus === 'PAID');
const state = async () => (await q('kiorex_platform', `select status, "amountMinor", "refundedMinor" from "PaymentIntent" where id = $1`, [pid]))[0];
const r = async (amountMinor: any, reason = 'x') => { const x = await kiorex(t.ops, 'POST', '/admin/payments/refund', { paymentId: pid, amountMinor, reason }); return `${JSON.stringify(amountMinor)} -> ${x.status} ${JSON.stringify(x.body).slice(0, 90)}`; };
for (const a of [-100, 0, 0.5, 1.5, '100', 'NaN', 1e21, 15001, Number.MAX_SAFE_INTEGER]) console.log(await r(a));
console.log('state', await state());
console.log(await r(10000, 'a'));
console.log(await r(10000, 'b'));   // exceeds remaining 5000
console.log(await r(5000, 'c'));
console.log(await r(1, 'd'));
console.log('final state', await state(), 'refund rows', await q('kiorex_platform', `select "amountMinor", status from "Refund" where "paymentId" = $1 order by "createdAt"`, [pid]));
// parallel partial refunds
const b2 = await book(t.p1, p); const co2 = await kiorex(t.p1, 'POST', `/bookings/${b2.id}/deposit-checkout`); const pid2 = co2.body.paymentId;
await kiorex(undefined, 'POST', `/pay/fake-checkout/${pid2}/complete`, { outcome: 'pay' }); await waitFor('PAID', async () => (await kiorex(t.p1, 'GET', `/bookings/${b2.id}`)).body.depositStatus === 'PAID');
const par = await Promise.all(Array.from({ length: 8 }, (_, i) => kiorex(t.ops, 'POST', '/admin/payments/refund', { paymentId: pid2, amountMinor: 5000, reason: 'par' + i })));
console.log('8 parallel 5000 refunds of 15000:', par.map((x) => x.status).join(','), await q('kiorex_platform', `select status, "amountMinor", "refundedMinor" from "PaymentIntent" where id = $1`, [pid2]));
await q('kiorly', `update "AppointmentType" set "depositAmount" = null where "clinicId" = $1`, [apt0.clinicId]);
