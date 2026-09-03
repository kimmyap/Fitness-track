/**
 * Custom workout days and exercise ordering.
 *
 * The load-bearing assertion in here is that NONE of these operations touch
 * `gymlog:entries`: logged sets are keyed by exercise name + date, never by
 * day, so renaming/removing/reassigning days must leave history byte-identical.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useProgramStore, LEGACY_DAY_NAMES } from './program';
import { useCustomExercisesStore } from './customExercises';
import { useEntriesStore } from './entries';
import { exercisesForDay } from '@/lib/domain';
import { DAYS } from '@/lib/program';
import type { Entry } from '@/lib/types';

const SEEDED_ENTRIES: Entry[] = [
  { id: 'a', exercise: 'Sumo Squats', weight: 135, sets: 1, reps: 10, date: '2026-08-20', createdAt: 1 },
  { id: 'b', exercise: 'Bench Press', weight: 105, sets: 1, reps: 8, date: '2026-08-21', createdAt: 2 },
];

function currentList(day: string) {
  const { customExercises, excludedBuiltIns } = useCustomExercisesStore.getState();
  const { order } = useProgramStore.getState();
  return exercisesForDay(day, DAYS, customExercises, excludedBuiltIns, order[day]).map((e) => e.name);
}

beforeEach(() => {
  localStorage.clear();
  useProgramStore.setState({ days: [...LEGACY_DAY_NAMES], order: {} });
  useCustomExercisesStore.setState({ customExercises: {}, excludedBuiltIns: {} });
  useEntriesStore.setState({ entries: [...SEEDED_ENTRIES] });
});

describe('day migration', () => {
  it('starts with the legacy three days when nothing is stored', () => {
    expect(useProgramStore.getState().days).toEqual(['Lower A', 'Upper', 'Lower B']);
  });

  it('keeps each legacy day showing its built-in exercises', () => {
    expect(currentList('Lower A')).toEqual(DAYS['Lower A']?.map((e) => e.name));
  });
});

describe('addDay', () => {
  it('appends a new empty day', () => {
    expect(useProgramStore.getState().addDay('Push')).toBe(true);
    expect(useProgramStore.getState().days).toEqual(['Lower A', 'Upper', 'Lower B', 'Push']);
    expect(currentList('Push')).toEqual([]);
  });

  it('rejects blank and duplicate names, case-insensitively', () => {
    expect(useProgramStore.getState().addDay('   ')).toBe(false);
    expect(useProgramStore.getState().addDay('upper')).toBe(false);
    expect(useProgramStore.getState().days).toHaveLength(3);
  });
});

describe('renameDay', () => {
  it('renames in place and carries the built-in exercises across', () => {
    const before = currentList('Lower A');
    expect(useProgramStore.getState().renameDay('Lower A', 'Legs')).toBe(true);
    expect(useProgramStore.getState().days).toEqual(['Legs', 'Upper', 'Lower B']);
    // Same exercises, same order, now stored as customs under the new name.
    expect(currentList('Legs')).toEqual(before);
    expect(currentList('Lower A')).toEqual([]);
  });

  it('leaves logged history untouched', () => {
    useProgramStore.getState().renameDay('Lower A', 'Legs');
    expect(useEntriesStore.getState().entries).toEqual(SEEDED_ENTRIES);
  });

  it('refuses a name that is already taken', () => {
    expect(useProgramStore.getState().renameDay('Lower A', 'Upper')).toBe(false);
    expect(useProgramStore.getState().days).toEqual(['Lower A', 'Upper', 'Lower B']);
  });

  it('carries a day’s custom exercises across too', () => {
    useCustomExercisesStore.getState().addCustomExercise('Lower A', {
      name: 'Glute Bridges',
      targetSets: 3,
      targetReps: '8-12',
      notes: null,
    });
    useProgramStore.getState().renameDay('Lower A', 'Legs');
    expect(currentList('Legs')).toContain('Glute Bridges');
  });
});

describe('removeDay', () => {
  it('removes the day but keeps logged sets', () => {
    useProgramStore.getState().removeDay('Upper');
    expect(useProgramStore.getState().days).toEqual(['Lower A', 'Lower B']);
    expect(useEntriesStore.getState().entries).toEqual(SEEDED_ENTRIES);
  });
});

describe('moveExercise', () => {
  it('swaps an exercise with its neighbour and persists the order', () => {
    const original = currentList('Lower A');
    const [first, second] = original;
    useProgramStore.getState().moveExercise('Lower A', second as string, -1, original);
    const moved = currentList('Lower A');
    expect(moved[0]).toBe(second);
    expect(moved[1]).toBe(first);
    expect(moved).toHaveLength(original.length);
  });

  it('is a no-op at the ends of the list', () => {
    const original = currentList('Lower A');
    useProgramStore.getState().moveExercise('Lower A', original[0] as string, -1, original);
    expect(currentList('Lower A')).toEqual(original);
  });

  it('survives a reload (order is written to storage)', () => {
    const original = currentList('Lower A');
    useProgramStore.getState().moveExercise('Lower A', original[1] as string, -1, original);
    const persisted = JSON.parse(localStorage.getItem('gymlog_gymlog:exerciseOrder') ?? '{}');
    expect(persisted['Lower A'][0]).toBe(original[1]);
  });
});

describe('assignExerciseToDay', () => {
  it('moves a built-in to another day without touching history', () => {
    useProgramStore.getState().assignExerciseToDay('Lower A', 'Upper', 'Sumo Squats');
    expect(currentList('Lower A')).not.toContain('Sumo Squats');
    expect(currentList('Upper')).toContain('Sumo Squats');
    expect(useEntriesStore.getState().entries).toEqual(SEEDED_ENTRIES);
  });

  it('moves a custom exercise, keeping its notes', () => {
    useCustomExercisesStore.getState().addCustomExercise('Lower A', {
      name: 'Glute Bridges',
      targetSets: 3,
      targetReps: '8-12',
      notes: 'Chin tucked',
    });
    useProgramStore.getState().assignExerciseToDay('Lower A', 'Lower B', 'Glute Bridges');
    expect(currentList('Lower B')).toContain('Glute Bridges');
    const moved = useCustomExercisesStore.getState().customExercises['Lower B']?.find(
      (e) => e.name === 'Glute Bridges',
    );
    expect(moved?.notes).toBe('Chin tucked');
  });

  it('ignores a move to the same day', () => {
    const before = currentList('Lower A');
    useProgramStore.getState().assignExerciseToDay('Lower A', 'Lower A', 'Sumo Squats');
    expect(currentList('Lower A')).toEqual(before);
  });
});
