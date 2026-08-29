/**
 * Warm-up tab (legacy renderWarmup): mark-complete toggle + 7-day WeekStrip +
 * static routine cards (content from lib/program).
 *
 * Legacy quirk preserved: toggling warm-up does NOT run the achievements
 * check (unlike the core toggle).
 */
import styled from '@emotion/styled';
import { Button, Card, WeekStrip, toast } from '@/components';
import { useEntriesStore } from '@/stores';
import { isoDate } from '@/lib/domain';
import { WARMUP_ROUTINE, WARMUP_WHY, randomHype } from '@/lib/program';
import { CardTitle, Muted, SetRow, Stack, last7Dates } from './ui';

export const CompleteButton = styled(Button)<{ done: boolean }>`
  ${({ theme, done }) =>
    done
      ? `background: ${theme.colors.accent}; color: ${theme.colors.onAccent};`
      : ''};
`;

export function WarmupTab() {
  const todayIso = isoDate();
  const entries = useEntriesStore((s) => s.entries);
  const toggleCompletion = useEntriesStore((s) => s.toggleCompletion);
  const doneToday = entries.some((e) => 'type' in e && e.type === 'warmup' && e.date === todayIso);

  const stripDays = last7Dates().map((date) => ({
    date,
    done: entries.some((e) => 'type' in e && e.type === 'warmup' && e.date === date),
  }));

  return (
    <Stack gap={3}>
      <Card>
        <Stack gap={2}>
          <CardTitle>Today&apos;s Warm-up</CardTitle>
          <Muted>{doneToday ? 'Marked complete' : 'Not logged yet'}</Muted>
          <CompleteButton
            fullWidth
            done={doneToday}
            onClick={() => {
              const nowDone = toggleCompletion('warmup', todayIso);
              if (nowDone) toast(randomHype());
            }}
          >
            {doneToday ? '✓ Warm-up Complete' : 'Mark Warm-up Complete'}
          </CompleteButton>
          <WeekStrip days={stripDays} label="Warm-up completion, last 7 days" />
        </Stack>
      </Card>

      {WARMUP_ROUTINE.map((section) => (
        <Card key={section.title}>
          <CardTitle>{section.title}</CardTitle>
          <Muted>{section.subtitle}</Muted>
          {section.items.map((item, i) => (
            <SetRow key={item.name} noBorder={i === 0}>
              <span>{item.name}</span>
              <Muted as="span">{item.detail}</Muted>
            </SetRow>
          ))}
        </Card>
      ))}

      <Card>
        <Stack gap={2}>
          <CardTitle>{WARMUP_WHY.title}</CardTitle>
          <Muted>{WARMUP_WHY.text}</Muted>
        </Stack>
      </Card>
    </Stack>
  );
}
