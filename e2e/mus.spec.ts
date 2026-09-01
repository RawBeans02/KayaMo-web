import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('Mus rail vocabulary', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local desk — not the hosted build.');

  test('one five-level permission model on the rail and the Mus screen', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/login');
    const skip = page.getByRole('button', { name: 'Skip login on this machine' });
    if (!(await skip.isVisible().catch(() => false))) {
      test.skip(true, 'Local sign-in is not available.');
    }
    await skip.click();
    await page.waitForURL('**/today');
    await expect(page.locator('[data-desk-shell]')).toBeVisible();
    await expect(page.getByTestId('sync-status')).not.toHaveAttribute(
      'data-sync-kind',
      'local_db_error',
      { timeout: 15_000 },
    );

    await expect(page.locator('[data-mus-rail="shell"]')).toBeVisible();
    await expect(page.getByText('ask first')).toHaveCount(0);
    await page.getByRole('button', { name: /of 5 modules readable/ }).click();
    const todayPerm = page.locator('[data-mus-perm="today"]');
    await expect(todayPerm).toHaveAttribute('data-mus-perm-level', 'edit w/ approval');
    await todayPerm.click();
    await expect(todayPerm).toHaveAttribute('data-mus-perm-level', 'edit');

    await page.goto('/mus');
    await expect(page.locator('[data-mus-desk]')).toBeVisible();
    await expect(page.locator('[data-mus-rail="page"]')).toBeVisible();
    await expect(page.getByText('ask first')).toHaveCount(0);
    await expect(page.locator('[data-mus-perm="today"]')).toHaveAttribute('data-mus-perm-level', 'edit');
    await expect(page.locator('[data-mus-face="concerned"]')).toContainText('Concern for the user');
    await expect(page.locator('[data-mus-face="happy"]')).toContainText('milestone the user chose');
    await expect(page.getByRole('navigation', { name: 'Conversations' })).toBeVisible();
    await expect(page.locator('[data-desk-shell]')).toHaveAttribute('data-rail', 'off');
  });
});
