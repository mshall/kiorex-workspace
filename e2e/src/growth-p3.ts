import { createHmac } from 'node:crypto';
import { PASSPORT } from './env.js';
import { kiorex, q } from './clients.js';

/** GRW-P3 / wave 7 helpers (add-only; a new file per phase so growth.ts and growth-p2.ts never conflict). */
export const DEV_GATE = 'DEV-TEST-FIXTURE-NOT-A-REAL-GATE';

/**
 * Makes a launch-locked flag effective for ONE run with a DEV test fixture gate (never a real counsel gate) and returns the undo. The flag is re-saved so the control-plane version bumps and every
 * reader refreshes. The fixture id starts with DEV-TEST-FIXTURE, the same marker the integration harness uses.
 */
export async function unlockForRun(ops: string, key: string): Promise<() => Promise<void>> {
  await q('kiorex_platform', `insert into "FlagGateEvidence" ("flagKey","gateId",approver,"approvedOn","documentUrl","recordedBy") values ($1,$2,'test fixture',now(),'https://dev.invalid/fixture','TEST_FIXTURE') on conflict do nothing`, [key, DEV_GATE]);
  await kiorex(ops, 'PUT', `/admin/flags/${key}/values`, { scope: 'GLOBAL', value: 'ON', reason: 'e2e wave 7 red team', ticket: 'E2E-W7' });
  return async () => { await q('kiorex_platform', `delete from "FlagGateEvidence" where "flagKey" = $1 and "gateId" = $2`, [key, DEV_GATE]); await kiorex(ops, 'PUT', `/admin/flags/${key}/values`, { scope: 'GLOBAL', value: 'ON', reason: 'e2e wave 7 red team end', ticket: 'E2E-W7' }); };
}

export const b64u = (o: unknown) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
/** A JWT with a chosen header and claims, signed with a throw-away secret (never accepted by the real verifier: that is the point). */
export const forgeJwt = (claims: Record<string, unknown>, alg: 'none' | 'HS256' = 'HS256', secret = 'attacker-secret') => {
  const h = b64u({ alg, typ: 'JWT', kid: 'test-key' }); const p = b64u({ iss: PASSPORT, aud: 'kiorex-api', exp: Math.floor(Date.now() / 1000) + 600, ...claims });
  return alg === 'none' ? `${h}.${p}.` : `${h}.${p}.${createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
};
/** Injection corpus used by the API sweeps (AR and EN): markup, script, SQL, template, path, header, NUL and oversized values. */
export const INJECTION_CORPUS = [
  `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`, `javascript:alert(1)`, `'; DROP TABLE "ReferralCode"; --`, `' OR '1'='1`, `{{7*7}}`, `\${7*7}`, `../../etc/passwd`, `%00`, 'A'.repeat(5000),
  `<svg/onload=alert('خطر')>`, `مرحبا<script>alert(1)</script>`, `‮txt.exe`, `%0d%0aSet-Cookie:%20x=1`,
] as const;
export const hasMarkup = (s: string) => /<\s*(script|img|svg|iframe)\b|onerror\s*=|onload\s*=|javascript:/i.test(s);

/** Every route of the growth family, read from the controllers' decorators (the source of truth for the "every new endpoint requires a session" sweep). `public` = the handler or class carries @Public(). */
export interface RouteSpec { method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string; public: boolean; file: string }
export async function growthRoutes(): Promise<RouteSpec[]> {
  const { readdirSync, readFileSync, statSync } = await import('node:fs'); const { join, dirname } = await import('node:path'); const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'kiorex-platform', 'apps', 'api', 'src');
  const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  const files = [...walk(join(root, 'growth')), ...walk(join(root, 'widget'))].filter((f) => f.endsWith('.controller.ts'));
  const out: RouteSpec[] = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8'); const base = /@Controller\('([^']*)'\)/.exec(src)?.[1]; if (base === undefined) continue;
    const classPublic = /@Public\(\)\s*(?:\n\s*)?(?:@\w+\([^)]*\)\s*)*@Controller/.test(src);
    for (const line of src.split('\n')) {
      const m = /@(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?\)/.exec(line); if (!m) continue;
      const path = `/${[base, m[2] ?? ''].filter(Boolean).join('/')}`.replace(/\/:[A-Za-z]+/g, '/x');
      out.push({ method: m[1]!.toUpperCase() as RouteSpec['method'], path, public: classPublic || /@Public\(\)/.test(line), file: f.split('/src/')[1]! });
    }
  }
  return out;
}
