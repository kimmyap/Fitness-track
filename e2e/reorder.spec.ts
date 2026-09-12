import { expect, test, type Page } from '@playwright/test';

/**
 * Exercise reordering. The old control was a ChevronUp/ChevronDown pair sitting
 * directly above a button with `aria-expanded` and above a real <select>, so it
 * read as a dropdown and got pressed by accident during data entry.
 */
const cardOrder = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-exercise]')].map((el) => el.getAttribute('data-exercise') ?? ''),
  );

test.beforeEach(async ({ page }) => {
  await page.goto('./', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: /train/i }).first().click();
  await expect(page.locator('[data-exercise]').first()).toBeVisible();
});

test('the arrow buttons that looked like a dropdown are gone', async ({ page }) => {
  await expect(page.locator('[aria-label*="Move" i][aria-label*="up" i]')).toHaveCount(0);
  await expect(page.locator('[aria-label*="Move" i][aria-label*="down" i]')).toHaveCount(0);
});

test('every card has a drag handle big enough to hit with a thumb', async ({ page }) => {
  const handles = page.locator('[aria-label^="Reorder"]');
  await expect(handles).toHaveCount(await page.locator('[data-exercise]').count());

  const box = await handles.first().boundingBox();
  expect(box).not.toBeNull();
  // CLAUDE.md: >=44px touch targets.
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

/**
 * Drag-only reordering would strand keyboard users, so dnd-kit's KeyboardSensor
 * is wired deliberately and this guards it.
 */
test('reorders by keyboard and persists to the legacy storage key', async ({ page }) => {
  const before = await cardOrder(page);
  /*
   * dnd-kit announces each drag phase here. Waiting on it beats sleeping —
   * an ArrowDown sent before the lift registers is silently dropped. Match any
   * announcement rather than the "picked up" wording: the region holds only the
   * latest message and has usually advanced to "moved over" already.
   */
  const announcer = page.locator('[id^="DndLiveRegion"]');

  await page.locator('[aria-label^="Reorder"]').first().focus();
  await page.keyboard.press('Space');
  await expect(announcer).toContainText(/moved over/i);
  const afterLift = await announcer.textContent();

  // Wait for the move to actually land before dropping, rather than for the
  // announcer merely to be non-empty — it is already non-empty from the lift.
  await page.keyboard.press('ArrowDown');
  await expect.poll(() => announcer.textContent()).not.toBe(afterLift);

  await page.keyboard.press('Space');
  await expect(announcer).toContainText(/dropped/i);

  await expect.poll(() => cardOrder(page)).toEqual([before[1], before[0], ...before.slice(2)]);

  const stored = await page.evaluate(() => localStorage.getItem('gymlog_gymlog:exerciseOrder'));
  expect(stored).toContain(before[1] as string);
});

test('reorders by pointer drag', async ({ page }) => {
  const before = await cardOrder(page);
  const handles = page.locator('[aria-label^="Reorder"]');

  /*
   * page.mouse works in viewport coordinates and does NOT auto-scroll like the
   * action APIs do. At 375x800 the first card sits below the fold, so without
   * this the drag lands on empty space and silently does nothing.
   */
  await handles.first().scrollIntoViewIfNeeded();

  const from = await handles.first().boundingBox();
  const to = await handles.nth(1).boundingBox();
  const startX = from!.x + from!.width / 2;
  const startY = from!.y + from!.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  /*
   * Clearly past the sensor's 6px activation distance — measured from the
   * CENTRE, which is where the pointer already is. Nudging to `y + 20` on a
   * 44px handle is a 2px move and never activates anything.
   */
  await page.mouse.move(startX, startY + 20, { steps: 5 });
  await expect(page.locator('[id^="DndLiveRegion"]')).not.toBeEmpty();

  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => cardOrder(page).then((o) => o[0])).not.toBe(before[0]);
});
