/**
 * Stall detection and the warm-up ramp.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { Entry, LiftSetEntry } from '../types';
import { isLiftSet } from '../types';
import { PLATE_SIZES } from './units';
import type { WeightEntryContext } from './weight';
import { barForVariation, isPlateLoaded } from './weight';

export interface StallReport {
  /** Consecutive sessions at this weight with no improvement. Always >= 3. */
  sessions: number;
  /** The stuck top working weight, in STORED lbs (format with fmtStoredWeight). */
  weight: number;
  /** Date of the earliest session in the run, "YYYY-MM-DD". */
  since: string;
  /**
   * Which way EFFORT moved across the run, oldest session to newest.
   *
   * The same stuck weight means opposite things depending on this: falling
   * effort says the load has stopped being a stimulus (add weight), rising
   * effort says fatigue is accumulating (deload). `null` when the run does not
   * carry enough RPE to tell, which is the common case and reads as the plain
   * "stuck" notice rather than a guess.
   */
  trend: StallTrend;
  /** Mean RPE of the top-weight sets in the OLDEST session of the run. */
  rpeFrom: number | null;
  /** Same for the NEWEST. Both are null exactly when `trend` is null. */
  rpeTo: number | null;
}

export type StallTrend = 'easier' | 'harder' | 'flat' | null;

/** Sessions at one weight before it counts as stuck rather than deliberate. */
export const STALL_MIN_SESSIONS = 3;

/**
 * RPE movement across the run before it counts as a direction.
 *
 * A FULL point, because RPE is typed as an integer in practice — the input is
 * whole-numbered and the pills offer 6-10. Treating 7.5 vs 8 as a trend would
 * read noise as a verdict, and the verdict here tells you to change the weight.
 */
export const STALL_RPE_DELTA = 1;

/**
 * Whether an exercise has stopped moving.
 *
 * `suggestedNextWeight` reads only the MOST RECENT session, so it can say
 * "repeat this weight" but never "this is the fourth session at 135". This
 * looks across sessions and is the signal for a deload or a swap.
 *
 * Two definitional choices, both load-bearing:
 *
 * 1. THREE sessions, not two. The suggestion already tells you to repeat a
 *    weight after a missed rep target or RPE >= 9, so a second session at the
 *    same load is the app's own advice being followed. Flagging it would
 *    contradict the box directly above it on the card.
 *
 * 2. REPS COUNT AS PROGRESS. 135x8 -> 135x9 -> 135x10 is double progression,
 *    textbook and healthy. A weight-only check calls that stuck, and that
 *    false positive is the fastest way to make the feature ignorable — so an
 *    improvement in reps at the same weight across the run clears it.
 *
 * Consecutive SESSIONS, not calendar days: a fortnight between sessions is a
 * gap, not a stall. A run ends at the first session on a different weight, so
 * a deload and return reads as two short runs rather than one long one.
 *
 * `targetReps` is what stops the RPE verdict contradicting the suggestion box
 * rendered directly beneath this on the card. See the `trend` computation.
 */
export function detectStall(
  entries: Entry[],
  exName: string,
  targetReps?: string,
): StallReport | null {
  const working = entries.filter(
    (e): e is LiftSetEntry =>
      isLiftSet(e) &&
      e.exercise === exName &&
      Boolean(e.weight) &&
      !e.warmupSet &&
      !e.assistedPullup &&
      !e.dropSet,
  );
  if (!working.length) return null;

  // One row per session, newest first: its top weight and the best reps at it.
  const byDate = new Map<string, LiftSetEntry[]>();
  for (const row of working) {
    const list = byDate.get(row.date);
    if (list) list.push(row);
    else byDate.set(row.date, [row]);
  }
  const sessions = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, rows]) => {
      const top = Math.max(...rows.map((r) => r.weight));
      const atTop = rows.filter((r) => r.weight === top);
      // Effort at the TOP weight only: an RPE 6 back-off set would otherwise
      // drag the session's mean down and read as the lift getting easier.
      const rpes = atTop.map((r) => r.rpe).filter((v): v is number => Boolean(v));
      return {
        date,
        top,
        reps: Math.max(...atTop.map((r) => r.reps)),
        minReps: Math.min(...atTop.map((r) => r.reps)),
        rpe: rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null,
      };
    });

  const target = sessions[0]?.top;
  if (target === undefined) return null;
  const run = [];
  for (const session of sessions) {
    if (session.top !== target) break;
    run.push(session);
  }
  if (run.length < STALL_MIN_SESSIONS) return null;

  const newest = run[0];
  const oldest = run[run.length - 1];
  if (!newest || !oldest) return null;
  if (newest.reps > oldest.reps) return null; // reps are still climbing — working as intended

  return {
    sessions: run.length,
    weight: target,
    since: oldest.date,
    ...stallTrend(newest, oldest, targetReps),
  };
}

