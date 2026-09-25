/**
 * Variation-aware weight-entry math, input modes and the typo guard.
 *
 * Mode affects INPUT ONLY. Storage is always the total, in lbs.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { Entry, EquipmentWeights, LiftSetEntry, Unit } from '../types';
import { isLiftSet } from '../types';
import { PLATE_SIZES, barWeight, fromDisplayWeight, legPressSledWeight, toDisplayWeight, trapBarWeight } from './units';

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
