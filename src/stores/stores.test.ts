import { beforeEach, describe, expect, it } from 'vitest';
import { useEntriesStore, selectSetsToday, selectHasCompletion, buildLiftSetEntry } from './entries';
import { useBodyweightStore, selectLatestBw } from './bodyweight';
import { useMeasurementsStore } from './measurements';
import { useSettingsStore } from './settings';
import { useCustomExercisesStore, selectExercisesForDay, selectArchivedAndReplaced } from './customExercises';
import { useCoreOverridesStore, selectEffectiveCoreExercises } from './coreOverrides';
import { useGoalsStore, selectGoalFor } from './goals';
import { useNotesStore } from './notes';
import { useAchievementsStore } from './achievements';
import { runStartupMigrations } from './index';
import { isoDate } from '@/lib/domain';
import type { Entry, LiftSetEntry } from '@/lib/types';

const read = <T>(key: string): T => JSON.parse(localStorage.getItem(`gymlog_gymlog:${key}`) ?? 'null') as T;

beforeEach(() => {
  localStorage.clear();
  useEntriesStore.setState({ entries: [] });
  useBodyweightStore.setState({ bwEntries: [] });
  useMeasurementsStore.setState({ measurements: [] });
  useSettingsStore.setState({ unit: 'lbs', themePref: 'system', equipmentWeights: { trapBar: null, legPressSled: null }, lastProgramReview: null });
  useCustomExercisesStore.setState({ customExercises: {}, excludedBuiltIns: {} });
  useCoreOverridesStore.setState({ coreOverrides: {} });
  useGoalsStore.setState({ goals: {} });
  useNotesStore.setState({ notes: {} });
  useAchievementsStore.setState({ seenAchievements: [] });
});

describe('entries store', () => {
  it('logSet writes through with legacy shape (optional fields ABSENT)', () => {
    const { entry } = useEntriesStore.getState().logSet({ exercise: 'Sumo Squats', weight: 135, reps: 10, rpe: 8, variation: 'Barbell' });
    expect(entry.sets).toBe(1);
    const stored = read<LiftSetEntry[]>('entries');
    expect(stored).toHaveLength(1);
    const s = stored[0]!;
    expect(s.exercise).toBe('Sumo Squats');
    expect(s.rpe).toBe(8);
    expect(s.variation).toBe('Barbell');
    expect('warmupSet' in s).toBe(false);
    expect('assistedPullup' in s).toBe(false);
    expect(typeof s.createdAt).toBe('number');
  });

  it('buildLiftSetEntry omits rpe/variation when not provided and createdAt when disabled', () => {
    const e = buildLiftSetEntry({ exercise: 'One-off', weight: 20, reps: 12, withCreatedAt: false });
    expect('rpe' in e).toBe(false);
    expect('variation' in e).toBe(false);
    expect('createdAt' in e).toBe(false);
  });

  it('toggleCompletion adds then removes a typed entry', () => {
    const today = isoDate();
    expect(useEntriesStore.getState().toggleCompletion('warmup')).toBe(true);
    expect(selectHasCompletion('warmup', today)(useEntriesStore.getState())).toBe(true);
    expect(read<Entry[]>('entries')[0]).toMatchObject({ type: 'warmup', date: today });
    expect(useEntriesStore.getState().toggleCompletion('warmup')).toBe(false);
    expect(read<Entry[]>('entries')).toHaveLength(0);
  });

  it('logActivity stores the legacy activity shape', () => {
    useEntriesStore.getState().logActivity('Volleyball', '2026-08-27');
    expect(read<Entry[]>('entries')[0]).toMatchObject({ type: 'activity', activity: 'Volleyball', date: '2026-08-27' });
  });

  it('updateSet deletes cleared optional fields (legacy edit semantics)', () => {
    const { entry } = useEntriesStore.getState().logSet({ exercise: 'Rows', weight: 90, reps: 10, rpe: 8, warmupSet: true });
    useEntriesStore.getState().updateSet(entry.id, { weight: 95, reps: 12 });
    const stored = read<LiftSetEntry[]>('entries')[0]!;
    expect(stored.weight).toBe(95);
    expect(stored.reps).toBe(12);
    expect('rpe' in stored).toBe(false);
    expect('warmupSet' in stored).toBe(false);
  });

  it('deleteEntry returns the removed entry for Undo; restoreEntry puts it back', () => {
    const { entry } = useEntriesStore.getState().logSet({ exercise: 'Rows', weight: 90, reps: 10 });
    const removed = useEntriesStore.getState().deleteEntry(entry.id);
    expect(removed?.id).toBe(entry.id);
    expect(read<Entry[]>('entries')).toHaveLength(0);
    useEntriesStore.getState().restoreEntry(removed!);
    expect(read<Entry[]>('entries')).toHaveLength(1);
  });

  it('selectSetsToday counts non-warmup sets for the exercise', () => {
    const today = isoDate();
    const s = useEntriesStore.getState();
    s.logSet({ exercise: 'Rows', weight: 90, reps: 10 });
    s.logSet({ exercise: 'Rows', weight: 90, reps: 10, warmupSet: true });
    s.logSet({ exercise: 'Bench Press', weight: 100, reps: 8 });
    expect(selectSetsToday('Rows', today)(useEntriesStore.getState())).toBe(1);
  });
});

