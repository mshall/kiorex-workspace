import fs from 'node:fs';
import path from 'node:path';
import type { Browser, BrowserContext, Page } from '@playwright/test';
import { URLS, here } from './hosts';
import { passportSignIn } from './passport';
import { e2eSecrets } from './aws';

/**
 * The demo personas of kx-test (synthetic accounts of the Passport demo seed, no real people).
 *  patient            +201000001001  Hoda Mahmoud, has bookings, consents, orders in the platform demo data
 *  ops                +201000009001  ops_admin (Passport enforces TOTP; the seed is the one in AWS Secrets Manager /kx/test/e2e)
 *  opsFinance         +201000009002  ops_admin + finance (the commission views need the finance role)
 *  superAdmin         +201000000099  super_admin (settings and test-data removal of the join requests; phone code + TOTP from /kx/test/e2e)
 *  pharmacyCashier    +201000002008  CASHIER: not a privileged role, so no MFA claim is needed
 *  pharmacyOwner      +201000002007  OWNER: privileged. The Pharmacy API demands an MFA claim in production mode, so this persona signs in with phone code + TOTP (secret in AWS Secrets Manager)
 *  pharmacistNoMfa    +201000002004  PHARMACIST (privileged) signing in with the phone code only: used to PROVE the rule (403 MFA_REQUIRED), never to get access
 *  labTech            +201000002005  TECHNOLOGIST (not privileged)
 *  labOwner           +201000002010  OWNER (privileged: the Lab rule is the same as the Pharmacy rule, a phone code alone is not an MFA claim); phone code + TOTP
 */
export const PERSONAS = {
  patient: { phone: '+201000001001', app: 'patientWeb' },
  ops: { phone: '+201000009001', app: 'ops', totp: 'ops_admin_totp' },
  opsFinance: { phone: '+201000009002', app: 'ops', totp: 'finance_totp' },
  superAdmin: { phone: '+201000000099', app: 'ops', totp: 'super_admin_totp' },
  pharmacyCashier: { phone: '+201000002008', app: 'pharmacy' },
  pharmacyOwner: { phone: '+201000002007', app: 'pharmacy', totp: 'pharmacy_owner_totp' },
  pharmacistNoMfa: { phone: '+201000002004', app: 'pharmacy' },
  labTech: { phone: '+201000002005', app: 'lab' },
  labOwner: { phone: '+201000002010', app: 'lab', totp: 'lab_owner_totp' },
  // throwaway TAGGED accounts of the role-dashboard spec (scripts/provision-role-accounts.sh; never published demo accounts)
  roleGrowthAdmin: { phone: '+201000009701', app: 'ops', totp: 'growth_admin_totp' },
  roleKiorlyOps: { phone: '+201000009702', app: 'opsKiorly', totp: 'kiorly_ops_totp' },
  roleKiorlyAdmin: { phone: '+201000009703', app: 'opsKiorly', totp: 'kiorly_admin_totp' },
} as const;
export type PersonaName = keyof typeof PERSONAS;

const AUTH_DIR = path.join(here, '..', '.auth');
// Passport allows 5 one-time codes per phone and 20 per IP and hour, so a fresh session is reused on a quick re-run. Platform access tokens live 15 minutes, product (Pharmacy, Lab) sessions 60.
const maxAgeMs = (n: PersonaName) => Number(process.env.KX_E2E_SESSION_MINUTES ?? (PERSONAS[n].app === 'pharmacy' || PERSONAS[n].app === 'lab' ? 40 : 6)) * 60_000;
const file = (n: PersonaName) => path.join(AUTH_DIR, `${n}.json`);
interface Saved { savedAt: number; origin: string; storageState: any; sessionStorage: Record<string, string> }

export const sessionAge = (n: PersonaName): number | null => { try { return Date.now() - (JSON.parse(fs.readFileSync(file(n), 'utf8')) as Saved).savedAt; } catch { return null; } };
/** A session that ended in a sign-out is useless: drop the cached copy so the next spec signs in again. */
export const dropSession = (n: PersonaName) => { try { fs.rmSync(file(n)); } catch { /* none */ } };
export const hasFreshSession = (n: PersonaName) => { const a = sessionAge(n); return a !== null && a < maxAgeMs(n) && process.env.KX_E2E_FRESH !== '1'; };

async function startSignIn(page: Page, name: PersonaName): Promise<void> {
  await page.addInitScript(() => { try { localStorage.setItem('kiorly.lang', 'en'); localStorage.setItem('kx-lang', 'en'); } catch { /* ignore */ } });
  const p = PERSONAS[name];
  if (p.app === 'pharmacy' || p.app === 'lab') {
    await page.goto(`${URLS[p.app]}/login`);
    await page.getByRole('button', { name: /Sign in with Kiorex Passport/i }).click();
  } else if (p.app === 'ops' || p.app === 'opsKiorly') {
    await page.goto(`${URLS[p.app]}/`);
  } else {
    await page.goto(`${URLS.patientWeb}/`);
    await page.getByRole('button', { name: /^(Sign in|Log in)$/i }).first().click();
    await page.getByTestId('entry-continue').click(); // the Kiorex entry page (Sign in / Join us) comes before Passport since 28 Nov 2026
  }
}

