import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_METRIC_NOUN,
  achievementProgress,
  achievementProgressHint,
  achievementStatsSnapshot,
  barWeight,
  bestFor,
  computeStats,
  computeTotalDisplayWeight,
  crossTrainingCount,
  dayPlanKind,
  displayDate,
  entryVolume,
  epley1RM,
  estimated1RM,
  exercisesForDay,
  fireTier,
  fmtNum,
  fromDisplayLength,
  fromDisplayWeight,
  generateId,
  goalFor,
  historyFor,
  inputWeightFromStored,
  isBigJump,
  isoDate,
  isPR,
  lastLoggedWorkingSet,
  legPressSledWeight,
  mergeById,
  monthlyRecap,
  monthRange,
  newlyUnlockedAchievements,
  plateCalculator,
  prCountAllTime,
  recapPct,
  setNumberInDay,
  storedWeightFromInput,
  suggestedNextWeight,
  toDisplayLength,
  toDisplayWeight,
  totalVolumeAllTime,
  trainingDates,
  trapBarWeight,
  TYPO_GUARD_THRESHOLD,
  volumeInRange,
  volumeTrend,
  weeklyRecap,
  weekRange,
  weeksSinceReview,
} from './domain';
import { DAYS } from './program';
import type { CustomExercise, Entry, EquipmentWeights, LiftSetEntry } from './types';

// -- factories ---------------------------------------------------------------

let idSeq = 0;
function lift(overrides: Partial<LiftSetEntry> & { exercise: string; weight: number; reps: number; date: string }): LiftSetEntry {
  return { id: `t${idSeq++}`, sets: 1, ...overrides };
}
const activity = (date: string, name: 'Pilates' | 'Volleyball' = 'Pilates'): Entry => ({
  id: `t${idSeq++}`,
  type: 'activity',
  activity: name,
  date,
});
const completion = (type: 'warmup' | 'core', date: string): Entry => ({ id: `t${idSeq++}`, type, date });

const NO_EQUIPMENT: EquipmentWeights = { trapBar: null, legPressSled: null };

// -- ids / dates / formatting ------------------------------------------------

describe('generateId', () => {
  it('matches the legacy base36+timestamp scheme and is unique-ish', () => {
    const id = generateId();
    expect(id).toMatch(/^[a-z0-9]+$/);
    expect(id.length).toBeGreaterThan(13);
    expect(generateId()).not.toBe(id);
  });
});

describe('isoDate / displayDate / fmtNum', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(isoDate(new Date(2026, 7, 28))).toBe('2026-08-28');
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
  it('displayDate strips leading zeros', () => {
    expect(displayDate('2026-08-05')).toBe('8/5');
    expect(displayDate('2026-12-31')).toBe('12/31');
  });
  it('fmtNum rounds to 1 decimal by default and handles junk', () => {
    expect(fmtNum(7.25)).toBe('7.3');
    expect(fmtNum(7)).toBe('7');
    expect(fmtNum(7.4, 0)).toBe('7');
    expect(fmtNum(null)).toBe('--');
    expect(fmtNum(undefined)).toBe('--');
    expect(fmtNum(NaN)).toBe('--');
  });
});

// -- conversions ---------------------------------------------------------------

describe('weight/length conversions', () => {
  it('lbs → kg display rounds to 0.1', () => {
    expect(toDisplayWeight(100, 'kg')).toBe(45.4);
    expect(toDisplayWeight(100, 'lbs')).toBe(100);
  });
  it('kg display → lbs stored rounds to 0.1', () => {
    expect(fromDisplayWeight(45.4, 'kg')).toBe(100.1);
    expect(fromDisplayWeight(100, 'lbs')).toBe(100);
    expect(fromDisplayWeight(0, 'kg')).toBe(0); // falsy passthrough (legacy)
  });
  it('inches ↔ cm rounds to 0.1', () => {
    expect(toDisplayLength(29.5, 'kg')).toBe(74.9);
    expect(toDisplayLength(29.5, 'lbs')).toBe(29.5);
    expect(toDisplayLength(null, 'kg')).toBeNull();
    expect(fromDisplayLength(75, 'kg')).toBe(29.5);
    expect(fromDisplayLength(29.5, 'lbs')).toBe(29.5);
  });
  it('bar/equipment weights follow legacy defaults', () => {
    expect(barWeight('lbs')).toBe(45);
    expect(barWeight('kg')).toBe(20);
    expect(trapBarWeight(NO_EQUIPMENT, 'lbs')).toBe(55);
    expect(trapBarWeight(NO_EQUIPMENT, 'kg')).toBe(25);
    expect(trapBarWeight({ trapBar: 60, legPressSled: null }, 'lbs')).toBe(60);
    expect(legPressSledWeight(NO_EQUIPMENT)).toBe(0);
    expect(legPressSledWeight({ trapBar: null, legPressSled: 90 })).toBe(90);
    expect(legPressSledWeight({ trapBar: null, legPressSled: 0 })).toBe(0);
  });
});

