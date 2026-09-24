/**
 * Export / import backup logic (More → Data).
 *
 * Export writes the LEGACY payload fields exactly (entries, notes,
 * customGoals, bwEntries, seenAchievements, unitPref, exportedAt) so old
 * tooling keeps working, PLUS the fields the legacy exporter forgot
 * (customExercises, excludedBuiltIns, coreOverrides, measurements,
 * equipmentWeights) so new backups are complete.
 *
 * Import accepts BOTH shapes: old files simply lack the new fields. Legacy
 * merge semantics are preserved verbatim:
 * - entries / bwEntries / measurements merge BY ID (incoming wins, nothing
 *   is ever deleted), missing ids are backfilled after the merge
 * - notes / customGoals object-spread (incoming wins per key)
 * - seenAchievements union
 * - unitPref applied only when it is exactly "lbs" or "kg"
 */
import {
  useAchievementsStore,
  useBodyweightStore,
  useCoreOverridesStore,
  useCustomExercisesStore,
  useEntriesStore,
  useGoalsStore,
  useMeasurementsStore,
  useMetricsStore,
  useNotesStore,
  useProgramStore,
  useSettingsStore,
  useWeightModesStore,
  useMuscleMapStore,
} from '@/stores';
import { generateId, isoDate, mergeById } from '@/lib/domain';
import { saveLastBackupAt } from '@/lib/storage';
import type {
  BackupPayload,
  BodyweightEntry,
  CardioSession,
  CoreOverridesMap,
  DailyMetricsMap,
  CustomExercisesMap,
  Entry,
  EquipmentWeights,
  ExcludedBuiltInsMap,
  GoalsMap,
  ExerciseOrderMap,
  MeasurementEntry,
  NotesMap,
  ThemePref,
  MuscleMap,
  WeightInputModeMap,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/** Snapshot every store into the backup payload (legacy fields + new extras). */
export function buildBackupPayload(): BackupPayload {
  return {
    // Legacy export fields — names and shapes preserved exactly.
    entries: useEntriesStore.getState().entries,
    notes: useNotesStore.getState().notes,
    customGoals: useGoalsStore.getState().goals,
    bwEntries: useBodyweightStore.getState().bwEntries,
    seenAchievements: useAchievementsStore.getState().seenAchievements,
    unitPref: useSettingsStore.getState().unit,
    exportedAt: new Date().toISOString(),
    // New in the rebuild — the legacy exporter omitted these. Old importers
    // ignore them; ours reads them back.
    customExercises: useCustomExercisesStore.getState().customExercises,
    excludedBuiltIns: useCustomExercisesStore.getState().excludedBuiltIns,
    coreOverrides: useCoreOverridesStore.getState().coreOverrides,
    measurements: useMeasurementsStore.getState().measurements,
    equipmentWeights: useSettingsStore.getState().equipmentWeights,
    dailyMetrics: useMetricsStore.getState().dailyMetrics,
    cardio: useMetricsStore.getState().cardio,
    // Program structure. `days` matters most: customExercises and
    // exerciseOrder are keyed BY DAY NAME, so exporting those without the day
    // list produced a file that restored exercises onto days that did not exist.
    days: useProgramStore.getState().days,
    exerciseOrder: useProgramStore.getState().order,
    weightInputModes: useWeightModesStore.getState().modes,
    muscleMap: useMuscleMapStore.getState().muscleMap,
    barWeight: useSettingsStore.getState().barWeightLbs,
    theme: themeRawFromPref(useSettingsStore.getState().themePref),
    lastProgramReview: useSettingsStore.getState().lastProgramReview,
    // `gymlog:warmupProgress` is deliberately NOT exported. It holds today's
    // warm-up tick marks, which expire at midnight and describe a plan drawn
    // for one device on one day. See getWarmupProgress in src/lib/storage.ts.
  };
}

/** `system` is stored as ABSENCE of the theme key, so it exports as absent too. */
function themeRawFromPref(pref: ThemePref): string | undefined {
  return pref === 'system' ? undefined : pref;
}

/** Legacy filename: gymlog-backup-YYYY-MM-DD.json (local date). */
export function backupFilename(now: Date = new Date()): string {
  return `gymlog-backup-${isoDate(now)}.json`;
}

/**
 * Build + download the backup JSON (legacy anchor-click dance), and record the
 * day so the staleness nudge has something to count from.
 *
 * The date is recorded for a download that was STARTED, which is the most this
 * can honestly know: the browser owns the save dialog from here, and nothing
 * reports back whether the file was written or the sheet was dismissed. The
 * nudge therefore measures "last time you asked for a backup", and a cancelled
 * save silences it for a fortnight. The alternative — never recording, so the
 * warning never clears — makes the feature noise you learn to ignore, which is
 * worse. Called for its side effect only; the write is fire-and-forget because
 * a failed write leaves the nudge showing, which is the safe direction.
 */
export function downloadBackup(): void {
  const payload = buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  void saveLastBackupAt(isoDate());
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/** A parsed-but-unvalidated backup file (old or new shape). */
export type IncomingBackup = Record<string, unknown>;

/** Parse a backup file's text. Throws when it isn't a JSON object (legacy check). */
export function parseBackup(text: string): IncomingBackup {
  const payload: unknown = JSON.parse(text);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid file');
  return payload as IncomingBackup;
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asObject<T extends object>(v: unknown): T | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as T) : null;
}

/**
 * Legacy "would lose N sets" gate: how many entries you have NOW whose ids
 * are missing from the file. (The merge never deletes anything — the warning
 * just tells you the file is older/partial.)
 */
export function countMissingSets(current: Entry[], incoming: Entry[]): number {
  const incomingIds = new Set(incoming.map((e) => e.id));
  return current.filter((e) => !incomingIds.has(e.id)).length;
}

/** countMissingSets against the live entries store. */
export function analyzeImport(payload: IncomingBackup): number {
  return countMissingSets(useEntriesStore.getState().entries, asArray<Entry>(payload.entries));
}

/** Merge a backup payload into every store (legacy semantics — see module doc). */
export function applyImport(payload: IncomingBackup): void {
  // entries: merge by id, incoming wins; backfill missing ids afterwards
  const entriesStore = useEntriesStore.getState();
  const mergedEntries = mergeById(entriesStore.entries, asArray<Entry>(payload.entries));
  mergedEntries.forEach((e) => {
    if (!e.id) e.id = generateId();
  });
  entriesStore.setEntries(mergedEntries);

  // bodyweight: same merge-by-id + id backfill
  const bwStore = useBodyweightStore.getState();
  const mergedBw = mergeById(bwStore.bwEntries, asArray<BodyweightEntry>(payload.bwEntries));
  mergedBw.forEach((e) => {
    if (!e.id) e.id = generateId();
  });
  bwStore.setBwEntries(mergedBw);

  // notes / goals: object-spread, incoming wins per key
  const notes = asObject<NotesMap>(payload.notes);
  if (notes) {
    const notesStore = useNotesStore.getState();
    notesStore.setNotes({ ...notesStore.notes, ...notes });
  }
  const goals = asObject<GoalsMap>(payload.customGoals);
  if (goals) {
    const goalsStore = useGoalsStore.getState();
    goalsStore.setGoals({ ...goalsStore.goals, ...goals });
  }

  // achievements: union
  if (Array.isArray(payload.seenAchievements)) {
    useAchievementsStore.getState().mergeSeen(payload.seenAchievements as string[]);
  }

  // unit: only when valid (legacy check)
  if (payload.unitPref === 'lbs' || payload.unitPref === 'kg') {
    useSettingsStore.getState().setUnit(payload.unitPref);
  }

  // --- Fields absent from OLD backups (each merged only when present) ---

  const customExercises = asObject<CustomExercisesMap>(payload.customExercises);
  if (customExercises) {
    const store = useCustomExercisesStore.getState();
    store.setCustomExercises({ ...store.customExercises, ...customExercises });
  }
  const excludedBuiltIns = asObject<ExcludedBuiltInsMap>(payload.excludedBuiltIns);
  if (excludedBuiltIns) {
    const store = useCustomExercisesStore.getState();
    store.setExcludedBuiltIns({ ...store.excludedBuiltIns, ...excludedBuiltIns });
  }
  const coreOverrides = asObject<CoreOverridesMap>(payload.coreOverrides);
  if (coreOverrides) {
    const store = useCoreOverridesStore.getState();
    store.setCoreOverrides({ ...store.coreOverrides, ...coreOverrides });
  }
  if (Array.isArray(payload.measurements)) {
    const store = useMeasurementsStore.getState();
    const merged = mergeById(store.measurements, payload.measurements as MeasurementEntry[]);
    merged.forEach((e) => {
      if (!e.id) e.id = generateId();
    });
    store.setMeasurements(merged);
  }
  // daily metrics: spread per DATE key, incoming wins — same as notes/goals
  const dailyMetrics = asObject<DailyMetricsMap>(payload.dailyMetrics);
  if (dailyMetrics) {
    const store = useMetricsStore.getState();
    store.setDailyMetrics({ ...store.dailyMetrics, ...dailyMetrics });
  }
  // cardio: merge by id + backfill, same as entries/bodyweight/measurements
  if (Array.isArray(payload.cardio)) {
    const store = useMetricsStore.getState();
    const merged = mergeById(store.cardio, payload.cardio as CardioSession[]);
    merged.forEach((c) => {
      if (!c.id) c.id = generateId();
    });
    store.setCardio(merged);
  }

  const equipment = asObject<Partial<EquipmentWeights>>(payload.equipmentWeights);
  if (equipment) {
    const settings = useSettingsStore.getState();
    settings.setEquipmentWeights({
      trapBar: 'trapBar' in equipment ? (equipment.trapBar ?? null) : settings.equipmentWeights.trapBar,
      legPressSled:
        'legPressSled' in equipment ? (equipment.legPressSled ?? null) : settings.equipmentWeights.legPressSled,
    });
  }

  /*
   * days: UNION, local order first, then imported days you do not already
   * have. Not replace — this module's contract is that a merge never deletes
   * anything, and a day carries custom exercises and card order keyed by its
   * NAME. A file listing fewer days than you have must not take yours away.
   * You may end up with days from both and delete some in Settings; that is
   * recoverable, losing a day is not.
   */
  if (Array.isArray(payload.days)) {
    const program = useProgramStore.getState();
    const incoming = (payload.days as unknown[]).filter((d): d is string => typeof d === 'string' && d.length > 0);
    const merged = [...program.days, ...incoming.filter((d) => !program.days.includes(d))];
    if (merged.length !== program.days.length) program.setDays(merged);
  }
  // exercise order / weight input modes: spread per key, incoming wins
  const order = asObject<ExerciseOrderMap>(payload.exerciseOrder);
  if (order) {
    const program = useProgramStore.getState();
    program.setOrder({ ...program.order, ...order });
  }
  const modes = asObject<WeightInputModeMap>(payload.weightInputModes);
  if (modes) {
    const store = useWeightModesStore.getState();
    store.setModes({ ...store.modes, ...modes });
  }
  /*
   * Muscle mappings merge the same way, incoming winning per exercise. Bad
   * pairs are dropped at the READ boundary by `getMuscleMap`, not here, so an
   * imported file with one junk value cannot take the rest of the map with it.
   */
  const muscles = asObject<MuscleMap>(payload.muscleMap);
  if (muscles) {
    const store = useMuscleMapStore.getState();
    store.setMuscleMap({ ...store.muscleMap, ...muscles });
  }
  // barWeight: a number sets it, an explicit null clears it back to the standard bar
  if (typeof payload.barWeight === 'number' && Number.isFinite(payload.barWeight)) {
    useSettingsStore.getState().setBarWeight(payload.barWeight);
  } else if (payload.barWeight === null) {
    useSettingsStore.getState().setBarWeight(null);
  }
  // theme: only the two real values. `system` is ABSENCE of the key, so a file
  // without a theme leaves yours alone rather than forcing you to system.
  if (payload.theme === 'light' || payload.theme === 'dark') {
    useSettingsStore.getState().setThemePref(payload.theme);
  }
  /*
   * lastProgramReview: backfill only. It refuses to overwrite an existing
   * value by design, which is what we want — restoring a file should not move
   * a review clock you are already running.
   */
  if (typeof payload.lastProgramReview === 'string' && payload.lastProgramReview) {
    useSettingsStore.getState().backfillProgramReview(payload.lastProgramReview);
  }
}
