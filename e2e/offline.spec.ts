import { expect, test } from '@playwright/test';

/**
 * The app's offline promise. Two bugs shipped past a green unit suite here:
 *
 * 1. Runtime caching alone left the app blank offline, because a worker does
 *    not control the page that registered it until it activates — by which
 *    point the app's own assets were already fetched past it.
 * 2. Every precached asset 503'd, because responses carry `Vary: Origin` while
 *    Vite's module script tag carries `crossorigin`, so `cache.match` refused
 *    to match what was sitting right there in the cache.
 *
 * Both are invisible without a real browser, which is why these run at all.
 */
test.describe('offline shell', () => {
  test('one online visit is enough to survive going offline', async ({ page, context }) => {
    await page.goto('./', { waitUntil: 'networkidle' });
    await expect(page.locator('#root')).not.toBeEmpty();

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      for (let i = 0; i < 60 && !navigator.serviceWorker.controller; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
    });

    const sw = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return { state: reg.active?.state, controlling: Boolean(navigator.serviceWorker.controller) };
    });
    expect(sw.state).toBe('activated');
    expect(sw.controlling).toBe(true);

    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names[0] as string);
      return (await cache.keys()).map((r) => new URL(r.url).pathname);
    });
    expect(cached).toContain('/Fitness-track/');
    expect(cached.some((u) => u.startsWith('/Fitness-track/assets/'))).toBe(true);

    /*
     * The 1.2 MB exercise library is a deliberate lazy chunk. Precaching it
     * would undo that, so its absence is the assertion — but it has to name the
     * DATA chunk, not the substring. Since routes went lazy, the 1.67 kB
     * `exerciseLibraryService` wrapper is precached too (it is a static import
     * of a route), and a substring match on "exerciseLibrary" caught that and
     * read as a regression when nothing had regressed.
     */
    const isLibraryData = (u: string) => /\/exerciseLibrary-[^/]*\.js$/.test(u);
    expect(cached.some(isLibraryData)).toBe(false);

    /*
     * The real contract is between the plugin and the worker: everything the
     * plugin puts in the injected manifest must end up cached, and the library
     * data must never be in that manifest.
     *
     * This replaces an assertion that named a CHUNK FILE —
     * `exerciseLibraryService` — which is a build-output detail, not an
     * invariant. Changing which modules import the service was enough to make
     * rolldown fold that wrapper into a differently-named shared chunk, and the
     * test went red while the thing it cared about (the 1.2 MB data staying out
     * of the precache) was still true. Assert the manifest, not the filename.
     */
    const manifest = await page.evaluate(() => {
      const el = document.getElementById('sw-precache');
      return JSON.parse(el?.textContent ?? '[]') as string[];
    });
    expect(manifest.length).toBeGreaterThan(0);
    expect(manifest.some(isLibraryData)).toBe(false);
    for (const file of manifest) {
      expect(cached.some((u) => u.endsWith(`/${file}`)), `${file} was not precached`).toBe(true);
    }

    // Every lazy ROUTE chunk, by contrast, MUST be precached — that is the
    // whole point of the injected manifest.
    for (const route of ['TodayPage', 'TrainPage', 'CalendarPage', 'ProgressPage', 'MorePage']) {
      expect(cached.some((u) => u.includes(route))).toBe(true);
    }

    await context.setOffline(true);

    await page.goto('./', { waitUntil: 'commit' });
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });

    /*
     * A route never visited online. Since routes are lazy this is the sharp
     * case: the shell answering is not enough, the route's own chunk has to
     * come from the cache too or the page renders an error instead.
     */
    await page.goto('./progress', { waitUntil: 'commit' });
    await expect(page.locator('#root')).not.toBeEmpty({ timeout: 15_000 });
    await expect(page.locator('#root')).not.toContainText('404');
    // Real Progress content, not just a shell that booted.
    await expect(page.getByRole('tab', { name: /PRs/i })).toBeVisible({ timeout: 15_000 });
  });
});
