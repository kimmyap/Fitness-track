/**
 * Per-exercise card (legacy renderExerciseList card):
 * - collapsed: ProgressRing (best/goal), icon, name + custom tag, target
 *   sets×reps, PB badge with volume trend arrow, session badge n/N (green
 *   when target met)
 * - expanded: info box (variation-specific cues + muscles + MuscleWiki link),
 *   suggest-alternative flow, custom notes/archive/delete, progression
 *   suggestion, est-1RM + mini chart, history, logging form.
 */
import { useEffect, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import styled from '@emotion/styled';
import {
  CircleAlert,
  Lightbulb,
  NotebookPen,
  PersonStanding,
  RefreshCw,
  TrendingDown,
  Video,
} from 'lucide-react';
import { Badge, Button, Card, ConfirmTap, Field, FieldLabel, ProgressRing, toast } from '@/components';
import { useEntriesStore, useGoalsStore, useSettingsStore, useAchievementsStore, useCustomExercisesStore, selectGoalFor } from '@/stores';
import {
  bestFor,
  estimated1RM,
  fmtNum,
  suggestedNextWeight,
  toDisplayWeight,
  volumeTrend,
  detectStall,
  displayDate,
} from '@/lib/domain';
import { ALTERNATIVES, EXERCISE_INFO, EXERCISE_VARIATIONS, iconForExercise } from '@/lib/program';
import type { AlternativeExercise } from '@/lib/program';
import type { AnyExercise, LiftSetEntry } from '@/lib/types';
import { isCustomExercise, isLiftSet } from '@/lib/types';
import { celebrateAchievements } from '@/features/today/celebrate';
import { autoStartRestTimer } from './restTimer';
import { humanizeEquipment } from './ExercisePicker';
import { libraryAlternativesFor } from '@/services/exerciseLibraryService';
import type { LibraryExercise } from '@/services/exerciseLibraryService';
import { HistoryList } from './HistoryList';
import { LoggingForm } from './LoggingForm';
import { MiniChart } from './MiniChart';
import type { SwapPrefill } from './AddExerciseSection';
import {
  InfoBox,
  Muted,
  SelectBase,
  SetRow,
  Stack,
  SuggestBox,
  TextButton,
  TextAreaBase,
  fmtStoredWeight,
  unitLabel,
} from './ui';

const HeadButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.space[3]};
  width: 100%;
  min-height: ${({ theme }) => theme.touchTarget};
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
`;

const HeadLeft = styled.span`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[3]};
  min-width: 0;
`;

const RingWrap = styled.span`
  position: relative;
  display: inline-flex;
  flex-shrink: 0;

  > span {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const ExName = styled.span`
  display: block;
  font-family: ${({ theme }) => theme.typography.display};
  font-weight: 700;
  font-size: ${({ theme }) => theme.typography.fontSizes.md};
`;

const HeadRight = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${({ theme }) => theme.space[1]};
  flex-shrink: 0;
`;

const InfoRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.space[2]};
  align-items: flex-start;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const ExternalLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  min-height: ${({ theme }) => theme.touchTarget};
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: underline;
  font-size: ${({ theme }) => theme.typography.fontSizes.sm};
`;

/**
 * The drag handle sits beside the head button rather than inside it: nesting a
 * button in a button is invalid HTML and breaks the expand control.
 */
const HeadRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[2]};
`;

/**
 * Active card gets an accent rule AND the "Logging" badge in the head — colour
 * alone must never carry meaning (CLAUDE.md accessibility rules).
 */
const CardShell = styled(Card)<{ active?: boolean; dragging?: boolean }>`
  border-color: ${({ theme, active }) => (active ? theme.colors.primary : theme.colors.border)};
  box-shadow: ${({ theme, active }) => (active ? `inset 3px 0 0 0 ${theme.colors.primary}` : 'none')};
  opacity: ${({ dragging }) => (dragging ? 0.6 : 1)};

  @media (prefers-reduced-motion: no-preference) {
    transition: border-color 150ms ease, box-shadow 150ms ease;
  }
