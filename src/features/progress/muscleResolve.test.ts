import { describe, it, expect } from 'vitest';
import {
  muscleFromNotes,
  muscleFromOwnName,
  muscleFromUnanimousMatch,
  resolveMuscle,
  type NameableExercise,
} from './muscleResolve';

/** Shaped like the real library rows the diagnosis found. */
const LIBRARY: NameableExercise[] = [
  { name: 'Barbell Incline Bench Press - Medium Grip', primary_muscles: ['Chest'] },
  { name: 'Incline Dumbbell Press', primary_muscles: ['Chest'] },
  { name: 'Incline Cable Chest Press', primary_muscles: ['Chest'] },
  { name: 'Seated Cable Rows', primary_muscles: ['Middle back'] },
  { name: 'Seated One-arm Cable Pulley Rows', primary_muscles: ['Middle back'] },
  { name: 'Lying Leg Curls', primary_muscles: ['Hamstrings'] },
  { name: 'Seated Leg Curl', primary_muscles: ['Hamstrings'] },
  { name: 'Triceps Pushdown', primary_muscles: ['Triceps'] },
  { name: 'Reverse Grip Triceps Pushdown', primary_muscles: ['Triceps'] },
  // Deliberate disagreement: two "press" exercises with different movers.
  { name: 'Leg Press', primary_muscles: ['Quadriceps'] },
  { name: 'Shoulder Press', primary_muscles: ['Shoulders'] },
];

describe('tier 1 — the app wrote the answer into the notes', () => {
  it('reads the Targets: line AddExerciseSection writes', () => {
    const hit = muscleFromNotes('Keep elbows tucked. Targets: Chest, Triceps');
    expect(hit?.muscle).toBe('Chest');
    expect(hit?.basis).toBe('notes');
  });

  it('understands the hand-typed legacy wording', () => {
    // legacySeed's real note: "Front foot far forward. Targets: quads, glutes"
    expect(muscleFromNotes('Front foot far forward. Targets: quads, glutes')?.muscle).toBe('Quadriceps');
  });

  it('ignores notes with no Targets line', () => {
    expect(muscleFromNotes('Front foot far forward.')).toBeUndefined();
    expect(muscleFromNotes(null)).toBeUndefined();
  });

  it('skips an unrecognised word rather than guessing at it', () => {
    expect(muscleFromNotes('Targets: wingspan')).toBeUndefined();
  });
});

describe('tier 2 — unanimous containment match', () => {
  it('finds a mid-name match that prefix matching cannot', () => {
    const hit = muscleFromUnanimousMatch('Incline Press', LIBRARY);
    expect(hit?.muscle).toBe('Chest');
    expect(hit?.basis).toBe('unanimous');
    expect(hit?.evidence).toMatch(/all 3 matching exercises work Chest/);
  });

  it('matches across a plural difference', () => {
    expect(muscleFromUnanimousMatch('Seated Row', LIBRARY)?.muscle).toBe('Middle back');
    expect(muscleFromUnanimousMatch('Leg Curl', LIBRARY)?.muscle).toBe('Hamstrings');
  });

  it('refuses when the candidates disagree', () => {
    // "Press" alone spans Chest, Quadriceps and Shoulders here.
    expect(muscleFromUnanimousMatch('Press', LIBRARY)).toBeUndefined();
  });

  it('refuses when nothing matches', () => {
    expect(muscleFromUnanimousMatch('Bulgarian Split Squat', LIBRARY)).toBeUndefined();
  });

  it('names the single exercise when there is exactly one', () => {
    expect(muscleFromUnanimousMatch('Shoulder Press', LIBRARY)?.evidence).toBe('matches "Shoulder Press"');
  });
});

describe('tier 3 — you named the muscle yourself', () => {
  it('reads a muscle word out of the exercise name', () => {
    expect(muscleFromOwnName('Bicep Curls')?.muscle).toBe('Biceps');
    expect(muscleFromOwnName('Tricep Pushdown')?.muscle).toBe('Triceps');
  });

  /**
   * The hazard this tier exists around: abduction and adduction differ by one
   * character and name opposing muscles. Any prefix stemmer collapses them.
   */
  it('keeps abduction and adduction apart', () => {
    expect(muscleFromOwnName('Hip Abduction')?.muscle).toBe('Abductors');
    expect(muscleFromOwnName('Hip Adduction')?.muscle).toBe('Adductors');
  });

  it('finds nothing in a name that mentions no muscle', () => {
    expect(muscleFromOwnName('Bulgarian Split Squat')).toBeUndefined();
  });
});

describe('resolveMuscle tier order', () => {
  it('prefers the recorded note over any inference', () => {
    // The name would infer Chest; the note says otherwise and the note wins.
    const hit = resolveMuscle('Incline Press', LIBRARY, 'Targets: Shoulders');
    expect(hit).toMatchObject({ muscle: 'Shoulders', basis: 'notes' });
  });

  it('prefers a unanimous library match over a bare muscle word', () => {
    const hit = resolveMuscle('Triceps Pushdown', LIBRARY);
    expect(hit?.basis).toBe('unanimous');
  });

  it('falls through to the name when the library has nothing', () => {
    expect(resolveMuscle('Bicep Curls', LIBRARY)).toMatchObject({ basis: 'muscle-name' });
  });

  it('returns nothing for a genuinely novel exercise, which is when to ask', () => {
    expect(resolveMuscle('Bulgarian Split Squat', LIBRARY)).toBeUndefined();
  });

  it('always reports how it got there', () => {
    for (const name of ['Incline Press', 'Bicep Curls']) {
      const hit = resolveMuscle(name, LIBRARY);
      expect(hit?.evidence).toBeTruthy();
      expect(hit?.basis).toBeTruthy();
    }
  });
});
