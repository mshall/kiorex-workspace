import pg from 'pg';
import { DB } from './env.js';

// Prisma stores `timestamp without time zone` as UTC; node-pg would parse it in the machine's local zone (4 h off on a +04 Mac).
pg.types.setTypeParser(1114, (v: string) => new Date(v.replace(' ', 'T') + 'Z'));

const pools = new Map<string, pg.Pool>();
/** `name` is a database name; the isolated nurse-lab stack (scripts/nurse-lab-stack.sh) uses kiorly_e2e11 / kiorex_e2e11 / kiorly_lab_e2e11. */
export function pool(name: string): pg.Pool {
  let p = pools.get(name);
  if (!p) { p = new pg.Pool({ connectionString: DB(name), max: 3 }); pools.set(name, p); }
  return p;
}
export async function q<T = any>(db: string, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool(db).query(sql, params)).rows as T[];
}
export async function closeAll() { await Promise.all([...pools.values()].map((p) => p.end())); pools.clear(); }
/** Dev IdP allows 5 OTP sends/phone/hour; E2E re-runs would hit that, so clear the OTP counters only (sessions untouched). */
export async function resetOtpLimits() { await q('kiorex_account', 'TRUNCATE otp_challenges, otp_send_log, otp_lockouts'); }

/**
 * The Kiorex public intake limits live in Postgres (RateLimitBucket, shared by every API instance), so they survive an API restart and a previous run. A suite that deliberately
 * bursts the intake (22) or signs several requests from the same address (23) starts and ends with a clean slate, exactly as it used to when the in-memory counters died with the process.
 */
export async function resetRateLimits() { await q('kiorex_platform', 'delete from "RateLimitBucket"'); }

/**
 * 04-pharmacy links the demo patient to a FAKE Kiorly patient (pat_e2e_*, clinic cl_e2e_*) so a signed PRESCRIPTION_SHARED webhook can land. Kiorly has no such
 * patient, so every later record-sharing toggle by that patient (here and in manual demos) used to enqueue a kiorly.record_share_consent push that answered
 * 404 (or timeout / circuit open while 10-resilience has Kiorly stopped) and ended DEAD in the ops outbox monitor. Remove the fake links and their events.
 */
export async function purgeE2eConsentPushes() {
  await q('kiorex_platform', `delete from "OutboxEvent" where type = 'kiorly.record_share_consent' and payload->>'kiorlyPatientId' like 'pat\\_e2e\\_%'`);
  await q('kiorex_platform', `delete from "KiorlyPatientLink" where "kiorlyPatientId" like 'pat\\_e2e\\_%'`);
}

/**
 * Removes a tenant (organisation) that a test created in a partner database (kiorly_pharmacy / kiorly_lab, whose Tenant FKs are RESTRICT) with everything it owns, so fixtures
 * never outlive the run. Dev/test databases only (superuser: it switches off FK checks and the append-only triggers for ONE transaction, then deletes every row that carries
 * the tenant's `orgId` / `tenantId` and any row left without its parent). Returns the number of rows removed.
 */
export async function purgeTenant(db: string, tenantId: string): Promise<number> {
  const c = await pool(db).connect();
  try {
    await c.query('BEGIN'); await c.query('SET LOCAL session_replication_role = replica');
    const cols = (await c.query(`select table_name, column_name from information_schema.columns where table_schema = 'public' and column_name in ('orgId', 'tenantId') and table_name <> 'Tenant'`)).rows as { table_name: string; column_name: string }[];
    let n = 0;
    for (const { table_name, column_name } of cols) n += (await c.query(`delete from "${table_name}" where "${column_name}" = $1`, [tenantId])).rowCount ?? 0;
    n += (await c.query(`delete from "Tenant" where id = $1`, [tenantId])).rowCount ?? 0;
    // child rows whose parent went away (tables without an org column): repeat until stable
    const fks = (await c.query(`select cl.relname child, a.attname ccol, pr.relname parent, pa.attname pcol from pg_constraint k join pg_class cl on cl.oid = k.conrelid join pg_class pr on pr.oid = k.confrelid
      join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1] join pg_attribute pa on pa.attrelid = k.confrelid and pa.attnum = k.confkey[1]
      where k.contype = 'f' and array_length(k.conkey, 1) = 1 and cl.relnamespace = 'public'::regnamespace`)).rows as { child: string; ccol: string; parent: string; pcol: string }[];
    for (let pass = 0; pass < 10; pass++) {
      let removed = 0;
      for (const f of fks) removed += (await c.query(`delete from "${f.child}" ch where ch."${f.ccol}" is not null and not exists (select 1 from "${f.parent}" p where p."${f.pcol}" = ch."${f.ccol}")`)).rowCount ?? 0;
      n += removed; if (!removed) break;
    }
    await c.query('COMMIT'); return n;
  } catch (e) { await c.query('ROLLBACK').catch(() => undefined); throw e; } finally { c.release(); }
}