// -- weight-entry math ---------------------------------------------------------

describe('variation-aware weight-entry math', () => {
  const ctx = { unit: 'lbs' as const, equipment: NO_EQUIPMENT };

  it('Barbell: per-side ×2 + bar', () => {
    expect(computeTotalDisplayWeight('Barbell', 45, ctx)).toBe(135);
    expect(computeTotalDisplayWeight('Barbell', 0, ctx)).toBe(0);
  });
  it('Trap Bar: per-side ×2 + trap bar (default 55, settings override)', () => {
    expect(computeTotalDisplayWeight('Trap Bar', 50, ctx)).toBe(155);
    expect(computeTotalDisplayWeight('Trap Bar', 50, { ...ctx, equipment: { trapBar: 60, legPressSled: null } })).toBe(160);
    expect(computeTotalDisplayWeight('Trap Bar', 0, ctx)).toBe(0);
  });
  it('Dumbbell: one dumbbell ×2', () => {
    expect(computeTotalDisplayWeight('Dumbbell', 25, ctx)).toBe(50);
  });
  it('Leg Press: plates + sled', () => {
    expect(computeTotalDisplayWeight('Leg Press', 200, ctx)).toBe(200);
    expect(computeTotalDisplayWeight('Leg Press', 200, { ...ctx, equipment: { trapBar: null, legPressSled: 90 } })).toBe(290);
    expect(computeTotalDisplayWeight('Leg Press', 0, ctx)).toBe(0);
  });
  it('other variations pass through as typed', () => {
    expect(computeTotalDisplayWeight('Assisted Pull-up', 40, ctx)).toBe(40);
    expect(computeTotalDisplayWeight(undefined, 65, ctx)).toBe(65);
  });
  it('storedWeightFromInput converts kg totals to stored lbs', () => {
    // 20 kg per side → 60 kg total → 132.3 lbs
    expect(storedWeightFromInput('Barbell', 20, { unit: 'kg', equipment: NO_EQUIPMENT })).toBe(132.3);
    expect(storedWeightFromInput('Barbell', 45, ctx)).toBe(135);
  });
  it('reverse prefill math: Barbell and Dumbbell only (legacy quirk)', () => {
    expect(inputWeightFromStored('Barbell', 135, 'lbs')).toBe(45);
    expect(inputWeightFromStored('Dumbbell', 50, 'lbs')).toBe(25);
    expect(inputWeightFromStored('Trap Bar', 155, 'lbs')).toBe(155);
    expect(inputWeightFromStored(undefined, 65, 'lbs')).toBe(65);
  });
});

// -- typo guard ----------------------------------------------------------------

describe('typo guard (>40% jump)', () => {
  it('flags only jumps strictly greater than 40%', () => {
    expect(TYPO_GUARD_THRESHOLD).toBe(0.4);
    expect(isBigJump(141, 100)).toBe(true);
    expect(isBigJump(140, 100)).toBe(false);
    expect(isBigJump(59, 100)).toBe(true); // drops count too (abs)
  });
  it('lastLoggedWorkingSet sorts by date then createdAt and skips warmup/assisted', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Bench Press', weight: 90, reps: 8, date: '2026-08-20', createdAt: 1 }),
      lift({ exercise: 'Bench Press', weight: 95, reps: 8, date: '2026-08-22', createdAt: 1 }),
      lift({ exercise: 'Bench Press', weight: 100, reps: 8, date: '2026-08-22', createdAt: 2 }),
      lift({ exercise: 'Bench Press', weight: 999, reps: 8, date: '2026-08-23', warmupSet: true }),
      lift({ exercise: 'Bench Press', weight: 40, reps: 8, date: '2026-08-23', assistedPullup: true }),
    ];
    expect(lastLoggedWorkingSet(entries, 'Bench Press')?.weight).toBe(100);
    expect(lastLoggedWorkingSet(entries, 'Nope')).toBeUndefined();
  });
});

// -- 1RM / volume ----------------------------------------------------------------

