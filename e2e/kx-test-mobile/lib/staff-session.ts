import type { BrowserContext } from '@playwright/test';
import type { NativeTokens } from './native-passport';

export type StaffProduct = 'clinic' | 'pharmacy' | 'lab';
/**
 * Reproduces what the staff app does after the Passport redirect (`establish` in SessionProvider): bootstrap with the Passport access token, register the device,
 * then writes the session into the web build's storage (sessionStorage `kw-session-<product>`, localStorage `kw-bootstrap-<product>`), so the app starts signed in.
 */
export async function injectStaffSession(ctx: BrowserContext, product: StaffProduct, base: string, t: NativeTokens): Promise<{ bootstrap: any; deviceOk: boolean }> {
  const h = { authorization: `Bearer ${t.accessToken}`, 'x-kiorly-client': 'kiorly/0.1.0', 'content-type': 'application/json' };
  const bootstrap: any = await (await fetch(`${base}/mobile/bootstrap`, { headers: h })).json();
  const deviceId = `kx-e2e-${product}`;
  let device: { id: string; deviceToken: string } | undefined;
  if (bootstrap?.entitlement?.enabled) {
    const r = await fetch(`${base}/mobile/devices`, { method: 'POST', headers: h, body: JSON.stringify({ deviceId, platform: 'web', name: 'kx-test e2e web', appVersion: '0.1.0' }) });
    if (r.ok) device = (await r.json()) as { id: string; deviceToken: string };
  }
  const session = { product, auth: 'passport', token: t.accessToken, refreshToken: t.refreshToken, idToken: t.idToken, userName: bootstrap?.user?.name ?? 'staff', email: String(bootstrap?.user?.email ?? 'staff').toLowerCase(), deviceId, signedInAt: new Date().toISOString(), ...(device ? { deviceRecordId: device.id, deviceToken: device.deviceToken } : {}) };
  await ctx.addInitScript(([p, s, b]) => { sessionStorage.setItem(`kw-session-${p}`, s); localStorage.setItem(`kw-bootstrap-${p}`, b); }, [product, JSON.stringify(session), JSON.stringify(bootstrap)] as const);
  return { bootstrap, deviceOk: !!device };
}
