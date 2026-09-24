/**
 * Tiered fallback for exercises the library cannot resolve by name.
 *
 * WHY, measured rather than assumed. `lookupExercise` matches on exact name,
 * singular form, then a UNIQUE prefix — and refuses to guess when a prefix is
 * ambiguous. Against 15 plausible names it missed 6, and diagnosing each one
 * showed three different causes, not one:
 *
 *   "Incline Press"   0 exact, 0 prefix, 6 token matches — all Chest
 *   "Seated Row"      0 exact, 0 prefix, 2 token matches — all Middle back
 *   "Leg Curl"        0 exact, 0 prefix, 4 token matches — all Hamstrings
 *   "Tricep Pushdown" 0 exact, 0 prefix, 4 token matches — all Triceps
 *   "Bicep Curls"     nothing: the library names by equipment, you by muscle
 *   "Bulgarian Split Squat"  genuinely absent from all 876 rows
 *
 * The first four fail only because your words are in the MIDDLE of the library
 * name ("Incline Dumbbell Press"), never at the front. And although the
 * EXERCISE stays ambiguous, every candidate agrees on the muscle — so the
 * muscle is not ambiguous at all. That gap is the whole idea here: naming the
 * muscle is a strictly weaker claim than naming the exercise, so this resolver
 * can answer where `lookupExercise` rightly declines, and `lookupExercise`
 * itself is left alone (the picker, alternatives and MuscleWiki links all need
 * real identity, and a near-miss there would be wrong in a way this is not).
 *
 * NOTHING HERE IS SILENT. Every result carries the `basis` it was reached by,
 * and the caller is expected to show it and let the user override — see the
 * "never widen the matcher" rule in CLAUDE.md. Widening a matcher trades a
 * visible gap for an invisible error unless the result is surfaced.
 */
import { MUSCLE_GROUPS } from '@/lib/types';
import type { MuscleGroup } from '@/lib/types';

/** How a muscle was arrived at, weakest claim last. */
export type ResolveBasis = 'notes' | 'unanimous' | 'muscle-name';

export interface ResolvedMuscle {
  muscle: MuscleGroup;
  basis: ResolveBasis;
  /** Shown to the user so the guess can be judged, not just accepted. */
  evidence: string;
}

/** The fields this needs off a library row. Keeps it testable without the 1.2 MB file. */
export interface NameableExercise {
  name: string;
  primary_muscles: string[];
}

/**
 * Words people use that the library's muscle vocabulary does not.
 *
 * `quads`/`glutes` appear because the legacy app wrote them into custom
 * exercise notes by hand. The ABDUCTION/ADDUCTION pair is listed explicitly and
 * deliberately: the words differ by ONE character and name opposing muscles, so
 * any stemmer that reaches for a common prefix will confidently swap them.
 */
const MUSCLE_ALIASES: Record<string, MuscleGroup> = {
  ab: 'Abdominals',
  abs: 'Abdominals',
  abdominal: 'Abdominals',
  core: 'Abdominals',
  abduction: 'Abductors',
  abductor: 'Abductors',
  adduction: 'Adductors',
  adductor: 'Adductors',
  bicep: 'Biceps',
  tricep: 'Triceps',
  calf: 'Calves',
  pec: 'Chest',
  pecs: 'Chest',
  pectoral: 'Chest',
  glute: 'Glutes',
  ham: 'Hamstrings',
  hams: 'Hamstrings',
  hamstring: 'Hamstrings',
  lat: 'Lats',
  quad: 'Quadriceps',
  quads: 'Quadriceps',
  delt: 'Shoulders',
  delts: 'Shoulders',
  deltoid: 'Shoulders',
  shoulder: 'Shoulders',
  trap: 'Traps',
  forearm: 'Forearms',
};

/** Lowercase muscle name → the canonical group, for exact hits. */
const CANONICAL = new Map<string, MuscleGroup>(MUSCLE_GROUPS.map((m) => [m.toLowerCase(), m]));

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trailing plural only; never a prefix stem, which is what confuses ab/adduction. */
function singular(word: string): string {
  return word.replace(/(\w{3,}?)s$/, '$1');
}

function asMuscle(word: string): MuscleGroup | undefined {
  const w = normalize(word);
  return (
    CANONICAL.get(w) ??
    MUSCLE_ALIASES[w] ??
    CANONICAL.get(singular(w)) ??
    MUSCLE_ALIASES[singular(w)]
  );
}

/**
 * TIER 1 — the app's own `Targets:` note.
 *
 * `AddExerciseSection` writes `Targets: <primary muscles>` into a custom
 * exercise's notes when it is created from the library, so for those the answer
 * was recorded at creation time and needs no guessing at all. Legacy notes were
 * hand-typed ("Targets: quads, glutes"), which the alias table covers.
 */
export function muscleFromNotes(notes: string | null | undefined): ResolvedMuscle | undefined {
  if (!notes) return undefined;
  const match = /targets:\s*([^.]*)/i.exec(notes);
  if (!match?.[1]) return undefined;
  for (const part of match[1].split(/[,/]/)) {
    const muscle = asMuscle(part.trim());
    if (muscle) return { muscle, basis: 'notes', evidence: `noted as "${match[1].trim()}"` };
  }
  return undefined;
}

/**
 * TIER 2 — every library exercise containing all your words agrees on a muscle.
 *
 * Containment, not prefix, is what finds "Incline Dumbbell Press" from "Incline
 * Press". The unanimity check is what makes acting on it defensible: if the
 * candidates disagree, this returns nothing rather than picking the first.
 */
export function muscleFromUnanimousMatch(
  exerciseName: string,
  library: NameableExercise[],
): ResolvedMuscle | undefined {
  const tokens = normalize(exerciseName).split(' ').filter(Boolean);
  if (!tokens.length) return undefined;

  const candidates = library.filter((entry) => {
    const target = normalize(entry.name);
    return tokens.every((token) => target.includes(token) || target.includes(singular(token)));
  });
  if (!candidates.length) return undefined;

  const primaries = new Set(candidates.flatMap((c) => c.primary_muscles));
  if (primaries.size !== 1) return undefined;

  const only = [...primaries][0];
  const muscle = only ? CANONICAL.get(only.toLowerCase()) : undefined;
  if (!muscle) return undefined;

  return {
    muscle,
    basis: 'unanimous',
    evidence:
      candidates.length === 1
        ? `matches "${candidates[0]!.name}"`
        : `all ${candidates.length} matching exercises work ${muscle}`,
  };
}

/**
 * TIER 3 — you named the muscle in the exercise name.
 *
 * "Bicep Curls", "Tricep Pushdown", "Hip Abduction". The weakest tier, because
 * a word can appear for other reasons, so it runs last and is always labelled.
 */
export function muscleFromOwnName(exerciseName: string): ResolvedMuscle | undefined {
  for (const token of normalize(exerciseName).split(' ')) {
    const muscle = asMuscle(token);
    if (muscle) return { muscle, basis: 'muscle-name', evidence: `"${token}" names a muscle` };
  }
  return undefined;
}

/**
 * The tiers in order, strongest claim first. Returns undefined when no tier
 * fires — which is correct for a genuinely novel exercise, and is exactly when
 * the user has to be asked.
 */
export function resolveMuscle(
  exerciseName: string,
  library: NameableExercise[],
  notes?: string | null,
): ResolvedMuscle | undefined {
  return (
    muscleFromNotes(notes) ??
    muscleFromUnanimousMatch(exerciseName, library) ??
    muscleFromOwnName(exerciseName)
  );
}
