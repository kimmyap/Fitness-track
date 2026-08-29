/** Weekly volume recap card: this week's total (Mon–Sun) with % vs last week. */
import type { ReactNode } from 'react';
import { Card } from '@/components';
import { useEntriesStore, useSettingsStore } from '@/stores';
import { recapPct, weeklyRecap } from '@/lib/domain';
import { CardTitle, Muted, Stack, TrendDown, TrendUp, fmtVolume, unitLabel } from './ui';

export function WeeklyRecapCard() {
  const entries = useEntriesStore((s) => s.entries);
  const unit = useSettingsStore((s) => s.unit);
  const { thisWeek, lastWeek } = weeklyRecap(entries);
  const pct = recapPct(thisWeek, lastWeek);

  let diff: ReactNode;
  if (lastWeek > 0 && pct !== null) {
    if (pct > 0) diff = <TrendUp>↑ {pct}% vs last week</TrendUp>;
    else if (pct < 0) diff = <TrendDown>↓ {Math.abs(pct)}% vs last week</TrendDown>;
    else diff = <span>Same as last week</span>;
  } else if (thisWeek > 0) {
    diff = <span>No data last week to compare</span>;
  } else {
    diff = <span>Log a set to get started this week</span>;
  }

  return (
    <Card>
      <Stack gap={1}>
        <CardTitle>This Week&apos;s Volume</CardTitle>
        <Muted>
          {fmtVolume(thisWeek, unit)} {unitLabel(unit)} lifted · {diff}
        </Muted>
      </Stack>
    </Card>
  );
}
