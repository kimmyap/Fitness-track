/**
 * Imports the open-source free-exercise-db (876 exercises, Unlicense/public
 * domain) and converts it to the app's exercise-library schema.
 *
 * Run: npm run import-exercises
 * Output: src/data/exerciseLibrary.json
 *
 * Node 24 runs TypeScript directly, so this needs no ts-node/tsx.
 */
import fs from 'node:fs';
import path from 'node:path';

// --- Raw schema, verified against the live dist/exercises.json ---------------
// NOTE: `category` is the training style ("strength" | "stretching" |
// "plyometrics" | "strongman" | "powerlifting" | "cardio" |
// "olympic weightlifting") — NOT a muscle group. Muscle groups live in
// primaryMuscles / secondaryMuscles.
interface RawExercise {
  id: string;
  name: string;
  force?: 'push' | 'pull' | 'static' | null;
  level: string;
  mechanic?: 'compound' | 'isolation' | null;
  equipment?: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
}

type MovementPattern =
  | 'HIP_HINGE'
  | 'KNEE_DOMINANT'
  | 'HORIZONTAL_PUSH'
  | 'VERTICAL_PUSH'
  | 'HORIZONTAL_PULL'
  | 'VERTICAL_PULL'
  | 'CORE_ISOLATION'
  | 'ISOLATION';

type Equipment =
  | 'BARBELL'
  | 'EZ_CURL_BAR'
  | 'DUMBBELL'
  | 'KETTLEBELL'
  | 'CABLE'
  | 'MACHINE'
  | 'BAND'
  | 'BODYWEIGHT'
  | 'OTHER';

export interface LibraryExercise {
  id: string;
  name: string;
  movement_pattern: MovementPattern;
  /** Training style from the source data: "strength" | "stretching" | "cardio" | … */
  category: string;
  level: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: Equipment;
  execution_cues: string[];
  default_setup: {
    supports_plate_calculator: boolean;
    bar_weight_lbs: number;
    is_unilateral: boolean;
    default_rest_seconds: number;
  };
  alternative_ids: string[];
  images: string[];
}

const RAW_DB_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';

/** Bar weights in lbs. Only plate-loaded bars get the plate calculator. */
const BAR_WEIGHTS: Partial<Record<Equipment, number>> = {
  BARBELL: 45,
  EZ_CURL_BAR: 25,
};

const KNEE_NAMES = /squat|lunge|step-up|step up|leg press|leg extension/;
const HINGE_NAMES = /deadlift|hip thrust|bridge|good morning|romanian|swing|hyperextension/;
const VPULL_NAMES = /pulldown|pull-up|pullup|chin-up|chinup|pull up/;
const VPUSH_NAMES = /overhead press|military press|shoulder press|push press|handstand/;
const HPULL_NAMES = /row|face pull/;
const HPUSH_NAMES = /bench press|push-up|pushup|push up|chest press|dip|fly|flye/;
const UNILATERAL_NAMES = /single|one-arm|one arm|single-arm|alternating/;

/**
 * Maps a raw exercise onto the app's movement patterns.
 *
 * Order matters: named knee-dominant movements are checked BEFORE the
 * glutes-primary hinge rule, or every Bulgarian split squat (which is
 * glutes-primary) would be classified as a hip hinge.
 */
function determineMovementPattern(raw: RawExercise): MovementPattern {
  const name = raw.name.toLowerCase();
  const primary = raw.primaryMuscles.map((m) => m.toLowerCase());
  const has = (...muscles: string[]) => muscles.some((m) => primary.includes(m));

  // 1. Explicitly named movements win over muscle heuristics.
  if (KNEE_NAMES.test(name)) return 'KNEE_DOMINANT';
  if (HINGE_NAMES.test(name)) return 'HIP_HINGE';
  if (VPULL_NAMES.test(name)) return 'VERTICAL_PULL';
  if (VPUSH_NAMES.test(name)) return 'VERTICAL_PUSH';
  if (HPULL_NAMES.test(name)) return 'HORIZONTAL_PULL';
  if (HPUSH_NAMES.test(name)) return 'HORIZONTAL_PUSH';

  // 2. Fall back to primary muscle plus force direction.
  if (has('abdominals')) return 'CORE_ISOLATION';
  if (has('quadriceps')) return 'KNEE_DOMINANT';
  if (has('hamstrings', 'glutes', 'lower back')) return 'HIP_HINGE';
  if (has('chest') && raw.force === 'push') return 'HORIZONTAL_PUSH';
  if (has('shoulders') && raw.force === 'push') return 'VERTICAL_PUSH';
  if (has('lats') && raw.force === 'pull') return 'VERTICAL_PULL';
  if (has('middle back', 'traps') && raw.force === 'pull') return 'HORIZONTAL_PULL';

  return 'ISOLATION';
}

