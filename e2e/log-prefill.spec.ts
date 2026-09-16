import { expect, test } from '@playwright/test';

/**
 * The weight box after a logged set.
 *
 * The re-prefill ran with the default arguments, so it re-filled the box using
 * legacy `auto` math while the toggle still read the mode you had chosen: a
 * 225 lb set logged as "Total weight" came back as 90 in a field still
 * labelled Total. Nothing looked broken, and the next tap would have logged
 * the wrong weight — the exact failure class this suite exists for.
 */
test('re-prefills in the mode the toggle still shows', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /train/i }).first().click();
  await page.locator('[aria-expanded]').first().click();

  await page.getByRole('group', { name: 'Set type' }).getByRole('button', { name: 'Working', exact: true }).click();

  const modeGroup = page.locator('[aria-label="Weight entry mode"]');
  await expect(modeGroup).toBeVisible();
  const totalButton = modeGroup.getByRole('button', { name: /total weight/i });
  await totalButton.click();

  const weight = page.getByLabel('Total weight (lbs)');
  await weight.fill('225');
  await page.locator('input[type="number"]').nth(1).fill('10');
  await page.getByRole('button', { name: /^log set/i }).first().click();

  // The stored total is the number that was typed...
  await expect
    .poll(() =>
      page.evaluate(() => {
        const rows = JSON.parse(localStorage.getItem('gymlog_gymlog:entries') ?? '[]') as { weight: number }[];
        return rows.some((e) => e.weight === 225);
      }),
    )
    .toBe(true);

  // ...and the box still holds it, under a toggle that still says Total.
  await expect(totalButton).toHaveAttribute('aria-pressed', 'true');
  await expect(weight).toHaveValue('225');
});
