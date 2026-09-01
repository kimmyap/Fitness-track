/**
 * "+ Add or log an exercise not in this list" (legacy renderAddCustomExercise):
 * - "Add permanently": name / target sets / reps / optional goal / optional
 *   notes / optional replace-select (replacing a built-in excludes it,
 *   replacing a custom archives it, and marks the program reviewed)
 * - "Just log once": one-off sets logged straight to entries (no createdAt,
 *   legacy quirk) with a running list of today's sets + delete.
 */
import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Button, Card, Field, FieldLabel, NumberInput, SegmentedTabs, TextInput, toast } from '@/components';
import { useCustomExercisesStore, useEntriesStore, useSettingsStore } from '@/stores';
import { exercisesForDay, fromDisplayWeight } from '@/lib/domain';
import { DAYS } from '@/lib/program';
import { isLiftSet } from '@/lib/types';
import type { LiftSetEntry } from '@/lib/types';
import {
  CardTitle,
  InfoBox,
  Muted,
  Row,
  SelectBase,
  SetRow,
  Stack,
  TextButton,
  TextAreaBase,
  fmtStoredWeight,
  unitLabel,
} from './ui';
import { IconButton } from '@/components';
import { ExercisePicker } from './ExercisePicker';
import type { LibraryExercise } from '@/services/exerciseLibraryService';
import { Library, X } from 'lucide-react';

export interface SwapPrefill {
  name: string;
  sets: number;
  reps: string;
  cues: string | null;
  muscles: string | null;
}

export type AddExerciseMode = 'recurring' | 'oneoff';

export interface AddExerciseSectionProps {
  day: string;
  logDate: string;
  open: boolean;
  mode: AddExerciseMode;
  prefill: SwapPrefill | null;
  onOpen: () => void;
  onClose: () => void;
  onModeChange: (mode: AddExerciseMode) => void;
}

const ONEOFF_COLLAPSE_THRESHOLD = 4;

