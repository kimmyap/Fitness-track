/**
 * Settings — workout days: add, rename, remove, reorder-free list.
 *
 * Logged sets are keyed by exercise NAME and date, never by day, so none of
 * these actions can affect logged history — only which tab an exercise appears
 * under. Renaming carries the day's built-in exercises across as custom
 * entries, so the visible list is unchanged.
 */
import { useState } from 'react';
import styled from '@emotion/styled';
import { Check, Pencil, Trash2, X } from 'lucide-react';
import { Button, ConfirmTap, IconButton, TextInput, toast } from '@/components';
import { useCustomExercisesStore, useProgramStore } from '@/stores';
import { DAYS } from '@/lib/program';
import { exercisesForDay } from '@/lib/domain';

const Note = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

const DayRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  padding: ${({ theme }) => `${theme.space[2]} 0`};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const DayName = styled.span`
  font-weight: 600;
  flex: 1;
  min-width: 0;
`;

const Count = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-variant-numeric: tabular-nums;
`;

const AddRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.space[2]};
  margin-top: ${({ theme }) => theme.space[2]};

  > *:first-of-type {
    flex: 1;
  }
`;

export function WorkoutDaysSection() {
  const days = useProgramStore((s) => s.days);
  const order = useProgramStore((s) => s.order);
  const customExercises = useCustomExercisesStore((s) => s.customExercises);
  const excludedBuiltIns = useCustomExercisesStore((s) => s.excludedBuiltIns);

  const [newDay, setNewDay] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const exerciseCount = (day: string) =>
    exercisesForDay(day, DAYS, customExercises, excludedBuiltIns, order[day]).length;

  const add = () => {
    const name = newDay.trim();
    if (!name) return;
    if (useProgramStore.getState().addDay(name)) {
      setNewDay('');
      toast(`${name} added`);
    } else {
      toast('That day already exists');
    }
  };

  const commitRename = (oldName: string) => {
    const next = draft.trim();
    if (!next || next === oldName) {
      setEditing(null);
      return;
    }
    if (useProgramStore.getState().renameDay(oldName, next)) {
      toast(`${oldName} renamed to ${next}`);
      setEditing(null);
    } else {
      toast('That name is already in use');
    }
  };

  return (
    <>
      <Note>
        Rename, remove, or add training days. Your logged sets are stored per exercise and date, so changing days never
        affects your history.
      </Note>

      {days.map((day) => (
        <DayRow key={day}>
          {editing === day ? (
            <>
              <TextInput
                label={`New name for ${day}`}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(day);
                  if (e.key === 'Escape') setEditing(null);
                }}
              />
              <IconButton aria-label={`Save new name for ${day}`} onClick={() => commitRename(day)}>
                <Check size={16} aria-hidden="true" />
              </IconButton>
              <IconButton aria-label="Cancel rename" onClick={() => setEditing(null)}>
                <X size={16} aria-hidden="true" />
              </IconButton>
            </>
          ) : (
            <>
              <DayName>{day}</DayName>
              <Count>
                {exerciseCount(day)} exercise{exerciseCount(day) === 1 ? '' : 's'}
              </Count>
              <IconButton
                aria-label={`Rename ${day}`}
                onClick={() => {
                  setEditing(day);
                  setDraft(day);
                }}
              >
                <Pencil size={16} aria-hidden="true" />
              </IconButton>
              {days.length > 1 ? (
                <ConfirmTap
                  variant="secondary"
                  confirmLabel="Tap again to remove"
                  onConfirm={() => {
                    useProgramStore.getState().removeDay(day);
                    toast(`${day} removed — logged sets are untouched`);
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" /> Remove
                </ConfirmTap>
              ) : null}
            </>
          )}
        </DayRow>
      ))}

      <AddRow>
        <TextInput
          label="New day name"
          placeholder="e.g. Push"
          value={newDay}
          onChange={(e) => setNewDay(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
        />
        <Button type="button" onClick={add}>
          Add day
        </Button>
      </AddRow>
    </>
  );
}
