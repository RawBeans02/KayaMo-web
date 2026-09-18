import { expect, test } from '@playwright/test';

test('worldwide search keeps demo data local and rejects unauthenticated API requests', async ({ page }) => {
  let searches = 0;
  page.on('request', (request) => { if (request.url().includes('/api/foods/worldwide')) searches++; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).first().click();
  await page.waitForURL('**/today');
  await page.goto('/foods');
  await expect(page.getByRole('heading', { name: 'Find foods from around the world' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in for worldwide search' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search worldwide', exact: true })).toHaveCount(0);
  expect(searches).toBe(0);
  const response = await page.request.post('/api/foods/worldwide', { data: { query: 'tofu' } });
  expect(response.status()).toBe(401);
});

test('worldwide result portion review logs the scaled snapshot and supports undo', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto('/login');
  const skip = page.getByRole('button', { name: 'Skip login on this machine' });
  if (!(await skip.isVisible().catch(() => false))) test.skip(true, 'Local sign-in is not available.');
  await skip.click();
  await page.waitForURL('**/today');
  await page.route('**/api/foods/worldwide', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ query: 'tofu' });
    await route.fulfill({ json: { foods: [{
      name: 'E2E Worldwide Tofu', source: 'off', sourceId: 'test-source', confidence: 0.8,
      per100g: { kcal: 100, protein_g: 10, carbs_g: 5, fat_g: 5, fiber_g: 1, sugar_g: 1, sodium_mg: 10 },
      servings: [{ label: '100 g', grams: 100, isDefault: true }],
      attribution: 'Open Food Facts — ODbL test fixture',
    }] } });
  });
  await page.goto('/foods');
  await page.getByLabel('Food, brand, or barcode', { exact: true }).fill('tofu');
  await page.getByRole('button', { name: 'Search worldwide', exact: true }).click();
  await page.getByRole('button', { name: /E2E Worldwide Tofu/ }).click();
  const review = page.getByRole('region', { name: 'Review food portion' });
  await expect(review).toBeFocused();
  await review.getByLabel('Amount in grams').fill('150');
  await expect(review.getByText('150 kcal for this amount')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(review).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('worldwide-review-390.png'), fullPage: true });
  await review.getByRole('button', { name: 'Log this food' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Logged E2E Worldwide Tofu' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Logged E2E Worldwide Tofu' })).toHaveCount(0);
  await page.getByRole('button', { name: /E2E Worldwide Tofu/ }).click();
  await review.getByLabel('Amount in grams').fill('150');
  await review.getByRole('button', { name: 'Log this food' }).click();
  await page.getByRole('link', { name: 'Open diary', exact: true }).click();
  await page.reload();
  const row = page.locator('[data-entry-row]').filter({ hasText: 'E2E Worldwide Tofu' });
  await expect(page.getByText('E2E Worldwide Tofu', { exact: true })).toHaveCount(1);
  await expect(row.getByText('150', { exact: true })).toBeVisible();
  await expect(row.getByText('150 g', { exact: true })).toBeVisible();
});
