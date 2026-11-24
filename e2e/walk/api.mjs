import { loadAuth, state } from './lib.mjs';
export async function clinicGet(key, path) {
  const tok = JSON.parse(loadAuth(key)['cms-auth']).state.accessToken;
  const r = await fetch('http://localhost:3010/api/v1' + path, { headers: { authorization: 'Bearer ' + tok } });
  return { status: r.status, body: await r.json().catch(() => null) };
}
