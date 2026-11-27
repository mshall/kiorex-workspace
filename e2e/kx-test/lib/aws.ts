import { execFileSync } from 'node:child_process';

/** Everything the suite needs from AWS goes through the AWS CLI at run time (credentials from the caller's own CLI profile). No secret is read from a file in git and none is printed. */
const REGION = process.env.AWS_REGION ?? 'eu-central-1';
const aws = (args: string[], input?: string): string =>
  execFileSync('aws', [...args, '--region', REGION, '--output', 'text'], { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 120_000 }).trim();

export const INSTANCE = process.env.KX_E2E_INSTANCE ?? 'i-0823d9ef0bcda4a52';
export const SECRET_ID = process.env.KX_E2E_SECRET_ID ?? '/kx/test/e2e';
const PASSPORT_CONTAINER = process.env.KX_E2E_PASSPORT_CONTAINER ?? 'kx-test-passport-1';

/** Run a read-only shell command on the kx-test host through SSM Run Command and return stdout. */
export function ssm(command: string, timeoutS = 90): string {
  const id = aws(['ssm', 'send-command', '--instance-ids', INSTANCE, '--document-name', 'AWS-RunShellScript', '--parameters', JSON.stringify({ commands: [command] }), '--query', 'Command.CommandId']);
  const t0 = Date.now();
  for (;;) {
    let st = '';
    try { st = aws(['ssm', 'get-command-invocation', '--command-id', id, '--instance-id', INSTANCE, '--query', 'Status']); } catch { /* not registered yet */ }
    if (['Success', 'Failed', 'Cancelled', 'TimedOut'].includes(st)) {
      const out = aws(['ssm', 'get-command-invocation', '--command-id', id, '--instance-id', INSTANCE, '--query', 'StandardOutputContent']);
      if (st !== 'Success') throw new Error(`ssm command ${st}`);
      return out === 'None' ? '' : out;
    }
    if (Date.now() - t0 > timeoutS * 1000) throw new Error('ssm command timed out');
    execFileSync('sleep', ['1.5']);
  }
}

/** Latest one-time code the Passport container logged for a phone number (mock sender; read-only `docker logs`, only the six digits are returned). */
export function latestOtp(phone: string): string | null {
  if (!/^\+\d{8,15}$/.test(phone)) throw new Error('bad phone');
  const out = ssm(`docker logs --since 20m ${PASSPORT_CONTAINER} 2>&1 | grep -F "to=${phone} " | tail -1 | sed -E 's/.*code=([0-9]+).*/\\1/'`);
  return /^\d{4,10}$/.test(out.trim()) ? out.trim() : null;
}

/** Wait until a code different from `previous` appears for the phone. */
export async function waitForNewOtp(phone: string, previous: string | null, timeoutMs = 60_000): Promise<string> {
  const t0 = Date.now();
  for (;;) {
    const c = latestOtp(phone);
    if (c && c !== previous) return c;
    if (Date.now() - t0 > timeoutMs) throw new Error(`no new one-time code for ${phone.slice(0, 6)}***`);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

let cached: Record<string, string> | null = null;
/** The e2e secret bag (TOTP secrets of the ops demo accounts). Never logged. */
export function e2eSecrets(): Record<string, string> {
  if (!cached) cached = JSON.parse(aws(['secretsmanager', 'get-secret-value', '--secret-id', SECRET_ID, '--query', 'SecretString'])) as Record<string, string>;
  return cached;
}

/** A platform product secret (partner client credentials are NOT readable here on purpose; see tests/partner-hmac.spec.ts). */
export function secretJson(id: string): Record<string, string> { return JSON.parse(aws(['secretsmanager', 'get-secret-value', '--secret-id', id, '--query', 'SecretString'])); }
