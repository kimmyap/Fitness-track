/**
 * Unit conversions and the unit-keyed constants (bars, plate sizes).
 *
 * Display-only: storage is ALWAYS lbs and inches. `PLATE_SIZES` and
 * `BAR_OPTIONS` live here rather than with the plate calculator because they
 * are keyed by unit and read by weight math, the calculator and the
 * progression ladder alike — keeping them next to one consumer made weight
 * and plates import each other.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { EquipmentWeights, Unit } from '../types';

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


export const PLATE_SIZES: Record<Unit, number[]> = {
  lbs: [45, 35, 25, 10, 5, 2.5],
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
};

/** Bar options offered by the legacy Plates tab (display units). */
export const BAR_OPTIONS: Record<Unit, number[]> = {
  lbs: [45, 35, 15, 0],
  kg: [20, 15, 10, 0],
};
