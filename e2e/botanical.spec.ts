import { expect, test, type Page } from '@playwright/test';
import { waitForUserIndexedDb } from './helpers/idb';

async function enterDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByLabel('Capture a thought or task')).toBeEnabled();
}
test.use({ colorScheme: 'light' });
test('Home capture, edit, completion and Grove records survive reload', async ({
  page,
}) => {
  await enterDemo(page);
  await page.getByLabel('Capture a thought or task').fill('Take a quiet walk');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Take a quiet walk', exact: true }).click();
  await page.getByLabel('Task', { exact: true }).fill('Take a longer quiet walk');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await page
    .getByRole('checkbox', { name: 'Complete Take a longer quiet walk', exact: true })
    .check();
  await page.getByRole('link', { name: 'Grove', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Grove', exact: true })).toBeVisible();
  await expect(page.getByText('Take a longer quiet walk', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Take a longer quiet walk', { exact: true })).toBeVisible();
});
test('goal first step reaches Home and explicit milestone confirmation reaches Grove', async ({
  page,
}) => {
  await enterDemo(page);
  await page.getByRole('link', { name: 'Goals', exact: true }).click();
  await page.getByRole('button', { name: 'Create your first goal', exact: true }).click();
  await page.getByRole('button', { name: 'Write it myself', exact: true }).click();
  await page.getByLabel('The goal', { exact: true }).fill('Build a writing habit');
  await page
    .getByLabel('First step, today-sized', { exact: true })
    .fill('Write one paragraph');
  await page.getByRole('button', { name: 'Make this my goal', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Goal editor' })
      .getByRole('heading', { name: 'Build a writing habit', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Confirm step complete', exact: true }).click();
  await expect(page.getByText('Step confirmed.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Goals', exact: true }).click();
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Write one paragraph', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Grove', exact: true }).click();
  await expect(page.getByText('Milestone completed', { exact: true })).toBeVisible();
});
test('all five destinations and appearance remain usable at narrow widths', async ({
  page,
}, testInfo) => {
  await enterDemo(page);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/today');
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
    // Below 900px the desktop rail gives way to the floating tab bar, so each
    // width asserts whichever navigation that width is supposed to show.
    if (width >= 900) {
      for (const name of ['Home', 'Life', 'Food', 'Goals', 'Grove', 'Lis']) {
        await expect(
          page
            .getByRole('navigation', { name: 'Sections' })
            .getByRole('link', { name, exact: true }),
        ).toBeVisible();
      }
    } else {
      for (const name of ['Home', 'Life', 'Lis', 'Profile']) {
        await expect(
          page
            .getByRole('navigation', { name: 'Main' })
            .getByRole('link', { name, exact: true }),
        ).toBeVisible();
      }
      await expect(
        page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Log' }),
      ).toBeVisible();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('home-' + width + '.png'),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['goals', 'life', 'grove', 'mus', 'settings']) {
    await page.goto('/' + route);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(route + '-390.png'),
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-kayamo-theme', 'night');
  await page.getByRole('checkbox', { name: 'Reduce Transparency', exact: false }).check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-kayamo-theme', 'night');
  await expect(page.locator('html')).toHaveAttribute('data-reduce-transparency', 'true');
  await page.getByRole('button', { name: 'System', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-kayamo-theme', 'day');
});
test('week navigation keeps dated tasks separate and editor drafts survive reload', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-09-11T04:00:00Z'));
  await enterDemo(page);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Friday, September 18', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Capture a thought or task').fill('Prepare next week');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Prepare next week', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Previous week', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Prepare next week', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Prepare next week', exact: true }).click();
  await page
    .getByLabel('Task', { exact: true })
    .fill('Prepare next week with a preserved draft');
  await page.reload();
  await page.getByRole('button', { name: 'Next week', exact: true }).click();
  await page.getByRole('button', { name: 'Edit Prepare next week', exact: true }).click();
  await expect(page.getByLabel('Task', { exact: true })).toHaveValue(
    'Prepare next week with a preserved draft',
  );
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: 'Prepare next week with a preserved draft',
      exact: true,
    }),
  ).toBeVisible();
});

test('reference Home uses saved illustrative records, not production fixtures', async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.clock.setFixedTime(new Date('2026-09-11T04:00:00Z'));
  await enterDemo(page);
  const dbName = await waitForUserIndexedDb(page);
  const userId = (await context.cookies()).find(
    (cookie) => cookie.name === 'kayamo_guest',
  )?.value;
  expect(userId).toBeTruthy();
  await page.evaluate(
    async ({ dbName, userId }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['tasks', 'time_blocks'], 'readwrite');
          const at = '2026-09-11T04:00:00Z';
          const titles = ['Outline thesis chapter', 'Walk outside', 'Prepare dinner'];
          const starts = [540, 750, 1080];
          const durations = [45, 20, 30];
          titles.forEach((title, index) => {
            const id = 'visual-task-' + index;
            transaction.objectStore('tasks').put({
              id,
              user_id: userId,
              title,
              notes: null,
              scheduled_for: '2026-09-11',
              due_at: null,
              completed_at: null,
              sort_order: index,
              origin: 'user',
              created_at: at,
              updated_at: at,
              server_updated_at: at,
              deleted_at: null,
            });
            transaction.objectStore('time_blocks').put({
              id: 'visual-block-' + index,
              user_id: userId,
              title,
              logical_date: '2026-09-11',
              kind: 'TASK',
              start_min: starts[index],
              end_min: starts[index]! + durations[index]!,
              flexibility: 'FLEXIBLE',
              locked: false,
              source_table: 'tasks',
              source_id: id,
              notes: null,
              created_at: at,
              updated_at: at,
              deleted_at: null,
            });
          });
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => {
            db.close();
            reject(transaction.error);
          };
        };
      });
    },
    { dbName, userId },
  );
  await page.reload();
  await expect(
    page.getByRole('button', {
      name: 'Start next step: Outline thesis chapter',
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('home-reference.png'),
    fullPage: false,
  });
});
