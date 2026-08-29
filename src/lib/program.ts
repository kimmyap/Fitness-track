/**
 * The program data, ported VERBATIM from legacy/index.html (lines ~1090–1332,
 * 1468–1474, 1938–1964, 3218–3332, 3829–3837). Do not edit copy, targets or
 * thresholds — this is the user's actual training program.
 *
 * Font Awesome icons are mapped to lucide-react equivalents.
 */
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ArrowUpFromLine,
  Award,
  Bell,
  Box,
  Boxes,
  ChevronsUp,
  Crown,
  Dumbbell,
  Earth,
  Flame,
  Footprints,
  Gauge,
  Layers,
  Medal,
  MoveDown,
  Plus,
  Rocket,
  Ruler,
  Scale,
  Sparkles,
  Sprout,
  Star,
  Trophy,
  Volleyball,
  Weight,
} from 'lucide-react';
import type { CoreOverride, ProgramExercise } from './types';
import type { FireTierLevel } from './domain';

// ---------------------------------------------------------------------------
// The program: 9 built-in exercises across 3 workout days
// ---------------------------------------------------------------------------

export const DAYS: Record<string, ProgramExercise[]> = {
  'Lower A': [
    { name: 'Sumo Squats', goal: 135, targetSets: 4, targetReps: '8-12', prefillReps: 10 },
    { name: 'Deadlifts', goal: 200, targetSets: 3, targetReps: '6-8', prefillReps: 7 },
    { name: 'Hip Thrust', goal: 175, targetSets: 3, targetReps: '10-12', prefillReps: 11 },
    { name: 'KB Swings', goal: 45, targetSets: 3, targetReps: '15', prefillReps: 15 },
  ],
  Upper: [
    { name: 'Bench Press', goal: 110, targetSets: 4, targetReps: '6-10', prefillReps: 8 },
    { name: 'Rows', goal: 90, targetSets: 3, targetReps: '10-12', prefillReps: 11 },
    { name: 'Shoulder Press', goal: 65, targetSets: 3, targetReps: '10-12', prefillReps: 11 },
    { name: 'Lat Pulldown', goal: 100, targetSets: 3, targetReps: '8-12', prefillReps: 10 },
  ],
  'Lower B': [
    { name: 'Sumo Squats', goal: 135, targetSets: 3, targetReps: '10-12', prefillReps: 11 },
    { name: 'Hip Thrust', goal: 175, targetSets: 4, targetReps: '10-12', prefillReps: 11 },
    { name: 'KB Swings', goal: 45, targetSets: 3, targetReps: '15-20', prefillReps: 17 },
    { name: 'Leg Press / Lunges', goal: 155, targetSets: 3, targetReps: '10-12', prefillReps: 11 },
  ],
};

export const WORKOUT_DAY_NAMES = ['Lower A', 'Upper', 'Lower B'] as const;
export type WorkoutDayName = (typeof WORKOUT_DAY_NAMES)[number];

/** Legacy tab order (for reference; the rebuild consolidates into 5 routes). */
export const TAB_ORDER = [
  'Today',
  'Warm-up',
  'Lower A',
  'Upper',
  'Lower B',
  'Core',
  'Calendar',
  'Plates',
  'Weight',
  'Achievements',
  'Settings',
];

// ---------------------------------------------------------------------------
// Variations (drive the variation select + weight-entry math)
// ---------------------------------------------------------------------------

export const EXERCISE_VARIATIONS: Record<string, string[]> = {
  'Sumo Squats': ['Barbell', 'Dumbbell', 'Kettlebell'],
  Deadlifts: ['Barbell', 'Dumbbell', 'Trap Bar'],
  'Hip Thrust': ['Barbell', 'Machine', 'Bodyweight'],
  'KB Swings': ['Two-Hand', 'Single-Arm'],
  'Bench Press': ['Barbell', 'Dumbbell', 'Machine'],
  Rows: ['Dumbbell', 'Cable', 'Machine', 'Barbell'],
  'Shoulder Press': ['Dumbbell', 'Barbell', 'Machine'],
  'Lat Pulldown': ['Cable', 'Assisted Pull-up'],
  'Leg Press / Lunges': ['Leg Press', 'Walking Lunges', 'Bodyweight Lunges'],
};

