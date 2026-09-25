/**
 * Muscle recovery and weekly volume balance, over a ROLLING 7-day window.
 *
 * Rolling, not calendar. `weekRange` in domain.ts answers "this week vs last
 * week" for the recap, which is the right shape for a comparison but the wrong
 * one for a training decision: on a calendar week every Monday reads as a
 * deload, and everything you did on Sunday stops counting overnight. What
 * matters for "have I trained chest enough lately" is the last seven days from
 * right now, so that is what this measures.
 *
 * WHAT COUNTS. Sets where the muscle is the PRIMARY mover, which is how the
 * 10-20 sets/week guidance is defined and how `muscleVolumeSummary` already
 * counts. Secondary involvement is carried separately (`secondarySets`) and
 * shown as context, never added to the benchmark — counting a deadlift's
 * hamstring involvement as a hamstring set would push nearly every muscle into
 * "optimal" on compound carryover alone.
 *
 * WHICH SETS. `isVolumeSet`, the same filter as every other volume number here:
 * warm-ups and assisted reps are out, drop sets are IN. A set-count benchmark
 * makes that inclusion more visible than a volume total does — three drops off
 * one top set read as three sets — but using a different filter would put this
 * view in open disagreement with the Muscle volume chart on the same page.
 *
 * WHAT IT REFUSES TO DO. Every logged set that cannot be attributed to a muscle
 * is returned in `unmatched`, never silently dropped. The library refuses to
 * guess on an ambiguous name, so real custom exercises miss — and a muscle
 * reported as untrained on the day you trained it would send you back to it.
 * An unattributed set is a visible gap in this model, not a zero.
 */
import { isVolumeSet } from '@/lib/domain';
// Aliased: `daysSince` is also the name of a per-row field below.
import { daysSince as daysSinceIso, startOfDay } from '@/lib/dates';
import { MUSCLE_GROUPS } from '@/lib/types';
import type { Entry, MuscleGroup, MuscleMap } from '@/lib/types';
import type { MuscleLookup } from './chartData';
import type { ResolvedMuscle } from './muscleResolve';

/** Days in the rolling window. Seven because the benchmarks are per week. */
export const BALANCE_WINDOW_DAYS = 7;

/**
 * Weekly working-set benchmarks, counting PRIMARY-mover sets only.
 *
 * 10-20 is the range most commonly cited from the hypertrophy literature
 * (Schoenfeld and colleagues' dose-response work, and the MEV/MRV framing that
 * followed it). It is POPULATION guidance for trained lifters, not a
 * personalised prescription, and it deliberately does not vary by muscle here:
 * per-muscle ranges are defensible but the specific numbers are more arguable
 * than the evidence supports, so one honest range beats seventeen invented
 * ones. Change these two numbers, not the call sites.
 */
export const WEEKLY_SETS_MIN = 10;
export const WEEKLY_SETS_MAX = 20;

/** How stale "fresh" is. Below this a muscle is still inside typical recovery. */
export const RECOVERED_AFTER_DAYS = 3;

/** Volume verdict against the benchmark. */
export type VolumeStatus = 'untrained' | 'under' | 'optimal' | 'over';

/** Recovery verdict from time elapsed since the muscle was last a primary mover. */
export type RecoveryStatus = 'never' | 'worked-today' | 'recovering' | 'fresh';

export interface MuscleBalanceRow {
  muscle: MuscleGroup;
  /** Sets in the window where this muscle was the primary mover. */
  primarySets: number;
  /** Sets where it assisted. Context only — never counted toward the benchmark. */
  secondarySets: number;
  /** Whole days since the last PRIMARY set, or null if never. */
  daysSince: number | null;
  volume: VolumeStatus;
  recovery: RecoveryStatus;
}

export interface UnmatchedExercise {
  exercise: string;
  /** Sets logged in the window that reached no muscle. */
  sets: number;
}

/**
 * An exercise the library could not name, attributed by the tiered resolver.
 *
 * Reported separately from the silent path ON PURPOSE. These sets DO count —
 * leaving them out would under-report the very thing the user is reading — but
 * an inference the user cannot see is an inference they cannot correct, so the
 * caller is expected to show `basis`/`evidence` and offer an override.
 */
export interface AutoMatchedExercise extends UnmatchedExercise {
  muscle: MuscleGroup;
  basis: ResolvedMuscle['basis'];
  evidence: string;
}