function RecurringForm({ day, prefill, onClose }: { day: string; prefill: SwapPrefill | null; onClose: () => void }) {
  const unit = useSettingsStore((s) => s.unit);
  // Subscribe to raw slices and derive with useMemo — selectExercisesForDay
  // returns a fresh array per call, which loops under zustand v5 hooks.
  const customExercises = useCustomExercisesStore((s) => s.customExercises);
  const excludedBuiltIns = useCustomExercisesStore((s) => s.excludedBuiltIns);
  const dayExercises = useMemo(
    () => exercisesForDay(day, DAYS, customExercises, excludedBuiltIns),
    [day, customExercises, excludedBuiltIns],
  );

  const prefillNotes = prefill
    ? [prefill.cues, prefill.muscles ? `Targets: ${prefill.muscles}` : null].filter(Boolean).join(' ')
    : '';

  const [name, setName] = useState(prefill?.name ?? '');
  const [sets, setSets] = useState<number | ''>(prefill?.sets ?? '');
  const [reps, setReps] = useState(prefill?.reps ?? '');
  const [goal, setGoal] = useState<number | ''>('');
  const [notes, setNotes] = useState(prefillNotes);
  const [replaceTarget, setReplaceTarget] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  /** Library pick fills the name and seeds notes with its cues. */
  const applyLibraryPick = (ex: LibraryExercise) => {
    setName(ex.name);
    const cues = ex.execution_cues.slice(0, 2).join(' ');
    setNotes([cues, `Targets: ${ex.primary_muscles.join(', ')}`].filter(Boolean).join(' '));
    if (sets === '') setSets(3);
    if (!reps.trim()) setReps('8-12');
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const store = useCustomExercisesStore.getState();
    if (replaceTarget) {
      const isBuiltIn = (DAYS[day] || []).some((ex) => ex.name === replaceTarget);
      if (isBuiltIn) store.excludeBuiltIn(day, replaceTarget);
      else store.archiveCustomExercise(day, replaceTarget);
    }
    store.addCustomExercise(day, {
      name: trimmed,
      targetSets: (sets === '' ? 0 : sets) || 3,
      targetReps: reps.trim() || '8-12',
      ...(goal ? { goal: fromDisplayWeight(goal, unit) } : {}),
      notes: notes.trim() || null,
    });
    if (replaceTarget) useSettingsStore.getState().markProgramReviewed();
    toast(replaceTarget ? `${trimmed} replaced ${replaceTarget} on ${day}` : `${trimmed} added to ${day}`);
    onClose();
  };

  return (
    <Stack gap={2}>
      <Muted>This becomes a permanent part of {day}, going forward every week.</Muted>
      <Field>
        <FieldLabel htmlFor="custom-ex-replace">Replace an existing exercise?</FieldLabel>
        <SelectBase id="custom-ex-replace" value={replaceTarget} onChange={(e) => setReplaceTarget(e.target.value)}>
          <option value="">Don&apos;t replace, just add as new</option>
          {dayExercises.map((ex) => (
            <option key={ex.name} value={ex.name}>
              {ex.name}
            </option>
          ))}
        </SelectBase>
      </Field>
      <Row>
        <Button variant="secondary" onClick={() => setPickerOpen(true)}>
          <Library size={16} aria-hidden="true" /> Browse exercise library
        </Button>
      </Row>
      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={applyLibraryPick} />
      <TextInput label="Exercise name" value={name} onChange={(e) => setName(e.target.value)} />
      <NumberInput
        label="Target sets"
        value={sets}
        min={1}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setSets(e.target.value === '' ? '' : Number(e.target.value))}
      />
      <TextInput label="Target reps, e.g. 8-12" value={reps} onChange={(e) => setReps(e.target.value)} />
      <NumberInput
        label={`Rough goal weight (${unitLabel(unit)}), optional`}
        value={goal}
        min={0}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setGoal(e.target.value === '' ? '' : Number(e.target.value))}
      />
      <Field>
        <FieldLabel htmlFor="custom-ex-notes">Form cues or notes for yourself, optional</FieldLabel>
        <TextAreaBase id="custom-ex-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button fullWidth onClick={save}>
        Save
      </Button>
      <Button variant="secondary" fullWidth onClick={onClose}>
        Cancel
      </Button>
    </Stack>
  );
}