// ---------------------------------------------------------------------------
// Form cues + muscles worked
// ---------------------------------------------------------------------------

export interface ExerciseInfo {
  muscles: string;
  cuesByVariation: Record<string, string> & { default: string };
}

export const EXERCISE_INFO: Record<string, ExerciseInfo> = {
  'Sumo Squats': {
    muscles: 'Glutes, inner thighs (adductors), quads',
    cuesByVariation: {
      Barbell: 'Bar rests across your upper traps like a back squat. Wide stance, toes out 30-45°, push hips back and down.',
      Dumbbell: 'Hold one dumbbell vertically at your chest with both hands, elbows pointed down, squat between your knees.',
      Kettlebell: 'Hold the kettlebell by the horns at your chest, same wide stance, keep the bell close to your body.',
      default: 'Wide stance, toes turned out 30-45°. Push hips back and down, knees track over toes. Chest stays upright.',
    },
  },
  Deadlifts: {
    muscles: 'Hamstrings, glutes, lower back, lats',
    cuesByVariation: {
      Barbell: 'Bar over midfoot, shins close to the bar, flat back. Push the floor away, hips and shoulders rise together.',
      Dumbbell: 'Dumbbells at your sides, hinge at the hips, keep them close to your legs the whole way down and up.',
      'Trap Bar': 'Stand inside the frame, grip the handles at your sides. More upright torso, generally easier on the lower back.',
      default: 'Bar over midfoot, flat back, chest up. Push the floor away with your legs, hips and shoulders rise together.',
    },
  },
  'Hip Thrust': {
    muscles: 'Glutes, hamstrings',
    cuesByVariation: {
      Barbell: 'Bar padded across your hips, upper back on a bench, drive hips up squeezing glutes hard at the top.',
      Machine: 'Adjust the pad to sit across your hips, same hip-drive motion, the machine guides the path for you.',
      Bodyweight: 'Flat on your back, feet flat on the floor, drive hips up using just your bodyweight, squeeze at the top.',
      default: 'Upper back on a bench, feet flat, drive hips up by squeezing glutes. Chin tucked, avoid over-arching the lower back.',
    },
  },
  'KB Swings': {
    muscles: 'Glutes, hamstrings, core',
    cuesByVariation: {
      'Two-Hand': 'Both hands on the handle, hinge and snap your hips to swing the bell, arms stay relaxed.',
      'Single-Arm': 'One hand on the handle, brace your core hard to resist rotating, switch hands between sets.',
      default: 'Hinge at the hips, not a squat. Snap hips forward to swing the bell, arms stay relaxed and just along for the ride.',
    },
  },
  'Bench Press': {
    muscles: 'Chest, front shoulders, triceps',
    cuesByVariation: {
      Barbell: 'Shoulder blades pulled back and down. Lower the bar to mid-chest, press up and slightly back.',
      Dumbbell: 'Same pressing path as barbell, but each arm works independently, keep them moving together and controlled.',
      Machine: "Handles at chest height, press forward, the machine's path is fixed so focus on control, not stability.",
      default: 'Shoulder blades pulled back and down. Lower the bar to mid-chest, press up and slightly back over your shoulders.',
    },
  },
  Rows: {
    muscles: 'Upper back, lats, biceps',
    cuesByVariation: {
      Dumbbell: 'Hinge forward, row the dumbbell to your hip, squeeze your shoulder blade at the top.',
      Cable: "Sit or stand tall, pull the handle to your torso, control the return, don't let the weight yank you forward.",
      Machine: 'Chest against the pad if there is one, pull elbows back, squeeze at the end range.',
      Barbell: 'Hinge at the hips, flat back, pull the bar to your lower ribs, elbows close to your body.',
      default: 'Hinge forward slightly, pull elbows back toward your hips, squeeze shoulder blades together at the top.',
    },
  },
  'Shoulder Press': {
    muscles: 'Shoulders, triceps, upper chest',
    cuesByVariation: {
      Dumbbell: 'Press straight overhead, avoid arching your lower back, dumbbells can rotate slightly inward at the top.',
      Barbell: 'Press straight up, the bar path is fixed, you may need to move your head back slightly to clear it.',
      Machine: 'Handles at shoulder height, press up, the machine controls the path so focus on the muscle, not balance.',
      default: "Press straight overhead, not forward. Keep core tight so your lower back doesn't arch as the weight goes up.",
    },
  },
  'Lat Pulldown': {
    muscles: 'Lats, upper back, biceps',
    cuesByVariation: {
      Cable: 'Lead with your elbows, pull the bar to your upper chest. Avoid leaning back too far or using momentum.',
      'Assisted Pull-up': "Pull your chest toward the bar, more assistance makes it easier. This one's tracked separately from your PB.",
      default: 'Lead with your elbows, pull the bar to your upper chest. Avoid leaning back too far or using momentum.',
    },
  },
  'Leg Press / Lunges': {
    muscles: 'Quads, glutes, hamstrings',
    cuesByVariation: {
      'Leg Press': "Feet shoulder-width on the platform, knees track over toes, don't let your lower back round at the bottom.",
      'Walking Lunges': 'Step forward into a lunge, push off the front leg to step into the next rep, keep your torso upright.',
      'Bodyweight Lunges': 'Same lunge pattern as with weight, just no added load. Focus on control and balance.',
      default: "Knees track in line with toes, don't let them cave in. Control the descent, drive through the whole foot.",
    },
  },
};

