/**
 * One workout day (Lower A / Upper / Lower B): stats strip, quick-log
 * Pilates/Volleyball, weekly volume recap, "Logging for" date picker, sticky
 * rest-timer bar, Finish Workout → summary modal, exercise cards, and the
 * add-or-log-once section.
 */
import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button, Confetti, toast } from '@/components';
import { useEntriesStore, useCustomExercisesStore, useAchievementsStore, useProgramStore } from '@/stores';
import { exercisesForDay } from '@/lib/domain';
import { DAYS } from '@/lib/program';
import { isActivity, isLiftSet } from '@/lib/types';
import type { ActivityEntry, ActivityName } from '@/lib/types';
import { celebrateAchievements, useConfetti } from '@/features/today/celebrate';
import { TodayStatsStrip } from '@/features/today/StatsStrip';
import { Muted, Row, Stack } from './ui';
import { WeeklyRecapCard } from './WeeklyRecapCard';
import { DatePickerBar } from './DatePickerBar';
import { RestTimerBar } from './RestTimerBar';
import { FinishWorkoutModal } from './FinishWorkoutModal';
import { SortableExerciseCard } from './SortableExerciseCard';
import { ActiveSetBar } from './ActiveSetBar';
import { AddExerciseSection } from './AddExerciseSection';
import type { AddExerciseMode, SwapPrefill } from './AddExerciseSection';

export interface WorkoutDayViewProps {
  day: string;
  logDate: string;
  todayIso: string;
  onLogDateChange: (date: string) => void;
}

interface AddSectionState {
  open: boolean;
  mode: AddExerciseMode;
  prefill: SwapPrefill | null;
}

export function WorkoutDayView({ day, logDate, todayIso, onLogDateChange }: WorkoutDayViewProps) {
  const confetti = useConfetti();
  // Raw subscriptions + pure derivation (zustand v5: no fresh-array selectors)
  const customExercises = useCustomExercisesStore((s) => s.customExercises);
  const excludedBuiltIns = useCustomExercisesStore((s) => s.excludedBuiltIns);
  const days = useProgramStore((s) => s.days);
  const order = useProgramStore((s) => s.order);
  const dayOrder = order[day];
  const exercises = exercisesForDay(day, DAYS, customExercises, excludedBuiltIns, dayOrder);
  const exerciseNames = exercises.map((ex) => ex.name);
  const otherDays = days.filter((d) => d !== day);
  const entries = useEntriesStore((s) => s.entries);
  const todayActivities = entries
    .filter((e): e is ActivityEntry => isActivity(e) && e.date === todayIso)
    .map((e) => e.activity);
  const logActivity = useEntriesStore((s) => s.logActivity);

  const [openExercise, setOpenExercise] = useState<string | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [addState, setAddState] = useState<AddSectionState>({ open: false, mode: 'recurring', prefill: null });

  const quickLog = (activity: ActivityName) => {
    logActivity(activity, todayIso);
    toast(`${activity} logged for today`);
    celebrateAchievements(useAchievementsStore.getState().checkAchievements(), confetti.fire);
  };

  const handleSwapRequest = (mode: AddExerciseMode, prefill: SwapPrefill) => {
    setOpenExercise(null);
    setAddState({ open: true, mode, prefill });
  };

  // Pointer drags need a small threshold or a tap on the handle starts a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = exerciseNames.indexOf(String(active.id));
    const to = exerciseNames.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    useProgramStore.getState().setDayOrder(day, arrayMove(exerciseNames, from, to));
  };

  const activeExercise = exercises.find((ex) => ex.name === openExercise);
  const activeSetsLogged = activeExercise
    ? entries.filter(
        (e) => isLiftSet(e) && e.exercise === activeExercise.name && e.date === logDate && !e.warmupSet,
      ).length
    : 0;

  return (
    <Stack gap={3}>
      <TodayStatsStrip />

      <Row wrap>
        <Button
          variant="secondary"
          disabled={todayActivities.includes('Pilates')}
          onClick={() => quickLog('Pilates')}
        >
          {todayActivities.includes('Pilates') ? '✓ Pilates logged' : '+ Log Pilates (today)'}
        </Button>
        <Button
          variant="secondary"
          disabled={todayActivities.includes('Volleyball')}
          onClick={() => quickLog('Volleyball')}
        >
          {todayActivities.includes('Volleyball') ? '✓ Volleyball logged' : '+ Log Volleyball (today)'}
        </Button>
      </Row>

      <WeeklyRecapCard />
      <DatePickerBar logDate={logDate} todayIso={todayIso} onChange={onLogDateChange} />
      <RestTimerBar />

      <Button fullWidth onClick={() => setFinishOpen(true)}>
        <Check size={18} aria-hidden="true" /> Finish Workout
      </Button>

      {activeExercise ? (
        <ActiveSetBar
          exerciseName={activeExercise.name}
          setsLogged={activeSetsLogged}
          targetSets={activeExercise.targetSets}
          targetReps={activeExercise.targetReps}
        />
      ) : null}

      {exercises.length === 0 ? (
        <Muted>No exercises on this day yet — add one below.</Muted>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={exerciseNames} strategy={verticalListSortingStrategy}>
            <Stack gap={3}>
              {exercises.map((ex) => (
                <SortableExerciseCard
                  key={ex.name}
                  id={ex.name}
                  exercise={ex}
                  day={day}
                  logDate={logDate}
                  todayIso={todayIso}
                  expanded={openExercise === ex.name}
                  onToggleExpand={() => setOpenExercise((cur) => (cur === ex.name ? null : ex.name))}
                  onSwapRequest={handleSwapRequest}
                  onConfetti={confetti.fire}
                  otherDays={otherDays}
                  onAssignDay={(toDay) => {
                    useProgramStore.getState().assignExerciseToDay(day, toDay, ex.name);
                    toast(`${ex.name} moved to ${toDay}`);
                  }}
                />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>
      )}

      <AddExerciseSection
        day={day}
        logDate={logDate}
        open={addState.open}
        mode={addState.mode}
        prefill={addState.prefill}
        onOpen={() => setAddState({ open: true, mode: 'recurring', prefill: null })}
        onClose={() => setAddState({ open: false, mode: 'recurring', prefill: null })}
        onModeChange={(mode) => setAddState((s) => ({ ...s, mode }))}
      />

      <FinishWorkoutModal open={finishOpen} onClose={() => setFinishOpen(false)} onConfetti={confetti.fire} />
      <Confetti active={confetti.active} onDone={confetti.done} />
    </Stack>
  );
}
