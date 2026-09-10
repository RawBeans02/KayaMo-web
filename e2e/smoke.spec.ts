import { expect, test } from '@playwright/test';

test('shows the desktop login surface', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to KayaMo.' })).toBeVisible();
  await expect(page.getByText('KayaMo', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible();
});
