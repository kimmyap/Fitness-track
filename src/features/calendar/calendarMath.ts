/**
 * Pure month-grid math for the Calendar page, matching legacy renderCalendar
 * (legacy/index.html lines 3026–3216): Sunday-first grid, leading blanks for
 * the first weekday, one cell per day of the month.
 */
import type { Entry } from '@/lib/types';
import { isLiftSet } from '@/lib/types';
import { entryVolume } from '@/lib/domain';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Sunday-first day-of-week headers (legacy: S M T W T F S). */
export const DOW_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export interface MonthCell {
  /** "YYYY-MM-DD" */
  iso: string;
  /** 1-based day of month. */
  day: number;
}

/** ISO date string for a (year, monthIndex, day) triple. monthIndex is 0-based. */
export function isoFor(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Cells for a Sunday-first month grid: `null` for the leading blanks before
 * the 1st, then one cell per day.
 */
export function monthCells(year: number, monthIndex: number): (MonthCell | null)[] {
  const startOffset = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (MonthCell | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ iso: isoFor(year, monthIndex, d), day: d });
  return cells;
}

/** "August 2026". */
export function monthLabel(year: number, monthIndex: number): string {
  return `${MONTH_NAMES[monthIndex]} ${year}`;
}

/** Legacy prev/next month arithmetic (wraps across year boundaries). */
export function shiftMonth(year: number, monthIndex: number, delta: 1 | -1): { year: number; monthIndex: number } {
  let m = monthIndex + delta;
  let y = year;
  if (m < 0) {
    m = 11;
    y--;
  } else if (m > 11) {
    m = 0;
    y++;
  }
  return { year: y, monthIndex: m };
}

/** Add days to a local "YYYY-MM-DD" date (for arrow-key navigation). */
export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map((p) => parseInt(p, 10));
  const date = new Date(y ?? 0, (m ?? 1) - 1, (d ?? 1) + delta);
  return isoFor(date.getFullYear(), date.getMonth(), date.getDate());
}

export interface DayFlags {
  /** Any lift entry that day (legacy: highlighted "trained"). */
  hasLift: boolean;
  /** Any warm-up/core/activity entry that day (legacy: brass dot). */
  hasActivity: boolean;
}

/** Per-date trained/activity flags for the whole entries array. */
export function dayFlagsMap(entries: Entry[]): Record<string, DayFlags> {
  const map: Record<string, DayFlags> = {};
  entries.forEach((e) => {
    const flags = (map[e.date] ??= { hasLift: false, hasActivity: false });
    if (isLiftSet(e)) flags.hasLift = true;
    else flags.hasActivity = true;
  });
  return map;
}

export interface DaySummary {
  /** Unique exercises logged that day (warm-up sets included, like legacy). */
  exerciseCount: number;
  /** Working-set volume that day, in lbs (excludes warm-up + assisted sets). */
  volumeLbs: number;
}

/** Legacy day-detail header math: exercise count + day volume. */
export function daySummary(dayEntries: Entry[]): DaySummary {
  const liftEntries = dayEntries.filter(isLiftSet);
  const working = liftEntries.filter((e) => !e.warmupSet && !e.assistedPullup && e.weight);
  return {
    exerciseCount: new Set(liftEntries.map((e) => e.exercise)).size,
    volumeLbs: working.reduce((s, e) => s + entryVolume(e), 0),
  };
}
