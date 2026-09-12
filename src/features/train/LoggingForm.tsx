/**
 * Set-logging form (legacy per-exercise form). Field order runs variation →
 * plate controls → set type → weight/reps/RPE, so the set-type picker sits in
 * the same glance as the numbers whose meaning it decides.
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
import {
  modeForExercise,
  useAchievementsStore,
  useEntriesStore,
  useSettingsStore,
  useWeightModesStore,
} from '@/stores';
import {
  LOG_LOCK_MS,
  TYPO_GUARD_CONFIRM_MS,
  barWeight,
  bestFor,
  barForVariation,
  computeTotalDisplayWeightWithMode,
  effectiveMode,
  inputWeightFromStoredWithMode,
  isBigJump,
  isPlateLoaded,
  lastLoggedWorkingSet,
  legPressSledWeight,
  plateQuickPicks,
  storedWeightFromModeInput,
  trapBarWeight,
} from '@/lib/domain';
import type { WeightEntryContext, WeightEntryMode } from '@/lib/domain';
import { EXERCISE_VARIATIONS, RPE_SCALE, randomHype } from '@/lib/program';
import type { AnyExercise, Entry, EquipmentWeights, LiftSetEntry, Unit } from '@/lib/types';
import { isLiftSet } from '@/lib/types';
import { celebrateAchievements } from '@/features/today/celebrate';
import { autoStartRestTimer } from './restTimer';
import { Muted, Row, SelectBase, Stack, TextButton, unitLabel } from './ui';

/**
 * The four set types. Chosen explicitly rather than cycled on tap: a mis-tap
 * during data entry would otherwise silently relabel a set, and the label
 * decides whether that set can set a PB.
 */
type SetKind = 'normal' | 'warmup' | 'drop' | 'failure';

const SET_KINDS: { kind: SetKind; label: string }[] = [
  { kind: 'normal', label: 'Working' },
  { kind: 'warmup', label: 'Warm-up' },
  { kind: 'drop', label: 'Drop' },
  { kind: 'failure', label: 'Failure' },
];

/** Spelled out, because which stats a type affects is not guessable. */
const SET_KIND_HINTS: Record<SetKind, string> = {
  normal: 'Counts toward everything.',
  warmup: "Won't count toward PB, 1RM or volume.",
  drop: "Counts toward volume and today's set count, but never PB or 1RM.",
  failure: 'Counts toward everything, PBs included.',
};

/**
 * Set type remembered per exercise per app session (generalises the legacy
 * lastWarmupChecked). Not persisted — legacy kept this in memory only.
 */
const sessionSetType: Record<string, SetKind> = {};

const ModeToggle = styled.div`
  display: inline-flex;
  gap: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  overflow: hidden;
`;

const ModeButton = styled.button<{ active: boolean }>`
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  border: none;
  background: ${({ theme, active }) => (active ? theme.colors.primary : 'transparent')};
  color: ${({ theme, active }) => (active ? theme.colors.onPrimary : theme.colors.mutedForeground)};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: ${({ active }) => (active ? 700 : 500)};
  cursor: pointer;
`;

const SetTypeRow = styled.div`
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  overflow: hidden;
`;

const SetTypeButton = styled.button<{ active: boolean }>`
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  border: none;
  background: ${({ theme, active }) => (active ? theme.colors.primary : 'transparent')};
  color: ${({ theme, active }) => (active ? theme.colors.onPrimary : theme.colors.mutedForeground)};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-weight: ${({ active }) => (active ? 700 : 500)};
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: -2px;
  }
`;

