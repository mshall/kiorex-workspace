import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import { URLS } from '../lib/hosts';
import { ensureSession, openAs, PERSONAS, savedToken, type PersonaName } from '../lib/session';
import { stepUpToken } from '../lib/stepup';

/**
 * Kiorly-only roles and role dashboards (ADR-062) on the DEPLOYED hosts.
 *  - Passport: only a super admin grants the two Kiorly roles; the grant is audited and refuses an account that holds Kiorex roles (separate accounts).
 *  - Platform API: kiorly_ops and kiorly_admin get 200 on the allow-listed Kiorly routes and 403 FORBIDDEN_ROLE everywhere else (a sample of the routes the generated platform test covers entirely).
 *  - Ops console: every role lands on its OWN dashboard (EN and AR, Western digits, light and dark), the menu shows only what the role may open, a hand-typed refused address shows the
 *    no-access page, and the Kiorex console refuses a Kiorly-only sign-in.
 * Accounts: the three THROWAWAY tagged accounts of scripts/provision-role-accounts.sh (names start with "[TEST] KX E2E", phones +20100000970x); the demo personas are only used to sign in with their saved sessions.
 * Phone codes: at most one per persona and none when a saved session is fresh (the specs reuse sessions). The grant is skipped when the account already holds the role (a grant ends the person's sessions).
 */
