/**
 * A day's wellness metrics: calories, protein, sleep, energy, body weight.
 *
 * Body weight is the odd one out and deliberately so — it writes to
 * gymlog:bodyweight through useBodyweightStore, the same key the Body tab's
 * chart reads, rather than into gymlog:dailyMetrics. Storing it twice would
 * mean logging here and watching the chart not move.
 *
 * Fields save on blur, not on every keystroke: this is a form you fill in over
 * a few seconds, and a write per character would churn localStorage and the
 * save-retry machinery for no benefit.
 */
import { useEffect, useState } from 'react';
import { Card, NumberInput } from '@/components';
import { fromDisplayWeight, toDisplayWeight } from '@/lib/domain';
import type { EnergyRating, Unit } from '@/lib/types';
import { useBodyweightStore, useMetricsStore } from '@/stores';
import { recentAverage, type AveragedField } from './metricsMath';
import { ChoiceButton, ChoiceRow, FieldGrid, Hint, SectionTitle, Stack, UnitBadge } from './ui';

/** Days behind the selected date that the hint averages over. */
const AVERAGE_WINDOW_DAYS = 7;

function Label({ text, unit }: { text: string; unit: string }) {
  return (
    <>
      {text}
      <UnitBadge>{unit}</UnitBadge>
    </>
  );
}

const ENERGY: { value: EnergyRating; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
];

const ENERGY_HINT: Record<EnergyRating, string> = {
  1: 'Wiped — nothing in the tank.',
  2: 'Flat, pushed through it.',
  3: 'Average day.',
  4: 'Good — sessions felt easy.',
  5: 'Great — everything moved fast.',
};

/** '' when absent, so an empty input clears the stored value rather than writing 0. */
type Draft = { calories: number | ''; protein: number | ''; sleepHours: number | ''; weight: number | '' };

export interface DailyMetricsFormProps {
  date: string;
  unit: Unit;
}

export function DailyMetricsForm({ date, unit }: DailyMetricsFormProps) {
  const dailyMetrics = useMetricsStore((s) => s.dailyMetrics);
  const setDayMetrics = useMetricsStore((s) => s.setDayMetrics);
  const bwEntries = useBodyweightStore((s) => s.bwEntries);
  const upsertWeighIn = useBodyweightStore((s) => s.upsertWeighIn);

  const stored = dailyMetrics[date] ?? {};
  const weighIn = [...bwEntries].reverse().find((e) => e.date === date);

  const [draft, setDraft] = useState<Draft>({ calories: '', protein: '', sleepHours: '', weight: '' });

  // Re-seed whenever the selected day changes, or the stored values do.
  useEffect(() => {
    setDraft({
      calories: stored.calories ?? '',
      protein: stored.protein ?? '',
      sleepHours: stored.sleepHours ?? '',
      weight: weighIn ? toDisplayWeight(weighIn.weight, unit) : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, unit, stored.calories, stored.protein, stored.sleepHours, weighIn?.weight]);

  const commit = (key: 'calories' | 'protein' | 'sleepHours') => () => {
    const value = draft[key];
    setDayMetrics(date, { [key]: value === '' ? undefined : value });
  };

  const commitWeight = () => {
    if (draft.weight === '') return; // clearing the box does not delete a weigh-in
    upsertWeighIn(fromDisplayWeight(draft.weight, unit), date);
  };

  const energy = stored.energy;

  /**
   * Hints are averages of what has actually been logged, not targets — this app
   * stores no calorie, protein or sleep goal, and an invented one would be
   * health advice rather than tracking. Absent until there is something to
   * average, so an empty history shows no hint rather than "0".
   */
  const avgHint = (field: AveragedField, suffix: string): string | undefined => {
    const avg = recentAverage(dailyMetrics, field, AVERAGE_WINDOW_DAYS, date);
    return avg === undefined ? undefined : `${AVERAGE_WINDOW_DAYS}-day avg ${avg.toLocaleString()}${suffix}`;
  };

  return (
    <Card as="section">
      <Stack gap={3}>
        <SectionTitle>Daily metrics</SectionTitle>

        <FieldGrid>
          <NumberInput
            label={<Label text="Calories" unit="kcal" />}
            value={draft.calories}
            min={0}
            step="any"
            inputMode="numeric"
            helper={avgHint('calories', '')}
            onChange={(e) => setDraft((d) => ({ ...d, calories: e.target.value === '' ? '' : Number(e.target.value) }))}
            onBlur={commit('calories')}
          />
          <NumberInput
            label={<Label text="Protein" unit="g" />}
            value={draft.protein}
            min={0}
            step="any"
            inputMode="numeric"
            helper={avgHint('protein', 'g')}
            onChange={(e) => setDraft((d) => ({ ...d, protein: e.target.value === '' ? '' : Number(e.target.value) }))}
            onBlur={commit('protein')}
          />
          <NumberInput
            label={<Label text="Sleep" unit="hrs" />}
            value={draft.sleepHours}
            min={0}
            max={24}
            step="any"
            inputMode="decimal"
            helper={avgHint('sleepHours', 'h')}
            onChange={(e) =>
              setDraft((d) => ({ ...d, sleepHours: e.target.value === '' ? '' : Number(e.target.value) }))
            }
            onBlur={commit('sleepHours')}
          />
          <NumberInput
            label={<Label text="Body weight" unit={unit} />}
            value={draft.weight}
            min={0}
            step="any"
            inputMode="decimal"
            helper="Shared with the Body chart"
            onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value === '' ? '' : Number(e.target.value) }))}
            onBlur={commitWeight}
          />
        </FieldGrid>

        <Stack gap={1}>
          <SectionTitle as="h3" id={`energy-label-${date}`}>
            Energy
          </SectionTitle>
          <ChoiceRow role="group" aria-labelledby={`energy-label-${date}`}>
            {ENERGY.map(({ value, label }) => (
              <ChoiceButton
                key={value}
                type="button"
                active={energy === value}
                aria-pressed={energy === value}
                onClick={() => setDayMetrics(date, { energy: energy === value ? undefined : value })}
              >
                {label}
              </ChoiceButton>
            ))}
          </ChoiceRow>
          <Hint>{energy ? ENERGY_HINT[energy] : 'Tap a number, 1 wiped to 5 great. Tap again to clear.'}</Hint>
        </Stack>
      </Stack>
    </Card>
  );
}