export interface MuscleBalance {
  rows: MuscleBalanceRow[];
  /** Exercises in the window that resolve to nothing, most sets first. */
  unmatched: UnmatchedExercise[];
  /** Exercises attributed by inference rather than by name. Show these. */
  autoMatched: AutoMatchedExercise[];
  /** Every set in the window that reached at least one muscle. */
  attributedSets: number;
  /** Every set in the window that reached none. The honesty number. */
  unattributedSets: number;
}

function volumeStatus(primarySets: number): VolumeStatus {
  if (primarySets === 0) return 'untrained';
  if (primarySets < WEEKLY_SETS_MIN) return 'under';
  if (primarySets > WEEKLY_SETS_MAX) return 'over';
  return 'optimal';
}

function recoveryStatus(daysSince: number | null): RecoveryStatus {
  if (daysSince === null) return 'never';
  if (daysSince === 0) return 'worked-today';
  return daysSince >= RECOVERED_AFTER_DAYS ? 'fresh' : 'recovering';
}

/**
 * The muscles a logged exercise works, preferring the user's own mapping.
 *
 * The override wins over the library on purpose: it is the more specific
 * statement, and it is the only way a user can correct a wrong resolution. It
 * names a PRIMARY muscle only — asking someone to enumerate secondary movers is
 * asking them to do anatomy homework to fix a display bug.
 */
function targetsFor(
  exercise: string,
  lookup: MuscleLookup,
  muscleMap: MuscleMap,
  resolve?: MuscleResolver,
): { primary: string[]; secondary: string[]; inferred?: ResolvedMuscle } | undefined {
  const override = muscleMap[exercise];
  if (override) return { primary: [override], secondary: [] };
  const direct = lookup(exercise);
  if (direct) return direct;
  /*
   * Last, and only last: the library said nothing, so an inference beats a
   * silent zero. It is tagged `inferred` so the caller can surface it.
   */
  const guess = resolve?.(exercise);
  return guess ? { primary: [guess.muscle], secondary: [], inferred: guess } : undefined;
}

/** Supplied by the caller so this file never reaches for the 1.2 MB library. */
export type MuscleResolver = (exerciseName: string) => ResolvedMuscle | undefined;

/**
 * Per-muscle balance over the last `BALANCE_WINDOW_DAYS` days.
 *
 * Every one of the 17 groups is returned, including those never trained, so the
 * caller can tell "you have no exercise for this" apart from "you are behind on
 * this" — with the built-in 9-exercise program, nine groups are never a primary
 * mover, and silently omitting them would hide exactly that fact.
 */
export function muscleBalance(
  entries: Entry[],
  lookup: MuscleLookup,
  muscleMap: MuscleMap = {},
  now: Date = new Date(),
  resolve?: MuscleResolver,
): MuscleBalance {
  const cutoff = startOfDay(now);
  cutoff.setDate(cutoff.getDate() - (BALANCE_WINDOW_DAYS - 1));

  const primarySets = new Map<string, number>();
  const secondarySets = new Map<string, number>();
  const lastPrimary = new Map<string, string>();
  const unmatched = new Map<string, number>();
  const auto = new Map<string, AutoMatchedExercise>();
  let attributedSets = 0;
  let unattributedSets = 0;

  for (const entry of entries) {
    if (!isVolumeSet(entry)) continue;
    if (daysSinceIso(entry.date, now) >= BALANCE_WINDOW_DAYS) continue;

    /*
     * `sets` is almost always 1 (this app logs set by set), but legacy rows
     * carry a multiplier — 3x12 is three sets, and counting it as one would
     * under-report a migrated user's whole history against the benchmark.
     */
    const count = Math.max(1, Math.trunc(entry.sets ?? 1));
    const target = targetsFor(entry.exercise, lookup, muscleMap, resolve);

    if (!target || (!target.primary.length && !target.secondary.length)) {
      unmatched.set(entry.exercise, (unmatched.get(entry.exercise) ?? 0) + count);
      unattributedSets += count;
      continue;
    }

    attributedSets += count;
    if (target.inferred) {
      const existing = auto.get(entry.exercise);
      auto.set(entry.exercise, {
        exercise: entry.exercise,
        sets: (existing?.sets ?? 0) + count,
        muscle: target.inferred.muscle,
        basis: target.inferred.basis,
        evidence: target.inferred.evidence,
      });
    }
    for (const muscle of target.primary) {
      primarySets.set(muscle, (primarySets.get(muscle) ?? 0) + count);
      const previous = lastPrimary.get(muscle);
      if (!previous || entry.date > previous) lastPrimary.set(muscle, entry.date);
    }
    for (const muscle of target.secondary) {
      secondarySets.set(muscle, (secondarySets.get(muscle) ?? 0) + count);
    }
  }

  const rows: MuscleBalanceRow[] = MUSCLE_GROUPS.map((muscle) => {
    const last = lastPrimary.get(muscle);
    const daysSince = last === undefined ? null : daysSinceIso(last, now);
    const sets = primarySets.get(muscle) ?? 0;
    return {
      muscle,
      primarySets: sets,
      secondarySets: secondarySets.get(muscle) ?? 0,
      daysSince,
      volume: volumeStatus(sets),
      recovery: recoveryStatus(daysSince),
    };
  });

  return {
    rows,
    unmatched: [...unmatched.entries()]
      .map(([exercise, sets]) => ({ exercise, sets }))
      .sort((a, b) => b.sets - a.sets || a.exercise.localeCompare(b.exercise)),
    autoMatched: [...auto.values()].sort(
      (a, b) => b.sets - a.sets || a.exercise.localeCompare(b.exercise),
    ),
    attributedSets,
    unattributedSets,
  };
}

