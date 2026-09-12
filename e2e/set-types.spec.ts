import { expect, test } from '@playwright/test';

/**
 * Set types end to end. The unit tests cover the maths; this covers the wiring
 * from the picker to what actually lands in localStorage, because the failure
 * mode is silent — a mislabelled set corrupts what your history means without
 * anything looking broken.
 */
test('a drop set is stored as one and never becomes the PB', async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /train/i }).first().click();
  await page.locator('[aria-expanded]').first().click();

  const picker = page.locator('[aria-labelledby^="set-type-"]');
  await expect(picker).toBeVisible();

  // Explicit choice, not a cycle: one press selects exactly that type.
  await picker.getByRole('button', { name: 'Drop', exact: true }).click();
  await expect(picker.getByRole('button', { name: 'Drop', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  const modeGroup = page.locator('[aria-label="Weight entry mode"]');
  if (await modeGroup.count()) {
    await modeGroup.getByRole('button', { name: /total weight/i }).click();
  }

  const numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('500');
  await numbers.nth(1).fill('10');
  await page.getByRole('button', { name: /^log set/i }).first().click();

  const readLoggedSet = () =>
    page.evaluate(() => {
      const raw = localStorage.getItem('gymlog_gymlog:entries') ?? '[]';
      const rows = JSON.parse(raw) as { weight: number; dropSet?: true; toFailure?: true }[];
      const row = rows.find((e) => e.weight === 500);
      // Report key presence, since "absent, not false" is the thing under test.
      return row ? { dropSet: row.dropSet, hasToFailureKey: 'toFailure' in row } : null;
    });

  await expect.poll(readLoggedSet).toEqual({ dropSet: true, hasToFailureKey: false });

  // An absurdly heavy drop must not show up as the personal best.
  await expect(page.locator('body')).not.toContainText('PB 500');
});
