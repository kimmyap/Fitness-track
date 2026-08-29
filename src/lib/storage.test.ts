import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  clearSyncFailedFlag,
  clearTheme,
  fullKey,
  getEntries,
  getEquipmentWeights,
  getLastProgramReview,
  getSaveStatus,
  getThemeRaw,
  getUnit,
  saveEntries,
  saveLastProgramReview,
  saveTheme,
  saveUnit,
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
