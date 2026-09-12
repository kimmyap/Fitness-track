# Migration Spec: "Workout Tracker — Proof I'm Not Slacking"

Source: `index.html` (~183 KB, single file: inline CSS + two inline `<script>` blocks; all app logic in one IIFE at lines 1072–4044). No build tools; external deps are Font Awesome 6.5.1 (CDN JS) and Google Fonts (Oswald + Inter). Mobile-first PWA-ish page (apple-touch meta tags, inline SVG favicon), max-width 480px.

**This document is the source of truth for the React rebuild's feature set and data compatibility.** The rebuilt app must read/write the same localStorage keys and shapes so existing user data survives.

---

## 1. Feature Inventory

Tab bar with 11 tabs, in this order (`TAB_ORDER`, line 1256): **Today, Warm-up, Lower A, Upper, Lower B, Core, Calendar, Plates, Weight, Achievements, Settings**.

### 1.1 Today tab (home base, `renderToday`, lines 3824–3980)
- **Day-of-week plan card** (hardcoded `dayPlan`): Sun=Volleyball Day, Mon=Pilates Day, Tue=Lower A, Wed=Upper, Thu=Lower B, Fri/Sat=Rest Day. Shows a "Go to {tab}" button that switches to the day's workout tab.
- **Today's Progress card** (only on lifting days): sets done today / target sets across the day's exercises, with a progress bar.
- **Program review nudge**: if ≥6 weeks since `lastProgramReviewAt`, shows a card suggesting a plan check-in; "I reviewed it" button resets the timestamp.
- **Monthly recap card**: days trained this month, total volume this month, % change vs last month.
- **Today's Checklist**: Warm-up / Lifting logged / Pilates-Volleyball (optional) / Core Finisher (optional), each with done state and quick-log buttons for Pilates, Volleyball, Core.
- **Stats strip**: streak (with fire-tier icon/label + glow), sessions this month, all-time sessions.

### 1.2 Workout tabs: Lower A, Upper, Lower B (`renderExerciseList`, lines 2260–2847)
Each renders:
- **Stats strip** (same as Today) + **quick-log Pilates/Volleyball buttons**.
- **Weekly volume recap card**: this week's total volume (Mon–Sun) with % vs last week.
- **Date picker bar**: "Logging for:" date input (max = today) for backdated logging; "Back to today" button when not today.
- **Rest timer bar** (sticky, dark): presets 60s/90s/120s, Start/Pause toggle, Reset; beeps (WebAudio 880 Hz, 0.35 s) + vibrates (`navigator.vibrate([200,100,200])`) at zero. **Auto-starts at 90 s after logging or repeating a set** (only when logging for today).
- **"✓ Finish Workout" button** → summary modal: total sets, total volume, PRs today, exercise count, warm-up set count, core/activity done, random hype line; confetti if any PR.
- **Per-exercise cards**, one per exercise in the day (built-ins minus excluded, plus non-archived custom). Collapsed card shows: progress ring (best weight ÷ goal %), exercise icon, name (+ "custom" tag), target sets × reps, PB badge with volume trend arrow (↑/↓), session badge "n/N sets today" (green when target met). Tap to expand:
  - **Info box**: form cues (variation-specific via `cuesByVariation`), muscles worked, "Watch on MuscleWiki" Google-search link.
  - **"Suggest an alternative" button**: random pick from `ALTERNATIVES`; then "Swap in {alt} for today" (one-off log mode) or "add permanently" (recurring custom exercise, prefilled).
  - Custom exercises additionally get: per-exercise **notes** (view/edit), **Archive** (hide but keep history/config), **Delete permanently** (two-tap confirm).
  - **Progression suggestion box** (RPE-based; see §4).
  - **Est. 1-Rep Max** (Epley) + **mini SVG line chart** of last 10 working-set weights with first/last date-weight labels.
  - **History** (last 15 entries, grouped by day with day headers showing set count + day volume; days with >4 sets collapse to last 4 with "Show N earlier sets" link). Each row: variation tag, set label ("Set n · reps" or warm-up), RPE tag, weight (★ + gold for PB), and actions: ✓ check, **repeat set** (re-logs same set today, starts timer), **edit** (loads values into form, "Save" mode, "Cancel edit" link), **delete** (with undo toast).
  - **Logging form**: variation `<select>` (defaults to last-used variation), warm-up-set checkbox ("won't count toward PB or 1RM", remembered per exercise per session), weight/reps/RPE inputs (prefilled from last working set or `prefillReps`), ±5 lb (±2.5 kg) weight stepper, RPE pill row 6–10 with tap-for-description hints.
  - **Variation-aware weight entry** (weight helper text updates live):
    - Barbell: enter **per-side**; total = per-side × 2 + bar (45 lb / 20 kg).
    - Trap Bar: per-side × 2 + trap-bar weight (Settings; default 55 lb / 25 kg).
    - Dumbbell: enter **one dumbbell**; total = × 2.
    - Leg Press: plates + sled weight (Settings; default 0).
    - Bodyweight / Bodyweight Lunges: weight optional (blank allowed).
    - Assisted Pull-up: enter **assistance amount**; flagged `assistedPullup`, excluded from PB/1RM/volume.
  - **Typo sanity check**: if new weight differs >40% from last logged working weight, button becomes "That's a big jump, tap again to confirm" (4 s window).
  - **PR detection**: working set with weight > previous best → confetti + toast "New PR on {ex}! …" with random hype line.
  - Double-tap guard (`logLock`, 800 ms) and "Saving..." disabled state on the button.