// ---------------------------------------------------------------------------
// Alternatives (swap-suggestion feature)
// ---------------------------------------------------------------------------

export interface AlternativeExercise {
  name: string;
  reason: string;
  targetSets: number;
  targetReps: string;
  cues: string;
  muscles: string;
}

export const ALTERNATIVES: Record<string, AlternativeExercise[]> = {
  'Sumo Squats': [
    { name: 'Leg Press (feet wide, low)', reason: 'same emphasis, easier to load heavy safely', targetSets: 3, targetReps: '10-12', cues: 'Feet wide and low on the platform, knees track out over toes as you lower.', muscles: 'Glutes, inner thighs, quads' },
    { name: 'Goblet Squat', reason: "lighter option if the rack's busy", targetSets: 3, targetReps: '10-12', cues: 'Hold the weight at your chest, squat between your knees, elbows brush your inner thighs at the bottom.', muscles: 'Glutes, quads, core' },
  ],
  Deadlifts: [
    { name: 'Hamstring Curl + Hip Thrust', reason: 'hits the same posterior chain, less technical demand', targetSets: 3, targetReps: '10-12', cues: 'Curl: control the eccentric. Hip thrust: drive through heels, squeeze glutes at the top.', muscles: 'Hamstrings, glutes' },
    { name: 'Romanian Deadlift (dumbbell)', reason: 'gentler on the lower back, same hip hinge pattern', targetSets: 3, targetReps: '8-10', cues: 'Soft knees, push hips back, weights stay close to your legs, feel the stretch in your hamstrings.', muscles: 'Hamstrings, glutes, lower back' },
  ],
  'Hip Thrust': [
    { name: 'Glute Bridge (bodyweight or banded)', reason: 'same movement, no machine needed', targetSets: 3, targetReps: '12-15', cues: "Flat on your back, drive hips up, squeeze glutes hard at the top, don't overarch your back.", muscles: 'Glutes, hamstrings' },
    { name: 'Cable Pull-Through', reason: 'similar hip hinge under constant tension', targetSets: 3, targetReps: '10-12', cues: 'Face away from the cable, hinge at the hips, pull through by squeezing your glutes forward.', muscles: 'Glutes, hamstrings' },
  ],
  'KB Swings': [
    { name: 'Cable Pull-Through', reason: 'similar hip-power pattern, more controlled', targetSets: 3, targetReps: '12-15', cues: 'Same hip hinge as a swing, just on a cable, more controlled tempo.', muscles: 'Glutes, hamstrings, core' },
    { name: 'Jump Squats', reason: 'swaps hip power for explosive leg power', targetSets: 3, targetReps: '8-10', cues: 'Squat down, explode straight up, land soft with bent knees.', muscles: 'Glutes, quads, calves' },
  ],
  'Bench Press': [
    { name: 'Chest Press Machine', reason: 'same pressing pattern, more stability if shoulders feel off', targetSets: 4, targetReps: '6-10', cues: 'Handles at chest height, press forward and slightly together, control the return.', muscles: 'Chest, triceps, front shoulders' },
    { name: 'Push-ups (weighted or not)', reason: 'no equipment needed at all', targetSets: 3, targetReps: '10-15', cues: 'Body in a straight line, hands under shoulders, lower chest to just above the floor.', muscles: 'Chest, triceps, core' },
  ],
  Rows: [
    { name: 'Seated Cable Row', reason: 'same pulling pattern, easier to control tempo', targetSets: 3, targetReps: '10-12', cues: 'Sit tall, pull the handle to your stomach, squeeze shoulder blades together at the end.', muscles: 'Upper back, lats, biceps' },
    { name: 'Resistance Band Row', reason: 'works anywhere, no machine needed', targetSets: 3, targetReps: '12-15', cues: 'Anchor the band, pull elbows back, squeeze at the end, control the return.', muscles: 'Upper back, lats, biceps' },
  ],
  'Shoulder Press': [
    { name: 'Shoulder Press Machine', reason: 'removes stabilizer demand, lets you push harder', targetSets: 3, targetReps: '10-12', cues: 'Press straight up, avoid flaring elbows too wide, control the descent.', muscles: 'Shoulders, triceps' },
    { name: 'Arnold Press', reason: 'same movement, adds a bit of rotation for variety', targetSets: 3, targetReps: '10-12', cues: 'Start palms facing you, rotate as you press so palms face forward at the top.', muscles: 'Shoulders, triceps, upper chest' },
  ],
  'Lat Pulldown': [
    { name: 'Assisted Pull-up', reason: 'closer to a true pull-up pattern', targetSets: 3, targetReps: '6-10', cues: 'Pull chest toward the bar, lead with your elbows, control the lowering phase.', muscles: 'Lats, upper back, biceps' },
    { name: 'Band Pulldown', reason: "works if the cable machine's busy", targetSets: 3, targetReps: '10-12', cues: 'Anchor the band overhead, pull elbows down and back, squeeze your lats at the bottom.', muscles: 'Lats, upper back, biceps' },
  ],
  'Leg Press / Lunges': [
    { name: 'Bodyweight Lunges', reason: 'no equipment needed', targetSets: 3, targetReps: '10-12', cues: 'Step forward, both knees bend to about 90°, front knee tracks over the ankle, push back to start.', muscles: 'Quads, glutes, hamstrings' },
    { name: 'Step-ups', reason: 'similar single-leg emphasis, different stimulus', targetSets: 3, targetReps: '8-10', cues: 'Drive through the heel of the working leg, avoid pushing off the trailing foot.', muscles: 'Quads, glutes' },
  ],
};

