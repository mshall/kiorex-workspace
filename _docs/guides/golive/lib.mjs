// Shared helpers for the go-live guide captures. Private stack only (ports 4950-4962); no secret is ever printed or stored.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from '../../pdf/node_modules/playwright-core/index.mjs';
import { findChromium } from '../../pdf/lib/pdf.mjs';
export const OPS = 'http://localhost:4960', PATIENT = 'http://localhost:4961', CLINIC = 'http://localhost:4962', API = 'http://localhost:4953/api/v1';
export const SHOTS = new URL('./shots/', import.meta.url).pathname;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32 = (s) => { let bits = ''; for (const c of s.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0'); return Buffer.from(bits.match(/.{8}/g).map((x) => parseInt(x, 2))); };
export function totp(seed, at = Date.now()) { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(at / 30000))); const h = createHmac('sha1', b32(seed)).update(c).digest(); const o = h[h.length - 1] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, '0'); }
const seedFor = (phone) => JSON.parse(readFileSync(new URL('../../../kiorex-account/.local/totp-secrets.json', import.meta.url), 'utf8')).secrets[phone];
export async function browser() { return chromium.launch({ executablePath: findChromium(), headless: true }); }
export async function newCtx(b, w = 1366, h = 820) { return b.newContext({ viewport: { width: w, height: h }, colorScheme: 'light', deviceScaleFactor: 1.5, locale: 'en-GB' }); }
export async function shot(p, name, opts = {}) { await p.waitForTimeout(opts.wait ?? 600); await p.screenshot({ path: SHOTS + name + '.png', fullPage: !!opts.full, ...(opts.clip ? { clip: opts.clip } : {}) }); console.log('shot', name); }
/** Passport phone sign-in on whatever interaction page is showing: phone, code 000000, then the authenticator code when asked. */
export async function passportSignIn(p, phone, shots = null) {
  // PRIVATE Passport database only: the 5-codes-per-hour limit would otherwise stop repeated capture runs
  execFileSync('/Users/postgres/bin/psql', ['-q', '-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'gol_kiorex_account', '-c', 'TRUNCATE otp_challenges, otp_send_log, otp_lockouts'], { env: { ...process.env, PGPASSWORD: 'postgres' } });
  await p.waitForSelector('input[type=tel], input[name=phone]', { timeout: 20000 });
  await p.fill('input[type=tel], input[name=phone]', phone);
  if (shots) await shot(p, shots + '-1-phone');
  await p.click('button:has-text("Send code")');
  await p.waitForSelector('input[name=code]');
  await p.fill('input[name=code]', '000000');
  if (shots) await shot(p, shots + '-2-code');
  await p.click('button:has-text("Verify")');
  await p.waitForTimeout(1500);
  if (/Two-step verification/i.test(await p.innerText('body'))) {
    const inp = p.locator('input[type=text], input[inputmode=numeric], input[autocomplete=one-time-code]').first();
    await inp.fill(totp(seedFor(phone)));
    if (shots) await shot(p, shots + '-3-totp'); // a one-time value, useless 30 seconds later
    await p.click('button:has-text("Verify")');
  }
  await p.waitForTimeout(1200);
  if (/Add a passkey\?/i.test(await p.innerText('body'))) { if (shots) await shot(p, shots + '-4-passkey'); await p.click('text=Not now'); }
  await p.waitForURL(/localhost:49(60|61|62)\//, { timeout: 20000 }).catch(() => {});
}
