import { expect, test } from '@playwright/test';

test('shows the desktop login surface', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in to KayaMo.' })).toBeVisible();
  await expect(page.getByText('KayaMo', { exact: true })).toBeVisible();
  // Clerk draws the form when its key is set; without it the page says so.
  const form = page.locator('[data-login-form]');
  await expect(form).toBeVisible();
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    await expect(form).toHaveAttribute('data-login-form', 'clerk');
    await expect(page.locator('.cl-rootBox')).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(form).toHaveAttribute('data-login-form', 'unconfigured');
  }
});