const PASSPORT_OPS = `${URLS.passport}/api/ops/kiorly-roles`;
const API = `${URLS.api}/api/v1`;
const ARABIC_INDIC = /[٠-٩۰-۹]/;
const passportCall = (token: string, method: string, path = '', body?: unknown) =>
  fetch(`${PASSPORT_OPS}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

async function holders(token: string): Promise<Array<{ sub: string; role: string; name: string | null; test: boolean }>> {
  const r = await passportCall(token, 'GET'); expect(r.status, await r.clone().text()).toBe(200);
  return ((await r.json()) as { holders: Array<{ sub: string; role: string; name: string | null; test: boolean }> }).holders;
}

test.describe.serial('Kiorly roles: grant in Passport, deny-by-default API', () => {
  test('only a super admin may read or change the Kiorly roles; a plain ops_admin and a missing token are refused', async ({ browser }) => {
    expect((await fetch(PASSPORT_OPS)).status).toBe(401);
    const ops = await stepUpToken(browser, 'ops');
    const r = await passportCall(ops, 'GET'); expect(r.status, await r.clone().text()).toBe(403); expect((await r.json()).error).toBe('super_admin_required');
    expect((await passportCall(ops, 'POST', '', { phone: PERSONAS.roleKiorlyOps.phone, role: 'kiorly_ops', note: 'e2e: must be refused' })).status).toBe(403);
  });

  test('the super admin grants kiorly_ops and kiorly_admin to the two tagged accounts (audited, with a reason); an account that holds Kiorex roles is refused', async ({ browser }) => {
    const sup = await stepUpToken(browser, 'superAdmin');
    const have = await holders(sup);
    for (const [phone, role, sub] of [[PERSONAS.roleKiorlyOps.phone, 'kiorly_ops', 'kx_e2e_kiorly_ops'], [PERSONAS.roleKiorlyAdmin.phone, 'kiorly_admin', 'kx_e2e_kiorly_admin']] as const) {
      if (have.some((h) => h.sub === sub && h.role === role)) continue; // already granted: a second grant would end its sessions for nothing
      const g = await passportCall(sup, 'POST', '', { phone, role, note: 'kx-test e2e: throwaway tagged account for the role dashboards' });
      expect(g.status, await g.clone().text()).toBe(201);
    }
    const after = await holders(sup);
    expect(after.find((h) => h.sub === 'kx_e2e_kiorly_ops')).toMatchObject({ role: 'kiorly_ops', test: true });
    expect(after.find((h) => h.sub === 'kx_e2e_kiorly_admin')).toMatchObject({ role: 'kiorly_admin', test: true });
    // separate accounts: the seeded ops_admin account may never become a Kiorly account; nobody grants themselves; a bad role and a missing reason are refused
    const mixed = await passportCall(sup, 'POST', '', { phone: PERSONAS.ops.phone, role: 'kiorly_ops', note: 'e2e: must be refused' });
    expect(mixed.status).toBe(409); expect((await mixed.json()).error).toBe('mixed_roles');
    expect((await (await passportCall(sup, 'POST', '', { phone: PERSONAS.roleKiorlyOps.phone, role: 'ops_admin', note: 'e2e: must be refused' })).json()).error).toBe('invalid_role');
    expect((await (await passportCall(sup, 'POST', '', { phone: PERSONAS.roleKiorlyOps.phone, role: 'kiorly_ops' })).json()).error).toBe('reason_required');
    // the history names who granted what and why
    const hist = ((await (await passportCall(sup, 'GET')).json()) as { history: Array<{ type: string; target: string; role: string; note: string }> }).history;
    expect(hist.some((e) => e.type === 'kiorly.role.granted' && e.target === 'kx_e2e_kiorly_ops' && /kx-test e2e/.test(e.note))).toBe(true);
  });

  test('a Kiorly sign-in carries only its Kiorly role, with an authenticator, and the API allow-list answers 200 on its routes and 403 FORBIDDEN_ROLE on every other area', async ({ browser, playwright }) => {
    const api: APIRequestContext = await playwright.request.newContext();
    try {
      for (const who of ['roleKiorlyOps', 'roleKiorlyAdmin'] as PersonaName[]) {
        await ensureSession(browser, who);
        const token = savedToken(who)!; const h = { authorization: `Bearer ${token}` };
        const claims = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString()) as { kx_roles: string[]; acr: string };
        expect(claims.kx_roles, who).toEqual([who === 'roleKiorlyOps' ? 'kiorly_ops' : 'kiorly_admin']);
        expect(claims.acr, 'two-step verification is mandatory for the Kiorly roles').toMatch(/mfa/);
        expect((await api.get(`${API}/auth/me`, { headers: h })).status()).toBe(200);
        for (const p of ['admin/providers', 'admin/leads', 'admin/leads/summary', 'admin/partner-leads', 'admin/onboarding/partners', 'admin/onboarding/imports', 'admin/kiorly-markets', 'admin/kiorly-plans', 'admin/commissions/policy', 'admin/fee-statements']) {
          const r = await api.get(`${API}/${p}`, { headers: h }); expect([who, p, r.status()]).toEqual([who, p, 200]);
        }
        // the Kiorex-only, money and platform areas are refused with the role error, and the commission maker-checker and market launch are not for them
        for (const p of ['admin/pharmacy/orders', 'admin/lab/bookings', 'admin/payments/dashboard', 'admin/reconciliation/runs', 'admin/commissions/summary', 'admin/commissions/claims', 'admin/messaging/stats', 'admin/integrations-center',
          'admin/flags', 'admin/outbox', 'admin/bookings', 'admin/moderation', 'admin/audit-log', 'admin/partners', 'ops/growth/overview', 'admin/safety/summary']) {
          const r = await api.get(`${API}/${p}`, { headers: h }); expect([who, p, r.status(), (await r.json()).code]).toEqual([who, p, 403, 'FORBIDDEN_ROLE']);
        }
        for (const [p, body] of [['admin/commissions/policy/EG/propose', {}], ['admin/commissions/rates/defaults', {}], ['admin/kiorly-markets/mk_x/launch', { reason: 'e2e refused' }], ['admin/onboarding/partners/x/approve', {}]] as const) {
          const r = await api.post(`${API}/${p}`, { headers: h, data: body }); expect([who, p, r.status(), (await r.json()).code]).toEqual([who, p, 403, 'FORBIDDEN_ROLE']);
        }
        const csv = await api.get(`${API}/admin/leads/export.csv`, { headers: h });
        expect(csv.status(), 'bulk export of join requests is kiorly_admin only').toBe(who === 'roleKiorlyAdmin' ? 200 : 403);
        expect((await api.get(`${API}/admin/providers`)).status()).toBe(401);
      }
    } finally { await api.dispose(); }
  });
});

/** Opens the console as a saved persona. `host` picks which console host the saved OIDC user is replayed on (both hosts share the client, so the same token works). */
async function consoleAs(browser: Browser, who: PersonaName, route: string, o: { host?: 'ops' | 'opsKiorly'; lang?: 'ar' | 'en' } = {}): Promise<{ ctx: BrowserContext; page: Page }> {
  await ensureSession(browser, who);
  const { context, page, token } = await openAs(browser, who);
  const want = URLS[o.host ?? (PERSONAS[who].app as 'ops' | 'opsKiorly')];
  if (new URL(want).origin !== new URL(URLS[PERSONAS[who].app as 'ops' | 'opsKiorly']).origin) {
    // replay the saved OIDC user on the other console host (same client id and authority, so the same record), without a new sign-in
    const file = JSON.parse(fs.readFileSync(`${new URL('../.auth', import.meta.url).pathname}/${who}.json`, 'utf8')) as { sessionStorage: Record<string, string> };
    await context.addInitScript(({ origin, ss }) => { try { if (location.origin === origin) for (const [k, v] of Object.entries(ss)) sessionStorage.setItem(k, v as string); } catch { /* ignore */ } }, { origin: new URL(want).origin, ss: file.sessionStorage });
  }
  void token;
  await page.addInitScript((lang) => { try { localStorage.setItem('kx-lang', lang); } catch { /* ignore */ } }, o.lang ?? 'en');
  await page.goto(`${want}${route}`);
  return { ctx: context, page };
}
const navHrefs = async (page: Page) => (await page.getByTestId('sidebar-nav').locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? '')));

test.describe.serial('Role dashboards in the deployed Ops console', () => {
  test('kiorly_ops on the Kiorly admin: own dashboard, only Kiorly menu entries, nothing from the Kiorex side, refused address shows the no-access page', async ({ browser }) => {
    const { ctx, page } = await consoleAs(browser, 'roleKiorlyOps', '/');
    try {
      await expect(page.getByTestId('role-home')).toHaveAttribute('data-role', 'kiorly_ops', { timeout: 45_000 });
      await expect(page.getByTestId('dashboard-kiorly_ops')).toBeVisible();
      for (const id of ['card-join-requests', 'card-partner-queue', 'card-import-drafts', 'card-plans', 'card-markets', 'card-policy']) await expect(page.getByTestId(id), id).toBeVisible();
      await expect(page.getByTestId('dash-shortcuts'), 'no change shortcuts for kiorly_ops').toHaveCount(0);
      const hrefs = await navHrefs(page);
      for (const ok of ['/home', '/providers', '/leads', '/partner-leads', '/onboarding', '/partner-onboarding', '/fees', '/kiorly-markets', '/kiorly-plans', '/commission-policy']) expect(hrefs, ok).toContain(ok);
      for (const no of ['/orders', '/finance', '/reconciliation', '/commissions', '/messaging', '/integrations', '/flags', '/operations', '/outbox', '/bookings', '/pay-ops']) expect(hrefs, no).not.toContain(no);
      await expect(page.getByTestId('growth-nav')).toHaveCount(0);
      expect(await page.locator('body').innerText()).not.toMatch(/patient/i);
      // a hand-typed address of a refused view
      await page.goto(`${URLS.opsKiorly}/orders`);
      await expect(page.getByTestId('no-access-page')).toBeVisible({ timeout: 30_000 });
      await page.goto(`${URLS.opsKiorly}/flags`); await expect(page.getByTestId('no-access-page')).toBeVisible({ timeout: 30_000 });
      await page.goto(`${URLS.opsKiorly}/commissions`); await expect(page.getByTestId('no-access-page')).toBeVisible({ timeout: 30_000 });
    } finally { await ctx.close(); }
  });

  test('kiorly_admin: same cards plus the change shortcuts; Arabic is right-to-left with Western digits; dark mode works', async ({ browser }) => {
    const { ctx, page } = await consoleAs(browser, 'roleKiorlyAdmin', '/home', { lang: 'ar' });
    try {
      await expect(page.getByTestId('role-home')).toHaveAttribute('data-role', 'kiorly_admin', { timeout: 45_000 });
      await expect(page.getByTestId('dash-shortcuts')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByTestId('card-join-requests')).toContainText('طلبات الانضمام');
      expect(await page.locator('main').innerText()).not.toMatch(ARABIC_INDIC);
      await page.getByRole('button', { name: /theme|السمة|المظهر/i }).first().click();
      await expect(page.locator('html')).toHaveClass(/dark/);
      await expect(page.getByTestId('dashboard-kiorly_admin')).toBeVisible();
      await page.getByRole('button', { name: /theme|السمة|المظهر/i }).first().click(); // back to light: nothing stays stored for the next spec
    } finally { await ctx.close(); }
  });

  test('the Kiorex console refuses a Kiorly-only sign-in with a clear message and shows no dashboard', async ({ browser }) => {
    const { ctx, page } = await consoleAs(browser, 'roleKiorlyOps', '/', { host: 'ops' });
    try {
      await expect(page.getByTestId('no-access-reason')).toContainText(/Kiorly admin/, { timeout: 45_000 });
      await expect(page.getByTestId('role-home')).toHaveCount(0);
    } finally { await ctx.close(); }
  });

  test('ops_admin lands on the Kiorex operations dashboard; its menu has no money pages', async ({ browser }) => {
    const { ctx, page } = await consoleAs(browser, 'ops', '/');
    try {
      await expect(page.getByTestId('role-home')).toHaveAttribute('data-role', 'ops_admin', { timeout: 45_000 });
      await expect(page.getByTestId('dashboard-ops_admin')).toBeVisible();
      for (const id of ['card-trust', 'card-safety', 'card-outbox', 'card-partner-queue', 'card-join-requests']) await expect(page.getByTestId(id), id).toBeVisible();
      const hrefs = await navHrefs(page);
      expect(hrefs).toContain('/orders'); expect(hrefs).not.toContain('/commissions'); expect(hrefs).not.toContain('/pay-ops');
      await page.goto(`${URLS.ops}/commissions`); await expect(page.getByTestId('no-access-page')).toBeVisible({ timeout: 30_000 });
    } finally { await ctx.close(); }
  });

  test('finance lands on its own dashboard (reconciliation and statements); a Kiorex ops page is the no-access page', async ({ browser }) => {
    const { ctx, page } = await consoleAs(browser, 'opsFinance', '/home?role=finance');
    try {
      await expect(page.getByTestId('role-home')).toHaveAttribute('data-role', 'finance', { timeout: 45_000 });
      await expect(page.getByTestId('dashboard-finance')).toBeVisible();
      for (const id of ['card-commissions', 'card-aging', 'card-reconciliation', 'card-runs']) await expect(page.getByTestId(id), id).toBeVisible();
      const hrefs = await navHrefs(page);
      expect(hrefs).toContain('/commissions');
      // the seeded finance demo account also holds ops_admin (its menu is the union of its roles and the dashboard has a switch); a PURE finance token is refused the ops pages
      const claims = JSON.parse(Buffer.from(savedToken('opsFinance')!.split('.')[1]!, 'base64url').toString()) as { kx_roles: string[] };
      if (claims.kx_roles.includes('ops_admin')) { await expect(page.getByTestId('role-switch')).toBeVisible(); }
      else { expect(hrefs).not.toContain('/flags'); expect(hrefs).not.toContain('/orders'); await page.goto(`${URLS.ops}/flags?role=finance`); await expect(page.getByTestId('no-access-page')).toBeVisible({ timeout: 30_000 }); }
    } finally { await ctx.close(); }
  });

  test('growth_admin lands on the growth KPIs only', async ({ browser }) => {
    const { ctx, page } = await consoleAs(browser, 'roleGrowthAdmin', '/');
    try {
      await expect(page.getByTestId('role-home')).toHaveAttribute('data-role', 'growth_admin', { timeout: 45_000 });
      await expect(page.getByTestId('dashboard-growth_admin')).toBeVisible();
      await expect(page.getByTestId('card-kpis')).toBeVisible();
      const hrefs = await navHrefs(page);
      expect(hrefs).not.toContain('/orders'); expect(hrefs).not.toContain('/commissions'); expect(hrefs).not.toContain('/flags');
      await page.goto(`${URLS.ops}/orders`); await expect(page.getByTestId('no-access-page')).toBeVisible({ timeout: 30_000 });
    } finally { await ctx.close(); }
  });

  test('super_admin lands on approvals waiting, audit highlights and system health, with the Passport decisions linked', async ({ browser }) => {
    const { ctx, page } = await consoleAs(browser, 'superAdmin', '/');
    try {
      await expect(page.getByTestId('role-home')).toHaveAttribute('data-role', 'super_admin', { timeout: 45_000 });
      await expect(page.getByTestId('dashboard-super_admin')).toBeVisible();
      await expect(page.getByTestId('dash-approvals-total')).toBeVisible({ timeout: 45_000 });
      for (const k of ['pol', 'rates', 'cfg', 'flags', 'markets', 'partners', 'plans', 'passport']) await expect(page.getByTestId(`dash-approval-${k}`), k).toBeVisible();
      await expect(page.getByTestId('card-audit')).toBeVisible(); await expect(page.getByTestId('card-health')).toBeVisible();
      await expect(page.getByTestId('dash-approval-passport').locator('a[href$="/account/ops/kiorly-roles"]')).toHaveCount(1);
      expect(await page.locator('main').innerText()).not.toMatch(ARABIC_INDIC);
      expect(await navHrefsHas(page, '/commissions')).toBe(true);
    } finally { await ctx.close(); }
  });
});
async function navHrefsHas(page: Page, href: string): Promise<boolean> { return (await navHrefs(page)).includes(href); }
