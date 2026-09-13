/**
 * Typed accessors for every legacy localStorage key.
 *
 * The legacy app used a `window.storage` shim with prefix "gymlog_" while
 * logical keys themselves start with "gymlog:", so the ACTUAL localStorage
 * keys are double-prefixed, e.g. `gymlog_gymlog:entries`. We read/write
 * those exact keys so existing user data survives.
 *
 * Quirks preserved from legacy:
 * - `unit`, `theme`, `lastProgramReview` are RAW strings, not JSON.
 * - Every save retries with backoff (300/800/1800 ms); on final failure it
 *   auto-downloads a JSON backup (1-minute cooldown) and flags sync-failed.
 */
import {
  achievementsSchema,
  bodyweightSchema,
  cardioSessionSchema,
  coreOverridesMapSchema,
  customExerciseSchema,
  dailyMetricSchema,
  dateKeySchema,
  daysSchema,
  entrySchema,
  equipmentWeightsSchema,
  excludedBuiltInsMapSchema,
  exerciseOrderSchema,
  nameKeySchema,
  numberValueSchema,
  keepValid,
  keepValidEntries,
  measurementSchema,
  stringValueSchema,
  validOr,
  warmupProgressSchema,
  weightInputModesSchema,
} from './schemas';
import type {
  BodyweightEntry,
  CardioSession,
  CoreOverridesMap,
  CustomExercise,
  CustomExercisesMap,
  DailyMetric,
  DailyMetricsMap,
  Entry,
  EquipmentWeights,
  ExcludedBuiltInsMap,
  GoalsMap,
  MeasurementEntry,
  NotesMap,
  Unit,
  ExerciseOrderMap,
  WarmupProgress,
  WeightInputModeMap,
} from './types';

const PREFIX = 'gymlog_';

