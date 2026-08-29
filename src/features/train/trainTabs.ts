/**
 * Train page tab definitions + slug helpers.
 *
 * NOTE: the router currently routes only the exact `/train` path (no child
 * routes / splat), so deep links use a search param: `/train?tab=lower-a`.
 * If the router later gains `train/:tab?` support, these ids double as the
 * path slugs.
 */
import type { WorkoutDayName } from '@/lib/program';

export interface TrainTabDef {
  id: string;
  label: string;
  /** Legacy workout-day name for the three lifting tabs. */
  day?: WorkoutDayName;
}

export const TRAIN_TABS: TrainTabDef[] = [
  { id: 'lower-a', label: 'Lower A', day: 'Lower A' },
  { id: 'upper', label: 'Upper', day: 'Upper' },
  { id: 'lower-b', label: 'Lower B', day: 'Lower B' },
  { id: 'warmup', label: 'Warm-up' },
  { id: 'core', label: 'Core' },
];

export const DEFAULT_TRAIN_TAB = 'lower-a';

export function isTrainTabId(id: string | null): id is string {
  return id !== null && TRAIN_TABS.some((t) => t.id === id);
}

/** Legacy tab name ("Lower A", "Warm-up", …) → train tab id. */
export function trainTabIdForLegacyTab(tabName: string): string {
  const match = TRAIN_TABS.find((t) => t.day === tabName || t.label === tabName);
  return match ? match.id : DEFAULT_TRAIN_TAB;
}

/** Deep link to a train tab, e.g. "/train?tab=lower-a". */
export function trainPathForLegacyTab(tabName: string): string {
  return `/train?tab=${trainTabIdForLegacyTab(tabName)}`;
}
