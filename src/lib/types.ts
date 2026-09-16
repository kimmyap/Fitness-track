/**
 * TypeScript types for the LEGACY localStorage data shapes.
 *
 * CRITICAL: these mirror legacy/index.html exactly. Optional fields are
 * ABSENT (property not present), never null/false — e.g. `warmupSet` is
 * either the literal `true` or the key does not exist on the object.
 */

export type Unit = 'lbs' | 'kg';

/** What the user picked in Settings. `system` is stored as ABSENCE of the theme key. */
export type ThemePref = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** A logged lift set (the common case). `weight` is the TOTAL weight in lbs (bar math already applied). */
export interface LiftSetEntry {
  id: string;
  exercise: string;
  /** Total lbs. Can be 0 for bodyweight variations. */
  weight: number;
  /** Always 1 for entries created by current code; legacy data may have >1. */
  sets: number;
  reps: number;
  /** Local date "YYYY-MM-DD". */
  date: string;
  /** Epoch ms. Absent on one-off logs and older entries (sort falls back to 0). */
  createdAt?: number;
  /** 1–10, only present if logged. */
  rpe?: number;
  /** Only present if the exercise has variations (e.g. "Barbell", "Dumbbell"). */
  variation?: string;
  /** Only present when true. Excluded from PB/1RM/volume. */
  warmupSet?: true;
  /** Only present when true. Excluded from PB/1RM/volume. */
  assistedPullup?: true;
  /**
   * NEW (not legacy). Only present when true. A back-off drop performed
   * pre-fatigued at reduced load: it IS real work, so it counts toward volume
   * and the n/N session target, but it is excluded from best-weight, est-1RM,
   * the progression suggestion and the prefill — Epley on a fatigued high-rep
   * drop produces a 1RM that never happened.
   */
  dropSet?: true;
  /**
   * NEW (not legacy). Only present when true. A set taken to failure counts
   * exactly like a normal working set everywhere, PBs included; it is a label
   * for history, not a modifier, so no domain logic reads it.
   */
  toFailure?: true;
  /**
   * NEW (not legacy). Only present when true. The reps recorded are PER SIDE —
   * 10 on a Bulgarian split squat means 10 each leg, not 10 in total.
   *
   * A LABEL, not a modifier: no domain logic reads it, exactly like
   * `toFailure`. Volume deliberately does NOT double for it. Doubling would be
   * more accurate going forward and would permanently fracture the volume
   * history, because sets logged before this field existed cannot be
   * retroactively identified as unilateral — weekly/monthly totals, volume
   * trend and the volume-threshold achievements would all step up on a units
   * change rather than on real work. Considered and deferred; see HANDOFF §12.
   */
  perSide?: true;
}

export type ActivityName = 'Pilates' | 'Volleyball';

export interface ActivityEntry {
  id: string;
  type: 'activity';
  activity: ActivityName;
  date: string;
}

export interface CompletionEntry {
  id: string;
  type: 'warmup' | 'core';
  date: string;
}

/** gymlog:entries is a heterogeneous array of all three variants. */
export type Entry = LiftSetEntry | ActivityEntry | CompletionEntry;

/** Legacy discrimination: lift entries have a truthy `exercise`; others have `type`. */
export function isLiftSet(e: Entry): e is LiftSetEntry {
  return 'exercise' in e && Boolean(e.exercise);
}
export function isActivity(e: Entry): e is ActivityEntry {
  return 'type' in e && e.type === 'activity';
}
export function isCompletion(e: Entry, kind: 'warmup' | 'core'): e is CompletionEntry {
  return 'type' in e && e.type === kind;
}

/** gymlog:bodyweight rows. `weight` in lbs. */
export interface BodyweightEntry {
  id: string;
  date: string;
  weight: number;
}

/**
 * gymlog:dailyMetrics — NEW key, keyed by local date "YYYY-MM-DD".
 *
 * Body weight is deliberately NOT here: it already lives in gymlog:bodyweight
 * and drives the Body chart. A copy in this map would be a second source of
 * truth for the same number.
 *
 * Every field is optional and ABSENT when unset, like the rest of this file —
 * a day where only sleep was recorded stores only `sleepHours`.
 */
export interface DailyMetric {
  /** kcal. */
  calories?: number;
  /** grams. */
  protein?: number;
  sleepHours?: number;
  /** Subjective 1 (wiped) to 5 (great). */
  energy?: EnergyRating;
}

export type EnergyRating = 1 | 2 | 3 | 4 | 5;
export type DailyMetricsMap = Record<string, DailyMetric>;

/**
 * gymlog:cardio — NEW key. An array, because a day can hold several sessions.
 *
 * Volleyball and Pilates are absent on purpose: they are already logged as
 * ActivityEntry rows in gymlog:entries, which is what the calendar dots and
 * the activity achievements read. Adding them here would double-count.
 */
export type CardioType = 'jog' | 'treadmill' | 'other';

