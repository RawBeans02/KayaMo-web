import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 800 } });

test.describe('Lis rail vocabulary', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Local desk — not the hosted build.',
  );

  test('server-confirmed context permissions survive navigation and failed writes stay unverified', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // Must match musContextPermissionsSchema exactly: it is .strict(), so a
    // mock missing a domain fails to parse and every row renders "unverified".
    let permissions = {
      physical_self: false,
      goals_planning: false,
      memory: false,
      faith: false,
      identity: false,
    };
    let failWrite = false;
    await page.route('**/api/mus/permissions', async (route) => {
      if (route.request().method() === 'PUT') {
        if (failWrite)
          return route.fulfill({ status: 503, json: { error: 'unavailable' } });
        const update = route.request().postDataJSON() as {
          domain: keyof typeof permissions;
          allowed: boolean;
        };
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

    await page.getByRole('link', { name: 'Ask Lis', exact: true }).click();
    await expect(page.locator('[data-mus-rail="page"]')).toBeVisible();
    await expect(page.getByText('ask first')).toHaveCount(0);
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

    await page.goto('/today');
    await page.goto('/mus');
    await expect(page.locator('[data-mus-desk]')).toBeVisible();
    await expect(page.locator('[data-mus-rail="page"]')).toBeVisible();
    await expect(page.getByText('ask first')).toHaveCount(0);
    await expect(page.locator('[data-mus-perm="physical_self"]')).toHaveAttribute(
      'data-mus-perm-level',
      'read',
    );
    // Lis has a face (owner decision, 2026-09-18): the shipped expressions
    // render on the Lis surface, at rest neutral, and are decorative beside the
    // name. There is still no expressions gallery and no seed mark.
    await expect(page.getByText('About Lis’s expressions')).toHaveCount(0);
    const faces = page.locator('img[data-mus-face]');
    await expect(faces.first()).toBeVisible();
    await expect(faces.first()).toHaveAttribute('data-mus-face', 'neutral');
    await expect(faces.first()).toHaveAttribute('src', /\/botanical\/mus-neutral\.webp$/);
    await expect(faces.first()).toHaveAttribute('alt', '');
    await expect(page.locator('img[src*="seed-mark"]')).toHaveCount(0);
  });
});
