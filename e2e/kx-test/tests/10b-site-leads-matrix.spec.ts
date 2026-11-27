import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { ensureSession, liveToken, openAs } from '../lib/session';

/**
 * Join-request MATRIX on the DEPLOYED kx-test hosts (28 Nov 2026). Every provider type x both interest modes (STANDALONE = a Kiorly module on its own,
 * CONNECTED = module + Kiorex) is submitted through the REAL five-step form on test.kiorly.com (English and Arabic alternate so every type is sent in both
 * languages), then read back as ops_admin (the "Kiorly ops" role: the Kiorly edition uses the same Passport role) and as super_admin: masking, decrypted detail,
 * answers per type, filters, duplicates, status lifecycle, owner, notes, CSV, hostile input, rate limit, market handling, and the "Start onboarding" helper.
 * Everything is tagged test data (name prefix [TEST], reserved e-mail domain example.test), synthetic phone numbers, removed at the end by the super admin
 * (count first). No real person, no notification (test leads send none).
 */
const STAMP = Date.now().toString(36).toUpperCase();
const TAG = `MX${STAMP}`;
const rnd8 = () => String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
const newPhone = () => `+2010${rnd8()}`;
const idem = () => `kx-mx-${STAMP}-${Math.random().toString(36).slice(2, 10)}`;

const TYPES = ['CLINIC', 'INDEPENDENT_DOCTOR', 'CHAIN', 'HOSPITAL', 'NURSE', 'PHYSICIAN', 'LAB', 'PHARMACY', 'OTHER'] as const;
const MODES = ['STANDALONE', 'CONNECTED'] as const;
type PType = (typeof TYPES)[number]; type Mode = (typeof MODES)[number];

interface TypeSpec { branches?: number; staff?: number; specialty?: string; answers: Record<string, string | number | boolean>; licences: Record<string, string>; modules: string[] }
const SPEC: Record<PType, TypeSpec> = {
  CLINIC: { branches: 1, staff: 3, specialty: 'PEDIATRICS', answers: { rooms: 4 }, licences: { facilityLicence: 'FL-1', commercialRegister: 'CR-1', taxCard: 'TC-1' }, modules: ['CLINIC'] },
  INDEPENDENT_DOCTOR: { specialty: 'DERMATOLOGY', answers: { practiceSetting: 'OWN_CLINIC' }, licences: { professionalLicence: 'PL-2' }, modules: ['CLINIC', 'STAFF_APP'] },
  CHAIN: { branches: 3, staff: 40, specialty: 'GENERAL_PRACTICE', answers: { centralBilling: true, citiesCount: 2 }, licences: { facilityLicence: 'FL-3' }, modules: ['ENTERPRISE'] },
  HOSPITAL: { branches: 1, staff: 120, specialty: 'CARDIOLOGY', answers: { beds: 120, departments: 8, currentHis: true }, licences: { facilityLicence: 'FL-4' }, modules: ['ENTERPRISE'] },
  NURSE: { specialty: 'HOME_NURSING', answers: { homeVisits: true, practiceModel: 'SOLO' }, licences: { professionalLicence: 'PL-5' }, modules: ['NURSE'] },
  PHYSICIAN: { specialty: 'PHYSIOTHERAPY', answers: { practiceSetting: 'SHARED_CLINIC' }, licences: { professionalLicence: 'PL-6' }, modules: ['CLINIC'] },
  LAB: { branches: 2, staff: 9, answers: { homeSampling: true, collectionPoints: 2 }, licences: { facilityLicence: 'FL-7' }, modules: ['LAB'] },
  PHARMACY: { branches: 1, staff: 4, answers: { delivery: true, open24h: false }, licences: { facilityLicence: 'FL-8' }, modules: ['PHARMACY'] },
  OTHER: { branches: 1, specialty: 'OTHER', answers: { otherDescription: 'Medical courier and sample transport' }, licences: { taxCard: 'TC-9' }, modules: ['STAFF_APP'] },
};

interface Sent { type: PType; mode: Mode; lang: 'en' | 'ar'; name: string; phone: string; email: string; ref: string; id?: string }
const sent: Sent[] = [];
const body = (type: PType, mode: Mode, over: Record<string, unknown> = {}) => {
  const s = SPEC[type];
  return {
    source: 'kiorly-site', env: 'test', mode, providerType: type, legalName: `[TEST] ${TAG} ${type} ${mode}`, contactName: 'MX Test Person', phone: newPhone(), email: `${TAG.toLowerCase()}-${type.toLowerCase()}-${mode.toLowerCase()}@example.test`,
    market: 'EG', governorate: 'GIZA', city: 'Dokki', ...(s.branches ? { branches: s.branches } : {}), ...(s.staff ? { staffCount: s.staff } : {}), specialties: s.specialty ? [s.specialty] : [], modules: s.modules,
    answers: s.answers, licences: s.licences, goLive: 'WITHIN_1_MONTH', locale: 'en', contactChannel: 'WHATSAPP', note: 'automated matrix check, safe to delete', consent: { accepted: true, textVersion: 'draft-2' }, ...over,
  };
};

