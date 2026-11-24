import { createHash, createHmac, randomBytes } from 'node:crypto';

/** Partner intake signing (kiorex-contracts 1.9.0 src/intake.ts), re-implemented here on purpose: the e2e suite has no dependency on the contracts package. */
export const deriveIntakeSigningKey = (secret: string) => createHash('sha256').update(secret, 'utf8').digest('hex');
export const newIntakeNonce = () => randomBytes(18).toString('base64url');
export const generateEnrolmentCode = () => { const id = `kxe_${randomBytes(6).toString('base64url')}`; return { id, code: `${id}.${randomBytes(32).toString('base64url')}` }; };
export function signIntakeRequest(i: { secret: string; body: string; timestamp?: number; enrolmentCode?: string }): Record<string, string> {
  const ts = i.timestamp ?? Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', deriveIntakeSigningKey(i.secret)).update(`${ts}.${i.body}`).digest('hex');
  const h: Record<string, string> = { 'content-type': 'application/json', 'X-Kiorly-Timestamp': String(ts), 'X-Kiorly-Signature': `sha256=${sig}` };
  const id = i.enrolmentCode?.split('.')[0]; if (id?.startsWith('kxe_')) h['X-Kiorex-Enrolment'] = id;
  return h;
}
