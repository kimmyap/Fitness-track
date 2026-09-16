/**
 * Main log store (gymlog:entries). Hydrates from legacy storage at creation
 * and writes through on EVERY mutation (no persist middleware).
 */
import { create } from 'zustand';
import { getEntries, saveEntries } from '@/lib/storage';
import {
  bestFor,
  computeStats,
  estimated1RM,
  generateId,
  isoDate,
  suggestedNextWeight,
  type ProgressionSuggestion,
  type Stats,
} from '@/lib/domain';
import type { ActivityName, AnyExercise, Entry, LiftSetEntry, Unit } from '@/lib/types';
import { isLiftSet } from '@/lib/types';

/** Everything needed to create a lift-set entry; optional fields stay ABSENT when not provided. */
export interface NewLiftSetInput {
  exercise: string;
  /** Stored TOTAL lbs (bar math already applied — see domain.storedWeightFromInput). */
  weight: number;
  reps: number;
  /** Defaults to today. */
  date?: string;
  rpe?: number;
  variation?: string;
  warmupSet?: boolean;
  assistedPullup?: boolean;
  /** NEW: back-off drop — counts for volume, never for PB/1RM. */
  dropSet?: boolean;
  /** NEW: taken to failure — a label only; counts exactly like a normal set. */
  toFailure?: boolean;
  /** NEW: the reps are PER SIDE — a label only, volume is unchanged. */
  perSide?: boolean;
  /** When false, omit createdAt (legacy one-off logs). Default true. */
  withCreatedAt?: boolean;
}

export function buildLiftSetEntry(input: NewLiftSetInput): LiftSetEntry {
  const entry: LiftSetEntry = {
    id: generateId(),
    exercise: input.exercise,
    weight: input.weight,
    sets: 1,
    reps: input.reps,
    date: input.date ?? isoDate(),
  };
  if (input.withCreatedAt !== false) entry.createdAt = Date.now();
  if (input.rpe) entry.rpe = input.rpe;
  if (input.variation) entry.variation = input.variation;
  if (input.warmupSet) entry.warmupSet = true;
  if (input.assistedPullup) entry.assistedPullup = true;
  if (input.dropSet) entry.dropSet = true;
  if (input.toFailure) entry.toFailure = true;
  if (input.perSide) entry.perSide = true;
  return entry;
}

/**
 * What a write returned: the entry, and whether it actually reached storage.
 *
 * `saved` exists because a localStorage write can fail (quota, a locked-down
 * private window) and `setRawWithRetry` only records that globally, on a flag
 * the Train page did not read — so a set could fail to persist with the form
 * showing nothing at all. Callers that confirm a write to the user await this.
 * It resolves false only after the retries have given up.
 */
export interface LoggedSet {
  entry: LiftSetEntry;
  saved: Promise<boolean>;
}

export interface EntriesState {
  entries: Entry[];
  /** Replace the whole array (import/merge). Persists. */
  setEntries: (entries: Entry[]) => void;
  /** Append a pre-built entry (lift set, activity, warmup, core). Persists. */
  addEntry: (entry: Entry) => void;
  /** Convenience: log a lift set from input fields. See LoggedSet. */
  logSet: (input: NewLiftSetInput) => LoggedSet;
  /** Quick-log Pilates/Volleyball for a date (defaults to today). */
  logActivity: (activity: ActivityName, date?: string) => void;
  /**
   * Toggle the warmup/core completion entry for a date (defaults today).
   * Returns true when now marked complete, false when unmarked.
   */
  toggleCompletion: (type: 'warmup' | 'core', date?: string) => boolean;
  /**
   * Legacy edit semantics: sets weight/reps, and each optional field is
   * either set or DELETED (absent) based on the patch.
   */
  updateSet: (
    id: string,
    patch: {
      weight: number;
      reps: number;
      rpe?: number;
      variation?: string;
      warmupSet?: boolean;
      assistedPullup?: boolean;
      dropSet?: boolean;
      toFailure?: boolean;
      perSide?: boolean;
    },
  ) => void;
  /** Remove an entry. Returns the removed entry so callers can offer Undo. */
  deleteEntry: (id: string) => Entry | undefined;
  /** Put a previously deleted entry back (Undo). */
  restoreEntry: (entry: Entry) => void;
  /** Wipe all logged data (Settings → Reset; entries only, like legacy). */
  resetAll: () => void;
}