export const STORAGE_KEYS = {
  entries: 'gymlog:entries',
  notes: 'gymlog:notes',
  goals: 'gymlog:goals',
  bodyweight: 'gymlog:bodyweight',
  achievements: 'gymlog:achievements',
  unit: 'gymlog:unit',
  customExercises: 'gymlog:customExercises',
  excludedBuiltIns: 'gymlog:excludedBuiltIns',
  lastProgramReview: 'gymlog:lastProgramReview',
  coreOverrides: 'gymlog:coreOverrides',
  theme: 'gymlog:theme',
  measurements: 'gymlog:measurements',
  equipmentWeights: 'gymlog:equipmentWeights',
  /** NEW (not legacy): per-exercise weight input mode — see CLAUDE.md Plate Math. */
  weightInputModes: 'gymlog:weightInputModes',
  /** NEW: straight-bar weight in lbs (editable in Settings). */
  barWeight: 'gymlog:barWeight',
  /** NEW: per-day exercise display order. */
  exerciseOrder: 'gymlog:exerciseOrder',
  /** NEW: ordered workout day names (defaults to the legacy three). */
  days: 'gymlog:days',
  /** NEW: per-day wellness metrics, keyed "YYYY-MM-DD". Body weight is NOT here. */
  dailyMetrics: 'gymlog:dailyMetrics',
  /** NEW: cardio sessions. Volleyball/Pilates stay ActivityEntry rows in `entries`. */
  cardio: 'gymlog:cardio',
  /**
   * NEW: today's ticked warm-up movements. Scratch state, deliberately absent
   * from both backup payloads — see getWarmupProgress.
   */
  warmupProgress: 'gymlog:warmupProgress',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/** The actual localStorage key (double-prefixed), e.g. "gymlog_gymlog:entries". */
export function fullKey(key: StorageKey): string {
  return PREFIX + key;
}

// ---------------------------------------------------------------------------
// Save status (for the "Saved Xs ago" indicator + sync-warning banner)
// ---------------------------------------------------------------------------

export interface SaveStatus {
  lastSavedAt: Date | null;
  pendingSyncFailed: boolean;
}

let saveStatus: SaveStatus = { lastSavedAt: null, pendingSyncFailed: false };
const saveStatusListeners = new Set<(s: SaveStatus) => void>();

function setSaveStatus(patch: Partial<SaveStatus>): void {
  saveStatus = { ...saveStatus, ...patch };
  saveStatusListeners.forEach((fn) => fn(saveStatus));
}

export function getSaveStatus(): SaveStatus {
  return saveStatus;
}

export function subscribeSaveStatus(fn: (s: SaveStatus) => void): () => void {
  saveStatusListeners.add(fn);
  return () => saveStatusListeners.delete(fn);
}

/** Dismiss the sync-warning banner. */
export function clearSyncFailedFlag(): void {
  setSaveStatus({ pendingSyncFailed: false });
}

// ---------------------------------------------------------------------------
// Raw get/set with retry + auto-backup
// ---------------------------------------------------------------------------

function getRaw(key: StorageKey): string | null {
  try {
    return localStorage.getItem(fullKey(key));
  } catch {
    return null;
  }
}

function getJSON<T>(key: StorageKey, fallback: T): T {
  const raw = getRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Parsed JSON with no shape assumption yet. */
function getParsed(key: StorageKey): unknown {
  const raw = getRaw(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Whole-value read that falls back when the stored shape is wrong, rather than
 * casting and letting the mismatch surface as a crash somewhere else.
 */
function getChecked<T>(key: StorageKey, schema: Parameters<typeof validOr>[1], fallback: T): T {
  const parsed = getParsed(key);
  if (parsed === undefined) return fallback;
  return validOr<T>(parsed, schema, fallback, key);
}

const delay = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

/** Legacy retry backoff schedule (ms). */
export const SAVE_RETRY_DELAYS = [300, 800, 1800] as const;

/**
 * Set a key with legacy retry semantics. Resolves true on success; on final
 * failure triggers an automatic backup download and resolves false.
 */
export async function setRawWithRetry(key: StorageKey, value: string, label: string): Promise<boolean> {
  for (let attempt = 0; attempt <= SAVE_RETRY_DELAYS.length; attempt++) {
    try {
      localStorage.setItem(fullKey(key), value);
      setSaveStatus({ lastSavedAt: new Date() });
      return true;
    } catch (e) {
      if (attempt < SAVE_RETRY_DELAYS.length) {
        await delay(SAVE_RETRY_DELAYS[attempt] as number);
      } else {
        console.error(`${label} save failed after retries`, e);
        triggerAutoBackup(label, key, value);
        return false;
      }
    }
  }
  return false;
}

async function deleteRaw(key: StorageKey): Promise<void> {
  try {
    localStorage.removeItem(fullKey(key));
  } catch {
    // ignore — nothing sensible to do if even removal fails
  }
}

// ---------------------------------------------------------------------------
// Auto-backup on save failure (1-minute cooldown, matches legacy)
// ---------------------------------------------------------------------------

export const AUTO_BACKUP_COOLDOWN_MS = 60000;
let autoBackupCooldown = false;

function isoDateLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Build the legacy auto-backup payload from storage, substituting the value
 * that just failed to persist so the backup contains the newest data.
 */
function buildBackupPayload(label: string, failedKey?: StorageKey, failedValue?: string) {
  const readJSON = <T>(key: StorageKey, fallback: T): T => {
    if (failedKey === key && failedValue !== undefined) {
      try {
        return JSON.parse(failedValue) as T;
      } catch {
        return fallback;
      }
    }
    return getJSON(key, fallback);
  };
  const unitPref: Unit =
    failedKey === STORAGE_KEYS.unit && (failedValue === 'lbs' || failedValue === 'kg')
      ? failedValue
      : getUnit();
  return {
    entries: readJSON<Entry[]>(STORAGE_KEYS.entries, []),
    notes: readJSON<NotesMap>(STORAGE_KEYS.notes, {}),
    customGoals: readJSON<GoalsMap>(STORAGE_KEYS.goals, {}),
    bwEntries: readJSON<BodyweightEntry[]>(STORAGE_KEYS.bodyweight, []),
    seenAchievements: readJSON<string[]>(STORAGE_KEYS.achievements, []),
    // New keys must be listed here too, or an emergency backup silently omits them.
    dailyMetrics: readJSON<DailyMetricsMap>(STORAGE_KEYS.dailyMetrics, {}),
    cardio: readJSON<CardioSession[]>(STORAGE_KEYS.cardio, []),
    // `warmupProgress` is the ONE key deliberately left out, here and in
    // src/features/more/backup.ts. It is today's tick marks: it expires at
    // midnight and means nothing on another device. Its absence is a choice,
    // not the omission this comment warns about.
    unitPref,
    exportedAt: new Date().toISOString(),
    reason: `auto-backup after ${label} save failure`,
  };
}

function triggerAutoBackup(label: string, failedKey?: StorageKey, failedValue?: string): void {
  setSaveStatus({ pendingSyncFailed: true });
  if (autoBackupCooldown) return;
  autoBackupCooldown = true;
  setTimeout(() => {
    autoBackupCooldown = false;
  }, AUTO_BACKUP_COOLDOWN_MS);
  try {
    const payload = buildBackupPayload(label, failedKey, failedValue);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gymlog-autobackup-${isoDateLocal(new Date())}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Auto-backup also failed', e);
  }
}

// ---------------------------------------------------------------------------
// Typed accessors, one pair per legacy key
// ---------------------------------------------------------------------------

function generateIdInternal(): string {
  return Math.random().toString(36).slice(2) + Date.now();
}

/**
 * Read the main log. Backfills missing `id`s (very old data) and re-saves,
 * matching legacy loadData migration.
 */
export function getEntries(): Entry[] {
  const parsed = getParsed(STORAGE_KEYS.entries);
  if (parsed === undefined) return [];
  const { rows: entries, dropped } = keepValid<Entry>(parsed, entrySchema, STORAGE_KEYS.entries);

  let needsSave = false;
  entries.forEach((e) => {
    if (!e.id) {
      e.id = generateIdInternal();
      needsSave = true;
    }
  });
  /*
   * Only re-save when nothing was dropped. The backfill would otherwise write
   * the FILTERED array back over the user's log, turning a read-time warning
   * about one bad row into permanent data loss.
   */
  if (needsSave && dropped === 0) void saveEntries(entries);
  return entries;
}
export function saveEntries(entries: Entry[]): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.entries, JSON.stringify(entries), 'Workout log');
}

/** Per-date notes are the user's own writing — drop a bad row, never the lot. */
export function getNotes(): NotesMap {
  return keepValidEntries<string>(
    getParsed(STORAGE_KEYS.notes) ?? {},
    dateKeySchema,
    stringValueSchema,
    STORAGE_KEYS.notes,
  );
}
export function saveNotes(notes: NotesMap): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.notes, JSON.stringify(notes), 'Notes');
}

