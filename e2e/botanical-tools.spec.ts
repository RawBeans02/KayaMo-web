import { expect, test } from '@playwright/test';
test.use({ colorScheme: 'light' });
test('food, workout and planner tools fit narrow browsers', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['calories', 'gym', 'todos', 'foods', 'verify']) {
      await page.goto('/' + route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        route + ' at ' + width,
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(route + '-' + width + '.png'),
        fullPage: true,
      });
    }
  }
});