describe('Epley 1RM', () => {
  it('weight * (1 + reps/30), max over working sets, rounded', () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 2);
    const entries: Entry[] = [
      lift({ exercise: 'Bench Press', weight: 100, reps: 10, date: '2026-08-20' }),
      lift({ exercise: 'Bench Press', weight: 120, reps: 1, date: '2026-08-21' }),
      lift({ exercise: 'Bench Press', weight: 300, reps: 10, date: '2026-08-22', warmupSet: true }),
      lift({ exercise: 'Bench Press', weight: 300, reps: 10, date: '2026-08-22', assistedPullup: true }),
    ];
    expect(estimated1RM(entries, 'Bench Press')).toBe(133);
    expect(estimated1RM(entries, 'Rows')).toBeNull();
  });
});

describe('volume math', () => {
  // mid-week dates keep the UTC-midnight date parse inside local week ranges in any timezone
  const entries: Entry[] = [
    lift({ exercise: 'Sumo Squats', weight: 100, reps: 10, date: '2026-08-26' }), // 1000
    lift({ exercise: 'Sumo Squats', weight: 50, reps: 10, date: '2026-08-26', sets: 2 }), // 1000 (legacy sets>1)
    lift({ exercise: 'Sumo Squats', weight: 100, reps: 10, date: '2026-08-26', warmupSet: true }), // excluded
    lift({ exercise: 'Lat Pulldown', weight: 40, reps: 10, date: '2026-08-26', assistedPullup: true }), // excluded
    lift({ exercise: 'Hip Thrust', weight: 0, reps: 12, date: '2026-08-26' }), // excluded (no weight)
    activity('2026-08-26'),
    lift({ exercise: 'Bench Press', weight: 100, reps: 5, date: '2026-07-01' }), // out of range for the week
  ];

  it('weight*sets*reps excluding warmupSet/assistedPullup', () => {
    expect(entryVolume(lift({ exercise: 'X', weight: 50, reps: 10, date: '2026-08-26', sets: 2 }))).toBe(1000);
    expect(totalVolumeAllTime(entries)).toBe(2500);
  });

  it('volumeInRange applies the date window', () => {
    const start = new Date(2026, 7, 24);
    const end = new Date(2026, 7, 30, 23, 59, 59);
    expect(volumeInRange(entries, start, end)).toBe(2000);
  });

  it('weeklyRecap and recapPct compare Monday-based weeks', () => {
    const now = new Date(2026, 7, 28, 12); // Friday Aug 28 2026
    const withLastWeek: Entry[] = [...entries, lift({ exercise: 'Rows', weight: 100, reps: 10, date: '2026-08-18' })];
    const recap = weeklyRecap(withLastWeek, now);
    expect(recap.thisWeek).toBe(2000);
    expect(recap.lastWeek).toBe(1000);
    expect(recapPct(recap.thisWeek, recap.lastWeek)).toBe(100);
    expect(recapPct(1000, 0)).toBeNull();
  });
});

// -- week/month ranges -----------------------------------------------------------

describe('weekRange (Monday-based)', () => {
  it('finds the Monday of the current week', () => {
    const friday = new Date(2026, 7, 28, 12);
    const [mon, sun] = weekRange(0, friday);
    expect(isoDate(mon)).toBe('2026-08-24');
    expect(isoDate(sun)).toBe('2026-08-30');
    expect(mon.getHours()).toBe(0);
  });
  it('treats Sunday as the last day of the week', () => {
    const sunday = new Date(2026, 7, 30, 12);
    const [mon] = weekRange(0, sunday);
    expect(isoDate(mon)).toBe('2026-08-24');
  });
  it('offsets whole weeks', () => {
    const friday = new Date(2026, 7, 28, 12);
    const [mon, sun] = weekRange(-1, friday);
    expect(isoDate(mon)).toBe('2026-08-17');
    expect(isoDate(sun)).toBe('2026-08-23');
  });
});

