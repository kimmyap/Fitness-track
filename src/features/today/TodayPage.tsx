/**
 * Today page — home base (legacy renderToday):
 * day plan card, today's progress (lifting days), program-review nudge,
 * monthly recap, today's checklist, stats strip.
 */
import { Confetti, PageHeader } from '@/components';
import { DAY_PLAN, DAYS } from '@/lib/program';
import { isoDate } from '@/lib/domain';
import { Stack } from '@/features/train/ui';
import { useConfetti } from './celebrate';
import { DayPlanCard } from './DayPlanCard';
import { TodayProgressCard } from './TodayProgressCard';
import { ProgramReviewCard } from './ProgramReviewCard';
import { BackupReminderCard } from './BackupReminderCard';
import { MonthlyRecapCard } from './MonthlyRecapCard';
import { TodayChecklist } from './TodayChecklist';
import { TodayStatsStrip } from './StatsStrip';

export function TodayPage() {
  const now = new Date();
  const todayIso = isoDate(now);
  const plan = DAY_PLAN[now.getDay()];
  const confetti = useConfetti();
  const liftingTab = plan?.tab && DAYS[plan.tab] ? plan.tab : null;

  return (
    <>
      <PageHeader title="Today" subtitle="Your home base, updates automatically based on the day" />
      <Stack gap={3}>
        <DayPlanCard now={now} />
        {liftingTab ? <TodayProgressCard dayTab={liftingTab} todayIso={todayIso} /> : null}
        {/* Above the program nudge: losing the history outranks refreshing the plan. */}
        <BackupReminderCard />
        <ProgramReviewCard />
        <MonthlyRecapCard />
        <TodayChecklist todayIso={todayIso} onConfetti={confetti.fire} />
        <TodayStatsStrip />
      </Stack>
      <Confetti active={confetti.active} onDone={confetti.done} />
    </>
  );
}

export default TodayPage;
