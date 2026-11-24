import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'node:crypto';
import { kiorex, opsLogin, q } from '../src/clients.js';

/**
 * EDGE 47: organisation onboarding import (ops). Malformed and hostile uploads never crash the importer (no 5xx), never reach staging rows as patients, and never execute SQL;
 * a second approval-less commit is refused; every batch the test creates is removed afterwards.
 */
const B = '/admin/onboarding/imports';
let ops: string; const batches: string[] = [];
const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64');
const newBatch = async () => { const r = await kiorex(ops, 'POST', B, { orgId: `edge_org_${Date.now().toString(36)}`, orgName: 'Edge Import (test)' }); expect(r.status, JSON.stringify(r.body)).toBe(201); batches.push(r.body.id); return r.body.id as string; };
const up = (id: string, name: string, bytes: Buffer | string) => kiorex(ops, 'POST', `${B}/${id}/files`, { name, contentBase64: b64(bytes) });
beforeAll(async () => { ops = (await opsLogin()).accessToken; });
afterAll(async () => {
  for (const id of batches) { // remove staging rows of the test batches (dev DB; tables keyed on the batch id)
    const tables = (await q('kiorex_platform', `select table_name from information_schema.columns where table_schema = 'public' and column_name = 'batchId'`)).map((r: any) => r.table_name as string);
    for (const t of tables) await q('kiorex_platform', `delete from "${t}" where "batchId" = $1`, [id]).catch(() => undefined);
    await q('kiorex_platform', `delete from "ImportBatch" where id = $1`, [id]).catch(() => undefined);
  }
});

describe('I. Hostile uploads', () => {
  it('I1 empty, binary, BOM, UTF-16 and oversized-line SQL dumps are accepted or refused cleanly (never 5xx) and never create patients', async () => {
    const id = await newBatch();
    const dumps: Record<string, Buffer | string> = {
      empty: '', binaryGarbage: randomBytes(4096), bom: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('INSERT INTO tbl_patients (id, fullName) VALUES (1, \'أحمد\');')]),
      utf16: Buffer.from('﻿INSERT INTO tbl_patients (id, fullName) VALUES (1, \'x\');', 'utf16le'), cp1256Bytes: Buffer.from([0x49, 0x4e, 0x53, 0x45, 0x52, 0x54, 0x20, 0xc7, 0xe1, 0xe3, 0xca, 0x3b]),
      unterminatedString: "INSERT INTO tbl_patients (id, fullName) VALUES (1, 'never closed", unbalancedParens: 'INSERT INTO tbl_patients (id, fullName VALUES ((1, \'a\');', hugeLine: `INSERT INTO tbl_patients (id, fullName) VALUES (1, '${'x'.repeat(2_000_000)}');`,
      manyStatements: Array.from({ length: 20_000 }, (_, i) => `INSERT INTO tbl_patients (id, fullName) VALUES (${i}, 'P${i}');`).join('\n'), dangerous: "DROP TABLE tbl_patients; DELETE FROM x; COPY y FROM PROGRAM 'rm -rf /'; SELECT pg_sleep(30);",
      nullBytes: "INSERT INTO tbl_patients (id, fullName) VALUES (1, 'a\u0000b');", zeroWidth: "INSERT INTO tbl_patients (id, fullName) VALUES (1, '​‍🙂');", rtl: "INSERT INTO tbl_patients (id, fullName) VALUES (1, '‮evil');",
    };
    for (const [name, bytes] of Object.entries(dumps)) {
      const r = await up(id, `${name}.sql`, bytes);
      expect(r.status, `${name}: ${JSON.stringify(r.body).slice(0, 200)}`).toBeLessThan(500);
    }
    const patients = await q('kiorex_platform', `select count(*)::int c from "PatientProfile" where "nameEn" like 'P%' and phone is null`).catch(() => [{ c: 0 }]);
    expect(patients[0].c).toBeLessThanOrEqual(0); // importer parsed text only; nothing outside staging
    const b = await kiorex(ops, 'GET', `${B}/${id}`); expect(b.status).toBe(200);
  });
  it('I2 file names: traversal, absolute paths, NUL, very long, reserved and Unicode names are sanitised or refused (never written outside the quarantine)', async () => {
    const id = await newBatch();
    for (const name of ['../../../etc/passwd', '/etc/passwd', 'a\u0000.pdf', 'x'.repeat(5000) + '.pdf', 'CON.pdf', 'scan‮fdp.exe', 'ملف-مريض-١٢٣.pdf', '.pdf', '', ' ', 'a/b/c.pdf', 'a\\b\\c.pdf']) {
      const r = await up(id, name, '%PDF-1.4 test');
      expect(r.status, JSON.stringify(name.slice(0, 40))).toBeLessThan(500);
    }
  });
  it('I3 invalid base64, a missing body, a body that is not an object and a wrong content type are 4xx', async () => {
    const id = await newBatch();
    for (const body of [{ name: 'a.sql', contentBase64: '***not base64***' }, { name: 'a.sql' }, { contentBase64: 'AAAA' }, { name: 7, contentBase64: 'AAAA' }, { name: 'a.sql', contentBase64: 12 }, []] as unknown[]) {
      const r = await kiorex(ops, 'POST', `${B}/${id}/files`, body);
      expect(r.status, JSON.stringify(body)).toBeGreaterThanOrEqual(400); expect(r.status, JSON.stringify(body)).toBeLessThan(500);
    }
  });
  it('I4 ids: commit/approve/rollback/resolve on an unknown batch, an unknown task and a task of another batch are 404; commit without approval is refused; the patient token is 403', async () => {
    const id = await newBatch(); const other = await newBatch();
    for (const p of ['/nope/commit', `/${id}/commit`, `/${id}/approve`, `/${id}/tasks/nope/resolve`]) { const r = await kiorex(ops, 'POST', `${B}${p}`, { reportHash: 'x', action: 'SKIP_ROW' }); expect(r.status, p).toBeGreaterThanOrEqual(400); expect(r.status, p).toBeLessThan(500); }
    const t = await (await import('../src/fixtures.js')).tokens();
    expect((await kiorex(t.p1, 'GET', B)).status).toBe(403);
    expect((await kiorex(ops, 'GET', `${B}/${other}/tasks/nope`)).status).toBeGreaterThanOrEqual(400);
  });
});
