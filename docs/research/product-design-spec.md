# FitTrack — Product Spec & Design System

Research-backed specification for a client-side personal fitness tracker (localStorage persistence). Sources: comparative research on Strong, Hevy, Fitbod, and Strava; design intelligence extracted from the ui-ux-pro-max skill dataset (`.claude/skills/ui-ux-pro-max/`): products.csv row 35 "Fitness/Gym App", colors.csv row 35, styles.csv rows 6/7/15, typography.csv, charts.csv, motion.csv, references/quick-reference.md, references/pro-rules.md.

---

## Part 1 — Feature Spec & Information Architecture

### Competitive takeaways (what to steal)
- **Strong:** frictionless set logging (tap-to-duplicate previous set, checkmark completion), built-in rest timer that auto-starts on set completion, plate calculator, warm-up sets, workout templates/routines, per-exercise history and estimated 1RM charts, CSV export.
- **Hevy:** speed-first single-set input, duplicate-set button, simple template reuse, PR celebration feed, clean progress charts.
- **Fitbod:** Results screen charting benchmark lifts (squat/bench/deadlift/OHP) with estimated 1RM trend; weekly/monthly/yearly views; muscle-group recovery map; milestone celebrations for Weight/Volume/Rep/Estimated-1RM records; weekly workout goal with streaks (weekly-streak engagement drives 25% higher consistency).
- **Strava:** weekly summary, streaks, calendar heatmap of activity, social-proof-style stat cards (volume, time, PRs this week).

### Core pages (5 top-level routes; bottom nav on mobile ≤ 5 items, sidebar ≥ 1024px)

1. **`/` Dashboard**
   - Hero stat row: current weekly streak, workouts this week vs. weekly goal (progress ring/bullet), total volume this week, PRs this month.
   - "Start Workout" primary CTA (one primary CTA per screen) — starts empty workout or from a template.
   - Recent workouts list (last 3, tap → detail).
   - 12-week activity calendar heatmap (GitHub-style).
   - Mini trend sparkline: weekly volume, last 8 weeks.

2. **`/log` Active Workout / Logging**
   - Exercise blocks with set rows: `set # | previous (ghost text) | weight | reps | ✓`.
   - Tap ✓ pre-fills from previous performance (redundant-entry rule); "+ Add Set" duplicates the last set.
   - Auto-start rest timer on set completion (configurable per exercise, sticky banner with skip/+30s).
   - Add exercise via searchable picker (recents first). Supports supersets (grouped block), warm-up set flag, RPE optional field, set notes.
   - Live workout duration timer; Finish → summary screen with PR badges detected (weight PR, rep PR, volume PR, est-1RM PR).
   - In-progress workout autosaved to localStorage every mutation (form-autosave rule) — survives refresh.

3. **`/exercises` Exercise Library**
   - Seeded library (~80 exercises) + custom exercise creation.
   - Filter chips: muscle group, equipment, exercise type. Search with instant filter.
   - Exercise detail: description, muscles, personal history table, est-1RM line chart, records (best weight / reps / volume / est-1RM).

4. **`/progress` Progress & Charts**
   - Tab 1 Strength: per-exercise est-1RM and top-set weight line charts, range switcher (4W/3M/6M/1Y/All).
   - Tab 2 Volume: weekly volume bar chart, muscle-group split (horizontal bar).
   - Tab 3 Body: body metrics (weight, body-fat %, measurements) line charts, quick-add entry.
   - Tab 4 Records: PR table per exercise, sortable, with dates.
   - History sub-view: full workout log list grouped by week + calendar view; each entry → read-only workout detail with repeat-as-template action.

5. **`/goals` Goals & Settings**
   - Goals: weekly workout frequency goal, strength goals (exercise × target weight/1RM × target date) with bullet-chart progress, body-metric goals.
   - Settings: units (kg/lb), theme (light/dark/system), default rest time, week start day, data export/import (JSON download / file restore), danger zone (clear data, confirmation dialog + undo toast).

### Key user flows

**Flow A — Log a workout in under 30 seconds (repeat of last routine):**
1. Dashboard → "Start Workout" → "Repeat last workout" / pick template (1 tap, 2s).
2. All exercises pre-loaded with previous weights/reps as pre-filled values.
3. Per set: tap ✓ to accept previous values (1 tap per set), or edit weight/reps first (numeric keyboards via `inputmode="decimal"`).
4. Rest timer auto-starts; user can ignore it.
5. "Finish" → auto-generated name ("Tuesday Push"), summary + PR confetti (respecting reduced-motion) → saved. Total interaction: ~10–15 taps.

