import { expect, test } from '@playwright/test';

const CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

test.describe('public entry pages', () => {
  test.use({ colorScheme: 'light' });
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Local redesign and mocked auth contract.',
  );

  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`landing and login fit a ${width}px viewport`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        'One place for the day you meant to have.',
      );
      await expect(page.getByRole('button', { name: 'Explore the demo' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('landing.png'), fullPage: true });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await page.goto('/login');
      await expect(page.locator('[data-login-form]')).toBeVisible();
      if (CLERK) await expect(page.locator('.cl-rootBox')).toBeVisible({ timeout: 15_000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      if (width < 800) {
        // The login shows no mascot (Lis's face renders on the Lis surface). The
        // intent this guarded still holds: on a phone the form must come
        // before any supporting copy.
        const form = await page.locator('[data-login-form]').boundingBox();
        const help = await page
          .getByRole('group', { name: 'Need help signing in?' })
          .or(page.getByText('Need help signing in?'))
          .first()
          .boundingBox();
        expect(form!.y).toBeLessThan(help!.y);
      }
      await page.screenshot({ path: testInfo.outputPath('login.png'), fullPage: true });
    });
  }

  test('theme toggle and keyboard focus work on the login', async ({
    page,
    browserName,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-kayamo-theme', 'night');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-kayamo-theme', 'night');
    // The form is Clerk's own; keyboard order inside it is theirs to keep.
    // Ours to keep: the theme survives a reload and the help control is
    // reachable by keyboard.
    await page.getByText('Need help signing in?').focus();
    await expect(page.getByText('Need help signing in?')).toBeFocused();
    void browserName;
    await page.screenshot({
      path: testInfo.outputPath('login-night.png'),
      fullPage: true,
    });
  });

  test('returning to the demo preserves its identity', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore the demo' }).click();
    await page.waitForURL('**/today');
    const original = (await context.cookies()).find(
      (cookie) => cookie.name === 'kayamo_guest',
    )?.value;
    expect(original).toBeTruthy();
    await page.goto('/');
    await page.getByRole('button', { name: 'Continue your demo' }).click();
    await page.waitForURL('**/today');
    const resumed = (await context.cookies()).find(
      (cookie) => cookie.name === 'kayamo_guest',
    )?.value;
    expect(resumed).toBe(original);
  });

  test('bridge errors and demo copy are honest', async ({ page }) => {
    await page.goto('/login?from=demo');
    await expect(
      page.getByText('Signing in does not transfer', { exact: false }),
    ).toBeVisible();
    // A failed bridge comes back here with a plain sentence, never a provider's.
    await page.goto('/login?error=We%20could%20not%20open%20your%20workspace%20this%20time.');
    await expect(
      page.getByRole('alert').filter({ hasText: 'could not open your workspace' }),
    ).toBeVisible();
    await page.goto('/sign-up');
    await expect(page.getByRole('heading', { name: /Create your KayaMo account/ })).toBeVisible();
    await expect(page.locator('[data-login-mode="sign-up"]')).toBeVisible();
  });

  test('demo opens without a competing rail and Lis uses one destination', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore the demo' }).click();
    await page.waitForURL('**/today');
    await page.getByRole('link', { name: 'Ask Lis', exact: true }).click();
    await expect(page.locator('[data-mus-desk]')).toBeVisible();
    // Exactly one assistant rail on the Lis screen: the shell no longer mounts
    // a second one, which is what "competing rail" meant.
    await expect(page.locator('[data-mus-rail]')).toHaveCount(1);
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.locator('[data-desk-shell]')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  });
});