/** Keyed by exercise name, not date. One bad goal must not clear the rest. */
export function getGoals(): GoalsMap {
  return keepValidEntries<number>(
    getParsed(STORAGE_KEYS.goals) ?? {},
    nameKeySchema,
    numberValueSchema,
    STORAGE_KEYS.goals,
  );
}
export function saveGoals(goals: GoalsMap): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.goals, JSON.stringify(goals), 'Goals');
}

export function getBarWeight(): number | null {
  const raw = getRaw(STORAGE_KEYS.barWeight);
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function saveBarWeight(lbs: number | null): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.barWeight, lbs === null ? '' : String(lbs), 'Bar weight');
}

export function getExerciseOrder(): ExerciseOrderMap {
  return getChecked<ExerciseOrderMap>(STORAGE_KEYS.exerciseOrder, exerciseOrderSchema, {});
}
export function saveExerciseOrder(order: ExerciseOrderMap): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.exerciseOrder, JSON.stringify(order), 'Exercise order');
}

export function getDays(): string[] {
  const stored = getChecked<string[]>(STORAGE_KEYS.days, daysSchema, []);
  return Array.isArray(stored) && stored.length ? stored : [];
}
export function saveDays(days: string[]): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.days, JSON.stringify(days), 'Workout days');
}

export function getWeightInputModes(): WeightInputModeMap {
  return getChecked<WeightInputModeMap>(STORAGE_KEYS.weightInputModes, weightInputModesSchema, {});
}
export function saveWeightInputModes(modes: WeightInputModeMap): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.weightInputModes, JSON.stringify(modes), 'Weight input mode');
}

export function getBodyweight(): BodyweightEntry[] {
  return keepValid<BodyweightEntry>(getParsed(STORAGE_KEYS.bodyweight) ?? [], bodyweightSchema, STORAGE_KEYS.bodyweight).rows;
}
export function saveBodyweight(entries: BodyweightEntry[]): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.bodyweight, JSON.stringify(entries), 'Bodyweight');
}

/** Drops only the days that fail — this map is a history, not config. */
export function getDailyMetrics(): DailyMetricsMap {
  return keepValidEntries<DailyMetric>(
    getParsed(STORAGE_KEYS.dailyMetrics) ?? {},
    dateKeySchema,
    dailyMetricSchema,
    STORAGE_KEYS.dailyMetrics,
  );
}
export function saveDailyMetrics(map: DailyMetricsMap): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.dailyMetrics, JSON.stringify(map), 'Daily metrics');
}

/** Rows missing an id are backfilled in memory; nothing is written back on read. */
export function getCardioSessions(): CardioSession[] {
  const { rows } = keepValid<CardioSession>(
    getParsed(STORAGE_KEYS.cardio) ?? [],
    cardioSessionSchema,
    STORAGE_KEYS.cardio,
  );
  return rows.map((r) => (r.id ? r : { ...r, id: generateIdInternal() }));
}
export function saveCardioSessions(sessions: CardioSession[]): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.cardio, JSON.stringify(sessions), 'Cardio');
}

/**
 * Today's ticked warm-up movements, or null when there are none to restore.
 *
 * Returns null for a value stored on ANY other date: the plan is redrawn each
 * day, so yesterday's ticks describe movements that are no longer on screen.
 * That check is also what keeps the key from growing — it is one object, and a
 * stale one is replaced by the next write rather than accumulating.
 *
 * Reading never writes: a stale value stays on disk until the next tick
 * replaces it, per the repo-wide invariant.
 *
 * NOT in buildBackupPayload, and NOT in src/features/more/backup.ts. That is
 * deliberate and is the one exception to "a new key goes in both payloads":
 * restoring a half-ticked warm-up from another day onto another device is
 * meaningless, and it would bloat every export with state that expires at
 * midnight.
 */
