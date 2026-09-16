import { expect, test } from '@playwright/test';

/**
 * Route-level code splitting (HANDOFF gap #9). The point is what the FIRST
 * PAINT has to parse and execute: before this, landing on Today shipped Train's
 * dnd-kit and Progress's Recharts too.
 *
 * Driven in a browser because the claim is about which files a real navigation
 * fetches — a bundle listing cannot show that, and the failure mode (a chunk
 * quietly becoming eager again) is invisible in a green unit suite.
 *
 * Service workers are BLOCKED here. These assert what the PAGE fetches, and a
 * worker that has precached every route answers from cache, so the requests
 * never reach the network and a delay injected with page.route never applies —
 * the pending-state test passed in 886ms against a 1200ms hold, i.e. by luck
 * rather than by observation. What the worker caches is offline.spec.ts's job.
 */
test.use({ serviceWorkers: 'block' });
function jsRequests(page: import('@playwright/test').Page) {
  const seen: string[] = [];
  page.on('request', (r) => {
    const p = new URL(r.url()).pathname;
    if (p.endsWith('.js')) seen.push(p.split('/').pop() as string);
  });
  return seen;
}

test('landing on Today does not fetch the other routes', async ({ page }) => {
  const js = jsRequests(page);
  await page.goto('./', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();

  expect(js.some((f) => f.startsWith('TodayPage-'))).toBe(true);
  // The expensive neighbours stay on disk until asked for.
  for (const route of ['ProgressPage-', 'TrainPage-', 'MorePage-', 'CalendarPage-']) {
    expect(js.some((f) => f.startsWith(route))).toBe(false);
  }
  // Still true, and still the reason the precache list follows static imports only.
  expect(js.some((f) => f.startsWith('exerciseLibrary-'))).toBe(false);
});

test('navigating fetches that route, and only then', async ({ page }) => {
  const js = jsRequests(page);
  await page.goto('./', { waitUntil: 'networkidle' });
  js.length = 0;

  await page.getByRole('link', { name: /progress/i }).first().click();
  await expect(page.getByRole('tab', { name: /PRs/i })).toBeVisible();

  expect(js.some((f) => f.startsWith('ProgressPage-'))).toBe(true);
  expect(js.some((f) => f.startsWith('TrainPage-'))).toBe(false);
});

/**
 * The tap has to look like it registered. A data router keeps the current page
 * on screen while the chunk loads, so with no indicator a slow tap reads as a
 * dead one — the reason gap #9 called `fallback={null}` a blocker.
 */
test('a pending navigation is visible', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  // Hold the Progress chunk so the pending state is observable.
  await page.route('**/assets/ProgressPage-*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });

  await page.getByRole('link', { name: /progress/i }).first().click();
  await expect(page.getByRole('status', { name: 'Loading page' })).toBeVisible();
  // The page you are leaving stays put rather than blanking.
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await expect(page.getByRole('tab', { name: /PRs/i })).toBeVisible({ timeout: 15_000 });
});