function OneOffForm({ logDate, prefill, onClose }: { logDate: string; prefill: SwapPrefill | null; onClose: () => void }) {
  const unit = useSettingsStore((s) => s.unit);
  const entries = useEntriesStore((s) => s.entries);

  const [currentPrefill, setCurrentPrefill] = useState<SwapPrefill | null>(prefill);
  const [name, setName] = useState(prefill?.name ?? '');
  const [weight, setWeight] = useState<number | ''>('');
  const [reps, setReps] = useState<number | ''>(prefill ? parseInt(prefill.reps) || '' : '');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const loggedSoFar = currentPrefill?.name
    ? entries.filter(
        (e): e is LiftSetEntry =>
          isLiftSet(e) && e.exercise === currentPrefill.name && e.date === logDate && !e.warmupSet,
      )
    : [];

  const logOnce = () => {
    const trimmed = name.trim();
    const w = weight === '' ? 0 : weight;
    const r = reps === '' ? 0 : Math.trunc(reps);
    if (!trimmed || !w || !r) return;
    setSaving(true);
    useEntriesStore.getState().logSet({
      exercise: trimmed,
      weight: fromDisplayWeight(w, unit),
      reps: r,
      date: logDate,
      withCreatedAt: false,
    });
    // Legacy: remember the name so the running list shows for follow-up sets
    setCurrentPrefill({
      name: trimmed,
      sets: currentPrefill?.sets ?? 3,
      reps: currentPrefill?.reps ?? '8-12',
      cues: currentPrefill?.cues ?? null,
      muscles: currentPrefill?.muscles ?? null,
    });
    toast(`Set logged for ${trimmed}`);
    setSaving(false);
  };

  const visible =
    loggedSoFar.length > ONEOFF_COLLAPSE_THRESHOLD && !expanded
      ? loggedSoFar.slice(-ONEOFF_COLLAPSE_THRESHOLD)
      : loggedSoFar;
  const hiddenCount = loggedSoFar.length - visible.length;
  const startIdx = loggedSoFar.length - visible.length;

  return (
    <Stack gap={2}>
      <Muted>
        Logs sets right now, one at a time. Won&apos;t show up as a card, but you can still find it later in
        Calendar for that day.
      </Muted>
      {currentPrefill ? (
        <Muted>
          Target: {currentPrefill.sets} x {currentPrefill.reps}
        </Muted>
      ) : null}
      {currentPrefill && (currentPrefill.cues || currentPrefill.muscles) ? (
        <InfoBox>
          {currentPrefill.cues ? <span>{currentPrefill.cues}</span> : null}
          {currentPrefill.muscles ? <span>{currentPrefill.muscles}</span> : null}
        </InfoBox>
      ) : null}
      <Row>
        <Button variant="secondary" onClick={() => setPickerOpen(true)}>
          <Library size={16} aria-hidden="true" /> Browse exercise library
        </Button>
      </Row>
      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(ex) => setName(ex.name)}
      />
      <TextInput label="Exercise name" value={name} onChange={(e) => setName(e.target.value)} />
      <NumberInput
        label={`Weight (${unitLabel(unit)})`}
        value={weight}
        min={0}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
      />
      <NumberInput
        label="Reps"
        value={reps}
        min={0}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setReps(e.target.value === '' ? '' : Number(e.target.value))}
      />
      <Button fullWidth disabled={saving} onClick={logOnce}>
        {saving ? 'Saving...' : 'Log Set'}
      </Button>
      <Button variant="secondary" fullWidth onClick={onClose}>
        {loggedSoFar.length ? 'Done' : 'Cancel'}
      </Button>
      {loggedSoFar.length ? (
        <div>
          <Muted>
            {loggedSoFar.length} set{loggedSoFar.length > 1 ? 's' : ''} logged today
          </Muted>
          {hiddenCount > 0 ? (
            <TextButton onClick={() => setExpanded(true)}>
              Show {hiddenCount} earlier set{hiddenCount > 1 ? 's' : ''}
            </TextButton>
          ) : null}
          {visible.map((r, i) => (
            <SetRow key={r.id}>
              <span>Set {startIdx + i + 1}</span>
              <span>{r.reps} reps</span>
              <strong>{fmtStoredWeight(r.weight, unit)}</strong>
              <IconButton
                aria-label={`Delete set ${startIdx + i + 1}`}
                tone="destructive"
                onClick={() => useEntriesStore.getState().deleteEntry(r.id)}
              >
                <X size={16} aria-hidden="true" />
              </IconButton>
            </SetRow>
          ))}
        </div>
      ) : null}
    </Stack>
  );
}

export function AddExerciseSection({ day, logDate, open, mode, prefill, onOpen, onClose, onModeChange }: AddExerciseSectionProps) {
  if (!open) {
    return <TextButton onClick={onOpen}>+ Add or log an exercise not in this list</TextButton>;
  }
  return (
    <Card>
      <Stack gap={3}>
        <CardTitle>Not in the list?</CardTitle>
        <SegmentedTabs
          aria-label="Add exercise mode"
          tabs={[
            { id: 'recurring', label: 'Add permanently' },
            { id: 'oneoff', label: 'Just log once' },
          ]}
          value={mode}
          onChange={(id) => onModeChange(id as AddExerciseMode)}
        />
        {mode === 'recurring' ? (
          <RecurringForm key={prefill?.name ?? 'blank'} day={day} prefill={prefill} onClose={onClose} />
        ) : (
          <OneOffForm key={prefill?.name ?? 'blank'} logDate={logDate} prefill={prefill} onClose={onClose} />
        )}
      </Stack>
    </Card>
  );
}
