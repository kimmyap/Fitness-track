import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  dayFlagsMap,
  daySummary,
  isoFor,
  monthCells,
  monthLabel,
  shiftMonth,
} from './calendarMath';
import type { Entry } from '@/lib/types';

describe('monthCells', () => {
  it('pads leading blanks to the first weekday (Aug 2026 starts on a Saturday)', () => {
    const cells = monthCells(2026, 7); // August 2026
    // 2026-08-01 is a Saturday → 6 leading blanks
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toEqual({ iso: '2026-08-01', day: 1 });
    expect(cells).toHaveLength(6 + 31);
    expect(cells[cells.length - 1]).toEqual({ iso: '2026-08-31', day: 31 });
  });

  it('starts flush when the month begins on a Sunday (Feb 2026)', () => {
    const cells = monthCells(2026, 1);
    expect(cells[0]).toEqual({ iso: '2026-02-01', day: 1 });
    expect(cells).toHaveLength(28);
  });

  it('handles leap-year February (2024)', () => {
    const cells = monthCells(2024, 1);
    const days = cells.filter(Boolean);
    expect(days).toHaveLength(29);
    expect(days[days.length - 1]).toEqual({ iso: '2024-02-29', day: 29 });
  });
});

describe('monthLabel / isoFor', () => {
  it('formats the month heading', () => {
    expect(monthLabel(2026, 0)).toBe('January 2026');
    expect(monthLabel(2026, 11)).toBe('December 2026');
  });

  it('zero-pads iso dates', () => {
    expect(isoFor(2026, 0, 3)).toBe('2026-01-03');
    expect(isoFor(2026, 10, 21)).toBe('2026-11-21');
  });
});

describe('shiftMonth', () => {
  it('moves forward and backward within a year', () => {
    expect(shiftMonth(2026, 5, 1)).toEqual({ year: 2026, monthIndex: 6 });
    expect(shiftMonth(2026, 5, -1)).toEqual({ year: 2026, monthIndex: 4 });
  });

  it('wraps across year boundaries like legacy prev/next', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 });
  });
});

describe('addDaysIso', () => {
  it('adds and subtracts days', () => {
    expect(addDaysIso('2026-08-28', 1)).toBe('2026-08-29');
    expect(addDaysIso('2026-08-28', -7)).toBe('2026-08-21');
  });

  it('rolls across month and year boundaries', () => {
    expect(addDaysIso('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDaysIso('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDaysIso('2024-02-28', 1)).toBe('2024-02-29');
  });
});

const lift = (over: Partial<Extract<Entry, { exercise: string }>> & { exercise: string }): Entry => ({
  id: Math.random().toString(36).slice(2),
  weight: 100,
  sets: 1,
  reps: 10,
  date: '2026-08-28',
  ...over,
});

describe('dayFlagsMap', () => {
  it('flags lift days and activity/warmup/core days independently', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Sumo Squats', date: '2026-08-25' }),
      { id: 'a', type: 'activity', activity: 'Pilates', date: '2026-08-26' },
      { id: 'b', type: 'warmup', date: '2026-08-25' },
      { id: 'c', type: 'core', date: '2026-08-27' },
    ];
    const map = dayFlagsMap(entries);
    expect(map['2026-08-25']).toEqual({ hasLift: true, hasActivity: true });
    expect(map['2026-08-26']).toEqual({ hasLift: false, hasActivity: true });
    expect(map['2026-08-27']).toEqual({ hasLift: false, hasActivity: true });
    expect(map['2026-08-28']).toBeUndefined();
  });
});

describe('daySummary', () => {
  it('counts unique exercises (warm-ups included) but sums only working volume', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Sumo Squats', weight: 100, reps: 10 }), // 1000
      lift({ exercise: 'Sumo Squats', weight: 105, reps: 8 }), // 840
      lift({ exercise: 'Deadlifts', weight: 45, reps: 10, warmupSet: true }), // excluded from volume
      lift({ exercise: 'Lat Pulldown', weight: 30, reps: 8, assistedPullup: true }), // excluded from volume
      { id: 'w', type: 'warmup', date: '2026-08-28' },
    ];
    expect(daySummary(entries)).toEqual({ exerciseCount: 3, volumeLbs: 1840 });
  });

  it('multiplies legacy multi-set rows by their sets count', () => {
    const entries: Entry[] = [lift({ exercise: 'Rows', weight: 50, sets: 3, reps: 10 })];
    expect(daySummary(entries)).toEqual({ exerciseCount: 1, volumeLbs: 1500 });
  });

  it('is empty for a day with nothing logged', () => {
    expect(daySummary([])).toEqual({ exerciseCount: 0, volumeLbs: 0 });
  });

  it('ignores zero-weight bodyweight sets in volume but counts the exercise', () => {
    const entries: Entry[] = [lift({ exercise: 'Hip Thrust', weight: 0, reps: 12, variation: 'Bodyweight' })];
    expect(daySummary(entries)).toEqual({ exerciseCount: 1, volumeLbs: 0 });
  });
});
