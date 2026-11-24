import { PATIENT_1 } from '../src/env.js';
import { patientLogin, opsLogin } from '../src/clients.js';
const BASE = process.env.TARGET ?? 'http://localhost:4300';
const spec: any = await (await fetch('http://localhost:4000/api/docs-json')).json();
const pat = (await patientLogin(PATIENT_1)).accessToken;
const ops = (await opsLogin()).accessToken;
const fill = (p: string) => p.replace(/\{[^}]+\}/g, 'x0000000-0000-0000-0000-000000000000');
const rows: string[] = [];
let n = 0;
for (const [path, item] of Object.entries<any>(spec.paths)) for (const [m, op] of Object.entries<any>(item)) {
  if (!['get','post','put','patch','delete'].includes(m)) continue;
  if (/^\/dev\//.test(path)) continue;
  const secured = !!op.security?.length;
  const url = BASE + fill(path);
  const hit = async (tok?: string) => { const r = await fetch(url, { method: m.toUpperCase(), headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), 'content-type': 'application/json' }, body: m === 'get' || m === 'delete' ? undefined : '{}' }).catch(() => null); return r?.status ?? 0; };
  const u = await hit(); const p = await hit(pat); const o = await hit(ops);
  n++;
  rows.push(`${m.toUpperCase().padEnd(6)} ${path.padEnd(70)} sec=${secured ? 'Y' : 'N'} anon=${u} patient=${p} ops=${o}`);
}
console.log(rows.join('\n')); console.log('total', n);
