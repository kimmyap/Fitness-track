export * from './entries';
export * from './bodyweight';
export * from './measurements';
export * from './settings';
export * from './customExercises';
export * from './coreOverrides';
export * from './goals';
export * from './notes';
export * from './achievements';
export * from './weightModes';

import { useEntriesStore } from './entries';
import { useSettingsStore } from './settings';
import { useAchievementsStore } from './achievements';

/**
 * Legacy loadData migrations, run once at app startup (main.tsx):
 * - entries missing `id` are backfilled by lib/storage getEntries()
 * - lastProgramReviewAt backfills to the earliest entry date
 * - already-earned achievements are silently marked seen (no toast backlog)
 */
export function runStartupMigrations(): void {
  const { entries } = useEntriesStore.getState();
  const settings = useSettingsStore.getState();
  if (!settings.lastProgramReview && entries.length) {
    const earliestDate = entries
      .map((e) => e.date)
      .sort()[0];
    if (earliestDate) settings.backfillProgramReview(earliestDate);
  }
  useAchievementsStore.getState().syncSeenSilently();
}