- **"+ Add or log an exercise not in this list"** at bottom → card with two modes: **"Add permanently"** (name, target sets/reps, optional goal weight, optional notes, optional "Replace an existing exercise?" select — replacing a built-in adds it to `excludedBuiltIns`, replacing a custom archives it, and marks the program reviewed) and **"Just log once"** (one-off name/weight/reps sets logged straight to entries; running list of today's sets with delete; doesn't create a card).

### 1.3 Warm-up tab (`renderWarmup`, lines 3218–3306)
- "Mark Warm-up Complete" toggle (adds/removes a `type:"warmup"` entry for today) + 7-day week strip of warm-up completion.
- Static content cards: Cardio (3–5 min options), "Before Lower A / Lower B" dynamic warm-up list, "Before Upper" list, "Why this matters" note.

### 1.4 Core tab (`renderCore`, lines 3334–3439)
- "Mark Core Complete" toggle (`type:"core"` entry for today) + 7-day strip.
- **The Finisher**: 4 fixed core exercises (`CORE_EXERCISES`: Plank 3×30-45 s, Dead Bug 3×10/side, Bicycle Crunches 2×15/side, Side Plank 2×20-30 s/side), each with a **"Suggest an alternative"** flow (random pick from `CORE_ALTERNATIVES`, confirm to swap, persisted in `coreOverrides`; "Revert to {original}" once swapped).

### 1.5 Calendar tab (`renderCalendar`, lines 3026–3216)
- Month grid with prev/next nav; legend. Days with lift entries highlighted green ("trained"); brass dot for warm-up/core/activity days; today outlined; selected day ringed.
- Tap a day → **detail card**: exercise count + day volume; every entry that day (activities, warm-up, core, sets with variation/RPE/weight) each deletable; "+ Pilates", "+ Volleyball", "+ Core Finisher" buttons to backfill that date; **per-day free-text note** (debounced 600 ms autosave to `notes`).

### 1.6 Plates tab (`renderPlates`, lines 3441–3499)
- **Plate calculator**: target total weight + bar select (lbs: 45/35/15/0; kg: 20/15/10/0). Greedy breakdown per side from plate sizes `[45,35,25,10,5,2.5]` lb or `[25,20,15,10,5,2.5,1.25]` kg; shows per-side weight, plate list, and "can't hit exactly — X short per side" leftover.

### 1.7 Weight tab (`renderWeight`, lines 3501–3620)
- **Bodyweight**: stats strip (latest, goal — **hardcoded 120 lb**, change since first), log-today form, last-10 history with delete+undo.
- **Body measurements**: waist/hips stats (latest + waist Δ), log form (in/cm follows unit pref, stored in inches), last-10 history with delete+undo.

