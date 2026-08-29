/**
 * Today's Checklist: warm-up / lifting / Pilates-Volleyball / core rows with
 * quick-log buttons for Pilates, Volleyball and the Core Finisher.
 */
import styled from '@emotion/styled';
import { Badge, Button, Card, toast } from '@/components';
import { useEntriesStore, selectHasCompletion, useAchievementsStore } from '@/stores';
import { isActivity, isLiftSet } from '@/lib/types';
import type { ActivityEntry, ActivityName } from '@/lib/types';
import { CardTitle, Muted, Row, SetRow, Stack } from '@/features/train/ui';
import { celebrateAchievements } from './celebrate';

const DoneMark = styled.span`
  color: ${({ theme }) => theme.colors.accent};
  font-weight: 600;
`;

function StatusText({ done, doneLabel = '✓ done' }: { done: boolean; doneLabel?: string }) {
  return done ? <DoneMark>{doneLabel}</DoneMark> : <Muted as="span">· not yet</Muted>;
}

export function TodayChecklist({ todayIso, onConfetti }: { todayIso: string; onConfetti: () => void }) {
  const doneWarmup = useEntriesStore(selectHasCompletion('warmup', todayIso));
  const doneCore = useEntriesStore(selectHasCompletion('core', todayIso));
  // NOTE: subscribe to the raw entries array and derive during render —
  // zustand v5 selectors must return stable references (no fresh arrays).
  const entries = useEntriesStore((s) => s.entries);
  const doneActivity = entries
    .filter((e): e is ActivityEntry => isActivity(e) && e.date === todayIso)
    .map((e) => e.activity);
  const doneLift = entries.some((e) => e.date === todayIso && isLiftSet(e));
  const logActivity = useEntriesStore((s) => s.logActivity);
  const toggleCompletion = useEntriesStore((s) => s.toggleCompletion);

  const celebrate = () => celebrateAchievements(useAchievementsStore.getState().checkAchievements(), onConfetti);

  const quickLogActivity = (activity: ActivityName) => {
    logActivity(activity, todayIso);
    toast(`${activity} logged for today`);
    celebrate();
  };

  const quickLogCore = () => {
    if (doneCore) return;
    toggleCompletion('core', todayIso);
    toast('Core Finisher logged for today');
    celebrate();
  };

  return (
    <Card>
      <Stack gap={1}>
        <CardTitle>Today&apos;s Checklist</CardTitle>
        <SetRow noBorder>
          <span>Warm-up</span>
          <StatusText done={doneWarmup} />
        </SetRow>
        <SetRow>
          <span>Lifting logged</span>
          <StatusText done={doneLift} />
        </SetRow>
        <SetRow>
          <span>
            Pilates / Volleyball <Badge>optional</Badge>
          </span>
          <StatusText done={doneActivity.length > 0} doneLabel={`✓ ${doneActivity.join(', ')}`} />
        </SetRow>
        <SetRow>
          <span>
            Core Finisher <Badge>optional</Badge>
          </span>
          <StatusText done={doneCore} />
        </SetRow>
        <Row wrap>
          <Button
            variant="secondary"
            disabled={doneActivity.includes('Pilates')}
            onClick={() => quickLogActivity('Pilates')}
          >
            {doneActivity.includes('Pilates') ? '✓ Pilates logged' : '+ Log Pilates'}
          </Button>
          <Button
            variant="secondary"
            disabled={doneActivity.includes('Volleyball')}
            onClick={() => quickLogActivity('Volleyball')}
          >
            {doneActivity.includes('Volleyball') ? '✓ Volleyball logged' : '+ Log Volleyball'}
          </Button>
          <Button variant="secondary" disabled={doneCore} onClick={quickLogCore}>
            {doneCore ? '✓ Core logged' : '+ Log Core Finisher'}
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
