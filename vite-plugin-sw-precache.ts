import type { OutputBundle, OutputChunk } from 'rolldown';
import type { Plugin } from 'vite';

/**
 * Tells `public/sw.js` which lazy route chunks to precache, by injecting their
 * hashed filenames into index.html as a JSON block.
 *
 * WHY THIS EXISTS. The worker precaches only the assets index.html references.
 * That is what keeps the 1.2 MB exercise library lazy — it is reached through a
 * dynamic import and never named in the HTML, so it is cached only once the user
 * opens the thing that needs it. Route splitting puts route chunks in the same
 * position, which is wrong for them: a route you had never opened ONLINE would
 * fall to cacheFirst and 503 offline, regressing the offline shell that
 * docs/HANDOFF.md gap #6 exists to guarantee.
 *
 * WHY NOT A PLAIN BUILD MANIFEST. `manifest: true` lists every chunk, library
 * included, so the worker would need an exclusion list naming it — and an
 * exclusion list is a thing that goes stale silently. This includes by identity
 * instead: start at the route entry modules, follow STATIC imports only, stop.
 * Dynamic imports are never followed, so the library stays lazy by construction
 * rather than by being remembered. Adding a route means adding it to ROUTES;
 * adding a lazily-loaded blob to a route needs no change at all.
 *
 * WHY A JSON BLOCK RATHER THAN <link rel="modulepreload">. Preload tags would
 * make the BROWSER fetch every route chunk on first paint, which is exactly the
 * cost splitting is meant to avoid. A JSON script tag is inert to the browser
 * and readable by the worker, so first paint still executes one route.
 */

/** Source modules the router lazy-imports. Keep in step with src/app/router.tsx. */
const ROUTES = [
  'src/features/today/TodayPage.tsx',
  'src/features/train/TrainPage.tsx',
  'src/features/calendar/CalendarPage.tsx',
  'src/features/progress/ProgressPage.tsx',
  'src/features/more/MorePage.tsx',
];

/** The id the worker looks for. Shared here rather than spelled twice. */
export const SW_PRECACHE_ELEMENT_ID = 'sw-precache';

function isChunk(value: OutputBundle[string]): value is OutputChunk {
  return value.type === 'chunk';
}

/**
 * A route's chunk plus everything it statically imports, transitively.
 *
 * `chunk.imports` is static imports only; `chunk.dynamicImports` is deliberately
 * not followed. Shared chunks reached from several routes collapse into the one
 * Set, so each file is listed once.
 */
function staticClosure(bundle: OutputBundle, entry: OutputChunk): Set<string> {
  const seen = new Set<string>();
  const queue = [entry.fileName];
  while (queue.length) {
    const fileName = queue.pop() as string;
    if (seen.has(fileName)) continue;
    seen.add(fileName);
    const chunk = bundle[fileName];
    if (chunk && isChunk(chunk)) {
      queue.push(...chunk.imports);
      // A route's CSS is as load-bearing as its JS when offline.
      for (const css of chunk.viteMetadata?.importedCss ?? []) seen.add(css);
    }
  }
  return seen;
}

export function swPrecache(): Plugin {
  return {
    name: 'sw-precache-manifest',
    apply: 'build',
    transformIndexHtml: {
      // After Vite's own tags, and only once the bundle exists to read.
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;

        const chunks = Object.values(ctx.bundle).filter(isChunk);
        const files = new Set<string>();
        const missing: string[] = [];

        for (const route of ROUTES) {
          const entry = chunks.find((c) => c.facadeModuleId?.replace(/\\/g, '/').endsWith(route));
          if (!entry) {
            missing.push(route);
            continue;
          }
          for (const file of staticClosure(ctx.bundle, entry)) files.add(file);
        }

        /*
         * Fail the build rather than ship a half list. A renamed page file would
         * otherwise silently drop that route from the precache, and the symptom
         * is a 503 offline on a route nobody thought to test.
         */
        if (missing.length) {
          this.error(
            `sw-precache: no chunk found for ${missing.join(', ')}. ` +
              'Update ROUTES in vite-plugin-sw-precache.ts to match src/app/router.tsx.',
          );
        }

        const payload = JSON.stringify([...files].sort());
        return html.replace(
          '</head>',
          `  <script type="application/json" id="${SW_PRECACHE_ELEMENT_ID}">${payload}</script>\n  </head>`,
        );
      },
    },
  };
}
