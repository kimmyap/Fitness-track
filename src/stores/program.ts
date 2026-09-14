/**
 * Workout-day structure: which days exist, their order, and the display order
 * of exercises within each day.
 *
 * Two NEW storage keys (`gymlog:days`, `gymlog:exerciseOrder`) — the legacy
 * keys keep their exact shapes. Existing installs have neither key, so days
 * default to the legacy three and order defaults to the built-in sequence;
 * nothing needs migrating on first load.
 *
 * IMPORTANT: logged entries are keyed by exercise NAME and date, never by day
 * (see docs/research/migration-spec.md). Renaming, removing or reassigning
 * days therefore cannot touch logged history — only which tab an exercise
 * appears under.
 */
import { create } from 'zustand';
import { getDays, getExerciseOrder, saveDays, saveExerciseOrder } from '@/lib/storage';
import { DAYS } from '@/lib/program';
import { useCustomExercisesStore } from './customExercises';
import type { CustomExercise, CustomExercisesMap, ExerciseOrderMap, ProgramExercise } from '@/lib/types';

/** The three days every existing install started with. */
export const LEGACY_DAY_NAMES = ['Lower A', 'Upper', 'Lower B'] as const;

export interface ProgramState {
  days: string[];
  order: ExerciseOrderMap;
  /** Append a new, empty workout day. Returns false if the name is taken/blank. */
  addDay: (name: string) => boolean;
  /**
   * Rename a day in place. Built-in exercises are materialised as custom
   * entries under the new name, because the built-in program is keyed by the
   * original day names.
   */
  renameDay: (oldName: string, newName: string) => boolean;
  /** Remove a day and its config. Logged history is untouched. */
  removeDay: (name: string) => void;
  /** Reorder within a day. `names` is the full, ordered list for that day. */
  setDayOrder: (day: string, names: string[]) => void;
  /**
   * Replace the whole day list. For bulk writers only (backup import); day
   * editing in the UI goes through addDay / renameDay / removeDay, which also
   * carry the built-in materialisation those operations need.
   */
  setDays: (days: string[]) => void;
  /** Replace the whole per-day order map. Bulk writers only, as setDays. */
  setOrder: (order: ExerciseOrderMap) => void;
  /** Move one exercise up/down among `currentOrder`. */
  moveExercise: (day: string, name: string, direction: -1 | 1, currentOrder: string[]) => void;
  /** Reassign an exercise from one day to another. */
  assignExerciseToDay: (fromDay: string, toDay: string, name: string) => void;
}

/** Built-in program entry → a custom-exercise record with the same settings. */
function materialize(ex: ProgramExercise): CustomExercise {
  return {
    name: ex.name,
    goal: ex.goal,
    targetSets: ex.targetSets,
    targetReps: ex.targetReps,
    prefillReps: ex.prefillReps,
    custom: true,
    notes: null,
  };
}

/** Built-ins still visible on a day (i.e. not replaced). */
function effectiveBuiltIns(day: string, excluded: Record<string, string[]>): ProgramExercise[] {
  const hidden = excluded[day] ?? [];
  return (DAYS[day] ?? []).filter((ex) => !hidden.includes(ex.name));
}

