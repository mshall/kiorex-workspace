import { createHmac } from 'node:crypto';

const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const b32 = (s: string): Buffer => { let bits = ''; for (const c of s.replace(/=+$/, '').toUpperCase()) bits += A.indexOf(c).toString(2).padStart(5, '0'); const out: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), the Passport default. */
export function totp(secret: string, now = Date.now()): string {
  const step = Math.floor(now / 1000 / 30); const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', b32(secret)).update(buf).digest(); const o = h[h.length - 1] & 0xf;
  return String(((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1_000_000).padStart(6, '0');
}
export const msToNextStep = (now = Date.now()) => 30_000 - (now % 30_000);
