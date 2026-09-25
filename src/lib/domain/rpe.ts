/**
 * The RPE-aware progression ladder.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { AnyExercise, Entry, LiftSetEntry, Unit } from '../types';
import { isLiftSet } from '../types';
import { fmtNum } from './format';
import { toDisplayWeight } from './units';

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