`;

/**
 * One suggestion, from either source, so the render path stays single.
 *
 * `reason` is nullable because only the curated table has one — the library
 * ships no prose, so a derived clause is used where the metadata allows and
 * the suggestion falls back to a bare name where it does not.
 */
interface AltOption {
  name: string;
  reason: string | null;
  sets: number;
  reps: string;
  cues: string | null;
  muscles: string | null;
}

const fromCurated = (a: AlternativeExercise): AltOption => ({
  name: a.name,
  reason: a.reason,
  sets: a.targetSets,
  reps: a.targetReps,
  cues: a.cues,
  muscles: a.muscles,
});

/**
 * Library entries carry no sets or reps, so the suggestion INHERITS the
 * prescription of the exercise it would replace — you are substituting into the
 * same slot, so a 3x10 accessory yields the substitute at 3x10.
 */
function fromLibrary(entry: LibraryExercise, replacing: AnyExercise): AltOption {
  // Both parts or neither: "same movement pattern," with nothing after it reads
  // like a truncated sentence.
  const reason =
    entry.movement_pattern && entry.equipment
      ? `same movement pattern, ${humanizeEquipment(entry.equipment).toLowerCase()}`
      : null;
  return {
    name: entry.name,
    reason,
    sets: replacing.targetSets,
    reps: replacing.targetReps,
    cues: entry.execution_cues[0] ?? null,
    muscles: entry.primary_muscles.length ? entry.primary_muscles.join(', ') : null,
  };
}

export interface ExerciseCardProps {
  exercise: AnyExercise;
  day: string;
  logDate: string;
  todayIso: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onSwapRequest: (mode: 'oneoff' | 'recurring', prefill: SwapPrefill) => void;
  onConfetti: () => void;
  /** Drag handle supplied by SortableExerciseCard; omitted when not sortable. */
  dragHandle?: ReactNode;
  /** True while this card is the one being dragged. */
  dragging?: boolean;
  /** Other days this exercise can be reassigned to. */
  otherDays?: string[];
  onAssignDay?: (toDay: string) => void;
}

export function ExerciseCard({
  exercise,
  day,
  logDate,
  todayIso,
  expanded,
  onToggleExpand,
  onSwapRequest,
  onConfetti,
  dragHandle = null,
  dragging = false,
  otherDays = [],
  onAssignDay,
}: ExerciseCardProps) {
  const entries = useEntriesStore((s) => s.entries);
  const unit = useSettingsStore((s) => s.unit);
  const goal = useGoalsStore(selectGoalFor(exercise));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [altPick, setAltPick] = useState<AltOption | null>(null);
  const [libraryAlts, setLibraryAlts] = useState<AltOption[]>([]);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const best = bestFor(entries, exercise.name);
  const pct = best ? Math.min(100, Math.round((best.weight / goal) * 100)) : 0;
  const trend = volumeTrend(entries, exercise.name);
  const sessionSets = entries.filter(
    (e) => isLiftSet(e) && e.exercise === exercise.name && e.date === logDate && !e.warmupSet,
  ).length;
  const sessionDone = sessionSets >= exercise.targetSets;
  const custom = isCustomExercise(exercise);

  const editingEntry =
    (editingId ? entries.find((e): e is LiftSetEntry => isLiftSet(e) && e.id === editingId) : undefined) ?? null;

  // Info box content (built-ins): cue for the most recently used variation
  const info = EXERCISE_INFO[exercise.name];
  const variationsList = EXERCISE_VARIATIONS[exercise.name];
  const recentVarEntry = entries
    .filter((e): e is LiftSetEntry => isLiftSet(e) && e.exercise === exercise.name && Boolean(e.variation))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const displayVariation = recentVarEntry?.variation ?? variationsList?.[0] ?? null;
  // Category icon (barbell / dumbbell / …), refined by the variation in use.
  const Icon = iconForExercise(exercise.name, displayVariation);
  const cueText = info
    ? (displayVariation ? info.cuesByVariation[displayVariation] : undefined) ?? info.cuesByVariation.default
    : null;

  const suggestion = suggestedNextWeight(entries, exercise, unit);
  const stall = detectStall(entries, exercise.name);
  const oneRM = estimated1RM(entries, exercise.name);

  const curatedAlts = ALTERNATIVES[exercise.name];
  /*
   * Curated wins. The nine built-ins have hand-written reasons and cues that
   * nothing derived from the library can match; the fallback exists for the
   * exercises that have no curated entry at all — custom ones, mainly, which
   * until now showed no alternatives button whatsoever.
   */
  const altOptions: AltOption[] = curatedAlts?.length ? curatedAlts.map(fromCurated) : libraryAlts;

  /*
   * Only once the card is OPEN. The library is a 1.2 MB lazy chunk, and a day
   * holds several cards — fetching it for every collapsed card without curated
   * alternatives would pull it on first paint, which is exactly what keeping
   * the import dynamic is for.
   */
  useEffect(() => {
    if (!expanded || curatedAlts?.length) return;
    let cancelled = false;
    void libraryAlternativesFor(exercise.name)
      .then((found) => {
        if (!cancelled) setLibraryAlts(found.map((entry) => fromLibrary(entry, exercise)));
      })
      .catch(() => {
        // Offline with the chunk uncached: the rest of the card still works.
        if (!cancelled) setLibraryAlts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, exercise, curatedAlts]);

  const handleRepeat = (source: LiftSetEntry) => {
    useEntriesStore.getState().logSet({
      exercise: source.exercise,
      weight: source.weight,
      reps: source.reps,
      date: logDate,
      ...(source.rpe ? { rpe: source.rpe } : {}),
      ...(source.variation ? { variation: source.variation } : {}),
      warmupSet: Boolean(source.warmupSet),
      assistedPullup: Boolean(source.assistedPullup),
      // Every label the source carried, or Repeat quietly relabels the set:
      // repeating a drop set produced a working set that could take a PB.
      dropSet: Boolean(source.dropSet),
      toFailure: Boolean(source.toFailure),
      perSide: Boolean(source.perSide),
    });
    if (logDate === todayIso) autoStartRestTimer();
    toast(`Repeated: ${fmtStoredWeight(source.weight, unit)} x ${source.reps}`);
    celebrateAchievements(useAchievementsStore.getState().checkAchievements(), onConfetti);
  };

  const handleDelete = (entry: LiftSetEntry) => {
    const removed = useEntriesStore.getState().deleteEntry(entry.id);
    if (!removed) return;
    if (editingId === entry.id) setEditingId(null);
    toast('Set deleted', { undo: () => useEntriesStore.getState().restoreEntry(removed) });
  };

  const swapPrefillFor = (pick: AltOption): SwapPrefill => ({
    name: pick.name,
    sets: pick.sets,
    reps: pick.reps,
    cues: pick.cues,
    muscles: pick.muscles,
  });

  const mwQuery = encodeURIComponent(`site:musclewiki.com ${exercise.name}`);

  return (
    <CardShell active={expanded} dragging={dragging}>
      <HeadRow>
        {dragHandle}
        <HeadButton type="button" aria-expanded={expanded} onClick={onToggleExpand}>
        <HeadLeft>
          <RingWrap>
            <ProgressRing pct={pct} label={`Best weight is ${pct}% of your ${toDisplayWeight(goal, unit)}${unitLabel(unit)} goal`} />
            <span aria-hidden="true">
              <Icon size={16} />
            </span>
          </RingWrap>
          <span>
            <ExName>
              {exercise.name} {custom ? <Badge>custom</Badge> : null}
            </ExName>
            <Muted as="span">
              Target: {exercise.targetSets} x {exercise.targetReps}
            </Muted>
          </span>
        </HeadLeft>
        <HeadRight>
          <Badge tone="primary">
            {best ? `PB ${fmtStoredWeight(best.weight, unit)}` : 'No log yet'}
            {trend === 'up' ? ' ↑' : trend === 'down' ? ' ↓' : ''}
          </Badge>
          {/* Expanded: the sticky ActiveSetBar already carries "Set n of N",
              so swap the count for the active marker instead of stacking a
              fourth badge into a 375px-wide head. */}
          {expanded ? (
            <Badge tone="primary">● Logging</Badge>
          ) : (
            <Badge tone={sessionDone ? 'success' : 'neutral'}>
              {sessionSets}/{exercise.targetSets} sets {sessionDone ? '✓' : 'today'}
            </Badge>
          )}
        </HeadRight>
        </HeadButton>
      </HeadRow>

      {expanded ? (
        <Stack gap={3}>
          {otherDays.length && onAssignDay ? (
            <Field>
              <FieldLabel htmlFor={`move-day-${exercise.name}`}>Move to another day</FieldLabel>
              <SelectBase
                id={`move-day-${exercise.name}`}
                value=""
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  if (e.target.value) onAssignDay(e.target.value);
                }}
              >
                <option value="">Keep on {day}</option>
                {otherDays.map((d) => (
                  <option key={d} value={d}>
                    Move to {d}
                  </option>
                ))}
              </SelectBase>
            </Field>
          ) : null}
          {info ? (
            <InfoBox>
              {cueText ? (
                <InfoRow>
                  <CircleAlert size={16} aria-hidden="true" />
                  <span>
                    {cueText} {displayVariation ? <Muted as="span">({displayVariation})</Muted> : null}
                  </span>
                </InfoRow>
              ) : null}
              <InfoRow>
                <PersonStanding size={16} aria-hidden="true" />
                <span>{info.muscles}</span>
              </InfoRow>
              <ExternalLink href={`https://www.google.com/search?q=${mwQuery}`} target="_blank" rel="noopener noreferrer">
                <Video size={16} aria-hidden="true" /> Watch on MuscleWiki
              </ExternalLink>
            </InfoBox>
          ) : null}

          {altOptions.length ? (
            <Stack gap={2}>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  const pick = altOptions[Math.floor(Math.random() * altOptions.length)] as AltOption;
                  setAltPick(pick);
                }}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {altPick
                  ? `Try: ${altPick.name}${altPick.reason ? ` — ${altPick.reason}` : ''}`
                  : 'Suggest an alternative'}
              </Button>
              {altPick ? (
                <>
                  <Button fullWidth onClick={() => onSwapRequest('oneoff', swapPrefillFor(altPick))}>
                    Swap in {altPick.name} for today
                  </Button>
                  <TextButton onClick={() => onSwapRequest('recurring', swapPrefillFor(altPick))}>
                    Or add {altPick.name} permanently instead
                  </TextButton>
                </>
              ) : null}
            </Stack>
          ) : null}

          {custom ? (
            <Stack gap={2}>
              {editingNote ? (
                <>
                  <label htmlFor={`note-${exercise.name}`}>
                    <Muted as="span">Notes for {exercise.name}</Muted>
                  </label>
                  <TextAreaBase
                    id={`note-${exercise.name}`}
                    rows={3}
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      const val = noteDraft.trim();
                      useCustomExercisesStore.getState().setExerciseNotes(day, exercise.name, val || null);
                      setEditingNote(false);
                    }}
                  >
                    Save Note
                  </Button>
                  <TextButton onClick={() => setEditingNote(false)}>Cancel</TextButton>
                </>
              ) : (
                <>
                  <InfoBox>
                    <InfoRow>
                      <NotebookPen size={16} aria-hidden="true" />
                      <span>{exercise.notes || 'No notes yet, tap edit to add form cues or reminders for yourself.'}</span>
                    </InfoRow>
                  </InfoBox>
                  <TextButton
                    onClick={() => {
                      setNoteDraft(exercise.notes ?? '');
                      setEditingNote(true);
                    }}
                  >
                    {exercise.notes ? 'Edit note' : 'Add a note'}
                  </TextButton>
                </>
              )}
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  useCustomExercisesStore.getState().archiveCustomExercise(day, exercise.name);
                  toast(`${exercise.name} archived, find it again in Settings if you want it back`);
                }}
              >
                Archive (hide from this week)
              </Button>
              <ConfirmTap
                confirmLabel="Tap again to permanently delete"
                onConfirm={() => useCustomExercisesStore.getState().deleteCustomExercise(day, exercise.name)}
                fullWidth
              >
                Delete permanently (loses goal weight config)
              </ConfirmTap>
            </Stack>
          ) : null}

          {stall ? (
            <InfoBox>
              <span>
                <TrendingDown size={16} aria-hidden="true" /> Held{' '}
                <strong>{fmtStoredWeight(stall.weight, unit)}</strong> for {stall.sessions} sessions since{' '}
                {displayDate(stall.since)}. Worth a lighter week, or swapping the movement.
              </span>
            </InfoBox>
          ) : null}

          {suggestion ? (
            <SuggestBox>
              <Lightbulb size={16} aria-hidden="true" />
              <span>
                Suggested:{' '}
                <strong>
                  {suggestion.suggestion}
                  {unitLabel(unit)}
                </strong>{' '}
                {suggestion.direction === 'up'
                  ? `(+${fmtNum(Math.round((suggestion.suggestion - suggestion.lastWeight) * 10) / 10)}${unitLabel(unit)})`
                  : '(hold)'}
                . {suggestion.note}
              </span>
            </SuggestBox>
          ) : null}

          <div>
            <SetRow noBorder>
              <strong>Est. 1-Rep Max</strong>
              <strong>{oneRM ? fmtStoredWeight(oneRM, unit) : '--'}</strong>
            </SetRow>
            <MiniChart exerciseName={exercise.name} />
          </div>

          <HistoryList
            exerciseName={exercise.name}
            best={best}
            todayIso={todayIso}
            onRepeat={handleRepeat}
            onEdit={(entry) => setEditingId(entry.id)}
            onDelete={handleDelete}
            editingId={editingId}
          />

          <LoggingForm
            key={`${logDate}|${editingEntry?.id ?? 'new'}`}
            exercise={exercise}
            logDate={logDate}
            todayIso={todayIso}
            editingEntry={editingEntry}
            onFinishEdit={() => setEditingId(null)}
            onConfetti={onConfetti}
          />
        </Stack>
      ) : null}
    </CardShell>
  );
}
