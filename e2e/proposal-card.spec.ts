import { expect, test } from '@playwright/test';

test.describe('proposal card isolation', () => {
  // The gallery route calls notFound() in a production build, so it exists
  // only under the dev server: not hosted, and not the production-build job.
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL) || process.env.PLAYWRIGHT_WEB_SERVER === 'start',
    'Dev gallery is dev-server only.',
  );

  test('renders all three risk tiers and gates high-risk on the word apply', async ({ page }) => {
    await page.goto('/dev/proposal-card');
    await expect(page.getByRole('heading', { name: 'Proposal card' })).toBeVisible();

    const low = page.locator('[data-demo="low"]');
    await expect(low.getByText('low risk · applies with undo')).toBeVisible();
    await expect(low.getByText('touches')).toBeVisible();
    await expect(low.getByText('Foods', { exact: true })).toBeVisible();
    await low.getByRole('button', { name: 'Apply' }).click();
    await expect(low.getByRole('button', { name: 'Undo' })).toBeVisible();

    const medium = page.locator('[data-demo="medium"]');
    await expect(medium.getByText('medium risk · preview first')).toBeVisible();
    await medium.getByRole('button', { name: 'Confirm' }).click();
    await expect(medium.getByRole('button', { name: 'Undo' })).toBeVisible();

    const high = page.locator('[data-demo="high"]');
    await expect(high.getByText('high risk · needs the word')).toBeVisible();
    const applyTarget = high.getByRole('button', { name: 'Apply target' });
    await expect(applyTarget).toBeDisabled();
    await high.getByPlaceholder('apply').fill('apply');
    await expect(applyTarget).toBeEnabled();
    await applyTarget.click();
    await expect(high.getByRole('button', { name: 'Undo' })).toBeVisible();

    const blocks = page.locator('[data-demo="blocks"]');
    await expect(blocks.getByText('15:30', { exact: true })).toBeVisible();
    await expect(blocks.getByText('Gym · Push A', { exact: true })).toBeVisible();
  });
});
