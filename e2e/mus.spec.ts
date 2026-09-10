import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('Mus rail vocabulary', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local desk — not the hosted build.');

  test('server-confirmed context permissions survive navigation and failed writes stay unverified', async ({ page }) => {
    test.setTimeout(90_000);
    let permissions = { physical_self: false, goals_planning: false, memory: false, faith: false };
    let failWrite = false;
    await page.route('**/api/mus/permissions', async (route) => {
      if (route.request().method() === 'PUT') {
        if (failWrite) return route.fulfill({ status: 503, json: { error: 'unavailable' } });
        const update = route.request().postDataJSON() as { domain: keyof typeof permissions; allowed: boolean };
        permissions = { ...permissions, [update.domain]: update.allowed };
      }
      return route.fulfill({ json: { permissions } });
    });
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

    await expect(page.locator('[data-desk-shell]')).toHaveAttribute('data-rail', 'collapsed');
    await page.getByRole('button', { name: 'Expand Mus', exact: true }).first().click();
    await expect(page.locator('[data-mus-rail="shell"]')).toBeVisible();
    await expect(page.getByText('ask first')).toHaveCount(0);
    await page.getByRole('button', { name: /of 4 context areas readable/ }).click();
    const todayPerm = page.locator('[data-mus-perm="physical_self"]');
    await expect(todayPerm).toHaveAttribute('data-mus-perm-level', 'off');
    await todayPerm.click();
    await expect(todayPerm).toHaveAttribute('data-mus-perm-level', 'read');

    failWrite = true;
    await todayPerm.click();
    await expect(todayPerm).toHaveAttribute('data-mus-perm-level', 'unverified');
    await expect(page.getByText(/Change not confirmed/)).toBeVisible();
    await expect(todayPerm).toBeDisabled();
    await page.getByRole('button', { name: 'Retry access check' }).click();
    await expect(todayPerm).toHaveAttribute('data-mus-perm-level', 'read');

    await page.goto('/mus');
    await expect(page.locator('[data-mus-desk]')).toBeVisible();
    await expect(page.locator('[data-mus-rail="page"]')).toBeVisible();
    await expect(page.getByText('ask first')).toHaveCount(0);
    await expect(page.locator('[data-mus-perm="physical_self"]')).toHaveAttribute('data-mus-perm-level', 'read');
    await expect(page.locator('[data-mus-face="happy"] img')).toHaveAttribute('src', /mus-happy\.png/);
    await expect(page.locator('[data-mus-face="concerned"] img')).toHaveAttribute('src', /mus-concerned\.png/);
    await expect(page.locator('[data-mus-face="neutral"] img')).toHaveAttribute('src', /mus-neutral\.png/);
    await expect(page.locator('[data-mus-face="thinking"] img')).toHaveAttribute('src', /mus-thinking\.png/);
    await expect(page.locator('[data-mus-face="concerned"]')).toContainText('Concern for the user');
    await expect(page.locator('[data-mus-face="happy"]')).toContainText('milestone the user chose');
    await expect(page.getByRole('navigation', { name: 'Conversations' })).toBeVisible();
    await expect(page.locator('[data-desk-shell]')).toHaveAttribute('data-rail', 'off');
  });
});
