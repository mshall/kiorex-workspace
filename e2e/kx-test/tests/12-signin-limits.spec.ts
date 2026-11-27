import { expect, test } from '@playwright/test';
import { URLS } from '../lib/hosts';
import { stepUpToken } from '../lib/stepup';

/**
 * Sign-in limits (28 Nov 2026) on the DEPLOYED Passport: the default equals the shipped file, the ranges are enforced, and a harmless change goes through maker-checker
 * (ops proposes, opsFinance approves, a different person) and is put back the same way. The change used is the code lifetime 300 to 301 seconds: it cannot affect any other spec.
 * Nothing here touches the per-phone or per-address numbers (the live suite needs them), and no phone code is spent beyond what saved sessions need.
 */
const API = `${URLS.passport}/api/ops/signin-limits`;
const call = (token: string, method: string, path = '', body?: unknown) =>
  fetch(`${API}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });

test.describe.serial('Passport sign-in limits on kx-test', () => {
  test('the API door needs a token; the default equals the shipped numbers', async ({ browser }) => {
    expect((await fetch(API)).status).toBe(401);
    const t = await stepUpToken(browser, 'ops');
    const r = await call(t, 'GET'); expect(r.status).toBe(200);
    const v = await r.json();
    expect(v.defaults).toEqual({ maxSendsPerPhonePerHour: 5, maxSendsPerIpPerHour: 20, maxAttemptsPerChallenge: 5, ttlSeconds: 300, lockoutMinutesAfterExhaustedChallenge: 15 });
    expect(v.effective.ttlSeconds).toBe(300);
    expect(v.ranges.maxSendsPerPhonePerHour).toEqual([1, 10]);
  });

  test('values outside the hard ranges are refused', async ({ browser }) => {
    const t = await stepUpToken(browser, 'ops');
    for (const [k, v] of [['maxSendsPerPhonePerHour', 11], ['maxSendsPerIpPerHour', 61], ['maxAttemptsPerChallenge', 2], ['ttlSeconds', 601]] as const) {
      const r = await call(t, 'POST', '/changes', { limits: { [k]: v } });
      expect(r.status, k).toBe(400); expect((await r.json()).error).toBe('limit_out_of_range');
    }
    expect((await call(t, 'POST', '/changes', { limits: { codeLength: 4 } })).status).toBe(400);
  });

  test('maker-checker: the maker cannot approve, the checker applies, the number is live, and it is put back the same way', async ({ browser }) => {
    const maker = await stepUpToken(browser, 'ops');
    const p = await call(maker, 'POST', '/changes', { limits: { ttlSeconds: 301 }, note: 'kx-test e2e: harmless lifetime change' });
    expect(p.status).toBe(201); const id = (await p.json()).id as string;
    expect((await (await call(maker, 'POST', `/changes/${id}/approve`, {})).json()).error).toBe('second_person_required');
    expect((await (await call(maker, 'POST', '/changes', { limits: { ttlSeconds: 302 }, apply: true })).json()).error).toBe('super_admin_required_for_direct_apply');
    const checker = await stepUpToken(browser, 'opsFinance');
    const ok = await call(checker, 'POST', `/changes/${id}/approve`, { note: 'e2e' }); expect(ok.status).toBe(200); expect((await ok.json()).status).toBe('applied');
    expect((await (await call(checker, 'GET')).json()).effective.ttlSeconds).toBe(301);
    // put it back: an empty limits object means "the file's numbers again"
    const back = await call(maker, 'POST', '/changes', { limits: {}, note: 'kx-test e2e: restore the default' });
    expect(back.status).toBe(201); const bid = (await back.json()).id as string;
    const done = await call(checker, 'POST', `/changes/${bid}/approve`, { note: 'restore' }); expect(done.status).toBe(200);
    const view = await (await call(checker, 'GET')).json();
    expect(view.effective.ttlSeconds).toBe(300); expect(view.stored).toEqual({});
  });
});
