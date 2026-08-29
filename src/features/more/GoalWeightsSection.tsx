/**
 * Settings — Goal weights: editable goal per exercise (built-ins + customs,
 * archived customs included, matching legacy). Values display in the current
 * unit; storage is always lbs via the goals store.
 */
import { useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { Button, NumberInput, toast } from '@/components';
import { DAYS } from '@/lib/program';
import { fromDisplayWeight, goalFor, toDisplayWeight } from '@/lib/domain';
import { useCustomExercisesStore, useGoalsStore, useSettingsStore } from '@/stores';
import type { AnyExercise, GoalsMap, Unit } from '@/lib/types';

const Note = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.typography.fontSizes.xs};
  color: ${({ theme }) => theme.colors.mutedForeground};
`;

interface InnerProps {
  unit: Unit;
  exercises: AnyExercise[];
  goals: GoalsMap;
  onSave: (goals: GoalsMap) => void;
}

function GoalWeightsInner({ unit, exercises, goals, onSave }: InnerProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    exercises.forEach((ex) => {
      initial[ex.name] = String(toDisplayWeight(goalFor(ex, goals), unit));
    });
    return initial;
  });

  const save = () => {
    const updates: GoalsMap = { ...goals };
    exercises.forEach((ex) => {
      const val = parseFloat(values[ex.name] ?? '');
      if (val) updates[ex.name] = fromDisplayWeight(val, unit);
    });
    onSave(updates);
    toast('Goals updated');
  };

  return (
    <>
      <Note>Progress rings on exercise cards fill toward these goal weights ({unit}).</Note>
      {exercises.map((ex) => (
        <NumberInput
          key={ex.name}
          label={ex.name}
          step="0.5"
          min="0"
          value={values[ex.name] ?? ''}
          onChange={(e) => setValues((v) => ({ ...v, [ex.name]: e.target.value }))}
        />
      ))}
      <Button type="button" variant="primary" fullWidth onClick={save}>
        Save Goals
      </Button>
    </>
  );
}

export function GoalWeightsSection() {
  const unit = useSettingsStore((s) => s.unit);
  const goals = useGoalsStore((s) => s.goals);
  const setGoals = useGoalsStore((s) => s.setGoals);
  const customExercises = useCustomExercisesStore((s) => s.customExercises);

  // Legacy allExercises: unique by name across the program + every custom
  // (archived included); a custom with a built-in's name wins.
  const exercises = useMemo(() => {
    const all = [...Object.values(DAYS).flat(), ...Object.values(customExercises).flat()];
    return [...new Map(all.map((ex) => [ex.name, ex])).values()] as AnyExercise[];
  }, [customExercises]);

  // Remount when unit flips so displayed values re-derive in the new unit.
  return <GoalWeightsInner key={unit} unit={unit} exercises={exercises} goals={goals} onSave={setGoals} />;
}