**Flow B — Review weekly progress:**
1. Dashboard already answers "am I on track this week?" (goal ring + streak) with zero navigation.
2. `/progress` → default range "Last 4 weeks": weekly volume bars with this-week highlighted, est-1RM trend for pinned favorite lifts, PRs earned this week listed with dates.
3. Drill into any exercise → full history chart + table (chart + accessible data-table alternative).

**Flow C — First run (empty state):** seeded exercise library, dashboard empty states with a single "Log your first workout" action and a "Load sample template" option — never a blank chart (empty-data-state rule).

### TypeScript data model

```typescript
// ---- Enums / unions ----
type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'full-body' | 'cardio';

type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other';
type ExerciseType = 'strength' | 'cardio' | 'duration' | 'bodyweight-reps';
type SetType = 'normal' | 'warmup' | 'dropset' | 'failure';
type WeightUnit = 'kg' | 'lb';

// ---- Core entities (all persisted in localStorage, keyed stores) ----
interface Exercise {
  id: string;                    // uuid
  name: string;
  muscleGroup: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  type: ExerciseType;
  instructions?: string;
  isCustom: boolean;             // false = seeded library
  createdAt: string;             // ISO 8601
}

interface WorkoutSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  type: SetType;
  weight: number | null;         // stored in kg; converted at display
  reps: number | null;
  durationSec: number | null;    // cardio/duration exercises
  distanceM: number | null;      // cardio
  rpe: number | null;            // 6–10, optional
  isCompleted: boolean;
  notes?: string;
}

interface WorkoutExercise {
  id: string;
  exerciseId: string;
  order: number;
  supersetGroup: number | null;  // same number = superset together
  restTimerSec: number | null;   // overrides default
  sets: WorkoutSet[];
}

interface Workout {
  id: string;
  name: string;                  // auto-generated, editable
  startedAt: string;             // ISO 8601
  completedAt: string | null;    // null = in progress (autosave draft)
  durationSec: number | null;
  exercises: WorkoutExercise[];
  notes?: string;
  templateId?: string;           // if started from a template
  totalVolume: number;           // denormalized: sum(weight*reps), kg
  prs: PersonalRecord[];         // PRs earned in this workout
}

interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: Array<{
    exerciseId: string;
    order: number;
    supersetGroup: number | null;
    targetSets: number;
    targetReps: string;          // "5", "8-12"
  }>;
  lastUsedAt: string | null;
  createdAt: string;
}

interface PersonalRecord {
  id: string;
  exerciseId: string;
  workoutId: string;
  date: string;
  kind: 'weight' | 'reps' | 'volume' | 'estimated1RM';
  value: number;
}

interface BodyMetric {
  id: string;
  date: string;                  // ISO date (one entry per metric per day)
  kind: 'bodyweight' | 'bodyFatPct' | 'chest' | 'waist' | 'hips' | 'biceps' | 'thigh';
  value: number;                 // kg / % / cm
}

interface Goal {
  id: string;
  kind: 'workoutFrequency' | 'strength' | 'bodyMetric';
  title: string;
  // frequency
  targetWorkoutsPerWeek?: number;
  // strength
  exerciseId?: string;
  targetValue?: number;          // kg or est-1RM kg
  strengthMetric?: 'topSetWeight' | 'estimated1RM';
  // body metric
  bodyMetricKind?: BodyMetric['kind'];
  targetDate: string | null;
  createdAt: string;
  achievedAt: string | null;
}

interface UserSettings {
  weightUnit: WeightUnit;
  theme: 'light' | 'dark' | 'system';
  defaultRestTimerSec: number;   // default 90
  weekStartsOn: 0 | 1;           // Sun | Mon
  pinnedExerciseIds: string[];   // favorites shown on Progress default view
}

// ---- localStorage schema ----
// 'ft.version'   : number (migrations)
// 'ft.exercises' : Exercise[]
// 'ft.workouts'  : Workout[]
// 'ft.templates' : WorkoutTemplate[]
// 'ft.metrics'   : BodyMetric[]
// 'ft.goals'     : Goal[]
// 'ft.settings'  : UserSettings
// 'ft.draft'     : Workout | null   (active workout autosave)
// Estimated 1RM (Epley): weight * (1 + reps / 30), reps ≤ 12 only.
```

