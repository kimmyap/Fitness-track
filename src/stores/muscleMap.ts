/**
 * User-authored exercise → muscle mappings (gymlog:muscleMap).
 *
 * WHY THIS EXISTS. The 876-row exercise library resolves every built-in
 * program movement, but it refuses to guess on an ambiguous name — so plenty of
 * things people actually type do not resolve: measured on this repo's own
 * fixtures, "Bulgarian Split Squat" (a real custom exercise in `legacySeed`),
 * "Incline Press", "Seated Row", "Leg Curl", "Bicep Curls" and "Tricep
 * Pushdown" all miss. Those sets would contribute to no muscle at all, and a
 * recovery view would then report a muscle as untrained on the day you trained
 * it — worse than showing nothing, because it would send you back to it.
 *
 * So the mapping is a first-class, user-owned decision: name it once, and the
 * balance is right from then on. It is exported in BOTH backup payloads for the
 * same reason — restoring onto a new phone without it would not fail loudly, it
 * would quietly under-report.
 */
import { create } from 'zustand';
import { getMuscleMap, saveMuscleMap } from '@/lib/storage';
import type { MuscleGroup, MuscleMap } from '@/lib/types';

export interface MuscleMapState {
  muscleMap: MuscleMap;
  setMuscle: (exerciseName: string, muscle: MuscleGroup) => void;
  /** Replace the whole map. Bulk writers only (backup import). */
  setMuscleMap: (map: MuscleMap) => void;
  clearMuscle: (exerciseName: string) => void;
}

export const useMuscleMapStore = create<MuscleMapState>((set, get) => {
  const persist = (muscleMap: MuscleMap) => {
    set({ muscleMap });
    void saveMuscleMap(muscleMap);
  };

  return {
    muscleMap: getMuscleMap(),
    setMuscle: (exerciseName, muscle) => persist({ ...get().muscleMap, [exerciseName]: muscle }),
    setMuscleMap: (map) => persist(map),
    clearMuscle: (exerciseName) => {
      const next = { ...get().muscleMap };
      delete next[exerciseName];
      persist(next);
    },
  };
});
