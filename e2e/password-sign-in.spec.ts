import { expect, test } from '@playwright/test';

/**
 * The real round trip: an account is created with a password on the local
 * Supabase (email confirmations off there, as on the hosted project), signs
 * in, is refused with the wrong password, and signs in again. Hosted runs
 * skip it so no test account lands in production.
 */
test.describe('password sign-in', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Creates an account; local Supabase only.');

  test('create an account, sign out, be refused with the wrong password, sign in', async ({
    page,
    context,
  }) => {
    const email = `pw-${Date.now()}-${Math.floor(Math.random() * 1e6)}@kayamo.test`;
    const password = `Pw-${Date.now()}-release`;

    await page.goto('/login');
    await expect(page.locator('[data-hydrated]')).toBeVisible();
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    await page.waitForURL('**/today');
    await expect(page.locator('[data-desk-shell]')).toBeVisible();

    // Signed out: the gate sends the workspace back to the login.
    await context.clearCookies();
    await page.goto('/today');
    await expect(page).toHaveURL(/\/login/);

    await expect(page.locator('[data-hydrated]')).toBeVisible();
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(`${password}-wrong`);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Email or password did not match.' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/today');
    await expect(page.locator('[data-desk-shell]')).toBeVisible();
  });
});