describe('bodyweight + measurements stores', () => {
  it('write through and support undo', () => {
    const entry = useBodyweightStore.getState().addWeighIn(128.5, '2026-08-28');
    expect(read<Entry[]>('bodyweight')).toHaveLength(1);
    expect(selectLatestBw(useBodyweightStore.getState())?.weight).toBe(128.5);
    const removed = useBodyweightStore.getState().deleteWeighIn(entry.id);
    expect(read<Entry[]>('bodyweight')).toHaveLength(0);
    useBodyweightStore.getState().restoreWeighIn(removed!);
    expect(read<Entry[]>('bodyweight')).toHaveLength(1);

    useMeasurementsStore.getState().addMeasurement(29.5, null, '2026-08-28');
    expect(read<{ waist: number | null; hips: number | null }[]>('measurements')[0]).toMatchObject({ waist: 29.5, hips: null });
  });
});

describe('settings store', () => {
  it('persists unit as a raw string', () => {
    useSettingsStore.getState().setUnit('kg');
    expect(localStorage.getItem('gymlog_gymlog:unit')).toBe('kg');
  });

  it('theme: dark/light persist raw; system removes the key', () => {
    useSettingsStore.getState().setThemePref('dark');
    expect(localStorage.getItem('gymlog_gymlog:theme')).toBe('dark');
    useSettingsStore.getState().setThemePref('system');
    expect(localStorage.getItem('gymlog_gymlog:theme')).toBeNull();
  });

  it('markProgramReviewed stamps today raw', () => {
    useSettingsStore.getState().markProgramReviewed();
    expect(localStorage.getItem('gymlog_gymlog:lastProgramReview')).toBe(isoDate());
  });

  it('equipment weights persist as JSON with explicit 0 preserved', () => {
    useSettingsStore.getState().setEquipmentWeights({ trapBar: 55, legPressSled: 0 });
    expect(localStorage.getItem('gymlog_gymlog:equipmentWeights')).toBe(JSON.stringify({ trapBar: 55, legPressSled: 0 }));
  });
});

describe('custom exercises store', () => {
  it('addCustomExercise applies legacy defaults (goal 50, prefillReps from targetReps)', () => {
    const ex = useCustomExercisesStore.getState().addCustomExercise('Lower A', { name: 'Bulgarian Split Squat', targetSets: 3, targetReps: '8-12' });
    expect(ex).toMatchObject({ prefillReps: 8, goal: 50, custom: true, notes: null });
    expect(read<Record<string, unknown[]>>('customExercises')['Lower A']).toHaveLength(1);
  });

  it('exclude/restore built-ins and archive flow feed the selectors', () => {
    const s = useCustomExercisesStore.getState();
    s.addCustomExercise('Lower A', { name: 'Goblet Squat', targetSets: 3, targetReps: '10-12' });
    s.excludeBuiltIn('Lower A', 'Sumo Squats');
    let list = selectExercisesForDay('Lower A')(useCustomExercisesStore.getState());
    expect(list.map((e) => e.name)).toEqual(['Deadlifts', 'Hip Thrust', 'KB Swings', 'Goblet Squat']);

    useCustomExercisesStore.getState().archiveCustomExercise('Lower A', 'Goblet Squat');
    list = selectExercisesForDay('Lower A')(useCustomExercisesStore.getState());
    expect(list.map((e) => e.name)).toEqual(['Deadlifts', 'Hip Thrust', 'KB Swings']);

    const { archived, replaced } = selectArchivedAndReplaced(useCustomExercisesStore.getState());
    expect(archived[0]?.exercise.name).toBe('Goblet Squat');
    expect(replaced[0]).toEqual({ day: 'Lower A', name: 'Sumo Squats' });

    useCustomExercisesStore.getState().restoreBuiltIn('Lower A', 'Sumo Squats');
    useCustomExercisesStore.getState().unarchiveCustomExercise('Lower A', 'Goblet Squat');
    list = selectExercisesForDay('Lower A')(useCustomExercisesStore.getState());
    expect(list).toHaveLength(5);
    // archived key must be ABSENT after unarchive, not false
    const storedCustom = read<Record<string, Record<string, unknown>[]>>('customExercises')['Lower A']![0]!;
    expect('archived' in storedCustom).toBe(false);
  });
});

