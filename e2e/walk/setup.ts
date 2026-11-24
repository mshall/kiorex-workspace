/** Creates fresh STANDALONE organisations for the Connect wizard browser walk (DEV ONLY). Usage: npx tsx walk/setup.ts [tag]  -> walk/state.json */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { kiorly, q } from '../src/clients.js';
import { lab, pharmacy, rnd } from '../src/verticals.js';
import { closeAll } from '../src/db.js';

const tag = (process.argv[2] ?? rnd()).toLowerCase();
const pw = 'Demo@12345';
const out: Record<string, any> = { tag };

async function clinic(label: string, plan = 'LITE') {
  const email = `walk-clinic-${label}-${tag}@example.com`;
  const phone = `+20109${String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7)}`;
  await kiorly(undefined, 'POST', '/public/signup/otp', { phone, market: 'EG' });
  const v = await kiorly(undefined, 'POST', '/public/signup/verify', { phone, code: '424242', market: 'EG' });
  const docs = ['terms_of_service', 'subscription_terms', 'kiorex_marketplace_fees', 'dpa', 'patient_privacy_notice', 'acceptable_use', 'refund_policy'];
  const legalAcceptances = await Promise.all(docs.map(async (d) => ({ document: d, version: (await kiorly(undefined, 'GET', `/public/legal/${d}`)).body?.version ?? '2026-11-18' })));
  const done = await kiorly(undefined, 'POST', '/public/signup/complete', { signupToken: v.body.signupToken, profile: { displayName: `Dr Walk ${label} ${tag}`, email, password: pw }, specialty: 'GENERAL_MEDICINE', clinic: { nameEn: `Walk Clinic ${label} ${tag}`, nameAr: `عيادة التجربة ${label} ${tag}`, city: 'Cairo', addressEn: '1 Test St, Cairo', addressAr: '١ شارع الاختبار، القاهرة', locationUrl: 'https://maps.example/o' }, planKey: plan, legalAcceptances });
  if (done.status !== 200) throw new Error('clinic signup ' + JSON.stringify(done.body));
  const [{ tenantId }] = await q('kiorly', `select "tenantId" from "User" where email = $1`, [email]);
  const clinicId = (await kiorly(done.body.accessToken, 'GET', '/clinics')).body[0].id;
  await kiorly(done.body.accessToken, 'GET', `/kiorex/connect?clinicId=${clinicId}`); // creates the listings the ready-state SQL below updates
  return { email, password: pw, tenantId, clinicId };
}
async function readyClinic(c: { tenantId: string; clinicId: string }) {
  await q('kiorly', `insert into "ClinicianVerification" (id, "userId", "tenantId", status, profession, "verifiedProfession", "verifiedAt", "updatedAt")
    select 'cv_walk_' || u.id, u.id, u."tenantId", 'VERIFIED', 'PHYSICIAN', 'PHYSICIAN', now(), now() from "User" u where u."tenantId" = $1 and u."isTenantOwner"
    on conflict ("userId") do update set status = 'VERIFIED', "verifiedProfession" = 'PHYSICIAN', "verifiedAt" = now()`, [c.tenantId]);
  await q('kiorly', `update "Clinic" set latitude = 30.0444, longitude = 31.2357 where "tenantId" = $1`, [c.tenantId]);
  await q('kiorly', `update "AppointmentType" set "feeAmount" = 300, "marketplaceBookable" = true where "tenantId" = $1 and "isActive" = true`, [c.tenantId]);
  await q('kiorly', `update "MarketplaceListing" set "profileJson" = $2::jsonb where "tenantId" = $1`, [c.tenantId, JSON.stringify({ displayNameEn: `Dr Walk`, displayNameAr: `د. تجربة`, specialty: 'GENERAL_MEDICINE', languages: ['en', 'ar'], yearsExperience: 9, education: [{ degreeEn: 'MBBCh' }], amenities: ['parking'], photoRelativePath: 'e2e/photo.jpg', bioEn: 'General practitioner focused on family medicine and preventive care for adults.', bioAr: 'طبيب ممارس عام يركز على طب الأسرة والرعاية الوقائية للبالغين في القاهرة.' })]);
}
async function pharm(label: string, ready: boolean) {
  const email = `walk-ph-${label}-${tag}@example.com`;
  const s = await pharmacy(undefined, 'POST', '/onboarding/signup', { pharmacyName: `Walk Pharmacy ${label} ${tag}`, ownerName: 'Walk Owner', email, password: pw, branchName: 'Main' });
  if (s.status !== 201) throw new Error('ph signup ' + JSON.stringify(s.body));
  const tok = (await pharmacy(undefined, 'POST', '/auth/login', { email, password: pw })).body.accessToken;
  if (ready) {
    const t = rnd();
    await pharmacy(tok, 'PUT', `/kiorex-connect/branches/${s.body.branchId}`, { optedIn: true, licenceNo: `PH-LIC-${tag}${label}`, deliveryRadiusKm: '5', latitude: '30.0444', longitude: '31.2357', openingHours: { sat: ['09:00', '23:00'], sun: ['09:00', '23:00'] } });
    const d = await pharmacy(tok, 'POST', '/catalogue/drugs', { brandName: `Walk-Med-${t}`, activeIngredient: `walk-ing-${t}`, strength: '500 mg', dosageForm: 'tablet', packSize: '20', rxOnly: false, price: '40.00' });
    const exp = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
    await pharmacy(tok, 'POST', '/inventory/receipts', { branchId: s.body.branchId, invoiceNo: `W-${t}`, lines: [{ drugId: d.body.id, lotNumber: `L-${t}`, expiryDate: exp, quantity: 20, unitCost: '20.00' }] });
    await pharmacy(tok, 'POST', '/kiorex-connect/licence', { name: 'licence.pdf', contentBase64: Buffer.from('%PDF-1.4\n%walk\n%%EOF').toString('base64') });
    await pharmacy(tok, 'PUT', '/kiorex-connect/payout', { label: 'Main settlement account' });
    await pharmacy(tok, 'PUT', '/kiorex-connect/terms', { version: '2026-11' });
  }
  return { email, password: pw, tenantId: s.body.tenantId, branchId: s.body.branchId };
}
async function labOrg(label: string, ready: boolean) {
  const email = `walk-lab-${label}-${tag}@example.com`; const slug = `walk-${label}-${tag}`;
  const o = await lab(undefined, 'POST', '/onboarding/tenants', { name: `Walk Lab ${label} ${tag}`, slug, labName: 'Main lab', labCode: label === 'a' ? 'WA1' : 'WB1', ownerName: 'Walk Owner', ownerEmail: email, loadStarterCatalogue: true });
  if (o.status !== 201) throw new Error('lab signup ' + JSON.stringify(o.body));
  const tok = o.body.token;
  if (ready) {
    await lab(tok, 'PUT', `/labs/${o.body.labId}`, { licenceNo: `LAB-LIC-${tag}${label}` });
    await lab(tok, 'POST', '/kiorex-connect/licence', { name: 'licence.pdf', contentBase64: Buffer.from('%PDF-1.4\n%walk\n%%EOF').toString('base64') });
    await lab(tok, 'PUT', '/kiorex-connect/payout', { label: 'Main settlement account' });
    await lab(tok, 'PUT', '/kiorex-connect/terms', { version: '2026-11' });
  }
  return { email, slug, tenantId: o.body.tenantId, labId: o.body.labId, token: tok };
}

if (process.env.ONLY_CLINIC_C) {
  const st = JSON.parse(readFileSync(new URL('./state.json', import.meta.url), 'utf8'));
  st.clinicC = await clinic('c'); await readyClinic(st.clinicC);
  writeFileSync(new URL('./state.json', import.meta.url), JSON.stringify(st, null, 2)); console.log('clinicC', st.clinicC.email); await closeAll(); process.exit(0);
}
out.clinicA = await clinic('a');           // fresh: everything open
out.clinicB = await clinic('b'); await readyClinic(out.clinicB); // ready to request
out.pharmA = await pharm('a', false);
out.pharmB = await pharm('b', true);
out.labA = await labOrg('a', false);
out.labB = await labOrg('b', true);
writeFileSync(new URL('./state.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await closeAll();