### 1.8 Achievements tab (`renderAchievements`, lines 3794–3822)
- "N / 25 unlocked" summary + 3-column badge grid of the 25 achievements (see §4.7); locked badges show a padlock and a progress hint ("3 more sessions"). Unlocks fire delayed confetti + toast during use; already-earned ones are silently marked seen on load to avoid a toast backlog.

### 1.9 Settings tab (`renderSettings`, accordion sections, lines 3648–3792)
- **Where Your Data Lives**: local-storage-only warning.
- **Units & Appearance**: lbs/kg toggle (display-only conversion; storage always lbs), Light/Dark theme toggle.
- **Equipment Weights**: trap bar and leg-press sled weights.
- **Goal Weights**: editable goal per exercise (built-in + custom) → `customGoals`.
- **Archived / Replaced (N)**: restores archived custom exercises or replaced built-ins.

### 1.10 Global / cross-cutting
- **Splash screen** (coral, pulsing dumbbell) hidden ~300 ms after load.
- **Toast** system with optional Undo action (5 s).
- **Confetti** animation (24 pieces) for PRs/achievements.
- **25 random "hype lines"** shown on PRs, workout completion, warm-up/core completion.
- **Footer utilities**: "Export backup (JSON)" (downloads `gymlog-backup-YYYY-MM-DD.json`), "Import backup (JSON)" (merge-by-id; warns if the file is missing sets you have, requires second tap), "Reset all logged data" (two-tap confirm; clears entries only).
- **Save resilience**: every save retries with backoff (300/800/1800 ms); on final failure auto-downloads a backup JSON (1-minute cooldown), shows a dismissible sync-warning banner, and a "Saved Xs ago" indicator.
- **Data migration on load**: entries missing `id` get one assigned and re-saved; `lastProgramReviewAt` backfills to earliest entry date.

---

## 2. Data Model (CRITICAL — preserve exactly)

### Storage layer
A shim (lines 1045–1070) maps `window.storage` onto `localStorage` with prefix `"gymlog_"`. Logical keys themselves start with `"gymlog:"`, so **the actual localStorage keys are double-prefixed**:

| Actual localStorage key | Value type | Notes |
|---|---|---|
| `gymlog_gymlog:entries` | JSON array | main log (sets + activities + warmup/core flags) |
| `gymlog_gymlog:notes` | JSON object | per-day notes |
| `gymlog_gymlog:goals` | JSON object | custom goal weights |
| `gymlog_gymlog:bodyweight` | JSON array | weigh-ins |
| `gymlog_gymlog:achievements` | JSON array of strings | seen achievement ids |
| `gymlog_gymlog:unit` | raw string | `"lbs"` or `"kg"` (NOT JSON-quoted) |
| `gymlog_gymlog:customExercises` | JSON object | custom exercises per day |
| `gymlog_gymlog:excludedBuiltIns` | JSON object | replaced built-ins per day |
| `gymlog_gymlog:lastProgramReview` | raw string | ISO date `"YYYY-MM-DD"` (not JSON) |
| `gymlog_gymlog:coreOverrides` | JSON object | swapped core exercises |
| `gymlog_gymlog:theme` | raw string | `"dark"` or `"light"` (not JSON) |
| `gymlog_gymlog:measurements` | JSON array | waist/hips measurements |
| `gymlog_gymlog:equipmentWeights` | JSON object | trap bar / sled weights |

**All weights are stored in lbs regardless of unit preference** (kg is display-only, converted with factor 2.20462). Measurements stored in inches (cm display-only, factor 2.54).

### 2.1 `gymlog:entries` — array of entry objects (three variants in one array)

