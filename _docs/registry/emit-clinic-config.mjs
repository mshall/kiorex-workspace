#!/usr/bin/env node
// Generates the Clinic CDK wiring file (clinics-management infra/config/<name>.json) from the URL registry. No secrets: secrets are
// references (Secrets Manager name + JSON key). Usage:
//   node _docs/registry/emit-clinic-config.mjs --env test --out ../clinics-management/infra/config/kx-test.json
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const env = arg('env', 'test'); const out = arg('out');
const run = (...a) => execFileSync('node', [path.join(here, 'validate-registry.mjs'), ...a], { encoding: 'utf8' });

const vars = {};
for (const line of run('--emit', 'env', '--env', env).split('\n')) {
  const [svc, kv] = line.split('\t'); if (svc !== 'kiorly.clinics' || !kv) continue;
  const i = kv.indexOf('='); vars[kv.slice(0, i)] = kv.slice(i + 1);
}
const cors = run('--emit', 'cors', '--env', env).split('\n').find((l) => l.startsWith('kiorly.api: CORS_ORIGINS='));
if (!cors) throw new Error('registry has no kiorly.api CORS list');
vars.CORS_ALLOWED_ORIGINS = cors.slice('kiorly.api: CORS_ORIGINS='.length).trim();
vars.KIOREX_OIDC_CLIENT_ID = 'kiorly-clinic';

const secretName = `/kx/${env}/clinic`;
const ref = (key) => ({ secretName, key });
const cfg = {
  _generated: `node _docs/registry/emit-clinic-config.mjs --env ${env} (do not edit by hand; no secret values, references only)`,
  environment: `kx-${env}`,
  env: Object.fromEntries(Object.entries(vars).sort(([a], [b]) => a.localeCompare(b))),
  secrets: {
    KIOREX_OIDC_CLIENT_SECRET: ref('KIOREX_OIDC_CLIENT_SECRET'),
    KIOREX_OUTBOX_WEBHOOK_SECRET: ref('KIOREX_OUTBOX_WEBHOOK_SECRET'),
    KIOREX_MARKETPLACE_CLIENT_KEY: ref('KIOREX_MARKETPLACE_CLIENT_KEY'),
    KIOREX_MARKETPLACE_CLIENT_SECRET: ref('KIOREX_MARKETPLACE_CLIENT_SECRET'),
  },
};
const text = JSON.stringify(cfg, null, 2) + '\n';
if (out) { writeFileSync(out, text); console.log(`wrote ${out}`); } else process.stdout.write(text);
