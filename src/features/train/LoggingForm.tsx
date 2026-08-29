/**
 * Set-logging form (legacy per-exercise form):
 * - variation select (defaults to last-used variation)
 * - warm-up checkbox (remembered per exercise for the session)
 * - weight/reps/RPE prefilled from the last working set
 * - ±5lb / ±2.5kg weight stepper
 * - RPE pills 6–10 with tap-for-description
 * - live weight helper text per variation math (per-side / per-dumbbell / sled…)
 * - >40% typo guard requiring a second tap (4s window)
 * - 800ms log lock + "Saving..." state
 * - PR detection → confetti + hype toast; rest-timer auto-start (today only)
 *
 * NOTE: mount with a key of `${logDate}|${editingEntry?.id ?? 'new'}` so the
 * form re-prefills when the edit target or logging date changes.
 */
import { useId, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import styled from '@emotion/styled';
import { Badge, Button, Field, FieldLabel, NumberInput, toast } from '@/components';
import { useAchievementsStore, useEntriesStore, useSettingsStore } from '@/stores';
import {
  LOG_LOCK_MS,
  TYPO_GUARD_CONFIRM_MS,
  barWeight,
  bestFor,
  computeTotalDisplayWeight,
  inputWeightFromStored,
  isBigJump,
  lastLoggedWorkingSet,
  legPressSledWeight,
  storedWeightFromInput,
  trapBarWeight,
} from '@/lib/domain';
import type { WeightEntryContext } from '@/lib/domain';
import { EXERCISE_VARIATIONS, RPE_SCALE, randomHype } from '@/lib/program';
import type { AnyExercise, Entry, EquipmentWeights, LiftSetEntry, Unit } from '@/lib/types';
import { isLiftSet } from '@/lib/types';
import { celebrateAchievements } from '@/features/today/celebrate';
import { autoStartRestTimer } from './restTimer';
import { Muted, Row, SelectBase, Stack, TextButton, unitLabel } from './ui';

/** Warm-up checkbox state remembered per exercise per app session (legacy lastWarmupChecked). */
const sessionWarmupChecked: Record<string, boolean> = {};

const InputRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: flex-start;

  > :nth-of-type(1) {
    flex: 1.4;
    min-width: 0;
  }
  > :nth-of-type(2) {
    flex: 1;
    min-width: 0;
  }
  > :nth-of-type(3) {
    flex: 0.9;
    min-width: 0;
  }
`;

const CheckboxRow = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
  min-height: ${({ theme }) => theme.touchTarget};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  cursor: pointer;

  input {
    width: 20px;
    height: 20px;
    accent-color: ${({ theme }) => theme.colors.primary};
  }
`;

const RpePill = styled.button<{ active: boolean }>`
  min-height: ${({ theme }) => theme.touchTarget};
  min-width: ${({ theme }) => theme.touchTarget};
  border-radius: ${({ theme }) => theme.radii.full};
  border: 1px solid ${({ theme, active }) => (active ? 'transparent' : theme.colors.border)};
  background: ${({ theme, active }) => (active ? theme.colors.primary : theme.colors.muted)};
  color: ${({ theme, active }) => (active ? theme.colors.onPrimary : theme.colors.foreground)};
  font-family: ${({ theme }) => theme.typography.body};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
`;

const DEFAULT_RPE_HINT = 'Tap a number for what it means, or just type it in above';

interface FormValues {
  weight: number | '';
  reps: number | '';
  rpe: number | '';
}

function lastUsedVariation(entries: Entry[], exerciseName: string): string | undefined {
  return entries
    .filter((e): e is LiftSetEntry => isLiftSet(e) && e.exercise === exerciseName && Boolean(e.variation))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.variation;
}

function computePrefill(
  exercise: AnyExercise,
  editingEntry: LiftSetEntry | null,
  entries: Entry[],
  unit: Unit,
): { variation: string | null; values: FormValues } {
  const variations = EXERCISE_VARIATIONS[exercise.name];
  let variation: string | null = null;
  if (editingEntry?.variation) {
    variation = editingEntry.variation;
  } else if (variations) {
    variation = lastUsedVariation(entries, exercise.name) ?? variations[0] ?? null;
  }
  if (editingEntry) {
    return {
      variation,
      values: {
        weight: inputWeightFromStored(variation, editingEntry.weight, unit),
        reps: editingEntry.reps,
        rpe: editingEntry.rpe ?? '',
      },
    };
  }
  const last = lastLoggedWorkingSet(entries, exercise.name);
  if (last) {
    return {
      variation,
      values: {
        weight: inputWeightFromStored(variation, last.weight, unit),
        reps: last.reps,
        rpe: last.rpe ?? '',
      },
    };
  }
  return { variation, values: { weight: '', reps: exercise.prefillReps, rpe: '' } };
}

/** Legacy updateWeightHelper copy, verbatim per variation. */
export function weightHelperText(
  variation: string | null,
  rawInput: number | '',
  unit: Unit,
  equipment: EquipmentWeights,
): string {
  const u = unitLabel(unit);
  const w = rawInput === '' ? 0 : rawInput;
  if (variation === 'Barbell') {
    const bar = barWeight(unit);
    if (w) return `= ${w * 2 + bar}${u} total (${w} per side x2 + ${bar}${u} bar)`;
    return `Enter weight per side, bar (${bar}${u}) added automatically`;
  }
  if (variation === 'Trap Bar') {
    const trap = trapBarWeight(equipment, unit);
    if (w) return `= ${w * 2 + trap}${u} total (${w} per side x2 + ${trap}${u} trap bar)`;
    return `Enter weight per side, trap bar (${trap}${u}) added automatically. Adjust its weight in Settings if needed.`;
  }
  if (variation === 'Dumbbell') {
    if (w) return `= ${w * 2}${u} total (${w}${u} x2 dumbbells)`;
    return 'Enter the weight of ONE dumbbell, doubled automatically';
  }
  if (variation === 'Leg Press') {
    const sled = legPressSledWeight(equipment);
    if (w) {
      return sled
        ? `= ${w + sled}${u} total (${w}${u} plates + ${sled}${u} sled)`
        : `Sled weight not set, logging ${w}${u} as-is. Add your machine's sled weight in Settings for accuracy.`;
    }
    return sled
      ? `Enter plates loaded, sled (${sled}${u}) added automatically`
      : `Enter total weight, or set your leg press's sled weight in Settings first`;
  }
  if (variation === 'Bodyweight' || variation === 'Bodyweight Lunges') {
    return "Bodyweight move, leave weight blank if you're not adding load";
  }
  if (variation === 'Assisted Pull-up') {
    return "More assistance = easier. This is tracked separately and won't affect your Lat Pulldown PB or 1RM.";
  }
  return '';
}

function weightLabel(variation: string | null, unit: Unit): string {
  const u = unitLabel(unit);
  if (variation === 'Barbell' || variation === 'Trap Bar') return `Weight per side (${u})`;
  if (variation === 'Dumbbell') return `Weight per dumbbell (${u})`;
  if (variation === 'Leg Press') return `Plates loaded (${u})`;
  if (variation === 'Assisted Pull-up') return `Assistance amount (${u})`;
  if (variation === 'Bodyweight' || variation === 'Bodyweight Lunges') return `Weight, optional (${u})`;
  return `Weight (${u})`;
}

export interface LoggingFormProps {
  exercise: AnyExercise;
  /** "YYYY-MM-DD" the set will be logged for. */
  logDate: string;
  todayIso: string;
  editingEntry: LiftSetEntry | null;
  onFinishEdit: () => void;
  /** Fire the page-level confetti burst (PRs + achievement unlocks). */
  onConfetti?: () => void;
}

export function LoggingForm({ exercise, logDate, todayIso, editingEntry, onFinishEdit, onConfetti }: LoggingFormProps) {
  const unit = useSettingsStore((s) => s.unit);
  const equipment = useSettingsStore((s) => s.equipmentWeights);
  const setsToday = useEntriesStore(
    (s) =>
      s.entries.filter((e) => isLiftSet(e) && e.exercise === exercise.name && e.date === logDate && !e.warmupSet)
        .length,
  );

  const isEditing = Boolean(editingEntry);
  const variations = EXERCISE_VARIATIONS[exercise.name];

  const [variation, setVariation] = useState<string | null>(
    () => computePrefill(exercise, editingEntry, useEntriesStore.getState().entries, unit).variation,
  );
  const [values, setValues] = useState<FormValues>(
    () => computePrefill(exercise, editingEntry, useEntriesStore.getState().entries, unit).values,
  );
  const [warmup, setWarmupState] = useState<boolean>(() =>
    editingEntry ? Boolean(editingEntry.warmupSet) : Boolean(sessionWarmupChecked[exercise.name]),
  );
  const [rpeHint, setRpeHint] = useState(DEFAULT_RPE_HINT);
  const [typoArmed, setTypoArmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const lockRef = useRef(false);
  const typoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const varSelectId = useId();

  const setWarmup = (checked: boolean) => {
    setWarmupState(checked);
    sessionWarmupChecked[exercise.name] = checked;
  };

  const stepAmount = unit === 'kg' ? 2.5 : 5;
  const nudgeWeight = (delta: number) => {
    setValues((v) => {
      const cur = v.weight === '' ? 0 : v.weight;
      return { ...v, weight: Math.max(0, Math.round((cur + delta) * 10) / 10) };
    });
  };

  const handleLog = () => {
    if (lockRef.current || saving) return;
    lockRef.current = true;

    const wRaw = values.weight === '' ? 0 : values.weight;
    const r = values.reps === '' ? 0 : Math.trunc(values.reps);
    const rpeVal = values.rpe === '' ? 0 : Math.trunc(values.rpe);
    const varVal = variation;
    const isWarmup = warmup;
    const isBodyweightVar = varVal === 'Bodyweight' || varVal === 'Bodyweight Lunges';
    const isAssisted = varVal === 'Assisted Pull-up';

    if ((!wRaw && !isBodyweightVar && !isWarmup) || !r) {
      lockRef.current = false;
      return;
    }

    const ctx: WeightEntryContext = { unit, equipment };
    const stored = storedWeightFromInput(varVal, wRaw, ctx);
    const allEntries = useEntriesStore.getState().entries;

    // Typo guard (legacy: skipped for warm-ups, edits, bodyweight, assisted)
    if (!isWarmup && !isEditing && !typoArmed && !isBodyweightVar && !isAssisted) {
      const last = lastLoggedWorkingSet(allEntries, exercise.name);
      if (last && isBigJump(stored, last.weight)) {
        lockRef.current = false;
        setTypoArmed(true);
        if (typoTimer.current) clearTimeout(typoTimer.current);
        typoTimer.current = setTimeout(() => setTypoArmed(false), TYPO_GUARD_CONFIRM_MS);
        return;
      }
    }
    if (typoTimer.current) clearTimeout(typoTimer.current);
    setTypoArmed(false);
    setSaving(true);
    setTimeout(() => {
      lockRef.current = false;
      setSaving(false);
    }, LOG_LOCK_MS);

    if (isEditing && editingEntry) {
      useEntriesStore.getState().updateSet(editingEntry.id, {
        weight: stored,
        reps: r,
        ...(rpeVal ? { rpe: rpeVal } : {}),
        ...(varVal ? { variation: varVal } : {}),
        warmupSet: isWarmup,
        assistedPullup: isAssisted,
      });
      onFinishEdit();
      return;
    }

    const prevBest = bestFor(allEntries, exercise.name)?.weight ?? 0;
    useEntriesStore.getState().logSet({
      exercise: exercise.name,
      weight: stored,
      reps: r,
      date: logDate,
      ...(rpeVal ? { rpe: rpeVal } : {}),
      ...(varVal ? { variation: varVal } : {}),
      warmupSet: isWarmup,
      assistedPullup: isAssisted,
    });

    if (logDate === todayIso) autoStartRestTimer();

    if (!isWarmup && !isAssisted && !isBodyweightVar && stored > prevBest) {
      onConfetti?.();
      const totalDisplay = computeTotalDisplayWeight(varVal, wRaw, ctx);
      const perNote =
        varVal === 'Barbell' || varVal === 'Trap Bar'
          ? ` (${wRaw} per side)`
          : varVal === 'Dumbbell'
            ? ` (${wRaw} per dumbbell)`
            : '';
      toast(`New PR on ${exercise.name}! ${totalDisplay}${unitLabel(unit)}${perNote} — ${randomHype()}`);
    }

    celebrateAchievements(useAchievementsStore.getState().checkAchievements(), onConfetti);

    // Legacy re-render behavior: re-prefill from the (now updated) log
    const p = computePrefill(exercise, null, useEntriesStore.getState().entries, unit);
    setVariation(p.variation ?? varVal);
    setValues(p.values);
  };

  const buttonText = typoArmed
    ? "That's a big jump, tap again to confirm"
    : saving
      ? 'Saving...'
      : isEditing
        ? 'Save'
        : 'Log Set';

  const helper = weightHelperText(variation, values.weight, unit, equipment);
  const numChange =
    (key: keyof FormValues) => (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setValues((v) => ({ ...v, [key]: raw === '' ? '' : Number(raw) }));
    };

  return (
    <Stack gap={2}>
      {variations ? (
        <Field>
          <FieldLabel htmlFor={varSelectId}>Variation</FieldLabel>
          <SelectBase id={varSelectId} value={variation ?? ''} onChange={(e) => setVariation(e.target.value)}>
            {variations.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </SelectBase>
        </Field>
      ) : null}

      <CheckboxRow>
        <input type="checkbox" checked={warmup} onChange={(e) => setWarmup(e.target.checked)} />
        <span>
          Warm-up set <Muted as="span">(won&apos;t count toward PB or 1RM)</Muted>
        </span>
      </CheckboxRow>

      <InputRow>
        <NumberInput
          label={weightLabel(variation, unit)}
          value={values.weight}
          min={0}
          step="any"
          onChange={numChange('weight')}
          helper={helper || undefined}
        />
        <NumberInput label="Reps" value={values.reps} min={0} onChange={numChange('reps')} />
        <NumberInput label="RPE (optional)" value={values.rpe} min={1} max={10} onChange={numChange('rpe')} />
      </InputRow>

      <Row>
        <Button variant="secondary" aria-label={`Decrease weight by ${stepAmount}`} onClick={() => nudgeWeight(-stepAmount)}>
          -{stepAmount}
        </Button>
        <Muted as="span">adjust weight</Muted>
        <Button variant="secondary" aria-label={`Increase weight by ${stepAmount}`} onClick={() => nudgeWeight(stepAmount)}>
          +{stepAmount}
        </Button>
      </Row>

      <Row wrap role="group" aria-label="RPE scale">
        {RPE_SCALE.map((r) => {
          const active = String(values.rpe) === r.val;
          return (
            <RpePill
              key={r.val}
              type="button"
              active={active}
              aria-pressed={active}
              onClick={() => {
                setValues((v) => ({ ...v, rpe: Number(r.val) }));
                setRpeHint(`RPE ${r.val}: ${r.desc}`);
              }}
            >
              {r.val}
            </RpePill>
          );
        })}
      </Row>
      <Muted>{rpeHint}</Muted>

      <Button fullWidth disabled={saving} onClick={handleLog} aria-live="polite">
        {buttonText}
      </Button>

      {!isEditing ? (
        <Muted>
          {setsToday} of {exercise.targetSets} sets logged for this session{' '}
          <Badge>target {exercise.targetSets} x {exercise.targetReps}</Badge>
        </Muted>
      ) : (
        <TextButton onClick={onFinishEdit}>Cancel edit</TextButton>
      )}
    </Stack>
  );
}
