import { describe, expect, it } from 'vitest';
import {
  bodyweightSeries,
  est1RMSeries,
  exercisesWithHistory,
  filterRange,
  formatCompact,
  topSetSeries,
  weeklyVolumeSeries,
} from './chartData';
import type { Entry, LiftSetEntry } from '@/lib/types';

let n = 0;
const lift = (over: Partial<LiftSetEntry> & { exercise: string; date: string }): Entry => ({
  id: `id-${n++}`,
  weight: 100,
  sets: 1,
  reps: 10,
  ...over,
});

describe('exercisesWithHistory', () => {
  it('lists built-ins in program order, then others alphabetically', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Zebra Walks', date: '2026-08-01' }),
      lift({ exercise: 'Bench Press', date: '2026-08-02' }),
      lift({ exercise: 'Sumo Squats', date: '2026-08-03' }),
      lift({ exercise: 'Arnold Press', date: '2026-08-04' }),
      { id: 'a', type: 'activity', activity: 'Pilates', date: '2026-08-05' },
    ];
    expect(exercisesWithHistory(entries)).toEqual(['Sumo Squats', 'Bench Press', 'Arnold Press', 'Zebra Walks']);
  });

  it('is empty with no lift entries', () => {
    expect(exercisesWithHistory([{ id: 'w', type: 'warmup', date: '2026-08-01' }])).toEqual([]);
  });
});

describe('est1RMSeries', () => {
  it('takes the best Epley estimate per day, chronological', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Bench Press', date: '2026-08-02', weight: 100, reps: 5 }), // 116.67
      lift({ exercise: 'Bench Press', date: '2026-08-02', weight: 95, reps: 10 }), // 126.67 ← day best
      lift({ exercise: 'Bench Press', date: '2026-08-01', weight: 90, reps: 6 }), // 108
    ];
    expect(est1RMSeries(entries, 'Bench Press')).toEqual([
      { date: '2026-08-01', value: 108 },
      { date: '2026-08-02', value: 127 },
    ]);
  });

  it('excludes warm-up sets, assisted pull-ups, other exercises, and zero-weight sets', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Bench Press', date: '2026-08-01', weight: 45, reps: 10, warmupSet: true }),
      lift({ exercise: 'Lat Pulldown', date: '2026-08-01', weight: 30, reps: 8, assistedPullup: true }),
      lift({ exercise: 'Rows', date: '2026-08-01', weight: 80, reps: 10 }),
      lift({ exercise: 'Bench Press', date: '2026-08-01', weight: 0, reps: 12 }),
    ];
    expect(est1RMSeries(entries, 'Bench Press')).toEqual([]);
    expect(est1RMSeries(entries, 'Lat Pulldown')).toEqual([]);
  });
});

describe('topSetSeries', () => {
  it('takes the heaviest working set per day', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Deadlifts', date: '2026-08-05', weight: 185, reps: 6 }),
      lift({ exercise: 'Deadlifts', date: '2026-08-05', weight: 195, reps: 4 }),
      lift({ exercise: 'Deadlifts', date: '2026-08-01', weight: 175, reps: 8 }),
      lift({ exercise: 'Deadlifts', date: '2026-08-05', weight: 225, reps: 1, warmupSet: true }),
    ];
    expect(topSetSeries(entries, 'Deadlifts')).toEqual([
      { date: '2026-08-01', value: 175 },
      { date: '2026-08-05', value: 195 },
    ]);
  });
});

describe('filterRange', () => {
  const series = [
    { date: '2025-08-01', value: 1 },
    { date: '2026-02-01', value: 2 },
    { date: '2026-08-10', value: 3 },
    { date: '2026-08-27', value: 4 },
  ];
  const now = new Date(2026, 7, 28); // 2026-08-28 local

  it('keeps everything for All', () => {
    expect(filterRange(series, 'All', now)).toHaveLength(4);
  });

  it('4W keeps the trailing 28 days', () => {
    expect(filterRange(series, '4W', now).map((p) => p.value)).toEqual([3, 4]);
  });

  it('1Y keeps the trailing 365 days', () => {
    expect(filterRange(series, '1Y', now).map((p) => p.value)).toEqual([2, 3, 4]);
  });

  it('includes points exactly on the cutoff', () => {
    const s = [{ date: '2026-07-31', value: 9 }];
    expect(filterRange(s, '4W', now)).toHaveLength(1); // cutoff = 2026-07-31
  });
});

describe('weeklyVolumeSeries', () => {
  // Friday 2026-08-28 → current Mon-based week starts Monday 2026-08-24.
  const now = new Date(2026, 7, 28);

  it('buckets working-set volume into Monday-based weeks with zero-filled gaps', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Rows', date: '2026-08-25', weight: 100, reps: 10 }), // current week: 1000
      lift({ exercise: 'Rows', date: '2026-08-30', weight: 50, reps: 10 }), // Sunday, still current week: +500
      lift({ exercise: 'Rows', date: '2026-08-12', weight: 80, reps: 10 }), // two weeks back: 800
      lift({ exercise: 'Rows', date: '2026-08-13', weight: 45, reps: 10, warmupSet: true }), // excluded
    ];
    const weeks = weeklyVolumeSeries(entries, 4, now);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24']);
    expect(weeks.map((w) => w.volume)).toEqual([0, 800, 0, 1500]);
    expect(weeks.map((w) => w.isCurrent)).toEqual([false, false, false, true]);
    expect(weeks[3]?.label).toBe('8/24');
  });

  it('handles a Sunday "now" as the end of the current Mon-based week', () => {
    const sunday = new Date(2026, 7, 30);
    const weeks = weeklyVolumeSeries([], 2, sunday);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-08-17', '2026-08-24']);
  });
});

describe('bodyweightSeries', () => {
  it('sorts chronologically, keeping same-day insertion order', () => {
    const series = bodyweightSeries([
      { id: 'b', date: '2026-08-20', weight: 129 },
      { id: 'a', date: '2026-08-01', weight: 131 },
      { id: 'c', date: '2026-08-20', weight: 128.5 },
    ]);
    expect(series).toEqual([
      { date: '2026-08-01', value: 131 },
      { date: '2026-08-20', value: 129 },
      { date: '2026-08-20', value: 128.5 },
    ]);
  });
});

describe('formatCompact', () => {
  it('formats small, thousand and ten-thousand values', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(950.4)).toBe('950');
    expect(formatCompact(1234)).toBe('1.2k');
    expect(formatCompact(12345)).toBe('12k');
    expect(formatCompact(0)).toBe('0');
  });
});
