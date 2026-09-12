# Fitness Track v2

React 19 + TypeScript + Emotion rebuild of a personal gym tracker (legacy single-file app preserved at `legacy/index.html`).

## Commands
- `npm run dev` — Vite dev server
- `npm run typecheck` / `npm run lint` / `npm run test:run` / `npm run build` — the CI gate (all must pass)

## How to work in this repo (authoritative)

These rules travel with the repo on purpose — do not assume an equivalent exists in a global
or parent-directory `CLAUDE.md`. They apply on every account and every machine.

### Usage efficiency
- Before making changes, propose a short plan naming the exact files you'll touch. **Wait for
  approval before writing code.**
- Only read files directly relevant to the task. Ask before exploring beyond them.
- Fix only what was requested. No drive-by refactors, renames, or style cleanup unless asked.
- Run only the test file(s) affected by the change, never the full suite unless asked. Exception:
  run the whole gate before a commit.
- Keep summaries short: one line per file changed.

### Sub-agents
- Only spawn a sub-agent when there are 2+ genuinely independent tasks that benefit from running
  in parallel.
- Never spawn a sub-agent for sequential work, small fixes, or single-file changes. Do those in
  the main thread.
- Sub-agents should return a concise summary, not full file contents.
- `docs/plan.md` describes a finished three-parallel-agent build phase. It is history — do not
  spin up parallel agents because that plan mentions them.

### When to ask, when to just ship
- **Bugs: fix and push.** No approval needed, including for regressions from your own
  deploys. A live bug is worth more than a round trip.
- **Ask first for**: new features, design choices with more than one defensible answer, and
  any new dependency (it costs bundle size — quote the delta when proposing).
- **`git fetch origin main` before you start.** Work has already been duplicated in this repo
  by branching off a stale clone and rebuilding something the remote already had.
- Redundant work is the expensive failure here, not an extra question. Check what exists
  before writing it.

### Commits
- Straight to `main`; `main` auto-deploys. Run the full gate first.
- Match the existing `git log` style: imperative subject, numbered body explaining root causes,
  an explicit data-safety statement when storage keys are touched, and verification evidence
  (test count, gate status, what was checked in the browser). See `docs/HANDOFF.md` §4.

## Design System (authoritative)

Dark-first, "Vibrant & Block-based". Components consume **theme tokens only — never raw hex**.

| Role | Token | Dark | Light |
|---|---|---|---|
| App background | `colors.background` | `#1F2937` | `#F8FAFC` |
| Cards / surfaces | `colors.card` | `#313742` | `#FFFFFF` |
| Primary accent, action buttons, active set borders | `colors.primary` | `#F97316` | `#EA580C` |
| Text on primary | `colors.onPrimary` | `#0F172A` | `#FFFFFF` |
| Completed sets / PRs (fill) | `colors.accent` + `colors.onAccent` | `#22C55E` + `#0F172A` | `#16A34A` + `#FFFFFF` |
| Green text / icons / chart strokes | `colors.accentText` | `#22C55E` | `#16A34A` |

Rest timers use the inverted bar (`foreground` background) with a Timer icon; the
digits turn `accentText` green only once a countdown finishes.

Fonts: Space Grotesk (display/stats) + DM Sans (body, `tabular-nums` for numerals). Spacing scale 4/8/12/16/24/32.

**Known contrast gaps in this palette** (kept deliberately — the look was chosen over strict AA;
fix by darkening the token if it ever matters): light-mode `primary` as text or with white text on it
is 3.56:1, light-mode `accent` likewise 3.30:1, and dark-mode `primary` as text on a card is 4.27:1.
Everything else clears 4.5:1. Dark-mode fills (`onAccent` on `accent` 7.83:1, `onPrimary` on
`primary` 6.37:1) are fine.

## Plate Math (authoritative)
- Plate-loaded movements **always support both input modes**: `total` (type the whole number) and `perSide` (type plates per side; app adds the bar).
- `perSide` adds the standard bar: **45 lb / 20 kg** (Trap Bar uses its own configurable weight from Settings).
- The chosen mode is remembered **per exercise** in `gymlog:weightInputModes` so repeat exercises pre-fill the way you last logged them, on top of the existing last-working-set prefill.
- Mode is an input convenience only — **storage is always the total in lbs** (see data rules).
- Exercises show category icons: barbell for plate-loaded compounds, dumbbell for isolations, timer for rest.

## Hard rules
- Data compatibility: read/write the legacy localStorage keys (`gymlog_gymlog:*`) with their exact shapes — see `docs/research/migration-spec.md` gotchas. Weights stored in **lbs**, measurements in **inches**; kg/cm are display-only. Optional entry fields are **absent, not null**. New keys may be added; existing ones must keep their exact shape.
- Import from `react-router` (never `react-router-dom`).
- Emotion css prop via `jsxImportSource` — do not add the Babel plugin or per-file pragmas.
- Accessibility: aim for text ≥4.5:1 in **both** themes (see the documented palette exceptions above), ≥44px touch targets, visible focus rings, `prefers-reduced-motion` gates all animation, labels never placeholder-only, no color-only meaning (pair color with icon + text).
- Zustand v5: array/object-returning store selectors are `getState()`-only. Passing one to the hook causes infinite render loops — subscribe to raw slices and derive with `useMemo`.
- TypeScript is pinned to 6.0.x until typescript-eslint supports TS 7.

## Key documents
- `docs/HANDOFF.md` — **read first if you are new to this repo**: doc precedence and known drift, working loop, commit convention, CI/deploy facts, and the current gap list
- `docs/plan.md` — build plan, IA, module ownership
- `docs/research/migration-spec.md` — legacy feature inventory + exact localStorage schema (source of truth for data)
- `docs/research/product-design-spec.md` — original researched design spec (superseded on palette by the Design System table above)
- `docs/research/architecture.md` — stack decisions + gotchas

## Design skill
`.claude/skills/ui-ux-pro-max/` (+ companions) is installed. Python is NOT on this machine — query its CSV data files directly (Grep/Read) instead of running `scripts/search.py`.