**Lift set** (the common case):
```json
{
  "id": "k3j2h1g9f81724567890123",
  "exercise": "Sumo Squats",
  "weight": 135,
  "sets": 1,
  "reps": 10,
  "date": "2026-08-28",
  "createdAt": 1724567890123,
  "rpe": 8,
  "variation": "Barbell",
  "warmupSet": true,
  "assistedPullup": true
}
```
- `id`: string, `Math.random().toString(36).slice(2) + Date.now()`. May be absent in very old data (backfilled on load).
- `exercise`: string (built-in name, custom name, or free-text one-off name).
- `weight`: number in lbs — the **total** weight (bar math already applied). Can be `0` for bodyweight variations.
- `sets`: number, always `1` for entries created by current code (older data may have >1; rendering handles `sets > 1` as "SxR").
- `reps`: number.
- `date`: `"YYYY-MM-DD"` local date string.
- `createdAt`: epoch ms; **optional** (missing on one-off logs and older entries; sort falls back to 0).
- `rpe`: integer 1–10, **only present if logged** (deleted when cleared in edit).
- `variation`: string, only present if the exercise has variations (e.g. `"Barbell"`, `"Dumbbell"`, `"Trap Bar"`, `"Kettlebell"`, `"Machine"`, `"Cable"`, `"Two-Hand"`, `"Single-Arm"`, `"Leg Press"`, `"Walking Lunges"`, `"Bodyweight"`, `"Bodyweight Lunges"`, `"Assisted Pull-up"`).
- `warmupSet`: boolean `true`, **only present when true** (key absent otherwise).
- `assistedPullup`: boolean `true`, only present when true; excluded from PB/1RM/volume.
- `dropSet`: **NEW (not legacy)**, boolean `true`, only present when true. A back-off drop
  performed pre-fatigued at reduced load. Counts toward volume and the n/N session target, but
  excluded from `bestFor`, `estimated1RM`, `isPR`, `prCountAllTime`, `suggestedNextWeight` and
  the prefill — Epley on a fatigued high-rep drop yields a 1RM that never happened.
- `toFailure`: **NEW (not legacy)**, boolean `true`, only present when true. A label only: a
  failure set counts exactly like a normal working set everywhere, PBs included, and no domain
  function reads it.

Both new fields follow the legacy convention: **absent, not `false`**. The legacy app ignores
unknown fields, so data written with either still loads in `legacy/index.html` — it simply
treats those sets as ordinary ones.

**Activity entry** (Pilates/Volleyball):
```json
{ "id": "abc1724...", "type": "activity", "activity": "Pilates", "date": "2026-08-28" }
```
`activity` is `"Pilates"` or `"Volleyball"`. No `exercise`/`weight`/`reps`.

**Warm-up / Core completion entry:**
```json
{ "id": "abc1724...", "type": "warmup", "date": "2026-08-28" }
{ "id": "abc1724...", "type": "core", "date": "2026-08-28" }
```

Discrimination logic used everywhere: lift entries have `e.exercise` truthy; others have `e.type` of `"activity" | "warmup" | "core"`. The rebuilt app must preserve this heterogeneous-array shape.

### 2.2 `gymlog:notes` — object keyed by date
```json
{ "2026-08-28": "Slept badly, squats felt heavy" }
```

### 2.3 `gymlog:goals` — object keyed by exercise name, values lbs
```json
{ "Sumo Squats": 145, "Bench Press": 115 }
```

### 2.4 `gymlog:bodyweight` — array
```json
[ { "id": "abc1724...", "date": "2026-08-28", "weight": 128.5 } ]
```
`weight` in lbs.

### 2.5 `gymlog:achievements` — array of unlocked/seen achievement id strings
```json
["first-set", "streak-3", "first-pr"]
```
Valid ids: `first-set, streak-3, streak-7, streak-14, streak-30, streak-60, workouts-10, workouts-25, workouts-50, workouts-100, sets-100, sets-500, first-pr, pr-5, pr-15, cross-train, cross-train-10, volume-10k, volume-50k, volume-100k, bodyweight-log, bodyweight-10, measure-log, rpe-20, rpe-100`.

### 2.6 `gymlog:unit` — raw string `"lbs"` | `"kg"` (default `"lbs"`)

### 2.7 `gymlog:customExercises` — object keyed by day tab name
```json
{
  "Lower A": [
    {
      "name": "Bulgarian Split Squat",
      "targetSets": 3,
      "targetReps": "8-12",
      "prefillReps": 8,
      "goal": 50,
      "custom": true,
      "notes": "Front foot far forward. Targets: quads, glutes",
      "archived": true
    }
  ]
}
```
- `goal` in lbs (default 50 if none entered), `notes` is string or `null`, `archived` optional boolean (hidden but kept). `prefillReps` = `parseInt(targetReps) || 10`.

