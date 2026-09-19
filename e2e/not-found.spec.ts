import { expect, test } from '@playwright/test';

// Hosted-safe: an unknown public path, no account.
test('an unknown path gets a real 404 with a way back', async ({ page }) => {
  const response = await page.goto('/this-route-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'That page is not here.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/today');
  // Nothing about the typed URL is echoed back into the page.
  await expect(page.getByText('this-route-does-not-exist')).toHaveCount(0);
});
