/**
 * Domain logic ported VERBATIM from legacy/index.html (formulas, thresholds,
 * filters and copy preserved exactly). All functions are pure: they take the
 * data they operate on as arguments.
 *
 * Weight is ALWAYS stored in lbs (kg display-only), measurements in inches
 * (cm display-only).
 */
import type {
  AnyExercise,
  BodyweightEntry,
  Entry,
  EquipmentWeights,
  GoalsMap,
  LiftSetEntry,
  MeasurementEntry,
  Unit,
} from './types';
import { isLiftSet } from './types';

// ---------------------------------------------------------------------------
// Ids / dates / formatting
// ---------------------------------------------------------------------------

/** Legacy id scheme: Math.random().toString(36).slice(2) + Date.now(). */
export function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now();
}

/** Local "YYYY-MM-DD". */
export function isoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const [y, m, d] = iso.split('-').map((part) => parseInt(part, 10));
  if (!y || !m || !d) return displayDate(iso);
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${weekday} ${m}/${d}`;
}

/** Legacy number formatting: round to `decimals` (default 1), '--' for non-numbers. */
export function fmtNum(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || isNaN(n)) return '--';
  const factor = Math.pow(10, decimals);
  return String(Math.round(n * factor) / factor);
}

// ---------------------------------------------------------------------------
// Unit conversions (display-only; storage stays lbs / inches)
// ---------------------------------------------------------------------------

export const LBS_PER_KG = 2.20462;
export const CM_PER_INCH = 2.54;

/** lbs → display units (kg rounded to 0.1 when unit is kg). */
export function toDisplayWeight(lbsVal: number, unit: Unit): number {
  if (unit === 'kg') return Math.round((lbsVal / LBS_PER_KG) * 10) / 10;
  return lbsVal;
}

/** display units → stored lbs (rounded to 0.1 when converting from kg). Falsy passes through (legacy). */
export function fromDisplayWeight(displayVal: number, unit: Unit): number {
  if (!displayVal) return displayVal;
  if (unit === 'kg') return Math.round(displayVal * LBS_PER_KG * 10) / 10;
  return displayVal;
}

/** inches → display length (cm rounded to 0.1 when unit is kg/metric). */
export function toDisplayLength(inches: number | null, unit: Unit): number | null {
  if (inches == null) return null;
  return unit === 'kg' ? Math.round(inches * CM_PER_INCH * 10) / 10 : inches;
}

/** display length → stored inches (rounded to 0.1 when converting from cm). */
export function fromDisplayLength(displayVal: number, unit: Unit): number {
  return unit === 'kg' ? Math.round((displayVal / CM_PER_INCH) * 10) / 10 : displayVal;
}

/** Standard bar, in DISPLAY units (legacy quirk: math runs in display units). */
export function barWeight(unit: Unit): number {
  return unit === 'kg' ? 20 : 45;
}

/**
 * Trap-bar weight used by the weight-entry math. Legacy quirk preserved:
 * when set in Settings the stored lbs value is returned as-is (used directly
 * in display-unit math); only the default is unit-aware (55 lb / 25 kg).
 */
export function trapBarWeight(equipment: EquipmentWeights, unit: Unit): number {
  if (equipment.trapBar != null) return equipment.trapBar;
  return unit === 'kg' ? 25 : 55;
}

/** Leg-press sled weight (varies too much to guess; defaults to 0). */
export function legPressSledWeight(equipment: EquipmentWeights): number {
  return equipment.legPressSled != null ? equipment.legPressSled : 0;
}

// ---------------------------------------------------------------------------
// Variation-aware weight-entry math (legacy log handler)
// ---------------------------------------------------------------------------

export interface WeightEntryContext {
  unit: Unit;
  equipment: EquipmentWeights;
  /**
   * Straight-bar weight in LBS, from Settings (gymlog:barWeight). Omitted
   * falls back to the standard 45lb / 20kg bar.
   */
  barWeightLbs?: number | null;
}

/** Default straight-bar weight (lbs), used when Settings has no override. */
export const DEFAULT_BAR_WEIGHT_LBS = 45;

/**
 * Straight-bar weight in DISPLAY units, honouring the Settings override.
 * The stored value is always lbs, so kg display converts it.
 */
export function configuredBarWeight(ctx: WeightEntryContext): number {
  if (ctx.barWeightLbs === undefined || ctx.barWeightLbs === null) return barWeight(ctx.unit);
  return toDisplayWeight(ctx.barWeightLbs, ctx.unit);
}

/**
 * Compute the TOTAL weight (in display units) from what the user typed:
 * - Barbell: per-side × 2 + bar (45 lb / 20 kg); 0 stays 0
 * - Trap Bar: per-side × 2 + trap-bar weight; 0 stays 0
 * - Dumbbell: one dumbbell × 2
 * - Leg Press: plates + sled weight; 0 stays 0
 * - everything else (incl. Assisted Pull-up): as typed
 */
export function computeTotalDisplayWeight(
  variation: string | null | undefined,
  rawInput: number,
  ctx: WeightEntryContext,
): number {
  const wSafe = rawInput || 0;
  const isBarbell = variation === 'Barbell';
  const isDumbbell = variation === 'Dumbbell';
  const isTrapBar = variation === 'Trap Bar';
  const isLegPress = variation === 'Leg Press';
  return isBarbell
    ? wSafe
      ? wSafe * 2 + barWeight(ctx.unit)
      : 0
    : isDumbbell
      ? wSafe * 2
      : isTrapBar
        ? wSafe
          ? wSafe * 2 + trapBarWeight(ctx.equipment, ctx.unit)
          : 0
        : isLegPress
          ? wSafe
            ? wSafe + legPressSledWeight(ctx.equipment)
            : 0
          : wSafe;
}

/** Full entry math: user input → stored lbs. */
export function storedWeightFromInput(
  variation: string | null | undefined,
  rawInput: number,
  ctx: WeightEntryContext,
): number {
  return fromDisplayWeight(computeTotalDisplayWeight(variation, rawInput, ctx), ctx.unit);
}

/**
 * Reverse math for prefilling the weight input from a stored total (legacy
 * edit/last-set prefill). Note the legacy quirk: only Barbell and Dumbbell
 * are reversed; Trap Bar / Leg Press prefill the display TOTAL as-is.
 */
export function inputWeightFromStored(
  variation: string | null | undefined,
  storedLbs: number,
  unit: Unit,
): number {
  const totalDisplay = toDisplayWeight(storedLbs, unit);
  if (variation === 'Barbell') return Math.round(((totalDisplay - barWeight(unit)) / 2) * 10) / 10;
  if (variation === 'Dumbbell') return Math.round((totalDisplay / 2) * 10) / 10;
  return totalDisplay;
}

// ---------------------------------------------------------------------------
// Weight input modes (plate calculator)
//
// 'auto'    — legacy, variation-driven math (see computeTotalDisplayWeight)
// 'total'   — the number typed IS the total weight
// 'perSide' — the number typed is plates on ONE side; total = n*2 + bar
//
// Mode affects INPUT ONLY. Storage is always the total, in lbs.
// ---------------------------------------------------------------------------

export type WeightEntryMode = 'auto' | 'total' | 'perSide';

/**
 * Whether to offer the total/per-side toggle. Barbell and Trap Bar are
 * plate-loaded; so are exercises with no variation at all (a custom
 * "Glute Bridges" is usually loaded with plates on a bar).
 *
 * Leg Press is deliberately excluded: its legacy math already adds the sled to
 * the plate total, so a per-side reading would change what the number means.
 */
/**
 * Which of the two visible modes an 'auto' exercise behaves as: Barbell and
 * Trap Bar are per-side by legacy default, everything else is total.
 */
export function effectiveMode(
  mode: WeightEntryMode,
  variation: string | null,
): 'total' | 'perSide' {
  if (mode !== 'auto') return mode;
  return variation === 'Barbell' || variation === 'Trap Bar' ? 'perSide' : 'total';
}

export function isPlateLoaded(variation: string | null | undefined): boolean {
  return !variation || variation === 'Barbell' || variation === 'Trap Bar';
}

/** Bar weight that perSide mode adds, in DISPLAY units. */
export function barForVariation(
  variation: string | null | undefined,
  ctx: WeightEntryContext,
): number {
  return variation === 'Trap Bar' ? trapBarWeight(ctx.equipment, ctx.unit) : configuredBarWeight(ctx);
}

/** Mode-aware total, in display units. */
export function computeTotalDisplayWeightWithMode(
  mode: WeightEntryMode,
  variation: string | null | undefined,
  rawInput: number,
  ctx: WeightEntryContext,
): number {
  const wSafe = rawInput || 0;

  // Bar-only set: 0 (or blank) on a barbell lift means "just the bar", which is
  // a real warm-up load rather than a zero-weight set.
  //
  // Deliberately narrower than isPlateLoaded(), which also covers exercises
  // with NO variation: a 0-weight warm-up on a custom band or bodyweight move
  // must not silently become 45lb. Requires either an explicit bar variation or
  // that the user has put this exercise in per-side (plate) mode.
  if (!wSafe && (variation === 'Barbell' || variation === 'Trap Bar' || mode === 'perSide')) {
    return barForVariation(variation, ctx);
  }

  if (mode === 'auto') return computeTotalDisplayWeight(variation, rawInput, ctx);
  if (mode === 'total') return wSafe;
  return wSafe * 2 + barForVariation(variation, ctx);
}

/** Mode-aware entry math: user input → stored lbs. */
export function storedWeightFromModeInput(
  mode: WeightEntryMode,
  variation: string | null | undefined,
  rawInput: number,
  ctx: WeightEntryContext,
): number {
  return fromDisplayWeight(computeTotalDisplayWeightWithMode(mode, variation, rawInput, ctx), ctx.unit);
}

/** Mode-aware reverse math for prefilling the input from a stored total. */
export function inputWeightFromStoredWithMode(
  mode: WeightEntryMode,
  variation: string | null | undefined,
  storedLbs: number,
  ctx: WeightEntryContext,
): number {
  if (mode === 'auto') return inputWeightFromStored(variation, storedLbs, ctx.unit);
  const totalDisplay = toDisplayWeight(storedLbs, ctx.unit);
  if (mode === 'total') return totalDisplay;
  const perSide = (totalDisplay - barForVariation(variation, ctx)) / 2;
  return Math.max(0, Math.round(perSide * 10) / 10);
}

/**
 * Quick-pick plate loads per side: 1–4 of the heaviest plate.
 * lbs → 45/90/135/180, kg → 20/40/60/80.
 */
export function plateQuickPicks(unit: Unit): { plates: number; perSide: number }[] {
  const heaviest = PLATE_SIZES[unit][0] ?? 45;
  return [1, 2, 3, 4].map((plates) => ({ plates, perSide: heaviest * plates }));
}

// ---------------------------------------------------------------------------
// Typo guard (sanity check on big jumps)
// ---------------------------------------------------------------------------

export const TYPO_GUARD_THRESHOLD = 0.4;
/** Legacy confirm window for the "big jump" button state (ms). */
export const TYPO_GUARD_CONFIRM_MS = 4000;

/** True when the new weight differs >40% from the last logged working weight. */
export function isBigJump(newWeightLbs: number, lastWeightLbs: number): boolean {
  const pctChange = Math.abs(newWeightLbs - lastWeightLbs) / lastWeightLbs;
  return pctChange > TYPO_GUARD_THRESHOLD;
}

/** Most recent top working (non-warmup, non-assisted, non-drop, weighted) set. */
export function lastLoggedWorkingSet(entries: Entry[], exName: string): LiftSetEntry | undefined {
  return entries
    .filter(
      (e): e is LiftSetEntry =>
        isLiftSet(e) &&
        e.exercise === exName &&
        Boolean(e.weight) &&
        !e.warmupSet &&
        !e.assistedPullup &&
        !e.dropSet,
    )
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() || (b.createdAt || 0) - (a.createdAt || 0),
    )[0];
}

// ---------------------------------------------------------------------------
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

export function volumeInRange(entries: Entry[], start: Date, end: Date): number {
  return entries
    .filter(isVolumeSet)
    .filter((e) => {
      const d = new Date(e.date);
      return d >= start && d <= end;
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
  const thisMonthDays = trainingDates(entries).filter((d) => {
    const dt = new Date(d);
    return dt >= thisStart && dt <= thisEnd;
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

// ---------------------------------------------------------------------------
// Streak + fire tiers (gap-tolerant, counts SESSIONS not days)
// ---------------------------------------------------------------------------

/** Unique sorted training dates. ALL entry kinds count (activities/warmup/core too). */
export function trainingDates(entries: Entry[]): string[] {
  return [...new Set(entries.map((e) => e.date))].sort();
}

export interface Stats {
  totalWorkouts: number;
  thisMonthCount: number;
  streak: number;
}

/** Legacy streak: count back from most recent date, allow gaps up to 4 days between sessions. */
export function computeStats(entries: Entry[], now: Date = new Date()): Stats {
  const dates = trainingDates(entries);
  const totalWorkouts = dates.length;
  const thisMonthCount = dates.filter((d) => {
    const dt = new Date(d);
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  }).length;
  let streak = 0;
  if (dates.length) {
    const sorted = [...dates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    let prev = new Date(sorted[0] as string);
    const daysSinceLast = Math.floor((now.getTime() - prev.getTime()) / 86400000);
    if (daysSinceLast <= 4) {
      streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const cur = new Date(sorted[i] as string);
        const gap = Math.floor((prev.getTime() - cur.getTime()) / 86400000);
        if (gap <= 4) {
          streak++;
          prev = cur;
        } else break;
      }
    }
  }
  return { totalWorkouts, thisMonthCount, streak };
}

export type FireTierLevel = 'seedling' | 'building' | 'heating' | 'fire' | 'crown';

export interface FireTier {
  level: FireTierLevel;
  label: string;
  glow: boolean;
}

/** Legacy fire tiers (icons mapped to lucide in lib/program.ts FIRE_TIER_ICONS). */
export function fireTier(streak: number): FireTier {
  if (streak >= 30) return { level: 'crown', label: 'Unstoppable', glow: true };
  if (streak >= 14) return { level: 'fire', label: 'On fire', glow: true };
  if (streak >= 7) return { level: 'heating', label: 'Heating up', glow: true };
  if (streak >= 3) return { level: 'building', label: 'Building', glow: false };
  return { level: 'seedling', label: 'Getting started', glow: false };
}

// ---------------------------------------------------------------------------
// PR / PB logic
// ---------------------------------------------------------------------------

/**
 * Entry with the max weight among non-warmup entries for an exercise
 * (legacy note: bestFor does NOT exclude assistedPullup — assisted sets are
 * instead prevented from triggering PR toasts at log time).
 */
export function bestFor(entries: Entry[], exName: string): LiftSetEntry | null {
  const rows = entries.filter(
    (e): e is LiftSetEntry => isLiftSet(e) && e.exercise === exName && !e.warmupSet && !e.dropSet,
  );
  if (!rows.length) return null;
  return rows.reduce((a, b) => (b.weight > a.weight ? b : a));
}

/**
 * PR fires for a working (non-warmup), non-assisted, non-bodyweight set with
 * weight > previous best. `prevBestLbs` should come from bestFor() BEFORE the
 * new set is added (0 when no history — first log is a PR).
 */
export function isPR(
  newWeightLbs: number,
  prevBestLbs: number,
  opts: { warmupSet?: boolean; assistedPullup?: boolean; dropSet?: boolean; variation?: string | null },
): boolean {
  const isBodyweightVar = opts.variation === 'Bodyweight' || opts.variation === 'Bodyweight Lunges';
  if (opts.warmupSet || opts.assistedPullup || opts.dropSet || isBodyweightVar) return false;
  return newWeightLbs > prevBestLbs;
}

/** Every chronological new max per exercise counts (first log counts as a PR). */
export function prCountAllTime(entries: Entry[]): number {
  const seen: Record<string, number> = {};
  let count = 0;
  const sorted = entries
    .filter(
      (e): e is LiftSetEntry =>
        isLiftSet(e) && Boolean(e.weight) && !e.warmupSet && !e.assistedPullup && !e.dropSet,
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  sorted.forEach((e) => {
    const prevMax = seen[e.exercise];
    if (prevMax === undefined || e.weight > prevMax) {
      seen[e.exercise] = e.weight;
      count++;
    }
  });
  return count;
}

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------

/** Last 15 entries for an exercise, newest first. */
export function historyFor(entries: Entry[], exName: string): LiftSetEntry[] {
  return entries
    .filter((e): e is LiftSetEntry => isLiftSet(e) && e.exercise === exName)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);
}

/** 1-based working-set number of an entry within its day. */
export function setNumberInDay(entries: Entry[], entry: LiftSetEntry): number {
  const sameDay = entries.filter(
    (e): e is LiftSetEntry => isLiftSet(e) && e.exercise === entry.exercise && e.date === entry.date && !e.warmupSet,
  );
  return sameDay.findIndex((e) => e.id === entry.id) + 1;
}

// ---------------------------------------------------------------------------
// RPE progression ladder
// ---------------------------------------------------------------------------

export const LOWER_BODY_COMPOUNDS = ['Sumo Squats', 'Deadlifts', 'Hip Thrust', 'Leg Press / Lunges'];

export interface ProgressionSuggestion {
  /** Suggested next weight in DISPLAY units. */
  suggestion: number;
  /** Last session's top weight in DISPLAY units. */
  lastWeight: number;
  direction: 'hold' | 'up';
  lastDate: string;
  avgRPE: number | null;
  note: string;
}

/** Legacy suggestedNextWeight — RPE decision ladder, verbatim thresholds and copy. */
export function suggestedNextWeight(
  entries: Entry[],
  ex: Pick<AnyExercise, 'name' | 'targetReps'>,
  unit: Unit,
): ProgressionSuggestion | null {
  const working = entries.filter(
    (e): e is LiftSetEntry =>
      isLiftSet(e) &&
      e.exercise === ex.name &&
      Boolean(e.weight) &&
      !e.warmupSet &&
      !e.assistedPullup &&
      !e.dropSet,
  );
  if (!working.length) return null;
  const lastDate = [...new Set(working.map((e) => e.date))].sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  )[0] as string;
  const lastSets = working.filter((e) => e.date === lastDate);
  const rpeVals = lastSets.map((e) => e.rpe).filter((v): v is number => Boolean(v));
  const avgRPE = rpeVals.length ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : null;
  const targetMin = parseInt(ex.targetReps) || 8;
  const metReps = lastSets.every((e) => e.reps >= targetMin);
  const lastTopWeight = Math.max(...lastSets.map((e) => e.weight));
  const isLowerCompound = LOWER_BODY_COMPOUNDS.includes(ex.name);
  const baseIncrement = unit === 'kg' ? (isLowerCompound ? 5 : 2.5) : isLowerCompound ? 10 : 5;

  let direction: 'hold' | 'up' = 'hold';
  let suggestion = lastTopWeight;
  let note = '';

  if (!metReps) {
    direction = 'hold';
    note = "You didn't hit full reps last time, repeat this weight and nail your reps first.";
  } else if (avgRPE !== null && avgRPE >= 9) {
    direction = 'hold';
    note = 'Last session was tough, repeat this weight and see if it feels a bit easier.';
  } else if (avgRPE !== null && avgRPE <= 6) {
    // Felt easy, big jump, push toward the RPE 7-8 zone faster
    suggestion = lastTopWeight + baseIncrement * 2;
    direction = 'up';
    note = `That felt easy (RPE ${fmtNum(avgRPE)}), pushing a bigger jump than usual.`;
  } else if (avgRPE !== null && avgRPE <= 7.5) {
    suggestion = lastTopWeight + baseIncrement * 1.5;
    direction = 'up';
    note = `Solid session at RPE ${fmtNum(avgRPE)}, still some room, adding a bit more than the standard jump.`;
  } else if (avgRPE !== null) {
    // 7.5-9 range: right in the sweet spot
    suggestion = lastTopWeight + baseIncrement;
    direction = 'up';
    note = `RPE ${fmtNum(avgRPE)} is the sweet spot, standard jump.`;
  } else {
    // no RPE logged, hit reps: moderate default nudge, and prompt for RPE next time
    suggestion = lastTopWeight + baseIncrement * 1.25;
    direction = 'up';
    note = 'Log your RPE next time for a more precise suggestion, using a moderate jump for now.';
  }

  return {
    suggestion: toDisplayWeight(suggestion, unit),
    lastWeight: toDisplayWeight(lastTopWeight, unit),
    direction,
    lastDate,
    avgRPE,
    note,
  };
}

// ---------------------------------------------------------------------------
// Achievements — 25 definitions with thresholds + progress hints
// ---------------------------------------------------------------------------

export interface AchievementSnapshot extends Stats {
  prCount: number;
  crossTraining: number;
  totalVolume: number;
  bwCount: number;
  measureCount: number;
  totalSets: number;
  rpeLoggedCount: number;
}

export type AchievementMetric =
  | 'streak'
  | 'totalWorkouts'
  | 'totalSets'
  | 'prCount'
  | 'crossTraining'
  | 'totalVolume'
  | 'bwCount'
  | 'measureCount'
  | 'rpeLoggedCount';

export interface AchievementDef {
  id: string;
  label: string;
  desc: string;
  metric: AchievementMetric;
  threshold: number;
  check: (s: AchievementSnapshot) => boolean;
}

/** Icons for these ids live in lib/program.ts ACHIEVEMENT_ICONS (lucide). */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-set', label: 'First Rep', desc: 'Log your first set', metric: 'totalWorkouts', threshold: 1, check: (s) => s.totalWorkouts >= 1 },
  { id: 'streak-3', label: '3-Day Streak', desc: 'Train 3 sessions in a row', metric: 'streak', threshold: 3, check: (s) => s.streak >= 3 },
  { id: 'streak-7', label: 'Week Warrior', desc: 'Hit a 7-session streak', metric: 'streak', threshold: 7, check: (s) => s.streak >= 7 },
  { id: 'streak-14', label: 'On Fire', desc: 'Hit a 14-session streak', metric: 'streak', threshold: 14, check: (s) => s.streak >= 14 },
  { id: 'streak-30', label: 'Unstoppable', desc: 'Hit a 30-session streak', metric: 'streak', threshold: 30, check: (s) => s.streak >= 30 },
  { id: 'streak-60', label: 'Legendary', desc: 'Hit a 60-session streak', metric: 'streak', threshold: 60, check: (s) => s.streak >= 60 },
  { id: 'workouts-10', label: 'Regular', desc: 'Log 10 total sessions', metric: 'totalWorkouts', threshold: 10, check: (s) => s.totalWorkouts >= 10 },
  { id: 'workouts-25', label: 'Committed', desc: 'Log 25 total sessions', metric: 'totalWorkouts', threshold: 25, check: (s) => s.totalWorkouts >= 25 },
  { id: 'workouts-50', label: 'Half Century', desc: 'Log 50 total sessions', metric: 'totalWorkouts', threshold: 50, check: (s) => s.totalWorkouts >= 50 },
  { id: 'workouts-100', label: 'Centurion', desc: 'Log 100 total sessions', metric: 'totalWorkouts', threshold: 100, check: (s) => s.totalWorkouts >= 100 },
  { id: 'sets-100', label: 'Century Club', desc: 'Log 100 total working sets', metric: 'totalSets', threshold: 100, check: (s) => s.totalSets >= 100 },
  { id: 'sets-500', label: 'Set Machine', desc: 'Log 500 total working sets', metric: 'totalSets', threshold: 500, check: (s) => s.totalSets >= 500 },
  { id: 'first-pr', label: 'First PR', desc: 'Beat a previous best weight', metric: 'prCount', threshold: 1, check: (s) => s.prCount >= 1 },
  { id: 'pr-5', label: 'PR Machine', desc: 'Rack up 5 PRs across lifts', metric: 'prCount', threshold: 5, check: (s) => s.prCount >= 5 },
  { id: 'pr-15', label: 'Serial PR-er', desc: 'Rack up 15 PRs across lifts', metric: 'prCount', threshold: 15, check: (s) => s.prCount >= 15 },
  { id: 'cross-train', label: 'Well Rounded', desc: 'Log a Pilates or volleyball day', metric: 'crossTraining', threshold: 1, check: (s) => s.crossTraining >= 1 },
  { id: 'cross-train-10', label: 'Cross-Trainer', desc: 'Log 10 Pilates/volleyball days', metric: 'crossTraining', threshold: 10, check: (s) => s.crossTraining >= 10 },
  { id: 'volume-10k', label: 'Ten Thousand Club', desc: 'Lift 10,000lbs total volume', metric: 'totalVolume', threshold: 10000, check: (s) => s.totalVolume >= 10000 },
  { id: 'volume-50k', label: 'Fifty Thousand Club', desc: 'Lift 50,000lbs total volume', metric: 'totalVolume', threshold: 50000, check: (s) => s.totalVolume >= 50000 },
  { id: 'volume-100k', label: 'Six Figures', desc: 'Lift 100,000lbs total volume', metric: 'totalVolume', threshold: 100000, check: (s) => s.totalVolume >= 100000 },
  { id: 'bodyweight-log', label: 'Checking In', desc: 'Log your bodyweight for the first time', metric: 'bwCount', threshold: 1, check: (s) => s.bwCount >= 1 },
  { id: 'bodyweight-10', label: 'Data Nerd', desc: 'Log your bodyweight 10 times', metric: 'bwCount', threshold: 10, check: (s) => s.bwCount >= 10 },
  { id: 'measure-log', label: 'Taking Measurements', desc: 'Log a body measurement for the first time', metric: 'measureCount', threshold: 1, check: (s) => s.measureCount >= 1 },
  { id: 'rpe-20', label: 'Dialed In', desc: 'Log RPE on 20 sets', metric: 'rpeLoggedCount', threshold: 20, check: (s) => s.rpeLoggedCount >= 20 },
  { id: 'rpe-100', label: 'RPE Master', desc: 'Log RPE on 100 sets', metric: 'rpeLoggedCount', threshold: 100, check: (s) => s.rpeLoggedCount >= 100 },
];

/** Pilates/Volleyball day count. */
export function crossTrainingCount(entries: Entry[]): number {
  return entries.filter((e) => 'type' in e && e.type === 'activity').length;
}

export function achievementStatsSnapshot(
  entries: Entry[],
  bwEntries: BodyweightEntry[],
  measurements: MeasurementEntry[],
  now: Date = new Date(),
): AchievementSnapshot {
  const s = computeStats(entries, now);
  const totalSets = entries.filter((e) => isLiftSet(e) && !e.warmupSet).length;
  const rpeLoggedCount = entries.filter((e) => isLiftSet(e) && e.rpe).length;
  return {
    ...s,
    prCount: prCountAllTime(entries),
    crossTraining: crossTrainingCount(entries),
    totalVolume: totalVolumeAllTime(entries),
    bwCount: bwEntries.length,
    measureCount: measurements.length,
    totalSets,
    rpeLoggedCount,
  };
}

/** Legacy progress hint, e.g. "3 more sessions". Empty string when already unlocked. */
export function achievementProgressHint(a: AchievementDef, snap: AchievementSnapshot, unit: Unit): string {
  if (!a.metric) return '';
  const current = snap[a.metric] || 0;
  const remaining = a.threshold - current;
  if (remaining <= 0) return '';
  const displayRemaining = a.metric === 'totalVolume' ? Math.round(toDisplayWeight(remaining, unit)) : remaining;
  if (displayRemaining <= 0) return 'Almost there, just a bit more';
  const isSingular = displayRemaining === 1;
  const unitMap: Record<AchievementMetric, string> = {
    streak: isSingular ? 'more session' : 'more sessions',
    totalWorkouts: isSingular ? 'more session' : 'more sessions',
    totalSets: isSingular ? 'more set' : 'more sets',
    prCount: isSingular ? 'more PR' : 'more PRs',
    crossTraining: isSingular ? 'more cross-training day' : 'more cross-training days',
    totalVolume: `more ${unit} lifted`,
    bwCount: isSingular ? 'more weigh-in' : 'more weigh-ins',
    measureCount: isSingular ? 'more measurement' : 'more measurements',
    rpeLoggedCount: isSingular ? 'more RPE-logged set' : 'more RPE-logged sets',
  };
  return `${displayRemaining} ${unitMap[a.metric] || 'to go'}`;
}

export type DayPlanKind = 'training' | 'recovery' | 'rest';

/**
 * What kind of day the plan describes, for the Today hero.
 *
 * Derived rather than stored: a day that points at a real lifting tab is a
 * training day, a day with nothing scheduled is rest, and everything else
 * (volleyball, Pilates) is active recovery. Typed structurally so this stays
 * in domain.ts without importing the program data it describes.
 */
export function dayPlanKind(plan: { label: string; tab: string | null }, liftingTabs: string[]): DayPlanKind {
  if (plan.tab && liftingTabs.includes(plan.tab)) return 'training';
  if (/rest/i.test(plan.label)) return 'rest';
  return 'recovery';
}

export interface AchievementProgress {
  /** Capped at the threshold — a locked card never shows more than its target. */
  current: number;
  threshold: number;
  /** 0-100, for the track fill. */
  pct: number;
}

/**
 * How far along an achievement is, as numbers rather than the prose hint.
 *
 * Every definition already carries the metric it counts and the threshold it
 * needs, and the snapshot holds the live value, so "39 / 60" needs no data the
 * app was not already computing.
 */
export function achievementProgress(a: AchievementDef, snap: AchievementSnapshot): AchievementProgress {
  const threshold = a.threshold;
  const raw = snap[a.metric] || 0;
  const current = Math.max(0, Math.min(raw, threshold));
  return {
    current,
    threshold,
    pct: threshold > 0 ? Math.round((current / threshold) * 100) : 0,
  };
}

/** Short noun for a progress track, e.g. "39 / 60 sessions". */
export const ACHIEVEMENT_METRIC_NOUN: Record<AchievementMetric, string> = {
  streak: 'sessions',
  totalWorkouts: 'sessions',
  totalSets: 'sets',
  prCount: 'PRs',
  crossTraining: 'days',
  totalVolume: '',
  bwCount: 'weigh-ins',
  measureCount: 'measurements',
  rpeLoggedCount: 'sets',
};

/** Definitions that pass their check but aren't in `seen` yet. */
export function newlyUnlockedAchievements(snap: AchievementSnapshot, seen: string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.check(snap) && !seen.includes(a.id));
}

// ---------------------------------------------------------------------------
// Plate calculator (greedy, per side)
// ---------------------------------------------------------------------------

export const PLATE_SIZES: Record<Unit, number[]> = {
  lbs: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/** Bar options offered by the legacy Plates tab (display units). */
export const BAR_OPTIONS: Record<Unit, number[]> = {
  lbs: [45, 35, 15, 0],
  kg: [20, 15, 10, 0],
};

export interface PlateBreakdown {
  perSide: number;
  plates: number[];
  /** Rounded shortfall per side when the target can't be hit exactly. */
  leftover: number;
}

/** Greedy per-side breakdown. Returns null when target is missing or ≤ bar weight. */
export function plateCalculator(target: number, bar: number, unit: Unit): PlateBreakdown | null {
  if (!target || target <= bar) return null;
  let perSide = (target - bar) / 2;
  if (perSide < 0) perSide = 0;
  const used: number[] = [];
  let remaining = perSide;
  PLATE_SIZES[unit].forEach((p) => {
    while (remaining >= p - 0.001) {
      used.push(p);
      remaining -= p;
    }
  });
  const leftover = Math.round(remaining * 100) / 100;
  return { perSide, plates: used, leftover };
}

// ---------------------------------------------------------------------------
// Misc business logic
// ---------------------------------------------------------------------------

/** Whole weeks since the last program review (0 when never reviewed). ≥6 triggers the nudge. */
export function weeksSinceReview(lastProgramReviewAt: string | null, now: Date = new Date()): number {
  if (!lastProgramReviewAt) return 0;
  const days = Math.floor((now.getTime() - new Date(lastProgramReviewAt).getTime()) / 86400000);
  return Math.floor(days / 7);
}

/** Weeks threshold for the program-review nudge. */
export const PROGRAM_REVIEW_NUDGE_WEEKS = 6;

/** Legacy hardcoded bodyweight goal (lbs) — surfaced as a constant for the rebuild. */
export const BODYWEIGHT_GOAL_LBS = 120;

/** Rest timer auto-start duration after logging a set (seconds, today only). */
export const REST_TIMER_AUTO_START_SECONDS = 90;
/** Rest timer presets (seconds). */
export const REST_TIMER_PRESETS = [60, 90, 120];
/** Double-tap guard on the log button (ms). */
export const LOG_LOCK_MS = 800;

/** Merge-by-id (import): incoming wins on id conflicts, nothing is deleted. */
export function mergeById<T extends { id?: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map((e) => [e.id, e]));
  incoming.forEach((e) => map.set(e.id, e));
  return [...map.values()];
}

/** Effective exercise list for a day: built-ins minus excluded, plus non-archived customs. */
export function exercisesForDay(
  day: string,
  days: Record<string, ProgramExerciseLike[]>,
  customExercises: Record<string, CustomExerciseLike[]>,
  excludedBuiltIns: Record<string, string[]>,
  /** Saved display order (gymlog:exerciseOrder). Names not listed keep their natural position, after the ordered ones. */
  order?: string[],
): AnyExercise[] {
  const excluded = excludedBuiltIns[day] || [];
  const builtIn = (days[day] || []).filter((ex) => !excluded.includes(ex.name));
  const custom = (customExercises[day] || []).filter((c) => c.archived !== true);
  const list = [...builtIn, ...custom] as AnyExercise[];
  if (!order || order.length === 0) return list;
  const rank = new Map(order.map((name, i) => [name, i]));
  return [...list].sort((a, b) => {
    const ra = rank.get(a.name);
    const rb = rank.get(b.name);
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}
type ProgramExerciseLike = AnyExercise;
type CustomExerciseLike = AnyExercise & { archived?: boolean };

/** Goal weight for an exercise: custom goal overrides the built-in default. */
export function goalFor(ex: Pick<AnyExercise, 'name' | 'goal'>, customGoals: GoalsMap): number {
  return customGoals[ex.name] || ex.goal;
}
