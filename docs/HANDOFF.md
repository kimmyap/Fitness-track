# Handoff — Fitness Track v2

Written 2026-09-11 at commit `dc48617`. For a Claude account picking this project up cold.

`CLAUDE.md` tells you the **rules**. `README.md` tells a human what the app **is**.
This file tells you how the work actually got done, and what is still missing — including
things that are true in the code but not written down in any doc.

---

## 1. Read in this order

1. `CLAUDE.md` — hard rules. Non-optional. Design tokens, plate math, data compatibility.
2. This file — process, and the gap list in §8.
3. `docs/research/migration-spec.md` — the legacy feature inventory and data schema. **But see §2: it has drifted.**
4. `docs/plan.md` — the original build plan and IA. Historical; the build is done. Do not
   treat its phase structure as a live instruction (see §3).
5. `legacy/index.html` — the original single-file app. Still the behavioural reference for
   anything ambiguous. When v2 and legacy disagree on a calculation, legacy wins unless the
   difference was a deliberate, committed fix.
6. `docs/research/architecture.md`, `docs/research/deploy-pipeline.md` — stack and CI rationale.

Skip `docs/research/product-design-spec.md` for palette questions. It is superseded by the
Design System table in `CLAUDE.md`, and **nothing inside the file says so**. Its chart, motion
and UX-rule sections are still good.

## 2. Doc precedence, and where the docs have drifted

| Question | Authority |
|---|---|
| Colours, tokens, fonts, spacing | `CLAUDE.md` Design System table — beats the design spec |
| Plate math and input modes | `CLAUDE.md` Plate Math section |
| localStorage keys and value shapes | `src/lib/storage.ts` — **beats the migration spec today** |
| Legacy feature behaviour / business logic | `docs/research/migration-spec.md`, then `legacy/index.html` |
| CI, deploy, Node version | `.github/workflows/ci-deploy.yml` — beats the deploy doc |

**Known drift (unfixed):**

- **Seven storage keys are live in code but absent from the "source of truth" spec.**
  `gymlog:weightInputModes`, `gymlog:barWeight`, `gymlog:exerciseOrder`, `gymlog:days`,
  `gymlog:dailyMetrics`, `gymlog:cardio`, `gymlog:warmupProgress` and `gymlog:muscleMap` all exist in `src/lib/storage.ts` and are
  read/written by the app. `migration-spec.md` documents none of them; `CLAUDE.md` mentions only
  `weightInputModes`. Read the `STORAGE_KEYS` map in `src/lib/storage.ts` for the real list, and
  note the double-prefix quirk (logical key `gymlog:entries` → actual localStorage key
  `gymlog_gymlog:entries`).
- **Adding a key means touching TWO backup paths, not one.** `buildBackupPayload` in
  `src/lib/storage.ts` (the emergency auto-backup on save failure) and `buildBackupPayload` /
  `applyImport` in `src/features/more/backup.ts` (manual export/import) both list their fields by
  hand. A key missing from either is silently absent from that export — which is gap #8, the
  standing data-loss risk, arriving by omission. `dailyMetrics` and `cardio` are wired into both.
  **TWO keys are out of both ON PURPOSE**, for different reasons, and both are commented at the
  payload sites — without the comments their absence looks exactly like the failure this rule
  warns about. `warmupProgress`: today's tick marks expire at midnight and describe a plan drawn
  for one device on one day, so exporting them would be noise rather than safety.
  `lastBackupAt` (added 2026-09-17): carrying it would be worse than noise, it would LIE —
  restoring a file onto a brand-new phone would import the old phone's backup date, so a device
  that has never exported anything would report itself covered, which is the exact claim the
  staleness nudge exists to contradict.
- ~~**But it is NOT the only key outside the payloads.**~~ **Fixed 2026-09-14.** An audit the
  day before found seven keys outside the manual export and thirteen outside the emergency
  auto-backup. Both payloads now carry every key except the two deliberate omissions above, and the emergency dump
  uses the SAME field names as the manual export, so a quota-failure file imports through the
  same `applyImport` path — it did not before. Merge semantics for the six that were added:
  `days` UNIONs (see §11), `exerciseOrder` / `weightInputModes` spread per key with incoming
  winning, `barWeight` and `theme` apply when valid, and `lastProgramReview` backfills only when
  unset so a restore cannot move a review clock you are already running.
  `muscleMap` (added 2026-09-24) joined both payloads on the same terms — spread per key,
  incoming wins. It is IN, not out, because unlike the two omissions above it is authored: losing
  it would not fail visibly, it would make the muscle balance quietly under-report on the new
  device while looking entirely healthy.
- ~~`deploy-pipeline.md` lags the workflow on action versions and step commands.~~ **Fixed
  2026-09-11**: its YAML snippet is now byte-identical to `.github/workflows/ci-deploy.yml`.
  If you change the workflow, re-sync the snippet or replace it with a link — it drifted twice.
- **Node version is stated three different ways**: `package.json` engines `>=22.12`,
  `README.md` "22.12+ (24 recommended)", `deploy-pipeline.md` "pin `>=24`", and CI runs
  Node 24. Local dev is on v24.19.0. Nothing enforces the floor, so this has never bitten —
  but do not trust any single one of those numbers.
- `README.md` links `docs/screenshot.png`, which does not exist.

## 3. The working loop

**The rules live in `CLAUDE.md` → "How to work in this repo".** They were originally only in a
global and a parent-directory `CLAUDE.md` on the original author's machine — i.e. outside the
repo, so a fresh clone silently lost the entire working process. They have been merged into the
repo's own `CLAUDE.md` so nothing depends on a file you may not have.

Read that section before your first edit. The short version: **plan first and wait for
approval**, read narrowly, fix only what was asked, run only affected tests until commit time,
summarise in one line per file, and don't reach for sub-agents on sequential or single-file work.

These matter more than usual here because this is a personal project on a metered budget. The
repo is 107 TS/TSX files and five long research docs; reading it all was explicitly ruled out.

## 4. Commit convention (undocumented until now)

The git history has a consistent, deliberate style that no doc describes. Match it —
`git log` is the working record of *why* for this project, and it is unusually load-bearing
because there is no issue tracker, no changelog and no PR discussion.

A commit message here is:

- **Subject**: short, imperative, comma-separated scope list.
  `Fix history clarity, warm-up styling, library search focus, custom days`
- **Body**: a numbered list, one item per user-visible change, each explaining the *root cause*
  rather than the symptom. Real example: "Library search no longer dismisses the mobile
  keyboard. Modal's focus trap depended on `onClose`, which callers pass as a fresh arrow every
  render, so each keystroke re-ran the effect…"
