/**
 * Estimated 1RM, volume totals, date ranges and recaps.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { Entry, LiftSetEntry } from '../types';
import { isLiftSet } from '../types';
import { parseIsoDate } from '../dates';
import { trainingDates } from './streaks';

// 1RM (Epley) / volume / trends
// ---------------------------------------------------------------------------

/** Epley: 1RM = weight * (1 + reps/30). */
export function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** Best estimated 1RM across all working sets of an exercise (rounded), or null. */
export function estimated1RM(entries: Entry[], exName: string): number | null {
  const rows = entries.filter(
    (e): e is LiftSetEntry =>
      isLiftSet(e) &&
      e.exercise === exName &&
      Boolean(e.weight) &&
      Boolean(e.reps) &&
      !e.warmupSet &&
      !e.assistedPullup &&
      !e.dropSet,
  );
  if (!rows.length) return null;
  const best = rows.reduce((max, r) => {
    const est = epley1RM(r.weight, r.reps);
    return est > max ? est : max;
  }, 0);
  return Math.round(best);
}

/** weight * sets * reps for one lift entry. */
export function entryVolume(e: LiftSetEntry): number {
  return e.weight * e.sets * e.reps;
}

/** Sets that count toward volume: warm-ups and assisted are out, drops are IN. */
export function isVolumeSet(e: Entry): e is LiftSetEntry {
  return isLiftSet(e) && Boolean(e.weight) && Boolean(e.sets) && Boolean(e.reps) && !e.warmupSet && !e.assistedPullup;
}

/**
 * Volume for entries whose DAY falls inside [start, end].
 *
 * `parseIsoDate`, not `new Date(e.date)`. The old form parsed UTC midnight
 * while `weekRange` and `monthRange` build local boundaries, so the comparison
 * mixed two clocks: measured in America/Los_Angeles, every Monday's sets and
 * the 1st of every month fell outside their own range and `weeklyRecap`
 * returned half its true total. It looked correct only because CI runs in UTC.
 */
export function volumeInRange(entries: Entry[], start: Date, end: Date): number {
  return entries
    .filter(isVolumeSet)
    .filter((e) => {
      const d = parseIsoDate(e.date);
      return d !== null && d >= start && d <= end;
    })
    .reduce((sum, e) => sum + entryVolume(e), 0);
}

export function totalVolumeAllTime(entries: Entry[]): number {
  return entries.filter(isVolumeSet).reduce((sum, e) => sum + entryVolume(e), 0);
}

/** Monday-based week [monday 00:00, sunday]; offsetWeeks shifts whole weeks. */
export function weekRange(offsetWeeks: number, now: Date = new Date()): [Date, Date] {
  const day = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [monday, sunday];
}

export function monthRange(offsetMonths: number, now: Date = new Date()): [Date, Date] {
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

export function weeklyRecap(entries: Entry[], now: Date = new Date()): { thisWeek: number; lastWeek: number } {
  const [thisMon, thisSun] = weekRange(0, now);
  const [lastMon, lastSun] = weekRange(-1, now);
  return {
    thisWeek: volumeInRange(entries, thisMon, thisSun),
    lastWeek: volumeInRange(entries, lastMon, lastSun),
  };
}

export function monthlyRecap(
  entries: Entry[],
  now: Date = new Date(),
): { thisMonth: number; lastMonth: number; thisMonthDays: number } {
  const [thisStart, thisEnd] = monthRange(0, now);
  const [lastStart, lastEnd] = monthRange(-1, now);
  const thisMonth = volumeInRange(entries, thisStart, thisEnd);
  const lastMonth = volumeInRange(entries, lastStart, lastEnd);
  // Same local parse as `volumeInRange` above — this sibling had the same bug.
  const thisMonthDays = trainingDates(entries).filter((d) => {
    const dt = parseIsoDate(d);
    return dt !== null && dt >= thisStart && dt <= thisEnd;
  }).length;
  return { thisMonth, lastMonth, thisMonthDays };
}

/** Legacy recap %: Math.round(((current - previous) / previous) * 100); null when previous is 0. */
export function recapPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Per-day volume trend for an exercise vs the previous training day: "up" | "down" | "same" | null. */
export function volumeTrend(entries: Entry[], exName: string): 'up' | 'down' | 'same' | null {
  const rows = entries.filter(
    (e): e is LiftSetEntry =>
      isLiftSet(e) && e.exercise === exName && Boolean(e.weight) && !e.warmupSet && !e.assistedPullup,
  );
  const byDate: Record<string, number> = {};
  rows.forEach((r) => {
    byDate[r.date] = (byDate[r.date] || 0) + entryVolume(r);
  });
  const dates = Object.keys(byDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  if (dates.length < 2) return null;
  const lastVol = byDate[dates[dates.length - 1] as string] as number;
  const prevVol = byDate[dates[dates.length - 2] as string] as number;
  if (lastVol > prevVol) return 'up';
  if (lastVol < prevVol) return 'down';
  return 'same';
}