export interface CardioSession {
  id: string;
  /** Local date "YYYY-MM-DD". */
  date: string;
  type: CardioType;
  minutes: number;
  /** Miles. Optional and absent when not measured — treadmills report it, a jog may not. */
  miles?: number;
}

/** gymlog:measurements rows. Inches; either may be null. */
export interface MeasurementEntry {
  id: string;
  date: string;
  waist: number | null;
  hips: number | null;
}

/** A built-in program exercise (lib/program.ts DAYS). */
export interface ProgramExercise {
  name: string;
  /** Default goal weight in lbs. */
  goal: number;
  targetSets: number;
  /** e.g. "8-12" — parseInt gives the minimum. */
  targetReps: string;
  prefillReps: number;
}

/** A user-created exercise stored in gymlog:customExercises. */
export interface CustomExercise extends ProgramExercise {
  custom: true;
  notes: string | null;
  /** Hidden but history/config kept. Optional (absent when false). */
  archived?: boolean;
}

/** Anything renderable as an exercise card. */
export type AnyExercise = ProgramExercise | CustomExercise;

export function isCustomExercise(ex: AnyExercise): ex is CustomExercise {
  return 'custom' in ex && ex.custom === true;
}

/** gymlog:coreOverrides values: the swapped-in alternative for a core slot. */
export interface CoreOverride {
  name: string;
  target: string;
}

/** gymlog:equipmentWeights. Both lbs; null = unset. legPressSled may be explicit 0. */
export interface EquipmentWeights {
  trapBar: number | null;
  legPressSled: number | null;
}

/** gymlog:notes — "YYYY-MM-DD" → note text. */
export type NotesMap = Record<string, string>;
/** gymlog:goals — exercise name → goal weight (lbs). */
export type GoalsMap = Record<string, number>;
/** gymlog:customExercises — day tab name → custom exercises. */
export type CustomExercisesMap = Record<string, CustomExercise[]>;
/** gymlog:excludedBuiltIns — day tab name → hidden built-in names. */
export type ExcludedBuiltInsMap = Record<string, string[]>;
/** gymlog:coreOverrides — original core exercise name → swap. */
export type CoreOverridesMap = Record<string, CoreOverride>;

/**
 * Export/backup file shape. The legacy exporter wrote only the first six
 * data fields; the rebuild may add the optional extras but importers must
 * accept old files that lack them.
 */
export interface BackupPayload {
  entries: Entry[];
  notes: NotesMap;
  customGoals: GoalsMap;
  bwEntries: BodyweightEntry[];
  seenAchievements: string[];
  unitPref: Unit;
  exportedAt: string;
  /** Only present in auto-backups. */
  reason?: string;
  // Fields the legacy export omitted (rebuild may include them):
  customExercises?: CustomExercisesMap;
  excludedBuiltIns?: ExcludedBuiltInsMap;
  coreOverrides?: CoreOverridesMap;
  measurements?: MeasurementEntry[];
  equipmentWeights?: EquipmentWeights;
  theme?: string;
  dailyMetrics?: DailyMetricsMap;
  cardio?: CardioSession[];
  /**
   * Your ordered workout day names. The most consequential of these: custom
   * exercises and exercise order are keyed BY DAY NAME, so a restore without
   * this leaves them pointing at days the restored program does not have.
   */
  days?: string[];
  exerciseOrder?: ExerciseOrderMap;
  weightInputModes?: WeightInputModeMap;
  /** Straight-bar weight in lbs; null = the standard bar. */
  barWeight?: number | null;
  /** ISO "YYYY-MM-DD". Drives the program-review nudge. */
  lastProgramReview?: string | null;
}

/**
 * Per-exercise weight input mode. NEW key (gymlog:weightInputModes) — not part
 * of the legacy schema. Absent = 'auto' (legacy variation-driven math).
 */
export type StoredWeightInputMode = 'total' | 'perSide';

/** gymlog:exerciseOrder — day name → ordered exercise names. NEW key. */
export type ExerciseOrderMap = Record<string, string[]>;
export type WeightInputModeMap = Record<string, StoredWeightInputMode>;

/**
 * gymlog:warmupProgress — NEW key. Which movements of TODAY's warm-up are
 * ticked off.
 *
 * A single object rather than a date-keyed map (unlike dailyMetrics), because
 * this is scratch state that expires at midnight: nothing ever reads
 * yesterday's, and a map of it would grow forever. A stored value whose `date`
 * is not today is discarded on read, so the key is self-pruning.
 *
 * `shuffles` is NOT incidental. The plan is drawn from the pools by a seed of
 * `${date}:${shuffles}`, so restoring ticks without the nonce they were made
 * against would check off movements of a different draw.
 */
export interface WarmupProgress {
  /** Local date "YYYY-MM-DD". */
  date: string;
  /** The shuffle nonce the ticked plan was drawn with. */
  shuffles: number;
  /** Ticked item keys, e.g. "cardio:Jump rope". */
  items: string[];
}
