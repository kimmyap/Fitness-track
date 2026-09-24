/**
 * Assign a muscle group to an exercise the library cannot resolve.
 *
 * One select per unmatched exercise, saved on change. Deliberately NOT a modal:
 * the list is already the explanation, and making someone open a dialog to fix
 * a two-word problem is how a correction stays unmade.
 *
 * It asks for the PRIMARY muscle only. Enumerating secondary movers is anatomy
 * homework, and the balance view counts primary sets against the benchmark
 * anyway — a mapped exercise contributing no secondary credit is a rounding
 * error next to it contributing nothing at all.
 */
import styled from '@emotion/styled';
import { useMuscleMapStore } from '@/stores';
import { MUSCLE_GROUPS } from '@/lib/types';
import type { MuscleGroup } from '@/lib/types';
import { SelectBase } from '@/features/train/ui';
import type { AutoMatchedExercise, UnmatchedExercise } from './muscleBalance';

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[3]};
`;

const Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.space[1]};
`;

const Label = styled.label`
  font-weight: 600;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
`;

const Count = styled.span`
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-weight: 400;
  font-variant-numeric: tabular-nums;
`;

/** Why the app thinks it knows. Shown so the guess can be judged, not just taken. */
const Evidence = styled.span`
  color: ${({ theme }) => theme.colors.mutedForeground};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
`;

/** DOM ids must be stable and valid; exercise names contain spaces and slashes. */
function fieldId(exercise: string): string {
  return `muscle-map-${exercise.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`;
}

type Row = UnmatchedExercise | AutoMatchedExercise;

function isAuto(row: Row): row is AutoMatchedExercise {
  return 'muscle' in row;
}

export function UnmatchedMapper({ unmatched }: { unmatched: Row[] }) {
  const muscleMap = useMuscleMapStore((s) => s.muscleMap);
  const setMuscle = useMuscleMapStore((s) => s.setMuscle);
  const clearMuscle = useMuscleMapStore((s) => s.clearMuscle);

  return (
    <List>
      {unmatched.map((row) => {
        const { exercise, sets } = row;
        const id = fieldId(exercise);
        /*
         * An auto-matched row shows the inference as the SELECTED value even
         * though nothing is stored yet, so the select states what is currently
         * being counted. Choosing anything writes the override; choosing the
         * blank clears it back to the inference.
         */
        const guess = isAuto(row) ? row.muscle : undefined;
        return (
          <Item key={exercise}>
            <Label htmlFor={id}>
              {exercise} <Count>· {sets} {sets === 1 ? 'set' : 'sets'}</Count>
            </Label>
            {isAuto(row) ? <Evidence>Counted as {row.muscle} — {row.evidence}</Evidence> : null}
            <SelectBase
              id={id}
              value={muscleMap[exercise] ?? guess ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) clearMuscle(exercise);
                else setMuscle(exercise, value as MuscleGroup);
              }}
            >
              <option value="">
                {guess ? `Keep ${guess} (auto)` : 'Choose the muscle it works…'}
              </option>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </SelectBase>
          </Item>
        );
      })}
    </List>
  );
}
