import { expect, test } from '@playwright/test';

/**
 * Self-hosted fonts (HANDOFF gap #7). These used to load from
 * fonts.googleapis.com, which meant a font swap on every cold load and
 * fallback fonts offline — a service worker must not touch cross-origin
 * requests, so it could do nothing about it.
 *
 * Asserted in a real browser because none of this is reachable from jsdom:
 * whether a face actually loaded is a browser fact, not a DOM fact.
 */
test('loads both families from this origin and applies them', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    const host = new URL(r.url()).host;
    if (/fonts\.(googleapis|gstatic)\.com$/.test(host)) external.push(r.url());
  });

  await page.goto('./', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  // No request reaches Google, so flaky Wi-Fi cannot cost a font swap.
  expect(external).toEqual([]);

  const loaded = await page.evaluate(() =>
    [...document.fonts].map((f) => ({ family: f.family, status: f.status, weight: f.weight })),
  );
  expect(loaded.some((f) => f.family === 'DM Sans' && f.status === 'loaded')).toBe(true);
  expect(loaded.some((f) => f.family === 'Space Grotesk' && f.status === 'loaded')).toBe(true);

  // Variable faces: one file per family covering the whole range, replacing
  // the seven separate static weights the old CDN link requested.
  expect(loaded.find((f) => f.family === 'DM Sans')?.weight).toBe('400 700');
  expect(loaded.find((f) => f.family === 'Space Grotesk')?.weight).toBe('300 700');

  // ...and the page is actually rendering in them, not just holding them.
  const body = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(body).toContain('DM Sans');
});

test('fonts survive going offline on the FIRST visit', async ({ page, context }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    for (let i = 0; i < 60 && !navigator.serviceWorker.controller; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const cache = await caches.open(names[0] as string);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  // Precached by NAME in STATIC_SHELL — the HTML scan cannot find these,
  // because the woff2 URLs live inside fonts.css rather than the shell.
  expect(cached).toContain('/Fitness-track/fonts/fonts.css');
  expect(cached).toContain('/Fitness-track/fonts/dm-sans-latin.woff2');
  expect(cached).toContain('/Fitness-track/fonts/space-grotesk-latin.woff2');

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });

  /*
   * Wait for real TEXT before asking about fonts. A face is requested only when
   * something needs it to render, so `document.fonts.ready` on a page with no
   * content yet resolves immediately reporting nothing loaded. Since routes
   * went lazy that gap widened — the route chunk has to resolve before anything
   * renders — and this assertion started failing in CI while passing locally,
   * purely because CI is slower. The app was fine; the test was racing.
   */
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible({
    timeout: 15_000,
  });
  await page.evaluate(() => document.fonts.ready);

  const offlineLoaded = await page.evaluate(() =>
    [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family).sort(),
  );
  expect(offlineLoaded).toEqual(['DM Sans', 'Space Grotesk']);
  await context.setOffline(false);
});
