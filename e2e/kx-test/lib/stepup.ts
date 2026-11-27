import type { Browser } from '@playwright/test';
import { URLS } from './hosts';
import { e2eSecrets } from './aws';
import { ensureSession, PERSONAS, savedToken } from './session';
import { msToNextStep, totp } from './totp';

/** Last authenticator time step used per persona: Passport accepts each step once, so a second use waits for the next step. */
const lastStep = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A step-up token for an ops persona (acr mfa, fresh auth_time, 5 minutes) WITHOUT a new phone code: the persona's saved session (ensureSession signs in, and spends one code,
 * only when none is usable) plus the real `/api/step-up` call with the authenticator code from Secrets Manager.
 */
export async function stepUpToken(browser: Browser, who: 'ops' | 'opsFinance'): Promise<string> {
  let base = (() => { try { return savedToken(who); } catch { return null; } })();
  const expOk = (t: string | null) => !!t && (JSON.parse(Buffer.from(t.split('.')[1]!, 'base64url').toString()) as { exp: number }).exp * 1000 > Date.now() + 120_000;
  if (!expOk(base)) { await ensureSession(browser, who); base = savedToken(who); }
  for (let attempt = 0; attempt < 3; attempt++) {
    const step = Math.floor(Date.now() / 30_000);
    if ((lastStep.get(who) ?? 0) >= step || msToNextStep() < 4000) await sleep(msToNextStep() + 500);
    const code = totp(e2eSecrets()[PERSONAS[who].totp]);
    lastStep.set(who, Math.floor(Date.now() / 30_000));
    const r = await fetch(`${URLS.passport}/api/step-up`, { method: 'POST', headers: { authorization: `Bearer ${base}`, 'content-type': 'application/json' }, body: JSON.stringify({ method: 'totp', code }) });
    if (r.status === 200) return ((await r.json()) as { access_token: string }).access_token;
    if (r.status !== 400) throw new Error(`step-up refused: ${r.status}`);
  }
  throw new Error('step-up did not succeed');
}