describe('core overrides store', () => {
  it('swaps and reverts, persisting the legacy map shape', () => {
    useCoreOverridesStore.getState().setOverride('Plank', { name: 'RKC Plank', target: '3 x 15-20 sec' });
    expect(read<Record<string, unknown>>('coreOverrides')).toEqual({ Plank: { name: 'RKC Plank', target: '3 x 15-20 sec' } });
    const effective = selectEffectiveCoreExercises(useCoreOverridesStore.getState());
    expect(effective[0]).toMatchObject({ swapped: true, effective: { name: 'RKC Plank' } });
    expect(effective[1]).toMatchObject({ swapped: false, effective: { name: 'Dead Bug' } });

    useCoreOverridesStore.getState().revertOverride('Plank');
    expect(read<Record<string, unknown>>('coreOverrides')).toEqual({});
  });
});

describe('goals + notes stores', () => {
  it('goals persist and drive goalFor selector', () => {
    useGoalsStore.getState().setGoal('Sumo Squats', 145);
    expect(read<Record<string, number>>('goals')).toEqual({ 'Sumo Squats': 145 });
    expect(selectGoalFor({ name: 'Sumo Squats', goal: 135 })(useGoalsStore.getState())).toBe(145);
    useGoalsStore.getState().clearGoal('Sumo Squats');
    expect(selectGoalFor({ name: 'Sumo Squats', goal: 135 })(useGoalsStore.getState())).toBe(135);
  });

  it('notes set and clear per date', () => {
    useNotesStore.getState().setNoteForDate('2026-08-28', 'Slept badly, squats felt heavy');
    expect(read<Record<string, string>>('notes')).toEqual({ '2026-08-28': 'Slept badly, squats felt heavy' });
    useNotesStore.getState().setNoteForDate('2026-08-28', '');
    expect(read<Record<string, string>>('notes')).toEqual({});
  });
});

describe('achievements store', () => {
  it('checkAchievements returns newly unlocked defs once and persists ids', () => {
    useEntriesStore.getState().logSet({ exercise: 'Rows', weight: 90, reps: 10 });
    const newly = useAchievementsStore.getState().checkAchievements();
    expect(newly.map((a) => a.id)).toContain('first-set');
    expect(read<string[]>('achievements')).toContain('first-set');
    expect(useAchievementsStore.getState().checkAchievements()).toEqual([]);
  });

  it('syncSeenSilently marks earned achievements without returning them', () => {
    useEntriesStore.getState().logSet({ exercise: 'Rows', weight: 90, reps: 10 });
    useAchievementsStore.getState().syncSeenSilently();
    expect(useAchievementsStore.getState().seenAchievements).toContain('first-set');
  });
});

describe('runStartupMigrations', () => {
  it('backfills lastProgramReview from the earliest entry date and syncs achievements', () => {
    useEntriesStore.setState({
      entries: [
        { id: 'a', exercise: 'Rows', weight: 90, sets: 1, reps: 10, date: '2026-08-10' },
        { id: 'b', exercise: 'Rows', weight: 90, sets: 1, reps: 10, date: '2026-07-01' },
      ],
    });
    runStartupMigrations();
    expect(useSettingsStore.getState().lastProgramReview).toBe('2026-07-01');
    expect(localStorage.getItem('gymlog_gymlog:lastProgramReview')).toBe('2026-07-01');
    expect(useAchievementsStore.getState().seenAchievements).toContain('first-set');
  });

  it('leaves an existing review date alone', () => {
    useSettingsStore.setState({ lastProgramReview: '2026-08-01' });
    useEntriesStore.setState({ entries: [{ id: 'a', exercise: 'Rows', weight: 90, sets: 1, reps: 10, date: '2026-07-01' }] });
    runStartupMigrations();
    expect(useSettingsStore.getState().lastProgramReview).toBe('2026-08-01');
  });
});
