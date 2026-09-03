/**
 * Settings store: unit, theme preference, equipment weights, lastProgramReview.
 * Raw-string keys (unit/theme/lastProgramReview) are handled by lib/storage.
 */
import { create } from 'zustand';
import {
  clearTheme,
  getEquipmentWeights,
  getLastProgramReview,
  getThemeRaw,
  getUnit,
  saveEquipmentWeights,
  saveLastProgramReview,
  saveTheme,
  saveUnit,
  getBarWeight,
  saveBarWeight,
} from '@/lib/storage';
import { isoDate } from '@/lib/domain';
import { themePrefFromRaw } from '@/theme';
import type { EquipmentWeights, ThemePref, Unit } from '@/lib/types';

export interface SettingsState {
  /** Display unit ("lbs" | "kg"). Storage is ALWAYS lbs regardless. */
  unit: Unit;
  /** light | dark | system. `system` is persisted as absence of the theme key. */
  themePref: ThemePref;
  /** Both lbs; null = unset (defaults: trap bar 55 lb / 25 kg, sled 0). */
  equipmentWeights: EquipmentWeights;
  /** ISO "YYYY-MM-DD" or null. Drives the 6-week program-review nudge. */
  lastProgramReview: string | null;
  /** Straight-bar weight in lbs; null = the standard 45lb / 20kg bar. */
  barWeightLbs: number | null;
  setUnit: (unit: Unit) => void;
  setThemePref: (pref: ThemePref) => void;
  setEquipmentWeights: (weights: EquipmentWeights) => void;
  setBarWeight: (lbs: number | null) => void;
  /** "I reviewed it" — stamps today and persists. */
  markProgramReviewed: () => void;
  /** Data-migration backfill (legacy: earliest entry date when unset). Persists. */
  backfillProgramReview: (isoDateStr: string) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  unit: getUnit(),
  themePref: themePrefFromRaw(getThemeRaw()),
  equipmentWeights: getEquipmentWeights(),
  lastProgramReview: getLastProgramReview(),
  barWeightLbs: getBarWeight(),

  setUnit: (unit) => {
    set({ unit });
    void saveUnit(unit);
  },

  setThemePref: (pref) => {
    set({ themePref: pref });
    if (pref === 'system') void clearTheme();
    else void saveTheme(pref);
  },

  setEquipmentWeights: (weights) => {
    set({ equipmentWeights: weights });
    void saveEquipmentWeights(weights);
  },

  setBarWeight: (lbs) => {
    set({ barWeightLbs: lbs });
    void saveBarWeight(lbs);
  },

  markProgramReviewed: () => {
    const today = isoDate();
    set({ lastProgramReview: today });
    void saveLastProgramReview(today);
  },

  backfillProgramReview: (isoDateStr) => {
    if (get().lastProgramReview) return;
    set({ lastProgramReview: isoDateStr });
    void saveLastProgramReview(isoDateStr);
  },
}));