const PlateChip = styled.button`
  min-height: ${({ theme }) => theme.touchTarget};
  padding: ${({ theme }) => `${theme.space[1]} ${theme.space[3]}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.full};
  background: ${({ theme }) => theme.colors.muted};
  color: ${({ theme }) => theme.colors.cardForeground};
  font-family: ${({ theme }) => theme.typography.body};
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
  font-variant-numeric: tabular-nums;
  cursor: pointer;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

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
  mode: WeightEntryMode = 'auto',
  equipment: EquipmentWeights = { trapBar: null, legPressSled: null },
  barWeightLbs: number | null = null,
): { variation: string | null; values: FormValues } {
  const ctx: WeightEntryContext = { unit, equipment, barWeightLbs };
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
        weight: inputWeightFromStoredWithMode(mode, variation, editingEntry.weight, ctx),
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
        weight: inputWeightFromStoredWithMode(mode, variation, last.weight, ctx),
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

/** Helper text for an explicitly-chosen mode; 'auto' defers to the legacy copy. */
export function weightHelperTextForMode(
  mode: WeightEntryMode,
  variation: string | null,
  rawInput: number | '',
  unit: Unit,
  equipment: EquipmentWeights,
  barWeightLbs: number | null = null,
): string {
  const barOnly = barForVariation(variation, { unit, equipment, barWeightLbs });
  const isBarLift = variation === 'Barbell' || variation === 'Trap Bar' || mode === 'perSide';
  // 0 on a bar lift logs the bar itself — say so before anything else.
  if (rawInput === 0 && isBarLift) {
    return `= ${barOnly}${unitLabel(unit)} — just the bar, logged as a bar-only set`;
  }
  if (mode === 'auto') return weightHelperText(variation, rawInput, unit, equipment);
  const u = unitLabel(unit);
  const w = rawInput === '' ? 0 : rawInput;
  if (mode === 'perSide') {
    const bar = barForVariation(variation, { unit, equipment, barWeightLbs });
    const barName = variation === 'Trap Bar' ? 'trap bar' : 'bar';
    if (w) return `= ${w * 2 + bar}${u} total (${w} per side x2 + ${bar}${u} ${barName})`;
    return `Enter weight per side, ${barName} (${bar}${u}) added automatically`;
  }
  if (w) return `Logging ${w}${u} total, bar included`;
  return 'Enter the full weight including the bar';
}

function weightLabelForMode(mode: WeightEntryMode, variation: string | null, unit: Unit): string {
  if (mode === 'auto') return weightLabel(variation, unit);
  const u = unitLabel(unit);
  return mode === 'perSide' ? `Weight per side (${u})` : `Total weight (${u})`;
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
  const barWeightLbs = useSettingsStore((s) => s.barWeightLbs);
  const setsToday = useEntriesStore(
    (s) =>
      s.entries.filter((e) => isLiftSet(e) && e.exercise === exercise.name && e.date === logDate && !e.warmupSet)
        .length,
  );

  const isEditing = Boolean(editingEntry);
  const variations = EXERCISE_VARIATIONS[exercise.name];

  const initialMode = modeForExercise(useWeightModesStore.getState().modes, exercise.name);
  const [variation, setVariation] = useState<string | null>(
    () =>
      computePrefill(exercise, editingEntry, useEntriesStore.getState().entries, unit, initialMode, equipment, barWeightLbs)
        .variation,
  );
  const [values, setValues] = useState<FormValues>(
    () =>
      computePrefill(exercise, editingEntry, useEntriesStore.getState().entries, unit, initialMode, equipment, barWeightLbs)
        .values,
  );
  const [setKind, setSetKindState] = useState<SetKind>(() => {
    if (editingEntry) {
      if (editingEntry.warmupSet) return 'warmup';
      if (editingEntry.dropSet) return 'drop';
      if (editingEntry.toFailure) return 'failure';
      return 'normal';
    }
    return sessionSetType[exercise.name] ?? 'normal';
  });
  const setStoredMode = useWeightModesStore((s) => s.setMode);
  const [mode, setMode] = useState<WeightEntryMode>(() =>
    modeForExercise(useWeightModesStore.getState().modes, exercise.name),
  );
  const [rpeHint, setRpeHint] = useState(DEFAULT_RPE_HINT);
  const [typoArmed, setTypoArmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const lockRef = useRef(false);
  const typoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const varSelectId = useId();
  /*
   * Generated, not `set-type-${exercise.name}`. aria-labelledby is a
   * whitespace-separated ID LIST, so an exercise name with a space in it
   * ("Sumo Squats") parsed as two references, neither of which resolved — the
   * group had no accessible name at all for most of the program.
   */
  const setTypeLabelId = useId();

  const setSetKind = (kind: SetKind) => {
    setSetKindState(kind);
    sessionSetType[exercise.name] = kind;
  };

  // Switching modes converts the typed number so the resulting total is
  // unchanged — the toggle acts as a plate calculator, not a reset.
  const switchMode = (next: 'total' | 'perSide') => {
    const ctx: WeightEntryContext = { unit, equipment, barWeightLbs };
    const currentTotal = computeTotalDisplayWeightWithMode(mode, variation, values.weight === '' ? 0 : values.weight, ctx);
    const bar = barForVariation(variation, ctx);
    const converted =
      next === 'perSide'
        ? Math.max(0, Math.round(((currentTotal - bar) / 2) * 10) / 10)
        : Math.round(currentTotal * 10) / 10;
    setMode(next);
    setStoredMode(exercise.name, next);
    if (values.weight !== '') setValues((v) => ({ ...v, weight: converted }));
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
    const isWarmup = setKind === 'warmup';
    const isDrop = setKind === 'drop';
    const isFailure = setKind === 'failure';
    const isBodyweightVar = varVal === 'Bodyweight' || varVal === 'Bodyweight Lunges';
    const isAssisted = varVal === 'Assisted Pull-up';

    if ((!wRaw && !isBodyweightVar && !isWarmup) || !r) {
      lockRef.current = false;
      return;
    }

    const ctx: WeightEntryContext = { unit, equipment, barWeightLbs };
    const stored = storedWeightFromModeInput(mode, varVal, wRaw, ctx);
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
        dropSet: isDrop,
        toFailure: isFailure,
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
      dropSet: isDrop,
      toFailure: isFailure,
    });

    if (logDate === todayIso) autoStartRestTimer();

    if (!isWarmup && !isAssisted && !isDrop && !isBodyweightVar && stored > prevBest) {
      onConfetti?.();
      const totalDisplay = computeTotalDisplayWeightWithMode(mode, varVal, wRaw, ctx);
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

  const showPlateToggle = isPlateLoaded(variation);
  const visibleMode = effectiveMode(mode, variation);
  const helper = weightHelperTextForMode(mode, variation, values.weight, unit, equipment, barWeightLbs);
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

      {showPlateToggle ? (
        <Row wrap>
          <ModeToggle role="group" aria-label="Weight entry mode">
            <ModeButton
              type="button"
              active={visibleMode === 'total'}
              aria-pressed={visibleMode === 'total'}
              onClick={() => switchMode('total')}
            >
              Total weight
            </ModeButton>
            <ModeButton
              type="button"
              active={visibleMode === 'perSide'}
              aria-pressed={visibleMode === 'perSide'}
              onClick={() => switchMode('perSide')}
            >
              Plates per side
            </ModeButton>
          </ModeToggle>
        </Row>
      ) : null}

      {showPlateToggle && visibleMode === 'perSide' ? (
        <Row wrap role="group" aria-label="Quick plate loads per side">
          {plateQuickPicks(unit).map(({ plates, perSide }) => (
            <PlateChip
              key={plates}
              type="button"
              onClick={() => setValues((v) => ({ ...v, weight: perSide }))}
            >
              {plates} {plates === 1 ? 'plate' : 'plates'} · {perSide}
              {unitLabel(unit)}
            </PlateChip>
          ))}
        </Row>
      ) : null}

      {/*
        Directly above the inputs on purpose: the type decides what the numbers
        you are about to type will COUNT toward, so it belongs in the same
        glance as them. It used to sit above the plate controls, far enough up
        that a mis-set type was only visible after scrolling back.
      */}
      <Field>
        <FieldLabel as="span" id={setTypeLabelId}>
          Set type
        </FieldLabel>
        <SetTypeRow role="group" aria-labelledby={setTypeLabelId}>
          {SET_KINDS.map(({ kind, label }) => (
            <SetTypeButton
              key={kind}
              type="button"
              active={setKind === kind}
              aria-pressed={setKind === kind}
              onClick={() => setSetKind(kind)}
            >
              {label}
            </SetTypeButton>
          ))}
        </SetTypeRow>
        <Muted as="span">{SET_KIND_HINTS[setKind]}</Muted>
      </Field>

      <InputRow>
        <NumberInput
          label={weightLabelForMode(mode, variation, unit)}
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
