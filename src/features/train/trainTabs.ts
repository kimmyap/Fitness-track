/**
 * Train page tab definitions + slug helpers.
 *
 * NOTE: the router currently routes only the exact `/train` path (no child
 * routes / splat), so deep links use a search param: `/train?tab=lower-a`.
 * If the router later gains `train/:tab?` support, these ids double as the
 * path slugs.
 */
export interface TrainTabDef {
  id: string;
  label: string;
  /** Workout-day name; absent for the Warm-up and Core tabs. */
  day?: string;
}

/** "Lower A" → "lower-a". Days are user-editable, so slugs are derived. */
export function daySlug(day: string): string {
  return (
    day
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'day'
  );
}

export const FIXED_TRAIN_TABS: TrainTabDef[] = [
  { id: 'warmup', label: 'Warm-up' },
  { id: 'core', label: 'Core' },
];

/**
 * Tabs for the given workout days, plus the fixed Warm-up / Core tabs.
 * Duplicate slugs get a numeric suffix so two days can't collide.
 */
export function trainTabsForDays(days: string[]): TrainTabDef[] {
  const used = new Set<string>();
  const dayTabs = days.map((day) => {
    let id = daySlug(day);
    let n = 2;
    while (used.has(id)) id = `${daySlug(day)}-${n++}`;
    used.add(id);
    return { id, label: day, day };
  });
  return [...dayTabs, ...FIXED_TRAIN_TABS];
}

/** Legacy default; overridden by the first stored day at runtime. */
export const DEFAULT_TRAIN_TAB = 'lower-a';

export function isTrainTabId(id: string | null, tabs: TrainTabDef[]): id is string {
  return id !== null && tabs.some((t) => t.id === id);
}

/** Day or fixed-tab name → train tab id, within the given tab set. */
export function trainTabIdForLegacyTab(tabName: string, tabs: TrainTabDef[]): string {
  const match = tabs.find((t) => t.day === tabName || t.label === tabName);
  return match ? match.id : (tabs[0]?.id ?? DEFAULT_TRAIN_TAB);
}

/**
 * Deep link to a train tab, e.g. "/train?tab=lower-a".
 * Slugs are derived from the day name, so this needs no store access.
 */
export function trainPathForLegacyTab(tabName: string): string {
  const fixed = FIXED_TRAIN_TABS.find((t) => t.label === tabName);
  return `/train?tab=${fixed ? fixed.id : daySlug(tabName)}`;
}
