/**
 * Small helpers for reading back logged history.
 *
 * Split out of the former single `domain.ts`; see ./index.ts.
 */
import type { Entry, LiftSetEntry } from '../types';
import { isLiftSet } from '../types';

// History helpers
// ---------------------------------------------------------------------------

/** Last 15 entries for an exercise, newest first. */
export function historyFor(entries: Entry[], exName: string): LiftSetEntry[] {
  return entries
    .filter((e): e is LiftSetEntry => isLiftSet(e) && e.exercise === exName)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);
}

/** 1-based working-set number of an entry within its day. */
export function setNumberInDay(entries: Entry[], entry: LiftSetEntry): number {
  const sameDay = entries.filter(
    (e): e is LiftSetEntry => isLiftSet(e) && e.exercise === entry.exercise && e.date === entry.date && !e.warmupSet,
  );
  return sameDay.findIndex((e) => e.id === entry.id) + 1;
}