export const useEntriesStore = create<EntriesState>((set, get) => {
  /**
   * Returns the write's outcome rather than swallowing it. Callers that do not
   * surface failure still ignore it with `void`, exactly as before.
   */
  const persist = (entries: Entry[]): Promise<boolean> => {
    set({ entries });
    return saveEntries(entries);
  };

  return {
    entries: getEntries(),

    setEntries: (entries) => void persist(entries),

    addEntry: (entry) => void persist([...get().entries, entry]),

    logSet: (input) => {
      const entry = buildLiftSetEntry(input);
      return { entry, saved: persist([...get().entries, entry]) };
    },

    logActivity: (activity, date) => {
      const entry = { id: generateId(), type: 'activity' as const, activity, date: date ?? isoDate() };
      void persist([...get().entries, entry]);
    },

    toggleCompletion: (type, date) => {
      const d = date ?? isoDate();
      const { entries } = get();
      const existing = entries.find((e) => 'type' in e && e.type === type && e.date === d);
      if (existing) {
        void persist(entries.filter((e) => e !== existing));
        return false;
      }
      void persist([...entries, { id: generateId(), type, date: d }]);
      return true;
    },

    updateSet: (id, patch) => {
      const entries = get().entries.map((e) => {
        if (e.id !== id || !isLiftSet(e)) return e;
        const next: LiftSetEntry = { ...e, weight: patch.weight, reps: patch.reps };
        if (patch.rpe) next.rpe = patch.rpe;
        else delete next.rpe;
        if (patch.variation) next.variation = patch.variation;
        if (patch.warmupSet) next.warmupSet = true;
        else delete next.warmupSet;
        if (patch.assistedPullup) next.assistedPullup = true;
        else delete next.assistedPullup;
        if (patch.dropSet) next.dropSet = true;
        else delete next.dropSet;
        if (patch.toFailure) next.toFailure = true;
        else delete next.toFailure;
        if (patch.perSide) next.perSide = true;
        else delete next.perSide;
        return next;
      });
      void persist(entries);
    },

    deleteEntry: (id) => {
      const { entries } = get();
      const removed = entries.find((e) => e.id === id);
      if (!removed) return undefined;
      void persist(entries.filter((e) => e.id !== id));
      return removed;
    },

    restoreEntry: (entry) => void persist([...get().entries, entry]),

    resetAll: () => void persist([]),
  };
});

// ---------------------------------------------------------------------------
// Derived selectors. WARNING: the array/object-returning ones build a fresh
// reference per call, so they are safe with getState() but will cause
// "Maximum update depth exceeded" loops if passed to useEntriesStore(...) as a
// hook selector (zustand v5 / useSyncExternalStore). In components, subscribe
// to raw slices (e.g. s.entries) and derive with useMemo instead.
// Primitive-returning selectors (selectHasCompletion, ...) are hook-safe.
// ---------------------------------------------------------------------------

export const selectEntriesForDate =
  (date: string) =>
  (s: EntriesState): Entry[] =>
    s.entries.filter((e) => e.date === date);

export const selectLiftSetsForDate =
  (date: string) =>
  (s: EntriesState): LiftSetEntry[] =>
    s.entries.filter((e): e is LiftSetEntry => isLiftSet(e) && e.date === date);

export const selectHasCompletion =
  (type: 'warmup' | 'core', date: string) =>
  (s: EntriesState): boolean =>
    s.entries.some((e) => 'type' in e && e.type === type && e.date === date);

export const selectActivitiesForDate =
  (date: string) =>
  (s: EntriesState): ActivityName[] =>
    s.entries
      .filter((e): e is Extract<Entry, { type: 'activity' }> => 'type' in e && e.type === 'activity' && e.date === date)
      .map((e) => e.activity);

/** Working (non-warmup) sets logged today for an exercise — the "n/N sets today" badge. */
export const selectSetsToday =
  (exercise: string, date: string) =>
  (s: EntriesState): number =>
    s.entries.filter((e) => isLiftSet(e) && e.exercise === exercise && e.date === date && !e.warmupSet).length;

/** Personal best entry for an exercise (legacy bestFor; excludes warm-ups only). */
export const selectBestFor =
  (exercise: string) =>
  (s: EntriesState): LiftSetEntry | null =>
    bestFor(s.entries, exercise);

/** Best estimated 1RM (Epley) for an exercise, or null. */
export const selectEstimated1RM =
  (exercise: string) =>
  (s: EntriesState): number | null =>
    estimated1RM(s.entries, exercise);

/** Streak / total sessions / sessions this month (stats strip). */
export const selectStats = (s: EntriesState): Stats => computeStats(s.entries);

/** RPE-ladder progression suggestion for an exercise card. */
export const selectSuggestedNextWeight =
  (ex: Pick<AnyExercise, 'name' | 'targetReps'>, unit: Unit) =>
  (s: EntriesState): ProgressionSuggestion | null =>
    suggestedNextWeight(s.entries, ex, unit);