describe('monthRange / monthlyRecap', () => {
  it('spans the calendar month inclusive', () => {
    const now = new Date(2026, 7, 28);
    const [start, end] = monthRange(0, now);
    expect(isoDate(start)).toBe('2026-08-01');
    expect(isoDate(end)).toBe('2026-08-31');
    const [lastStart, lastEnd] = monthRange(-1, now);
    expect(isoDate(lastStart)).toBe('2026-07-01');
    expect(isoDate(lastEnd)).toBe('2026-07-31');
  });
  it('monthlyRecap counts training days and volume', () => {
    const now = new Date(2026, 7, 28, 12);
    const entries: Entry[] = [
      lift({ exercise: 'Sumo Squats', weight: 100, reps: 10, date: '2026-08-10' }),
      lift({ exercise: 'Sumo Squats', weight: 100, reps: 10, date: '2026-08-12' }),
      activity('2026-08-15'),
      lift({ exercise: 'Sumo Squats', weight: 50, reps: 10, date: '2026-07-10' }),
    ];
    const recap = monthlyRecap(entries, now);
    expect(recap.thisMonth).toBe(2000);
    expect(recap.lastMonth).toBe(500);
    expect(recap.thisMonthDays).toBe(3); // activity day counts as a training day
  });
});

// -- streak + fire tiers -----------------------------------------------------------

describe('gap-tolerant streak (sessions, not days)', () => {
  const now = new Date(2026, 7, 28, 12);

  it('counts sessions with gaps ≤4 days, breaks at 5', () => {
    const entries: Entry[] = [
      lift({ exercise: 'A', weight: 10, reps: 1, date: '2026-08-28' }),
      lift({ exercise: 'A', weight: 10, reps: 1, date: '2026-08-24' }), // gap 4 → continue
      lift({ exercise: 'A', weight: 10, reps: 1, date: '2026-08-19' }), // gap 5 → break
    ];
    expect(computeStats(entries, now).streak).toBe(2);
  });

  it('streak is 0 when the last session is more than 4 days ago', () => {
    const entries: Entry[] = [lift({ exercise: 'A', weight: 10, reps: 1, date: '2026-08-20' })];
    expect(computeStats(entries, now).streak).toBe(0);
  });

  it('non-lift entries count toward the streak and stats', () => {
    const entries: Entry[] = [activity('2026-08-28'), completion('warmup', '2026-08-25'), completion('core', '2026-08-25')];
    const stats = computeStats(entries, now);
    expect(stats.streak).toBe(2); // two unique dates
    expect(stats.totalWorkouts).toBe(2);
    expect(stats.thisMonthCount).toBe(2);
  });

  it('trainingDates dedupes and sorts', () => {
    const entries: Entry[] = [
      lift({ exercise: 'A', weight: 10, reps: 1, date: '2026-08-28' }),
      lift({ exercise: 'B', weight: 10, reps: 1, date: '2026-08-28' }),
      activity('2026-08-01'),
    ];
    expect(trainingDates(entries)).toEqual(['2026-08-01', '2026-08-28']);
  });
});

describe('fire tiers', () => {
  it('matches legacy thresholds, labels and glow', () => {
    expect(fireTier(0)).toEqual({ level: 'seedling', label: 'Getting started', glow: false });
    expect(fireTier(3)).toEqual({ level: 'building', label: 'Building', glow: false });
    expect(fireTier(7)).toEqual({ level: 'heating', label: 'Heating up', glow: true });
    expect(fireTier(14)).toEqual({ level: 'fire', label: 'On fire', glow: true });
    expect(fireTier(30)).toEqual({ level: 'crown', label: 'Unstoppable', glow: true });
    expect(fireTier(60).level).toBe('crown');
  });
});

// -- trends / PRs ---------------------------------------------------------------

describe('volumeTrend', () => {
  it('compares the last two training days for the exercise', () => {
    const up: Entry[] = [
      lift({ exercise: 'A', weight: 100, reps: 10, date: '2026-08-20' }),
      lift({ exercise: 'A', weight: 110, reps: 10, date: '2026-08-22' }),
    ];
    expect(volumeTrend(up, 'A')).toBe('up');
    const down = [
      lift({ exercise: 'A', weight: 110, reps: 10, date: '2026-08-20' }),
      lift({ exercise: 'A', weight: 100, reps: 10, date: '2026-08-22' }),
    ];
    expect(volumeTrend(down, 'A')).toBe('down');
    const same = [
      lift({ exercise: 'A', weight: 100, reps: 10, date: '2026-08-20' }),
      lift({ exercise: 'A', weight: 100, reps: 10, date: '2026-08-22' }),
    ];
    expect(volumeTrend(same, 'A')).toBe('same');
    expect(volumeTrend(same.slice(0, 1), 'A')).toBeNull();
  });
});

