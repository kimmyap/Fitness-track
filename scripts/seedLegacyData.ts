/**
 * Prints a snippet that seeds a browser with legacy-shaped gym data, so the
 * app can be verified against a pre-v2 user's localStorage.
 *
 * Run: npm run seed:legacy
 * Then: paste the output into devtools console on the running app and reload.
 *
 * The data lives in src/lib/fixtures/legacySeed.ts, which the test suite also
 * reads — so what you verify in the browser is what CI asserts. That module has
 * no runtime imports, which is what lets plain Node load it here.
 *
 * Node runs TypeScript directly, so this needs no ts-node/tsx.
 */
import { LEGACY_SEED } from '../src/lib/fixtures/legacySeed.ts';

const assignments = Object.entries(LEGACY_SEED)
  .map(([key, value]) => `  localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
  .join('\n');

const snippet = `(() => {
  // Legacy-shaped seed — ${Object.keys(LEGACY_SEED).length} keys, none of the four the rebuild added.
  Object.keys(localStorage)
    .filter((k) => k.startsWith('gymlog_'))
    .forEach((k) => localStorage.removeItem(k));
${assignments}
  console.log('Seeded ${Object.keys(LEGACY_SEED).length} legacy keys. Reload the page.');
})();`;

process.stdout.write(
  `Paste this into the devtools console on the running app, then reload.\n` +
    `It clears every existing gymlog_ key first, so use a throwaway profile.\n\n` +
    `${snippet}\n`,
);
