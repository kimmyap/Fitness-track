/**
 * Business logic that has not earned a module of its own yet.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { AnyExercise, GoalsMap } from '../types';

// Misc business logic
// ---------------------------------------------------------------------------
import { daysSince, parseIsoDate } from '../dates';

/** Whole weeks since the last program review (0 when never reviewed). ≥6 triggers the nudge. */
export function weeksSinceReview(lastProgramReviewAt: string | null, now: Date = new Date()): number {
  if (!lastProgramReviewAt) return 0;
  // `daysSince` compares local day starts; the old form subtracted a UTC
  // midnight from a local instant, which is a whole day out at the edges.
  return Math.floor(daysSince(lastProgramReviewAt, now) / 7);
}

/** Weeks threshold for the program-review nudge. */
export const PROGRAM_REVIEW_NUDGE_WEEKS = 6;

/**
 * Days since the last backup EXPORT, or null when there has never been one.
 *
 * Null and 0 mean opposite things and the caller must not conflate them: null
 * is "this device has never exported", which is the worst state and the one
 * worth shouting about, while 0 is "exported today".
 */
export function daysSinceBackup(lastBackupAt: string | null, now: Date = new Date()): number | null {
  if (!lastBackupAt) return null;
  /*
   * The null check stays ahead of the arithmetic: null and 0 mean opposite
   * things here, and `daysSince` returns 0 for an unparseable string, which
   * would turn "this file is corrupt" into "exported today".
   */
  if (parseIsoDate(lastBackupAt) === null) return null;
  // Already clamped at 0 by `daysSince`, so a clock set backwards reads as
  // "just now" rather than as a negative age that would hide the nudge.
  return daysSince(lastBackupAt, now);
}

/**
 * Days before the backup nudge turns from a note into a warning.
 *
 * Fourteen, not the six WEEKS the program-review nudge uses: that one asks you
 * to reconsider a plan, and being late costs a slightly stale program. This one
 * is the only thing standing between a cleared browser and losing everything,
 * and at roughly three sessions a week a fortnight is about six sessions of
 * history — enough to hurt, short enough that the warning is not constant.
 */
export const BACKUP_NUDGE_DAYS = 14;

/** Whether the backup is old enough, or absent, to warrant a warning. */
export function backupIsStale(days: number | null): boolean {
  return days === null || days >= BACKUP_NUDGE_DAYS;
}

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
