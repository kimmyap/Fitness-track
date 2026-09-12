/**
 * Day-of-week plan hero card with "Go to {day}" deep link into /train.
 *
 * The kind of day is stated outright rather than left to be inferred from
 * whether a button happens to be present: a rest day and a training day you
 * have not started look identical otherwise.
 */
import styled from '@emotion/styled';
import { Link } from 'react-router';
import { ArrowRight, Dumbbell, HeartPulse, Moon } from 'lucide-react';
import { Button, Card } from '@/components';
import { DAY_PLAN, DAYS } from '@/lib/program';
import { dayPlanKind, type DayPlanKind } from '@/lib/domain';
import { Muted, Stack } from '@/features/train/ui';
import { trainPathForLegacyTab } from '@/features/train/trainTabs';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const KIND_TEXT: Record<DayPlanKind, string> = {
  training: 'Training day',
  recovery: 'Active recovery',
  rest: 'Rest day',
};

const KIND_ICON = { training: Dumbbell, recovery: HeartPulse, rest: Moon };

const LinkButton = Button.withComponent(Link);

const PlanLabel = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  font-weight: 700;
`;

/** Icon + word, never colour alone. */
const StatusChip = styled.span<{ kind: DayPlanKind }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  align-self: flex-start;
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[2]}`};
  border-radius: ${({ theme }) => theme.radii.full};
  border: 1px solid
    ${({ theme, kind }) => (kind === 'training' ? theme.colors.primary : theme.colors.border)};
  color: ${({ theme, kind }) => (kind === 'training' ? theme.colors.primary : theme.colors.mutedForeground)};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
`;

const HeadRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[2]};
`;

export function DayPlanCard({ now = new Date() }: { now?: Date }) {
  const dow = now.getDay();
  const plan = DAY_PLAN[dow];
  if (!plan) return null;
  const kind = dayPlanKind(plan, Object.keys(DAYS));
  const KindIcon = KIND_ICON[kind];
  return (
    <Card>
      <Stack gap={2}>
        <HeadRow>
          <Muted>{DAY_NAMES[dow]}</Muted>
          <StatusChip kind={kind}>
            <KindIcon size={12} aria-hidden="true" />
            {KIND_TEXT[kind]}
          </StatusChip>
        </HeadRow>
        <PlanLabel>{plan.label}</PlanLabel>
        <Muted>{plan.detail}</Muted>
        {plan.tab ? (
          <LinkButton to={trainPathForLegacyTab(plan.tab)} fullWidth>
            Go to {plan.tab}
            <ArrowRight size={18} aria-hidden="true" />
          </LinkButton>
        ) : null}
      </Stack>
    </Card>
  );
}