// ---------------------------------------------------------------------------
// Core finisher
// ---------------------------------------------------------------------------

export interface CoreExercise {
  name: string;
  target: string;
}

export const CORE_EXERCISES: CoreExercise[] = [
  { name: 'Plank', target: '3 x 30-45 sec' },
  { name: 'Dead Bug', target: '3 x 10 per side' },
  { name: 'Bicycle Crunches', target: '2 x 15 per side (30 touches)' },
  { name: 'Side Plank', target: '2 x 20-30 sec per side' },
];

export interface CoreAlternative extends CoreOverride {
  reason: string;
}

export const CORE_ALTERNATIVES: Record<string, CoreAlternative[]> = {
  Plank: [
    { name: 'Forearm Plank with Shoulder Taps', reason: 'adds an anti-rotation challenge to the same hold', target: '3 x 20-30 sec' },
    { name: 'RKC Plank', reason: 'shorter but far more intense glute/ab squeeze', target: '3 x 15-20 sec' },
  ],
  'Dead Bug': [
    { name: 'Bird Dog', reason: 'similar core stability, more focus on the back extensors too', target: '3 x 10 per side' },
    { name: 'Hollow Body Hold', reason: 'more advanced, builds full-body core tension', target: '3 x 20-30 sec' },
  ],
  'Bicycle Crunches': [
    { name: 'Russian Twists', reason: 'more oblique-focused rotation', target: '2 x 15 per side' },
    { name: 'Mountain Climbers', reason: 'adds a bit of cardio to the core work', target: '2 x 20 per side' },
  ],
  'Side Plank': [
    { name: 'Side Plank with Leg Raise', reason: 'adds a hip/glute challenge to the same hold', target: '2 x 15-20 sec per side' },
    { name: 'Copenhagen Plank', reason: 'more advanced, adds adductor strength work', target: '2 x 15-20 sec per side' },
  ],
};

