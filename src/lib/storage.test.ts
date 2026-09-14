import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  clearSyncFailedFlag,
  clearTheme,
  fullKey,
  getEntries,
  getCustomExercises,
  getEquipmentWeights,
  getGoals,
  getNotes,
  getLastProgramReview,
  getSaveStatus,
  getThemeRaw,
  getWarmupProgress,
  getUnit,
  saveEntries,
  saveLastProgramReview,
  saveTheme,
  saveUnit,
  saveWarmupProgress,
  setRawWithRetry,
  STORAGE_KEYS,
  subscribeSaveStatus,
} from './storage';
import type { Entry } from './types';

describe('legacy key names', () => {
  it('are literally double-prefixed', () => {
    expect(fullKey(STORAGE_KEYS.entries)).toBe('gymlog_gymlog:entries');
    expect(fullKey(STORAGE_KEYS.unit)).toBe('gymlog_gymlog:unit');
    expect(fullKey(STORAGE_KEYS.theme)).toBe('gymlog_gymlog:theme');
    expect(fullKey(STORAGE_KEYS.lastProgramReview)).toBe('gymlog_gymlog:lastProgramReview');
    expect(fullKey(STORAGE_KEYS.equipmentWeights)).toBe('gymlog_gymlog:equipmentWeights');
  });

  it('writes entries as JSON under the exact key', async () => {
    const entries: Entry[] = [{ id: 'a1', exercise: 'Sumo Squats', weight: 135, sets: 1, reps: 10, date: '2026-08-28' }];
    await saveEntries(entries);
    expect(localStorage.getItem('gymlog_gymlog:entries')).toBe(JSON.stringify(entries));
  });
});

describe('raw string keys (NOT JSON)', () => {
  it('unit round-trips as a raw string with lbs default', async () => {
    expect(getUnit()).toBe('lbs');
    await saveUnit('kg');
    expect(localStorage.getItem('gymlog_gymlog:unit')).toBe('kg'); // no quotes
    expect(getUnit()).toBe('kg');
  });

  it('theme round-trips raw; clearTheme removes the key (system)', async () => {
    expect(getThemeRaw()).toBeNull();
    await saveTheme('dark');
    expect(localStorage.getItem('gymlog_gymlog:theme')).toBe('dark');
    await clearTheme();
    expect(localStorage.getItem('gymlog_gymlog:theme')).toBeNull();
  });

  it('lastProgramReview round-trips raw ISO date', async () => {
    expect(getLastProgramReview()).toBeNull();
    await saveLastProgramReview('2026-08-28');
    expect(localStorage.getItem('gymlog_gymlog:lastProgramReview')).toBe('2026-08-28');
    expect(getLastProgramReview()).toBe('2026-08-28');
  });
});

describe('reads with fallbacks', () => {
  it('equipmentWeights defaults to nulls', () => {
    expect(getEquipmentWeights()).toEqual({ trapBar: null, legPressSled: null });
    localStorage.setItem('gymlog_gymlog:equipmentWeights', JSON.stringify({ trapBar: 55, legPressSled: 0 }));
    expect(getEquipmentWeights()).toEqual({ trapBar: 55, legPressSled: 0 });
  });

  it('getEntries backfills missing ids and re-saves (legacy migration)', () => {
    localStorage.setItem(
      'gymlog_gymlog:entries',
      JSON.stringify([{ exercise: 'Rows', weight: 90, sets: 1, reps: 10, date: '2026-08-01' }]),
    );
    const entries = getEntries();
    expect(entries[0]?.id).toBeTruthy();
    const resaved = JSON.parse(localStorage.getItem('gymlog_gymlog:entries') ?? '[]') as Entry[];
    expect(resaved[0]?.id).toBe(entries[0]?.id);
  });

  it('corrupt JSON falls back instead of throwing', () => {
    localStorage.setItem('gymlog_gymlog:entries', '{nope');
    expect(getEntries()).toEqual([]);
  });
});

