import crypto from 'node:crypto';
import { chromium, open, saveAuth, loadAuth, URLS } from './lib.mjs';
import { execFileSync } from 'node:child_process';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function totp(secret, at = Date.now()) {
  let bits = ''; for (const c of secret.replace(/=+$/, '')) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const ctr = Buffer.alloc(8); ctr.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const h = crypto.createHmac('sha1', key).update(ctr).digest(); const o = h[19] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
}
export const OPS = { super: { phone: '+201000000099', seed: 'REMOVED-OLD-DEMO-TOTP-SECRET' }, admin: { phone: '+201000009001', seed: 'REMOVED-OLD-DEMO-TOTP-SECRET' } };
export async function opsSignIn(browser, who) {
  const cached = loadAuth('ops-' + who);
  if (cached.key && cached.expiresAt - Date.now() / 1000 > 300) return cached;
  try { execFileSync('/Users/postgres/bin/psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'kiorex_account', '-c', 'TRUNCATE otp_challenges, otp_send_log, otp_lockouts'], { env: { ...process.env, PGPASSWORD: 'postgres' }, stdio: 'ignore' }); } catch {}
  const { page, context } = await open(browser, { product: 'ops' });
  await page.goto(URLS.ops + '/partner-onboarding'); await page.waitForURL(/localhost:4400/);
  await page.locator('#phone').fill(OPS[who].phone); await page.locator('form[action$="/phone"] button[type="submit"]').click();
  await page.locator('#code').fill('000000'); await page.locator('form[action$="/verify"] button[type="submit"]').click();
  const t = page.locator('#totp'); await t.waitFor({ state: 'visible', timeout: 15000 });
  await t.fill(totp(OPS[who].seed)); await page.locator('form:has(#totp) button[type="submit"]').click(); await page.waitForTimeout(2000); const skip = page.locator('form#finish button'); if (await skip.count()) await skip.click(); await page.waitForTimeout(500); if (false) { await page.screenshot({ path: '/tmp/claude-501/ops-login.png' }); console.log(await page.innerText('body')); }
  await page.waitForURL(/localhost:5181/, { timeout: 20000 });
  await page.waitForFunction(() => Object.keys(sessionStorage).some((k) => k.startsWith('oidc.user:')));
  const o = await page.evaluate(() => { const key = Object.keys(sessionStorage).find((k) => k.startsWith('oidc.user:')); const value = sessionStorage.getItem(key); return { key, value, expiresAt: JSON.parse(value).expires_at }; });
  saveAuth('ops-' + who, o); await context.close(); return o;
}
export async function opsPage(browser, who, o) {
  const { page, context, logs } = await open(browser, { product: 'ops', ...o.view });
  await context.addInitScript(([k, v]) => { try { sessionStorage.setItem(k, v); } catch {} }, [o.auth.key, o.auth.value]);
  return { page, context, logs };
}
if (process.argv[1].endsWith('ops.mjs')) { const b = await chromium.launch(); for (const w of ['super', 'admin']) console.log(w, (await opsSignIn(b, w)).expiresAt); await b.close(); }
