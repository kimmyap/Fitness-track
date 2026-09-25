/**
 * Range maths, pinned in timezones that are NOT the one CI runs in.
 *
 * This file exists because a live bug hid behind a green suite for the whole
 * project: `volumeInRange` parsed entry dates as UTC midnight while
 * `weekRange` / `monthRange` build LOCAL boundaries. In America/Los_Angeles
 * every Monday's sets and the 1st of every month fell outside their own range,
 * so `weeklyRecap` reported half its true total. CI runs in UTC, where the two
 * clocks coincide and everything passes.
 *
 * Node applies `process.env.TZ` to Date operations that follow it, so each
 * block sets the zone it needs. The first assertion in this file checks that
 * the mutation ACTUALLY took effect — without it, a change in Node's behaviour
 * would turn every test below into a vacuous pass in UTC.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  computeStats,
  daysSinceBackup,
  monthRange,
  monthlyRecap,
  volumeInRange,
  weekRange,
  weeklyRecap,
  weeksSinceReview,
} from './domain';
import type { Entry } from './types';

/*
 * Reached through `globalThis` rather than the bare `process` global: the src
 * tsconfig has no node types, and adding @types/node to typecheck one test file
 * is a dependency for a two-line problem.
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
const ORIGINAL_TZ = env?.TZ;

function setZone(tz: string) {
  if (env) env.TZ = tz;
}

afterAll(() => {
  if (env) env.TZ = ORIGINAL_TZ;
});

/** 1000 volume each, so a dropped set is obvious in the total. */
function set(date: string): Entry {
  return { id: date, exercise: 'Bench Press', weight: 100, sets: 1, reps: 10, date } as Entry;
}

/** Wednesday 23 Sep 2026, local noon — mid-week so both edges are in range. */
const wednesday = () => new Date(2026, 8, 23, 12, 0, 0);

describe('the timezone mutation actually works', () => {
  it('changes the offset Date reports, or every test below is vacuous', () => {
    setZone('UTC');
    const utc = new Date(2026, 8, 23, 12).getTimezoneOffset();
    setZone('America/Los_Angeles');
    const la = new Date(2026, 8, 23, 12).getTimezoneOffset();
    expect(utc).toBe(0);
    expect(la).not.toBe(0);
  });
});

describe.each(['UTC', 'America/Los_Angeles', 'Australia/Sydney', 'Asia/Kolkata'])(
  'volume ranges in %s',
  (tz) => {
    beforeEach(() => setZone(tz));

    it('counts the first day of the week', () => {
      const [mon, sun] = weekRange(0, wednesday());
      // Monday 21 Sep 2026 is the first day of that week.
      expect(volumeInRange([set('2026-09-21')], mon, sun)).toBe(1000);
    });

    it('counts the last day of the week', () => {
      const [mon, sun] = weekRange(0, wednesday());
      expect(volumeInRange([set('2026-09-27')], mon, sun)).toBe(1000);
    });

    it('excludes the day before and the day after the week', () => {
      const [mon, sun] = weekRange(0, wednesday());
      expect(volumeInRange([set('2026-09-20')], mon, sun)).toBe(0);
      expect(volumeInRange([set('2026-09-28')], mon, sun)).toBe(0);
    });

    it('counts the first and last day of the month', () => {
      const [start, end] = monthRange(0, wednesday());
      expect(volumeInRange([set('2026-09-01')], start, end)).toBe(1000);
      expect(volumeInRange([set('2026-09-30')], start, end)).toBe(1000);
    });

    it('excludes the neighbouring months', () => {
      const [start, end] = monthRange(0, wednesday());
      expect(volumeInRange([set('2026-08-31')], start, end)).toBe(0);
      expect(volumeInRange([set('2026-10-01')], start, end)).toBe(0);
    });

    it('reports the whole week in weeklyRecap', () => {
      const entries = [set('2026-09-21'), set('2026-09-23'), set('2026-09-27')];
      expect(weeklyRecap(entries, wednesday()).thisWeek).toBe(3000);
    });

    it('reports the whole month in monthlyRecap', () => {
      const entries = [set('2026-09-01'), set('2026-09-23'), set('2026-09-30')];
      expect(monthlyRecap(entries, wednesday()).thisMonth).toBe(3000);
    });
  },
);

describe('a malformed date is skipped, not compared as Invalid Date', () => {
  beforeEach(() => setZone('America/Los_Angeles'));

  it('contributes nothing rather than throwing', () => {
    const [mon, sun] = weekRange(0, wednesday());
    expect(volumeInRange([set('not-a-date'), set('2026-09-23')], mon, sun)).toBe(1000);
  });
});

describe.each(['UTC', 'America/Los_Angeles', 'Australia/Sydney', 'Asia/Kolkata'])(
  'counts that compare a stored DAY against now, in %s',
  (tz) => {
    beforeEach(() => setZone(tz));

    it('counts the 1st of the month in this month', () => {
      // `new Date("2026-09-01")` is UTC midnight, which is 31 August west of
      // Greenwich — the day drops out of its own month.
      const stats = computeStats([set('2026-09-01'), set('2026-09-23')], wednesday());
      expect(stats.thisMonthCount).toBe(2);
    });

    it('counts the 1st in monthlyRecap days too', () => {
      expect(monthlyRecap([set('2026-09-01')], wednesday()).thisMonthDays).toBe(1);
    });

    it('starts a streak from a session logged today', () => {
      const today = set('2026-09-23');
      expect(computeStats([today], wednesday()).streak).toBe(1);
    });

    it('counts consecutive days as a streak', () => {
      const entries = ['2026-09-21', '2026-09-22', '2026-09-23'].map(set);
      expect(computeStats(entries, wednesday()).streak).toBe(3);
    });

    it('breaks a streak on a gap of more than four days', () => {
      const entries = [set('2026-09-23'), set('2026-09-10')].map((e) => e);
      expect(computeStats(entries, wednesday()).streak).toBe(1);
    });

    it('reads a backup made today as 0 days old, never null or 1', () => {
      expect(daysSinceBackup('2026-09-23', wednesday())).toBe(0);
    });

    it('still returns null for a backup date it cannot parse', () => {
      // null and 0 are opposite states; an unparseable value must not read as
      // "exported today".
      expect(daysSinceBackup('corrupt', wednesday())).toBeNull();
    });

    it('measures the program-review age in whole weeks', () => {
      // 42 days = exactly 6 weeks, the nudge threshold.
      expect(weeksSinceReview('2026-08-12', wednesday())).toBe(6);
    });
  },
);

/**
 * The question this file grew to answer: what happens to a week of history
 * logged in one zone when it is READ in another, as on a trip.
 */
describe('history logged in one zone, read in another', () => {
  const week = ['2026-09-21', '2026-09-22', '2026-09-23'].map(set);

  it('gives the same recap, streak and month count in every zone', () => {
    const results = ['America/Los_Angeles', 'Australia/Sydney', 'Asia/Kolkata', 'UTC'].map((tz) => {
      setZone(tz);
      const stats = computeStats(week, wednesday());
      return {
        week: weeklyRecap(week, wednesday()).thisWeek,
        month: monthlyRecap(week, wednesday()).thisMonth,
        streak: stats.streak,
        monthCount: stats.thisMonthCount,
      };
    });
    // Every zone must agree with the first, because a calendar day is a
    // calendar day wherever you read it from.
    for (const r of results) expect(r).toEqual(results[0]);
  });
});
