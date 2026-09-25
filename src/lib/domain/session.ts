/**
 * Session span — the span of your LOGGING, not a workout length.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { Entry, LiftSetEntry } from '../types';
import { isLiftSet } from '../types';

/** Below this, the number says more about your logging habit than your session. */
export const MIN_SESSION_SPAN_MINUTES = 5;

/**
 * Minutes between the first and last set LOGGED on a date, or null.
 *
 * There is no Workout entity in this app — entries are loose sets keyed by
 * date — so this is not a session length, it is the span of your logging. The
 * two match closely if you log as you go, which the auto-starting rest timer
 * encourages, and diverge if you batch-log afterwards. Named for what it
 * measures rather than what it approximates.
 *
 * Consequences worth knowing before trusting a number:
 * - Two workouts in one day read as ONE span, gap included. That is the
 *   missing Workout entity showing through, not a bug here.
 * - `createdAt` is absent on legacy rows and one-off logs, so a day with fewer
 *   than two timestamped sets returns null rather than guessing.
 * - Spans under MIN_SESSION_SPAN_MINUTES return null: three sets logged inside
 *   a minute means you filled it in at the end, and "1 min" would be a lie
 *   dressed as data.
 */
export function sessionSpanMinutes(entries: Entry[], date: string): number | null {
  const stamps = entries
    .filter((e): e is LiftSetEntry => isLiftSet(e) && e.date === date && typeof e.createdAt === 'number')
    .map((e) => e.createdAt as number)
    .sort((a, b) => a - b);
  if (stamps.length < 2) return null;

  const first = stamps[0];
  const last = stamps[stamps.length - 1];
  if (first === undefined || last === undefined) return null;
  const minutes = Math.round((last - first) / 60000);
  return minutes >= MIN_SESSION_SPAN_MINUTES ? minutes : null;
}

/** 52 -> "52 min"; 95 -> "1h 35m". Minutes alone get unreadable past an hour. */
export function fmtSessionSpan(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
}