---

## Part 2 — Design System (from ui-ux-pro-max dataset)

### Named style
**"Vibrant & Block-based + Dark Mode (OLED)"**, secondary accents from **Motion-Driven** — the dataset's exact primary recommendation for product type *Fitness/Gym App* (products.csv row 35: "Progress tracking. Workout plans. Achievements. Motivational design"; dashboard style: User Behavior Analytics; landing pattern: Feature-Rich Showcase). Interpretation: bold block layout, large-gap sections, big numerals for stats, high-contrast energetic accents, dark-first theme with a proper light mode. Caveat from styles.csv: this style is conditional-risk on accessibility — it *requires* text contrast 4.5:1, keyboard support, visible focus, and reduced-motion support. Motion-Driven's "Do Not Use For: data dashboards" means: use motion accents on micro-interactions only, never on chart canvases.

### Color palette — exact hex, semantic tokens (colors.csv row 35 "Fitness/Gym App", dark-first; light mode derived per the dataset's `color-dark-mode` pairing rule)

| Token | Dark (default) | Light | Notes |
|---|---|---|---|
| `--primary` | `#F97316` | `#EA580C` | Energy orange (light variant darkened for 4.5:1 on white) |
| `--on-primary` | `#0F172A` | `#FFFFFF` | |
| `--secondary` | `#FB923C` | `#F97316` | Hover/graded emphasis |
| `--on-secondary` | `#0F172A` | `#0F172A` | |
| `--accent` (success/PR) | `#22C55E` | `#16A34A` | PR badges, goal-met states — always paired with icon+text, never color-only |
| `--on-accent` | `#0F172A` | `#FFFFFF` | |
| `--background` | `#1F2937` | `#F8FAFC` | |
| `--foreground` | `#F8FAFC` | `#0F172A` | |
| `--card` | `#313742` | `#FFFFFF` | |
| `--card-foreground` | `#F8FAFC` | `#0F172A` | |
| `--muted` | `#37414F` | `#F1F5F9` | |
| `--muted-foreground` | `#CBD5E1` | `#475569` | |
| `--border` | `#374151` | `#E2E8F0` | Must remain visible in both themes |
| `--destructive` | `#EF4444` | `#DC2626` | Delete workout/data |
| `--on-destructive` | `#000000` | `#FFFFFF` | |
| `--ring` (focus) | `#F97316` | `#EA580C` | 2–4px visible focus ring, never removed |

Rule: components consume only semantic tokens — no raw hex in components (`color-semantic`).

### Font pairing (Google Fonts, typography.csv)
**Headings/display: Space Grotesk (600, 700)** + **Body: DM Sans (400, 500, 700)** — the "Tech Startup" pairing ("modern, innovative, bold"), the best dataset fit for an energetic data-forward app that still has to render dense set tables cleanly. Numeric stats and timers use DM Sans with `font-variant-numeric: tabular-nums` (`number-tabular` rule).

```
https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap
```
Load with `font-display: swap`. Type scale: 12 / 14 / 16 / 18 / 24 / 32 / 48 (48 for hero stat numerals). Body ≥ 16px, line-height 1.5.

