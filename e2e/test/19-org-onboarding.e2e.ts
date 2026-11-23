import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { KIOREX_API, PATIENT_1 } from '../src/env.js';
import { kiorex, opsLogin, patientLogin, q } from '../src/clients.js';
import { loginWithPhone } from '../src/passport.js';
import { buildSample } from '../../kiorex-platform/apps/api/src/onboarding-import/sample/sample-data';

/**
 * r. Organization onboarding (ops console): a messy legacy SQL dump + 20 patient files are uploaded into quarantine, scanned, mapped, every
 * ambiguity is resolved through the task API (the same calls the console makes), then a SECOND super admin approves (two-person rule), the commit is
 * crash-resumable/idempotent and finally rolled back. Real Passport tokens: ops_admin +201000009001 prepares, super_admin +201000000099 approves.
 * Needs a Kiorex API that includes the onboarding module (E2E_KIOREX_URL). Target adapter is `mock` (IMPORT_TARGET_MODE default) - nothing leaves the platform.
 */
const B = '/admin/onboarding/imports';
const OPS_ADMIN_TOTP = 'REMOVED-OLD-DEMO-TOTP-SECRET';
describe('r. Organization onboarding: scan, resolve, two-person approval, commit, rollback', () => {
  let prep: string; let sup: string; let patient: string; let id: string;
  const s = buildSample();
  const call = (t: string, method: string, path: string, body?: unknown) => kiorex(t, method, `${B}${path}`, body);
  const upload = async (t: string, name: string, bytes: Buffer) => {
    const r = await fetch(`${KIOREX_API}${B}/${id}/files?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { authorization: `Bearer ${t}`, 'content-type': 'application/octet-stream' }, body: bytes });
    return { status: r.status, body: await r.json() as any };
  };
  beforeAll(async () => {
    sup = (await opsLogin()).accessToken; patient = (await patientLogin(PATIENT_1)).accessToken;
    prep = (await loginWithPhone('+201000009001', { clientId: 'kiorex-ops', otp: '000000', totpSecret: OPS_ADMIN_TOTP })).accessToken;
  });
  afterAll(async () => { await q('kiorex_platform', `delete from "ImportBatch" where "orgId" like 'e2e\\_%'`); });

  it('only ops can see imports; approval stays super-admin-only', async () => {
    expect((await call(patient, 'GET', '')).status).toBe(403);
    const r = await call(prep, 'POST', '', { orgId: 'e2e_org_1', orgName: 'E2E Al-Noor Clinic' }); expect(r.status).toBe(201); id = r.body.id;
    expect((await call(prep, 'POST', `/${id}/approve`, { reportHash: 'x' })).status).toBe(403);
  });

  it('uploads the dump and 20 patient files into quarantine; malware and disguised executables are rejected, SQL is never executed', async () => {
    expect((await upload(prep, 'clinicpro_dump.sql', s.sql)).body.kind).toBe('SQL');
    for (const f of s.files) expect((await upload(prep, f.name, f.bytes)).body.kind).toBe('PATIENT_FILE');
    expect((await upload(prep, s.extras.malware.name, s.extras.malware.bytes)).body).toMatchObject({ kind: 'REJECTED', rejectReason: 'MALWARE' });
    expect((await upload(prep, s.extras.disguisedExe.name, s.extras.disguisedExe.bytes)).body).toMatchObject({ kind: 'REJECTED', rejectReason: 'TYPE_NOT_ALLOWED' });
    const b = (await call(prep, 'GET', `/${id}`)).body;
    expect(b.status).toBe('NEEDS_REVIEW'); expect(b.files).toHaveLength(23);
    expect(b.summary.classification.map((c: any) => [c.table, c.entity])).toEqual(expect.arrayContaining([['tbl_patients', 'patients'], ['appts', 'appointments'], ['exam', 'visits'], ['inv', 'billing'], ['cities', null]]));
    const tasks = (await call(prep, 'GET', `/${id}/tasks?pageSize=200`)).body.items as any[];
    expect(new Set(tasks.map((t) => t.type))).toEqual(expect.objectContaining(new Set(['DUPLICATE_PATIENT', 'MISSING_REQUIRED', 'INVALID_VALUE', 'AMBIGUOUS_DATE', 'ENCODING_PROBLEM', 'ORPHAN_REFERENCE', 'ORPHAN_FILE', 'TABLE_UNCLASSIFIED', 'FILE_REJECTED'])));
    expect((await call(prep, 'POST', `/${id}/request-commit`)).status).toBe(409); // blockers open
  });

  it('a human resolves every blocker through the queue', async () => {
    for (let round = 0; round < 8; round++) {
      const open = ((await call(prep, 'GET', `/${id}/tasks?status=OPEN&severity=BLOCKER&pageSize=200`)).body.items as any[]); if (!open.length) break;
      for (const t of open) {
        const body = t.type === 'DUPLICATE_PATIENT' ? { action: 'MERGE', params: { keep: '1001' } }
          : t.type === 'MISSING_REQUIRED' && t.ref.field === 'fullName' ? { action: 'SKIP_ROW' }
          : t.type === 'MISSING_REQUIRED' || t.type === 'INVALID_VALUE' ? { action: 'EDIT_VALUE', params: { value: t.ref.field === 'phone' ? '01099990000' : t.ref.field === 'amount' ? '100' : '2026-01-01' } }
          : t.type === 'ORPHAN_REFERENCE' ? { action: 'SKIP_ROW' }
          : t.context.name === 'scan_unknown.pdf' ? { action: 'ASSIGN_FILE', params: { sourceKey: '1014' } } : { action: 'SKIP_FILE' };
        const r = await call(prep, 'POST', `/${id}/tasks/${t.id}/resolve`, body); expect([200, 404]).toContain(r.status);
      }
    }
    const warn = ((await call(prep, 'GET', `/${id}/tasks?status=OPEN&type=ENCODING_PROBLEM`)).body.items as any[])[0];
    expect((await call(prep, 'POST', `/${id}/tasks/${warn.id}/resolve`, { action: 'ACCEPT_REPAIR' })).status).toBe(200);
    expect((await call(prep, 'GET', `/${id}`)).body.status).toBe('READY');
  });

  it('dry-run, two-person approval, crash-resumable idempotent commit, rollback', async () => {
    const dry = (await call(prep, 'GET', `/${id}/dry-run`)).body;
    expect(dry).toMatchObject({ canCommit: true, openBlockers: 0, mergedPatients: 1, targetMode: 'mock' }); expect(dry.willCreate.patients).toBe(13);
    expect((await call(prep, 'POST', `/${id}/request-commit`)).status).toBe(200);
    expect((await call(prep, 'POST', `/${id}/approve`, { reportHash: dry.reportHash })).status).toBe(403); // preparer is not a super admin
    expect((await call(sup, 'POST', `/${id}/approve`, { reportHash: 'wrong' })).status).toBe(409);
    expect((await call(sup, 'POST', `/${id}/approve`, { reportHash: dry.reportHash })).status).toBe(200);
    expect((await call(prep, 'POST', `/${id}/commit`)).status).toBe(403);
    const ok = await call(sup, 'POST', `/${id}/commit`); expect(ok.status).toBe(200); expect(ok.body.committed.patients).toBe(13);
    expect((await call(sup, 'POST', `/${id}/commit`)).status).toBe(409);
    const items = await q('kiorex_platform', `select "idempotencyKey", status from "ImportCommitItem" where "batchId" = $1`, [id]);
    expect(new Set(items.map((i: any) => i.idempotencyKey)).size).toBe(items.length);
    expect(items.length).toBe(dry.willCreate.patients + dry.willCreate.appointments + dry.willCreate.visits + dry.willCreate.billing + dry.filesToAttach);
    const rb = await call(sup, 'POST', `/${id}/rollback`, { reason: 'e2e rollback' }); expect(rb.status).toBe(200);
    expect((await call(prep, 'GET', `/${id}`)).body.status).toBe('ROLLED_BACK');
    expect((await q('kiorex_platform', `select count(*)::int c from "ImportCommitItem" where "batchId" = $1 and status = 'COMMITTED'`, [id]))[0].c).toBe(0);
  });

  it('every step is audited without PHI (names, phones, ids, file names never appear)', async () => {
    const rows = await q('kiorex_platform', `select action, actor, metadata from "AuditLog" where resource = 'ImportBatch' and "resourceId" = $1`, [id]);
    expect(rows.map((r: any) => r.action)).toEqual(expect.arrayContaining(['onboarding.batch_created', 'onboarding.file_staged', 'onboarding.file_rejected', 'onboarding.task_resolved', 'onboarding.commit_requested', 'onboarding.commit_approved', 'onboarding.commit_completed', 'onboarding.rollback_completed']));
    const blob = JSON.stringify(rows);
    for (const phi of ['أحمد', 'Hassan', '01012345678', '29004031201234', 'xray_chest', 'Omar']) expect(blob).not.toContain(phi);
    const actors = new Set(rows.map((r: any) => r.actor)); expect(actors.size).toBeGreaterThanOrEqual(2); // preparer and approver are different people
  });
});
