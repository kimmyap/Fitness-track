import { expect, test } from '@playwright/test';

/**
 * Feedback on the log-a-set path. Unit tests cover the strings; this covers
 * that they are actually on screen at phone width, because the three things
 * under test are all "the write happened but nothing said so" failures.
 */
async function openFirstCard(page: import('@playwright/test').Page) {
  await page.goto('./', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /train/i }).first().click();
  await page.locator('[aria-expanded]').first().click();
  await page
    .getByRole('group', { name: 'Set type' })
    .getByRole('button', { name: 'Working', exact: true })
    .click();
}

for (const theme of ['dark', 'light'] as const) {
  test(`${theme} theme: an ordinary set confirms itself`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('gymlog_gymlog:theme', t), theme);
    await openFirstCard(page);

    const numbers = page.locator('input[type="number"]');
    await numbers.nth(0).fill('45');
    await numbers.nth(1).fill('8');

    const logButton = page.getByRole('button', { name: /^log set$/i }).first();
    await logButton.click();

    // The confirmation is a real on-screen state, not just an announcement.
    await expect(page.getByRole('button', { name: /^Logged$/ })).toBeVisible();
    // The page holds several live regions (the active-set bar, toasts, dnd-kit);
    // this is the form's own, which is a span.
    await expect(page.locator('span[role="status"]')).toContainText('1 of 4 sets this session');
    // ...and it hands the button back rather than sticking.
    await expect(page.getByRole('button', { name: /^log set$/i }).first()).toBeVisible();
  });
}

test('the typo guard names both weights instead of just objecting', async ({ page }) => {
  await openFirstCard(page);
  const numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('45');
  await numbers.nth(1).fill('8');
  await page.getByRole('button', { name: /^log set$/i }).first().click();
  await expect(page.getByRole('button', { name: /^log set$/i }).first()).toBeVisible();

  // 135 → 315 total is well past the 40% threshold.
  await numbers.nth(0).fill('135');
  await page.getByRole('button', { name: /^log set$/i }).first().click();
  await expect(page.getByRole('button', { name: /315lbs is \+180 on your last 135lbs/ })).toBeVisible();
});

/**
 * The failure path, driven for real: setItem throws for the entries key only,
 * which is what a quota-exceeded write looks like to this app.
 */
test('a set that cannot be stored says so on the page you log on', async ({ page }) => {
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === 'gymlog_gymlog:entries') throw new DOMException('Quota', 'QuotaExceededError');
      return real.call(this, key, value);
    };
  });
  await openFirstCard(page);

  const numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('45');
  await numbers.nth(1).fill('8');
  await page.getByRole('button', { name: /^log set$/i }).first().click();

  await expect(page.getByRole('button', { name: /Not saved — see the warning above/ })).toBeVisible();

  /*
   * A first-ever set is a PR, so before the celebrations were gated on the
   * write this screen showed a confetti burst and "New PR on Sumo Squats!"
   * directly above "Not saved" — the app congratulating you for a set it had
   * just lost.
   */
  await expect(page.getByText(/New PR on/)).toHaveCount(0);
  await expect(page.getByText(/Achievement unlocked/)).toHaveCount(0);

  const banner = page.getByRole('alert');
  await expect(banner).toContainText('Storage had trouble saving recently');
  // It is pinned at the top of the page, above the card being logged into.
  const bannerBox = await banner.boundingBox();
  const buttonBox = await page.getByRole('button', { name: /Not saved/ }).boundingBox();
  expect(bannerBox!.y).toBeLessThan(buttonBox!.y);
});
