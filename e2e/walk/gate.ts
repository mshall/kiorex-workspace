import { opsLogin } from '../src/clients.js'; import { recordDevGate, releaseDevGate } from '../src/verticals.js'; import { closeAll } from '../src/db.js';
const [mode, flag] = process.argv.slice(2); const sup = (await opsLogin()).accessToken;
if (mode === 'record') await recordDevGate(sup, flag); else await releaseDevGate(sup, flag);
console.log(mode, flag); await closeAll();
