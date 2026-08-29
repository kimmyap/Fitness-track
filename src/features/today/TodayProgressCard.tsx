/** Today's Progress card (lifting days only): sets done / target with a progress bar. */
import styled from '@emotion/styled';
import { Badge, Card } from '@/components';
import { useCustomExercisesStore, useEntriesStore } from '@/stores';
import { exercisesForDay } from '@/lib/domain';
import { DAYS } from '@/lib/program';
import { isLiftSet } from '@/lib/types';
import { CardTitle, Stack } from '@/features/train/ui';

const BarTrack = styled.div`
  height: 10px;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.muted};
  overflow: hidden;
`;

const BarFill = styled.div<{ pct: number; done: boolean }>`
  height: 100%;
  width: ${({ pct }) => pct}%;
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme, done }) => (done ? theme.colors.accent : theme.colors.primary)};
  transition: width ${({ theme }) => `${theme.motion.duration.entrance} ${theme.motion.easing.out}`};
`;

const HeadRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
`;

export function TodayProgressCard({ dayTab, todayIso }: { dayTab: string; todayIso: string }) {
  // Raw subscriptions + pure derivation (zustand v5: no fresh-array selectors)
  const customExercises = useCustomExercisesStore((s) => s.customExercises);
  const excludedBuiltIns = useCustomExercisesStore((s) => s.excludedBuiltIns);
  const entries = useEntriesStore((s) => s.entries);
  const exercises = exercisesForDay(dayTab, DAYS, customExercises, excludedBuiltIns);

  const targetTotal = exercises.reduce((sum, ex) => sum + ex.targetSets, 0);
  const doneTotal = exercises.reduce(
    (sum, ex) =>
      sum +
      entries.filter((e) => isLiftSet(e) && e.exercise === ex.name && e.date === todayIso && !e.warmupSet).length,
    0,
  );
  const pct = targetTotal ? Math.min(100, Math.round((doneTotal / targetTotal) * 100)) : 0;
  const done = pct >= 100;

  return (
    <Card>
      <Stack gap={2}>
        <HeadRow>
          <CardTitle>Today&apos;s Progress</CardTitle>
          <Badge tone={done ? 'success' : 'neutral'}>
            {doneTotal}/{targetTotal} sets{done ? ' ✓' : ''}
          </Badge>
        </HeadRow>
        <BarTrack
          role="progressbar"
          aria-valuenow={doneTotal}
          aria-valuemin={0}
          aria-valuemax={targetTotal}
          aria-label={`${doneTotal} of ${targetTotal} sets logged today`}
        >
          <BarFill pct={pct} done={done} />
        </BarTrack>
      </Stack>
    </Card>
  );
}
