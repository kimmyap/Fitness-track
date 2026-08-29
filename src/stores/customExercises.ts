/**
 * Custom exercises + excluded (replaced) built-ins, per day tab
 * (gymlog:customExercises + gymlog:excludedBuiltIns).
 */
import { create } from 'zustand';
import {
  getCustomExercises,
  getExcludedBuiltIns,
  saveCustomExercises,
  saveExcludedBuiltIns,
} from '@/lib/storage';
import { exercisesForDay as exercisesForDayPure } from '@/lib/domain';
import { DAYS } from '@/lib/program';
import type { AnyExercise, CustomExercise, CustomExercisesMap, ExcludedBuiltInsMap } from '@/lib/types';

export interface NewCustomExerciseInput {
  name: string;
  targetSets: number;
  targetReps: string;
  /** Goal weight lbs; legacy default 50 when none entered. */
  goal?: number;
  notes?: string | null;
}

export interface CustomExercisesState {
  customExercises: CustomExercisesMap;
  excludedBuiltIns: ExcludedBuiltInsMap;
  setCustomExercises: (map: CustomExercisesMap) => void;
  setExcludedBuiltIns: (map: ExcludedBuiltInsMap) => void;
  /** Add a permanent custom exercise to a day. prefillReps = parseInt(targetReps) || 10 (legacy). */
  addCustomExercise: (day: string, input: NewCustomExerciseInput) => CustomExercise;
  /** Update a custom exercise's per-exercise notes. */
  setExerciseNotes: (day: string, name: string, notes: string | null) => void;
  /** Hide but keep history/config. */
  archiveCustomExercise: (day: string, name: string) => void;
  /** Restore an archived custom exercise. */
  unarchiveCustomExercise: (day: string, name: string) => void;
  /** Delete permanently (config only — logged history stays in entries). */
  deleteCustomExercise: (day: string, name: string) => void;
  /** Hide a built-in because it was replaced. */
  excludeBuiltIn: (day: string, name: string) => void;
  /** Restore a replaced built-in. */
  restoreBuiltIn: (day: string, name: string) => void;
}

export const useCustomExercisesStore = create<CustomExercisesState>((set, get) => {
  const persistCustom = (customExercises: CustomExercisesMap) => {
    set({ customExercises });
    void saveCustomExercises(customExercises);
  };
  const persistExcluded = (excludedBuiltIns: ExcludedBuiltInsMap) => {
    set({ excludedBuiltIns });
    void saveExcludedBuiltIns(excludedBuiltIns);
  };
  const updateExercise = (day: string, name: string, patch: Partial<CustomExercise>) => {
    const map = { ...get().customExercises };
    map[day] = (map[day] || []).map((ex) => (ex.name === name ? { ...ex, ...patch } : ex));
    persistCustom(map);
  };

  return {
    customExercises: getCustomExercises(),
    excludedBuiltIns: getExcludedBuiltIns(),

    setCustomExercises: (map) => persistCustom(map),
    setExcludedBuiltIns: (map) => persistExcluded(map),

    addCustomExercise: (day, input) => {
      const exercise: CustomExercise = {
        name: input.name,
        targetSets: input.targetSets,
        targetReps: input.targetReps,
        prefillReps: parseInt(input.targetReps) || 10,
        goal: input.goal || 50,
        custom: true,
        notes: input.notes ?? null,
      };
      const map = { ...get().customExercises };
      map[day] = [...(map[day] || []), exercise];
      persistCustom(map);
      return exercise;
    },

    setExerciseNotes: (day, name, notes) => updateExercise(day, name, { notes }),

    archiveCustomExercise: (day, name) => updateExercise(day, name, { archived: true }),

    unarchiveCustomExercise: (day, name) => {
      const map = { ...get().customExercises };
      map[day] = (map[day] || []).map((ex) => {
        if (ex.name !== name) return ex;
        const next = { ...ex };
        delete next.archived;
        return next;
      });
      persistCustom(map);
    },

    deleteCustomExercise: (day, name) => {
      const map = { ...get().customExercises };
      map[day] = (map[day] || []).filter((ex) => ex.name !== name);
      persistCustom(map);
    },

    excludeBuiltIn: (day, name) => {
      const map = { ...get().excludedBuiltIns };
      const list = map[day] || [];
      if (!list.includes(name)) map[day] = [...list, name];
      persistExcluded(map);
    },

    restoreBuiltIn: (day, name) => {
      const map = { ...get().excludedBuiltIns };
      map[day] = (map[day] || []).filter((n) => n !== name);
      persistExcluded(map);
    },
  };
});

/**
 * Effective exercise list for a day: built-ins minus excluded, plus non-archived customs.
 * WARNING: returns a fresh array per call — getState()-only; do not pass to the
 * hook as a selector (infinite loop under zustand v5). In components, subscribe
 * to s.customExercises / s.excludedBuiltIns and derive with useMemo.
 */
export const selectExercisesForDay =
  (day: string) =>
  (s: CustomExercisesState): AnyExercise[] =>
    exercisesForDayPure(day, DAYS, s.customExercises, s.excludedBuiltIns);

/** Archived customs + replaced built-ins, for the Settings restore section. */
export const selectArchivedAndReplaced = (s: CustomExercisesState) => {
  const archived: { day: string; exercise: CustomExercise }[] = [];
  Object.entries(s.customExercises).forEach(([day, list]) => {
    list.filter((ex) => ex.archived === true).forEach((exercise) => archived.push({ day, exercise }));
  });
  const replaced: { day: string; name: string }[] = [];
  Object.entries(s.excludedBuiltIns).forEach(([day, names]) => {
    names.forEach((name) => replaced.push({ day, name }));
  });
  return { archived, replaced };
};
