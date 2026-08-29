/**
 * Export payload shape + import merge semantics (old AND new backup shapes).
 * Domain math (mergeById itself) is covered in lib/domain.test.ts — these
 * tests cover the More feature's wiring of it across every store.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyzeImport,
  applyImport,
  backupFilename,
  buildBackupPayload,
  countMissingSets,
  parseBackup,
} from './backup';
import {
  useAchievementsStore,
  useBodyweightStore,
  useCoreOverridesStore,
  useCustomExercisesStore,
  useEntriesStore,
  useGoalsStore,
  useMeasurementsStore,
  useNotesStore,
  useSettingsStore,
} from '@/stores';
import type { Entry, LiftSetEntry } from '@/lib/types';

function liftSet(id: string, exercise: string, weight: number): LiftSetEntry {
  return { id, exercise, weight, sets: 1, reps: 10, date: '2026-08-20' };
}

beforeEach(() => {
  useEntriesStore.getState().setEntries([]);
  useNotesStore.getState().setNotes({});
  useGoalsStore.getState().setGoals({});
  useBodyweightStore.getState().setBwEntries([]);
  useAchievementsStore.getState().setSeenAchievements([]);
  useSettingsStore.getState().setUnit('lbs');
  useSettingsStore.getState().setEquipmentWeights({ trapBar: null, legPressSled: null });
  useCustomExercisesStore.getState().setCustomExercises({});
  useCustomExercisesStore.getState().setExcludedBuiltIns({});
  useCoreOverridesStore.getState().setCoreOverrides({});
  useMeasurementsStore.getState().setMeasurements([]);
});

describe('export payload', () => {
  it('keeps every legacy field AND adds the fields legacy export omitted', () => {
    useEntriesStore.getState().setEntries([liftSet('e1', 'Sumo Squats', 135)]);
    useNotesStore.getState().setNotes({ '2026-08-20': 'felt strong' });
    useGoalsStore.getState().setGoals({ 'Bench Press': 115 });
    useBodyweightStore.getState().setBwEntries([{ id: 'bw1', date: '2026-08-20', weight: 128.5 }]);
    useAchievementsStore.getState().setSeenAchievements(['first-set']);
    useSettingsStore.getState().setUnit('kg');
    useSettingsStore.getState().setEquipmentWeights({ trapBar: 55, legPressSled: 0 });
    useCustomExercisesStore.getState().setCustomExercises({
      'Lower A': [
        {
          name: 'Bulgarian Split Squat',
          targetSets: 3,
          targetReps: '8-12',
          prefillReps: 8,
          goal: 50,
          custom: true,
          notes: null,
          archived: true,
        },
      ],
    });
    useCustomExercisesStore.getState().setExcludedBuiltIns({ 'Lower A': ['Sumo Squats'] });
    useCoreOverridesStore.getState().setCoreOverrides({ Plank: { name: 'RKC Plank', target: '3 x 15-20 sec' } });
    useMeasurementsStore.getState().setMeasurements([{ id: 'm1', date: '2026-08-20', waist: 29.5, hips: null }]);

    const payload = buildBackupPayload();

    // Legacy fields, exact names
    expect(payload.entries).toEqual([liftSet('e1', 'Sumo Squats', 135)]);
    expect(payload.notes).toEqual({ '2026-08-20': 'felt strong' });
    expect(payload.customGoals).toEqual({ 'Bench Press': 115 });
    expect(payload.bwEntries).toEqual([{ id: 'bw1', date: '2026-08-20', weight: 128.5 }]);
    expect(payload.seenAchievements).toEqual(['first-set']);
    expect(payload.unitPref).toBe('kg');
    expect(new Date(payload.exportedAt).getTime()).not.toBeNaN();
    // New completeness fields
    expect(payload.customExercises?.['Lower A']?.[0]?.name).toBe('Bulgarian Split Squat');
    expect(payload.excludedBuiltIns).toEqual({ 'Lower A': ['Sumo Squats'] });
    expect(payload.coreOverrides).toEqual({ Plank: { name: 'RKC Plank', target: '3 x 15-20 sec' } });
    expect(payload.measurements).toEqual([{ id: 'm1', date: '2026-08-20', waist: 29.5, hips: null }]);
    expect(payload.equipmentWeights).toEqual({ trapBar: 55, legPressSled: 0 });
    // No auto-backup reason on manual exports
    expect(payload).not.toHaveProperty('reason');
  });

  it('names the file gymlog-backup-YYYY-MM-DD.json (local date)', () => {
    expect(backupFilename(new Date(2026, 7, 28))).toBe('gymlog-backup-2026-08-28.json');
    expect(backupFilename(new Date(2026, 0, 5))).toBe('gymlog-backup-2026-01-05.json');
  });
});

describe('parseBackup', () => {
  it('rejects non-JSON and non-object payloads', () => {
    expect(() => parseBackup('not json at all')).toThrow();
    expect(() => parseBackup('"just a string"')).toThrow();
    expect(() => parseBackup('null')).toThrow();
    expect(() => parseBackup('[1,2,3]')).toThrow();
  });

  it('accepts a JSON object', () => {
    expect(parseBackup('{"entries":[]}')).toEqual({ entries: [] });
  });
});

describe('the "would lose N sets" gate', () => {
  it('counts current entries whose ids the file lacks', () => {
    const current: Entry[] = [liftSet('a', 'Rows', 90), liftSet('b', 'Rows', 95)];
    expect(countMissingSets(current, [liftSet('a', 'Rows', 90)])).toBe(1);
    expect(countMissingSets(current, current)).toBe(0);
    expect(countMissingSets([], [liftSet('a', 'Rows', 90)])).toBe(0);
  });

  it('analyzeImport reads the live entries store and tolerates files without entries', () => {
    useEntriesStore.getState().setEntries([liftSet('a', 'Rows', 90)]);
    expect(analyzeImport({})).toBe(1); // old/partial file: everything local is "missing"
    expect(analyzeImport({ entries: [liftSet('a', 'Rows', 90)] })).toBe(0);
  });
});

describe('applyImport — OLD backup shape (legacy fields only)', () => {
  it('merges by id (incoming wins), spreads notes/goals, unions achievements, applies unit', () => {
    useEntriesStore.getState().setEntries([liftSet('e1', 'Sumo Squats', 100), liftSet('e2', 'Rows', 90)]);
    useNotesStore.getState().setNotes({ '2026-08-01': 'local note', '2026-08-02': 'kept' });
    useGoalsStore.getState().setGoals({ Rows: 90 });
    useBodyweightStore.getState().setBwEntries([{ id: 'bw1', date: '2026-08-01', weight: 130 }]);
    useAchievementsStore.getState().setSeenAchievements(['first-set']);
    useCustomExercisesStore.getState().setCustomExercises({ Upper: [] });

    applyImport({
      entries: [liftSet('e1', 'Sumo Squats', 135), liftSet('e3', 'Deadlifts', 200)],
      notes: { '2026-08-01': 'imported note', '2026-08-03': 'new' },
      customGoals: { 'Sumo Squats': 145 },
      bwEntries: [{ id: 'bw2', date: '2026-08-02', weight: 129 }],
      seenAchievements: ['first-set', 'streak-3'],
      unitPref: 'kg',
      exportedAt: '2026-08-10T12:00:00.000Z',
    });

    const entries = useEntriesStore.getState().entries as LiftSetEntry[];
    expect(entries).toHaveLength(3);
    expect(entries.find((e) => e.id === 'e1')?.weight).toBe(135); // incoming wins
    expect(entries.find((e) => e.id === 'e2')?.weight).toBe(90); // nothing deleted
    expect(entries.find((e) => e.id === 'e3')?.weight).toBe(200);

    expect(useNotesStore.getState().notes).toEqual({
      '2026-08-01': 'imported note',
      '2026-08-02': 'kept',
      '2026-08-03': 'new',
    });
    expect(useGoalsStore.getState().goals).toEqual({ Rows: 90, 'Sumo Squats': 145 });
    expect(useBodyweightStore.getState().bwEntries).toHaveLength(2);
    expect(useAchievementsStore.getState().seenAchievements.sort()).toEqual(['first-set', 'streak-3']);
    expect(useSettingsStore.getState().unit).toBe('kg');
    // Fields the old file lacks stay untouched
    expect(useCustomExercisesStore.getState().customExercises).toEqual({ Upper: [] });
    expect(useMeasurementsStore.getState().measurements).toEqual([]);
  });

  it('ignores an invalid unitPref and backfills missing entry ids', () => {
    applyImport({
      entries: [{ exercise: 'Rows', weight: 90, sets: 1, reps: 10, date: '2026-08-01' } as unknown as Entry],
      unitPref: 'stone',
    });
    expect(useSettingsStore.getState().unit).toBe('lbs');
    const entries = useEntriesStore.getState().entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBeTruthy();
  });
});

describe('applyImport — NEW backup shape (rebuild extras)', () => {
  it('merges measurements by id and spreads the map/equipment fields', () => {
    useMeasurementsStore.getState().setMeasurements([{ id: 'm1', date: '2026-08-01', waist: 30, hips: 38 }]);
    useCustomExercisesStore.getState().setCustomExercises({
      Upper: [
        { name: 'Face Pulls', targetSets: 3, targetReps: '12-15', prefillReps: 12, goal: 30, custom: true, notes: null },
      ],
    });
    useSettingsStore.getState().setEquipmentWeights({ trapBar: null, legPressSled: 90 });

    applyImport({
      entries: [],
      measurements: [
        { id: 'm1', date: '2026-08-01', waist: 29.5, hips: 38 }, // incoming wins
        { id: 'm2', date: '2026-08-15', waist: 29, hips: null },
      ],
      customExercises: {
        'Lower A': [
          { name: 'BSS', targetSets: 3, targetReps: '8-12', prefillReps: 8, goal: 50, custom: true, notes: null },
        ],
      },
      excludedBuiltIns: { 'Lower A': ['Sumo Squats'] },
      coreOverrides: { Plank: { name: 'RKC Plank', target: '3 x 15-20 sec' } },
      equipmentWeights: { trapBar: 60 }, // partial: sled key absent → local sled kept
    });

    const measurements = useMeasurementsStore.getState().measurements;
    expect(measurements).toHaveLength(2);
    expect(measurements.find((m) => m.id === 'm1')?.waist).toBe(29.5);

    const custom = useCustomExercisesStore.getState().customExercises;
    expect(custom['Upper']?.[0]?.name).toBe('Face Pulls'); // local day kept
    expect(custom['Lower A']?.[0]?.name).toBe('BSS'); // incoming day added
    expect(useCustomExercisesStore.getState().excludedBuiltIns).toEqual({ 'Lower A': ['Sumo Squats'] });
    expect(useCoreOverridesStore.getState().coreOverrides).toEqual({
      Plank: { name: 'RKC Plank', target: '3 x 15-20 sec' },
    });
    expect(useSettingsStore.getState().equipmentWeights).toEqual({ trapBar: 60, legPressSled: 90 });
  });

  it('round-trips: importing a fresh export into the same stores is a no-op merge', () => {
    useEntriesStore.getState().setEntries([liftSet('e1', 'Sumo Squats', 135)]);
    useGoalsStore.getState().setGoals({ 'Sumo Squats': 145 });
    useMeasurementsStore.getState().setMeasurements([{ id: 'm1', date: '2026-08-01', waist: 30, hips: 38 }]);

    const payload = buildBackupPayload();
    expect(analyzeImport(payload as unknown as Record<string, unknown>)).toBe(0);
    applyImport(payload as unknown as Record<string, unknown>);

    expect(useEntriesStore.getState().entries).toEqual([liftSet('e1', 'Sumo Squats', 135)]);
    expect(useGoalsStore.getState().goals).toEqual({ 'Sumo Squats': 145 });
    expect(useMeasurementsStore.getState().measurements).toEqual([
      { id: 'm1', date: '2026-08-01', waist: 30, hips: 38 },
    ]);
  });
});
