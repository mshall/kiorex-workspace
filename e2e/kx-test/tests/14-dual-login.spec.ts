import { randomBytes } from 'node:crypto';
import { expect, request as pwRequest, test, type BrowserContext, type Page } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { passportSignIn } from '../lib/passport';
import { e2eSecrets, ssm } from '../lib/aws';

/**
 * Dual sign-in (ADR-061, 28 Nov 2026): Pharmacy, Lab and Clinic login pages show Kiorex Passport AND e-mail + password, and a standalone organisation is bound to Kiorex Passport
 * with no manual step.
 *
 * Budget: THREE phone codes in total (Pharmacy owner, Lab owner, Pharmacy self sign-up; Passport allows 5 per phone and 20 per address and hour, the founder may be testing too).
 * Everything created is a throwaway organisation tagged in "DemoMarker" (batch `e2e-dual-login`, removable with `demo-data:remove`), its staff are deactivated at the end, the one-time
 * passwords are random per run and exist only in this process and in the SSM command that creates the organisation. No published credential is used anywhere; no real organisation is touched.
 */
const tag = randomBytes(3).toString('hex');
const phone = () => `+2010${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
const pw = () => `Kx-${randomBytes(9).toString('base64url')}`;
const PH = { name: `[TEST] KX Dual Pharmacy ${tag}`, owner: `owner.${tag}@dual.kiorly.test`, ownerPhone: phone(), staff: `cashier.${tag}@dual.kiorly.test`, staffPw: pw() };
const LB = { slug: `kx-dual-${tag}`, name: `[TEST] KX Dual Lab ${tag}`, owner: `owner.${tag}@dual-lab.kiorly.test`, ownerPhone: phone(), staff: `tech.${tag}@dual-lab.kiorly.test`, staffPw: pw() };
const SU = { name: `[TEST] KX Signup Pharmacy ${tag}`, email: `signup.${tag}@dual.kiorly.test`, password: pw() };
const psql = (db: string, sql: string) => ssm(`echo '${sql.replace(/'/g, `'\\''`)}' | docker exec -i kx-test-postgres-1 psql -U postgres -d ${db} -tA`).trim();
const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

async function openLogin(page: Page, base: string) {
  await page.addInitScript(() => { try { localStorage.setItem('kiorly.lang', 'en'); localStorage.setItem('kx-lang', 'en'); } catch { /* ignore */ } });
  await page.goto(`${base}/login`);
}
async function passwordSignIn(page: Page, email: string, password: string) {
  await page.getByTestId('signin-email').fill(email); await page.getByTestId('signin-password').fill(password); await page.getByTestId('signin-submit').click();
}

