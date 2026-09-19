import { expect, test } from '@playwright/test';

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
      await expect(
        page.getByRole('textbox', { name: 'Email', exact: true }),
      ).toBeVisible();
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Sign in', exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      if (width < 800) {
        // The login shows no mascot (Lis's face renders on the Lis surface). The
        // intent this guarded still holds: on a phone the email field must come
        // before any supporting copy.
        const form = await page
          .getByRole('textbox', { name: 'Email', exact: true })
          .boundingBox();
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
    await page.getByRole('textbox', { name: 'Email', exact: true }).focus();
    // macOS WebKit follows Safari's default keyboard policy: Option-Tab
    // reaches every control, while plain Tab skips buttons. Keep the same
    // focus assertion and exercise the platform's native keyboard shortcut.
    await page.keyboard.press(
      browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab',
    );
    await expect(page.getByLabel('Password', { exact: true })).toBeFocused();
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

  // Every auth request is intercepted; these tests describe the form's contract
  // with the person, not the provider. The real round trip is
  // e2e/password-sign-in.spec.ts against the local Supabase.
  test('a wrong password reads the same as an unknown email and hides backend details', async ({
    page,
  }) => {
    let calls = 0;
    await page.route('**/auth/v1/token?**', async (route) => {
      calls++;
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'invalid_credentials',
          error_code: 'invalid_credentials',
          msg: 'Invalid login credentials (provider detail)',
        }),
      });
    });
    await page.goto('/login');
    await expect(page.locator('[data-hydrated]')).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill('entry-review@example.com');
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Email or password did not match.' }),
    ).toBeVisible();
    await expect(page.getByText('provider detail')).toHaveCount(0);
    expect(calls).toBe(1);
    // Typing again clears the message; the person is not nagged. (Scoped to
    // the form's text: Next's dev overlay mounts an empty alert of its own.)
    await page.getByLabel('Password', { exact: true }).fill('another-try');
    await expect(page.getByRole('alert').filter({ hasText: 'did not match' })).toHaveCount(0);
  });

  test('a short password never leaves the browser', async ({ page }) => {
    let calls = 0;
    await page.route('**/auth/v1/**', async (route) => {
      calls++;
      await route.fulfill({ status: 500, body: '' });
    });
    await page.goto('/login');
    await expect(page.locator('[data-hydrated]')).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill('entry-review@example.com');
    await page.getByLabel('Password', { exact: true }).fill('short');
    // The native minLength check blocks the submit; the create-account button
    // bypasses it, so the form's own check must speak.
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'at least 8 characters' }),
    ).toBeVisible();
    expect(calls).toBe(0);
  });

  test('creating an account with a taken email points at sign-in', async ({ page }) => {
    await page.route('**/auth/v1/signup**', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'user_already_exists',
          error_code: 'user_already_exists',
          msg: 'User already registered',
        }),
      }),
    );
    await page.goto('/login');
    await expect(page.locator('[data-hydrated]')).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill('entry-review@example.com');
    await page.getByLabel('Password', { exact: true }).fill('a-long-enough-password');
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'already has an account' }),
    ).toBeVisible();
    await expect(page.getByText('User already registered')).toHaveCount(0);
  });

  test('rate limiting is recoverable and hides backend details', async ({ page }) => {
    await page.route('**/auth/v1/token?**', (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ msg: 'internal provider detail' }),
      }),
    );
    await page.goto('/login');
    await page.clock.install();
    await expect(page.locator('[data-hydrated]')).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill('entry-review@example.com');
    await page.getByLabel('Password', { exact: true }).fill('a-long-enough-password');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Too many attempts' }),
    ).toBeVisible();
    await expect(page.getByText('internal provider detail')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'New here? Create an account' }),
    ).toBeDisabled();
    await page.clock.runFor(61_000);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
  });

  test('callback states and demo copy are honest', async ({ page }) => {
    await page.goto('/login?sent=1&from=demo');
    // `sent=1` belonged to the emailed link; with passwords there is no inbox
    // to point at, so the form shows no "check your inbox" status.
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(
      page.getByText('Signing in does not transfer', { exact: false }),
    ).toBeVisible();
    await page.goto('/login?error=This%20link%20has%20expired');
    await expect(
      page.getByRole('alert').filter({ hasText: 'This link has expired' }),
    ).toBeVisible();
    // The alert is server-rendered, so its visibility says nothing about
    // whether React has attached the onChange that dismisses it. Wait for the
    // form's post-mount marker; WebKit in CI typed before hydration and lost
    // the event.
    await expect(page.locator('[data-hydrated]')).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill('entry-review@example.com');
    await expect(page.getByText('This link has expired')).toHaveCount(0);
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
