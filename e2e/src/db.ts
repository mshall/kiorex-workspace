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
 * 04-pharmacy links the demo patient to a FAKE Kiorly patient (pat_e2e_*, clinic cl_e2e_*) so a signed PRESCRIPTION_SHARED webhook can land. Kiorly has no such
 * patient, so every later record-sharing toggle by that patient (here and in manual demos) used to enqueue a kiorly.record_share_consent push that answered
 * 404 (or timeout / circuit open while 10-resilience has Kiorly stopped) and ended DEAD in the ops outbox monitor. Remove the fake links and their events.
 */
export async function purgeE2eConsentPushes() {
  await q('kiorex_platform', `delete from "OutboxEvent" where type = 'kiorly.record_share_consent' and payload->>'kiorlyPatientId' like 'pat\\_e2e\\_%'`);
  await q('kiorex_platform', `delete from "KiorlyPatientLink" where "kiorlyPatientId" like 'pat\\_e2e\\_%'`);
}
