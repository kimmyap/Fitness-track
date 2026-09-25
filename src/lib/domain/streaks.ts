/**
 * Training dates, streaks and the aggregate stats snapshot.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
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
  const thisMonthCount = dates.filter((d) => {
    const dt = new Date(d);
    return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  }).length;
  let streak = 0;
  if (dates.length) {
    const sorted = [...dates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    let prev = new Date(sorted[0] as string);
    const daysSinceLast = Math.floor((now.getTime() - prev.getTime()) / 86400000);
    if (daysSinceLast <= 4) {
      streak = 1;
      for (let i = 1; i < sorted.length; i++) {
        const cur = new Date(sorted[i] as string);
        const gap = Math.floor((prev.getTime() - cur.getTime()) / 86400000);
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
