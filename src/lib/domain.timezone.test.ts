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
import { monthRange, monthlyRecap, volumeInRange, weekRange, weeklyRecap } from './domain';
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
