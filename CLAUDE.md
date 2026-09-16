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
| Achievement tier — bronze | `colors.tierBronze` | `#D9A06B` | `#8A4F21` |
| Achievement tier — silver | `colors.tierSilver` | `#C3CEDD` | `#5A6B80` |
| Achievement tier — gold | `colors.tierGold` | `#F0C24B` | `#8A6100` |
| Achievement tier — platinum | `colors.tierPlatinum` | `#7FD8E8` | `#0E7490` |

Tier colours are used as the unlocked badge's border **and** as the tier word on it, so each clears
4.5:1 as text on `card` in its own theme (measured: bronze 5.23:1 dark / 6.52:1 light, and every other
tier higher). The tier is always spelled out beside the colour — never colour alone. Tier and category
are **derived** from each achievement's existing `metric` and `threshold` (see `achievementTier` /
`achievementCategory` in `domain.ts`), not stored per definition, so a new achievement classifies itself.

Rest timers use the inverted bar (`foreground` background) with a Timer icon; the
digits turn `accentText` green only once a countdown finishes.

Fonts: Space Grotesk (display/stats) + DM Sans (body, `tabular-nums` for numerals). SELF-HOSTED
from `public/fonts/` as two variable woff2 files — never re-point these at the Google CDN, see
`docs/HANDOFF.md` gap #7. Spacing scale 4/8/12/16/24/32.

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

## Audit findings — pitfalls that cost real time (2026-09-13)

These are recorded because each was a live bug or a false premise, not a hypothetical.

- **Validation drops ROWS, not maps.** A whole-map fallback in `5eda04b` let one bad custom
  exercise empty the entire library, and the Settings "Archived" section only renders when
  non-empty, so the restore UI vanished with it — it read as permanent data loss. Readers for
  the user's own authored content use `keepValid` / `keepValidEntries`; only regenerable config
  maps may fall back wholesale.
- **Reading never writes.** A malformed row stays byte-identical on disk. Tests assert this.
- **Adding a key touches TWO payloads** (`buildBackupPayload` in `storage.ts`, and
  `src/features/more/backup.ts`). Six keys are currently outside both and it is unowned — see
  `docs/HANDOFF.md` §2 for the table. `warmupProgress` is the one deliberate omission.
- **`exerciseLibrary.json` (1.2 MB) must stay a DYNAMIC import**, gated on the user opening the
  thing that needs it — not on mount. Re-check with: 0 requests for the chunk on the Train page,
  1 after expanding a card. Since routes went lazy this is also enforced at build time:
  `vite-plugin-sw-precache.ts` walks each route chunk's STATIC imports only, so the library
  cannot enter the service worker's precache without someone making it a static import.
- **Word-boundary your name-matching regexes.** `/arm/` matched inside **"Warm-up"** — a real
  `DAY_PLAN` tab — and served the wrong warm-up block. Every token in `warmupFocusForDay` is
  `\b`-anchored for this reason.
- **Seed anything that must not reshuffle under the user.** The warm-up plan is drawn from a
  `${date}:${shuffles}` seed, never `Math.random`, so a re-render or tab switch cannot redraw a
  list mid-use. Persisted ticks store the nonce alongside them or they restore against the
  wrong draw.
- **Never write storage inside a `setState` updater** — React runs updaters twice in StrictMode.
  Compute the next value outside, then set and persist.
- **Emotion: no backticks inside a styled template literal**, even in a CSS comment; it breaks
  the build. Custom props that collide with real HTML attribute names (`open`, `wrap`) need
  `shouldForwardProp` or a rename.
- **Unit tests do not catch layout.** A Shuffle button overlapping a tab at 375px, a bar
  covering the card it described, and a blank offline page all shipped past a green suite.
  Drive a real browser at 375px in both themes before committing UI.
- **A defaulted argument is a silent mode switch.** `computePrefill` takes `mode`/`equipment`/
  `barWeightLbs` with defaults; the post-log call omitted them, so after every set the weight box
  was re-filled with legacy `auto` math and a standard bar while the toggle still read the mode
  you picked. 225 logged as Total came back as 90; a Trap Bar set in perSide came back as the
  total, and the next tap would have logged 525. When a function has a context parameter, pass
  the context at EVERY call site — a default that is right at mount is not right later.
- **A copy action must forward every label.** `handleRepeat` forwarded only `warmupSet` and
  `assistedPullup`, so `dropSet`/`toFailure`/`perSide` fell off: repeating a drop set produced a
  working set that could take a PB. Adding a flag to `LiftSetEntry` means auditing every writer,
  not just the form.
- **Module-level state outlives a test file.** `sessionSetType` (per-exercise set kind) and the
  `useWeightModesStore` singleton leak in file order — a test that logs a warm-up leaves the next
  test's form on Warm-up, which silently excludes it from the prefill and hides the bug under
  test. Reset the store in `beforeEach`; for module-private maps, set the state explicitly in the
  test instead of relying on the default.