export function getWarmupProgress(todayIso: string): WarmupProgress | null {
  const stored = getChecked<WarmupProgress | null>(STORAGE_KEYS.warmupProgress, warmupProgressSchema, null);
  if (!stored || stored.date !== todayIso) return null;
  return stored;
}

export function saveWarmupProgress(progress: WarmupProgress): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.warmupProgress, JSON.stringify(progress), 'Warm-up progress');
}

export function getSeenAchievements(): string[] {
  return getChecked<string[]>(STORAGE_KEYS.achievements, achievementsSchema, []);
}
export function saveSeenAchievements(ids: string[]): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.achievements, JSON.stringify(ids), 'Achievements');
}

/** RAW string key: "lbs" | "kg" (default "lbs"). NOT JSON. */
export function getUnit(): Unit {
  const raw = getRaw(STORAGE_KEYS.unit);
  return raw === 'kg' ? 'kg' : 'lbs';
}
export function saveUnit(unit: Unit): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.unit, unit, 'Unit preference');
}

/**
 * Drops only the exercises that fail, per day — never the whole library.
 *
 * This used to be a whole-map `getChecked`, so a single unreadable exercise
 * anywhere made every custom exercise on every day vanish, and the Settings
 * section that would let you restore one disappeared with them (it only
 * renders when non-empty). Config-shaped maps can fall back to their default;
 * a map of the user's own content cannot.
 */
export function getCustomExercises(): CustomExercisesMap {
  const parsed = getParsed(STORAGE_KEYS.customExercises);
  if (parsed === undefined) return {};
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    console.warn(`${STORAGE_KEYS.customExercises}: expected an object — ignoring it.`);
    return {};
  }
  const out: CustomExercisesMap = {};
  for (const [day, list] of Object.entries(parsed)) {
    const { rows } = keepValid<CustomExercise>(
      list,
      customExerciseSchema,
      `${STORAGE_KEYS.customExercises}[${day}]`,
    );
    if (rows.length) out[day] = rows;
  }
  return out;
}
export function saveCustomExercises(map: CustomExercisesMap): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.customExercises, JSON.stringify(map), 'Custom exercises');
}

export function getExcludedBuiltIns(): ExcludedBuiltInsMap {
  return getChecked<ExcludedBuiltInsMap>(STORAGE_KEYS.excludedBuiltIns, excludedBuiltInsMapSchema, {});
}
export function saveExcludedBuiltIns(map: ExcludedBuiltInsMap): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.excludedBuiltIns, JSON.stringify(map), 'Replaced exercises');
}

/** RAW string key: ISO date "YYYY-MM-DD" or null when unset. NOT JSON. */
export function getLastProgramReview(): string | null {
  return getRaw(STORAGE_KEYS.lastProgramReview);
}
export function saveLastProgramReview(isoDate: string): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.lastProgramReview, isoDate, 'Program review');
}

export function getCoreOverrides(): CoreOverridesMap {
  return getChecked<CoreOverridesMap>(STORAGE_KEYS.coreOverrides, coreOverridesMapSchema, {});
}
export function saveCoreOverrides(map: CoreOverridesMap): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.coreOverrides, JSON.stringify(map), 'Core exercises');
}

/**
 * RAW string key: "dark" | "light", or null when unset. NOT JSON.
 * Legacy resolves darkMode as (value === "dark"); anything else is light.
 * The rebuild's `system` preference is stored as ABSENCE of this key.
 */
export function getThemeRaw(): string | null {
  return getRaw(STORAGE_KEYS.theme);
}
export function saveTheme(theme: 'dark' | 'light'): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.theme, theme, 'Theme');
}
export function clearTheme(): Promise<void> {
  return deleteRaw(STORAGE_KEYS.theme);
}

export function getMeasurements(): MeasurementEntry[] {
  return keepValid<MeasurementEntry>(getParsed(STORAGE_KEYS.measurements) ?? [], measurementSchema, STORAGE_KEYS.measurements).rows;
}
export function saveMeasurements(entries: MeasurementEntry[]): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.measurements, JSON.stringify(entries), 'Measurements');
}

export function getEquipmentWeights(): EquipmentWeights {
  return getChecked<EquipmentWeights>(STORAGE_KEYS.equipmentWeights, equipmentWeightsSchema, { trapBar: null, legPressSled: null });
}
export function saveEquipmentWeights(w: EquipmentWeights): Promise<boolean> {
  return setRawWithRetry(STORAGE_KEYS.equipmentWeights, JSON.stringify(w), 'Equipment weights');
}
