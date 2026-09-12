/**
 * Validation must make bad data safe WITHOUT ever costing good data. These
 * tests pin the two properties that make that true: unknown fields survive,
 * and a malformed row never triggers a write that would erase the rest.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBodyweight, getEntries, getEquipmentWeights, getNotes } from './storage';
import { isLiftSet } from './types';

const KEY = 'gymlog_gymlog:entries';
const good = {
  id: 'a1',
  exercise: 'Sumo Squats',
  weight: 135,
  sets: 1,
  reps: 10,
  date: '2026-09-01',
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

describe('malformed data is contained, not amplified', () => {
  it('keeps the valid rows and drops only the broken one', () => {
    localStorage.setItem(KEY, JSON.stringify([good, { exercise: 'Bench', weight: 'heavy' }, { ...good, id: 'a2' }]));
    const entries = getEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map((e) => e.id)).toEqual(['a1', 'a2']);
  });

  it('NEVER re-saves after dropping a row, or the log would be truncated on disk', () => {
    // The surviving row has no id, so the backfill would normally re-save.
    localStorage.setItem(KEY, JSON.stringify([{ ...good, id: undefined }, { junk: true }]));
    const before = localStorage.getItem(KEY);
    getEntries();
    expect(localStorage.getItem(KEY)).toBe(before);
  });

  it('still backfills missing ids when nothing was dropped', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ ...good, id: undefined }]));
    getEntries();
    await vi.waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(KEY) as string) as { id?: string }[];
      expect(stored[0]?.id).toBeTruthy();
    });
  });

  it('falls back when the top-level shape is wrong instead of casting', () => {
    localStorage.setItem(KEY, JSON.stringify({ notAnArray: true }));
    expect(getEntries()).toEqual([]);

    localStorage.setItem('gymlog_gymlog:notes', JSON.stringify(['not', 'a', 'map']));
    expect(getNotes()).toEqual({});

    localStorage.setItem('gymlog_gymlog:equipmentWeights', JSON.stringify('55'));
    expect(getEquipmentWeights()).toEqual({ trapBar: null, legPressSled: null });
  });

  it('drops a bodyweight row with a non-numeric weight', () => {
    localStorage.setItem(
      'gymlog_gymlog:bodyweight',
      JSON.stringify([{ id: 'b1', date: '2026-09-01', weight: 128 }, { id: 'b2', date: '2026-09-02', weight: null }]),
    );
    expect(getBodyweight()).toHaveLength(1);
  });
});

describe('validation never rewrites the data it validates', () => {
  it('preserves fields this version does not know about', () => {
    // Data written by a newer build must survive being read by an older one.
    localStorage.setItem(KEY, JSON.stringify([{ ...good, someFutureFlag: true, nested: { a: 1 } }]));
    const [entry] = getEntries();
    expect(entry).toMatchObject({ someFutureFlag: true, nested: { a: 1 } });
  });

  it('leaves optional flags absent rather than filling them in', () => {
    localStorage.setItem(KEY, JSON.stringify([good]));
    const [entry] = getEntries();
    expect(entry && isLiftSet(entry)).toBe(true);
    expect(entry).not.toHaveProperty('warmupSet');
    expect(entry).not.toHaveProperty('rpe');
  });

  it('rejects a literal false where the legacy shape says absent-or-true', () => {
    localStorage.setItem(KEY, JSON.stringify([{ ...good, warmupSet: false }]));
    expect(getEntries()).toHaveLength(0);
  });
});
