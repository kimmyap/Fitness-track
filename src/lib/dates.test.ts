/**
 * The date module's own tests. The range-level consequences are pinned in
 * `domain.timezone.test.ts`; this file pins the primitives.
 */
import { describe, it, expect } from 'vitest';
import { dateWindow, daysSince, isoDate, parseIsoDate, startOfDay } from './dates';

describe('isoDate / parseIsoDate are exact inverses', () => {
  it('round-trips a local date', () => {
    const d = new Date(2026, 8, 21, 17, 30);
    expect(isoDate(d)).toBe('2026-09-21');
    expect(parseIsoDate('2026-09-21')?.getDate()).toBe(21);
    expect(parseIsoDate(isoDate(d))?.getTime()).toBe(startOfDay(d).getTime());
  });

  it('parses to LOCAL midnight, never UTC midnight', () => {
    // The whole reason this module exists: new Date("2026-09-21") is UTC.
    const parsed = parseIsoDate('2026-09-21')!;
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(21);
  });

  it('returns null for a non-date rather than an Invalid Date', () => {
    // Invalid Date compares false in BOTH directions, which silently drops rows.
    for (const bad of ['', 'not-a-date', '2026-09', 'yyyy-mm-dd']) {
      expect(parseIsoDate(bad)).toBeNull();
    }
  });
});

describe('daysSince', () => {
  const now = new Date(2026, 8, 24, 18, 0);

  it('counts whole calendar days, not elapsed hours', () => {
    expect(daysSince('2026-09-24', now)).toBe(0);
    expect(daysSince('2026-09-23', now)).toBe(1);
    expect(daysSince('2026-09-17', now)).toBe(7);
  });

  it('never goes negative when the date is in the future', () => {
    expect(daysSince('2026-10-01', now)).toBe(0);
  });

  it('is 0 for a malformed date', () => {
    expect(daysSince('nope', now)).toBe(0);
  });
});

describe('dateWindow', () => {
  it('returns `days` days ending at `end`, oldest first', () => {
    expect(dateWindow(new Date(2026, 8, 24), 3)).toEqual(['2026-09-22', '2026-09-23', '2026-09-24']);
  });

  it('crosses a month boundary correctly', () => {
    expect(dateWindow(new Date(2026, 9, 2), 4)).toEqual([
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
    ]);
  });

  it('handles a single day', () => {
    expect(dateWindow(new Date(2026, 8, 24), 1)).toEqual(['2026-09-24']);
  });
});
