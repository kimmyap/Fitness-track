/**
 * Today's Checklist: one row per item, each with its own log trigger.
 *
 * The triggers used to sit in a block under the list, so the button and the
 * row it affected were separated by everything in between and Pilates and
 * Volleyball shared a single row while having two separate buttons. Each item
 * now owns its control.
 *
 * Logging is one-way here. `toggleCompletion` does remove on a second call,
 * but a stray tap silently deleting a logged session is exactly what the
 * delete confirmations elsewhere exist to prevent — so a done row disables its
 * button, and removing a completion stays a Calendar action.
 */
import styled from '@emotion/styled';
import { Badge, Button, Card, toast } from '@/components';
import { useEntriesStore, selectHasCompletion, useAchievementsStore } from '@/stores';
import { isActivity, isLiftSet } from '@/lib/types';
import type { ActivityEntry, ActivityName } from '@/lib/types';
import { CardTitle, Muted, Row, SetRow, Stack } from '@/features/train/ui';
import { celebrateAchievements } from './celebrate';

const DoneMark = styled.span`
  color: ${({ theme }) => theme.colors.accentText};
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

  const quickLogCompletion = (type: 'warmup' | 'core', label: string, done: boolean) => () => {
    if (done) return;
    toggleCompletion(type, todayIso);
    toast(`${label} logged for today`);
    celebrate();
  };

  return (
    <Card>
      <Stack gap={1}>
        <CardTitle>Today&apos;s Checklist</CardTitle>

        <ChecklistRow
          noBorder
          label="Warm-up"
          done={doneWarmup}
          action={{ label: 'Warm-up', onLog: quickLogCompletion('warmup', 'Warm-up', doneWarmup) }}
        />
        {/* No trigger: sets are logged on the Train screen, not from here. */}
        <ChecklistRow label="Lifting logged" done={doneLift} />
        <ChecklistRow
          label="Pilates"
          optional
          done={doneActivity.includes('Pilates')}
          action={{ label: 'Pilates', onLog: () => quickLogActivity('Pilates') }}
        />
        <ChecklistRow
          label="Volleyball"
          optional
          done={doneActivity.includes('Volleyball')}
          action={{ label: 'Volleyball', onLog: () => quickLogActivity('Volleyball') }}
        />
        <ChecklistRow
          label="Core Finisher"
          optional
          done={doneCore}
          action={{ label: 'Core Finisher', onLog: quickLogCompletion('core', 'Core Finisher', doneCore) }}
        />
      </Stack>
    </Card>
  );
}

interface ChecklistRowProps {
  label: string;
  done: boolean;
  optional?: boolean;
  noBorder?: boolean;
  /** Omitted for rows that are status-only, like lifting. */
  action?: { label: string; onLog: () => void };
}

function ChecklistRow({ label, done, optional, noBorder, action }: ChecklistRowProps) {
  return (
    <SetRow noBorder={noBorder}>
      <span>
        {label} {optional ? <Badge>optional</Badge> : null}
      </span>
      <Row>
        <StatusText done={done} />
        {action ? (
          <Button
            variant="secondary"
            disabled={done}
            aria-label={done ? `${action.label} already logged today` : `Log ${action.label} for today`}
            onClick={action.onLog}
          >
            {done ? '✓ Logged' : '+ Log'}
          </Button>
        ) : null}
      </Row>
    </SetRow>
  );
}
