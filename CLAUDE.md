# Fitness Track v2

React 19 + TypeScript + Emotion rebuild of a personal gym tracker (legacy single-file app preserved at `legacy/index.html`).

## Commands
- `npm run dev` — Vite dev server
- `npm run typecheck` / `npm run lint` / `npm run test:run` / `npm run build` — the CI gate (all must pass)

## Key documents (read before making product/design decisions)
- `docs/plan.md` — build plan, IA, module ownership, non-negotiables
- `docs/research/migration-spec.md` — legacy feature inventory + EXACT localStorage schema (source of truth for data)
- `docs/research/product-design-spec.md` — design tokens, fonts, chart/motion specs, UX rules
- `docs/research/architecture.md` — stack decisions + gotchas (no react-router-dom, no Emotion Babel plugin, etc.)

## Hard rules
- Data compatibility: read/write the legacy localStorage keys (`gymlog_gymlog:*`) with their exact shapes — see migration-spec gotchas. Weights stored in lbs, measurements in inches; kg/cm display-only. Optional entry fields are absent, not null.
- Import from `react-router` (never `react-router-dom`).
- Emotion css prop via `jsxImportSource` — do not add the Babel plugin or per-file pragmas.
- Components use theme tokens only — no raw hex values.
- Accessibility: ≥44px touch targets, visible focus rings, `prefers-reduced-motion` gates all animation, labels never placeholder-only, no color-only meaning.
- TypeScript is pinned to 6.0.x until typescript-eslint supports TS 7.

## Design skill
`.claude/skills/ui-ux-pro-max/` (+ companions) is installed. Python is NOT on this machine — query its CSV data files directly (Grep/Read) instead of running `scripts/search.py`.