export const useProgramStore = create<ProgramState>((set, get) => {
  const persistDays = (days: string[]) => {
    set({ days });
    void saveDays(days);
  };
  const persistOrder = (order: ExerciseOrderMap) => {
    set({ order });
    void saveExerciseOrder(order);
  };

  const stored = getDays();

  return {
    // No stored list means an untouched install: the legacy three.
    days: stored.length ? stored : [...LEGACY_DAY_NAMES],
    order: getExerciseOrder(),

    addDay: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      const days = get().days;
      if (days.some((d) => d.toLowerCase() === trimmed.toLowerCase())) return false;
      persistDays([...days, trimmed]);
      return true;
    },

    renameDay: (oldName, newName) => {
      const trimmed = newName.trim();
      const days = get().days;
      if (!trimmed || !days.includes(oldName)) return false;
      if (trimmed !== oldName && days.some((d) => d.toLowerCase() === trimmed.toLowerCase())) return false;
      if (trimmed === oldName) return true;

      const custom = useCustomExercisesStore.getState();
      const nextCustom: CustomExercisesMap = { ...custom.customExercises };
      const nextExcluded = { ...custom.excludedBuiltIns };

      // Carry the built-ins over as custom entries, ahead of any customs the
      // day already had, so the visible list is unchanged by the rename.
      const carried = effectiveBuiltIns(oldName, nextExcluded).map(materialize);
      const existing = nextCustom[oldName] ?? [];
      nextCustom[trimmed] = [...carried, ...existing];
      delete nextCustom[oldName];

      // Neutralise the old day's built-ins rather than dropping the key: the
      // built-in program is a constant keyed by the original names, so a day
      // later re-created as "Lower A" would otherwise resurrect them and
      // duplicate the copies now living under the new name.
      const oldBuiltInNames = (DAYS[oldName] ?? []).map((ex) => ex.name);
      if (oldBuiltInNames.length) nextExcluded[oldName] = oldBuiltInNames;
      else delete nextExcluded[oldName];

      custom.setCustomExercises(nextCustom);
      custom.setExcludedBuiltIns(nextExcluded);

      const order = { ...get().order };
      if (order[oldName]) {
        order[trimmed] = order[oldName] as string[];
        delete order[oldName];
      }
      persistOrder(order);
      persistDays(days.map((d) => (d === oldName ? trimmed : d)));
      return true;
    },

    removeDay: (name) => {
      const custom = useCustomExercisesStore.getState();
      const nextCustom = { ...custom.customExercises };
      const nextExcluded = { ...custom.excludedBuiltIns };
      delete nextCustom[name];
      delete nextExcluded[name];
      custom.setCustomExercises(nextCustom);
      custom.setExcludedBuiltIns(nextExcluded);

      const order = { ...get().order };
      delete order[name];
      persistOrder(order);
      persistDays(get().days.filter((d) => d !== name));
    },

    setDayOrder: (day, names) => {
      persistOrder({ ...get().order, [day]: names });
    },

    setDays: (days) => {
      persistDays(days);
    },

    setOrder: (order) => {
      persistOrder(order);
    },

    moveExercise: (day, name, direction, currentOrder) => {
      const index = currentOrder.indexOf(name);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= currentOrder.length) return;
      const next = [...currentOrder];
      const moved = next[index] as string;
      next[index] = next[target] as string;
      next[target] = moved;
      persistOrder({ ...get().order, [day]: next });
    },

    assignExerciseToDay: (fromDay, toDay, name) => {
      if (fromDay === toDay) return;
      const custom = useCustomExercisesStore.getState();
      const nextCustom: CustomExercisesMap = { ...custom.customExercises };
      const nextExcluded = { ...custom.excludedBuiltIns };

      const fromList = nextCustom[fromDay] ?? [];
      const existing = fromList.find((ex) => ex.name === name);

      if (existing) {
        // A custom exercise: move the record itself, keeping its notes/goal.
        nextCustom[fromDay] = fromList.filter((ex) => ex.name !== name);
        nextCustom[toDay] = [...(nextCustom[toDay] ?? []), existing];
      } else {
        // A built-in: hide it on the old day, recreate it on the new one.
        const builtIn = (DAYS[fromDay] ?? []).find((ex) => ex.name === name);
        if (!builtIn) return;
        nextExcluded[fromDay] = [...(nextExcluded[fromDay] ?? []), name];
        nextCustom[toDay] = [...(nextCustom[toDay] ?? []), materialize(builtIn)];
      }

      custom.setCustomExercises(nextCustom);
      custom.setExcludedBuiltIns(nextExcluded);

      const order = { ...get().order };
      if (order[fromDay]) order[fromDay] = (order[fromDay] as string[]).filter((n) => n !== name);
      if (order[toDay]) order[toDay] = [...(order[toDay] as string[]), name];
      persistOrder(order);
    },
  };
});
