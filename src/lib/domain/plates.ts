/**
 * Greedy per-side plate breakdown.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { Unit } from '../types';
import { PLATE_SIZES } from './units';

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