describe('PR / PB logic', () => {
  it('bestFor excludes warm-ups but NOT assisted (legacy quirk)', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Lat Pulldown', weight: 100, reps: 10, date: '2026-08-20' }),
      lift({ exercise: 'Lat Pulldown', weight: 120, reps: 5, date: '2026-08-21', assistedPullup: true }),
      lift({ exercise: 'Lat Pulldown', weight: 999, reps: 5, date: '2026-08-21', warmupSet: true }),
    ];
    expect(bestFor(entries, 'Lat Pulldown')?.weight).toBe(120);
    expect(bestFor(entries, 'Nope')).toBeNull();
  });

  it('isPR: working, non-assisted, non-bodyweight, strictly greater', () => {
    expect(isPR(105, 100, {})).toBe(true);
    expect(isPR(100, 100, {})).toBe(false);
    expect(isPR(105, 0, {})).toBe(true); // first log is a PR
    expect(isPR(105, 100, { warmupSet: true })).toBe(false);
    expect(isPR(105, 100, { assistedPullup: true })).toBe(false);
    expect(isPR(105, 100, { variation: 'Bodyweight' })).toBe(false);
    expect(isPR(105, 100, { variation: 'Bodyweight Lunges' })).toBe(false);
    expect(isPR(105, 100, { variation: 'Barbell' })).toBe(true);
  });

  it('prCountAllTime counts every chronological new max per exercise', () => {
    const entries: Entry[] = [
      lift({ exercise: 'A', weight: 100, reps: 5, date: '2026-08-01' }), // PR (first)
      lift({ exercise: 'A', weight: 105, reps: 5, date: '2026-08-05' }), // PR
      lift({ exercise: 'A', weight: 95, reps: 5, date: '2026-08-10' }), // no
      lift({ exercise: 'B', weight: 50, reps: 5, date: '2026-08-02' }), // PR (first)
      lift({ exercise: 'B', weight: 60, reps: 5, date: '2026-08-03', warmupSet: true }), // excluded
    ];
    expect(prCountAllTime(entries)).toBe(3);
  });
});

describe('history helpers', () => {
  it('historyFor returns 15 newest-first', () => {
    const entries: Entry[] = [];
    for (let i = 1; i <= 20; i++) {
      entries.push(lift({ exercise: 'A', weight: i, reps: 5, date: `2026-07-${String(i).padStart(2, '0')}` }));
    }
    const hist = historyFor(entries, 'A');
    expect(hist).toHaveLength(15);
    expect(hist[0]?.date).toBe('2026-07-20');
  });

  it('setNumberInDay skips warm-up sets', () => {
    const first = lift({ exercise: 'A', weight: 100, reps: 5, date: '2026-08-28' });
    const warm = lift({ exercise: 'A', weight: 50, reps: 5, date: '2026-08-28', warmupSet: true });
    const second = lift({ exercise: 'A', weight: 100, reps: 5, date: '2026-08-28' });
    const entries = [first, warm, second];
    expect(setNumberInDay(entries, first)).toBe(1);
    expect(setNumberInDay(entries, second)).toBe(2);
  });
});

// -- progression ladder ----------------------------------------------------------

