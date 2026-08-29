/**
 * Pure data transforms for the Progress charts. All values stay in STORED
 * units (lbs) — components convert for display via domain helpers.
 */
import { DAYS } from '@/lib/program';
import { epley1RM, isoDate, weekRange, volumeInRange, displayDate } from '@/lib/domain';
import { isLiftSet, type BodyweightEntry, type Entry, type LiftSetEntry } from '@/lib/types';

// ---------------------------------------------------------------------------
// Exercise picker
// ---------------------------------------------------------------------------

/** Built-in program names in program order (deduped across days). */
const PROGRAM_ORDER: string[] = [...new Set(Object.values(DAYS).flat().map((ex) => ex.name))];

/**
 * Every exercise with at least one logged lift set: built-ins in program
 * order first, then everything else (customs/one-offs) alphabetically.
 */
export function exercisesWithHistory(entries: Entry[]): string[] {
  const logged = new Set(entries.filter(isLiftSet).map((e) => e.exercise));
  const builtIns = PROGRAM_ORDER.filter((name) => logged.has(name));
  const others = [...logged].filter((name) => !PROGRAM_ORDER.includes(name)).sort((a, b) => a.localeCompare(b));
  return [...builtIns, ...others];
}

// ---------------------------------------------------------------------------
// Per-exercise time series (one point per training day)
// ---------------------------------------------------------------------------

export interface SeriesPoint {
  /** "YYYY-MM-DD" */
  date: string;
  /** lbs */
  value: number;
}

/** Working sets that count toward 1RM/top-set (legacy filters). */
function workingSets(entries: Entry[], exName: string): LiftSetEntry[] {
  return entries.filter(
    (e): e is LiftSetEntry => isLiftSet(e) && e.exercise === exName && Boolean(e.weight) && !e.warmupSet && !e.assistedPullup,
  );
}

/** Best estimated 1RM (Epley, rounded) per training day, chronological. */
export function est1RMSeries(entries: Entry[], exName: string): SeriesPoint[] {
  const byDate: Record<string, number> = {};
  workingSets(entries, exName).forEach((e) => {
    if (!e.reps) return;
    const est = epley1RM(e.weight, e.reps);
    if (est > (byDate[e.date] ?? 0)) byDate[e.date] = est;
  });
  return Object.keys(byDate)
    .sort()
    .map((date) => ({ date, value: Math.round(byDate[date] as number) }));
}

/** Heaviest working-set weight per training day, chronological. */
export function topSetSeries(entries: Entry[], exName: string): SeriesPoint[] {
  const byDate: Record<string, number> = {};
  workingSets(entries, exName).forEach((e) => {
    if (e.weight > (byDate[e.date] ?? 0)) byDate[e.date] = e.weight;
  });
  return Object.keys(byDate)
    .sort()
    .map((date) => ({ date, value: byDate[date] as number }));
}

// ---------------------------------------------------------------------------
// Range switcher (4W / 3M / 6M / 1Y / All)
// ---------------------------------------------------------------------------

export const CHART_RANGES = ['4W', '3M', '6M', '1Y', 'All'] as const;
export type ChartRange = (typeof CHART_RANGES)[number];

const RANGE_DAYS: Record<Exclude<ChartRange, 'All'>, number> = {
  '4W': 28,
  '3M': 91,
  '6M': 183,
  '1Y': 365,
};

/** Keep points within the trailing range window (inclusive). */
export function filterRange(series: SeriesPoint[], range: ChartRange, now: Date = new Date()): SeriesPoint[] {
  if (range === 'All') return series;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
  const cutoffIso = isoDate(cutoff);
  return series.filter((p) => p.date >= cutoffIso);
}

// ---------------------------------------------------------------------------
// Weekly volume (Mon-based weeks)
// ---------------------------------------------------------------------------

export interface WeeklyVolumePoint {
  /** Monday "YYYY-MM-DD". */
  weekStart: string;
  /** "M/D" label for the axis. */
  label: string;
  /** lbs */
  volume: number;
  /** True for the week containing `now` (highlighted bar). */
  isCurrent: boolean;
}

/**
 * Working-set volume bucketed into Monday-based weeks (domain weekRange),
 * ending with the current week. Empty weeks stay as 0 so the time axis is
 * honest.
 */
export function weeklyVolumeSeries(entries: Entry[], weeksBack: number, now: Date = new Date()): WeeklyVolumePoint[] {
  const points: WeeklyVolumePoint[] = [];
  for (let offset = -(weeksBack - 1); offset <= 0; offset++) {
    const [monday, sunday] = weekRange(offset, now);
    const weekStart = isoDate(monday);
    points.push({
      weekStart,
      label: displayDate(weekStart),
      volume: volumeInRange(entries, monday, sunday),
      isCurrent: offset === 0,
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// Bodyweight series
// ---------------------------------------------------------------------------

/** Weigh-ins chronological (stable within a day by insertion order). */
export function bodyweightSeries(bwEntries: BodyweightEntry[]): SeriesPoint[] {
  return [...bwEntries]
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.i - b.i)
    .map(({ e }) => ({ date: e.date, value: e.weight }));
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Compact numbers for direct bar labels / axis ticks: 12345 → "12.3k". */
export function formatCompact(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}
