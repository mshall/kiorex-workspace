/**
 * Mints what a REAL-STACK Playwright run needs against the private stack (`gap-stack.sh`): a real Passport access token of a fresh patient (OTP login against the shared dev IdP, read only) written as the
 * oidc-client-ts session JSON, and the DEV-ONLY gate rows of the launch-locked flags the pages need ('DEV-TEST-FIXTURE-NOT-A-REAL-GATE', recorded on the PRIVATE Kiorex database only; `--release` removes
 * them again). Never run against the shared stack. Usage (from e2e/): E2E_KIOREX_URL=http://localhost:4139 npx tsx scripts/gap-web-session.ts [--release] > session.json
 */
import { randomInt } from 'node:crypto';
import { loginWithPhone } from '../src/passport.js';
import { kiorex, opsLogin } from '../src/clients.js';
import { recordDevGate, releaseDevGate, setFlag } from '../src/verticals.js';
import { resetOtpLimits } from '../src/db.js';

const FLAGS = ['growth.rewards', 'growth.patient_referral', 'growth.loyalty', 'growth.corporate'];
if (!(process.env.E2E_KIOREX_URL ?? '').includes(':4139')) throw new Error('refusing to run: E2E_KIOREX_URL is not the private stack (:4139)');
const ops = (await opsLogin()).accessToken;
if (process.argv.includes('--release')) { for (const k of FLAGS) await releaseDevGate(ops, k).catch(() => undefined); process.exit(0); }
for (const k of FLAGS) { await setFlag(ops, k, 'ON').catch(() => undefined); await recordDevGate(ops, k); }
await resetOtpLimits();
const phone = `+2012${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;
const login = await loginWithPhone(phone, { scope: 'openid profile phone kx email offline_access' });
await kiorex(login.accessToken, 'PUT', '/me/profile', { nameEn: 'Real Stack Tester', gender: 'FEMALE', preferredLocale: 'en' });
console.log(JSON.stringify({ phone, sub: login.sub, access_token: login.accessToken, id_token: login.idToken, expires_at: Math.floor(Date.now() / 1000) + 600 }));
process.exit(0);