describe('suggestedNextWeight (RPE ladder)', () => {
  const bench = { name: 'Bench Press', targetReps: '6-10' }; // min 6, +5 lb base
  const squat = { name: 'Sumo Squats', targetReps: '8-12' }; // lower compound, +10 lb base
  const day = '2026-08-25';

  const sets = (rpes: (number | undefined)[], reps = 8, exercise = 'Bench Press', weight = 100): Entry[] =>
    rpes.map((rpe) =>
      lift({ exercise, weight, reps, date: day, ...(rpe ? { rpe } : {}) }),
    );

  it('returns null with no history', () => {
    expect(suggestedNextWeight([], bench, 'lbs')).toBeNull();
  });

  it('holds when reps were missed', () => {
    const res = suggestedNextWeight(sets([8, 8], 5), bench, 'lbs');
    expect(res?.direction).toBe('hold');
    expect(res?.suggestion).toBe(100);
    expect(res?.note).toBe("You didn't hit full reps last time, repeat this weight and nail your reps first.");
  });

  it('holds at avg RPE ≥ 9', () => {
    const res = suggestedNextWeight(sets([9, 9]), bench, 'lbs');
    expect(res?.direction).toBe('hold');
    expect(res?.note).toBe('Last session was tough, repeat this weight and see if it feels a bit easier.');
  });

  it('doubles the increment at avg RPE ≤ 6', () => {
    const res = suggestedNextWeight(sets([6, 6]), bench, 'lbs');
    expect(res?.suggestion).toBe(110);
    expect(res?.note).toBe('That felt easy (RPE 6), pushing a bigger jump than usual.');
  });

  it('1.5× increment at avg RPE ≤ 7.5', () => {
    const res = suggestedNextWeight(sets([7, 7]), bench, 'lbs');
    expect(res?.suggestion).toBe(107.5);
  });

  it('standard increment in the 7.5–9 sweet spot', () => {
    const res = suggestedNextWeight(sets([8, 8]), bench, 'lbs');
    expect(res?.suggestion).toBe(105);
    expect(res?.note).toBe('RPE 8 is the sweet spot, standard jump.');
  });

  it('1.25× increment when no RPE logged', () => {
    const res = suggestedNextWeight(sets([undefined, undefined]), bench, 'lbs');
    expect(res?.suggestion).toBe(106.25);
    expect(res?.avgRPE).toBeNull();
    expect(res?.note).toBe('Log your RPE next time for a more precise suggestion, using a moderate jump for now.');
  });

  it('lower-body compounds jump 10 lb', () => {
    const res = suggestedNextWeight(sets([8], 10, 'Sumo Squats', 135), squat, 'lbs');
    expect(res?.suggestion).toBe(145);
  });

  it('kg increments are 5 / 2.5 and output converts to display units', () => {
    const res = suggestedNextWeight(sets([8]), bench, 'kg'); // 100 lbs top + 2.5 → 102.5 lbs → 46.5 kg
    expect(res?.suggestion).toBe(46.5);
    expect(res?.lastWeight).toBe(45.4);
  });

  it('only the LAST session (latest date) is considered, warm-ups excluded', () => {
    const entries: Entry[] = [
      lift({ exercise: 'Bench Press', weight: 90, reps: 8, date: '2026-08-20', rpe: 6 }),
      lift({ exercise: 'Bench Press', weight: 100, reps: 8, date: day, rpe: 8 }),
      lift({ exercise: 'Bench Press', weight: 200, reps: 8, date: day, warmupSet: true, rpe: 5 }),
    ];
    const res = suggestedNextWeight(entries, bench, 'lbs');
    expect(res?.lastDate).toBe(day);
    expect(res?.suggestion).toBe(105);
  });
});

// -- achievements -----------------------------------------------------------------

describe('achievements', () => {
  it('has exactly the 25 legacy ids', () => {
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual([
      'first-set', 'streak-3', 'streak-7', 'streak-14', 'streak-30', 'streak-60',
      'workouts-10', 'workouts-25', 'workouts-50', 'workouts-100',
      'sets-100', 'sets-500', 'first-pr', 'pr-5', 'pr-15',
      'cross-train', 'cross-train-10', 'volume-10k', 'volume-50k', 'volume-100k',
      'bodyweight-log', 'bodyweight-10', 'measure-log', 'rpe-20', 'rpe-100',
    ]);
  });

  it('snapshot counts working sets, RPE-logged sets and cross-training', () => {
    const entries: Entry[] = [
      lift({ exercise: 'A', weight: 100, reps: 10, date: '2026-08-28', rpe: 8 }),
      lift({ exercise: 'A', weight: 50, reps: 10, date: '2026-08-28', warmupSet: true }),
      activity('2026-08-27', 'Volleyball'),
    ];
    const snap = achievementStatsSnapshot(entries, [{ id: 'b', date: '2026-08-28', weight: 128 }], [], new Date(2026, 7, 28, 12));
    expect(snap.totalSets).toBe(1); // warm-up excluded
    expect(snap.rpeLoggedCount).toBe(1);
    expect(snap.crossTraining).toBe(1);
    expect(crossTrainingCount(entries)).toBe(1);
    expect(snap.bwCount).toBe(1);
    expect(snap.measureCount).toBe(0);
    expect(snap.totalVolume).toBe(1000);
    expect(snap.prCount).toBe(1);
    expect(snap.totalWorkouts).toBe(2);
  });

  it('newlyUnlockedAchievements skips already-seen ids', () => {
    const entries: Entry[] = [lift({ exercise: 'A', weight: 100, reps: 10, date: isoDate() })];
    const snap = achievementStatsSnapshot(entries, [], []);
    const fresh = newlyUnlockedAchievements(snap, []);
    expect(fresh.map((a) => a.id)).toContain('first-set');
    expect(fresh.map((a) => a.id)).toContain('first-pr');
    const seen = newlyUnlockedAchievements(snap, fresh.map((a) => a.id));
    expect(seen).toEqual([]);
  });

  it('progress hints show the remaining amount with legacy wording', () => {
    const base = achievementStatsSnapshot([], [], []);
    const streak3 = ACHIEVEMENTS.find((a) => a.id === 'streak-3')!;
    expect(achievementProgressHint(streak3, { ...base, streak: 1 }, 'lbs')).toBe('2 more sessions');
    const firstSet = ACHIEVEMENTS.find((a) => a.id === 'first-set')!;
    expect(achievementProgressHint(firstSet, base, 'lbs')).toBe('1 more session');
    const vol = ACHIEVEMENTS.find((a) => a.id === 'volume-10k')!;
    expect(achievementProgressHint(vol, base, 'lbs')).toBe('10000 more lbs lifted');
    expect(achievementProgressHint(vol, base, 'kg')).toBe('4536 more kg lifted');
    const pr = ACHIEVEMENTS.find((a) => a.id === 'pr-5')!;
    expect(achievementProgressHint(pr, { ...base, prCount: 4 }, 'lbs')).toBe('1 more PR');
    expect(achievementProgressHint(pr, { ...base, prCount: 5 }, 'lbs')).toBe('');
  });

  it('progress reports current, threshold and a percentage for the track', () => {
    const base = achievementStatsSnapshot([], [], []);
    const streak60 = ACHIEVEMENTS.find((a) => a.id === 'streak-60')!;

    expect(achievementProgress(streak60, { ...base, streak: 39 })).toEqual({
      current: 39,
      threshold: 60,
      pct: 65,
    });
    expect(achievementProgress(streak60, base)).toEqual({ current: 0, threshold: 60, pct: 0 });
  });

  /** An overshoot must not render a bar past its own track. */
  it('caps progress at the threshold once passed', () => {
    const base = achievementStatsSnapshot([], [], []);
    const prFive = ACHIEVEMENTS.find((a) => a.id === 'pr-5')!;

    expect(achievementProgress(prFive, { ...base, prCount: 99 })).toEqual({
      current: 5,
      threshold: 5,
      pct: 100,
    });
  });

  it('gives every achievement metric a noun for its track label', () => {
    new Set(ACHIEVEMENTS.map((a) => a.metric)).forEach((m) => {
      expect(ACHIEVEMENT_METRIC_NOUN[m]).toBeDefined();
    });
  });
});

