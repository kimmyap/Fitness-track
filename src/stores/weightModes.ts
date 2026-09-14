/**
 * Per-exercise weight input mode (gymlog:weightInputModes).
 *
 * Remembers whether an exercise was last logged by total weight or by plates
 * per side, so repeat exercises pre-fill the way you last logged them. An
 * exercise with no stored mode falls back to 'auto' (legacy variation math).
 */
import { create } from 'zustand';
import { getWeightInputModes, saveWeightInputModes } from '@/lib/storage';
import type { StoredWeightInputMode, WeightInputModeMap } from '@/lib/types';
import type { WeightEntryMode } from '@/lib/domain';

export interface WeightModesState {
  modes: WeightInputModeMap;
  setMode: (exerciseName: string, mode: StoredWeightInputMode) => void;
  /** Replace the whole map. Bulk writers only (backup import). */
  setModes: (modes: WeightInputModeMap) => void;
  clearMode: (exerciseName: string) => void;
}

export const useWeightModesStore = create<WeightModesState>((set, get) => {
  const persist = (modes: WeightInputModeMap) => {
    set({ modes });
    void saveWeightInputModes(modes);
  };

  return {
    modes: getWeightInputModes(),
    setMode: (exerciseName, mode) => persist({ ...get().modes, [exerciseName]: mode }),
    setModes: (modes) => persist(modes),
    clearMode: (exerciseName) => {
      const modes = { ...get().modes };
      delete modes[exerciseName];
      persist(modes);
    },
  };
});

/** Stored mode for an exercise, or 'auto' when it has never been set. */
export function modeForExercise(modes: WeightInputModeMap, exerciseName: string): WeightEntryMode {
  return modes[exerciseName] ?? 'auto';
}
