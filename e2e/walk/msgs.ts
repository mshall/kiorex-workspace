import { q } from '../src/clients.js'; import { closeAll } from '../src/db.js';
const r = await q('kiorex_platform', `select "templateId", channel, status, recipient, left(coalesce(body,''), 160) b from "MessageLog" where "templateId" like 'partner.onboarding.%' and "createdAt" > now() - interval '3 hours' order by "createdAt"`).catch(async (e) => { console.log(String(e).slice(0,200)); return []; });
for (const x of r) console.log(x.templateId, x.channel, x.status, x.recipient, '|', x.b.replace(/\n/g, ' '));
await closeAll();