// -- plate calculator --------------------------------------------------------------

describe('plate calculator (greedy per side)', () => {
  it('breaks down lbs plates largest-first', () => {
    expect(plateCalculator(225, 45, 'lbs')).toEqual({ perSide: 90, plates: [45, 45], leftover: 0 });
    expect(plateCalculator(100, 45, 'lbs')).toEqual({ perSide: 27.5, plates: [25, 2.5], leftover: 0 });
  });
  it('reports the shortfall when the target is unreachable', () => {
    const res = plateCalculator(46, 45, 'lbs');
    expect(res?.plates).toEqual([]);
    expect(res?.leftover).toBe(0.5);
  });
  it('uses kg plate sizes for kg', () => {
    expect(plateCalculator(60, 20, 'kg')).toEqual({ perSide: 20, plates: [20], leftover: 0 });
    expect(plateCalculator(62.5, 20, 'kg')?.plates).toEqual([20, 1.25]);
  });
  it('returns null for missing target or target ≤ bar', () => {
    expect(plateCalculator(0, 45, 'lbs')).toBeNull();
    expect(plateCalculator(45, 45, 'lbs')).toBeNull();
    expect(plateCalculator(40, 45, 'lbs')).toBeNull();
  });
});

// -- misc ---------------------------------------------------------------------------

describe('weeksSinceReview', () => {
  it('floors whole weeks and returns 0 when never reviewed', () => {
    const now = new Date(2026, 7, 28, 12);
    expect(weeksSinceReview(null, now)).toBe(0);
    expect(weeksSinceReview('2026-08-21', now)).toBe(1);
    expect(weeksSinceReview('2026-07-15', now)).toBe(6); // ≥6 triggers the nudge
  });
});

describe('mergeById', () => {
  it('incoming wins on conflicts, nothing gets deleted', () => {
    const current = [
      { id: 'a', v: 1 },
      { id: 'b', v: 1 },
    ];
    const incoming = [
      { id: 'b', v: 2 },
      { id: 'c', v: 1 },
    ];
    const merged = mergeById(current, incoming);
    expect(merged).toHaveLength(3);
    expect(merged.find((e) => e.id === 'b')?.v).toBe(2);
  });
});

