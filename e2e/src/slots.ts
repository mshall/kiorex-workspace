/**
 * Deterministic, collision-free time slots for e2e fixtures. Nothing here reads the wall clock by itself: callers pass `nowMs` (inject a fixed value in a
 * unit test, `Date.now()` in a suite) and, optionally, a random source, so any number of runs on any day pick valid slots.
 */
const fmtParts = (tz: string, ms: number) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, h: Number(p.hour), m: Number(p.minute), s: Number(p.second) };
};

/** The calendar date (YYYY-MM-DD) of an instant in a time zone. */
export const ymdIn = (tz: string, ms: number) => fmtParts(tz, ms).ymd;

/** UTC instant of a local wall-clock time in a time zone (handles DST: the offset is looked up for that very date). */
export function zonedToUtc(tz: string, ymd: string, hh: number, mm: number): number {
  const guess = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)), hh, mm, 0);
  let t = guess;
  for (let i = 0; i < 2; i++) { const p = fmtParts(tz, t); t += guess - Date.UTC(Number(p.ymd.slice(0, 4)), Number(p.ymd.slice(5, 7)) - 1, Number(p.ymd.slice(8, 10)), p.h, p.m, 0); }
  return t;
}

/** Every 5-minute start of the local day that contains `nowMs`, in random order. A caller walks the list until the server accepts one (409 = taken, next). */
export function daySlots(tz: string, nowMs: number, rnd: () => number = Math.random): string[] {
  const ymd = ymdIn(tz, nowMs);
  const all: string[] = [];
  for (let min = 0; min < 24 * 60 - 30; min += 5) all.push(new Date(zonedToUtc(tz, ymd, Math.floor(min / 60), min % 60)).toISOString());
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

/** A calendar day far enough ahead that no seed or earlier run has booked it (`minDays` .. `minDays + spanDays`), chosen from `rnd`. */
export function uniqueFutureDay(nowMs: number, minDays = 2, spanDays = 27, rnd: () => number = Math.random): Date {
  const d = new Date(nowMs + (minDays + Math.floor(rnd() * spanDays)) * 86_400_000);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
