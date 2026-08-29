/** Day-of-week plan hero card with "Go to {day}" deep link into /train. */
import styled from '@emotion/styled';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { Button, Card } from '@/components';
import { DAY_PLAN } from '@/lib/program';
import { Muted, Stack } from '@/features/train/ui';
import { trainPathForLegacyTab } from '@/features/train/trainTabs';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const LinkButton = Button.withComponent(Link);

const PlanLabel = styled.h2`
  margin: 0;
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  font-weight: 700;
`;

export function DayPlanCard({ now = new Date() }: { now?: Date }) {
  const dow = now.getDay();
  const plan = DAY_PLAN[dow];
  if (!plan) return null;
  return (
    <Card>
      <Stack gap={2}>
        <Muted>{DAY_NAMES[dow]}</Muted>
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
