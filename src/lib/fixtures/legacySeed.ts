/**
 * A legacy-shaped localStorage dataset, as a pre-v2 user's browser would hold it.
 *
 * Three commits cite "verified in the browser against seeded legacy-shaped data"
 * as their evidence, but the seed itself was never committed — so nobody could
 * reproduce that verification. This is that seed.
 *
 * Two rules make it worth trusting:
 *
 * 1. It contains ONLY the 13 legacy keys. The four keys the rebuild added
 *    (weightInputModes, barWeight, exerciseOrder, days) are deliberately absent,
 *    because a real migrating user has never written them. Seeding them would
 *    hide exactly the bug this fixture exists to catch.
 * 2. It is typed against the real `types.ts`, so a schema change breaks the
 *    build here rather than silently rotting.
 *
 * Dates are fixed, not relative to today, so tests are deterministic. The
 * consequence is that streak-style "recent activity" reads as cold after
 * seeding — history, calendar, charts, PRs and goals all populate normally.
 */
import type {
  BodyweightEntry,
  CoreOverridesMap,
  CustomExercisesMap,
  Entry,
  EquipmentWeights,
  ExcludedBuiltInsMap,
  GoalsMap,
  MeasurementEntry,
  NotesMap,
  Unit,
} from '../types';

/**
 * Heterogeneous by design: lift sets, an activity, and warm-up/core completions
 * share one array, discriminated by `exercise` being truthy vs `type`.
 *
 * Optional fields are ABSENT, never null — `warmupSet` only appears when true,
 * `rpe` only when logged, `createdAt` only when the legacy code recorded it.
 */
export const LEGACY_ENTRIES: Entry[] = [
  {
    id: 'k3j2h1g9f81724567890123',
    exercise: 'Sumo Squats',
    weight: 135,
    sets: 1,
    reps: 10,
    date: '2026-08-24',
    createdAt: 1756036800000,
    rpe: 8,
    variation: 'Barbell',
  },
  // Warm-up set: flagged, and excluded from PB/1RM/volume.
  {
    id: 'p9q8r7s6t51724567890124',
    exercise: 'Sumo Squats',
    weight: 45,
    sets: 1,
    reps: 10,
    date: '2026-08-24',
    createdAt: 1756036500000,
    variation: 'Barbell',
    warmupSet: true,
  },
  // No `rpe`, no `variation` — both keys simply do not exist on this object.
  {
    id: 'a1b2c3d4e51724567890125',
    exercise: 'Deadlifts',
    weight: 185,
    sets: 1,
    reps: 6,
    date: '2026-08-24',
    createdAt: 1756037400000,
  },
  // Legacy multi-set row: current code always writes sets: 1, older data did not.
  {
    id: 'f6g7h8i9j01724567890126',
    exercise: 'Hip Thrust',
    weight: 175,
    sets: 3,
    reps: 12,
    date: '2026-08-24',
    createdAt: 1756038000000,
    rpe: 7,
  },
  // weight: 0 is a real bodyweight log, not missing data.
  {
    id: 'k1l2m3n4o51724567890127',
    exercise: 'Leg Press / Lunges',
    weight: 0,
    sets: 1,
    reps: 15,
    date: '2026-08-26',
    createdAt: 1756209600000,
    variation: 'Bodyweight Lunges',
  },
  // Assisted pull-up: excluded from PB/1RM/volume like a warm-up.
  {
    id: 'q6r7s8t9u01724567890128',
    exercise: 'Lat Pulldown',
    weight: 60,
    sets: 1,
    reps: 8,
    date: '2026-08-26',
    createdAt: 1756210200000,
    variation: 'Assisted Pull-up',
    assistedPullup: true,
  },
  {
    id: 'v1w2x3y4z51724567890129',
    exercise: 'Bench Press',
    weight: 105,
    sets: 1,
    reps: 8,
    date: '2026-08-26',
    createdAt: 1756210800000,
    rpe: 9,
    variation: 'Barbell',
  },
  // A custom (non-built-in) exercise, proving custom names round-trip.
  {
    id: 'b2c3d4e5f61724567890130',
    exercise: 'Bulgarian Split Squat',
    weight: 40,
    sets: 1,
    reps: 10,
    date: '2026-08-28',
    createdAt: 1756382400000,
    rpe: 8,
  },
  { id: 'g7h8i9j0k11724567890131', type: 'activity', activity: 'Pilates', date: '2026-08-25' },
  { id: 'l2m3n4o5p61724567890132', type: 'activity', activity: 'Volleyball', date: '2026-08-27' },
  { id: 'q7r8s9t0u11724567890133', type: 'warmup', date: '2026-08-24' },
  { id: 'v2w3x4y5z61724567890134', type: 'core', date: '2026-08-26' },
  /*
   * Pre-id data. `id` was added later, and `getEntries()` backfills it on read
   * then re-saves — a migration path with no other test coverage. The cast is
   * the point: this object is deliberately invalid against today's type.
   */
  {
    exercise: 'Rows',
    weight: 80,
    sets: 1,
    reps: 12,
    date: '2026-08-20',
  } as unknown as Entry,
];