/** Normalises the equipment strings that actually appear in the dataset. */
function normalizeEquipment(rawEquipment?: string | null): Equipment {
  if (!rawEquipment) return 'BODYWEIGHT';
  const eq = rawEquipment.toLowerCase();
  if (eq.includes('e-z curl')) return 'EZ_CURL_BAR';
  if (eq.includes('barbell')) return 'BARBELL';
  if (eq.includes('dumbbell')) return 'DUMBBELL';
  if (eq.includes('kettlebell')) return 'KETTLEBELL';
  if (eq.includes('cable')) return 'CABLE';
  if (eq.includes('machine')) return 'MACHINE';
  if (eq.includes('band')) return 'BAND';
  if (eq === 'body only') return 'BODYWEIGHT';
  // "other", "medicine ball", "exercise ball", "foam roll" — not bodyweight,
  // and nothing the plate calculator or bar math applies to.
  return 'OTHER';
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Links up to 4 alternatives per exercise: same movement pattern, sharing at
 * least one primary muscle. Different equipment is preferred (a swap is most
 * useful when the rack is taken), then alphabetical so the output is stable
 * across runs and git diffs stay meaningful.
 */
function linkAlternatives(all: LibraryExercise[]): void {
  const byPattern = new Map<MovementPattern, LibraryExercise[]>();
  for (const ex of all) {
    const list = byPattern.get(ex.movement_pattern);
    if (list) list.push(ex);
    else byPattern.set(ex.movement_pattern, [ex]);
  }

  for (const ex of all) {
    const candidates = (byPattern.get(ex.movement_pattern) ?? []).filter(
      (other) => other.id !== ex.id && other.primary_muscles.some((m) => ex.primary_muscles.includes(m)),
    );
    candidates.sort((a, b) => {
      const aSame = a.equipment === ex.equipment ? 1 : 0;
      const bSame = b.equipment === ex.equipment ? 1 : 0;
      if (aSame !== bSame) return aSame - bSame;
      return a.name.localeCompare(b.name);
    });
    ex.alternative_ids = candidates.slice(0, 4).map((alt) => alt.id);
  }
}

async function convertDatabase(): Promise<void> {
  console.log('Fetching free-exercise-db…');
  const response = await fetch(RAW_DB_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${RAW_DB_URL}`);

  const rawData = (await response.json()) as RawExercise[];
  if (!Array.isArray(rawData) || rawData.length === 0) {
    throw new Error('Fetched database was empty or not an array');
  }
  console.log(`Received ${rawData.length} raw exercises.`);

  const formatted: LibraryExercise[] = rawData.map((raw) => {
    const equipment = normalizeEquipment(raw.equipment);
    const barWeight = BAR_WEIGHTS[equipment] ?? 0;

    return {
      id: raw.id,
      name: raw.name,
      movement_pattern: determineMovementPattern(raw),
      category: raw.category,
      level: raw.level,
      primary_muscles: raw.primaryMuscles.map(capitalize),
      secondary_muscles: raw.secondaryMuscles.map(capitalize),
      equipment,
      execution_cues: raw.instructions?.length
        ? raw.instructions
        : ['Move under control through a full range of motion.'],
      default_setup: {
        supports_plate_calculator: barWeight > 0,
        bar_weight_lbs: barWeight,
        is_unilateral: UNILATERAL_NAMES.test(raw.name.toLowerCase()),
        default_rest_seconds: raw.mechanic === 'compound' ? 120 : 60,
      },
      alternative_ids: [],
      images: (raw.images ?? []).map((img) => IMAGE_BASE + img),
    };
  });

  linkAlternatives(formatted);

  // Sorted by name so the generated file is deterministic run to run.
  formatted.sort((a, b) => a.name.localeCompare(b.name));

  const outputPath = path.join(process.cwd(), 'src', 'data', 'exerciseLibrary.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  // One exercise per line: valid JSON, but regenerating produces a readable
  // per-exercise git diff instead of rewriting one enormous single line. Full
  // pretty-printing would nearly double the parse cost for no real benefit.
  const body = formatted.map((e) => JSON.stringify(e)).join(',\n');
  fs.writeFileSync(outputPath, `[\n${body}\n]\n`);

  const kb = (fs.statSync(outputPath).size / 1024).toFixed(0);
  const patterns = formatted.reduce<Record<string, number>>((acc, e) => {
    acc[e.movement_pattern] = (acc[e.movement_pattern] ?? 0) + 1;
    return acc;
  }, {});
  const equipmentCounts = formatted.reduce<Record<string, number>>((acc, e) => {
    acc[e.equipment] = (acc[e.equipment] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`Wrote ${formatted.length} exercises to ${outputPath} (${kb} KB)`);
  console.log('Movement patterns:', patterns);
  console.log('Equipment:', equipmentCounts);
  const categoryCounts = formatted.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + 1;
    return acc;
  }, {});
  console.log('Categories:', categoryCounts);
  const unlinked = formatted.filter((e) => e.alternative_ids.length === 0).length;
  if (unlinked) {
    console.log(`Note: ${unlinked} exercises have no alternatives (no pattern + muscle match).`);
  }
}

convertDatabase().catch((error: unknown) => {
  console.error('Failed to convert exercise database:', error);
  // Non-zero exit so CI and shell chains actually see the failure.
  process.exit(1);
});