### Spacing scale
Dense/dashboard tier (skill's `--density` high preset): **4 / 8 / 12 / 16 / 24 / 32** px CSS variables (`--space-1` … `--space-6`), 8px minimum gap between touch targets, section rhythm 16/24/32, touch targets ≥ 44×44px (inputs ≥ 44px tall), max container `max-w-6xl`, breakpoints 375/768/1024/1440, bottom nav (mobile) ↔ sidebar (≥1024px).

### Chart specs (charts.csv, exact rows)
| Data | Chart | Spec from dataset |
|---|---|---|
| Est-1RM / top-set weight over time | **Line chart** (area fill 20% opacity) | Time axis; <4 data points → show stat card instead; multiple series get distinct line styles (solid/dashed), never hue alone; SVG fine <1000 pts. Label time granularity and allow range switching (`time-scale-clarity`). |
| Weekly volume | **Bar chart** (vertical, weeks on x) | Direct value labels; current week highlighted with pattern + color |
| Muscle-group split | **Horizontal bar**, sorted descending | ≤ 15 categories; never pie for this |
| Weekly goal progress | **Progress ring / bullet chart** | Number + target text beside the graphic; red/yellow/green alone insufficient |
| Multiple goals (Goals page) | **Bullet chart grid** (3–10 KPIs) | Ranges `#FFCDD2/#FFF9C4/#C8E6C9`, performance bar uses `--primary`, black 3px target marker, every range text-labeled |
| Activity consistency | **Calendar heatmap** (365 cells max/SVG) | Sequential single-hue scale (orange ramp), numeric legend, values on tooltip AND accessible table fallback |
| Library | **Recharts** (React) or **Chart.js** — both dataset-recommended for line/bar; keep one library for consistency | |

Chart accessibility (mandatory): tooltip values keyboard-reachable, data-table alternative per chart, gridlines low-contrast, data-vs-background ≥ 3:1, entrance animation respects `prefers-reduced-motion`, skeleton (not empty axes) while loading, "No data yet" empty states with guidance.

### Motion specs (motion.csv, Subtle/Standard tier — dense app, not a marketing page)
All motion transform/opacity only; every preset gated behind `matchMedia('(prefers-reduced-motion: reduce)')` → render final state immediately.

| Interaction | Duration | Easing | Spec |
|---|---|---|---|
| Button/set-row hover-press | 150–200ms | power1.out / ease-out | y: -1px, opacity 0.9; displacement < 2px; press scale 0.95–1.05 |
| List/card stagger entrance (workout list, exercise grid) | 250–350ms | ease-out | opacity 0 → 1, y: 8px, stagger 0.03s/item (max 0.04s, never > 0.1s) |
| Scroll reveal (dashboard sections) | 300–400ms | ease-out | fade + y:12px, trigger at 90% viewport, small offsets only |
| Page/route transition | 200–300ms | ease-in-out | crossfade; exit capped ~250ms, exit shorter than enter (~60–70%) |
| Skeleton shimmer | 1200–1600ms loop | sine.inOut | gradient background-position sweep; one synced loop per group; pause offscreen/hidden tab; kill on content mount |
| Rest timer / PR celebration | one-shot, ≤ 600ms | ease-out | The only "moment" animation allowed; interruptible, never blocks input |

Shared duration/easing tokens globally (`motion-consistency`); animate max 1–2 elements per view.

### Top-10 UX rules to enforce (from quick-reference.md + pro-rules.md, prioritized for this app)
1. **Contrast:** text ≥ 4.5:1 in BOTH themes, tested separately (dark mode is not inverted light mode); non-text UI/icons ≥ 3:1.
2. **Never color-only meaning:** PR green, goal red/green, heatmap intensity all need icon/text/pattern reinforcement.
3. **Touch targets ≥ 44×44px** with ≥ 8px gaps — set checkmarks, +/- steppers, chips especially; web minimum 24×24 CSS px is a floor, not a target.
4. **Visible focus rings (2–4px) + full keyboard nav**; tab order matches visual order; sticky rest-timer banner must not obscure the focused control.
5. **Numeric inputs done right:** visible labels (never placeholder-only), `inputmode="decimal"`/semantic types for mobile keyboards, validation on blur, error text below field wired via `aria-describedby`.
6. **Autosave + undo:** active workout draft persisted on every mutation; destructive actions (delete workout, clear data) get confirmation dialog AND "Undo" toast (aria-live="polite", auto-dismiss 3–5s, never steals focus).
7. **Redundant-entry elimination:** pre-fill every set from previous performance — this rule *is* the 30-second logging flow.
8. **Reduced motion respected everywhere**, including chart entrances and PR confetti; data readable immediately without animation.
9. **SVG icons only (Lucide), one family, consistent stroke width and sizing tokens** — no emoji as icons; decorative icons `aria-hidden`, icon-only buttons get `aria-label`.
10. **Layout stability:** tabular numerals for weights/timers, reserved space for async content (CLS < 0.1), skeletons over spinners for >1s work, `min-h-dvh` not `100vh`, no horizontal scroll at 375px, bottom nav ≤ 5 labeled items with active state, content inset so lists aren't hidden behind fixed bars.

Pre-delivery checklist (adapted from pro-rules.md): test at 375px, both themes independently, reduced-motion on, largest text size, keyboard-only pass, empty-state pass (fresh localStorage).
