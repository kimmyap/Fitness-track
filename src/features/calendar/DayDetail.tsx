/**
 * Day detail card (legacy renderCalendar detail): exercise count + day
 * volume, every entry that day (deletable with undo), Pilates/Volleyball/
 * Core backfill buttons, and the per-day note with debounced 600ms autosave.
 *
 * Deleting is gated by ConfirmDeleteAction, same as the Train page's history
 * list — one armed id for the whole day, so arming a row disarms any other.
 */
import { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { CalendarX } from 'lucide-react';
import { Badge, Button, Card, ConfirmDeleteAction, EmptyState, FieldLabel, toast } from '@/components';
import { displayDate, generateId, setNumberInDay, toDisplayWeight } from '@/lib/domain';
import { isLiftSet, type Entry, type LiftSetEntry } from '@/lib/types';
import { useEntriesStore, useNotesStore, useSettingsStore } from '@/stores';
import { daySummary } from './calendarMath';

/** Legacy note autosave debounce (ms). */
export const NOTE_AUTOSAVE_DEBOUNCE_MS = 600;

const DetailTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.space[1]};
  font-family: ${({ theme }) => theme.typography.display};
  font-size: ${({ theme }) => theme.typography.fontSizes.lg};
  font-weight: 600;
`;

const SummaryLine = styled.p`
  margin: 0 0 ${({ theme }) => theme.space[3]};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-variant-numeric: tabular-nums;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => `${theme.space[1]} 0`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};

  &:last-of-type {
    border-bottom: none;
  }
`;

const RowMain = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const RowName = styled.span`
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[1]};
  font-weight: 500;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
`;

const RowMeta = styled.span`
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[1]};
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const RowWeight = styled.span`
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  white-space: nowrap;
`;

const BackfillRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.space[2]};
  margin-top: ${({ theme }) => theme.space[3]};
