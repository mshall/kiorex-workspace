import { writeFileSync } from 'node:fs';
const BASE = process.env.TARGET ?? 'http://localhost:4301';
const spec: any = await (await fetch('http://localhost:3010/docs-json')).json();
const login = async (u: string) => (await (await fetch(`${BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: `${u}@demo.kiorex.test`, password: 'Demo@12345' }) })).json() as any).accessToken as string;
const T: Record<string,string> = {};
for (const u of ['owner.na', 'frontdesk1.na', 'nurse.na', 'accountant.na', 'nadia.na', 'owner.df']) T[u] = await login(u);
const call = async (m: string, p: string, tok?: string) => { const r = await fetch(BASE + p, { method: m, headers: { ...(tok ? { authorization: `Bearer ${tok}` } : {}), 'content-type': 'application/json' }, body: m === 'GET' || m === 'DELETE' ? undefined : '{}' }).catch(() => null); let j: any = null; try { j = await r!.json(); } catch {} return { s: r?.status ?? 0, j }; };
const rows: string[] = [];
const ids = new Map<string,string>();
const harvest = (src: string, o: any, d = 0) => { if (d > 6 || o == null) return; if (Array.isArray(o)) o.slice(0, 10).forEach((x) => harvest(src, x, d + 1)); else if (typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (typeof v === 'string' && /(^id$|Id$)/.test(k) && v.length > 5 && v.length < 60) ids.set(v, src); else harvest(src, v, d + 1); } };
for (const [path, item] of Object.entries<any>(spec.paths)) {
  if (/\/(dev|webhooks|export|download|backup)/.test(path)) continue;
  for (const m of ['get']) {
    if (!item[m] || path.includes('{')) continue;
    const full = path.startsWith('/api') || path.startsWith('/marketplace') ? path : '/api/v1' + path;
    const res: Record<string, number> = {};
    for (const [u, t] of Object.entries(T)) { const r = await call('GET', full, t); res[u] = r.s; if (u === 'owner.na' && r.s === 200) harvest(full, r.j); }
    const anon = (await call('GET', full)).s;
    rows.push(`GET ${full.padEnd(60)} anon=${anon} owner=${res['owner.na']} front=${res['frontdesk1.na']} nurse=${res['nurse.na']} acct=${res['accountant.na']} doc=${res['nadia.na']} otherTenantOwner=${res['owner.df']}`);
  }
}
writeFileSync(process.argv[2], rows.join('\n'));
// cross-tenant IDOR
const hits: string[] = [];
for (const [path, item] of Object.entries<any>(spec.paths)) {
  if (/\/(dev|webhooks|export|download|backup)/.test(path) || !item.get) continue;
  const ps = path.match(/\{[^}]+\}/g) ?? []; if (ps.length !== 1) continue;
  const full = path.startsWith('/api') || path.startsWith('/marketplace') ? path : '/api/v1' + path;
  for (const [id, src] of ids) {
    const url = full.replace(/\{[^}]+\}/, encodeURIComponent(id));
    const a = await call('GET', url, T['owner.na']); if (a.s !== 200) continue;
    const b = await call('GET', url, T['owner.df']);
    if (b.s === 200) hits.push(`CROSS-TENANT ${full} id=${id.slice(0,24)} (from ${src}) other-tenant owner got 200, bytes=${JSON.stringify(b.j).length}`);
  }
}
console.log(hits.join('\n') || 'no cross-tenant GET hits', '\nids', ids.size);
