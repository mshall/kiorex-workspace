import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * LOCAL-ONLY TOTP secret of a seeded Passport account. The seed carries none: the local Passport generates a random one per machine into
 * kiorex-account/.local/totp-secrets.json (git-ignored; `cd kiorex-account && npm run dev:totp-secrets`). `OPS_TOTP_SEED` (super admin only) or
 * `KX_LOCAL_TOTP_FILE` override. Nothing here is a published value.
 */
export function localTotpSecret(phone: string, env: NodeJS.ProcessEnv = process.env): string {
  if (phone === '+201000000099' && env.OPS_TOTP_SEED) return env.OPS_TOTP_SEED;
  const file = env.KX_LOCAL_TOTP_FILE ?? path.join(root, 'kiorex-account/.local/totp-secrets.json');
  if (!existsSync(file)) throw new Error(`no local TOTP secrets file (${file}): run \`cd kiorex-account && npm run dev:totp-secrets\` (local-only, generated per machine)`);
  const s = (JSON.parse(readFileSync(file, 'utf8')) as { secrets?: Record<string, string> }).secrets?.[phone];
  if (!s) throw new Error(`no local TOTP secret for ${phone} in ${file}`);
  return s;
}