describe('save retry + auto-backup', () => {
  const realSetItem = Storage.prototype.setItem;
  let clickSpy: MockInstance<() => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:test');
    URL.revokeObjectURL = vi.fn();
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    Storage.prototype.setItem = realSetItem;
    vi.useRealTimers();
    clickSpy.mockRestore();
    clearSyncFailedFlag();
  });

  it('retries with 300/800/1800ms backoff then succeeds', async () => {
    let failures = 2;
    const attempts: number[] = [];
    Storage.prototype.setItem = vi.fn(function (this: Storage, key: string, value: string) {
      attempts.push(Date.now());
      if (failures-- > 0) throw new Error('quota');
      realSetItem.call(this, key, value);
    });

    const promise = setRawWithRetry(STORAGE_KEYS.notes, '{}', 'Notes');
    await vi.advanceTimersByTimeAsync(300); // first retry
    await vi.advanceTimersByTimeAsync(800); // second retry succeeds
    await expect(promise).resolves.toBe(true);
    expect(attempts).toHaveLength(3);
    expect(localStorage.getItem('gymlog_gymlog:notes')).toBe('{}');
    expect(getSaveStatus().lastSavedAt).not.toBeNull();
    expect(getSaveStatus().pendingSyncFailed).toBe(false);
  });

  it('downloads an auto-backup and flags sync-failed after final failure', async () => {
    const statuses: boolean[] = [];
    const unsubscribe = subscribeSaveStatus((s) => statuses.push(s.pendingSyncFailed));
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('quota exceeded');
    });

    const promise = setRawWithRetry(STORAGE_KEYS.entries, '[]', 'Workout log');
    await vi.advanceTimersByTimeAsync(300 + 800 + 1800);
    await expect(promise).resolves.toBe(false);

    expect(getSaveStatus().pendingSyncFailed).toBe(true);
    expect(statuses).toContain(true);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // 1-minute cooldown: a second failure doesn't download again...
    const second = setRawWithRetry(STORAGE_KEYS.entries, '[]', 'Workout log');
    await vi.advanceTimersByTimeAsync(300 + 800 + 1800);
    await expect(second).resolves.toBe(false);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // ...but after the cooldown expires it does.
    await vi.advanceTimersByTimeAsync(60000);
    const third = setRawWithRetry(STORAGE_KEYS.entries, '[]', 'Workout log');
    await vi.advanceTimersByTimeAsync(300 + 800 + 1800);
    await expect(third).resolves.toBe(false);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});

/**
 * Maps of the user's OWN content must lose only the bad row, never the lot.
 *
 * These read through `validOr`, which discards the whole map on any mismatch.
 * That is fine for config, but it made one unreadable custom exercise take out
 * every custom exercise on every day — and with them the Settings section that
 * restores an archived one, which only renders when the list is non-empty. The
 * archived exercises looked deleted.
 */
describe('user-content maps survive a bad row', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the custom exercises that validate', () => {
    localStorage.setItem(
      fullKey(STORAGE_KEYS.customExercises),
      JSON.stringify({
        'Lower A': [
          { name: 'Good', goal: 60, targetSets: 3, targetReps: '12', prefillReps: 12, custom: true, notes: null },
          { name: 'Broken', custom: true },
        ],
        'Upper A': [
          { name: 'Archived One', goal: 40, targetSets: 3, targetReps: '10', prefillReps: 10, custom: true, notes: null, archived: true },
        ],
      }),
    );

    const map = getCustomExercises();
    expect(map['Lower A']?.map((e) => e.name)).toEqual(['Good']);
    // The archived one on another day must be untouched — that is the bug.
    expect(map['Upper A']?.[0]?.archived).toBe(true);
  });

  /** Exercises predating the notes feature have no `notes` key at all. */
  it('accepts a custom exercise with no notes key', () => {
    localStorage.setItem(
      fullKey(STORAGE_KEYS.customExercises),
      JSON.stringify({
        'Lower A': [{ name: 'Old One', goal: 60, targetSets: 3, targetReps: '12', prefillReps: 12, custom: true }],
      }),
    );

    expect(getCustomExercises()['Lower A']).toHaveLength(1);
  });

  it('keeps the notes and goals that validate', () => {
    localStorage.setItem(
      fullKey(STORAGE_KEYS.notes),
      JSON.stringify({ '2026-08-24': 'felt strong', 'not-a-date': 'junk', '2026-08-25': 7 }),
    );
    localStorage.setItem(fullKey(STORAGE_KEYS.goals), JSON.stringify({ 'Sumo Squats': 185, Deadlifts: 'heavy' }));

    expect(getNotes()).toEqual({ '2026-08-24': 'felt strong' });
    expect(getGoals()).toEqual({ 'Sumo Squats': 185 });
  });

  it('does not rewrite storage as a result of reading', () => {
    const raw = JSON.stringify({ 'Lower A': [{ name: 'Broken', custom: true }] });
    localStorage.setItem(fullKey(STORAGE_KEYS.customExercises), raw);

    getCustomExercises();
    expect(localStorage.getItem(fullKey(STORAGE_KEYS.customExercises))).toBe(raw);
  });
});

