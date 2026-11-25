/**
 * Mints the oidc-client-ts session JSON (PW_SESSION_JSON) of the seeded ops super admin from the PRIVATE Passport of the stack under test (E2E_PASSPORT_URL, e.g. :4710 of scripts/w9-stack.sh),
 * for the ops Playwright specs. It never talks to the shared Passport :4400 and refuses to run against it.
 * Usage (from e2e/, after `eval "$(scripts/w9-stack.sh env)"`):  npx tsx scripts/ops-web-session.ts > /tmp/ops-session.json
 */
import { loginWithPhone } from '../src/passport.js';
import { PASSPORT, SUPER_ADMIN } from '../src/env.js';

if (/:(4400|4401)\b/.test(PASSPORT)) throw new Error(`refusing to run: E2E_PASSPORT_URL ${PASSPORT} is the shared Passport`);
const login = await loginWithPhone(SUPER_ADMIN, { clientId: 'kiorex-ops' });
const exp = Number((login.claims as { exp?: number }).exp ?? Math.floor(Date.now() / 1000) + 600);
console.log(JSON.stringify({ id_token: login.idToken, access_token: login.accessToken, token_type: 'Bearer', scope: 'openid profile phone kx', profile: { sub: login.sub, ...(login.claims as object) }, expires_at: exp }));
process.exit(0);