- **A "Corrections to the draft" section** when the work revised an earlier approach — what was
  wrong and why. This is habitual here and worth keeping.
- **An explicit data-safety statement** whenever storage is touched: which keys are new, that no
  existing key's shape changed, and what was asserted about existing entries. Example:
  "Three NEW storage keys …; no existing key's shape changed. Logged entries are keyed by
  exercise name and date, never by day, so none of the day operations can touch history."
- **Verification evidence**: the test count, that typecheck/lint/build are clean, and what was
  checked in the browser. Bundle sizes get quoted when a change could move them.
- `Co-Authored-By:` trailer. Previous commits credit `Claude Fable 5`; use whatever model you are.

Commits go **straight to `main`**. There is no branch-per-change or PR habit in this repo's
history (the one PR, #1, was Dependabot's). See §8 for why that is a gap.

## 5. The gate

```bash
npm run typecheck && npm run lint && npm run test:run && npm run build
```

All four must pass before a commit. Verified green on 2026-09-17:
typecheck clean, lint clean, **487 tests across 32 files**, build succeeds. Since routes went
lazy the headline number is the ENTRY chunk, **282.47 kB / 90.02 kB gzip** — not the whole
bundle, which is now spread across per-route chunks (ProgressPage 412 kB is the largest).
The self-hosted fonts are two separate woff2 assets (59.2 kB total, all weights).
(The previous revision said "401 across 27"; the file count was one high — there were 26. The
counts here are compared against by later sessions, so a wrong one is worse than none.)
(It was 213 across 14 at `dc48617`, before the legacy seed fixture and the service worker each
added a file; 262 across 18 before the metrics screen and the Today/Achievements passes; 323 across 23
before the warm-up rework, 343 before its ticks were persisted, 352 before the backup payloads
were completed, 361 before the warm-up ramp, 371 before stall detection, 384 before the PR log, 390 before session spans, 398 before per-side reps, 430 before the first full QA sweep, 455 before muscle balance, 482 before the rest-week fix.)

`npm run build` runs `tsc -b --noEmit` itself, so the gate double-typechecks — harmless, ~5s.

The build emits a chunk-size warning: main bundle ~993 kB (301 kB gzip) plus a lazy
`exerciseLibrary` chunk of ~1,202 kB (194 kB gzip). **The warning is expected, not a
regression.** The library is dynamically imported in `src/services/exerciseLibraryService.ts:131`
and only fetched when the exercise picker opens. If you change that import to a static one you
will add 1.2 MB to first load — don't.

## 6. CI and deploy

- `.github/workflows/ci-deploy.yml` runs the gate on every push and PR to `main`; pushes to
  `main` additionally build, copy `index.html` → `404.html` as the SPA deep-link fallback, and
  deploy to GitHub Pages via OIDC (no PAT, no `gh-pages` branch).
- **Pushing to `main` deploys to production.** There is no staging environment and no
  documented rollback (the rollback is: push a revert and wait for the run).
- Repo: `kimmyap/Fitness-track`. Live at `https://kimmyap.github.io/Fitness-track/`, which is
  why `vite.config.ts` sets `base: '/Fitness-track/'` and the router uses
  `basename: import.meta.env.BASE_URL`. Never hardcode an absolute asset path like `/foo.png`;
  Vite rewrites `index.html` attributes for you, but nothing rewrites strings in your JS.
  (`public/manifest.webmanifest` correctly uses relative `start_url`/`scope`/icon paths — leave
  them relative.)
- **One-time manual setting**: Settings → Pages → Source → "GitHub Actions". Already done for
  this repo, but if the project is ever forked or the repo recreated, deploys fail silently
  until it is set again. This is recorded only in a YAML comment and the README.
- Dependabot: weekly grouped npm minor/patch, monthly Actions. PRs are reviewed and merged by
  hand; nothing auto-merges. `npm audit` is deliberately **not** a CI step — run
  `npm audit --omit=dev --audit-level=high` locally before a release instead.

## 7. Generated files and scripts

Two scripts produce committed artefacts. Both are checked in as output, so a stale artefact is
invisible until something breaks.

- `npm run import-exercises` → `src/data/exerciseLibrary.json` (876 exercises from the
  open-source free-exercise-db, Unlicense). Node 24 runs the `.ts` file directly — no tsx/ts-node.
  The importer trims empty instruction strings so every entry has at least one cue; that fix
  lives in the importer, not the consumer, so re-running it is safe. Demo images are **hotlinked**
  to `raw.githubusercontent.com`, lazy-loaded, and hidden on error.
  Its `linkAlternatives` picks each entry's four `alternative_ids`, and the rules there are load-
  bearing enough to state: same movement pattern, same category GROUP (strength, powerlifting,
  strongman and olympic weightlifting count as one bucket; stretching, cardio and plyometrics
  stand alone), at least one shared primary muscle, **same equipment first**, then alphabetical
  for a stable diff. Both non-obvious rules were bugs once — without the category filter a Goblet
  Squat was answered with "All Fours Quad Stretch", and with different-equipment-first the near
  equivalents were pushed out of the top four so Pullups suggested "Cable Incline Pushdown".
  The re-fetch is live, so after running it **diff before assuming**: the last run changed
  `alternative_ids` on 843 entries and nothing else, which is how you tell your logic change from
  upstream drift.
- `node scripts/generate-icons.mjs` → `public/icons/*` (PWA icons drawn in code, no image deps).
  There is **no npm script for this one** — it is invoked by path.

`src/services/exerciseLibraryService.ts` maps the built-in program's 9 exercise names onto
library entries. A test asserts every built-in resolves, so an upstream rename fails the suite
rather than silently dropping metadata. If you re-run the importer and tests go red there, that
test is doing its job — fix the map, don't relax the test.

## 8. Gaps you missed

Grouped by kind. None of these are blocking today; all of them are things a new owner would
otherwise discover the hard way.

### Process gaps

1. **No branch or PR discipline, and `main` auto-deploys.** Every change has landed as a direct
   commit to `main`, which immediately ships to the live URL. A bad commit is live before CI
   finishes. There is no rollback procedure written anywhere.
2. **RUN 2026-09-17, and it found three things.** `docs/plan.md` Phase 3 lists a real checklist —
   375px and desktop, both themes, keyboard pass, legacy-data smoke test, design review against
   the top-10 UX rules. Until now individual commits claimed browser verification of *their*
   changes and nothing recorded the full sweep. The first sweep covered all five routes at 375px
   and 1280px in both themes, driven against the legacy seed, and is reproducible from the
   method below (the scripts were throwaway — nothing is committed that re-runs it, which is the
   part of this gap that stays open).

   **Method.** Build, serve `dist` on :4173, drive real Chromium with `serviceWorkers: 'block'`
   (a page-behaviour test must measure what the PAGE fetches). Per route: full-page screenshot,
   `scrollWidth - clientWidth` for sideways scroll, console/pageerror capture, then a DOM audit
   computing WCAG contrast for every visible text node against its nearest opaque ancestor
   background, plus touch-target sizes, accessible names, placeholder-only labels and
   `inputmode` on numeric fields. Then a tab-order walk asserting a visible focus indicator on
   every stop, a `reducedMotion: 'reduce'` pass asserting nothing still animates, and a
   legacy-data smoke test through Calendar → day detail → Progress tabs.

   **Results.** No horizontal overflow and no console errors on any of the 20 route/width/theme
   combinations. 42 tab stops on the Train page, all with a visible focus ring, and a set logs
   by keyboard alone. Nothing animates under reduced motion. All six form fields are labelled
   (none placeholder-only), carry `inputmode="decimal"` where numeric, and are ≥44px tall.
   Legacy data renders everywhere: 8/24 shows 3 exercises · 8,760lbs · 25 min, the PR tab derives
   6 all-time PRs, muscle-volume bars draw.

   **Found and fixed:** the PR toast printed the raw input as "per side" regardless of input mode
   (§11), and `destructive` was used as text at 3.18:1 in dark (gap #11 below).
   **Found and left:** calendar day cells are 41px wide against the repo's own ≥44px rule — seven
   columns cannot be 44px inside the card's padding at 375px, so closing it is a layout decision,
   not a fix. Light-mode `accentText` is 3.30:1, which is inside the accepted-exceptions set.

   Nothing triggers a re-run. Re-run it after any change that touches layout, the palette, or a
   form.
3. ~~**The "seeded legacy-shaped data" fixture is not in the repo.**~~ **Fixed 2026-09-11.**
   The seed is `src/lib/fixtures/legacySeed.ts`: the 13 legacy keys with their exact
   double-prefixed names and raw-vs-JSON encoding, and deliberately none of the four keys the
   rebuild added, so it reproduces a genuine pre-v2 profile. `npm run seed:legacy` prints a
   devtools snippet for browser verification; `legacySeed.test.ts` runs the same fixture through
   the real storage accessors, so what you click through is what CI asserts. The fixture spells
   its keys literally rather than deriving them from `STORAGE_KEYS` — deriving would make the
   test circular — and a parity assertion keeps the two in step.
4. **No changelog and no "current state" section in the plan.** `docs/plan.md` still reads as a
   forward-looking build plan for work that is finished. To learn what actually exists you must
   read `git log`. Fine for one owner with continuous context; hostile to a handoff.
5. **No issue tracker.** Deferred work lives in commit prose and in the head of whoever was
   there. That is the reason this file exists.

### Product and technical gaps

6. ~~**Installable but not offline-capable.**~~ **Fixed 2026-09-11.** `public/sw.js` is a
   hand-rolled offline shell, registered from `src/lib/registerServiceWorker.ts` in production
   only (a worker in front of the dev server serves stale modules). Install fetches the built
   `index.html` and precaches only the assets it references, which is exactly the first-paint
   set — the lazy exercise library is reached by dynamic import, never appears in the HTML, and
   so stays lazy without a config exclusion. Navigations are network-first (deploys land
   immediately when online, deep links work offline); hashed assets are cache-first. Bump
   `VERSION` in `public/sw.js` to evict every cache; `activate` deletes any that do not match.
   Two things cost real debugging time and will again if they are forgotten: a worker does not
   control the page that registered it until it activates, so runtime caching alone leaves the
   app broken offline until its *second* visit — hence precaching; and the asset responses carry
   `Vary: Origin` while Vite's module script tag carries `crossorigin`, so cache lookups must
   pass `ignoreVary: true` or every precached asset is invisible to the request that needs it
   and the app 503s offline. Both were caught only by driving a real browser.
7. **FIXED 2026-09-16 — fonts are self-hosted.** They used to load from `fonts.googleapis.com`,
   so flaky gym Wi-Fi meant a font swap on every cold load and offline meant fallback fonts; the
   service worker could not help, because a worker must not touch cross-origin requests. Now:
   two VARIABLE woff2 files in `public/fonts/` (DM Sans 36.9 kB covering 400-700, Space Grotesk
   22.3 kB covering 300-700) replacing the seven static weights the CDN link requested, declared
   in `public/fonts/fonts.css` with relative `url()`s so the file resolves its own siblings at
   any `base`. They live in `public/` rather than `src/` on purpose: the filenames stay unhashed,
   which is what lets `sw.js` precache them BY NAME in `STATIC_SHELL`. The HTML scan cannot find
   them — the woff2 URLs are inside `fonts.css`, not the shell — so without that list they would
   only be cached on the second visit. `index.html` preloads both (with `crossorigin`, which
   fonts require even same-origin). SW `VERSION` bumped to `v2` so the incomplete v1 cache is
   evicted. Both upstream OFL-1.1 licences ship verbatim beside the binaries. `e2e/fonts.spec.ts`
   asserts no request reaches Google, both faces report `loaded`, and both still load with the
   network off on the FIRST visit.
8. **MOSTLY FIXED 2026-09-17 — data still lives in one browser, but you are told when it is at risk.** localStorage, no sync,
   no account, no automatic export. The README warns the user, and there is save-retry with an
   emergency backup download on failure — but cleared site data or a lost phone is total
   history loss.

   **Partly addressed 2026-09-17 — the export is now dated and nagged.** Sync options were
   surveyed (File System Access API, GitHub API to a private repo, Dropbox/Drive OAuth,
   Supabase); the user confirmed PHONE ONLY, which makes multi-device sync imaginary and leaves
   durability as the whole problem. So: `gymlog:lastBackupAt` (RAW ISO day, the `lastProgramReview`
   pattern) is written when an export is STARTED, and Settings → Data shows "Last backup: N days
   ago" with a red warning past `BACKUP_NUDGE_DAYS` (14). `daysSinceBackup` returns null for
   never-exported — null and 0 are opposite states and the caller must not conflate them — and
   clamps a future date to 0 so a backwards clock cannot hide the nudge.

   Two things it deliberately cannot do. It records an export that was STARTED, because the
   browser owns the save sheet and nothing reports back whether the file was written, so a
   cancelled save silences it for a fortnight; the alternative, never clearing, makes it noise.
   And the key is absent from BOTH backup payloads — unlike `warmupProgress`, which is scratch
   state, this one would actively LIE, telling a brand-new phone it was already covered.

   **Completed the same day with `BackupReminderCard` on Today.** The Settings status alone was
   two taps deep inside a collapsed accordion — a status you can look up, not a reminder that
   reaches you. The card follows `ProgramReviewCard` exactly: returns null until it has something
   to say, so Today carries no standing reassurance to learn to skip. It renders ABOVE the
   program nudge (losing the history outranks refreshing the plan), is bordered `destructive`
   rather than `primary`, and exports IN PLACE rather than linking to Settings. After exporting
   it re-reads the key rather than assuming — a failed write leaves the card up, which is the
   safe direction, and a test pins that.

   Bundle cost of importing `backup.ts` into a Today-route component: TodayPage 7.34 -> 8.29 kB
   raw (+0.34 kB gzip), and MorePage went DOWN 24.23 -> 20.27 kB because Rollup hoisted
   `backup.ts` into a chunk both routes share. The sw-precache plugin picks that shared chunk up
   automatically, since it follows each route's static imports.

   **What is still not solved:** a cancelled save sheet still silences the nudge for a fortnight
   (the browser never reports back), and there is still no automatic off-device copy — the file
   only leaves the phone if you put it somewhere that syncs. Real sync was surveyed and
   deliberately not built; see the options in this session's history if it ever becomes worth it.
9. **FIXED 2026-09-16 — routes are lazy.** The main bundle used to ship all five routes on
   first paint. `src/app/router.tsx` now uses react-router's `lazy` (not React.lazy + Suspense:
   with a data router the navigation stays pending and the page you are leaving stays on screen,
   so nothing flashes a skeleton over the destination). Main entry **993.51 kB -> 282.39 kB raw,
   301.30 -> 89.98 kB gzip**. Re-measured in a browser the same day, JS bytes actually fetched
   per route, service workers blocked:

   | Route | Before | After | Change |
   |---|---|---|---|
   | Today | 970 KiB (1 file) | **417 KiB** (6 files) | **-57%** |
   | Train | 970 KiB | 515 KiB (10 files) | -47% |
   | Progress | 970 KiB | 824 KiB (6 files) | -15% |

   **Both blockers this gap recorded were handled, and the second differently than predicted:**
   - The pending state is a 3px bar in `AppLayout` driven by `useNavigation()`, gated on
     `prefers-reduced-motion`, with an e2e test that holds the chunk for 1200ms and asserts both
     the bar AND that the previous page is still on screen.
   - The offline regression is prevented by `vite-plugin-sw-precache.ts`, which injects the route
     chunks' hashed filenames into index.html as an inert JSON block that `sw.js` reads. It walks
     each route chunk's STATIC imports only, so the 1.2 MB library — a dynamic import of a route
     chunk — is absent **by construction**. The gap predicted this would cost "an explicit
     exclusion for the library, losing the no-exclusion-list property"; it does not. The plugin
     hard-fails the build if a route in its `ROUTES` list has no matching chunk, because the
     symptom of a silent miss is a 503 offline on a route nobody thought to test.

   **What the win actually is:** total bytes downloaded are UNCHANGED, because the worker
   precaches the route chunks during install. The gain is that first paint parses and executes
   one route instead of five. Real, but it is time-to-interactive, not bandwidth.

   `sw.js` `VERSION` bumped to `v3`. `e2e/offline.spec.ts` now asserts a never-visited route
   renders real Progress content offline, not merely that the shell booted;
   `e2e/route-split.spec.ts` asserts Today fetches no other route's chunk.

   **Caveat on how "offline" is tested.** Those specs use `context.setOffline(true)`, which does
   NOT cut off service-worker requests — measured: during an "offline" navigation the old cache
   gained a route chunk, and `cacheFirst` only stores on a successful fetch. Their cache-CONTENT
   assertions are sound (verified by a negative control: stripping the fonts from `STATIC_SHELL`
   makes the fonts spec fail), but "renders offline" does not by itself prove the network was
   severed. Verified separately on 2026-09-16 by killing the preview server outright: after ONE
   online visit to Today, with the server confirmed dead from inside the page, all five routes
   render. Hardening the specs to sever the network for real is not done — see the pitfall list
   in `CLAUDE.md` for how to do it correctly if you take it on.

10. **Partly fixed 2026-09-12.** 29 vitest files plus a Playwright suite in `e2e/` (18 specs), run by
    `.github/workflows/e2e.yml` on push and PR — separate from the four-command gate, because
    it builds the app and drives a browser. `npm run test:e2e` locally — but see the Chromium
    note below before you conclude the suite is broken. It exists because three
    bugs shipped past a green unit suite (blank page offline, `Vary: Origin` 503s, a sticky bar
    covering the card it describes); it covers the offline shell, reordering by pointer AND
    keyboard, and the active-set bar in both themes at 375px. Two traps if you extend it:
    `devices['Pixel 7']` sets `isMobile: true`, which stops dnd-kit seeing synthetic input at
    all — use an explicit viewport; and `page.mouse` does not auto-scroll, so call
    `scrollIntoViewIfNeeded()` before dragging anything below the fold. Still missing: visual
    regression and an automated accessibility check (no axe). The rest-timer audio path is
    still verified by eye only.

    **If all 8 specs fail at once, read the error before debugging the app.** In a sandbox with
    a pre-installed Chromium — Claude Code on the web, for one — Playwright asks for a
    `chrome-headless-shell` build matching its own version, finds only the image's Chromium,
    and every spec dies at `browserType.launch` before a single test body runs. The message
    tells you to run `npx playwright install`; **do not** — the environment notes say not to,
    and it is not the fix. `playwright.config.ts` already carries the escape hatch: set
    `PW_CHROMIUM_PATH` to the browser that IS there and `launchOptions.executablePath` picks
    it up.

    ```bash
    ls /opt/pw-browsers/                      # find the build this image actually ships
    PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e
    ```

    The version suffix moves with the image, so read it rather than pasting the path above.
    CI needs none of this — `playwright install` there puts the matching build in place, and
    the variable is unset, which is why this only ever bites locally.
11. **Accepted contrast failures — now tracked by a test (2026-09-17).** `src/theme.contrast.test.ts`
    asserts every text-carrying token clears 4.5:1 on `card`, `background` AND `muted` in its own
    theme, and pins each documented exception to the exact ratio `CLAUDE.md` states, so a silent
    drift in either direction fails the gate. It was written because the sweep found a gap that
    was never a decision: `destructive` is tuned as a FILL (paired with `onDestructive`) but was
    also the colour of validation messages, the failed-save warning, the backup nag and the
    negative trend figure — **3.18:1 on `card` in dark**. Split into `destructiveText`
    (dark `#FB9393` 5.52:1, light `#CC1F1F` 5.55:1 on card), exactly as `accentText` is split
    from `accent`. `destructive` itself is unchanged and still correct for fills and borders.
    The original text of this gap follows, and still stands for the exceptions:

    **Accepted contrast failures with no tracking.** `CLAUDE.md` documents ratios below AA
    (light `primary` 3.56:1, light `accent` 3.30:1, dark `primary`-as-text 4.27:1) as deliberate.
    That is a legitimate call, but there is no issue, no `@todo`, and no condition that would
    trigger revisiting them. If the app ever has a second user, this resurfaces with no owner.
    Separately, `Button` used to fade to `opacity: 0.55` when disabled, which dims background and
    label together and so collapses their contrast by construction — measured 2.09:1 dark and
    1.49:1 light. It now switches to the muted surface (6.96:1 / 6.92:1). WCAG exempts disabled
    controls, so that was never a conformance failure, just unreadable. Do not reintroduce the
    fade; if you need a new inactive style, measure it.
12. **TypeScript is pinned to `~6.0.0`** waiting on typescript-eslint support for TS 7. Nothing
    watches for that support landing, so the pin will quietly outlive its reason. Check
    typescript-eslint releases before assuming the pin is still needed. **Checked 2026-09-13:
    still needed.** `typescript-eslint@8.70.0` declares `typescript: >=4.8.4 <6.1.0`, so TS 7 is
    not supported and `~6.0.0` (6.0.x only) is exactly the right range — even 6.1 is excluded.
    Re-check the same way: `npm view typescript-eslint@latest peerDependencies`.
13. **ESLint is held at 9 on purpose, and it is a THREE-package decision.** `eslint@10`,
    `@eslint/js@10` and `eslint-plugin-react-hooks@7` move together: react-hooks v5 peers cap at
    `^9.0.0`, so npm refuses eslint 10 alongside it, and react-hooks 7 is the only version that
    accepts eslint 10. Taking the set surfaces **14 errors in working, tested code** from rules
    that are new in react-hooks 7 — `purity` (5, all in `Confetti.tsx`), `set-state-in-effect`
    (5), `refs` (2), `static-components` (1), `immutability` (1, the `sessionSetType` module
    object in `LoggingForm.tsx`) — plus 2 `no-useless-assignment` from eslint 10 core in
    `domain.ts`. None is a bug; each fix is a behaviour change to code that works.
    **Decided 2026-09-13: held.** The owner chose to stay on eslint 9 rather than refactor
    working code to satisfy new stylistic rules. Do not re-litigate this on the next Dependabot
    PR — reopen it only if a rule in react-hooks 7 turns out to catch a real bug here, or if
    eslint 9 stops receiving security fixes. And do not take eslint 10 without react-hooks 7;
    npm will not allow it.
14. **Zero source comments flagged as TODO/FIXME/HACK** — a genuinely clean codebase, but it
    also means the code carries no signal about known-incomplete areas. Everything deferred is
    in this list or in `git log`, nowhere else.

## 9. Portability — what does not travel with this repo

The repo is now self-contained for *process*: the working rules are in `CLAUDE.md`, the design
skill is committed under `.claude/skills/` (259 files, MIT — see the LICENSE file there),
`.claude/launch.json` defines the dev server for the preview tooling, and `.claude/settings.json`
allowlists the routine commands so a fresh account isn't prompted on every `npm run`.

What you still have to supply yourself:

- **Node.js 24** (v24.19.0 was used). `winget install -e --id OpenJS.NodeJS.LTS` on Windows.
  Then `npm ci` — use `ci`, not `install`, so the committed lockfile is respected.
- **Python is not installed and is not needed.** The design skill ships
  `scripts/search.py`; do not try to run it. Query the skill's CSV data files directly with
  Grep/Read instead. This is the one setup detail most likely to waste a session.
- **A matching Playwright browser.** A sandbox's pre-installed Chromium generally is not the
  build Playwright wants, and every e2e spec then fails at launch. Set `PW_CHROMIUM_PATH`
  rather than running `playwright install` — see §8 #10 for the command.
- **Session memory does not transfer.** The original account kept notes under
  `~/.claude/projects/<project>/memory/`. That is account-local; this file plus `git log` is the
  replacement. If you take the project over long-term, start your own.
- **The GitHub Pages repo setting** (Settings → Pages → Source → "GitHub Actions") is per-repo.
  It is already set on `kimmyap/Fitness-track`, but a fork or a recreated repo needs it again or
  deploys fail silently. Push access to that repo is also yours to arrange.
- **MCP connectors** (Notion, Google Workspace, etc.) were present in the original environment
  but are irrelevant to this project. Nothing here depends on them.

## 10. First session checklist

Before touching anything:

```bash
npm ci
npm run typecheck && npm run lint && npm run test:run && npm run build
```

Expect: clean, clean, 430 passing, build with a chunk-size warning (the lazy library chunk). If tests are red, find out
what changed before writing code — the suite was green when this was written.

Then:

1. `npm run dev`, open the app, click through all five routes in both themes at 375px wide
   (Progress now has four sub-tabs: Charts / Body / Daily / Achievements).
2. Read `src/lib/storage.ts` end to end. It is the riskiest file in the repo — every hard rule
   about data compatibility is enforced (or not) there, and it is ahead of its own spec.
3. Read the last four commit messages in full. They are the real design record.
4. Skim `src/lib/domain.ts` — ported verbatim from legacy, so its oddities are intentional.

To verify against legacy data rather than an empty app, run `npm run seed:legacy` and paste its
output into the devtools console (it clears every `gymlog_` key first, so use a throwaway
profile). Dates in the seed are fixed, not relative to today, so history, calendar, charts, PRs
and goals populate while streaks read cold.

## 11. Added since this file was written (2026-09-12, extended 2026-09-15)

Feature surface that the sections above predate:

- **Progress → Daily** (`src/features/metrics/`) — per-day calories / protein / sleep / energy,
  plus cardio sessions. Two NEW keys, `gymlog:dailyMetrics` (map keyed `YYYY-MM-DD`) and
  `gymlog:cardio` (array). Deliberately independent of `features/train`: it keeps its own styled
  primitives so the two can be restyled apart.
- **Two overlaps were resolved by NOT duplicating**, and both will look like omissions if you
  don't know why. Body weight on that screen writes to the existing `gymlog:bodyweight`, the key
  the Body chart reads — there is no weight field in `dailyMetrics`. Cardio types are jog /
  treadmill / other only: volleyball and Pilates are already `ActivityEntry` rows in
  `gymlog:entries`, and offering them twice would double-count the calendar dots and the
  cross-training achievements.
- **Achievements** gained tiers, category filters, progress tracks and a detail modal. Tier,
  category and unlock DATE are all **derived** (`achievementTier`, `achievementCategory`,
  `achievementUnlockDates` in `domain.ts`), not stored. Unlock dates come from replaying history
  — rebuilding the snapshot as it stood each logged day and taking the first day a check passes
  — so they are real earn dates, retroactively, with no key to migrate. The tradeoff: a derived
  date moves if the history behind it is deleted, the same contract unlocked state already had.
- **Four tier colour tokens** (`tierBronze/Silver/Gold/Platinum`) are in `src/theme.ts` and the
  `CLAUDE.md` Design System table. They are used as border AND text, so each was measured to
  clear 4.5:1 on `card` in its own theme.
- **"Suggest an alternative" now has two sources.** The curated `ALTERNATIVES` table in
  `program.ts` covers exactly the nine built-in program exercises and always wins — its reasons
  and cues are hand-written. Everything else (custom exercises, mainly) falls back to the
  library's `alternative_ids` via `libraryAlternativesFor`, which previously showed no button at
  all. Two things about that fallback are deliberate: the library entry carries no sets or reps,
  so a suggestion **inherits the prescription of the exercise it replaces**; and the fetch is
  gated on the card being EXPANDED, not on mount, because a day holds several cards and loading
  the 1.2 MB chunk for each collapsed one would pull it at first paint. If you touch that effect,
  re-check it: 0 requests for the chunk on the Train page, 1 after opening a card.
- **20 library exercises now have no alternatives at all** (it was 8). Category grouping
  legitimately narrows the candidate pool, and all 20 are edge cases in the small categories. An
  exercise with no suggest button is this, not a bug.
- **The warm-up is drawn per session, not printed.** `WARMUP_ROUTINE` (three fixed sections,
  all rendered at once, five movements each) is gone. In its place `program.ts` holds
  `WARMUP_CARDIO` plus `WARMUP_BLOCKS` — POOLS of ~10, one block per focus — and
  `src/features/train/warmupPlan.ts` draws a session from them. Four behaviours, each with a
  reason that is easy to undo by accident:
  - **Focus** comes from `DAY_PLAN[dow].tab` through `warmupFocusForDay`, which matches on the
    day NAME rather than a lookup table, because days are user-editable and a renamed day must
    still classify. Every token in that regex is `\b`-anchored: unanchored, "arm" matched inside
    **"Warm-up"** — Monday's own tab — and the one non-lifting weekday was served an upper-body
    block. Unrecognised names get the full-body block, never a guess.
  - **The draw is seeded by the date, never `Math.random`.** A plan has to survive re-renders,
    a tab switch and a theme change without reshuffling a list you are halfway through. Shuffle
    advances a nonce that feeds the same seed. If you ever reach for `Math.random` here, the
    list will redraw on every keystroke elsewhere on the page.
  - **Quick is a SUBSET of Full.** Both durations run one draw and differ only in how much of
    it they take, so lengthening the warm-up adds movements instead of replacing ticked ones.
    That property is asserted in `warmupPlan.test.ts`; a "pick 3" / "pick 5" rewrite that draws
    twice would pass a casual eye and break it.
  - Picks are returned in POOL order, not draw order — the pools read big-joints-first — and
    the "light warm-up sets on first lift" line is `pinned`, outside the rotation, on the
    lifting blocks only.
- **Warm-up ticks survive a reload, via `gymlog:warmupProgress` — and the SHUFFLE NONCE is
  stored with them.** That pairing is the whole difficulty, and dropping it would look like a
  simplification: the plan is drawn from a `${date}:${shuffles}` seed, so restoring ticks
  against the wrong nonce rebuilds a different draw and checks off movements the user never
  touched. Two more deliberate choices. The value is a single object, not the date-keyed map
  `dailyMetrics` uses, because this is scratch state that expires at midnight — a stored value
  whose `date` is not today is discarded on read, so the key cannot grow. And it is the one key
  absent from both backup payloads (see §2). What counts as history is still the legacy
  completion entry, `{ type: 'warmup', date }` on `gymlog:entries`, unchanged and asserted.
- **The full-body block is new content**, not a rename. Non-lifting days (Pilates, volleyball,
  rest) previously had only the cardio card and two lifting routines they were meant to ignore.
- **The desktop sidebar wordmark now carries `BarbellIcon`** (`AppLayout.tsx`). It inherits
  `currentColor`, which on `Brand` is `primary`, so there is no second token to keep in step
  across themes. Sidebar only — the bottom nav has five labelled items across 375px and no room.

- **Both backup payloads are complete as of 2026-09-14**, and `days` is why it mattered. Custom
  exercises and per-day card order are keyed BY DAY NAME, so exporting them without the day list
  produced a file that restored exercises onto days the program no longer had. `days` merges as a
  UNION — local order first, then imported days you lack — because this module's contract is that
  a merge never deletes anything, and a file listing fewer days than you have must not take yours
  away. Observed consequence, verified in a browser: restoring onto a wiped device gives you the
  legacy three PLUS your real days, e.g. `["Lower A","Upper","Lower B","Push Day","Pull Day"]`,
  because a fresh install starts on the defaults. Nothing is lost and the extras delete in
  Settings. Adopting the file's list wholesale when the user has never stored one would be a
  cleaner restore; it is not implemented, and it is a behaviour change, not a bug fix.

- **The warm-up ramp rounds DOWN, and that is the whole feature.** `warmupRamp` in `domain.ts`
  gives 40/60/80% of the working weight at 5/3/2 reps, each floored to a total the bar and
  `PLATE_SIZES` can actually make (5 lb steps, 2.5 kg). An un-rounded 40% of 135 is 54 lb — a
  number you cannot load, and the fastest way to make the feature ignorable. Down rather than
  nearest because a light warm-up costs nothing and a heavy one costs a rep. Sub-bar steps CLAMP
  to the bar rather than vanishing, so 95 lb still gives three rows starting with the empty bar.
  It returns [] for anything `isPlateLoaded` rejects — dumbbells and machines do not ramp on a
  bar. Tapping a row logs it with `warmupSet: true`, which was already excluded from PBs, 1RM,
  volume, the progression suggestion and the prefill: the feature adds no data shape, it fills
  in fields that existed.

Two invariants worth not breaking:

1. **Maps of the user's own content drop bad rows; config maps may fall back.** A validation
   layer shipped in `5eda04b` made every map reader fall back to `{}` on any mismatch. One
   unreadable custom exercise then emptied the whole library — and because Settings → Archived
   only renders when non-empty, the restore UI vanished with it, so it read as permanent data
   loss. Fixed in `8ff65f6`: `getCustomExercises`, `getNotes` and `getGoals` now drop only the
   rows that fail (`keepValid` / `keepValidEntries` in `schemas.ts`). Config-shaped maps
   (input modes, exercise order, core overrides, replaced built-ins) still fall back wholesale,
   which is fine — they are regenerable settings. If you add a reader for authored data, follow
   the first pattern.
2. **Nothing is written back as a result of a read.** A malformed row stays on disk rather than
   being erased by looking at it. Tests assert the raw string is byte-identical after a read.

**Write outcomes are now observable (2026-09-16).** `useEntriesStore.logSet` returns
`{ entry, saved }` rather than the entry alone; `saved` is the `Promise<boolean>` from
`setRawWithRetry`, resolving false only once the retries have given up. Every other store method
still ignores its write with an explicit `void`, so this changed no behaviour outside the logging
form. It exists because the failed-save flag's only reader lived on the More page, which meant a
set lost to quota looked logged on the page you log on. `SyncWarningBanner` is now also mounted
in the Train sticky stack, so the global failure signal is visible wherever writes happen.
Confetti, the PR toast and `checkAchievements` now run inside that promise's success branch
rather than synchronously on log, so nothing celebrates a set that was not stored. The rest
timer is deliberately outside the gate. No storage key, shape or default changed.

Not done, and each needs a decision rather than an implementation: nutrition targets (the Daily
hints are averages of your own history, because no target is stored and inventing one would be
health advice). Persisting warm-up ticks was on this list and is now done —
`gymlog:warmupProgress`, described above; so is route-level code splitting (gap #9, 2026-09-16).

**`gymlog:muscleMap` — exercise → muscle group (added 2026-09-24).** `Record<string,
MuscleGroup>`, where `MuscleGroup` is one of the 17 values `MUSCLE_GROUPS` in `types.ts` lists.
Those 17 are taken VERBATIM from the exercise library's own `primary_muscles` / `secondary_muscles`
values across its 876 rows — inventing an eighteenth would create a group no exercise can ever
fill, which reads as "never trained" forever.

WHY IT EXISTS, measured rather than assumed. The library resolves all 9 built-in program
exercises. But `lookupExercise` deliberately refuses to guess on an ambiguous prefix, and against
15 plausible user-typed names **6 missed**: "Bulgarian Split Squat" (a real custom exercise in
`legacySeed`), "Incline Press", "Seated Row", "Leg Curl", "Bicep Curls", "Tricep Pushdown". An
unresolved exercise contributes to NO muscle, so a recovery view would have reported a muscle as
untrained on the day it was trained — and then recommended training it again. This key is how a
user corrects that, once, per exercise.

Read with `keepValidEntries`, NOT `getChecked`: these are authored decisions, so one bad pair must
drop alone rather than taking the map with it (the `5eda04b` rule). The value is validated against
the 17 groups, so a renamed group drops instead of inventing a muscle. The user's mapping WINS over
the library on purpose — it is the more specific statement, and the only way to correct a wrong
resolution. It names a PRIMARY muscle only; asking someone to enumerate secondary movers is anatomy
homework to fix a display bug.

**Muscle balance engine (`src/features/progress/muscleBalance.ts`, 2026-09-24).** Pure, and
deliberately NOT in `domain.ts` — it needs `MuscleLookup` from `chartData.ts`, and putting it in
`lib/` would invert that dependency. Rolling 7-day window, not calendar: `weekRange` is right for
"this week vs last week" in the recap, but on a calendar week every Monday reads as a deload and
Sunday's work stops counting overnight. Counts PRIMARY-mover sets only against 10-20/week —
secondary involvement is carried separately and never added, or a deadlift's carryover would push
almost every muscle into "optimal". Legacy multi-set rows (`sets: 3`) expand to their real count.
Uses `isVolumeSet`, so drop sets are IN; that over-counts slightly against a SET benchmark, and is
kept anyway because diverging would put the Recovery tab in open disagreement with the Muscle
volume chart on the same page. Every unattributed set is returned in `unmatched` — never dropped.

**Zero has two causes (fixed 2026-09-24, same day).** The first cut filed every muscle with no
sets this week under "Not in your program", which is false for anything the plan trains — after a
rest week all 17 groups landed there, including Quadriceps in a program that squats twice a week.
`programMuscles` now derives coverage from the real program (days + custom exercises - excluded
built-ins, resolved through the same lookup and user mapping), so "Not trained this week" and "Not
in your program" are separate sections with separate causes. With the built-in program that splits
8 / 9. Found by opening the tab with data older than the window — the state a returning user lands
in, which no happy-path fixture produces.

**Where it lives, and why not Today.** `RecoveryTab` is a 6th Progress tab. The muscle data is in
the 1.2 MB library, and Progress is where that chunk already loads. A body-map card on Today would
pull 1.2 MB onto the landing route, which `CLAUDE.md` forbids. Verified in a browser: **0 requests
for the library chunk on Today, 1 after opening the Recovery tab.**

**The PR toast printed a total as a per-side figure (fixed 2026-09-17).** On a PR the toast
appends `(N per side)` for Barbell/Trap Bar and `(N per dumbbell)` for Dumbbell, restating the
RAW INPUT. It did that for every mode, so logging 140 in **Total** mode announced
"140lbs (140 per side)" — the total printed as the per-side number, at the one moment the figure
is most likely to be read and remembered (the real per-side value there is 47.5 with a 45lb bar).
The note now appears only when the input really was per side (`mode !== 'total'`; `auto` keeps it,
because legacy barbell/dumbbell math also takes the input as per side). No storage change — the
stored total was always correct, only the sentence was wrong. This is the same shape as the
`computePrefill` bug in `CLAUDE.md`: a value that means different things per mode, consumed at a
call site that did not ask which mode it was in.

## 12. Backlog — product gaps, with the finding that matters for each

From a product audit on 2026-09-15. Written down because this repo has no issue tracker, so
anything not here lives in commit prose and evaporates. Ordered by value ÷ effort; none is
started.

1. ~~**Stall detection.**~~ **Built 2026-09-15** — `detectStall` in `domain.ts`, surfaced on the
   exercise card. Shipped to the definition recorded here: 3+ consecutive sessions where neither
   the top working weight nor the reps at that weight improved. Both halves are load-bearing and
   a future "simplification" would break them. THREE, not two, because `suggestedNextWeight`
   already tells you to repeat a weight after a miss or RPE >= 9, so flagging two contradicts the
   box directly beneath it. REPS COUNT AS PROGRESS, or double progression (135x8 -> x9 -> x10)
   reads as a stall — the false positive that would make the feature ignorable. A run ends at the
   first session on a different weight, so a deload and return is two short runs. The notice
   renders ABOVE the suggestion: when it fires the suggestion is usually saying "(hold)" again,
   and the stall line has to be read first for that repetition to land as context.

   **Extended 2026-09-17 — the verdict now reads RPE.** A stuck weight is the OPPOSITE problem
   depending on where effort went, and `rpe` was already stored on every set while being read in
   exactly one place (`suggestedNextWeight`'s last-session average) plus an achievement counter.
   `StallReport` gained `trend` / `rpeFrom` / `rpeTo`: falling effort across the run says the load
   stopped being a stimulus (add weight), rising says fatigue is winning (deload), and anything
   under `STALL_RPE_DELTA` (a FULL point — RPE is typed as whole numbers, so half a point is
   noise) is flat. Two silences: both ends of the run need an RPE, or `trend` is null and the card
   keeps its original wording; and the mean uses only sets at the TOP weight, or a light back-off
   set drags it down and reads as the lift getting easier.

   The `targetReps` argument is what stops it contradicting the suggestion box directly beneath.
   `suggestedNextWeight` holds on missed reps ("nail your reps first"), which is independent of
   RPE, so without the gate stopping a set early at a low RPE stacks "add weight" on top of it.
   The other hold it issues (RPE >= 9) cannot collide arithmetically: `easier` needs the newest
   RPE a full point BELOW the oldest, so both would need oldest 10 and newest 9. Verified in a
   browser rather than reasoned about — all three pairings agree on screen.
2. ~~**PR log.**~~ **Built 2026-09-16** — `prHistory` in `domain.ts`, shown as Progress → PRs.
   Entirely derived; nothing stored. Two things found while building it, both worth keeping in
   mind: `prCountAllTime` and `isPR` DISAGREED on bodyweight variations (the count included them,
   the celebration did not), and `Stats.prCount` was computed but never rendered anywhere, so the
   count was dead data. `prCountAllTime` now delegates to `prHistory`, which uses `isPR`'s filter
   — the list and the confetti can no longer drift apart, and the existing tests confirmed the
   count's value did not move. Progress went to five tabs and needed `TrainPage`'s
   overflow-x scroller; without it the strip pushes the page sideways at 375px.
3. ~~**Session duration.**~~ **Built 2026-09-16** — `sessionSpanMinutes` in `domain.ts`, shown in
   `FinishWorkoutModal` and `DayDetail`. Named for what it MEASURES, not what it approximates:
   the span of your LOGGING, first set to last, derived from `createdAt` with no schema change.
   It is not a session length and the doc comment says so. Three deliberate silences, each
   preferring nothing to a plausible-looking lie: fewer than two timestamped sets (legacy rows
   and one-off logs carry no `createdAt`), spans under `MIN_SESSION_SPAN_MINUTES` (5 — sets
   logged inside a minute mean you filled it in afterwards), and no special-casing of two
   workouts in one day, which read as ONE span with the gap included. That last one is the
   missing Workout entity showing through; building the entity remains expensive (legacy
   migration against a schema `CLAUDE.md` makes a hard constraint) and is still not done.
4. ~~**Per-side (unilateral) logging.**~~ **Built 2026-09-16** — `perSide?: true` on
   `LiftSetEntry`, toggled beside the inputs, rendered in HistoryList and DayDetail.
   **It is a LABEL, not a modifier** — no domain logic reads it, exactly like `toFailure`, and
   VOLUME DELIBERATELY DOES NOT DOUBLE. That looks like the obvious missing half and is not:
   sets logged before the field existed cannot be retroactively identified as unilateral, so
   doubling would permanently fracture the volume history — weekly and monthly totals,
   `volumeTrend` and the volume-THRESHOLD achievements would all step up on a units change
   rather than on real work, and an achievement could unlock off that. The ambiguity this
   fixes is "what did 10 reps mean", which is what was actually costing anything. If the
   doubling is ever wanted, it needs a decision about the discontinuity first, not a one-line
   change to `entryVolume`.

   The toggle is deliberately NOT a fifth Set Type: per-side is orthogonal to kind, so a
   warm-up can be per side just as a working set can. Asserted in `LoggingForm.test.tsx`.
5. **Set-by-set history search.** Lower than it first looks: `ChartsTab` already gives a
   per-exercise est-1RM and top-set trend, so this is the log view, not the trend view.

Considered and rejected, with reasons, so they are not re-proposed: progress photos
(localStorage cannot hold images; IndexedDB plus gap #8's single-device risk makes them the
least recoverable data in the app), supersets (real schema cost, straight-sets program), CSV
export (the charts answer what a spreadsheet would), and cloud sync (contradicts the local-first
premise; gap #8 is an ACCEPTED risk, not an unsolved one).

Also open, smaller: on a device with no stored day list, a backup restore could adopt the file's
`days` wholesale instead of unioning onto the legacy three (see §11). Behaviour change, not a
bug fix.

---

**If you have budget for exactly one thing**, these two lists rank different currencies and do
not compete. For a change the user FEELS, take backlog #1 (stall detection) — it is the only
item that changes a training decision rather than a display. For infrastructure, both of the items that used to
be named here are done: gap **#7** (self-hosted fonts, which finished #6, so the app is
offline-complete rather than offline-but-in-fallback-fonts) and gap **#9** (lazy routes, entry
chunk 993 -> 282 kB). No infrastructure item is now the obvious next one — pick from the
remaining gaps on their merits, and note that #8 (single-device data) is the largest by
consequence and the one needing a product decision rather than an implementation.