/**
 * The effort verdict, and the two reasons it stays silent.
 *
 * 1. BOTH ends of the run need an RPE. Comparing a session that has one
 *    against a session that does not is comparing a number to an assumption,
 *    and the output of this tells you to change the weight on the bar.
 *
 * 2. `easier` additionally needs the NEWEST session to have met its rep
 *    target. `suggestedNextWeight` holds the weight when you missed reps
 *    ("nail your reps first"), and it renders directly BELOW this notice —
 *    without the gate, stopping a set early at a low RPE produces "add
 *    weight" stacked on top of "nail your reps first" on the same card.
 *    The other hold it issues, RPE >= 9, cannot collide: `easier` needs the
 *    newest RPE a full point BELOW the oldest, so both would require oldest
 *    10 and newest 9, and at that point the effort really is dropping.
 */
function stallTrend(
  newest: { rpe: number | null; minReps: number },
  oldest: { rpe: number | null },
  targetReps?: string,
): Pick<StallReport, 'trend' | 'rpeFrom' | 'rpeTo'> {
  const from = oldest.rpe;
  const to = newest.rpe;
  if (from === null || to === null) return { trend: null, rpeFrom: null, rpeTo: null };

  const delta = to - from;
  let trend: StallTrend = 'flat';
  if (delta <= -STALL_RPE_DELTA) trend = 'easier';
  else if (delta >= STALL_RPE_DELTA) trend = 'harder';

  if (trend === 'easier') {
    const targetMin = parseInt(targetReps ?? '') || 0;
    if (targetMin && newest.minReps < targetMin) trend = 'flat';
  }
  return { trend, rpeFrom: from, rpeTo: to };
}

export interface WarmupRampSet {
  /** TOTAL weight in display units, always loadable with the bar + PLATE_SIZES. */
  weight: number;
  reps: number;
}

/** Fractions of the working weight, with the reps each is done for. */
const WARMUP_RAMP_STEPS: { pct: number; reps: number }[] = [
  { pct: 0.4, reps: 5 },
  { pct: 0.6, reps: 3 },
  { pct: 0.8, reps: 2 },
];

/**
 * Warm-up sets ramping to a working weight, rounded DOWN to loadable weights.
 *
 * Rounds down rather than to nearest on purpose: PLATE_SIZES bottoms out at a
 * 2.5 pair (5 lb steps; 2.5 kg in metric), so an un-rounded 40% of 135 is
 * 54 lb — a number you cannot load. A warm-up a notch light costs nothing; one
 * a notch heavy costs a rep off the working set.
 *
 * The ramp COLLAPSES rather than padding: steps at or below the bar, duplicates
 * after rounding, and anything reaching the working weight are dropped. Warming
 * up to 95 lb yields two rows, to 65 lb yields one. That is the correct answer,
 * not a truncated one.
 *
 * Returns [] for anything not plate-loaded — dumbbells, cables and machines do
 * not ramp on a bar, and inventing rows for them would be noise.
 */
export function warmupRamp(
  targetTotal: number,
  variation: string | null | undefined,
  ctx: WeightEntryContext,
): WarmupRampSet[] {
  if (!isPlateLoaded(variation)) return [];
  const bar = barForVariation(variation, ctx);
  const step = (PLATE_SIZES[ctx.unit].at(-1) ?? 2.5) * 2; // smallest loadable increment
  if (!Number.isFinite(targetTotal) || targetTotal <= bar + step) return [];

  const out: WarmupRampSet[] = [];
  for (const { pct, reps } of WARMUP_RAMP_STEPS) {
    const raw = targetTotal * pct;
    // Down to the nearest loadable total: bar + a whole number of increments.
    const loadable = raw <= bar ? bar : bar + Math.floor((raw - bar) / step) * step;
    if (loadable < bar || loadable >= targetTotal) continue;
    if (out.some((s) => s.weight === loadable)) continue;
    out.push({ weight: Math.round(loadable * 100) / 100, reps });
  }
  return out;
}
