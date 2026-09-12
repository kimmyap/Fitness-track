/**
 * Daily metrics + cardio, shown as a tab under Progress.
 *
 * Self-contained: nothing here imports from `features/train`, so the strength
 * logger and this screen can move independently.
 */
import { useState } from 'react';
import { isoDate } from '@/lib/domain';
import { useSettingsStore } from '@/stores';
import { DailyMetricsForm } from './DailyMetricsForm';
import { CardioSection } from './CardioSection';
import { DateInput, Hint, Row, Stack } from './ui';

export function MetricsTab() {
  const unit = useSettingsStore((s) => s.unit);
  const today = isoDate();
  const [date, setDate] = useState(today);

  return (
    <Stack gap={4}>
      <Row>
        <label htmlFor="metrics-date">
          <Hint as="span">Logging for</Hint>
        </label>
        <DateInput
          id="metrics-date"
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
        />
      </Row>

      <DailyMetricsForm date={date} unit={unit} />
      <CardioSection date={date} unit={unit} />
    </Stack>
  );
}

export default MetricsTab;