/** Signs a persona in through the real Passport pages and saves cookies, localStorage and sessionStorage (the SPAs keep their OIDC user in either) under .auth/ (git-ignored). */
export async function signInAndSave(browser: Browser, name: PersonaName): Promise<void> {
  const p = PERSONAS[name]; const context = await browser.newContext({ locale: 'en-US' }); const page = await context.newPage();
  try {
    await startSignIn(page, name);
    await passportSignIn(page, { phone: p.phone, totpSecret: 'totp' in p ? e2eSecrets()[p.totp] : undefined });
    const origin = new URL(URLS[p.app]).origin;
    await page.waitForURL((u) => u.origin === origin && !u.pathname.startsWith('/auth/callback') && !u.pathname.startsWith('/login'), { timeout: 60_000 });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const sessionStorage = await page.evaluate(() => Object.fromEntries(Object.entries(window.sessionStorage)));
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    const saved: Saved = { savedAt: Date.now(), origin, storageState: await context.storageState(), sessionStorage };
    fs.writeFileSync(file(name), JSON.stringify(saved), { mode: 0o600 });
  } finally { await context.close(); }
}

/** Signs the persona in unless a fresh saved session exists. Call from a spec's beforeAll so the tokens are fresh when the spec runs. */
export async function ensureSession(browser: Browser, name: PersonaName): Promise<void> {
  if (!hasFreshSession(name) || !(await stillValid(name))) await signInAndSave(browser, name);
}

/** A saved session can be dead although it is young (a sign-out test, a back-channel logout, a restart): probe it before relying on it. */
async function stillValid(name: PersonaName): Promise<boolean> {
  try {
    const p = PERSONAS[name];
    if (p.app === 'patientWeb' || p.app === 'ops' || p.app === 'opsKiorly') {
      const t = savedToken(name); if (!t) return false;
      const exp = (JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()) as { exp: number }).exp; return exp * 1000 > Date.now() + 120_000;
    }
    const t = savedLocalStorage(name, p.app === 'pharmacy' ? 'kiorly.token' : 'kiorly.lab.token'); if (!t) return false;
    const r = await fetch(`${URLS[p.app]}/api/v1/auth/me`, { headers: { authorization: `Bearer ${t}` } });
    return r.status !== 401; // 403 MFA_REQUIRED means alive but without an MFA claim: the caller's assertions decide
  } catch { return false; }
}

/** A new context already signed in as the persona (restores cookies, localStorage and sessionStorage). Language is forced to English for stable selectors. */
export async function openAs(browser: Browser, name: PersonaName, opts: { timezoneId?: string; locale?: string } = {}): Promise<{ context: BrowserContext; page: Page; token: string | null }> {
  const saved = JSON.parse(fs.readFileSync(file(name), 'utf8')) as Saved;
  const context = await browser.newContext({ storageState: saved.storageState, locale: opts.locale ?? 'en-US', ...(opts.timezoneId ? { timezoneId: opts.timezoneId } : {}) });
  await context.addInitScript(({ origin, ss }) => {
    try { localStorage.setItem('kiorly.lang', 'en'); localStorage.setItem('kx-lang', 'en'); if (location.origin === origin) for (const [k, v] of Object.entries(ss)) sessionStorage.setItem(k, v as string); } catch { /* ignore */ }
  }, { origin: saved.origin, ss: saved.sessionStorage });
  const page = await context.newPage();
  return { context, page, token: oidcAccessToken(saved) };
}

/** The OIDC access token the SPA holds (oidc-client-ts user record), for API-level calls made as that persona. */
function oidcAccessToken(s: Saved): string | null {
  for (const [k, v] of Object.entries(s.sessionStorage)) {
    if (!k.startsWith('oidc.user:')) continue;
    try { return (JSON.parse(v) as { access_token?: string }).access_token ?? null; } catch { /* next */ }
  }
  return null;
}
export const savedToken = (n: PersonaName): string | null => oidcAccessToken(JSON.parse(fs.readFileSync(file(n), 'utf8')) as Saved);
export const savedLocalStorage = (n: PersonaName, key: string): string | null => {
  const s = JSON.parse(fs.readFileSync(file(n), 'utf8')) as Saved;
  for (const o of s.storageState.origins ?? []) for (const kv of o.localStorage ?? []) if (kv.name === key) return kv.value;
  return null;
};

/** The platform access token the SPA holds right now (read from the live page, so a silent refresh is picked up). */
export async function liveToken(page: Page): Promise<string> {
  const t = await page.evaluate(() => { for (const [k, v] of Object.entries(sessionStorage)) if (k.startsWith('oidc.user:')) { try { return (JSON.parse(v) as { access_token?: string }).access_token ?? null; } catch { /* next */ } } return null; });
  if (!t) throw new Error('no OIDC user in sessionStorage: the session did not restore');
  return t;
}
