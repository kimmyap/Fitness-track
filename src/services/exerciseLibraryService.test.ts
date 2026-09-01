/**
 * These tests run against the real generated exerciseLibrary.json, so they
 * double as a guard on the data: if the upstream dataset renames an exercise,
 * the legacy-mapping test fails instead of the app silently losing metadata.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_NAME_MAP,
  alternativesFor,
  getExerciseLibrary,
  getUnmappedLegacyTargets,
  isLibraryLoaded,
  lookupExercise,
  normalizeName,
  resetExerciseLibraryCache,
  resolveExerciseMetadata,
} from './exerciseLibraryService';
import { DAYS } from '@/lib/program';

beforeEach(() => {
  resetExerciseLibraryCache();
});

describe('normalizeName', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeName('Barbell Bench Press - Medium Grip')).toBe('barbell bench press medium grip');
    expect(normalizeName('Pull-Up!')).toBe('pull up');
    expect(normalizeName('  Leg Press / Lunges  ')).toBe('leg press lunges');
  });
});

describe('getExerciseLibrary', () => {
  it('loads the library lazily and caches it', async () => {
    expect(isLibraryLoaded()).toBe(false);
    const library = await getExerciseLibrary();
    expect(library.length).toBeGreaterThan(800);
    expect(isLibraryLoaded()).toBe(true);
    // Second call returns the same array instance rather than re-importing.
    expect(await getExerciseLibrary()).toBe(library);
  });

  it('shares one in-flight load between concurrent callers', async () => {
    const [a, b] = await Promise.all([getExerciseLibrary(), getExerciseLibrary()]);
    expect(a).toBe(b);
  });

  it('produces entries matching the documented shape', async () => {
    const library = await getExerciseLibrary();
    const bench = library.find((e) => e.name === 'Barbell Bench Press - Medium Grip');
    expect(bench).toBeDefined();
    expect(bench?.equipment).toBe('BARBELL');
    expect(bench?.movement_pattern).toBe('HORIZONTAL_PUSH');
    expect(bench?.default_setup.supports_plate_calculator).toBe(true);
    expect(bench?.default_setup.bar_weight_lbs).toBe(45);
    expect(bench?.execution_cues.length).toBeGreaterThan(0);
  });
});

describe('legacy name resolution', () => {
  it('resolves every exercise in the built-in program', async () => {
    await getExerciseLibrary();
    const programNames = [...new Set(Object.values(DAYS).flat().map((e) => e.name))];
    const unresolved = programNames.filter((name) => !lookupExercise(name));
    expect(unresolved).toEqual([]);
  });

  it('has no LEGACY_NAME_MAP target missing from the library', async () => {
    await getExerciseLibrary();
    expect(getUnmappedLegacyTargets()).toEqual([]);
  });

  it('maps this app names onto the intended library entries', async () => {
    await getExerciseLibrary();
    expect(lookupExercise('Bench Press')?.name).toBe('Barbell Bench Press - Medium Grip');
    expect(lookupExercise('Hip Thrust')?.name).toBe('Barbell Hip Thrust');
    expect(lookupExercise('Lat Pulldown')?.name).toBe('Wide-Grip Lat Pulldown');
    expect(lookupExercise('Leg Press / Lunges')?.name).toBe('Leg Press');
  });

  it('covers every LEGACY_NAME_MAP key, punctuation and casing included', async () => {
    await getExerciseLibrary();
    for (const key of Object.keys(LEGACY_NAME_MAP)) {
      expect(lookupExercise(key.toUpperCase()), `expected ${key} to resolve`).toBeDefined();
    }
  });
});

describe('fallback resolution', () => {
  it('matches the singular form of a plural log name', async () => {
    await getExerciseLibrary();
    // "Barbell Curls" is not a library name; "Barbell Curl" is.
    expect(lookupExercise('Barbell Curls')).toBeDefined();
  });

  it('returns undefined rather than guessing when a prefix is ambiguous', async () => {
    await getExerciseLibrary();
    // Many entries start with "barbell", so this must not resolve to one.
    expect(lookupExercise('Barbell')).toBeUndefined();
  });

  it('returns undefined for names with no plausible match', async () => {
    await getExerciseLibrary();
    expect(lookupExercise('Interpretive Dance')).toBeUndefined();
    expect(lookupExercise('')).toBeUndefined();
  });
});

describe('resolveExerciseMetadata', () => {
  it('loads the library on first use', async () => {
    expect(isLibraryLoaded()).toBe(false);
    const meta = await resolveExerciseMetadata('Deadlifts');
    expect(meta?.name).toBe('Barbell Deadlift');
  });
});

describe('alternativesFor', () => {
  it('resolves alternative ids to library entries sharing the movement pattern', async () => {
    const library = await getExerciseLibrary();
    const squat = library.find((e) => e.name === 'Barbell Squat');
    expect(squat).toBeDefined();
    const alts = alternativesFor(squat!);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.every((a) => a.movement_pattern === squat!.movement_pattern)).toBe(true);
    expect(alts.some((a) => a.id === squat!.id)).toBe(false);
  });
});
