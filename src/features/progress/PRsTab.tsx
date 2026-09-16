/**
 * Progress → PRs: every personal record you have hit, newest first.
 *
 * Entirely derived from `gymlog:entries` — nothing here is stored. PRs already
 * fired confetti when they happened and then vanished; this is the only place
 * that remembers them.
 *
 * `prHistory` uses the same filter as `isPR`, so this list and the celebration
 * agree: warm-up, assisted and drop sets are not records, and bodyweight
 * variations are out because their weight is not a load you chose.
 */
import { useMemo } from 'react';
import styled from '@emotion/styled';
import { Trophy } from 'lucide-react';
import { Card, EmptyState, StatStrip, StatTile } from '@/components';
import { useEntriesStore, useSettingsStore } from '@/stores';
import { displayDate, prHistory } from '@/lib/domain';
import { CardTitle, Muted, Stack, fmtStoredWeight } from '@/features/train/ui';

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${({ theme }) => `${theme.space[1]} ${theme.space[2]}`};
  align-items: baseline;
  padding: ${({ theme }) => `${theme.space[2]} 0`};
  border-top: 1px solid ${({ theme }) => theme.colors.border};

  &:first-of-type {
    border-top: none;
  }
`;

const Name = styled.span`
  font-weight: 500;
  color: ${({ theme }) => theme.colors.cardForeground};
`;

const Weight = styled.span`
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.cardForeground};
`;

/* Second line of each row: the detail, muted, spanning both columns. */
const Detail = styled(Muted.withComponent('span'))`
  grid-column: 1 / -1;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
`;

export function PRsTab() {
  const entries = useEntriesStore((s) => s.entries);
  const unit = useSettingsStore((s) => s.unit);
  // Raw slice + useMemo: a selector returning a fresh array loops in zustand v5.
  const records = useMemo(() => prHistory(entries), [entries]);

  if (!records.length) {
    return (
      <EmptyState
        icon={Trophy}
        title="No PRs yet"
        description="Log a working set on the Train tab. Your first log of any lift is a record, and every one after that shows up here."
      />
    );
  }

  const lifts = new Set(records.map((r) => r.exercise)).size;
  const latest = records[0];

  return (
    <Stack gap={3}>
      <StatStrip>
        <StatTile label="All-time PRs" value={records.length} />
        <StatTile label="Lifts with a PR" value={lifts} />
        <StatTile label="Most recent" value={latest ? displayDate(latest.date) : '--'} />
      </StatStrip>

      <Card>
        <CardTitle>Every PR, newest first</CardTitle>
        {records.map((pr) => (
          <Row key={`${pr.exercise}-${pr.date}-${pr.weight}`}>
            <Name>{pr.exercise}</Name>
            <Weight>{fmtStoredWeight(pr.weight, unit)}</Weight>
            <Detail>
              {displayDate(pr.date)} · {pr.reps} reps
              {pr.variation ? ` · ${pr.variation}` : ''}
              {pr.gain > 0 ? ` · +${fmtStoredWeight(pr.gain, unit)} on your previous best` : ' · first time logged'}
            </Detail>
          </Row>
        ))}
      </Card>
    </Stack>
  );
}

export default PRsTab;
