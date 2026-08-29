/**
 * Calendar route: month grid + day detail + per-day notes
 * (legacy Calendar tab, renderCalendar — legacy/index.html 3026–3216).
 */
import { useState } from 'react';
import styled from '@emotion/styled';
import { Card, PageHeader } from '@/components';
import { isoDate } from '@/lib/domain';
import { useEntriesStore } from '@/stores';
import { MonthGrid } from './MonthGrid';
import { DayDetail } from './DayDetail';
import { dayFlagsMap } from './calendarMath';
import { useAchievementCelebration } from './useAchievementCelebration';

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[4]};
`;

export function CalendarPage() {
  const todayIso = isoDate();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());
  // Legacy starts with no day selected ("Tap a highlighted day…").
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const entries = useEntriesStore((s) => s.entries);
  const flags = dayFlagsMap(entries);
  const { celebrate, confetti } = useAchievementCelebration();

  return (
    <>
      <PageHeader title="Calendar" subtitle="Tap a highlighted day to see what you logged" />
      <Stack>
        <Card>
          <MonthGrid
            year={year}
            monthIndex={monthIndex}
            flags={flags}
            todayIso={todayIso}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            onMonthChange={(y, m) => {
              setYear(y);
              setMonthIndex(m);
            }}
          />
        </Card>
        {selectedDate ? <DayDetail date={selectedDate} todayIso={todayIso} onMutate={celebrate} /> : null}
      </Stack>
      {confetti}
    </>
  );
}

export default CalendarPage;
