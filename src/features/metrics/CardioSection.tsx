/**
 * Cardio sessions for one day.
 *
 * The type list is jog / treadmill / other only. Volleyball and Pilates are
 * NOT here: they are already logged as ActivityEntry rows in gymlog:entries
 * from the Train and Calendar screens, which is what the calendar dots and the
 * activity achievements read. A second place to log them would double-count
 * every session.
 *
 * Distance is stored in miles, matching the app's rule that storage is
 * imperial and metric is display-only.
 */
import { useState } from 'react';
import { Card, ConfirmDeleteAction, EmptyState, NumberInput, Button, toast } from '@/components';
import { Timer } from 'lucide-react';
import type { CardioType, Unit } from '@/lib/types';
import { cardioForDate, useMetricsStore } from '@/stores';
import {
  ChoiceButton,
  ChoiceRow,
  FieldGrid,
  Hint,
  SectionTitle,
  SessionLoad,
  SessionMain,
  SessionRow,
  Stack,
} from './ui';

const TYPES: { value: CardioType; label: string }[] = [
  { value: 'jog', label: 'Jog' },
  { value: 'treadmill', label: 'Treadmill' },
  { value: 'other', label: 'Other' },
];

const TYPE_LABEL: Record<CardioType, string> = { jog: 'Jog', treadmill: 'Treadmill', other: 'Other' };

const MILES_PER_KM = 0.621371;

/** Miles → shown distance. Metric users see km; storage stays miles. */
function displayDistance(miles: number, unit: Unit): string {
  return unit === 'kg' ? `${Math.round((miles / MILES_PER_KM) * 10) / 10}km` : `${miles}mi`;
}
function storedDistance(value: number, unit: Unit): number {
  return unit === 'kg' ? Math.round(value * MILES_PER_KM * 10) / 10 : value;
}

export interface CardioSectionProps {
  date: string;
  unit: Unit;
}

export function CardioSection({ date, unit }: CardioSectionProps) {
  const cardio = useMetricsStore((s) => s.cardio);
  const addCardio = useMetricsStore((s) => s.addCardio);
  const deleteCardio = useMetricsStore((s) => s.deleteCardio);
  const restoreCardio = useMetricsStore((s) => s.restoreCardio);

  const [type, setType] = useState<CardioType>('jog');
  const [minutes, setMinutes] = useState<number | ''>('');
  const [distance, setDistance] = useState<number | ''>('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sessions = cardioForDate(cardio, date);
  const totalMinutes = sessions.reduce((sum, s) => sum + s.minutes, 0);
  const distanceLabel = unit === 'kg' ? 'Distance (km, optional)' : 'Distance (mi, optional)';

  const log = () => {
    if (minutes === '' || minutes <= 0) return;
    addCardio({
      date,
      type,
      minutes,
      ...(distance === '' || distance <= 0 ? {} : { miles: storedDistance(distance, unit) }),
    });
    setMinutes('');
    setDistance('');
  };

  const remove = (id: string) => {
    setPendingDeleteId(null);
    const removed = deleteCardio(id);
    if (!removed) return;
    toast('Cardio session deleted', { undo: () => restoreCardio(removed) });
  };

  return (
    <Card as="section">
      <Stack gap={3}>
        <SectionTitle>Cardio</SectionTitle>

        <Stack gap={1}>
          <SectionTitle as="h3" id={`cardio-type-${date}`}>
            Type
          </SectionTitle>
          <ChoiceRow role="group" aria-labelledby={`cardio-type-${date}`}>
            {TYPES.map(({ value, label }) => (
              <ChoiceButton
                key={value}
                type="button"
                active={type === value}
                aria-pressed={type === value}
                onClick={() => setType(value)}
              >
                {label}
              </ChoiceButton>
            ))}
          </ChoiceRow>
          <Hint>Volleyball and Pilates are logged on the Train and Calendar screens.</Hint>
        </Stack>

        <FieldGrid>
          <NumberInput
            label="Duration (min)"
            value={minutes}
            min={0}
            inputMode="numeric"
            onChange={(e) => setMinutes(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <NumberInput
            label={distanceLabel}
            value={distance}
            min={0}
            step="any"
            inputMode="decimal"
            onChange={(e) => setDistance(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </FieldGrid>

        <Button fullWidth onClick={log} disabled={minutes === '' || minutes <= 0}>
          Log cardio
        </Button>

        {sessions.length === 0 ? (
          <EmptyState icon={Timer} title="No cardio logged" description="Add a session above." />
        ) : (
          <div>
            {sessions.map((s) => (
              <SessionRow key={s.id}>
                <SessionMain>
                  <span>{TYPE_LABEL[s.type]}</span>
                  {s.miles ? <Hint as="span">{displayDistance(s.miles, unit)}</Hint> : null}
                </SessionMain>
                <SessionLoad>{s.minutes} min</SessionLoad>
                <ConfirmDeleteAction
                  target={`${TYPE_LABEL[s.type]} session (${s.minutes} min)`}
                  armed={pendingDeleteId === s.id}
                  onArm={() => setPendingDeleteId(s.id)}
                  onCancel={() => setPendingDeleteId(null)}
                  onConfirm={() => remove(s.id)}
                />
              </SessionRow>
            ))}
            <Hint>
              {totalMinutes} min total {sessions.length === 1 ? '(1 session)' : `(${sessions.length} sessions)`}
            </Hint>
          </div>
        )}
      </Stack>
    </Card>
  );
}
