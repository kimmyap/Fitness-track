/**
 * Pure data transforms for the Progress charts. All values stay in STORED
 * units (lbs) — components convert for display via domain helpers.
 */
import { DAYS } from '@/lib/program';
import { entryVolume, epley1RM, isoDate, isVolumeSet, weekRange, volumeInRange, displayDate } from '@/lib/domain';
import { parseIsoDate } from '@/lib/dates';
import { lookupExercise } from '@/services/exerciseLibraryService';
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

/**
 * Working sets that count toward 1RM/top-set. Drops are excluded here for the
 * same reason `estimated1RM` excludes them — a fatigued back-off set is not a
 * top set, and Epley on it reports a 1RM that never happened.
 */
function workingSets(entries: Entry[], exName: string): LiftSetEntry[] {
  return entries.filter(
    (e): e is LiftSetEntry =>
      isLiftSet(e) &&
      e.exercise === exName &&
      Boolean(e.weight) &&
      !e.warmupSet &&
      !e.assistedPullup &&
      !e.dropSet,
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
// Smoothing
// ---------------------------------------------------------------------------

const dayMs = 86400000;
/** Local midnight, so a "YYYY-MM-DD" never slips a day via UTC parsing. */
const atLocalMidnight = (iso: string): number => parseIsoDate(iso)?.getTime() ?? NaN;

/**
 * Trailing N-calendar-day mean, for reading a bodyweight trend through daily
 * noise. The window is by DATE, not by point count: weigh-ins are irregular, so
 * "the last 7 readings" could silently span two months and average away the
 * very trend it is meant to show.
 *
 * Each output point is the mean of every reading in the N days ending on it,
 * so the series starts immediately rather than after a warm-up period.
 */
export function movingAverageSeries(series: SeriesPoint[], windowDays = 7): SeriesPoint[] {
  const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((point, i) => {
    const cutoff = atLocalMidnight(point.date) - (windowDays - 1) * dayMs;
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0; j--) {
      const row = sorted[j] as SeriesPoint;
      if (atLocalMidnight(row.date) < cutoff) break;
      sum += row.value;
      n++;
    }
    return { date: point.date, value: Math.round((sum / n) * 10) / 10 };
  });
}

// ---------------------------------------------------------------------------
// Muscle volume
// ---------------------------------------------------------------------------

export interface MuscleVolumeSummary {
  muscle: string;
  /** lbs, primary at 100% and secondary at 50%. */
  volume: number;
  /** Sets where this muscle is the PRIMARY mover — secondary work adds volume
   *  but does not inflate the set count, which is how lifters read it. */
  workingSets: number;
}

/** What a logged exercise name targets. Supplied by the caller so this stays
 *  pure, and so the 1.2 MB exercise library is only loaded when actually shown. */
export type MuscleLookup = (exerciseName: string) => { primary: string[]; secondary: string[] } | undefined;

/**
 * The library's own resolver, adapted to `MuscleLookup`.
 *
 * Three components wrote this same two-line adapter inline. Keeping it beside
 * the type means the shape and its only real producer change together.
 */
export function toMuscleLookup(): MuscleLookup {
  return (name) => {
    const hit = lookupExercise(name);
    return hit ? { primary: hit.primary_muscles, secondary: hit.secondary_muscles } : undefined;
  };
}

/**
 * Volume per muscle group over the given entries, highest first. Uses the same
 * set filter as every other volume number in the app, so drops count and
 * warm-ups do not.
 */
export function muscleVolumeSummary(entries: Entry[], lookup: MuscleLookup): MuscleVolumeSummary[] {
  const totals = new Map<string, MuscleVolumeSummary>();
  const bump = (muscle: string, volume: number, isPrimary: boolean) => {
    const row = totals.get(muscle) ?? { muscle, volume: 0, workingSets: 0 };
    row.volume += volume;
    if (isPrimary) row.workingSets += 1;
    totals.set(muscle, row);
  };

  entries.filter(isVolumeSet).forEach((e) => {
    const target = lookup(e.exercise);
    if (!target) return;
    const volume = entryVolume(e);
    target.primary.forEach((m) => bump(m, volume, true));
    target.secondary.forEach((m) => bump(m, volume * 0.5, false));
  });

  return [...totals.values()]
    .map((r) => ({ ...r, volume: Math.round(r.volume) }))
    .sort((a, b) => b.volume - a.volume || a.muscle.localeCompare(b.muscle));
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
