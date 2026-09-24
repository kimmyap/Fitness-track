# Repo facts — paste this into other tools

When you draft a prompt somewhere that cannot see this codebase (Gemini, ChatGPT, a notes app),
paste the block below at the top of it first. Everything in it has been wrong in a real prompt at
least once, and each wrong premise cost a round trip.

**Then describe the symptom, not the implementation.** "Custom exercises don't offer alternative
suggestions" gets the right fix immediately. "Add a `getAlternativesForExercise` function that
imports exerciseLibrary.json" gets a function that already exists in better form and adds 1.2 MB
to first load. If you want a specific file changed, paste the file — not a guess at its path.

---

```
STACK — do not assume otherwise
- Vite single-page app. NOT Next.js. No app/ directory, no pages/, no server components,
  no 'use client', no server actions, no API routes. It is static files on GitHub Pages.
- React 19, TypeScript 6.0.x (pinned), Vite 8, Zustand 5, Recharts, zod/mini, lucide-react.
- Emotion for styling via the css prop (jsxImportSource). NOT Tailwind. Tailwind class names
  like `flex gap-2 text-orange-500` do nothing — they are inert strings.
- Routing is `react-router` v8. Import from 'react-router', NEVER 'react-router-dom'.
- No `import React from 'react'` and no `React.FC`. Components are
  `export function Name({ a, b }: Props)`. The JSX runtime is automatic.
- Node >= 22.12 (24 in CI). Python is NOT installed.

WHERE THINGS ACTUALLY ARE
- src/lib/types.ts        hand-written TypeScript types (the data contract)
- src/lib/schemas.ts      zod/mini validators  (NOT src/schemas/*)
- src/lib/storage.ts      every localStorage accessor; the riskiest file in the repo
- src/lib/domain.ts       pure business logic (1RM, PRs, streaks, achievements)
- src/lib/program.ts      static program data: DAYS, ALTERNATIVES, WARMUP_ROUTINE
- src/stores/*.ts         Zustand stores, one per storage key
- src/features/<area>/    UI by feature: today, train, calendar, progress, metrics, more
- src/components/         shared primitives (Button, Card, Modal, NumberInput, Badge…)
- src/data/exerciseLibrary.json   876-entry generated library (see LAZY below)
- Tests are COLOCATED: Foo.tsx -> Foo.test.tsx beside it. There is no src/tests/ folder.
  Playwright end-to-end specs are the only exception: e2e/*.spec.ts

DATA RULES (these are hard constraints, not preferences)
- localStorage ONLY. No database, no server, no auth, no sync, no user accounts.
- Keys are double-prefixed: logical `gymlog:entries` -> actual `gymlog_gymlog:entries`.
- Weights are stored in POUNDS, lengths in INCHES. kg/cm are display-only conversions.
- Optional fields are ABSENT, never null and never false. `warmupSet` is either `true` or
  the key does not exist.
- New keys may be added. Existing keys must keep their exact shape forever — real history
  lives in them.
- Adding a key means updating TWO hand-written backup payloads: buildBackupPayload in
  src/lib/storage.ts and src/features/more/backup.ts. Miss either and the data is silently
  absent from every export.

TYPES vs SCHEMAS — deliberate, do not invert
- types.ts is the source of truth for shapes. schemas.ts only CHECKS them.
- Validation never transforms: callers use the original parsed value, never zod's output,
  so unknown fields written by a newer build survive being read by an older one.
- Do NOT derive types with z.infer. These are looseObject schemas, so z.infer produces
  `{...} & {[k: string]: unknown}` — less precise than what is already there — and it would
  make a schema tweak silently redefine the stored data contract.
- Maps of the user's own content drop bad ROWS; only config maps fall back wholesale.

STYLING / DESIGN
- Components consume theme tokens only (theme.colors.primary, theme.space[3]…). NEVER raw hex,
  and never a Tailwind palette name.
- Dark AND light themes both ship. Anything hardcoded to white or black breaks one of them.
- Phone-first: everything must work at 375px wide.
- Accessibility is enforced: text >= 4.5:1 in both themes, >= 44px touch targets, visible focus
  rings, prefers-reduced-motion gates animation, and colour alone never carries meaning —
  always pair it with an icon or a word.

LAZY — the easiest expensive mistake
- src/data/exerciseLibrary.json is 1.2 MB and is loaded by DYNAMIC import in
  src/services/exerciseLibraryService.ts. Never `import library from './exerciseLibrary.json'`;
  a static import doubles first-paint bundle size. Fetch it on demand, and gate that on the
  user actually opening the thing that needs it.

WORKFLOW
- Propose the exact files to touch and wait for approval before writing code.
- Ask before adding any dependency, and quote the bundle-size delta.
- Check what already exists before writing it — duplicated work is the expensive failure here.
- Commits go straight to main, which auto-deploys. The gate must pass first:
  npm run typecheck && npm run lint && npm run test:run && npm run build
```

---

## Things that already exist (check before asking for them)

Requests for these have come in more than once. They are built:

| Asked for | Already there |
|---|---|
| Alternative exercises | `ALTERNATIVES` in `program.ts` (9 built-ins) + library fallback for everything else |
| A barbell logo/icon | `src/components/BarbellIcon.tsx`, and the PWA icons in `public/icons/` |
| Exercise categories | `movement_pattern`, `category`, `primary_muscles` on every library entry |
| Two-tap delete confirmation | `ConfirmDeleteAction`; `ConfirmTap` for full-width destructive actions |
| Progress bars / rings | `ProgressRing`, and the bar in `TodayProgressCard` |
| Per-exercise notes, archiving, reordering, day reassignment | all in `ExerciseCard` / Settings |
| An exercise → muscle schema | `primary_muscles` / `secondary_muscles` on all 876 library rows, 17 groups (`MUSCLE_GROUPS` in `types.ts`) |
| Volume per muscle group | `muscleVolumeSummary` in `features/progress/chartData.ts`, shown as Progress → Charts → Muscle volume |
| Weekly set balance / recovery status | `muscleBalance` in `features/progress/muscleBalance.ts`, shown as Progress → Recovery |
| Exercise suggestions | `alternativesFor` / `libraryAlternativesFor` (curated `alternative_ids`, ~4 per row) and the Recovery tab's drawer |
| Matching a typed exercise name to muscles | `lookupExercise` (exact / singular / unique prefix, refuses ambiguity) then `resolveMuscle` in `features/progress/muscleResolve.ts` (notes → unanimous token match → muscle word), with `gymlog:muscleMap` as the user override |

The app is called **Fitness Track**. `gymlog` is only the legacy storage-key prefix — it is not
the product name.
