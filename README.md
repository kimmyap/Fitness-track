# Fitness Track

**"Proof I'm Not Slacking"** — a personal gym tracker for a 3-day lifting program (Lower A / Upper / Lower B) plus warm-ups, core finishers, Pilates and volleyball days. This is v2: a React rebuild of the original single-file app (preserved at [`legacy/index.html`](legacy/index.html)) that keeps every feature **and every byte of existing data**.

![App screenshot placeholder](docs/screenshot.png)
*Screenshot coming soon — run `npm run dev` to see it live.*

## Features

- **Today** — day-of-week plan, today's progress, checklist (warm-up / lifting / cross-training / core), streak with fire tiers, monthly recap, program-review nudge
- **Train** — per-exercise cards with logging (variation-aware bar math, warm-up sets, RPE pills), rest timer with beep + vibration, PR detection with confetti, RPE-based progression suggestions, alternative-exercise swaps, custom and one-off exercises, backdated logging, finish-workout summary
- **Calendar** — month grid of training days, day detail with per-day notes and backfill actions
- **Progress** — est. 1RM and top-weight charts, weekly volume, bodyweight + measurements, 25 achievements
- **More** — plate calculator, settings (units, theme, equipment weights, goal weights, archived/replaced exercises) and data management (export / import / reset)

## Stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vite.dev/)
- [Emotion](https://emotion.sh/) for styling (semantic theme tokens, light/dark/system)
- [Zustand](https://zustand.docs.pmnd.rs/) stores with write-through persistence to localStorage
- [React Router](https://reactrouter.com/) (`react-router` package), [Recharts](https://recharts.org/), [Lucide](https://lucide.dev/) icons
- Vitest + Testing Library

## Getting started

Requires Node.js 22.12+ (Node 24 LTS recommended).

```bash
npm install       # install dependencies
npm run dev       # Vite dev server
npm run typecheck # tsc -b --noEmit
npm run lint      # eslint src
npm run test:run  # vitest, single run
npm run build     # typecheck + production build to dist/
```

Typecheck, lint, tests and build are the CI gate — all four must pass.

## Deployment

Deploys to **GitHub Pages** via GitHub Actions (`.github/workflows/ci-deploy.yml`): every push and PR runs the full CI gate; pushes to `main` additionally build and deploy, with a `404.html` copy of `index.html` as the SPA deep-link fallback.

One-time repo setup: **Settings → Pages → Source → "GitHub Actions"**. The Vite `base` (and router basename) match the repo name, e.g. `/Fitness-track/`. Dependabot keeps npm and Actions dependencies fresh (`.github/dependabot.yml`).

See [`docs/research/deploy-pipeline.md`](docs/research/deploy-pipeline.md) for the full pipeline rationale.

## Data storage, backup & restore

**All data lives in your browser's localStorage — on this device, in this browser only.** Nothing is synced to any account. Clearing site data (or switching browsers/devices) will not show your history, so export backups regularly.

- **Export** (More → Data): downloads `gymlog-backup-YYYY-MM-DD.json` containing your full log plus settings-adjacent data (custom exercises, replaced built-ins, core swaps, measurements, equipment weights).
- **Import**: merges a backup **by entry id — nothing is ever deleted**. If the file is missing sets you currently have (an older backup), the app warns and asks for a second confirmation before merging.
- **Reset all logged data**: two-tap confirm; clears logged entries only (settings, goals and bodyweight stay).
- Failed saves retry automatically with backoff; if storage still fails, a backup auto-downloads and a warning banner appears.

### Legacy-data compatibility

v2 reads and writes the **exact** localStorage keys and value shapes of the original app (`gymlog_gymlog:entries`, `gymlog_gymlog:unit`, …), so opening v2 in a browser that ran the legacy app picks up all existing history with no migration step. Backup files exported by the legacy app import cleanly (new export fields are optional). Weights are stored in lbs and measurements in inches; kg/cm are display-only conversions. [`docs/research/migration-spec.md`](docs/research/migration-spec.md) is the source of truth for the schema.

## Project structure

```
├── .github/               # CI + deploy workflow, Dependabot
├── docs/
│   ├── plan.md            # build plan, IA, module ownership
│   └── research/          # migration spec, design spec, architecture, deploy pipeline
├── legacy/index.html      # the original single-file app (reference for behavior)
└── src/
    ├── app/               # router + responsive layout shell
    ├── components/        # shared UI kit (Button, Card, Toast, ConfirmTap, …)
    ├── features/
    │   ├── today/         # day plan, checklist, stats
    │   ├── train/         # workout tabs, logging, rest timer
    │   ├── calendar/      # month grid + day detail
    │   ├── progress/      # charts, body metrics, achievements
    │   └── more/          # plate calculator, settings, data export/import
    ├── lib/               # storage (legacy keys), domain logic (ported verbatim), program data
    ├── stores/            # Zustand stores, write-through to localStorage
    ├── test/              # test setup + helpers
    └── theme.ts           # design tokens (light/dark)
```

## Docs

- [`docs/plan.md`](docs/plan.md) — rebuild plan and non-negotiables
- [`docs/research/migration-spec.md`](docs/research/migration-spec.md) — feature inventory + exact data model
- [`docs/research/product-design-spec.md`](docs/research/product-design-spec.md) — design system (tokens, charts, motion, UX rules)
- [`docs/research/architecture.md`](docs/research/architecture.md) — stack decisions and gotchas
- [`docs/research/deploy-pipeline.md`](docs/research/deploy-pipeline.md) — hosting and CI/CD research

## Credits

The design system was derived using [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
by Next Level Builder, vendored under `.claude/skills/` (MIT — see
[`.claude/skills/LICENSE-ui-ux-pro-max`](.claude/skills/LICENSE-ui-ux-pro-max)).
