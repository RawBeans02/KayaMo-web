import { clerk, clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';
import { expect, test } from '@playwright/test';

/**
 * The whole front door, end to end: a new person creates an account on
 * Clerk's form, Clerk sends them to /auth/bridge, the bridge mints the
 * Supabase session, the workspace opens, Profile shows the email, and sign
 * out ends both sessions. Runs only where the Clerk keys exist (a dev
 * instance); the +clerk_test address means Clerk sends no email and accepts
 * the fixed verification code.
 */
const KEYS = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

test.describe('clerk sign-up and the bridge', () => {
  test.skip(!KEYS, 'Needs NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.');
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Creates an account; local only.');
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async () => {
    process.env.CLERK_PUBLISHABLE_KEY ??= process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    await clerkSetup();
  });

  test('a new account opens the workspace, and sign-out closes it', async ({ page }) => {
    const email = `e2e-${Date.now()}+clerk_test@example.com`;
    const password = `Kaya-${Date.now()}-mo!`;
    await setupClerkTestingToken({ page });
    await page.goto('/sign-up');
    await expect(page.locator('.cl-rootBox')).toBeVisible({ timeout: 20_000 });
    const form = page.locator('.cl-rootBox');
    const username = form.getByRole('textbox', { name: 'Username' });
    if (await username.count()) await username.fill(`e2e${Date.now()}`);
    await form.getByRole('textbox', { name: 'Email address' }).fill(email);
    await form.getByRole('textbox', { name: 'Password' }).fill(password);
    // The visible Continue: Clerk also renders a hidden type="submit" button.
    await form.getByRole('button', { name: 'Continue', exact: true }).click();
    // Clerk's email code step; test addresses take the fixed code.
    const code = page.locator('input[name="code"], input[autocomplete="one-time-code"]').first();
    await expect(code).toBeVisible({ timeout: 20_000 });
    await code.fill('424242');
    await page.waitForURL('**/today', { timeout: 30_000 });
    await expect(page.locator('[data-desk-shell]')).toBeVisible();
    await expect(page.getByTestId('sync-status')).not.toHaveAttribute(
      'data-sync-kind',
      'local_db_error',
    );
    await page.goto('/settings');
    await expect(page.getByText(email, { exact: false }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL('**/login**', { timeout: 20_000 });
    await page.goto('/today');
    await expect(page).toHaveURL(/\/login\?next=%2Ftoday/);
  });

  test('a returning person signs in and lands on the bridge', async ({ page }) => {
    test.skip(!process.env.E2E_CLERK_USER_EMAIL || !process.env.E2E_CLERK_USER_PASSWORD, 'Needs an E2E Clerk user.');
    await setupClerkTestingToken({ page });
    await page.goto('/login');
    await clerk.signIn({
      page,
      signInParams: {
        strategy: 'password',
        identifier: process.env.E2E_CLERK_USER_EMAIL!,
        password: process.env.E2E_CLERK_USER_PASSWORD!,
      },
    });
    await page.goto('/auth/bridge?next=/today');
    await expect(page.locator('[data-desk-shell]')).toBeVisible({ timeout: 20_000 });
  });
});
