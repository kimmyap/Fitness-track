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

- **Four storage keys are live in code but absent from the "source of truth" spec.**
  `gymlog:weightInputModes`, `gymlog:barWeight`, `gymlog:exerciseOrder` and `gymlog:days` all
  exist in `src/lib/storage.ts` and are read/written by the app. `migration-spec.md` documents
  none of them; `CLAUDE.md` mentions only `weightInputModes`. Read the `STORAGE_KEYS` map in
  `src/lib/storage.ts:31` for the real list, and note the double-prefix quirk (logical key
  `gymlog:entries` → actual localStorage key `gymlog_gymlog:entries`).
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

All four must pass before a commit. Verified green at `dc48617` on 2026-09-11:
typecheck clean, lint clean, **213 tests across 14 files**, build succeeds.

`npm run build` runs `tsc -b --noEmit` itself, so the gate double-typechecks — harmless, ~5s.

The build emits a chunk-size warning: main bundle ~870 kB (263 kB gzip) plus a lazy
`exerciseLibrary` chunk of ~1,205 kB (188 kB gzip). **The warning is expected, not a
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
2. **No record of QA ever being completed.** `docs/plan.md` Phase 3 lists a real checklist —
   375px and desktop, both themes, keyboard pass, legacy-data smoke test, design review against
   the top-10 UX rules. Individual commits claim browser verification of *their* changes, but
   nothing records the full sweep being run, and nothing triggers re-running it. It has almost
   certainly gone stale across the last four commits.
3. **The "seeded legacy-shaped data" fixture is not in the repo.** Three commit messages say
   changes were "verified in the browser against seeded legacy-shaped data," but there is no
   committed seed script or fixture. The next person cannot reproduce that verification without
   rebuilding the seed from `migration-spec.md` by hand. This is the single highest-value gap
   to close — it is the only way to test the app's core promise (legacy data survives).
4. **No changelog and no "current state" section in the plan.** `docs/plan.md` still reads as a
   forward-looking build plan for work that is finished. To learn what actually exists you must
   read `git log`. Fine for one owner with continuous context; hostile to a handoff.
5. **No issue tracker.** Deferred work lives in commit prose and in the head of whoever was
   there. That is the reason this file exists.

### Product and technical gaps

6. **Installable but not offline-capable.** There is a web manifest and an icon set, so the app
   installs standalone on a phone — but there is **no service worker**. Open it without a
   connection and you get nothing. For a gym tracker used in basements with no signal, this is
   the most user-visible gap in the project.
7. **Fonts are a runtime CDN dependency.** Space Grotesk and DM Sans load from
   `fonts.googleapis.com` in `index.html`. Flaky gym Wi-Fi means a font swap on every cold load,
   and offline means fallback fonts. Self-hosting them would fix this and help with #6.
8. **Data lives in one browser, on one device, with manual backup only.** localStorage, no sync,
   no account, no automatic export. The README warns the user, and there is save-retry with an
   emergency backup download on failure — but cleared site data or a lost phone is total
   history loss, and nothing prompts a periodic export.
9. **No route-level code splitting.** `docs/plan.md` called it "optional"; it was not done. The
   870 kB main bundle ships all five routes on first paint.
10. **Test coverage is logic-only.** 14 test files, all unit/component level. No end-to-end
    test, no visual regression, no automated accessibility check (no axe in CI). Route wiring,
    the responsive shell, theme switching and the rest-timer audio path are verified by eye only.
11. **Accepted contrast failures with no tracking.** `CLAUDE.md` documents ratios below AA
    (light `primary` 3.56:1, light `accent` 3.30:1, dark `primary`-as-text 4.27:1) as deliberate.
    That is a legitimate call, but there is no issue, no `@todo`, and no condition that would
    trigger revisiting them. If the app ever has a second user, this resurfaces with no owner.
12. **TypeScript is pinned to `~6.0.0`** waiting on typescript-eslint support for TS 7. Nothing
    watches for that support landing, so the pin will quietly outlive its reason. Check
    typescript-eslint releases before assuming the pin is still needed.
13. **Zero source comments flagged as TODO/FIXME/HACK** — a genuinely clean codebase, but it
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

Expect: clean, clean, 213 passing, build with a chunk-size warning. If tests are red, find out
what changed before writing code — the suite was green at `dc48617`.

Then:

1. `npm run dev`, open the app, click through all five routes in both themes at 375px wide.
2. Read `src/lib/storage.ts` end to end. It is the riskiest file in the repo — every hard rule
   about data compatibility is enforced (or not) there, and it is ahead of its own spec.
3. Read the last four commit messages in full. They are the real design record.
4. Skim `src/lib/domain.ts` — ported verbatim from legacy, so its oddities are intentional.

If you have budget for one improvement before feature work, make it gap **#3** (commit a
legacy-shaped localStorage seed fixture). It unblocks honest verification of everything else.