export const LEGACY_NOTES: NotesMap = {
  '2026-08-24': 'Slept badly, squats felt heavy',
  '2026-08-26': 'Good session. Bench moving well.',
};

export const LEGACY_GOALS: GoalsMap = {
  'Sumo Squats': 145,
  'Bench Press': 115,
  Deadlifts: 205,
};

export const LEGACY_BODYWEIGHT: BodyweightEntry[] = [
  { id: 'bw11724567890135', date: '2026-08-18', weight: 129.4 },
  { id: 'bw21724567890136', date: '2026-08-25', weight: 128.5 },
];

export const LEGACY_ACHIEVEMENTS: string[] = [
  'first-set',
  'streak-3',
  'first-pr',
  'cross-train',
  'bodyweight-log',
];

export const LEGACY_UNIT: Unit = 'lbs';

export const LEGACY_CUSTOM_EXERCISES: CustomExercisesMap = {
  'Lower A': [
    {
      name: 'Bulgarian Split Squat',
      targetSets: 3,
      targetReps: '8-12',
      prefillReps: 8,
      goal: 50,
      custom: true,
      notes: 'Front foot far forward. Targets: quads, glutes',
    },
    // `archived` hides the card but keeps its history and config.
    {
      name: 'Calf Raises',
      targetSets: 3,
      targetReps: '15-20',
      prefillReps: 15,
      goal: 90,
      custom: true,
      notes: null,
      archived: true,
    },
  ],
};

export const LEGACY_EXCLUDED_BUILT_INS: ExcludedBuiltInsMap = {
  'Lower A': ['KB Swings'],
};

export const LEGACY_LAST_PROGRAM_REVIEW = '2026-07-20';

export const LEGACY_CORE_OVERRIDES: CoreOverridesMap = {
  Plank: { name: 'RKC Plank', target: '3 x 15-20 sec' },
};

export const LEGACY_THEME = 'dark';

/** Inches. Either field may be null — the second row exercises that. */
export const LEGACY_MEASUREMENTS: MeasurementEntry[] = [
  { id: 'ms11724567890137', date: '2026-08-18', waist: 29.5, hips: 38 },
  { id: 'ms21724567890138', date: '2026-08-25', waist: 29, hips: null },
];

/** legPressSled is an explicit 0, which is meaningfully different from null. */
export const LEGACY_EQUIPMENT_WEIGHTS: EquipmentWeights = {
  trapBar: 55,
  legPressSled: 0,
};

/**
 * The seed as localStorage actually holds it: real double-prefixed keys
 * (`gymlog_gymlog:entries`) mapped to exact string values.
 *
 * `unit`, `theme` and `lastProgramReview` are RAW strings — storing them
 * JSON-quoted is the classic way to corrupt a legacy profile, so they are
 * written here exactly as legacy wrote them.
 *
 * The keys are spelled out rather than derived from `STORAGE_KEYS`, for two
 * reasons: deriving them would make the round-trip test circular (a key rename
 * would rename the fixture too and prove nothing), and it keeps this module
 * free of runtime imports so plain Node can load it for the seed script.
 * `legacySeed.test.ts` asserts these literals still match `fullKey()`.
 */
export const LEGACY_SEED: Record<string, string> = {
  'gymlog_gymlog:entries': JSON.stringify(LEGACY_ENTRIES),
  'gymlog_gymlog:notes': JSON.stringify(LEGACY_NOTES),
  'gymlog_gymlog:goals': JSON.stringify(LEGACY_GOALS),
  'gymlog_gymlog:bodyweight': JSON.stringify(LEGACY_BODYWEIGHT),
  'gymlog_gymlog:achievements': JSON.stringify(LEGACY_ACHIEVEMENTS),
  'gymlog_gymlog:unit': LEGACY_UNIT,
  'gymlog_gymlog:customExercises': JSON.stringify(LEGACY_CUSTOM_EXERCISES),
  'gymlog_gymlog:excludedBuiltIns': JSON.stringify(LEGACY_EXCLUDED_BUILT_INS),
  'gymlog_gymlog:lastProgramReview': LEGACY_LAST_PROGRAM_REVIEW,
  'gymlog_gymlog:coreOverrides': JSON.stringify(LEGACY_CORE_OVERRIDES),
  'gymlog_gymlog:theme': LEGACY_THEME,
  'gymlog_gymlog:measurements': JSON.stringify(LEGACY_MEASUREMENTS),
  'gymlog_gymlog:equipmentWeights': JSON.stringify(LEGACY_EQUIPMENT_WEIGHTS),
};

/** Write the seed into a Storage (the browser's localStorage, or a test double). */
export function applyLegacySeed(target: Storage): void {
  for (const [key, value] of Object.entries(LEGACY_SEED)) {
    target.setItem(key, value);
  }
}