### 2.8 `gymlog:excludedBuiltIns` — object: day → array of built-in exercise names hidden because replaced
```json
{ "Lower A": ["Sumo Squats"] }
```

### 2.9 `gymlog:lastProgramReview` — raw string `"YYYY-MM-DD"` (drives the 6-week review nudge)

### 2.10 `gymlog:coreOverrides` — object: original core exercise name → swap
```json
{ "Plank": { "name": "RKC Plank", "target": "3 x 15-20 sec" } }
```

### 2.11 `gymlog:theme` — raw string `"dark"` | `"light"` (dark only when exactly `"dark"`)

### 2.12 `gymlog:measurements` — array
```json
[ { "id": "abc1724...", "date": "2026-08-28", "waist": 29.5, "hips": 38 } ]
```
`waist`/`hips` in **inches**, either may be `null`.

### 2.13 `gymlog:equipmentWeights` — object
```json
{ "trapBar": 55, "legPressSled": 90 }
```
Both in lbs; `null` = unset (defaults: trap bar 55 lb / 25 kg; sled 0). Note `legPressSled` may be `0` explicitly (distinct from `null`).

### 2.14 Export/backup file shape (`exportData`, line 2009)
```json
{
  "entries": [], "notes": {}, "customGoals": {}, "bwEntries": [],
  "seenAchievements": [], "unitPref": "lbs",
  "exportedAt": "2026-08-28T12:00:00.000Z",
  "reason": "auto-backup after Workout log save failure"
}
```
(`reason` only in auto-backups.) **Import merges by `id`** (`mergeById`: incoming wins on conflicts), object-spreads notes/goals, unions achievements. Note: export does NOT include customExercises, excludedBuiltIns, coreOverrides, measurements, equipmentWeights, theme — the rebuild should fix that, but must still accept old backup files.

---

## 3. Exercise Database

Not a large database — a small hardcoded program of **9 built-in exercises across 3 workout days**, all inline constants at lines 1090–1256:

- **`DAYS`** (lines 1236–1255) — the program. Schema per exercise: `{ name, goal (lbs), targetSets, targetReps (string like "8-12"), prefillReps }`.
  - Lower A: Sumo Squats (goal 135, 4×8-12), Deadlifts (200, 3×6-8), Hip Thrust (175, 3×10-12), KB Swings (45, 3×15).
  - Upper: Bench Press (110, 4×6-10), Rows (90, 3×10-12), Shoulder Press (65, 3×10-12), Lat Pulldown (100, 3×8-12).
  - Lower B: Sumo Squats (135, 3×10-12), Hip Thrust (175, 4×10-12), KB Swings (45, 3×15-20), Leg Press / Lunges (155, 3×10-12).
- **`EXERCISE_VARIATIONS`** (lines 1212–1222): name → array of variation strings (drives the variation select and the weight-entry math). E.g. Deadlifts: `["Barbell","Dumbbell","Trap Bar"]`; Lat Pulldown: `["Cable","Assisted Pull-up"]`.
- **`EXERCISE_INFO`** (lines 1129–1210): name → `{ muscles: string, cuesByVariation: { [variation]: cueText, default: cueText } }`.
- **`ALTERNATIVES`** (lines 1090–1127): name → array of `{ name, reason, targetSets, targetReps, cues, muscles }` (2 alternatives per exercise) for the swap-suggestion feature.
- **`EXERCISE_ICONS`** (lines 1224–1234): name → Font Awesome icon HTML (replace with Lucide in rebuild).
- **`CORE_EXERCISES`** (lines 3308–3313) and **`CORE_ALTERNATIVES`** (lines 3315–3332): `{ name, target }` and `{ name, reason, target }`.

Custom exercises extend this at runtime via `gymlog:customExercises`. Effective list per day = `DAYS[day]` minus `excludedBuiltIns[day]`, plus non-archived customs (`exercisesForDay`, line 2908).

---

## 4. Business Logic Worth Preserving

### 4.1 1RM — Epley formula (line 1457)
```js
// Epley formula: 1RM = weight * (1 + reps/30)
const est = r.weight * (1 + r.reps / 30);   // max over all working sets, Math.round()
```
Excludes `warmupSet` and `assistedPullup` entries.

