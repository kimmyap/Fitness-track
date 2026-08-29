/** Program-review nudge: shows after ≥6 weeks; "I reviewed it" resets the timestamp. */
import styled from '@emotion/styled';
import { SearchCheck } from 'lucide-react';
import { Button, Card, toast } from '@/components';
import { useSettingsStore } from '@/stores';
import { PROGRAM_REVIEW_NUDGE_WEEKS, weeksSinceReview } from '@/lib/domain';
import { CardTitle, Muted, Stack } from '@/features/train/ui';

const NudgeCard = styled(Card)`
  border-color: ${({ theme }) => theme.colors.primary};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  color: ${({ theme }) => theme.colors.primary};
`;

export function ProgramReviewCard() {
  const lastProgramReview = useSettingsStore((s) => s.lastProgramReview);
  const markProgramReviewed = useSettingsStore((s) => s.markProgramReviewed);
  const weeksIn = weeksSinceReview(lastProgramReview);
  if (weeksIn < PROGRAM_REVIEW_NUDGE_WEEKS) return null;

  return (
    <NudgeCard>
      <Stack gap={2}>
        <TitleRow>
          <SearchCheck size={18} aria-hidden="true" />
          <CardTitle>{weeksIn} weeks on this plan</CardTitle>
        </TitleRow>
        <Muted>
          This is usually a good point to check in. Look at your weekly volume trend, see which lifts keep
          hitting &quot;hold&quot; instead of &quot;up,&quot; and consider swapping one or two exercises rather
          than overhauling everything.
        </Muted>
        <Button
          fullWidth
          onClick={() => {
            markProgramReviewed();
            toast("Nice, we'll check back in with you in 6-8 weeks");
          }}
        >
          I reviewed it, remind me in 6-8 weeks
        </Button>
      </Stack>
    </NudgeCard>
  );
}
