/**
 * Pure helpers for the metrics screen.
 *
 * The hints under each input are averages of what YOU have logged, not target
 * figures. The app stores no calorie, protein or sleep goal, and inventing one
 * would be dispensing health advice the user never asked this tracker for — an
 * average of their own recent days is grounded and needs no new storage.
 */
import { dateWindow, parseIsoDate } from '@/lib/dates';
import type { DailyMetric, DailyMetricsMap } from '@/lib/types';

export type AveragedField = 'calories' | 'protein' | 'sleepHours';

/**
 * Dates in the window ending at `today`, inclusive, oldest first.
 *
 * Was its own copy of the parse-and-format pair, spelled a third way again
 * (`new Date(`${iso}T00:00:00`)`). Same result, but a separate implementation
 * is a separate thing to get wrong — see the header of `lib/dates.ts`.
 */
function windowDates(today: string, days: number): string[] {
  const end = parseIsoDate(today);
  return end ? dateWindow(end, days) : [];
}

/**
 * Mean of the days that actually recorded `field`, over the last `days` days.
 *
 * Days with no value are SKIPPED, not counted as zero: three logged days out of
 * seven should average those three, not be dragged to under half by four blanks.
 * Returns undefined when the window holds nothing, so the caller can omit the
 * hint rather than print "0".
 */
export function recentAverage(
  metrics: DailyMetricsMap,
  field: AveragedField,
  days: number,
  today: string,
): number | undefined {
  const values = windowDates(today, days)
    .map((d) => (metrics[d] as DailyMetric | undefined)?.[field])
    .filter((v): v is number => typeof v === 'number');
  if (!values.length) return undefined;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  // Sleep is the only one where a decimal carries meaning.
  return field === 'sleepHours' ? Math.round(mean * 10) / 10 : Math.round(mean);
}
