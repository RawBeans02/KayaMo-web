import { expect, test, type Page } from '@playwright/test';
import { seedActiveRest } from './helpers/rest-timer';
import { waitForUserIndexedDb } from './helpers/idb';

test.use({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });

async function demo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await expect(page.locator('[data-desk-shell]')).toBeVisible();
  await expect(page.getByTestId('sync-status')).not.toHaveAttribute('data-sync-kind', 'local_db_error');
}

for (const status of [503, 200]) {
  test(`demo catalog failure (${status}) is recoverable without opening an empty workspace`, async ({ page }) => {
    let fail = true;
    await page.route('**/demo-catalog.json', (route) => fail ? route.fulfill({ status, contentType: 'application/json', body: '{}' }) : route.continue());
    await page.goto('/');
    await page.getByRole('button', { name: 'Explore the demo' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Your saved data' })).toContainText('has not been cleared');
    await expect(page.locator('[data-desk-shell]')).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.locator('[data-desk-shell]')).toBeVisible();
  });
}

test('empty remote refresh preserves searchable demo foods and valid shell markup', async ({ page }) => {
  const renderingErrors: string[] = [];
  page.on('pageerror', (error) => renderingErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat|descendant|cannot contain/i.test(message.text())) {
      renderingErrors.push(message.text());
    }
  });
  await page.route('**/rest/v1/foods?**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await demo(page);
  const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname === '/rest/v1/foods');
  await page.goto('/foods');
  await (await refreshed).finished();
  await page.getByRole('button', { name: /^PH core/ }).click();
  await page.getByLabel('Filter by name or Taglish alias').fill('adobo');
  await expect(page.locator('[data-foods-row]').first()).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-sync-kind', 'local_only');
  expect(renderingErrors).toEqual([]);
});

test('task draft survives polling and saved title survives reload', async ({ page }) => {
  await demo(page);
  await page.goto('/todos');
  await page.getByLabel('Capture a task').fill('Release test task');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: /^Release test task/ }).click();
  await page.getByLabel('Title', { exact: true }).fill('Edited release test task');
  await page.waitForTimeout(5500); // Intentionally crosses the 4-second database poll.
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Edited release test task');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect(page.getByRole('button', { name: /^Edited release test task/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /^Edited release test task/ })).toBeVisible();
});

test('recorded workout actuals survive reload and copying is blocked during a session', async ({ page }) => {
  await demo(page);
  await page.goto('/gym');
  await page.getByLabel('Search lifts').fill('Bench press');
  await page.getByRole('button', { name: 'Barbell Bench Press', exact: true }).click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy last workout' })).toBeDisabled();
  await page.getByRole('button', { name: /Barbell Bench Press you/ }).click();
  await page.getByLabel('Weight in kg for Barbell Bench Press set 1').fill('37.5');
  await page.getByLabel('Reps for Barbell Bench Press set 1').fill('7');
  await page.getByLabel('Reps in reserve for Barbell Bench Press set 1').fill('2');
  await page.getByRole('button', { name: 'Complete', exact: true }).first().click();
  await expect(page.getByText('37.5 × 7', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /Barbell Bench Press you/ }).click();
  await expect(page.getByText('37.5 × 7', { exact: true })).toBeVisible();
  await expect(page.getByText('RIR 2', { exact: true })).toBeVisible();
});

test('demo food logging persists and guest AI requests never leave the browser', async ({ page }) => {
  let onlinePosts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/(mus|gym)\//.test(request.url())) onlinePosts++;
  });
  await demo(page);
  await page.getByRole('button', { name: 'Log food', exact: true }).click();
  const palette = page.locator('[data-palette="log"]');
  await palette.getByRole('combobox').fill('kanin');
  await expect(palette.getByRole('option').first()).toBeVisible();
  await palette.getByRole('combobox').press('Enter');
  await expect(page.getByLabel('This plate')).toContainText(/kanin/i);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('[data-entry-row]').filter({ hasText: /kanin/i })).toHaveCount(1);
  await page.goto('/gym');
  await page.getByRole('button', { name: 'Ask Mus to fill gaps' }).click();
  await expect(page.getByText('Could not consult. Pick from the list.')).toBeVisible();
  expect(onlinePosts).toBe(0);
});

test('an active workout from yesterday remains usable', async ({ page }) => {
  await demo(page);
  await seedActiveRest(page, 90);
  const name = await waitForUserIndexedDb(page);
  await page.evaluate(async (dbName) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(dbName);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('workouts', 'readwrite');
        const store = tx.objectStore('workouts');
        const get = store.get('e2e-rest-workout');
        get.onsuccess = () => store.put({ ...get.result, logical_date: '2020-01-01' });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
  }, name);
  await page.goto('/gym');
  await expect(page.getByRole('button', { name: 'Pause session', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy last workout' })).toBeDisabled();
  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeVisible();
});