### 4.2 Volume
Everywhere: `weight * sets * reps`, summed over entries with weight/sets/reps and **not** `warmupSet` / `assistedPullup`. Weekly window is Monday–Sunday (`weekRange`: `monday.setDate(now.getDate() - ((day + 6) % 7) + offset*7)`). Monthly = calendar month. Recap %: `Math.round(((thisWeek - lastWeek) / lastWeek) * 100)`.

### 4.3 Streak (lines 1426–1439) — **gap-tolerant, counts sessions not days**
```js
// streak: count back from most recent date, allow gaps up to 4 days between sessions
let streak = 0;
if (dates.length) {
  const sorted = [...dates].sort((a,b) => new Date(b) - new Date(a));
  let prev = new Date(sorted[0]);
  const daysSinceLast = Math.floor((now - prev) / 86400000);
  if (daysSinceLast <= 4) {
    streak = 1;
    for (let i = 1; i < sorted.length; i++) {
      const cur = new Date(sorted[i]);
      const gap = Math.floor((prev - cur) / 86400000);
      if (gap <= 4) { streak++; prev = cur; } else break;
    }
  }
}
```
`dates` = unique dates from ALL entries (activities/warmup/core count toward streak). Fire tiers: ≥30 crown "Unstoppable", ≥14 "On fire", ≥7 "Heating up", ≥3 "Building", else "Getting started"; glow from ≥7.

### 4.4 Progression suggestion (`suggestedNextWeight`, lines 1477–1531)
Base increment: lower-body compounds (`["Sumo Squats","Deadlifts","Hip Thrust","Leg Press / Lunges"]`) 10 lb / 5 kg; everything else 5 lb / 2.5 kg. Uses last session's sets (latest date), `avgRPE` = mean of logged RPEs, `metReps` = every set ≥ `parseInt(ex.targetReps)` (min of range, default 8), `lastTopWeight` = max weight that session. Decision ladder:
```js
if (!metReps)                 hold  // "repeat this weight and nail your reps first"
else if (avgRPE >= 9)         hold  // "Last session was tough..."
else if (avgRPE <= 6)         + baseIncrement * 2     // "felt easy, bigger jump"
else if (avgRPE <= 7.5)       + baseIncrement * 1.5
else if (avgRPE !== null)     + baseIncrement          // 7.5–9 "sweet spot"
else                          + baseIncrement * 1.25   // no RPE logged
```

### 4.5 Weight-entry math (log handler, lines 2784–2789)
```js
const wInput = isBarbell  ? (w ? w * 2 + barWeight() : 0)        // barWeight: 45 lb / 20 kg
  : isDumbbell ? (w * 2)
  : isTrapBar  ? (w ? w * 2 + trapBarWeight() : 0)               // default 55 lb / 25 kg
  : isLegPress ? (w ? w + legPressSledWeight() : 0)              // default 0
  : w;
const stored = fromDisplayWeight(wInput);   // kg→lbs: * 2.20462, rounded to 0.1
```
Reverse math when prefilling the edit form (per-side = (total − bar)/2, per-dumbbell = total/2). Unit conversion: `toDisplayWeight` = `Math.round((lbs / 2.20462) * 10) / 10`.

### 4.6 PR / PB logic
`bestFor(exName)` = entry with max weight among non-warmup entries (does NOT exclude assistedPullup here, but assisted sets are prevented from triggering PR toasts at log time). PR fires when working, non-assisted, non-bodyweight set weight > previous best. `prCountAllTime` counts every chronological new max per exercise (first log counts as a PR).

### 4.7 Achievements (25, lines 1607–1633)
Thresholds — streak: 3/7/14/30/60; total sessions: 1/10/25/50/100; working sets: 100/500; PRs: 1/5/15; cross-training days: 1/10; total volume lbs: 10k/50k/100k; weigh-ins: 1/10; measurements: 1; RPE-logged sets: 20/100. `totalSets` = entries with `exercise` and not `warmupSet`. Progress hints show remaining amount.

### 4.8 Sanity check (typo guard, line 2797)
```js
const pctChange = Math.abs(w - lastLogged.weight) / lastLogged.weight;
if (pctChange > 0.4) { /* require second tap */ }
```

