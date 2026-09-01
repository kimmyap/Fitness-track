# Fitness Track v2

React 19 + TypeScript + Emotion rebuild of a personal gym tracker (legacy single-file app preserved at `legacy/index.html`).

## Commands
- `npm run dev` — Vite dev server
- `npm run typecheck` / `npm run lint` / `npm run test:run` / `npm run build` — the CI gate (all must pass)

## Design System (authoritative)

Dark-first. Components consume **theme tokens only — never raw hex**.

| Role | Token | Dark | Notes |
|---|---|---|---|
| App background | `colors.background` | `#121212` | True dark, OLED-friendly |
| Cards / surfaces | `colors.card` | `#1E1E1E` | High-contrast dark gray |
| Primary accent / action buttons / active set borders | `colors.primary` | `#FF6D00` | High-energy orange |
| Text **on** orange | `colors.onPrimary` | `#121212` | Must be dark — white on `#FF6D00` is 2.82:1 and fails WCAG AA |
| Rest timers | `colors.timer` | `#00B0FF` | Ice blue. Timer-only; do not reuse as a generic accent |
| Completed sets / PRs (fill) | `colors.accent` + `colors.onAccent` | `#2E7D32` + `#FFFFFF` | Sage green fill with white checkmark = 5.13:1, passes |
| Completed/PR **text or icon on dark** | `colors.accentText` | `#4CAF50` | Sage `#2E7D32` as text on dark is only 3.25–3.65:1. Use this lighter green for text, strokes, and standalone icons |

Fonts: Space Grotesk (display/stats) + DM Sans (body, `tabular-nums` for numerals). Spacing scale 4/8/12/16/24/32.

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
- Accessibility: text ≥4.5:1 in **both** themes, ≥44px touch targets, visible focus rings, `prefers-reduced-motion` gates all animation, labels never placeholder-only, no color-only meaning (pair color with icon + text).
- Zustand v5: array/object-returning store selectors are `getState()`-only. Passing one to the hook causes infinite render loops — subscribe to raw slices and derive with `useMemo`.
- TypeScript is pinned to 6.0.x until typescript-eslint supports TS 7.

## Key documents
- `docs/plan.md` — build plan, IA, module ownership
- `docs/research/migration-spec.md` — legacy feature inventory + exact localStorage schema (source of truth for data)
- `docs/research/product-design-spec.md` — original researched design spec (superseded on palette by the Design System table above)
- `docs/research/architecture.md` — stack decisions + gotchas

## Design skill
`.claude/skills/ui-ux-pro-max/` (+ companions) is installed. Python is NOT on this machine — query its CSV data files directly (Grep/Read) instead of running `scripts/search.py`.