describe('exercisesForDay / goalFor', () => {
  it('built-ins minus excluded plus non-archived customs', () => {
    const custom: CustomExercise = {
      name: 'Bulgarian Split Squat', targetSets: 3, targetReps: '8-12', prefillReps: 8, goal: 50, custom: true, notes: null,
    };
    const archived: CustomExercise = { ...custom, name: 'Old One', archived: true };
    const list = exercisesForDay('Lower A', DAYS, { 'Lower A': [custom, archived] }, { 'Lower A': ['Sumo Squats'] });
    expect(list.map((e) => e.name)).toEqual(['Deadlifts', 'Hip Thrust', 'KB Swings', 'Bulgarian Split Squat']);
  });

  it('goalFor prefers custom goals', () => {
    const ex = { name: 'Sumo Squats', goal: 135 };
    expect(goalFor(ex, {})).toBe(135);
    expect(goalFor(ex, { 'Sumo Squats': 145 })).toBe(145);
  });
});

// ---------------------------------------------------------------------------
// Set types: dropSet and toFailure (NEW fields, not in the legacy schema)
// ---------------------------------------------------------------------------

describe('dropSet counts as work but never as a best', () => {
  const withDrop = [
    lift({ exercise: 'Bench Press', weight: 100, reps: 5, date: '2026-09-01' }),
    lift({ exercise: 'Bench Press', weight: 140, reps: 12, date: '2026-09-02', dropSet: true }),
  ];

  it('is excluded from bestFor, so a drop cannot masquerade as a PB', () => {
    expect(bestFor(withDrop, 'Bench Press')?.weight).toBe(100);
  });

  it('is excluded from estimated1RM, where a fatigued high-rep drop inflates Epley', () => {
    // Including the drop would give 140 * (1 + 12/30) = 196.
    expect(estimated1RM(withDrop, 'Bench Press')).toBe(Math.round(100 * (1 + 5 / 30)));
  });

  it('still counts toward volume — it is real work', () => {
    const start = new Date('2026-09-01T00:00:00');
    const end = new Date('2026-09-30T23:59:59');
    expect(volumeInRange(withDrop, start, end)).toBe(100 * 1 * 5 + 140 * 1 * 12);
  });

  it('is excluded from the prefill, which should follow the top set', () => {
    expect(lastLoggedWorkingSet(withDrop, 'Bench Press')?.weight).toBe(100);
  });

  it('never fires a PR', () => {
    expect(isPR(200, 100, { dropSet: true })).toBe(false);
    expect(isPR(200, 100, {})).toBe(true);
  });

  it('is excluded from the all-time PR count', () => {
    expect(prCountAllTime(withDrop)).toBe(1);
  });
});

describe('toFailure is a label, not a modifier', () => {
  const withFailure = [
    lift({ exercise: 'Rows', weight: 90, reps: 8, date: '2026-09-01' }),
    lift({ exercise: 'Rows', weight: 110, reps: 6, date: '2026-09-02', toFailure: true }),
  ];

  it('can set a PB like any working set', () => {
    expect(bestFor(withFailure, 'Rows')?.weight).toBe(110);
    // `toFailure` is deliberately not an isPR input: nothing about it changes
    // the outcome, so a failure set is judged exactly like a normal one.
    expect(isPR(110, 90, {})).toBe(true);
  });

  it('feeds estimated1RM and volume unchanged', () => {
    expect(estimated1RM(withFailure, 'Rows')).toBe(Math.round(110 * (1 + 6 / 30)));
    const start = new Date('2026-09-01T00:00:00');
    const end = new Date('2026-09-30T23:59:59');
    expect(volumeInRange(withFailure, start, end)).toBe(90 * 8 + 110 * 6);
  });
});

describe('dayPlanKind', () => {
  const lifting = ['Lower A', 'Upper', 'Lower B'];

  it('calls a day that points at a lifting tab a training day', () => {
    expect(dayPlanKind({ label: 'Lower A', tab: 'Lower A' }, lifting)).toBe('training');
  });

  it('calls a day with nothing scheduled a rest day', () => {
    expect(dayPlanKind({ label: 'Rest Day', tab: null }, lifting)).toBe('rest');
  });

  /** Volleyball and Pilates have no lifting tab but are not rest either. */
  it('treats cross-training days as active recovery', () => {
    expect(dayPlanKind({ label: 'Volleyball Day', tab: null }, lifting)).toBe('recovery');
    // Pilates points at the Warm-up tab, which is not a lifting day.
    expect(dayPlanKind({ label: 'Pilates Day', tab: 'Warm-up' }, lifting)).toBe('recovery');
  });
});