test.describe.serial('Join-request matrix on kx-test: every provider type x both interest modes through the real form, then both consoles', () => {
  let api: APIRequestContext; let opsHeaders: () => Promise<Record<string, string>>;
  const pub = (path: string, init: { method?: string; key?: string; data?: unknown; origin?: string } = {}) => api.fetch(`${URLS.api}/api/v1/public/leads${path}`, { method: init.method ?? 'GET', headers: { origin: init.origin ?? URLS.site, ...(init.key ? { 'idempotency-key': init.key } : {}), ...(init.data ? { 'content-type': 'application/json' } : {}) }, data: init.data as never });
  test.beforeAll(async ({ playwright }) => { api = await playwright.request.newContext(); });
  test.afterAll(async () => { await api?.dispose(); });

  // ───────────────────────── 1. the real form, 18 submissions ─────────────────────────
  test('the real form: 9 provider types x 2 modes = 18 submissions, English and Arabic alternate, each returns a KL- reference', async ({ page }) => {
    test.setTimeout(900_000);
    let i = 0;
    for (const [ti, type] of TYPES.entries()) {
      for (const [mi, mode] of MODES.entries()) {
        const lang: 'en' | 'ar' = (ti + mi) % 2 === 0 ? 'en' : 'ar'; const s = SPEC[type]; const b = body(type, mode);
        await page.goto(`${URLS.site}/${lang}/`); await expect(page.locator('[data-join]')).toHaveAttribute('data-ready', 'true');
        await page.evaluate(() => document.querySelectorAll('.reveal').forEach((e) => e.classList.add('is-in')));
        const next = () => page.locator('[data-next]').click();
        await page.locator(`input[name=mode][value=${mode}]`).check({ force: true }); await page.locator(`input[name=providerType][value=${type}]`).check({ force: true }); await next();
        await page.locator('#f-legalName').fill(b.legalName);
        if (s.branches) await page.locator('#f-branches').fill(String(s.branches));
        if (s.staff) await page.locator('#f-staffCount').fill(String(s.staff));
        if (s.specialty && await page.locator(`input[name=specialties][value=${s.specialty}]`).count()) await page.locator(`input[name=specialties][value=${s.specialty}]`).check({ force: true });
        for (const [k, v] of Object.entries(s.answers)) {
          const el = page.locator(`#f-answers-${k}`); await expect(el, `answer field ${type}.${k}`).toHaveCount(1);
          const tag = await el.evaluate((n) => (n as HTMLElement).tagName.toLowerCase() + ':' + ((n as HTMLInputElement).type ?? ''));
          if (tag === 'select:select-one') await el.selectOption(String(v)); else if (tag === 'input:checkbox') { if (v === true) await el.check({ force: true }); } else await el.fill(String(v));
        }
        await next();
        await page.locator('#f-contactName').fill(b.contactName); await page.locator('#f-phone').fill(b.phone.replace('+20', '0')); await page.locator('#f-email').fill(b.email);
        await page.locator('#f-governorate').selectOption('GIZA'); await page.locator('#f-city').fill('Dokki'); await next();
        for (const [k, v] of Object.entries(s.licences)) { const el = page.locator(`#f-licences-${k}`); if (await el.count()) await el.fill(`${v}-${STAMP}`); }
        for (const m of s.modules) await page.locator(`input[name=modules][value=${m}]`).check({ force: true });
        await page.locator('#f-goLive').selectOption('WITHIN_1_MONTH'); await next();
        await page.locator('input[name=contactChannel][value=WHATSAPP]').check({ force: true }); await page.locator('#f-note').fill(b.note); await page.locator('#f-consent').check();
        const resp = page.waitForResponse((r) => r.url().endsWith('/api/v1/public/leads') && r.request().method() === 'POST');
        await page.locator('[data-submit]').click(); const r = await resp; expect(r.status(), `${type}/${mode}/${lang}`).toBe(201);
        await expect(page.locator('[data-ref]')).toHaveText(/^KL-[A-Z2-9]{8}$/);
        sent.push({ type, mode, lang, name: b.legalName, phone: b.phone, email: b.email, ref: (await page.locator('[data-ref]').textContent())!.trim() }); i++;
      }
    }
    expect(i).toBe(18); expect(new Set(sent.map((x) => x.ref)).size).toBe(18);
    expect(sent.filter((x) => x.lang === 'ar')).toHaveLength(9); expect(sent.filter((x) => x.lang === 'en')).toHaveLength(9);
  });

  // ───────────────────────── 2. hostile and edge input (API) ─────────────────────────
  test('hostile input: honeypot, oversize, unknown field, markup, bad phones, wrong type or mode, other-without-description, minimum branches, idempotency replay and conflict', async () => {
    const hpName = `[TEST] ${TAG} HONEYPOT`;
    const hp = await pub('', { method: 'POST', key: idem(), data: { ...body('CLINIC', 'CONNECTED', { legalName: hpName }), website: 'http://spam.example' } });
    expect(hp.status()).toBe(201); expect((await hp.json()).reference).toMatch(/^KL-/);
    expect((await pub('', { method: 'POST', key: idem(), data: { ...body('CLINIC', 'CONNECTED'), note: 'x'.repeat(20_000) } })).status()).toBe(413);
    const unk = await pub('', { method: 'POST', key: idem(), data: { ...body('CLINIC', 'CONNECTED'), isAdmin: true, status: 'WON' } }); expect(unk.status()).toBe(400); expect((await unk.json()).fields).toMatchObject({ isAdmin: 'not_allowed', status: 'not_allowed' });
    const xss = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'CONNECTED', { legalName: `[TEST] ${TAG} <img src=x onerror=alert(1)>` }) }); expect(xss.status()).toBe(400); expect((await xss.json()).fields).toMatchObject({ legalName: 'invalid' });
    for (const phone of ['abc', '123', '0100', '+2010123', '+20 55 000', '', '00']) {
      const r = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'CONNECTED', { phone }) }); expect(r.status(), `phone "${phone}"`).toBe(400);
      expect((await r.json()).fields.phone).toMatch(/invalid|required/);
    }
    const badType = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'CONNECTED', { providerType: 'WIZARD' }) }); expect((await badType.json()).fields).toMatchObject({ providerType: 'invalid' });
    const badMode = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'CONNECTED', { mode: 'BOTH' }) }); expect((await badMode.json()).fields).toMatchObject({ mode: 'invalid' });
    const noConsent = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'CONNECTED', { consent: { accepted: false, textVersion: 'draft-2' } }) }); expect((await noConsent.json()).fields).toMatchObject({ consent: 'required' });
    const other = await pub('', { method: 'POST', key: idem(), data: body('OTHER', 'STANDALONE', { answers: {} }) }); expect((await other.json()).fields).toMatchObject({ 'answers.otherDescription': 'required' });
    const chain = await pub('', { method: 'POST', key: idem(), data: body('CHAIN', 'CONNECTED', { branches: 1 }) }); expect((await chain.json()).fields).toMatchObject({ branches: 'too_short' });
    const foreignAns = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'CONNECTED', { answers: { beds: 5 } }) }); expect((await foreignAns.json()).fields).toMatchObject({ 'answers.beds': 'not_allowed' });
    const noKey = await pub('', { method: 'POST', data: body('CLINIC', 'CONNECTED') }); expect(noKey.status()).toBe(400); expect((await noKey.json()).code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    expect((await pub('', { method: 'POST', key: 'short', data: body('CLINIC', 'CONNECTED') })).status()).toBe(400);
    // market and place: only Egypt is configured; a lowercase key is accepted, a foreign market or governorate is refused (no silent routing)
    const mk = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'CONNECTED', { market: 'SA' }) }); expect(mk.status()).toBe(400); expect((await mk.json()).fields).toMatchObject({ market: 'invalid' });
    const gv = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'CONNECTED', { governorate: 'RIYADH' }) }); expect((await gv.json()).fields).toMatchObject({ governorate: 'invalid' });
    // idempotency: same key and body -> same reference (replayed), same key and other body -> 409
    const k = idem(); const d = body('PHARMACY', 'STANDALONE', { legalName: `[TEST] ${TAG} REPLAY`, email: `${TAG.toLowerCase()}-replay@example.test` });
    const a = await pub('', { method: 'POST', key: k, data: d }); const b = await pub('', { method: 'POST', key: k, data: d }); const c = await pub('', { method: 'POST', key: k, data: d });
    expect([a.status(), b.status(), c.status()]).toEqual([201, 201, 201]); const ja = await a.json(); expect(await b.json()).toMatchObject({ reference: ja.reference, replayed: true }); expect((await c.json()).reference).toBe(ja.reference);
    expect((await pub('', { method: 'POST', key: k, data: { ...d, city: 'Maadi' } })).status()).toBe(409);
    sent.push({ type: 'PHARMACY', mode: 'STANDALONE', lang: 'en', name: d.legalName, phone: d.phone, email: d.email, ref: ja.reference });
  });

  test('phone formats are normalised to one number; a fourth submission from the same number in a day is refused (429 with retryAfterSec); duplicates by phone and by e-mail are stored and tagged', async () => {
    const p = newPhone(); const local = `0${p.slice(3)}`; const spaced = `+20 ${p.slice(3, 5)} ${p.slice(5, 9)} ${p.slice(9)}`; const arabic = local.replace(/\d/g, (x) => '٠١٢٣٤٥٦٧٨٩'[Number(x)]!);
    const names: string[] = [];
    for (const [i, phone] of [local, spaced, arabic].entries()) {
      const nm = `[TEST] ${TAG} PHONEFORMAT${i}`; names.push(nm);
      const r = await pub('', { method: 'POST', key: idem(), data: body('LAB', 'CONNECTED', { legalName: nm, phone, email: `${TAG.toLowerCase()}-pf${i}@example.test` }) }); expect(r.status(), `format ${phone}`).toBe(201);
      sent.push({ type: 'LAB', mode: 'CONNECTED', lang: 'en', name: nm, phone: p, email: `${TAG.toLowerCase()}-pf${i}@example.test`, ref: (await r.json()).reference });
    }
    const fourth = await pub('', { method: 'POST', key: idem(), data: body('LAB', 'CONNECTED', { legalName: `[TEST] ${TAG} PHONEFORMAT3`, phone: p, email: `${TAG.toLowerCase()}-pf3@example.test` }) });
    expect(fourth.status()).toBe(429); const j = await fourth.json(); expect(j).toMatchObject({ code: 'RATE_LIMITED' }); expect(j.retryAfterSec).toBeGreaterThan(0); expect(fourth.headers()['retry-after']).toBeDefined();
    // duplicate by e-mail only (different number)
    const e = `${TAG.toLowerCase()}-dup@example.test`;
    const one = await pub('', { method: 'POST', key: idem(), data: body('NURSE', 'STANDALONE', { legalName: `[TEST] ${TAG} DUPMAIL1`, email: e }) }); const two = await pub('', { method: 'POST', key: idem(), data: body('NURSE', 'STANDALONE', { legalName: `[TEST] ${TAG} DUPMAIL2`, email: e }) });
    expect(one.status()).toBe(201); expect(two.status()).toBe(201);
    sent.push({ type: 'NURSE', mode: 'STANDALONE', lang: 'en', name: `[TEST] ${TAG} DUPMAIL1`, phone: '', email: e, ref: (await one.json()).reference }, { type: 'NURSE', mode: 'STANDALONE', lang: 'en', name: `[TEST] ${TAG} DUPMAIL2`, phone: '', email: e, ref: (await two.json()).reference });
  });

  test('formula injection and a hostile contact name: stored as text, the CSV cell is neutralised', async () => {
    const nm = `[TEST] ${TAG} FORMULA`;
    const r = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'STANDALONE', { legalName: nm, email: `${TAG.toLowerCase()}-formula@example.test`, contactName: '=HYPERLINK("http://evil.example","x")', note: '@SUM(1+1)' }) }); expect(r.status()).toBe(201);
    sent.push({ type: 'CLINIC', mode: 'STANDALONE', lang: 'en', name: nm, phone: '', email: '', ref: (await r.json()).reference });
  });

  const NTAG = `NT${STAMP}`; let notifyRef = ''; let notifyDetail: { id: string; teamSent?: number } = { id: '' };
  test('a lead that is NOT test data is acknowledged: the notification hook runs (mock e-mail only, nothing leaves the platform)', async () => {
    // not tagged as test (no [TEST] prefix, a normal domain); the e-mail channel is in mock mode on kx-test (no EMAIL_MODE/MESSAGING_MODE=real), so the "send" lands in the dev inbox only. The super admin tags it as test and removes it at the end.
    const r = await pub('', { method: 'POST', key: idem(), data: body('CLINIC', 'CONNECTED', { legalName: `${NTAG} Notification Check Clinic`, email: `${NTAG.toLowerCase()}@example.com` }) }); expect(r.status()).toBe(201);
    notifyRef = (await r.json()).reference;
    await new Promise((res) => setTimeout(res, 3000));
  });

  // ───────────────────────── 3. Kiorex admin as ops_admin ─────────────────────────
  test.describe('ops_admin (the Kiorly ops role) in the Kiorex console', () => {
    let ctx: BrowserContext; let page: Page;
    const H = async (origin: string = URLS.ops) => ({ authorization: `Bearer ${await liveToken(page)}`, origin });
    const get = async (path: string) => { const r = await page.request.get(`${URLS.api}/api/v1/admin/leads${path}`, { headers: await H() }); return r; };
    test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'ops'); ({ context: ctx, page } = await openAs(browser, 'ops')); await page.goto(`${URLS.ops}/leads`); });
    test.afterAll(async () => { await ctx?.close(); });

    test('the inbox lists the matrix: counts per type and mode, test tag, masked phone in the list, nothing stored for the honeypot', async () => {
      const r = await get(`?q=${TAG}&pageSize=100`); expect(r.status()).toBe(200); const j = await r.json();
      const mine = j.items as Array<Record<string, any>>;
      for (const t of TYPES) for (const m of MODES) expect(mine.filter((x) => x.providerType === t && x.mode === m).length, `${t}/${m}`).toBeGreaterThanOrEqual(1);
      expect(mine.every((x) => x.isTest === true && x.tags.includes('test') && x.market === 'EG')).toBe(true);
      expect(mine.some((x) => String(x.legalName).includes('HONEYPOT'))).toBe(false);
      for (const x of mine) { expect(x.phoneMasked).toBeTruthy(); expect(x.phoneMasked).not.toMatch(/\d{9,}/); expect(JSON.stringify(x)).not.toContain('example.test'); expect(x).not.toHaveProperty('phone'); expect(x).not.toHaveProperty('email'); }
      expect(sent.filter((s) => s.ref).every((s) => mine.some((x) => x.ref === s.ref))).toBe(true);
      // filters: by type, mode, market, status, test
      for (const t of TYPES) { const f = await (await get(`?q=${TAG}&type=${t}&pageSize=100`)).json(); expect(f.items.every((x: any) => x.providerType === t) && f.total >= 2, `type ${t}`).toBe(true); }
      for (const m of MODES) { const f = await (await get(`?q=${TAG}&mode=${m}&pageSize=100`)).json(); expect(f.items.every((x: any) => x.mode === m) && f.total >= 9).toBe(true); }
      expect((await (await get(`?q=${TAG}&market=EG&pageSize=100`)).json()).total).toBe(j.total); expect((await (await get(`?q=${TAG}&market=SA`)).json()).total).toBe(0);
      expect((await (await get(`?q=${TAG}&test=exclude`)).json()).total).toBe(0); expect((await (await get(`?q=${TAG}&status=WON`)).json()).total).toBe(0);
      expect((await get('?status=NOPE')).status()).toBeLessThan(500);
    });

    test('every one of the 18 form leads: decrypted detail equals what was typed (phone, e-mail, contact, type answers, licences, modules, language, place), audited read', async () => {
      const mineAll = (await (await get(`?q=${TAG}&pageSize=100`)).json()).items as Array<{ id: string; ref: string }>;
      const form = sent.slice(0, 18);
      for (const s of form) {
        const row = mineAll.find((x) => x.ref === s.ref); expect(row, s.ref).toBeTruthy(); s.id = row!.id;
        const d = await (await get(`/${row!.id}`)).json(); const sp = SPEC[s.type];
        expect(d).toMatchObject({ providerType: s.type, mode: s.mode, locale: s.lang, phone: s.phone, email: s.email, contactName: 'MX Test Person', market: 'EG', governorate: 'GIZA', city: 'Dokki', status: 'NEW', goLive: 'WITHIN_1_MONTH', contactChannel: 'WHATSAPP', isTest: true });
        expect([...d.modules].sort()).toEqual([...sp.modules].sort());
        expect(d.answers).toEqual(Object.fromEntries(Object.entries(sp.answers).filter(([, v]) => v !== false))); // an untouched checkbox is simply not sent
        for (const [k, v] of Object.entries(sp.licences)) expect(d.licences[k]).toBe(`${v}-${STAMP}`);
        if (sp.branches) expect(d.branches).toBe(sp.branches); if (sp.staff) expect(d.staffCount).toBe(sp.staff);
        expect(d.consentTextVersion).toBe('draft-2'); expect(d.events.map((e: any) => e.kind)).toContain('CREATED'); expect(d.events.some((e: any) => e.kind === 'NOTIFY')).toBe(false); // test data sends no notification
        expect(d.allowedTransitions).toEqual(['CONTACTED', 'QUALIFIED', 'LOST']);
      }
      const dupBy = sent.find((s) => s.name.endsWith('PHONEFORMAT1'))!; const first = sent.find((s) => s.name.endsWith('PHONEFORMAT0'))!;
      expect(mineAll.find((x) => x.ref === dupBy.ref)).toBeTruthy(); expect(mineAll.find((x) => x.ref === first.ref)).toBeTruthy();
    });

    test('notification of a real (non-test) lead: counted in the summary, the trail shows the applicant acknowledgement (mock), and no team alert unless a console user opted in', async () => {
      const f = await (await get(`?q=${NTAG}&pageSize=10`)).json(); expect(f.total).toBe(1); expect(f.items[0].isTest).toBe(false); expect(f.items[0].ref).toBe(notifyRef);
      const d = await (await get(`/${f.items[0].id}`)).json(); const n = d.events.filter((e: any) => e.kind === 'NOTIFY');
      expect(n.some((e: any) => e.data.to === 'applicant' && e.data.ok === true), JSON.stringify(n)).toBe(true); expect(n.some((e: any) => e.data.to === 'team')).toBe(true);
      const sum = await (await get('/summary')).json(); expect(sum.unassignedOpen).toBeGreaterThanOrEqual(1); expect(sum.newLastSevenDays).toBeGreaterThanOrEqual(1); // real requests are counted, test requests are not
      notifyDetail = { id: f.items[0].id, teamSent: n.find((e: any) => e.data.to === 'team')?.data.sent };
    });

    test('duplicates: the second and third submission of one number (typed three ways) and the repeated e-mail are tagged and linked to the first, the first shows them', async () => {
      const list = (await (await get(`?q=${TAG}&pageSize=100`)).json()).items as Array<Record<string, any>>;
      const by = (suffix: string) => list.find((x) => String(x.legalName).endsWith(suffix))!;
      const pf0 = by('PHONEFORMAT0'); const pf1 = by('PHONEFORMAT1'); const pf2 = by('PHONEFORMAT2');
      expect(pf0.duplicateOfId).toBeNull(); expect(pf1.duplicateOfId).toBe(pf0.id); expect(pf2.duplicateOfId).toBe(pf0.id); expect(pf1.tags).toContain('duplicate');
      const d0 = await (await get(`/${pf0.id}`)).json(); expect(d0.phone).toBe((await (await get(`/${pf1.id}`)).json()).phone); expect(d0.duplicates.map((x: any) => x.ref).sort()).toEqual([pf1.ref, pf2.ref].sort());
      const m1 = by('DUPMAIL1'); const m2 = by('DUPMAIL2'); expect(m2.duplicateOfId).toBe(m1.id);
      const only = await (await get(`?q=${TAG}&duplicates=only&pageSize=100`)).json(); expect(only.total).toBe(3); expect(only.items.every((x: any) => x.duplicateOfId)).toBe(true);
      expect(await (await get(`/${pf0.id}`)).json()).toMatchObject({ events: expect.arrayContaining([expect.objectContaining({ kind: 'DUPLICATE' })]) });
      // search by phone in three notations finds the same leads
      const ph = (await (await get(`/${pf0.id}`)).json()).phone as string;
      for (const q of [ph, `0${ph.slice(3)}`, ph.slice(1)]) { const f = await (await get(`?q=${encodeURIComponent(q)}&pageSize=100`)).json(); expect(f.total, `search ${q}`).toBe(3); }
    });

    test('status lifecycle: the allowed path NEW to WON, every forbidden jump is 409, LOST with a reason, reopen paths, owner, tags, notes (valid, empty, too long, control character)', async () => {
      const lead = sent[0]!; const id = lead.id!; const patch = async (data: unknown) => page.request.fetch(`${URLS.api}/api/v1/admin/leads/${id}`, { method: 'PATCH', headers: await H(), data: data as never });
      for (const bad of ['WON', 'ONBOARDING']) { const r = await patch({ status: bad }); expect(r.status(), `NEW -> ${bad}`).toBe(409); expect((await r.json()).code).toBe('INVALID_TRANSITION'); }
      expect((await patch({ status: 'NOPE' })).status()).toBe(400);
      for (const s of ['CONTACTED', 'QUALIFIED', 'ONBOARDING', 'WON']) { const r = await patch({ status: s }); expect(r.status(), s).toBe(200); expect((await r.json()).status).toBe(s); }
      expect((await patch({ status: 'NEW' })).status()).toBe(409); expect((await patch({ status: 'LOST' })).status()).toBe(409); // WON can only go back to ONBOARDING
      expect((await patch({ status: 'ONBOARDING' })).status()).toBe(200); expect((await patch({ status: 'QUALIFIED' })).status()).toBe(200);
      expect((await patch({ status: 'LOST', lostReason: 'MADE_UP' })).status()).toBe(400);
      const lost = await patch({ status: 'LOST', lostReason: 'LATER' }); expect(lost.status()).toBe(200); expect(await lost.json()).toMatchObject({ status: 'LOST', lostReason: 'LATER', allowedTransitions: ['NEW'] });
      const back = await patch({ status: 'NEW' }); expect(await back.json()).toMatchObject({ status: 'NEW', lostReason: null });
      const owners = await (await get('/owners')).json(); expect(owners.length).toBeGreaterThan(0); const me = owners[0];
      expect((await patch({ ownerSub: me.sub })).status()).toBe(200); expect((await patch({ ownerSub: 'nobody-here' })).status()).toBe(400);
      const withOwner = await (await get(`?q=${TAG}&owner=${me.sub}`)).json(); expect(withOwner.items.map((x: any) => x.ref)).toContain(lead.ref);
      expect((await patch({ addTags: ['Priority', 'bad tag!'] })).status()).toBe(200); expect((await (await get(`/${id}`)).json()).tags).toEqual(expect.arrayContaining(['priority', 'test']));
      const note = async (text: string) => page.request.fetch(`${URLS.api}/api/v1/admin/leads/${id}/notes`, { method: 'POST', headers: { ...(await H()) }, data: { text } });
      expect((await note('called, will come back Sunday')).status()).toBe(200); expect((await note('   ')).status()).toBe(400); expect((await note('x'.repeat(1001))).status()).toBe(400); expect((await note('bad\u0007char')).status()).toBe(400);
      const d = await (await get(`/${id}`)).json(); expect(d.events.filter((e: any) => e.kind === 'STATUS').length).toBeGreaterThanOrEqual(8); expect(d.events.find((e: any) => e.kind === 'NOTE').data.text).toBe('called, will come back Sunday');
      expect(d.events.some((e: any) => e.kind === 'ASSIGN')).toBe(true);
      // an ops_admin cannot change the test tag (super admin only)
      expect((await patch({ isTest: false })).status()).toBe(403);
    });

    test('UI: status button, note and owner in the Kiorex console, type and mode shown, phone decrypted on the detail and masked in the list', async () => {
      const s = sent[6]!; await page.goto(`${URLS.ops}/leads?q=${s.ref}`);
      const row = page.getByTestId('data-table').locator('tbody tr').filter({ hasText: s.ref }); await expect(row).toHaveCount(1); await expect(row).not.toContainText(s.phone); await expect(row).toContainText(/Hospital/i);
      await row.getByRole('link', { name: s.ref }).click(); await expect(page.getByTestId('lead-phone')).toHaveText(s.phone); await expect(page.getByTestId('lead-email')).toHaveText(s.email);
      await expect(page.getByText('Standalone', { exact: true }).first()).toBeVisible();
      await page.getByTestId('lead-to-QUALIFIED').click(); await expect(page.getByTestId('lead-status-chip')).toHaveText('Qualified');
      await page.getByTestId('lead-assign-me').click(); await expect(page.getByTestId('lead-owner')).not.toHaveValue('');
      await page.getByTestId('lead-note-input').fill('ui note from matrix'); await page.getByTestId('lead-note-add').click(); await expect(page.getByTestId('lead-trail')).toContainText('ui note from matrix');
    });

    test('CSV export: all matrix rows with decrypted phone and e-mail, formula cells neutralised, header and row count headers; export honours the filter', async () => {
      const r = await page.request.get(`${URLS.api}/api/v1/admin/leads/export.csv?q=${TAG}`, { headers: await H() }); expect(r.status()).toBe(200);
      expect(r.headers()['content-type']).toContain('text/csv'); expect(r.headers()['content-disposition']).toContain('kiorly-join-requests-'); const t = await r.text(); expect(t.charCodeAt(0)).toBe(0xfeff);
      for (const s of sent.filter((x) => x.phone)) { expect(t, s.ref).toContain(s.ref); expect(t).toContain(s.phone); }
      expect(t).not.toMatch(/(^|,)=HYPERLINK/m); expect(t).toContain(`'=HYPERLINK`); expect(t).toContain(`'@SUM(1+1)`);
      expect(Number(r.headers()['x-export-rows'])).toBeGreaterThanOrEqual(sent.length); expect(r.headers()['x-export-truncated']).toBe('false');
      const lab = await page.request.get(`${URLS.api}/api/v1/admin/leads/export.csv?q=${TAG}&type=LAB`, { headers: await H() }); const lt = await lab.text(); expect(lt).toContain('LAB'); expect(lt).not.toContain(',PHARMACY,');
    });

    test('role limits for ops_admin: settings readable but not savable, no test-data removal, unauthenticated is 401', async () => {
      const h = await H(); const s = await page.request.get(`${URLS.api}/api/v1/admin/leads/settings`, { headers: h }); expect(s.status()).toBe(200); const sj = await s.json();
      expect(sj.config.markets.map((m: any) => m.key)).toEqual(['EG']);
      expect((await page.request.put(`${URLS.api}/api/v1/admin/leads/settings`, { headers: h, data: { version: sj.version, config: sj.config } })).status()).toBe(403);
      expect((await page.request.post(`${URLS.api}/api/v1/admin/leads/test/remove`, { headers: h, data: { confirm: false } })).status()).toBe(403);
      for (const p of ['', '/summary', '/export.csv', '/owners', `/${sent[0]!.id}`]) expect((await api.fetch(`${URLS.api}/api/v1/admin/leads${p}`)).status(), p).toBe(401);
      expect((await api.fetch(`${URLS.api}/api/v1/admin/leads`, { headers: { authorization: 'Bearer not-a-token' } })).status()).toBe(401);
      expect((await page.request.get(`${URLS.api}/api/v1/admin/leads/ld_doesnotexist`, { headers: h })).status()).toBe(404);
      const sum = await (await get('/summary')).json(); expect(sum.testLeads).toBeGreaterThanOrEqual(18); expect(sum.byStatus).toHaveProperty('WON');
    });

    test('Start onboarding helper: offered only for a QUALIFIED connected request, opens Partner onboarding with kind and label prefilled, creates nothing; a standalone request gets an explanation, a NEW one nothing', async () => {
      const conn = sent[7]!; const alone = sent[6]!; expect([conn.type, conn.mode, alone.mode]).toEqual(['HOSPITAL', 'CONNECTED', 'STANDALONE']);
      const setStatus = async (id: string, status: string) => expect((await page.request.fetch(`${URLS.api}/api/v1/admin/leads/${id}`, { method: 'PATCH', headers: await H(), data: { status } })).status()).toBe(200);
      await page.goto(`${URLS.ops}/leads?q=${conn.ref}`); await page.getByRole('link', { name: conn.ref }).click(); await expect(page.getByTestId('lead-detail')).toBeVisible(); await expect(page.getByTestId('lead-start-onboarding')).toHaveCount(0); // NEW
      await setStatus(conn.id!, 'QUALIFIED'); await page.reload();
      const btn = page.getByTestId('lead-start-onboarding'); await expect(btn).toBeVisible();
      const before = await (await page.request.get(`${URLS.api}/api/v1/admin/onboarding/enrolments`, { headers: await H() })).json();
      await btn.click(); await expect(page).toHaveURL(/\/partner-onboarding\?lead=ld_/); expect(page.url()).not.toContain(conn.phone.slice(3)); expect(decodeURIComponent(page.url())).not.toContain('@');
      await expect(page.getByTestId('lead-onboarding-banner')).toContainText(conn.ref); await expect(page.getByTestId('enrol-label')).toHaveValue(conn.name); await expect(page.getByTestId('enrol-kind')).toHaveValue('CLINIC');
      const after = await (await page.request.get(`${URLS.api}/api/v1/admin/onboarding/enrolments`, { headers: await H() })).json(); expect(after.length).toBe(before.length); // nothing was created
      // a standalone request has no Kiorex connection to prepare: no button, an explanation
      await setStatus(alone.id!, 'QUALIFIED'); await page.goto(`${URLS.ops}/leads?q=${alone.ref}`); await page.getByRole('link', { name: alone.ref }).click();
      await expect(page.getByTestId('lead-standalone-note')).toBeVisible(); await expect(page.getByTestId('lead-start-onboarding')).toHaveCount(0);
      // a bad id still opens the screen by hand
      await page.goto(`${URLS.ops}/partner-onboarding?lead=ld_doesnotexist`); await expect(page.getByTestId('lead-onboarding-failed')).toBeVisible(); await expect(page.getByTestId('enrol-label')).toBeVisible();
    });
  });

  // ───────────────────────── 4. Kiorly edition: ops_admin ─────────────────────────
  test.describe('ops_admin on the Kiorly admin edition', () => {
    let ctx: BrowserContext; let page: Page;
    test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'ops'); ({ context: ctx, page } = await openAs(browser, 'ops')); });
    test.afterAll(async () => { await ctx?.close(); });
    test('the Kiorly edition shows the Join requests, the same leads, status and note work, settings are read-only for this role', async () => {
      const s = sent[5]!;
      await page.goto(`${URLS.opsKiorly}/leads?q=${s.ref}`); await page.waitForURL((u) => u.origin === new URL(URLS.opsKiorly).origin && u.pathname.startsWith('/leads'), { timeout: 60_000 });
      await expect(page).toHaveTitle('Kiorly Admin'); await expect(page.getByTestId('sidebar-nav').getByRole('link', { name: /Join requests/ })).toBeVisible();
      const row = page.getByTestId('data-table').locator('tbody tr').filter({ hasText: s.ref }); await expect(row).toHaveCount(1); await expect(row).not.toContainText(s.phone);
      await row.getByRole('link', { name: s.ref }).click(); await expect(page.getByTestId('lead-phone')).toHaveText(s.phone);
      await page.getByTestId('lead-to-CONTACTED').click(); await expect(page.getByTestId('lead-status-chip')).toHaveText('Contacted');
      await page.getByTestId('lead-note-input').fill('note from Kiorly ops'); await page.getByTestId('lead-note-add').click(); await expect(page.getByTestId('lead-trail')).toContainText('note from Kiorly ops');
      await expect(page.getByTestId('lead-test-toggle')).toHaveCount(0); // the test tag is the super admin's
      await page.goto(`${URLS.opsKiorly}/leads/settings`); await expect(page.getByTestId('set-readonly')).toBeVisible(); await expect(page.getByTestId('set-save')).toHaveCount(0); await expect(page.getByTestId('test-count')).toHaveCount(0); await expect(page.getByTestId('test-delete')).toHaveCount(0); // the removal section explains, the buttons are the super admin's
    });
  });

  // ───────────────────────── 5. super admin + cleanup ─────────────────────────
  test.describe('super_admin on the Kiorly edition, and removal of the test leads', () => {
    let ctx: BrowserContext; let page: Page;
    test.beforeAll(async ({ browser }) => { await ensureSession(browser, 'superAdmin'); ({ context: ctx, page } = await openAs(browser, 'superAdmin')); });
    test.afterAll(async () => { await ctx?.close(); });
    test('the super admin sees the same leads with changed status, may flip the test tag and read the settings with a save button', async () => {
      const s = sent[5]!;
      await page.goto(`${URLS.opsKiorly}/leads?q=${s.ref}`); await page.waitForURL((u) => u.origin === new URL(URLS.opsKiorly).origin && u.pathname.startsWith('/leads'), { timeout: 60_000 });
      const row = page.getByTestId('data-table').locator('tbody tr').filter({ hasText: s.ref }); await expect(row).toContainText('Contacted');
      await row.getByRole('link', { name: s.ref }).click(); await expect(page.getByTestId('lead-trail')).toContainText('note from Kiorly ops'); await expect(page.getByTestId('lead-test-toggle')).toBeChecked();
      const h = { authorization: `Bearer ${await liveToken(page)}`, origin: URLS.opsKiorly };
      const id = page.url().split('/').pop()!;
      expect((await page.request.fetch(`${URLS.api}/api/v1/admin/leads/${id}`, { method: 'PATCH', headers: h, data: { isTest: false } })).status()).toBe(200);
      expect((await page.request.fetch(`${URLS.api}/api/v1/admin/leads/${id}`, { method: 'PATCH', headers: h, data: { isTest: true } })).status()).toBe(200);
      const st = await (await page.request.get(`${URLS.api}/api/v1/admin/leads/settings`, { headers: h })).json();
      // a stale version is refused (optimistic concurrency); nothing is saved
      expect((await page.request.put(`${URLS.api}/api/v1/admin/leads/settings`, { headers: h, data: { version: st.version - 1, config: st.config } })).status()).toBe(409);
      await page.goto(`${URLS.opsKiorly}/leads/settings`); await expect(page.getByTestId('set-save')).toBeVisible(); await expect(page.getByTestId('set-readonly')).toHaveCount(0);
    });
    test('the real-looking notification lead is tagged as test by the super admin (so the removal covers it)', async () => {
      const h = { authorization: `Bearer ${await liveToken(page)}`, origin: URLS.opsKiorly };
      const r = await page.request.fetch(`${URLS.api}/api/v1/admin/leads/${notifyDetail.id}`, { method: 'PATCH', headers: h, data: { isTest: true } }); expect(r.status()).toBe(200); expect((await r.json()).isTest).toBe(true);
    });
    test('removal: count first (matches), then delete; the leads are gone from the API, both consoles and the CSV; a second count is zero', async () => {
      const h = { authorization: `Bearer ${await liveToken(page)}`, origin: URLS.opsKiorly };
      const dry = await page.request.post(`${URLS.api}/api/v1/admin/leads/test/remove`, { headers: h, data: { confirm: false } }); expect(dry.status()).toBe(200); const n = (await dry.json()).count; expect(n).toBeGreaterThanOrEqual(sent.length);
      const real = await page.request.post(`${URLS.api}/api/v1/admin/leads/test/remove`, { headers: h, data: { confirm: true } }); expect(await real.json()).toMatchObject({ dryRun: false, count: n });
      expect((await page.request.get(`${URLS.api}/api/v1/admin/leads/${sent[0]!.id}`, { headers: h })).status()).toBe(404);
      expect((await (await page.request.get(`${URLS.api}/api/v1/admin/leads?q=${TAG}`, { headers: h })).json()).total).toBe(0);
      expect(await (await page.request.get(`${URLS.api}/api/v1/admin/leads/export.csv?q=${TAG}`, { headers: h })).text()).not.toContain(TAG);
      expect((await (await page.request.post(`${URLS.api}/api/v1/admin/leads/test/remove`, { headers: h, data: { confirm: false } })).json()).count).toBe(0);
      await page.goto(`${URLS.opsKiorly}/leads?q=${TAG}`); await expect(page.getByTestId('data-table').locator('tbody tr').filter({ hasText: TAG })).toHaveCount(0);
    });
  });
});