`;

const NoteArea = styled.textarea`
  min-height: 88px;
  width: 100%;
  resize: vertical;
  padding: ${({ theme }) => `${theme.space[2]} ${theme.space[3]}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.md};
  background: ${({ theme }) => theme.colors.card};
  color: ${({ theme }) => theme.colors.cardForeground};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
  line-height: ${({ theme }) => theme.typography.lineHeight};

  &::placeholder {
    color: ${({ theme }) => theme.colors.mutedForeground};
  }
`;

const NoteBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
  margin-top: ${({ theme }) => theme.space[4]};
`;

function liftSetLabel(entries: Entry[], e: LiftSetEntry): string {
  if (e.warmupSet) return `Warm-up · ${e.reps} reps`;
  if (e.sets && e.sets > 1) return `${e.sets}x${e.reps}`;
  return `Set ${setNumberInDay(entries, e)} · ${e.reps} reps`;
}

export interface DayDetailProps {
  date: string;
  todayIso: string;
  /** Called after any entry mutation (achievement check + celebration). */
  onMutate: () => void;
}

export function DayDetail({ date, todayIso, onMutate }: DayDetailProps) {
  const entries = useEntriesStore((s) => s.entries);
  const deleteEntry = useEntriesStore((s) => s.deleteEntry);
  const restoreEntry = useEntriesStore((s) => s.restoreEntry);
  const logActivity = useEntriesStore((s) => s.logActivity);
  const addEntry = useEntriesStore((s) => s.addEntry);
  const unit = useSettingsStore((s) => s.unit);

  const dayEntries = entries.filter((e) => e.date === date);
  const { exerciseCount, volumeLbs } = daySummary(dayEntries);

  /** Row armed for deletion. Session-only — a pending delete must not outlive the view. */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setPendingDeleteId(null);
    const removed = deleteEntry(id);
    if (!removed) return;
    toast('Set deleted', { undo: () => restoreEntry(removed) });
  };

  const weightDisplay = (e: LiftSetEntry): string => {
    if (e.assistedPullup) return `${toDisplayWeight(e.weight, unit)}${unit} assist`;
    if (!e.weight && (e.variation === 'Bodyweight' || e.variation === 'Bodyweight Lunges')) return 'Bodyweight';
    return `${toDisplayWeight(e.weight, unit)}${unit}`;
  };

  const completionLabel = (e: Entry): string => {
    if ('type' in e && e.type === 'activity') return e.activity;
    if ('type' in e && e.type === 'warmup') return 'Warm-up';
    return 'Core Finisher';
  };

  return (
    <Card as="section" aria-label={`Details for ${displayDate(date)}`}>
      <DetailTitle>
        {displayDate(date)}
        {date === todayIso ? ' (today)' : ''}
      </DetailTitle>
      {exerciseCount > 0 ? (
        <SummaryLine>
          {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''} ·{' '}
          {Math.round(toDisplayWeight(volumeLbs, unit)).toLocaleString()}
          {unit} lifted
        </SummaryLine>
      ) : null}

      {dayEntries.length === 0 ? (
        <EmptyState icon={CalendarX} title="Nothing logged this day." />
      ) : (
        <div>
          {dayEntries.map((e) =>
            isLiftSet(e) ? (
              <Row key={e.id}>
                <RowMain>
                  <RowName>
                    {e.exercise}
                    {e.variation ? <Badge>{e.variation}</Badge> : null}
                  </RowName>
                  <RowMeta>
                    {liftSetLabel(entries, e)}
                    {e.rpe ? <Badge>RPE {e.rpe}</Badge> : null}
                  </RowMeta>
                </RowMain>
                <RowWeight>{weightDisplay(e)}</RowWeight>
                <ConfirmDeleteAction
                  target={`${e.exercise} set`}
                  iconSize={18}
                  armed={pendingDeleteId === e.id}
                  onArm={() => setPendingDeleteId(e.id)}
                  onCancel={() => setPendingDeleteId(null)}
                  onConfirm={() => handleDelete(e.id)}
                />
              </Row>
            ) : (
              <Row key={e.id}>
                <RowMain>
                  <RowName>{completionLabel(e)}</RowName>
                  <RowMeta>✓ done</RowMeta>
                </RowMain>
                <ConfirmDeleteAction
                  target={`${completionLabel(e)} entry`}
                  iconSize={18}
                  armed={pendingDeleteId === e.id}
                  onArm={() => setPendingDeleteId(e.id)}
                  onCancel={() => setPendingDeleteId(null)}
                  onConfirm={() => handleDelete(e.id)}
                />
              </Row>
            ),
          )}
        </div>
      )}

      <BackfillRow>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            logActivity('Pilates', date);
            onMutate();
          }}
        >
          + Pilates
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            logActivity('Volleyball', date);
            onMutate();
          }}
        >
          + Volleyball
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            addEntry({ id: generateId(), type: 'core', date });
            onMutate();
          }}
        >
          + Core Finisher
        </Button>
      </BackfillRow>

      <DayNote date={date} />
    </Card>
  );
}

/** Per-day free-text note with debounced (600ms) autosave, flushed on blur/unmount. */
function DayNote({ date }: { date: string }) {
  const setNoteForDate = useNotesStore((s) => s.setNoteForDate);
  const [draft, setDraft] = useState(() => useNotesStore.getState().notes[date] ?? '');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ date: string; text: string } | null>(null);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (pending.current) {
      useNotesStore.getState().setNoteForDate(pending.current.date, pending.current.text);
      pending.current = null;
    }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // Switch days: save anything pending, then load that day's note.
  useEffect(() => {
    flushRef.current();
    setDraft(useNotesStore.getState().notes[date] ?? '');
    return () => flushRef.current();
  }, [date]);

  const onChange = (text: string) => {
    setDraft(text);
    pending.current = { date, text };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = null;
      timer.current = null;
      setNoteForDate(date, text);
    }, NOTE_AUTOSAVE_DEBOUNCE_MS);
  };

  const noteId = `day-note-${date}`;
  return (
    <NoteBlock>
      <FieldLabel htmlFor={noteId}>Notes for this day</FieldLabel>
      <NoteArea
        id={noteId}
        value={draft}
        placeholder="How'd it feel? Sleep, energy, anything worth remembering..."
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
      />
    </NoteBlock>
  );
}
