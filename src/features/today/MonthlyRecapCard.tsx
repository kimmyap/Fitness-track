/** Monthly recap card: days trained, volume this month, % change vs last month. */
import styled from '@emotion/styled';
import type { ReactNode } from 'react';
import { TrendingUp } from 'lucide-react';
import { Card } from '@/components';
import { useEntriesStore, useSettingsStore } from '@/stores';
import { monthlyRecap, recapPct } from '@/lib/domain';
import { CardTitle, Muted, Stack, TrendDown, TrendUp, fmtVolume, unitLabel } from '@/features/train/ui';

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

export function MonthlyRecapCard() {
  const entries = useEntriesStore((s) => s.entries);
  const unit = useSettingsStore((s) => s.unit);
  const monthly = monthlyRecap(entries);
  const pct = recapPct(monthly.thisMonth, monthly.lastMonth);

  let diff: ReactNode;
  if (monthly.lastMonth > 0 && pct !== null) {
    if (pct > 0) diff = <TrendUp>↑ {pct}% vs last month</TrendUp>;
    else if (pct < 0) diff = <TrendDown>↓ {Math.abs(pct)}% vs last month</TrendDown>;
    else diff = <Muted as="span">Same as last month</Muted>;
  } else if (monthly.thisMonth > 0) {
    diff = <Muted as="span">No data last month to compare</Muted>;
  } else {
    diff = <Muted as="span">Log a set to get started this month</Muted>;
  }

  return (
    <Card>
      <Stack gap={2}>
        <TitleRow>
          <TrendingUp size={18} aria-hidden="true" />
          <CardTitle>This Month</CardTitle>
        </TitleRow>
        <Muted>
          {monthly.thisMonthDays} day{monthly.thisMonthDays !== 1 ? 's' : ''} trained ·{' '}
          {fmtVolume(monthly.thisMonth, unit)}
          {unitLabel(unit)} lifted
        </Muted>
        <Muted as="div">{diff}</Muted>
      </Stack>
    </Card>
  );
}
