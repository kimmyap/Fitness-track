/**
 * Pure helpers for the metrics screen.
 *
 * The hints under each input are averages of what YOU have logged, not target
 * figures. The app stores no calorie, protein or sleep goal, and inventing one
 * would be dispensing health advice the user never asked this tracker for — an
 * average of their own recent days is grounded and needs no new storage.
 */
import type { DailyMetric, DailyMetricsMap } from '@/lib/types';

export type AveragedField = 'calories' | 'protein' | 'sleepHours';

/** Dates in the window ending at `today`, inclusive, oldest first. */
function windowDates(today: string, days: number): string[] {
  const out: string[] = [];
  const end = new Date(`${today}T00:00:00`);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return out;
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