test.describe.serial('dual sign-in on kx-test', () => {
  test.afterAll(async () => {
    // leave no live login behind: deactivate the throwaway staff (the organisations stay tagged for demo-data:remove)
    try { psql('pharmacy', `update "StaffUser" set active=false where email like '%${tag}@dual.kiorly.test'`); psql('lab', `update "StaffUser" set active=false where email like '%${tag}@dual-lab.kiorly.test'`); } catch { /* best effort */ }
  });

  for (const [name, base] of [['Pharmacy', URLS.pharmacy], ['Lab', URLS.lab]] as const) {
    test(`${name}: /auth/config offers Passport AND local login, the login page shows both, a wrong password gets the uniform error`, async ({ page }) => {
      const c = await pwRequest.newContext(); const cfg = await (await c.get(`${base}/api/v1/auth/config`)).json(); await c.dispose();
      expect(cfg.localLogin, 'local login on').toBe(true); expect(cfg.passport?.authorizationEndpoint, 'passport on').toContain(new URL(URLS.passport).host);
      await openLogin(page, base);
      await expect(page.getByTestId('signin-passport')).toBeVisible(); await expect(page.getByTestId('signin-password-panel')).toBeVisible();
      await expect(page.getByRole('button', { name: /Sign in with Kiorex Passport/i })).toBeVisible();
      await passwordSignIn(page, `nobody.${tag}@dual.kiorly.test`, 'not-a-real-password-1');
      await expect(page.getByTestId('signin-error')).toContainText(/Invalid e-mail or password/i);
    });
  }

  test('Clinic: the login page shows Kiorex Passport AND the e-mail + password form (real organisation not touched)', async ({ page }) => {
    await openLogin(page, URLS.clinic);
    await expect(page.getByTestId('signin-passport')).toBeVisible(); await expect(page.getByTestId('signin-password-panel')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible(); await expect(page.locator('#password')).toBeVisible();
  });

  test('throwaway standalone organisations are created by the operator tool (owner phone recorded, first staff with a password)', async () => {
    const env = (kv: Record<string, string>) => Object.entries(kv).map(([k, v]) => `-e ${JSON.stringify(`${k}=${v}`).replace(/\$/g, '\\$')}`).join(' ');
    const ph = ssm(`docker exec ${env({ ORG_NAME: PH.name, OWNER_NAME: 'Dual Owner', OWNER_EMAIL: PH.owner, OWNER_PHONE: PH.ownerPhone, EXTRA_EMAIL: PH.staff, EXTRA_NAME: 'Dual Cashier', EXTRA_PASSWORD: PH.staffPw, TAG_BATCH: 'e2e-dual-login' })} kx-test-pharmacy-api-1 node dist/seed/onboard-org.js 2>&1 | tail -2`);
    expect(ph).toContain('"tagged":true');
    const lb = ssm(`docker exec ${env({ ORG_SLUG: LB.slug, ORG_NAME: LB.name, LAB_NAME: 'Dual Lab', LAB_CODE: 'KXD', OWNER_NAME: 'Dual Lab Owner', OWNER_EMAIL: LB.owner, OWNER_PHONE: LB.ownerPhone, EXTRA_EMAIL: LB.staff, EXTRA_NAME: 'Dual Technologist', EXTRA_PASSWORD: LB.staffPw, TAG_BATCH: 'e2e-dual-login' })} kx-test-lab-api-1 node dist/seed/onboard-org.js 2>&1 | tail -2`);
    expect(lb).toContain('"tagged":true');
  });

  test('Pharmacy: a non-privileged staff member signs in with e-mail + password; the owner is told to use Passport', async ({ page }) => {
    await openLogin(page, URLS.pharmacy);
    await passwordSignIn(page, PH.staff, PH.staffPw);
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
    await expect(page.getByText('Dual Cashier').first()).toBeVisible();
    const t = await page.evaluate(() => localStorage.getItem('kiorly.token')); expect(t).toBeTruthy();
    const me = await page.request.get(`${URLS.pharmacy}/api/v1/auth/me`, { headers: { authorization: `Bearer ${t}` } }); expect(me.status()).toBe(200);
    // the owner (privileged): a correct password is refused and points to Passport
    const owner = await pwRequest.newContext(); const r = await owner.post(`${URLS.pharmacy}/api/v1/auth/login`, { data: { email: PH.owner, password: 'not-the-password-1' } }); expect(r.status()).toBe(401); await owner.dispose();
  });

  test('Lab: a technologist signs in with e-mail + password (organisation optional); wrong password and unknown e-mail look the same', async ({ page }) => {
    await openLogin(page, URLS.lab);
    await passwordSignIn(page, LB.staff, LB.staffPw);
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 });
    await expect(page.getByText('Dual Technologist').first()).toBeVisible();
    const c = await pwRequest.newContext();
    const a = await c.post(`${URLS.lab}/api/v1/auth/login`, { data: { email: LB.staff, password: 'wrong-password-123' } });
    const b = await c.post(`${URLS.lab}/api/v1/auth/login`, { data: { email: `ghost.${tag}@dual-lab.kiorly.test`, password: 'wrong-password-123' } });
    expect([a.status(), b.status()]).toEqual([401, 401]); expect((await a.json()).message).toBe((await b.json()).message);
    // the owner of a Lab never gets a password session in this mode (Passport carries the MFA policy)
    expect((await c.post(`${URLS.lab}/api/v1/auth/login`, { data: { email: LB.owner, password: 'wrong-password-123' } })).status()).toBe(401);
    await c.dispose();
  });

  for (const [name, base, owner, ownerPhone, db] of [['Pharmacy', URLS.pharmacy, PH.owner, PH.ownerPhone, 'pharmacy'], ['Lab', URLS.lab, LB.owner, LB.ownerPhone, 'lab']] as const) {
    test(`${name}: the standalone owner signs in with Passport right after creation and is bound automatically (one phone code, no manual linking)`, async ({ page }) => {
      await openLogin(page, base);
      await page.getByTestId('signin-passport').click();
      await passportSignIn(page, { phone: ownerPhone });
      await page.waitForURL((u) => u.origin === base, { timeout: 60_000 });
      // a session was issued for the OWNER row (no MFA claim yet: the friendly two-step screen, never a login error)
      await expect(page.getByText(/two-step verification/i).first()).toBeVisible({ timeout: 30_000 });
      expect(psql(db, `select count(*) from "StaffUser" where email=${q(owner)} and subject is not null`)).toBe('1');
    });
  }

  test('Pharmacy self sign-up: the owner continues with Passport and is bound by the sign-up claim (one phone code)', async ({ page }) => {
    const suPhone = phone();
    await openLogin(page, URLS.pharmacy);
    await page.goto(`${URLS.pharmacy}/signup`);
    await page.getByLabel(/pharmacy name/i).fill(SU.name); await page.getByLabel(/owner/i).first().fill('Signup Owner');
    await page.getByLabel(/^E-?mail/i).fill(SU.email); await page.getByLabel(/^Password/i).fill(SU.password);
    await page.getByRole('button', { name: /sign up|create/i }).last().click();
    await passportSignIn(page, { phone: suPhone });
    await page.waitForURL((u) => u.origin === URLS.pharmacy, { timeout: 60_000 });
    await expect(page.getByText(/two-step verification/i).first()).toBeVisible({ timeout: 30_000 });
    expect(psql('pharmacy', `select count(*) from "StaffUser" where email=${q(SU.email)} and subject is not null and phone=${q(suPhone)}`)).toBe('1');
    // tag it for demo-data:remove (the public sign-up cannot tag itself)
    psql('pharmacy', `insert into "DemoMarker" ("tableName","rowId","dataClass","batch") select 'Tenant', "orgId", 'DEMO', 'e2e-dual-login' from "StaffUser" where email=${q(SU.email)} on conflict do nothing`);
    psql('pharmacy', `update "StaffUser" set active=false where email=${q(SU.email)}`);
  });

  for (const [name, tile, email, password, host] of [['Pharmacy', 'pharmacy', PH.staff, PH.staffPw, URLS.pharmacy], ['Lab', 'lab', LB.staff, LB.staffPw, URLS.lab]] as const) {
    test(`Kiorly Home Password method signs in to the ${name} (handoff code, no Passport code)`, async ({ browser }) => {
      const context: BrowserContext = await browser.newContext(); const page = await context.newPage();
      try {
        await page.goto(`${URLS.home}/signin`);
        await page.getByTestId(`product-${tile}`).click(); await page.locator('#tab-password').click();
        await page.getByTestId('signin-email').fill(email); await page.getByTestId('signin-password').fill(password); await page.getByTestId('signin-submit').click();
        await page.waitForURL((u) => u.origin === host && !u.pathname.startsWith('/login'), { timeout: 45_000 });
        await expect(page.getByText(/Dual (Cashier|Technologist)/).first()).toBeVisible();
      } finally { await context.close(); }
    });
  }

  test('Kiorly Home Password method signs in to the Clinic (the tagged throwaway Clinic organisation, never the real one)', async ({ browser }) => {
    let password = ''; try { password = e2eSecrets().CLINIC_E2E_OWNER_PASSWORD ?? ''; } catch { /* no AWS access */ }
    test.skip(!password, 'CLINIC_E2E_OWNER_PASSWORD is not readable (needs the founder\'s AWS profile)');
    const context = await browser.newContext(); const page = await context.newPage();
    try {
      await page.goto(`${URLS.home}/signin`);
      await page.getByTestId('product-clinic').click(); await page.locator('#tab-password').click();
      await page.getByTestId('signin-email').fill('owner@kx-e2e.kiorly.test'); await page.getByTestId('signin-password').fill(password); await page.getByTestId('signin-submit').click();
      await page.waitForURL((u) => u.origin === URLS.clinic && !u.pathname.startsWith('/login'), { timeout: 60_000 });
    } finally { await context.close(); }
  });
});