- **A write's failure has to reach the page you wrote on.** `setRawWithRetry` recorded a failed
  save on a global flag whose only reader, `SyncWarningBanner`, was mounted on the More page —
  so a set lost to quota looked logged on Train. `logSet` now returns `{ entry, saved }` and the
  banner is in the Train sticky stack. A global status flag is not feedback unless something on
  the current screen subscribes to it.
- **Disabled is not the same as done.** `Button`'s `:disabled` repaints to `muted` (deliberately
  — opacity collapsed the contrast to 2.09:1). That turned the new "Logged" confirmation into a
  dead grey button, because it is disabled during the 800ms lock. The `success` variant is
  exempt from that repaint for exactly this reason.
- **Celebrate after the write, not after the intent.** Confetti, the PR toast and
  `checkAchievements` fired synchronously on log, so a set lost to a failed write was still
  celebrated — and `checkAchievements` PERSISTS, banking an achievement off a row that was never
  stored. They now run in the `saved.then` success branch. The rest timer deliberately does NOT
  wait: it is about your body, not your data.
- **Check a store's real field name before asserting on it.** `useAchievementsStore.setState({
  seen: [] })` merged a junk key and `getState().seen` then read back `[]`, so the assertion
  passed without testing anything. The field is `seenAchievements`. Zustand merges unknown keys
  silently, so a typo in a test fixture is a false green, not an error.
- **A service worker cannot rescue a cross-origin asset.** Fonts came from
  `fonts.googleapis.com`, so `sw.js` (which deliberately leaves cross-origin requests alone) left
  the app in fallback fonts offline. Self-hosting is not a preference here, it is the only thing
  that puts an asset within the worker's reach. They now live in `public/fonts/` — `public/`, not
  `src/`, because an unhashed filename is what lets `STATIC_SHELL` precache them by name; the
  worker's HTML scan cannot see them, since the woff2 URLs are inside `fonts.css` rather than the
  shell. Changing `STATIC_SHELL` means bumping `VERSION`, or existing clients keep an incomplete
  cache.
- **A substring is not an identity.** `offline.spec.ts` asserted the 1.2 MB library was NOT
  precached with `u.includes('exerciseLibrary')`. Once routes went lazy the 1.67 kB
  `exerciseLibraryService` wrapper became a static import of a route and was precached correctly
  — and the test failed, reading as a regression when nothing had regressed. Match the artifact,
  not the substring: `/\/exerciseLibrary-[^/]*\.js$/`.
- **Block service workers in tests that measure what the PAGE fetches.** A route-split test
  injected a 1200ms delay with `page.route` and passed in 886ms: the worker had precached the
  chunk, so the request never reached the network and the delay never applied. It was asserting
  a pending state it had not actually observed. `test.use({ serviceWorkers: 'block' })` for
  page-behaviour specs; leave worker behaviour to `offline.spec.ts`. A test faster than the
  delay it injects is not passing, it is not running.
- **`reuseExistingServer` makes a stale preview server lie to you.** A manually started
  `npm run preview` from earlier in the session was still up, so Playwright reused it and served
  the PREVIOUS build — a negative test (strip the fonts from `STATIC_SHELL`, expect failure)
  passed, which read as "the assertion proves nothing". It proved plenty; the edit had simply
  never reached the browser. Before trusting a negative result, check nothing is on :4173.
- **Ask about fonts only once text exists.** A face is requested when something needs it to
  render, so `document.fonts.ready` on a page with no content resolves immediately reporting
  nothing loaded. Lazy routes widened that window — the route chunk must resolve before anything
  renders — and the offline font test started failing in CI while passing locally, purely on
  speed. Wait for a real heading, then ask.
- **Playwright in a sandbox**: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-<build>/chrome-linux/chrome npm run test:e2e`.
  Read the build number off `/opt/pw-browsers/` — never run `npx playwright install`.

## Continuous memory rule (applies to every future task, without being asked)

At the end of any task that changes architecture, storage schema, or fixes a recurring bug,
update the docs **before reporting the task done** — no user prompt required:

1. **New or changed storage key, or a change to how a key is read/written** → record the shape
   and the reasoning in `docs/HANDOFF.md` §11, and add the key to the §2 backup-payload table.
2. **A bug whose root cause could recur** (a regex that over-matched, a lazy import that became
   eager, a selector that looped) → add one bullet to the pitfalls list above, stating the
   failure, not just the fix.
3. **Counts and sizes** stated in `docs/HANDOFF.md` §5 (test count, file count, bundle kB) are
   load-bearing — a future session compares against them to detect drift. Re-measure and update
   them in the same commit rather than leaving them stale.
4. **A wrong premise that reached a prompt** (wrong stack, wrong path, a feature that already
   existed) → add it to `docs/repo-facts.md`, which exists to be pasted into tools that cannot
   see this codebase.
5. **Correct what you previously wrote** when an audit contradicts it, and say so in the commit.
   An earlier revision of `HANDOFF.md` §2 claimed one key was the only backup omission; there
   were seven. Stale documentation is worse than none, because it is trusted.

Keep these entries dense and factual. State what broke and why, not what was learned.
