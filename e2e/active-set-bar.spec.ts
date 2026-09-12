import { expect, test } from '@playwright/test';

/**
 * The sticky "what am I logging" bar.
 *
 * The overlap case below is the one that matters: the bar and the rest-timer
 * bar were both `position: sticky` with the same `top`, so they pinned to the
 * same spot and the timer covered the open card's header. z-index chose a
 * winner but did not stop the collision, and every assertion passed while it
 * was broken — only a screenshot showed it. Hence the geometry check.
 */
for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test('pins the active exercise and returns you to its card', async ({ page }) => {
      await page.goto('./', { waitUntil: 'networkidle' });
      await page.getByRole('link', { name: /train/i }).first().click();

      // Open the last card so the jump has real distance to cover.
      const heads = page.locator('[aria-expanded]');
      await expect(heads.first()).toBeVisible();
      const last = (await heads.count()) - 1;
      const name = (await page.locator('[data-exercise]').nth(last).getAttribute('data-exercise')) ?? '';
      await heads.nth(last).click();

      const bar = page.getByRole('status', { name: 'Currently logging' });
      await expect(bar).toContainText(name);
      await expect(bar).toContainText(/Set \d+ of \d+|Target met/);

      // The layout this risks at phone width.
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflows).toBe(false);

      const jump = page.getByRole('button', { name: /jump to card/i });
      const jb = await jump.boundingBox();
      expect(jb!.height).toBeGreaterThanOrEqual(44);

      await page.evaluate(() => window.scrollTo(0, 0));
      await jump.click();

      const card = page.locator(`[data-exercise="${name}"]`);
      await expect
        .poll(async () => (await card.boundingBox())!.y, { timeout: 10_000 })
        .toBeLessThan(400);

      // The card must sit BELOW the sticky stack, not behind it.
      const stack = await page.locator('[data-sticky-stack]').boundingBox();
      const cardTop = (await card.boundingBox())!.y;
      expect(cardTop).toBeGreaterThanOrEqual(stack!.y + stack!.height - 4);
    });
  });
}
