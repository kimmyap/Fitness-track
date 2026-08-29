/** Bodyweight store (gymlog:bodyweight). Weights in lbs. Write-through on every mutation. */
import { create } from 'zustand';
import { getBodyweight, saveBodyweight } from '@/lib/storage';
import { generateId, isoDate } from '@/lib/domain';
import type { BodyweightEntry } from '@/lib/types';

export interface BodyweightState {
  bwEntries: BodyweightEntry[];
  setBwEntries: (entries: BodyweightEntry[]) => void;
  /** Log a weigh-in (lbs). Defaults to today. Returns the created entry. */
  addWeighIn: (weightLbs: number, date?: string) => BodyweightEntry;
  /** Remove an entry; returns it for the Undo toast. */
  deleteWeighIn: (id: string) => BodyweightEntry | undefined;
  restoreWeighIn: (entry: BodyweightEntry) => void;
}

export const useBodyweightStore = create<BodyweightState>((set, get) => {
  const persist = (bwEntries: BodyweightEntry[]) => {
    set({ bwEntries });
    void saveBodyweight(bwEntries);
  };

  return {
    bwEntries: getBodyweight(),
    setBwEntries: (entries) => persist(entries),
    addWeighIn: (weightLbs, date) => {
      const entry: BodyweightEntry = { id: generateId(), date: date ?? isoDate(), weight: weightLbs };
      persist([...get().bwEntries, entry]);
      return entry;
    },
    deleteWeighIn: (id) => {
      const { bwEntries } = get();
      const removed = bwEntries.find((e) => e.id === id);
      if (!removed) return undefined;
      persist(bwEntries.filter((e) => e.id !== id));
      return removed;
    },
    restoreWeighIn: (entry) => persist([...get().bwEntries, entry]),
  };
});

/** Newest-first history (legacy shows last 10). */
export const selectBwHistory = (s: BodyweightState): BodyweightEntry[] =>
  [...s.bwEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

export const selectLatestBw = (s: BodyweightState): BodyweightEntry | undefined => selectBwHistory(s)[0];
