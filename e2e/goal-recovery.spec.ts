import { expect, test } from '@playwright/test';
import { waitForUserIndexedDb } from './helpers/idb';

test('goal save failure retains input and retries once after reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await waitForUserIndexedDb(page);
  await page.getByRole('link', { name: 'Goals', exact: true }).click();
  await page.getByRole('button', { name: 'Create your first goal', exact: true }).click();
  await page.getByRole('button', { name: 'Write it myself', exact: true }).click();
  await page.getByLabel('The goal', { exact: true }).fill('A recoverable goal');
  await page
    .getByLabel('First step, today-sized', { exact: true })
    .fill('A recoverable first step');
  // Only this isolated test browser is affected. The first milestone write
  // fails after the goal write; the original browser API is restored immediately.
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === 'goal_milestones') {
        IDBObjectStore.prototype.add = add;
        throw new DOMException('Simulated storage limit', 'QuotaExceededError');
      }
      return add.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Make this my goal', exact: true }).click();
  await expect(
    page.getByText('Could not finish saving. Your input is still here. Please retry.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'The goal', exact: true })).toHaveValue(
    'A recoverable goal',
  );
  await expect(
    page.getByRole('button', { name: 'Make this my goal', exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: 'Create your first goal', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'The goal', exact: true })).toHaveValue(
    'A recoverable goal',
  );
  await page.getByRole('button', { name: 'Make this my goal', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Goal editor' })
      .getByRole('heading', { name: 'A recoverable goal', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Back to Goals', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A recoverable goal', exact: true }),
  ).toHaveCount(1);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'A recoverable first step', exact: true }),
  ).toHaveCount(1);
});

test('task dialog traps keyboard focus and declining discard preserves the draft', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await expect(page.getByLabel('Capture a thought or task')).toBeEnabled();
  await page.getByLabel('Capture a thought or task').fill('Keyboard review task');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  const opener = page.getByRole('button', {
    name: 'Edit Keyboard review task',
    exact: true,
  });
  await opener.click();
  await expect(page.getByLabel('Task', { exact: true })).toBeFocused();
  const tabKey =
    browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press(tabKey);
    expect(
      await page
        .getByRole('dialog')
        .evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.getByLabel('Task', { exact: true }).fill('Keep this draft');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Task', { exact: true })).toHaveValue('Keep this draft');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
});
