/**
 * Training dates, streaks and the aggregate stats snapshot.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import { daysSince, parseIsoDate } from '../dates';
import type { Entry } from '../types';

// Streak + fire tiers (gap-tolerant, counts SESSIONS not days)
// ---------------------------------------------------------------------------

/** Unique sorted training dates. ALL entry kinds count (activities/warmup/core too). */
export function trainingDates(entries: Entry[]): string[] {
  return [...new Set(entries.map((e) => e.date))].sort();
}

export interface Stats {
  totalWorkouts: number;
  thisMonthCount: number;
  streak: number;
}

/** Legacy streak: count back from most recent date, allow gaps up to 4 days between sessions. */
export function computeStats(entries: Entry[], now: Date = new Date()): Stats {
  const dates = trainingDates(entries);
  const totalWorkouts = dates.length;
  /*
   * `parseIsoDate`, not `new Date(d)`. The latter is UTC midnight, so west of
   * Greenwich "2026-09-01" lands on 31 August LOCAL and drops out of its own
   * month — the same defect `volumeInRange` had, in its sibling.
   */
  const thisMonthCount = dates.filter((d) => {
    const dt = parseIsoDate(d);
    return dt !== null && dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  }).length;
  let streak = 0;
  if (dates.length) {
    // Sorting by string is equivalent for "YYYY-MM-DD" and needs no parsing.
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    let prev = sorted[0] as string;
    /*
     * `daysSince` compares local DAY STARTS and rounds. Both matter: the old
     * form mixed an instant (`now`) with a UTC midnight, and once parsing is
     * local a spring-forward day is 23 hours, which `Math.floor` would score as
     * a gap of 0 and quietly make the streak more forgiving than it reads.
     */
    if (daysSince(prev, now) <= 4) {
      streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const cur = sorted[i] as string;
        const prevDate = parseIsoDate(prev);
        const gap = prevDate ? daysSince(cur, prevDate) : Infinity;
        if (gap <= 4) {
          streak++;
          prev = cur;
        } else break;
      }
    }
  }
  return { totalWorkouts, thisMonthCount, streak };
}

export type FireTierLevel = 'seedling' | 'building' | 'heating' | 'fire' | 'crown';

export interface FireTier {
  level: FireTierLevel;
  label: string;
  glow: boolean;
}

/** Legacy fire tiers (icons mapped to lucide in lib/program.ts FIRE_TIER_ICONS). */
export function fireTier(streak: number): FireTier {
  if (streak >= 30) return { level: 'crown', label: 'Unstoppable', glow: true };
  if (streak >= 14) return { level: 'fire', label: 'On fire', glow: true };
  if (streak >= 7) return { level: 'heating', label: 'Heating up', glow: true };
  if (streak >= 3) return { level: 'building', label: 'Building', glow: false };
  return { level: 'seedling', label: 'Getting started', glow: false };
}
