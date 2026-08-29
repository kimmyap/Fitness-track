/** Core-finisher swaps (gymlog:coreOverrides): original name → swapped alternative. */
import { create } from 'zustand';
import { getCoreOverrides, saveCoreOverrides } from '@/lib/storage';
import { CORE_EXERCISES } from '@/lib/program';
import type { CoreOverride, CoreOverridesMap } from '@/lib/types';

export interface CoreOverridesState {
  coreOverrides: CoreOverridesMap;
  setCoreOverrides: (map: CoreOverridesMap) => void;
  /** Swap an alternative into a core slot. */
  setOverride: (originalName: string, override: CoreOverride) => void;
  /** "Revert to {original}". */
  revertOverride: (originalName: string) => void;
}

export const useCoreOverridesStore = create<CoreOverridesState>((set, get) => {
  const persist = (coreOverrides: CoreOverridesMap) => {
    set({ coreOverrides });
    void saveCoreOverrides(coreOverrides);
  };

  return {
    coreOverrides: getCoreOverrides(),
    setCoreOverrides: (map) => persist(map),
    setOverride: (originalName, override) => persist({ ...get().coreOverrides, [originalName]: override }),
    revertOverride: (originalName) => {
      const map = { ...get().coreOverrides };
      delete map[originalName];
      persist(map);
    },
  };
});

/** The Finisher list with overrides applied: each slot's effective { name, target } + original. */
export const selectEffectiveCoreExercises = (s: CoreOverridesState) =>
  CORE_EXERCISES.map((original) => {
    const override = s.coreOverrides[original.name];
    return {
      original,
      effective: override ?? original,
      swapped: Boolean(override),
    };
  });