// ---------------------------------------------------------------------------
// Day-of-week plan (Today tab hero card)
// ---------------------------------------------------------------------------

export interface DayPlan {
  label: string;
  detail: string;
  /** Legacy tab name to jump to (null on rest/volleyball days). */
  tab: string | null;
}

/** Keyed by Date.getDay(): 0 = Sunday. */
export const DAY_PLAN: Record<number, DayPlan> = {
  0: { label: 'Volleyball Day', detail: 'Rest from lifting, get after it on the court.', tab: null },
  1: { label: 'Pilates Day', detail: 'Hot HIIT Pilates today, check the Warm-up tab if you want a pre-session routine.', tab: 'Warm-up' },
  2: { label: 'Lower A', detail: 'Sumo Squats, Deadlifts, Hip Thrust, KB Swings.', tab: 'Lower A' },
  3: { label: 'Upper', detail: 'Bench Press, Rows, Shoulder Press, Lat Pulldown.', tab: 'Upper' },
  4: { label: 'Lower B', detail: 'Hip Thrust, Sumo Squats, KB Swings, Leg Press / Lunges.', tab: 'Lower B' },
  5: { label: 'Rest Day', detail: 'Nothing scheduled, recover up.', tab: null },
  6: { label: 'Rest Day', detail: 'Nothing scheduled, recover up.', tab: null },
};

// ---------------------------------------------------------------------------
// Warm-up routine content (static cards on the Warm-up tab)
// ---------------------------------------------------------------------------

export interface WarmupSection {
  title: string;
  subtitle: string;
  items: { name: string; detail: string }[];
}

export const WARMUP_ROUTINE: WarmupSection[] = [
  {
    title: 'Cardio, 3-5 min',
    subtitle: 'Pick one, just enough to break a light sweat',
    items: [
      { name: 'Bike or rower', detail: '3-5 min, easy pace' },
      { name: 'Incline treadmill walk', detail: '3-5 min' },
      { name: 'Jump rope', detail: '2-3 min' },
    ],
  },
  {
    title: 'Before Lower A / Lower B',
    subtitle: 'Dynamic, not static, save the deep stretching for after',
    items: [
      { name: 'Bodyweight squats', detail: '10-15 reps' },
      { name: 'Glute bridges', detail: '12-15 reps' },
      { name: 'Walking lunges', detail: '8-10 per leg' },
      { name: 'Leg swings (front/side)', detail: '10 per leg' },
      { name: 'Light warm-up sets on first lift', detail: '2 sets, empty bar or light lbs' },
    ],
  },
  {
    title: 'Before Upper',
    subtitle: 'Wake up shoulders and upper back before pressing',
    items: [
      { name: 'Arm circles', detail: '10 each direction' },
      { name: 'Band or cable pull-aparts', detail: '15 reps' },
      { name: 'Push-ups (light)', detail: '8-10 reps' },
      { name: 'Scapular pull-ups or rows', detail: '10 reps' },
      { name: 'Light warm-up sets on first lift', detail: '2 sets, empty bar or light lbs' },
    ],
  },
];

export const WARMUP_WHY = {
  title: 'Why this matters',
  text: "The cardio bit raises your core temp and gets blood moving, the dynamic stuff preps the exact joints and muscles you're about to load. Skipping straight to heavy weight cold is when tweaks happen.",
};

// ---------------------------------------------------------------------------
// RPE scale descriptions
// ---------------------------------------------------------------------------

export interface RpeDescription {
  val: string;
  desc: string;
}

export const RPE_SCALE: RpeDescription[] = [
  { val: '6', desc: 'Easy, could do 4+ more reps. This is warm-up territory, not a real working set.' },
  { val: '7', desc: 'Could do 3 more reps. Solid effort, still some room.' },
  { val: '8', desc: 'Could do 2 more reps. This is the sweet spot for most working sets.' },
  { val: '9', desc: 'Could maybe squeeze out 1 more rep. Genuinely hard.' },
  { val: '10', desc: "Max effort, couldn't do another rep. Save this for occasional top sets." },
];

