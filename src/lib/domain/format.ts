/**
 * Ids, date display and number formatting.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */

// Ids / dates / formatting
// ---------------------------------------------------------------------------

/** Legacy id scheme: Math.random().toString(36).slice(2) + Date.now(). */
export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now();
}

/*
 * Calendar-day handling lives in `./dates` — one owner, because five copies of
 * it is what let `volumeInRange` parse UTC while its range was local. These are
 * re-exported because ~50 files already import them from here, and moving the
 * import is churn with no benefit.
 */
import { parseIsoDate } from '../dates';

export { isoDate, parseIsoDate, startOfDay, daysSince, dateWindow } from '../dates';

/** "M/D" without leading zeros, from "YYYY-MM-DD". */
export function displayDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(m ?? '', 10)}/${parseInt(d ?? '', 10)}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Date with its weekday, e.g. "Fri 8/28" — a bare "8/28" is easy to misread
 * when scanning history.
 *
 * Built from the string parts rather than `new Date(iso)`: parsing a date-only
 * string yields UTC midnight, which renders as the PREVIOUS day west of
 * Greenwich.
 */
export function displayDateWithWeekday(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return displayDate(iso);
  return `${WEEKDAYS[parsed.getDay()]} ${parsed.getMonth() + 1}/${parsed.getDate()}`;
}

/** Legacy number formatting: round to `decimals` (default 1), '--' for non-numbers. */
export function fmtNum(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || isNaN(n)) return '--';
  const factor = Math.pow(10, decimals);
  return String(Math.round(n * factor) / factor);
}
