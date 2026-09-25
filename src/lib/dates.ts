/**
 * Calendar days, in local time. The one owner of that conversion.
 *
 * WHY THIS FILE EXISTS. The app stores dates as bare "YYYY-MM-DD" with no
 * timezone — they are calendar days, not instants — and it had FIVE separate
 * implementations of turning one into the other: `isoDate` in domain.ts, a
 * private `isoDateLocal` in storage.ts, an inline copy in metricsMath.ts, and
 * two more parsers. Three different parsing idioms were in use:
 *
 *   new Date(y, m - 1, d)        local midnight — correct
 *   new Date(`${iso}T00:00:00`)  local midnight — correct, different spelling
 *   new Date(iso)                UTC midnight   — WRONG, and it shipped
 *
 * The third form is what made `volumeInRange` drop every Monday's sets west of
 * Greenwich while CI, running in UTC, stayed green. With no single owner, one
 * call site drifted and nothing could notice. So: one module, and the parse is
 * the exact inverse of the format.
 *
 * A leaf on purpose — imports nothing — so `domain`, `storage` and features can
 * all depend on it without a cycle.
 */

/** Local "YYYY-MM-DD" for a Date. */
export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * "YYYY-MM-DD" → local midnight of that calendar day, or null if it is not one.
 *
 * Null rather than an Invalid Date: Invalid Date compares false in BOTH
 * directions, so a range check silently drops the row instead of failing.
 */
export function parseIsoDate(iso: string): Date | null {
  const [y, m, d] = iso.split('-').map((part) => parseInt(part, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Local midnight of the day a Date falls on. */
export function startOfDay(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Whole calendar days from an ISO day up to `now`, never negative.
 *
 * Compares day STARTS, so a set logged last night is 1 day old rather than 0.4,
 * and a clock that is ahead cannot report a negative age.
 */
export function daysSince(fromIso: string, now: Date = new Date()): number {
  const then = parseIsoDate(fromIso);
  if (!then) return 0;
  return Math.max(0, Math.round((startOfDay(now).getTime() - then.getTime()) / 86_400_000));
}

/**
 * The `days` calendar days ending at `end` inclusive, oldest first.
 *
 * `setDate` on a copy rather than millisecond arithmetic, so a DST boundary
 * inside the window does not shift a day.
 */
export function dateWindow(end: Date, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(isoDate(d));
  }
  return out;
}
