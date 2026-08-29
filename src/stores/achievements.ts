/**
 * Seen achievements (gymlog:achievements — array of unlocked/seen ids).
 *
 * Two flows, matching legacy:
 * - checkAchievements(): after a mutation — returns newly unlocked defs so the
 *   caller can fire confetti/toasts, and marks them seen.
 * - syncSeenSilently(): on app load — marks already-earned achievements seen
 *   WITHOUT returning them, so users don't get a toast backlog.
 */
import { create } from 'zustand';
import { getSeenAchievements, saveSeenAchievements } from '@/lib/storage';
import {
  achievementStatsSnapshot,
  newlyUnlockedAchievements,
  type AchievementDef,
  type AchievementSnapshot,
} from '@/lib/domain';
import { useEntriesStore } from './entries';
import { useBodyweightStore } from './bodyweight';
import { useMeasurementsStore } from './measurements';

export interface AchievementsState {
  seenAchievements: string[];
  setSeenAchievements: (ids: string[]) => void;
  /** Union new ids in (import merge). */
  mergeSeen: (ids: string[]) => void;
  /** Check current data; mark + return newly unlocked achievements (celebrate these). */
  checkAchievements: () => AchievementDef[];
  /** Mark already-earned achievements seen without celebrating (app load). */
  syncSeenSilently: () => void;
}

/** Snapshot across the three data stores. */
export function currentAchievementSnapshot(): AchievementSnapshot {
  return achievementStatsSnapshot(
    useEntriesStore.getState().entries,
    useBodyweightStore.getState().bwEntries,
    useMeasurementsStore.getState().measurements,
  );
}

export const useAchievementsStore = create<AchievementsState>((set, get) => {
  const persist = (seenAchievements: string[]) => {
    set({ seenAchievements });
    void saveSeenAchievements(seenAchievements);
  };

  return {
    seenAchievements: getSeenAchievements(),

    setSeenAchievements: (ids) => persist(ids),

    mergeSeen: (ids) => persist([...new Set([...get().seenAchievements, ...ids])]),

    checkAchievements: () => {
      const snap = currentAchievementSnapshot();
      const newly = newlyUnlockedAchievements(snap, get().seenAchievements);
      if (newly.length) {
        persist([...get().seenAchievements, ...newly.map((a) => a.id)]);
      }
      return newly;
    },

    syncSeenSilently: () => {
      const snap = currentAchievementSnapshot();
      const newly = newlyUnlockedAchievements(snap, get().seenAchievements);
      if (newly.length) {
        persist([...get().seenAchievements, ...newly.map((a) => a.id)]);
      }
    },
  };
});
