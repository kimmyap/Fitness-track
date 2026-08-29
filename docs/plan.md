# Rebuild Plan — Fitness Track v2

React 19 + TypeScript + Emotion rebuild of the legacy single-file gym tracker (`legacy/index.html`), redesigned with the ui-ux-pro-max design system.

## Source-of-truth documents
- **Features + data model + business logic**: `docs/research/migration-spec.md` — the rebuilt app must preserve every feature and read/write the EXACT legacy localStorage keys (`gymlog_gymlog:*`) so existing data survives. No new data model.
- **Visual design + UX rules**: `docs/research/product-design-spec.md` Part 2 — design tokens, fonts, chart specs, motion specs, top-10 UX rules. (Part 1's generic data model is superseded by the migration spec; its UX flow principles still apply.)
- **Stack + configs + gotchas**: `docs/research/architecture.md`.
- **CI/deploy**: `docs/research/deploy-pipeline.md` (already implemented in `.github/`).

## Redesign: information architecture

Legacy 11 tabs consolidate into 5 routes (bottom nav on mobile, sidebar ≥1024px), preserving every feature:

| Route | Contains (legacy tabs) |
|---|---|
| `/` **Today** | Today (day plan card, today's progress, checklist, stats strip, monthly recap, program-review nudge, quick-log Pilates/Volleyball/Core) |
| `/train` **Train** | Lower A / Upper / Lower B as segmented sub-tabs (`/train/lower-a` etc.), plus Warm-up and Core as sections/sub-tabs. Rest timer, date picker, exercise cards, logging, finish-workout summary. |
| `/calendar` **Calendar** | Calendar month grid + day detail + per-day notes |
| `/progress` **Progress** | Sub-tabs: Charts (per-exercise est-1RM/top-weight lines via Recharts, weekly volume bars), Body (bodyweight + measurements, from legacy Weight tab), Achievements (25-badge grid) |
| `/more` **More** | Plate calculator, Settings (units, theme, equipment weights, goal weights, archived/replaced), data export/import/reset |

Keep the app's personality: hype lines, confetti (reduced-motion-gated), fire-tier streaks, "Proof I'm Not Slacking" title.

## Theme

Emotion `ThemeProvider` with the design-spec tokens (dark-first orange palette, light mode variant), Space Grotesk (display/stats) + DM Sans (body, `tabular-nums` for numerals), spacing scale 4/8/12/16/24/32, radii, motion tokens. Theme switching: `light | dark | system`, persisted to legacy `gymlog_gymlog:theme` key (`"dark"`/`"light"` raw strings; treat missing as light to match legacy, `system` stored as absence — see storage layer). Lucide icons only.

## Module ownership (build phases)

### Phase 1 — Foundation (single agent, blocks everything)
- `src/lib/storage.ts` — typed accessors for every legacy key (exact names, raw-string vs JSON quirks, save-retry + backup-download behavior).
- `src/lib/domain.ts` (+ `domain.test.ts`) — ported verbatim from legacy: Epley 1RM, volume, week ranges, gap-tolerant streak + fire tiers, progression suggestion ladder, weight-entry variation math, PR/PB logic, achievements (25 defs + progress hints), plate calculator, unit conversions, typo guard threshold, ID generation. Unit-tested.
- `src/lib/program.ts` — DAYS, EXERCISE_VARIATIONS, EXERCISE_INFO, ALTERNATIVES, CORE_EXERCISES, CORE_ALTERNATIVES, hype lines, day-of-week plan: ported VERBATIM from `legacy/index.html` (lines ~1090–1332, 3308–3332; hype lines near the toast/confetti code). Map exercise icons to Lucide equivalents.
- `src/stores/` — Zustand stores backed by the legacy storage layer (entries, bodyweight, measurements, settings, custom exercises, achievements seen…). Every mutation persists immediately.
- `src/theme.ts`, `src/emotion.d.ts`, global styles, `src/main.tsx`.
- `src/app/router.tsx` + `src/app/layouts/AppLayout.tsx` (responsive bottom-nav/sidebar shell, route-level code splitting optional) with stub pages per route so the app compiles and runs.
- `src/components/` shared UI kit: Button, IconButton, Card, StatTile, ProgressRing, SegmentedTabs, Modal, Toast system (with Undo), ConfirmTap (two-tap destructive), Input/NumberStepper, Badge, EmptyState, Skeleton, Confetti (reduced-motion aware), WeekStrip.
- `src/test/setup.ts` + `renderWithTheme` helper.
- Gate: `npm run typecheck && npm run lint && npm run test:run && npm run build` all green.

### Phase 2 — Features (3 parallel agents, disjoint folders)
- **Agent A**: `src/features/today/` + `src/features/train/` (exercise cards, logging form with variation math UI, RPE pills, rest timer with WebAudio beep + vibration, finish-workout summary modal, alternative-swap flow, custom/one-off exercise flows, backdated logging).
- **Agent B**: `src/features/calendar/` + `src/features/progress/` (month grid, day detail + notes; Recharts progress charts per design spec, body metrics, achievements grid).
- **Agent C**: `src/features/more/` (plate calculator, settings accordions, export/import/reset with legacy backup-file compatibility) + project `README.md`.
- Feature agents only ADD files in their folders and only EDIT their route's stub wiring; shared code is read-only (request changes via report instead of editing).

### Phase 3 — Integration & QA
- Typecheck/lint/test/build, run dev server, browser-verify all routes at 375px and desktop, both themes, keyboard pass, legacy-data smoke test (seed localStorage with legacy-shaped data, confirm it renders), design review against the top-10 UX rules, fix findings, commit.

## Non-negotiables (from the research)
- Exact legacy localStorage keys and value shapes (see migration-spec gotchas checklist).
- All weights stored lbs, measurements inches; kg/cm display-only.
- Optional entry fields are ABSENT not null.
- Import merges by id; accepts old backup shape. New exports may add fields but must keep old ones.
- No `react-router-dom`. No Emotion Babel plugin. Import router APIs from `react-router`.
- Semantic theme tokens only in components (no raw hex).
- Touch targets ≥44px, visible focus rings, `prefers-reduced-motion` gates all animation, `inputmode="decimal"` on numeric fields, labels never placeholder-only.