// ---------------------------------------------------------------------------
// Hype lines (shown on PRs, workout completion, warm-up/core completion)
// ---------------------------------------------------------------------------

export const HYPE_LINES = [
  "You're freaking awesome, no notes.",
  'Looking snatched today, not gonna lie.',
  "You earned yourself a free snack. We don't do judgment here.",
  '10/10, would recommend this energy to a friend.',
  "Your future self just texted 'thank you.'",
  'Certified hot girl workout. No crumbs left.',
  'The gains are immaculate right now.',
  'This is your villain origin story, but the good kind.',
  'Somewhere, a personal trainer shed a single tear of pride.',
  'Not slacking? In this economy? Groundbreaking.',
  'Log it, love it, leave it. Iconic behavior.',
  'The streak lives. Long live the streak.',
  "You showed up. That's more than most people did today.",
  'This set had no business being that clean.',
  "She really said 'not today, weakness' and meant it.",
  'You + consistency = a whole vibe.',
  'Reddit r/gainit would be proud of this.',
  'This is the kind of behavior that gets you into the good group chat.',
  'Certified snack-worthy performance. Go treat yourself.',
  'Your gym partner is definitely telling people about you right now.',
  "That's a whole lot of not slacking, actually.",
  'Ate that set. Left zero crumbs.',
  'Future you called, they said thanks for the assist.',
  'This is what main character energy looks like.',
  'Achievement unlocked: certified snack-earner.',
];

export function randomHype(): string {
  return HYPE_LINES[Math.floor(Math.random() * HYPE_LINES.length)] as string;
}

// ---------------------------------------------------------------------------
// Icon mappings (legacy Font Awesome → lucide-react)
// ---------------------------------------------------------------------------

/** fa-down-long → MoveDown, fa-weight-hanging → Weight, fa-bridge → ArrowUpFromLine, etc. */
export const EXERCISE_ICONS: Record<string, LucideIcon> = {
  'Sumo Squats': MoveDown,
  Deadlifts: Weight,
  'Hip Thrust': ArrowUpFromLine,
  'KB Swings': Bell,
  'Bench Press': ArrowUp,
  Rows: ArrowLeftRight,
  'Shoulder Press': ChevronsUp,
  'Lat Pulldown': ArrowDown,
  'Leg Press / Lunges': Footprints,
};

/** Legacy CUSTOM_EX_ICON (fa-plus). */
export const CUSTOM_EXERCISE_ICON: LucideIcon = Plus;

export function iconForExercise(name: string): LucideIcon {
  return EXERCISE_ICONS[name] ?? CUSTOM_EXERCISE_ICON;
}

/** Fire-tier icons (legacy: seedling / fire / crown). */
export const FIRE_TIER_ICONS: Record<FireTierLevel, LucideIcon> = {
  seedling: Sprout,
  building: Flame,
  heating: Flame,
  fire: Flame,
  crown: Crown,
};

/** Achievement badge icons, keyed by achievement id (legacy Font Awesome → lucide). */
export const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  'first-set': Dumbbell,
  'streak-3': Flame,
  'streak-7': Flame,
  'streak-14': Flame,
  'streak-30': Crown,
  'streak-60': Sparkles, // fa-meteor
  'workouts-10': Flame, // fa-fire-flame-curved
  'workouts-25': Star,
  'workouts-50': Trophy,
  'workouts-100': Award,
  'sets-100': Layers, // fa-layer-group
  'sets-500': Boxes, // fa-cubes-stacked
  'first-pr': Medal,
  'pr-5': Medal,
  'pr-15': Medal,
  'cross-train': Volleyball,
  'cross-train-10': Volleyball,
  'volume-10k': Box,
  'volume-50k': Rocket,
  'volume-100k': Earth, // fa-earth-americas
  'bodyweight-log': Scale, // fa-scale-balanced
  'bodyweight-10': Scale,
  'measure-log': Ruler,
  'rpe-20': Gauge, // fa-gauge-high
  'rpe-100': Gauge,
};
