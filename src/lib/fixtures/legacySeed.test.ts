/**
 * Proves the app's core promise: a pre-v2 user's localStorage survives the
 * rebuild. Every assertion here reads through the real storage accessors, not
 * through JSON.parse, so it fails if an accessor starts reshaping legacy data.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { applyLegacySeed, LEGACY_SEED } from './legacySeed';
import {
  fullKey,
  STORAGE_KEYS,
  getBarWeight,
  getBodyweight,
  getCoreOverrides,
  getCustomExercises,
  getDays,
  getEntries,
  getEquipmentWeights,
  getExcludedBuiltIns,
  getExerciseOrder,
  getGoals,
  getLastProgramReview,
  getMeasurements,
  getNotes,
  getSeenAchievements,
  getThemeRaw,
  getUnit,
  getWeightInputModes,
} from '../storage';
import { isActivity, isCompletion, isLiftSet, type LiftSetEntry } from '../types';

beforeEach(() => {
  localStorage.clear();
  applyLegacySeed(localStorage);
});

const liftNamed = (name: string): LiftSetEntry => {
  const found = getEntries().filter(isLiftSet).find((e) => e.exercise === name);
  if (!found) throw new Error(`seed is missing a lift entry for "${name}"`);
  return found;
};

describe('the seed is legacy-shaped on disk', () => {
  it('writes only double-prefixed keys', () => {
    for (const key of Object.keys(LEGACY_SEED)) {
      expect(key.startsWith('gymlog_gymlog:')).toBe(true);
    }
  });

  // The fixture spells its keys literally, so this is what stops the two
  // drifting apart: rename a key in STORAGE_KEYS and the fixture goes stale here.
  it('spells the same keys the app reads', () => {
    const legacyKeys = [
      'entries', 'notes', 'goals', 'bodyweight', 'achievements', 'unit',
      'customExercises', 'excludedBuiltIns', 'lastProgramReview',
      'coreOverrides', 'theme', 'measurements', 'equipmentWeights',
    ] as const;
    expect(Object.keys(LEGACY_SEED).sort()).toEqual(
      legacyKeys.map((k) => fullKey(STORAGE_KEYS[k])).sort(),
    );
  });

  it('seeds exactly the 13 legacy keys and none of the four new ones', () => {
    expect(Object.keys(LEGACY_SEED)).toHaveLength(13);
    for (const added of ['weightInputModes', 'barWeight', 'exerciseOrder', 'days']) {
      expect(localStorage.getItem(`gymlog_gymlog:${added}`)).toBeNull();
    }
  });

  it('stores unit, theme and lastProgramReview raw, not JSON-quoted', () => {
    expect(localStorage.getItem('gymlog_gymlog:unit')).toBe('lbs');
    expect(localStorage.getItem('gymlog_gymlog:theme')).toBe('dark');
    expect(localStorage.getItem('gymlog_gymlog:lastProgramReview')).toBe('2026-07-20');
  });
});

describe('a migrating user keeps every legacy key', () => {
  it('reads scalars and maps back unchanged', () => {
    expect(getUnit()).toBe('lbs');
    expect(getThemeRaw()).toBe('dark');
    expect(getLastProgramReview()).toBe('2026-07-20');
    expect(getNotes()['2026-08-24']).toBe('Slept badly, squats felt heavy');
    expect(getGoals()['Sumo Squats']).toBe(145);
    expect(getSeenAchievements()).toContain('first-pr');
    expect(getBodyweight()).toHaveLength(2);
    expect(getExcludedBuiltIns()['Lower A']).toEqual(['KB Swings']);
    expect(getCoreOverrides()['Plank']).toEqual({ name: 'RKC Plank', target: '3 x 15-20 sec' });
  });

  it('keeps an explicit 0 sled weight distinct from null', () => {
    expect(getEquipmentWeights()).toEqual({ trapBar: 55, legPressSled: 0 });
  });

  it('keeps a null measurement field rather than dropping the row', () => {
    const [, second] = getMeasurements();
    expect(second).toMatchObject({ waist: 29, hips: null });
  });

  it('keeps archived custom exercises and their null notes', () => {
    const [active, archived] = getCustomExercises()['Lower A'] ?? [];
    expect(active).toMatchObject({ name: 'Bulgarian Split Squat', custom: true });
    expect(active).not.toHaveProperty('archived');
    expect(archived).toMatchObject({ name: 'Calf Raises', notes: null, archived: true });
  });
});

describe('the heterogeneous entries array', () => {
  it('preserves all three variants in one array', () => {
    const entries = getEntries();
    expect(entries.filter(isLiftSet)).toHaveLength(9);
    expect(entries.filter(isActivity)).toHaveLength(2);
    expect(entries.filter((e) => isCompletion(e, 'warmup'))).toHaveLength(1);
    expect(entries.filter((e) => isCompletion(e, 'core'))).toHaveLength(1);
  });

  it('leaves optional fields absent rather than null or false', () => {
    const deadlift = liftNamed('Deadlifts');
    expect(deadlift).not.toHaveProperty('rpe');
    expect(deadlift).not.toHaveProperty('variation');
    expect(deadlift).not.toHaveProperty('warmupSet');
    expect(deadlift).not.toHaveProperty('assistedPullup');
  });

  it('flags warm-up and assisted sets only when true', () => {
    expect(liftNamed('Sumo Squats')).not.toHaveProperty('warmupSet');
    const warmup = getEntries()
      .filter(isLiftSet)
      .find((e) => e.warmupSet === true);
    expect(warmup).toMatchObject({ exercise: 'Sumo Squats', weight: 45 });
    expect(liftNamed('Lat Pulldown').assistedPullup).toBe(true);
  });

  it('keeps a 0-weight bodyweight log as a real set', () => {
    expect(liftNamed('Leg Press / Lunges')).toMatchObject({ weight: 0, reps: 15 });
  });

  it('keeps legacy multi-set rows at sets > 1', () => {
    expect(liftNamed('Hip Thrust').sets).toBe(3);
  });

  it('backfills a missing id and persists the backfill', () => {
    const backfilled = liftNamed('Rows');
    expect(backfilled.id).toBeTruthy();
    const reread = JSON.parse(localStorage.getItem('gymlog_gymlog:entries') as string) as LiftSetEntry[];
    expect(reread.find((e) => e.exercise === 'Rows')?.id).toBe(backfilled.id);
  });
});

describe('keys the rebuild added but a legacy profile never wrote', () => {
  it('fall back to empty defaults instead of throwing', () => {
    expect(getWeightInputModes()).toEqual({});
    expect(getExerciseOrder()).toEqual({});
    expect(getDays()).toEqual([]);
    expect(getBarWeight()).toBeNull();
  });
});