describe('warm-up progress (scratch state)', () => {
  const progress = { date: '2026-09-13', shuffles: 2, items: ['cardio:Jump rope', 'lower:Hip circles'] };

  it('round-trips the ticks AND the shuffle nonce', async () => {
    await saveWarmupProgress(progress);
    expect(getWarmupProgress('2026-09-13')).toEqual(progress);
  });

  /**
   * The plan is redrawn each day, so yesterday's ticks name movements that are
   * no longer on screen. Returning them would check off the wrong rows.
   */
  it('discards a value stored on any other date', async () => {
    await saveWarmupProgress(progress);
    expect(getWarmupProgress('2026-09-14')).toBeNull();
    expect(getWarmupProgress('2026-09-12')).toBeNull();
  });

  it('falls back to nothing ticked when the stored shape is wrong', () => {
    localStorage.setItem(fullKey(STORAGE_KEYS.warmupProgress), JSON.stringify({ date: '2026-09-13', items: 'nope' }));
    expect(getWarmupProgress('2026-09-13')).toBeNull();
  });

  it('does not rewrite storage as a result of reading a stale value', () => {
    const raw = JSON.stringify({ date: '2026-01-01', shuffles: 0, items: ['cardio:Jump rope'] });
    localStorage.setItem(fullKey(STORAGE_KEYS.warmupProgress), raw);

    expect(getWarmupProgress('2026-09-13')).toBeNull();
    expect(localStorage.getItem(fullKey(STORAGE_KEYS.warmupProgress))).toBe(raw);
  });

  /**
   * The one key intentionally missing from exports — assert it stays missing.
   *
   * Imports a FRESH storage module: `autoBackupCooldown` is module state, and
   * an earlier test's useRealTimers() drops the timeout that would clear it, so
   * the shared module refuses to build a second backup at all.
   */
  it('is absent from the emergency backup payload', async () => {
    vi.resetModules();
    const storage = await import('./storage');
    const realSetItem = Storage.prototype.setItem;
    vi.useFakeTimers();

    await storage.saveWarmupProgress(progress);
    await storage.saveDailyMetrics({ '2026-09-13': { calories: 2000 } });

    let body = '';
    URL.createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then((t) => {
        body = t;
      });
      return 'blob:test';
    }) as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('quota exceeded');
    });

    const promise = storage.setRawWithRetry(storage.STORAGE_KEYS.entries, '[]', 'Workout log');
    await vi.advanceTimersByTimeAsync(300 + 800 + 1800);
    await expect(promise).resolves.toBe(false);
    Storage.prototype.setItem = realSetItem;
    await vi.advanceTimersByTimeAsync(0); // let blob.text() settle

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    // A present key proves the payload was really built; the absent one is the point.
    expect(body).toContain('dailyMetrics');
    expect(body).not.toContain('warmupProgress');

    /*
     * Everything else must be in there. This dump fires when a save has just
     * failed — the moment you most need a complete file — and until
     * 2026-09-13 it carried only the legacy five plus metrics, silently
     * omitting custom exercises, measurements and the whole program structure.
     */
    for (const field of [
      'customExercises',
      'excludedBuiltIns',
      'coreOverrides',
      'measurements',
      'equipmentWeights',
      'days',
      'exerciseOrder',
      'weightInputModes',
      'barWeight',
      'lastProgramReview',
    ]) {
      expect(body).toContain(field);
    }

    clickSpy.mockRestore();
    vi.useRealTimers();
  });
});
