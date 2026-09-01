/**
 * Plate calculator: dual weight input modes (CLAUDE.md § Plate Math).
 * Storage is always the TOTAL in lbs; mode only changes what the user types.
 */
import { describe, expect, it } from 'vitest';
import {
  barForVariation,
  computeTotalDisplayWeightWithMode,
  effectiveMode,
  inputWeightFromStoredWithMode,
  isPlateLoaded,
  plateQuickPicks,
  storedWeightFromModeInput,
} from './domain';
import type { WeightEntryContext } from './domain';

const LBS: WeightEntryContext = { unit: 'lbs', equipment: { trapBar: null, legPressSled: null } };
const KG: WeightEntryContext = { unit: 'kg', equipment: { trapBar: null, legPressSled: null } };
const TRAP: WeightEntryContext = { unit: 'lbs', equipment: { trapBar: 55, legPressSled: null } };

describe('isPlateLoaded', () => {
  it('covers barbell, trap bar, and exercises with no variation (custom plate-loaded lifts)', () => {
    expect(isPlateLoaded('Barbell')).toBe(true);
    expect(isPlateLoaded('Trap Bar')).toBe(true);
    expect(isPlateLoaded(null)).toBe(true);
    expect(isPlateLoaded(undefined)).toBe(true);
  });

  it('excludes non-plate and sled-based variations', () => {
    expect(isPlateLoaded('Dumbbell')).toBe(false);
    expect(isPlateLoaded('Machine')).toBe(false);
    // Leg Press already folds the sled into its legacy total.
    expect(isPlateLoaded('Leg Press')).toBe(false);
  });
});

describe('effectiveMode', () => {
  it("maps 'auto' onto per-side for bar lifts and total for everything else", () => {
    expect(effectiveMode('auto', 'Barbell')).toBe('perSide');
    expect(effectiveMode('auto', 'Trap Bar')).toBe('perSide');
    expect(effectiveMode('auto', 'Machine')).toBe('total');
    expect(effectiveMode('auto', null)).toBe('total');
  });

  it('passes an explicit mode straight through', () => {
    expect(effectiveMode('total', 'Barbell')).toBe('total');
    expect(effectiveMode('perSide', null)).toBe('perSide');
  });
});

describe('barForVariation', () => {
  it('uses the standard bar, or the configured trap bar', () => {
    expect(barForVariation('Barbell', LBS)).toBe(45);
    expect(barForVariation(null, LBS)).toBe(45);
    expect(barForVariation('Barbell', KG)).toBe(20);
    expect(barForVariation('Trap Bar', TRAP)).toBe(55);
  });
});

describe('computeTotalDisplayWeightWithMode', () => {
  it("'auto' preserves the legacy variation math", () => {
    expect(computeTotalDisplayWeightWithMode('auto', 'Barbell', 45, LBS)).toBe(135);
    expect(computeTotalDisplayWeightWithMode('auto', 'Dumbbell', 30, LBS)).toBe(60);
  });

  it("'total' logs the number as typed, bar included", () => {
    expect(computeTotalDisplayWeightWithMode('total', 'Barbell', 135, LBS)).toBe(135);
    expect(computeTotalDisplayWeightWithMode('total', null, 185, LBS)).toBe(185);
  });

  it("'perSide' doubles the plates and adds the bar — including for custom lifts", () => {
    // e.g. a custom "Glute Bridges": 1 plate per side + 45lb bar
    expect(computeTotalDisplayWeightWithMode('perSide', null, 45, LBS)).toBe(135);
    expect(computeTotalDisplayWeightWithMode('perSide', 'Barbell', 90, LBS)).toBe(225);
    expect(computeTotalDisplayWeightWithMode('perSide', 'Trap Bar', 45, TRAP)).toBe(145);
    expect(computeTotalDisplayWeightWithMode('perSide', 'Barbell', 20, KG)).toBe(60);
  });

  it('keeps an empty bar-only entry at 0 rather than reporting just the bar', () => {
    expect(computeTotalDisplayWeightWithMode('perSide', 'Barbell', 0, LBS)).toBe(0);
  });
});

describe('storedWeightFromModeInput', () => {
  it('stores lbs regardless of the display unit', () => {
    expect(storedWeightFromModeInput('total', null, 135, LBS)).toBe(135);
    // 60kg total → 132.3 lbs
    expect(storedWeightFromModeInput('perSide', 'Barbell', 20, KG)).toBeCloseTo(132.3, 1);
  });
});

describe('inputWeightFromStoredWithMode', () => {
  it('round-trips per-side entry', () => {
    const total = computeTotalDisplayWeightWithMode('perSide', 'Barbell', 45, LBS);
    expect(inputWeightFromStoredWithMode('perSide', 'Barbell', total, LBS)).toBe(45);
  });

  it('shows the full total in total mode', () => {
    expect(inputWeightFromStoredWithMode('total', 'Barbell', 135, LBS)).toBe(135);
  });

  it('never prefills a negative per-side weight when the total is under the bar', () => {
    expect(inputWeightFromStoredWithMode('perSide', 'Barbell', 20, LBS)).toBe(0);
  });

  it("'auto' keeps the legacy prefill quirk (only Barbell/Dumbbell are un-derived)", () => {
    expect(inputWeightFromStoredWithMode('auto', 'Barbell', 135, LBS)).toBe(45);
    expect(inputWeightFromStoredWithMode('auto', 'Trap Bar', 145, TRAP)).toBe(145);
  });
});

describe('plateQuickPicks', () => {
  it('offers 1–4 of the heaviest plate per side', () => {
    expect(plateQuickPicks('lbs')).toEqual([
      { plates: 1, perSide: 45 },
      { plates: 2, perSide: 90 },
      { plates: 3, perSide: 135 },
      { plates: 4, perSide: 180 },
    ]);
  });

  it('uses the heaviest kg plate in kg mode', () => {
    expect(plateQuickPicks('kg').map((p) => p.perSide)).toEqual([25, 50, 75, 100]);
  });
});
