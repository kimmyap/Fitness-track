/**
 * The 25 achievement definitions, their thresholds and progress hints.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { BodyweightEntry, Entry, MeasurementEntry, Unit } from '../types';
import { isLiftSet } from '../types';
import { parseIsoDate } from '../dates';
import { prCountAllTime } from './prs';
import type { Stats } from './streaks';
import { computeStats } from './streaks';
import { toDisplayWeight } from './units';
import { totalVolumeAllTime } from './volume';

// Achievements — 25 definitions with thresholds + progress hints
// ---------------------------------------------------------------------------

export interface AchievementSnapshot extends Stats {
  prCount: number;
  crossTraining: number;
  totalVolume: number;
  bwCount: number;
  measureCount: number;
  totalSets: number;
  rpeLoggedCount: number;
}

export type AchievementMetric =
  | 'streak'
  | 'totalWorkouts'
  | 'totalSets'
  | 'prCount'
  | 'crossTraining'
  | 'totalVolume'
  | 'bwCount'
  | 'measureCount'
  | 'rpeLoggedCount';

export interface AchievementDef {
  id: string;
  label: string;
  desc: string;
  metric: AchievementMetric;
  threshold: number;
  check: (s: AchievementSnapshot) => boolean;
}

/** Icons for these ids live in lib/program.ts ACHIEVEMENT_ICONS (lucide). */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-set', label: 'First Rep', desc: 'Log your first set', metric: 'totalWorkouts', threshold: 1, check: (s) => s.totalWorkouts >= 1 },
  { id: 'streak-3', label: '3-Day Streak', desc: 'Train 3 sessions in a row', metric: 'streak', threshold: 3, check: (s) => s.streak >= 3 },
  { id: 'streak-7', label: 'Week Warrior', desc: 'Hit a 7-session streak', metric: 'streak', threshold: 7, check: (s) => s.streak >= 7 },
  { id: 'streak-14', label: 'On Fire', desc: 'Hit a 14-session streak', metric: 'streak', threshold: 14, check: (s) => s.streak >= 14 },
  { id: 'streak-30', label: 'Unstoppable', desc: 'Hit a 30-session streak', metric: 'streak', threshold: 30, check: (s) => s.streak >= 30 },
  { id: 'streak-60', label: 'Legendary', desc: 'Hit a 60-session streak', metric: 'streak', threshold: 60, check: (s) => s.streak >= 60 },
  { id: 'workouts-10', label: 'Regular', desc: 'Log 10 total sessions', metric: 'totalWorkouts', threshold: 10, check: (s) => s.totalWorkouts >= 10 },
  { id: 'workouts-25', label: 'Committed', desc: 'Log 25 total sessions', metric: 'totalWorkouts', threshold: 25, check: (s) => s.totalWorkouts >= 25 },
  { id: 'workouts-50', label: 'Half Century', desc: 'Log 50 total sessions', metric: 'totalWorkouts', threshold: 50, check: (s) => s.totalWorkouts >= 50 },
  { id: 'workouts-100', label: 'Centurion', desc: 'Log 100 total sessions', metric: 'totalWorkouts', threshold: 100, check: (s) => s.totalWorkouts >= 100 },
  { id: 'sets-100', label: 'Century Club', desc: 'Log 100 total working sets', metric: 'totalSets', threshold: 100, check: (s) => s.totalSets >= 100 },
  { id: 'sets-500', label: 'Set Machine', desc: 'Log 500 total working sets', metric: 'totalSets', threshold: 500, check: (s) => s.totalSets >= 500 },
  { id: 'first-pr', label: 'First PR', desc: 'Beat a previous best weight', metric: 'prCount', threshold: 1, check: (s) => s.prCount >= 1 },
  { id: 'pr-5', label: 'PR Machine', desc: 'Rack up 5 PRs across lifts', metric: 'prCount', threshold: 5, check: (s) => s.prCount >= 5 },
  { id: 'pr-15', label: 'Serial PR-er', desc: 'Rack up 15 PRs across lifts', metric: 'prCount', threshold: 15, check: (s) => s.prCount >= 15 },
  { id: 'cross-train', label: 'Well Rounded', desc: 'Log a Pilates or volleyball day', metric: 'crossTraining', threshold: 1, check: (s) => s.crossTraining >= 1 },
  { id: 'cross-train-10', label: 'Cross-Trainer', desc: 'Log 10 Pilates/volleyball days', metric: 'crossTraining', threshold: 10, check: (s) => s.crossTraining >= 10 },
  { id: 'volume-10k', label: 'Ten Thousand Club', desc: 'Lift 10,000lbs total volume', metric: 'totalVolume', threshold: 10000, check: (s) => s.totalVolume >= 10000 },
  { id: 'volume-50k', label: 'Fifty Thousand Club', desc: 'Lift 50,000lbs total volume', metric: 'totalVolume', threshold: 50000, check: (s) => s.totalVolume >= 50000 },
  { id: 'volume-100k', label: 'Six Figures', desc: 'Lift 100,000lbs total volume', metric: 'totalVolume', threshold: 100000, check: (s) => s.totalVolume >= 100000 },
  { id: 'bodyweight-log', label: 'Checking In', desc: 'Log your bodyweight for the first time', metric: 'bwCount', threshold: 1, check: (s) => s.bwCount >= 1 },
  { id: 'bodyweight-10', label: 'Data Nerd', desc: 'Log your bodyweight 10 times', metric: 'bwCount', threshold: 10, check: (s) => s.bwCount >= 10 },
  { id: 'measure-log', label: 'Taking Measurements', desc: 'Log a body measurement for the first time', metric: 'measureCount', threshold: 1, check: (s) => s.measureCount >= 1 },
  { id: 'rpe-20', label: 'Dialed In', desc: 'Log RPE on 20 sets', metric: 'rpeLoggedCount', threshold: 20, check: (s) => s.rpeLoggedCount >= 20 },
  { id: 'rpe-100', label: 'RPE Master', desc: 'Log RPE on 100 sets', metric: 'rpeLoggedCount', threshold: 100, check: (s) => s.rpeLoggedCount >= 100 },
];