### 4.9 Plate calculator (lines 3466–3496)
Greedy: `perSide = (target - barWeight) / 2`, iterate plate sizes descending, `while (remaining >= p - 0.001)`; report leftover shortfall.

### 4.10 Misc worth keeping
- Rest timer auto-start 90 s after each logged/repeated set (today only).
- `weeksSinceReview()` ≥ 6 triggers the program-review card.
- Import merge-by-id with "would lose N sets" warning gate.
- Save retry (300/800/1800 ms) + auto-download backup on failure.
- Bodyweight goal hardcoded **120 lb** (line 3508) — make this a setting in the rebuild.

---

## 5. Current UX Flow: Logging a Workout

1. Open app → splash → **Today** tab shows the day's plan (e.g. Tuesday → "Lower A") with a "Go to Lower A" button.
2. (Optional) **Warm-up** tab → do the listed routine → "Mark Warm-up Complete".
3. On the workout tab, optionally change the "Logging for" date (defaults to today).
4. Tap an exercise card to expand it. Read form cues / the RPE-based suggestion ("Suggested: 140lbs (+5lbs)...").
5. Pick a **variation** (defaults to last used), optionally tick **Warm-up set**, enter weight (per-side for barbell/trap bar, per-dumbbell for DBs — helper text shows computed total), reps (prefilled from last set), optional RPE (pills or typed). Tap **Log Set**.
6. Set appears in history with a ✓; the **90 s rest timer auto-starts** in the sticky bar; PR triggers confetti + hype toast; session badge ticks up (e.g. "2/4 sets today").
7. Repeat via the **repeat icon** on a prior set, or edit/delete mistakes (delete has an Undo toast; >40% weight jumps require confirm).
8. Between exercises, use timer presets; use **Plates** tab to figure loading.
9. Extras: quick-log Pilates/Volleyball, Core Finisher tab, one-off exercise via "+ Add or log an exercise not in this list".
10. Tap **"✓ Finish Workout"** → summary modal (sets, volume, PRs, hype line, confetti).

---

## 6. Current Visual Design (brief — being redesigned)

- **Mobile-first**, single column, max-width 480 px, card-based layout. Fonts: **Oswald** (uppercase condensed headings, stat numbers) + **Inter** (body). Font Awesome 6 icons.
- **Light theme** (default): warm paper `#FBF6EE` background, white cards, ink `#1E2235`, hairline `#E8E0D2`. Accents: **coral `#FF6B4D`** (primary buttons/brand), **brass `#E8A23D`** (PBs, streaks, progress rings), **sage `#14A085`** (suggestions/positive), **done green `#38D178`**. Each accent has a "soft" pastel variant.
- **Dark theme** via `.dark-mode` on `#gt-root` + `body.gt-dark-body`: bg `#14161F`, cards `#1C1F2C`, brightened accents (`--coral: #FF7A5C`, `--brass: #F0B860`, `--sage: #2FD1B0`). All theming through CSS custom properties — easy to port.
- Patterns: pill-style flex tab bar (active = inverted ink), rounded 10 px cards with soft shadows and fade-in animation, sticky dark rest-timer bar, stat-tile strips of 3, progress rings (SVG stroke-dashoffset) and gradient load bars, green "logged" row highlights, pill badges (PB brass, session, RPE, variation tags), toasts bottom-center, centered modal cards, confetti overlay, accordion sections in Settings, coral splash screen.

---

## Rebuild gotchas checklist
1. localStorage keys are literally `gymlog_gymlog:entries` etc. (double prefix) — read/write these exact keys.
2. `unit`, `theme`, `lastProgramReview` are **raw strings**, not JSON.
3. All stored weights are lbs; measurements are inches; kg/cm are display-only conversions.
4. `entries` is a heterogeneous array (lift sets + `type: activity|warmup|core` rows); optional keys (`rpe`, `variation`, `warmupSet`, `assistedPullup`, `createdAt`, even `id` in legacy data) are *absent*, not null/false.
5. `sets` is always 1 in new entries but legacy entries may have >1; volume math multiplies by it.
6. Streak counts *sessions* with ≤4-day gaps, and non-lift entries count toward it.
7. Backup import must merge by id (never replace) and tolerate the old export shape that lacks customExercises/measurements/etc.
