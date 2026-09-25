/**
 * Personal-record and personal-best logic.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { Entry, LiftSetEntry } from '../types';
import { isLiftSet } from '../types';

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
export interface PersonalRecord {
  exercise: string;
  /** STORED lbs — format with fmtStoredWeight. */
  weight: number;
  reps: number;
  date: string;
  variation?: string;
  /** Gain over the previous best for this lift; 0 for a first-ever log. */
  gain: number;
}

/**
 * Every PR you have ever hit, newest first.
 *
 * A PR is a working set heavier than anything logged for that exercise before
 * it, so the first log of a lift counts. Filtered exactly like `isPR`: warm-up,
 * assisted and drop sets are not records, and bodyweight variations are
 * excluded because their "weight" is not a load you chose.
 *
 * Chronological by necessity — a PR is defined against what came before, so the
 * walk must go oldest-first even though the result reads newest-first.
 */
export function prHistory(entries: Entry[]): PersonalRecord[] {
  const best: Record<string, number> = {};
  const out: PersonalRecord[] = [];
  const sorted = entries
    .filter(
      (e): e is LiftSetEntry =>
        isLiftSet(e) &&
        Boolean(e.weight) &&
        !e.warmupSet &&
        !e.assistedPullup &&
        !e.dropSet &&
        e.variation !== 'Bodyweight' &&
        e.variation !== 'Bodyweight Lunges',
    )
    .sort((a, b) => {
      const byDate = new Date(a.date).getTime() - new Date(b.date).getTime();
      // Two PRs on one day resolve by log order, so the lighter one lands first.
      return byDate !== 0 ? byDate : (a.createdAt ?? 0) - (b.createdAt ?? 0);
    });

  for (const e of sorted) {
    const prev = best[e.exercise];
    if (prev !== undefined && e.weight <= prev) continue;
    best[e.exercise] = e.weight;
    out.push({
      exercise: e.exercise,
      weight: e.weight,
      reps: e.reps,
      date: e.date,
      ...(e.variation ? { variation: e.variation } : {}),
      gain: prev === undefined ? 0 : e.weight - prev,
    });
  }
  return out.reverse();
}

/**
 * Count of the above. Delegates so the number and the list can never disagree —
 * they were separate walks with subtly different filters before.
 */
export function prCountAllTime(entries: Entry[]): number {
  return prHistory(entries).length;
}
