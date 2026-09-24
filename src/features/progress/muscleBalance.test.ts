import { describe, it, expect } from 'vitest';
import type { Entry, MuscleMap } from '@/lib/types';
import type { MuscleLookup } from './chartData';
import {
  BALANCE_WINDOW_DAYS,
  programMuscles,
  familiarEquipment,
  rankSuggestions,
  WEEKLY_SETS_MAX,
  WEEKLY_SETS_MIN,
  muscleBalance,
  underworkedMuscles,
} from './muscleBalance';

const NOW = new Date(2026, 8, 24, 18, 0, 0); // Thu 24 Sep 2026, local

function iso(daysAgo: number): string {
  const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

let seq = 0;
function set(exercise: string, daysAgo: number, overrides: Partial<Entry> = {}): Entry {
  return {
    id: `e${++seq}`,
    exercise,
    weight: 100,
    sets: 1,
    reps: 10,
    date: iso(daysAgo),
    ...overrides,
  } as Entry;
}

/** A deliberately small stand-in for the 1.2 MB library. */
const lookup: MuscleLookup = (name) =>
  ({
    'Bench Press': { primary: ['Chest'], secondary: ['Shoulders', 'Triceps'] },
    'Sumo Squats': { primary: ['Quadriceps'], secondary: ['Glutes', 'Hamstrings'] },
    'Hip Thrust': { primary: ['Glutes'], secondary: ['Hamstrings'] },
  })[name];

const row = (b: ReturnType<typeof muscleBalance>, muscle: string) =>
  b.rows.find((r) => r.muscle === muscle)!;

describe('muscleBalance window', () => {
  it('counts sets inside the rolling 7 days and excludes older ones', () => {
    const b = muscleBalance(
      [set('Bench Press', 0), set('Bench Press', 6), set('Bench Press', 7), set('Bench Press', 40)],
      lookup,
      {},
      NOW,
    );
    // 0 and 6 days ago are inside a 7-day window; 7 and 40 are not.
    expect(row(b, 'Chest').primarySets).toBe(2);
  });

  it('is rolling, not calendar — a Sunday set still counts on Monday', () => {
    const monday = new Date(2026, 8, 28, 9, 0, 0); // Mon 28 Sep
    const sundayIso = '2026-09-27';
    const b = muscleBalance([set('Bench Press', 0, { date: sundayIso })], lookup, {}, monday);
    expect(row(b, 'Chest').primarySets).toBe(1);
    expect(row(b, 'Chest').daysSince).toBe(1);
  });

  it('expands a legacy multi-set row into its real set count', () => {
    // Legacy rows carry 3x12 as one entry. Counting it as one set would
    // under-report a migrated user against a per-week benchmark.
    const b = muscleBalance([set('Hip Thrust', 1, { sets: 3 })], lookup, {}, NOW);
    expect(row(b, 'Glutes').primarySets).toBe(3);
  });

  /**
   * Same filter as every other volume number in the app: warm-ups and assisted
   * reps are out, DROP SETS ARE IN. Pinned here because a set-count benchmark
   * makes that inclusion visible in a way a volume total does not — but
   * diverging would put this tab in open disagreement with the Muscle volume
   * chart on the same page, which is worse than the slight over-count.
   */
  it('excludes warm-ups and assisted reps, and keeps drop sets like isVolumeSet does', () => {
    const b = muscleBalance(
      [
        set('Bench Press', 1, { warmupSet: true }),
        set('Bench Press', 1, { assistedPullup: true }),
        set('Bench Press', 1, { dropSet: true }),
        set('Bench Press', 1),
      ],
      lookup,
      {},
      NOW,
    );
    expect(row(b, 'Chest').primarySets).toBe(2);
  });
});

describe('muscleBalance attribution', () => {
  it('keeps secondary work out of the benchmark count', () => {
    const b = muscleBalance([set('Bench Press', 1)], lookup, {}, NOW);
    expect(row(b, 'Triceps').primarySets).toBe(0);
    expect(row(b, 'Triceps').secondarySets).toBe(1);
    expect(row(b, 'Triceps').volume).toBe('untrained');
  });

  it('reports unresolved exercises instead of dropping them', () => {
    const b = muscleBalance([set('Bulgarian Split Squat', 1), set('Bulgarian Split Squat', 2)], lookup, {}, NOW);
    expect(b.unattributedSets).toBe(2);
    expect(b.unmatched).toEqual([{ exercise: 'Bulgarian Split Squat', sets: 2 }]);
    // and it must NOT have quietly become a trained muscle somewhere
    expect(b.rows.every((r) => r.primarySets === 0)).toBe(true);
  });

  it('honours a user mapping over the library, and clears it from unmatched', () => {
    const map: MuscleMap = { 'Bulgarian Split Squat': 'Quadriceps' };
    const b = muscleBalance([set('Bulgarian Split Squat', 1)], lookup, map, NOW);
    expect(row(b, 'Quadriceps').primarySets).toBe(1);
    expect(b.unmatched).toEqual([]);
    expect(b.unattributedSets).toBe(0);
  });

  it('lets a user mapping correct a wrong library resolution', () => {
    // The override is the more specific statement, so it wins outright.
    const map: MuscleMap = { 'Bench Press': 'Shoulders' };
    const b = muscleBalance([set('Bench Press', 1)], lookup, map, NOW);
    expect(row(b, 'Shoulders').primarySets).toBe(1);
    expect(row(b, 'Chest').primarySets).toBe(0);
  });

  it('returns all 17 groups so "no exercise for this" is visible', () => {
    const b = muscleBalance([], lookup, {}, NOW);
    expect(b.rows).toHaveLength(17);
    expect(b.rows.every((r) => r.volume === 'untrained' && r.recovery === 'never')).toBe(true);
  });
});

describe('muscleBalance verdicts', () => {
  const chest = (n: number, daysAgo = 1) =>
    muscleBalance(
      Array.from({ length: n }, () => set('Bench Press', daysAgo)),
      lookup,
      {},
      NOW,
    );

  it('reads under / optimal / over against the benchmark boundaries', () => {
    expect(row(chest(WEEKLY_SETS_MIN - 1), 'Chest').volume).toBe('under');
    expect(row(chest(WEEKLY_SETS_MIN), 'Chest').volume).toBe('optimal');
    expect(row(chest(WEEKLY_SETS_MAX), 'Chest').volume).toBe('optimal');
    expect(row(chest(WEEKLY_SETS_MAX + 1), 'Chest').volume).toBe('over');
  });

  it('reads recovery from whole days since the last primary set', () => {
    expect(row(chest(1, 0), 'Chest').recovery).toBe('worked-today');
    expect(row(chest(1, 1), 'Chest').recovery).toBe('recovering');
    expect(row(chest(1, 2), 'Chest').recovery).toBe('recovering');
    expect(row(chest(1, 3), 'Chest').recovery).toBe('fresh');
  });

  it('dates recovery from the MOST RECENT session, not the first', () => {
    const b = muscleBalance([set('Bench Press', 5), set('Bench Press', 1)], lookup, {}, NOW);
    expect(row(b, 'Chest').daysSince).toBe(1);
  });

  it('does not let secondary work reset the recovery clock', () => {
    // Bench two days ago involves triceps; that is not a triceps session.
    const b = muscleBalance([set('Bench Press', 2)], lookup, {}, NOW);
    expect(row(b, 'Triceps').daysSince).toBeNull();
    expect(row(b, 'Triceps').recovery).toBe('never');
  });
});

describe('underworkedMuscles', () => {
  it('puts never-trained muscles first and excludes what was worked today', () => {
    const entries = [
      ...Array.from({ length: 12 }, () => set('Bench Press', 2)), // Chest optimal
      set('Hip Thrust', 0), // Glutes under, but trained TODAY
      set('Sumo Squats', 4), // Quads under, recovered
    ];
    const list = underworkedMuscles(muscleBalance(entries, lookup, {}, NOW));
    const names = list.map((r) => r.muscle);

    expect(names).not.toContain('Chest'); // optimal
    expect(names).not.toContain('Glutes'); // worked today
    expect(names).toContain('Quadriceps');
    // zero-set muscles outrank the one with a set in it
    expect(names.indexOf('Biceps')).toBeLessThan(names.indexOf('Quadriceps'));
  });

  it('never recommends a muscle that is already over the range', () => {
    const entries = Array.from({ length: WEEKLY_SETS_MAX + 4 }, () => set('Bench Press', 2));
    const list = underworkedMuscles(muscleBalance(entries, lookup, {}, NOW));
    expect(list.map((r) => r.muscle)).not.toContain('Chest');
  });
});

describe('the window constant is what the benchmarks assume', () => {
  it('is seven days, because the benchmark is per week', () => {
    expect(BALANCE_WINDOW_DAYS).toBe(7);
  });
});

describe('suggestion ranking', () => {
  const ex = (name: string, equipment: string, level: string, secondary: string[] = []) => ({
    name,
    equipment,
    level,
    secondary_muscles: secondary,
  });

  it('puts equipment you actually use ahead of everything else', () => {
    const ranked = rankSuggestions(
      [ex('Machine Crunch', 'MACHINE', 'beginner', ['Hip flexors']), ex('Barbell Rollout', 'BARBELL', 'expert')],
      new Set(['BARBELL']),
    );
    expect(ranked[0]!.name).toBe('Barbell Rollout');
  });

  it('prefers compounds over isolation within the same equipment', () => {
    const ranked = rankSuggestions(
      [ex('Curl', 'BARBELL', 'beginner', []), ex('Row', 'BARBELL', 'beginner', ['Biceps', 'Lats'])],
      new Set(['BARBELL']),
    );
    expect(ranked[0]!.name).toBe('Row');
  });

  it('does not rank by the alphabet while a real signal is available', () => {
    // The bug this replaced: beginner-then-alphabetical opened the drawer on
    // "3/4 Sit-Up" and "Air Bike" purely because of their names.
    const ranked = rankSuggestions(
      [ex('Air Bike', 'BODYWEIGHT', 'beginner'), ex('Zercher Squat', 'BARBELL', 'beginner', ['Glutes'])],
      new Set(['BARBELL']),
    );
    expect(ranked[0]!.name).toBe('Zercher Squat');
  });

  it('reads your equipment off your own logged sets, warm-ups excluded', () => {
    const equipmentOf = (name: string) =>
      ({ 'Bench Press': 'BARBELL', 'Cable Fly': 'CABLE' })[name];
    const found = familiarEquipment(
      [set('Bench Press', 1), set('Cable Fly', 1, { warmupSet: true })],
      equipmentOf,
    );
    expect([...found]).toEqual(['BARBELL']);
  });
});

describe('programMuscles', () => {
  it('reports what the program COULD train, independent of any window', () => {
    // The bug: after a week off every muscle had zero sets, so all 17 were
    // filed as "not in your program" — including ones trained twice a week.
    const covered = programMuscles(['Bench Press', 'Hip Thrust'], lookup);
    expect([...covered].sort()).toEqual(['Chest', 'Glutes']);
  });

  it('counts only primary movers, not assisted ones', () => {
    // Bench involves triceps, but no program exercise makes triceps the mover.
    expect(programMuscles(['Bench Press'], lookup).has('Triceps')).toBe(false);
  });

  it('picks up a custom exercise through the user mapping', () => {
    const covered = programMuscles(['Bulgarian Split Squat'], lookup, {
      'Bulgarian Split Squat': 'Quadriceps',
    });
    expect([...covered]).toEqual(['Quadriceps']);
  });

  it('is empty for an unresolvable exercise with no mapping', () => {
    expect(programMuscles(['Bulgarian Split Squat'], lookup).size).toBe(0);
  });
});

describe('inference is reported, never silent', () => {
  const resolve = (name: string) =>
    name === 'Incline Press'
      ? ({ muscle: 'Chest', basis: 'unanimous', evidence: 'all 6 work Chest' } as const)
      : undefined;

  it('counts an inferred exercise AND lists it as auto-matched', () => {
    const b = muscleBalance([set('Incline Press', 1), set('Incline Press', 2)], lookup, {}, NOW, resolve);
    expect(row(b, 'Chest').primarySets).toBe(2);
    expect(b.unmatched).toEqual([]);
    expect(b.autoMatched).toEqual([
      { exercise: 'Incline Press', sets: 2, muscle: 'Chest', basis: 'unanimous', evidence: 'all 6 work Chest' },
    ]);
  });

  it('leaves what the resolver cannot answer in unmatched', () => {
    const b = muscleBalance([set('Bulgarian Split Squat', 1)], lookup, {}, NOW, resolve);
    expect(b.autoMatched).toEqual([]);
    expect(b.unmatched).toEqual([{ exercise: 'Bulgarian Split Squat', sets: 1 }]);
  });

  it('never infers over a name the library DOES resolve', () => {
    const shouty = () => ({ muscle: 'Neck', basis: 'muscle-name', evidence: 'wrong' }) as const;
    const b = muscleBalance([set('Bench Press', 1)], lookup, {}, NOW, shouty);
    expect(row(b, 'Chest').primarySets).toBe(1);
    expect(row(b, 'Neck').primarySets).toBe(0);
    expect(b.autoMatched).toEqual([]);
  });

  it('never infers over the user mapping', () => {
    const b = muscleBalance([set('Incline Press', 1)], lookup, { 'Incline Press': 'Shoulders' }, NOW, resolve);
    expect(row(b, 'Shoulders').primarySets).toBe(1);
    expect(row(b, 'Chest').primarySets).toBe(0);
    expect(b.autoMatched).toEqual([]);
  });
});