/** Pilates/Volleyball day count. */
export function crossTrainingCount(entries: Entry[]): number {
  return entries.filter((e) => 'type' in e && e.type === 'activity').length;
}

export function achievementStatsSnapshot(
  entries: Entry[],
  bwEntries: BodyweightEntry[],
  measurements: MeasurementEntry[],
  now: Date = new Date(),
): AchievementSnapshot {
  const s = computeStats(entries, now);
  const totalSets = entries.filter((e) => isLiftSet(e) && !e.warmupSet).length;
  const rpeLoggedCount = entries.filter((e) => isLiftSet(e) && e.rpe).length;
  return {
    ...s,
    prCount: prCountAllTime(entries),
    crossTraining: crossTrainingCount(entries),
    totalVolume: totalVolumeAllTime(entries),
    bwCount: bwEntries.length,
    measureCount: measurements.length,
    totalSets,
    rpeLoggedCount,
  };
}

/** Legacy progress hint, e.g. "3 more sessions". Empty string when already unlocked. */
export function achievementProgressHint(a: AchievementDef, snap: AchievementSnapshot, unit: Unit): string {
  if (!a.metric) return '';
  const current = snap[a.metric] || 0;
  const remaining = a.threshold - current;
  if (remaining <= 0) return '';
  const displayRemaining = a.metric === 'totalVolume' ? Math.round(toDisplayWeight(remaining, unit)) : remaining;
  if (displayRemaining <= 0) return 'Almost there, just a bit more';
  const isSingular = displayRemaining === 1;
  const unitMap: Record<AchievementMetric, string> = {
    streak: isSingular ? 'more session' : 'more sessions',
    totalWorkouts: isSingular ? 'more session' : 'more sessions',
    totalSets: isSingular ? 'more set' : 'more sets',
    prCount: isSingular ? 'more PR' : 'more PRs',
    crossTraining: isSingular ? 'more cross-training day' : 'more cross-training days',
    totalVolume: `more ${unit} lifted`,
    bwCount: isSingular ? 'more weigh-in' : 'more weigh-ins',
    measureCount: isSingular ? 'more measurement' : 'more measurements',
    rpeLoggedCount: isSingular ? 'more RPE-logged set' : 'more RPE-logged sets',
  };
  return `${displayRemaining} ${unitMap[a.metric] || 'to go'}`;
}

export type DayPlanKind = 'training' | 'recovery' | 'rest';

/**
 * What kind of day the plan describes, for the Today hero.
 *
 * Derived rather than stored: a day that points at a real lifting tab is a
 * training day, a day with nothing scheduled is rest, and everything else
 * (volleyball, Pilates) is active recovery. Typed structurally so this stays
 * in domain.ts without importing the program data it describes.
 */
export function dayPlanKind(plan: { label: string; tab: string | null }, liftingTabs: string[]): DayPlanKind {
  if (plan.tab && liftingTabs.includes(plan.tab)) return 'training';
  if (/rest/i.test(plan.label)) return 'rest';
  return 'recovery';
}

export type AchievementCategory = 'streaks' | 'volume' | 'cross-training' | 'milestones';

export const ACHIEVEMENT_CATEGORY_LABEL: Record<AchievementCategory, string> = {
  streaks: 'Streaks',
  volume: 'Volume',
  'cross-training': 'Cross-Training',
  milestones: 'Milestones',
};

