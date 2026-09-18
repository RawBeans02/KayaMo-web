import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 800 } });

// Hosted-safe: the demo needs no account and the palette resolves against the
// local demo catalog.
test('the log sheet hands a meal draft to the palette with the text intact', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo' }).click();
  await page.waitForURL('**/today');

  await page.getByRole('button', { name: 'Log', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Log' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('tab', { name: 'Meal' }).click();
  await sheet.getByRole('textbox').fill('2 cups kanin');
  await sheet.getByRole('button', { name: 'Find this food' }).click();

  // The sheet dispatched the draft as a bare string while the palette read
  // `detail.query`, so this step used to close the sheet and open nothing.
  const palette = page.locator('[data-palette="log"]');
  await expect(palette).toBeVisible();
  await expect(palette.getByRole('combobox')).toHaveValue('2 cups kanin');
});