/**
 * Muscles worth training next: trained least, and recovered enough to train.
 *
 * Excludes anything worked today — the point is what to add, not what to
 * repeat — and anything already over the top of the range. `untrained` muscles
 * sort first because zero is the biggest gap there is.
 */
export function underworkedMuscles(balance: MuscleBalance): MuscleBalanceRow[] {
  return balance.rows
    .filter((r) => r.volume === 'untrained' || r.volume === 'under')
    .filter((r) => r.recovery !== 'worked-today')
    .sort((a, b) => a.primarySets - b.primarySets || a.muscle.localeCompare(b.muscle));
}

/**
 * Equipment the user demonstrably has, derived from what they have logged.
 *
 * Suggesting a Machine exercise to someone whose whole history is barbell and
 * bodyweight is a suggestion they cannot act on. The library carries no
 * ownership data, so the only honest source is their own training.
 */
export function familiarEquipment(
  entries: Entry[],
  equipmentOf: (exerciseName: string) => string | undefined,
): Set<string> {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!isVolumeSet(entry)) continue;
    const equipment = equipmentOf(entry.exercise);
    if (equipment) seen.add(equipment);
  }
  return seen;
}

/** The fields `rankSuggestions` needs. Keeps it testable without the 1.2 MB library. */
export interface RankableExercise {
  name: string;
  equipment: string;
  level: string;
  secondary_muscles: string[];
}

/**
 * Order candidate exercises for the suggestion drawer.
 *
 * Ranked, in order: equipment the user already trains with, then compound
 * movements (more assisting muscles = more work per set, which is the point
 * when you are behind), then beginner-friendly, then name. The last tiebreak is
 * alphabetical only because something has to be last — when it was the FIRST
 * ordering the drawer opened on "3/4 Sit-Up", "Air Bike" and "Alternate Heel
 * Touchers", which is the alphabet talking, not a recommendation.
 */
export function rankSuggestions<T extends RankableExercise>(options: T[], familiar: Set<string>): T[] {
  return [...options].sort(
    (a, b) =>
      Number(familiar.has(b.equipment)) - Number(familiar.has(a.equipment)) ||
      b.secondary_muscles.length - a.secondary_muscles.length ||
      Number(b.level === 'beginner') - Number(a.level === 'beginner') ||
      a.name.localeCompare(b.name),
  );
}

/**
 * The muscles your CURRENT program can train, as primary movers.
 *
 * Exists because "zero sets this week" and "nothing you do trains this" are
 * different facts, and the tab asserted the second from the first. Open the
 * Recovery tab after a week off and every one of the 17 groups had zero sets,
 * so all 17 were filed under "Not in your program" — including Chest and
 * Quadriceps, which the program trains twice a week. The window says what you
 * did; only the program says what you COULD do.
 *
 * Takes the resolved exercise names rather than the stores so it stays pure.
 */
export function programMuscles(
  exerciseNames: string[],
  lookup: MuscleLookup,
  muscleMap: MuscleMap = {},
  resolve?: MuscleResolver,
): Set<string> {
  const muscles = new Set<string>();
  for (const name of exerciseNames) {
    const target = targetsFor(name, lookup, muscleMap, resolve);
    for (const muscle of target?.primary ?? []) muscles.add(muscle);
  }
  return muscles;
}