/**
 * Which filter an achievement belongs under.
 *
 * DERIVED from the metric it already counts rather than stored on each
 * definition: a hand-written table would be a second thing to keep in step,
 * and a new achievement would silently land in no category at all.
 */
export function achievementCategory(a: AchievementDef): AchievementCategory {
  switch (a.metric) {
    case 'streak':
      return 'streaks';
    case 'totalVolume':
    case 'totalSets':
      return 'volume';
    case 'crossTraining':
      return 'cross-training';
    default:
      return 'milestones';
  }
}

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

const TIER_ORDER: AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum'];

export const ACHIEVEMENT_TIER_LABEL: Record<AchievementTier, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

/**
 * Rank within its own metric family: the easiest threshold for a metric is
 * bronze, the next silver, and so on, with everything past the fourth staying
 * platinum.
 *
 * Also derived rather than assigned. Ranking against SIBLINGS is what makes it
 * meaningful — thresholds are not comparable across metrics (a 3-session streak
 * and 10,000lb of volume are not the same kind of number), so the only honest
 * ordering is within a family.
 */
export function achievementTier(a: AchievementDef, all: AchievementDef[] = ACHIEVEMENTS): AchievementTier {
  const siblings = all
    .filter((x) => x.metric === a.metric)
    .map((x) => x.threshold)
    .sort((x, y) => x - y);
  const rank = siblings.indexOf(a.threshold);
  return TIER_ORDER[Math.min(rank < 0 ? 0 : rank, TIER_ORDER.length - 1)] as AchievementTier;
}

export interface AchievementProgress {
  /** Capped at the threshold — a locked card never shows more than its target. */
  current: number;
  threshold: number;
  /** 0-100, for the track fill. */
  pct: number;
}

/**
 * How far along an achievement is, as numbers rather than the prose hint.
 *
 * Every definition already carries the metric it counts and the threshold it
 * needs, and the snapshot holds the live value, so "39 / 60" needs no data the
 * app was not already computing.
 */
export function achievementProgress(a: AchievementDef, snap: AchievementSnapshot): AchievementProgress {
  const threshold = a.threshold;
  const raw = snap[a.metric] || 0;
  const current = Math.max(0, Math.min(raw, threshold));
  return {
    current,
    threshold,
    pct: threshold > 0 ? Math.round((current / threshold) * 100) : 0,
  };
}

/** Short noun for a progress track, e.g. "39 / 60 sessions". */
export const ACHIEVEMENT_METRIC_NOUN: Record<AchievementMetric, string> = {
  streak: 'sessions',
  totalWorkouts: 'sessions',
  totalSets: 'sets',
  prCount: 'PRs',
  crossTraining: 'days',
  totalVolume: '',
  bwCount: 'weigh-ins',
  measureCount: 'measurements',
  rpeLoggedCount: 'sets',
};

/**
 * The date each achievement was FIRST earned, recovered by replaying history.
 *
 * Nothing has ever recorded when an achievement unlocked — `check` is a pure
 * function of a snapshot, and the snapshot is a pure function of the data, so
 * the date is derivable rather than lost: rebuild the snapshot as it stood at
 * the end of each day that has any data, and the first day a check passes is
 * the day it was earned. That beats stamping "unlocked today" on a history
 * that is years old, and it needs no new storage key to keep in sync.
 *
 * Only dates that HAVE data are evaluated — a check cannot change on a day
 * nothing was logged — so this is one pass per logged day, not per calendar
 * day. Ids with no date are achievements not yet earned.
 */
export function achievementUnlockDates(
  entries: Entry[],
  bwEntries: BodyweightEntry[],
  measurements: MeasurementEntry[],
): Record<string, string> {
  const days = [
    ...new Set([
      ...entries.map((e) => e.date),
      ...bwEntries.map((e) => e.date),
      ...measurements.map((e) => e.date),
    ]),
  ].sort();

  const found: Record<string, string> = {};
  let remaining = ACHIEVEMENTS;

  for (const day of days) {
    if (!remaining.length) break;
    // `now` is that day, so streaks are measured as they stood then.
    const asOf = parseIsoDate(day) ?? new Date();
    const snap = achievementStatsSnapshot(
      entries.filter((e) => e.date <= day),
      bwEntries.filter((e) => e.date <= day),
      measurements.filter((e) => e.date <= day),
      asOf,
    );
    const stillLocked: AchievementDef[] = [];
    for (const a of remaining) {
      if (a.check(snap)) found[a.id] = day;
      else stillLocked.push(a);
    }
    remaining = stillLocked;
  }

  return found;
}

/** Definitions that pass their check but aren't in `seen` yet. */
export function newlyUnlockedAchievements(snap: AchievementSnapshot, seen: string[]): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.check(snap) && !seen.includes(a.id));
}
