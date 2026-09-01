import { expect, test, type Page } from '@playwright/test';
import { seedTodayEntries } from './helpers/food-entries';

const VIEWPORT = { width: 1440, height: 800 };

test.use({ viewport: VIEWPORT });

test.describe('desktop shell overflow', () => {
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Local grid contract — not the hosted build.');

  test('main scrolls inside the shell; ⌘\\ reclaims the 316px rail', async ({ page }) => {
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

    await seedTodayEntries(page);
    await page.reload();
    const onToday = await measureShell(page);
    expect(onToday.footerInView, 'sidebar footer stays on /today').toBe(true);
    expect(onToday.pageScrolls).toBe(false);

    await page.goto('/calories');
    await expect(page.locator('[data-calories-log]')).toBeVisible();
    await expect(page.locator('[data-entry-row]').first()).toBeVisible();

    const before = await measureShell(page);
    expect(before.pageScrolls, 'document should not scroll — main owns overflow').toBe(false);
    expect(before.mainScrolls, 'main must overflow internally when the log is long').toBe(true);
    expect(before.footerInView, 'sidebar footer must stay in the viewport').toBe(true);
    expect(before.railFootInView, 'rail footer must stay in the viewport').toBe(true);
    expect(before.railWidth).toBeGreaterThanOrEqual(310);
    expect(before.railWidth).toBeLessThanOrEqual(322);
    expect(before.columnCount).toBe(3);

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+\\' : 'Control+\\');
    await expect(page.locator('[data-desk-shell]')).toHaveAttribute('data-rail', 'collapsed');

    const after = await measureShell(page);
    expect(after.pageScrolls).toBe(false);
    expect(after.footerInView).toBe(true);
    expect(after.columnCount).toBe(3);
    expect(after.railWidth, 'collapsed rail is 40px, not an empty 316px gap').toBeGreaterThanOrEqual(36);
    expect(after.railWidth).toBeLessThanOrEqual(48);
    expect(after.mainWidth - before.mainWidth).toBeGreaterThan(250);
  });
});

async function measureShell(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('[data-desk-shell]');
    const main = document.querySelector<HTMLElement>('[data-shell="main"]');
    const footer = document.querySelector<HTMLElement>('[data-shell="sidebar-footer"]');
    const rail = document.querySelector<HTMLElement>('[data-shell="rail"]');
    const railFoot = document.querySelector<HTMLElement>('[data-shell="rail-foot"]');
    if (!shell || !main || !footer || !rail) {
      throw new Error('shell landmarks missing');
    }
    const viewport = window.innerHeight;
    const footerBox = footer.getBoundingClientRect();
    const railBox = rail.getBoundingClientRect();
    const railFootBox = railFoot?.getBoundingClientRect();
    const columns = getComputedStyle(shell).gridTemplateColumns.split(' ').filter(Boolean);
    return {
      pageScrolls: document.documentElement.scrollHeight > viewport + 1,
      mainScrolls: main.scrollHeight > main.clientHeight + 1,
      footerInView: footerBox.bottom <= viewport + 1 && footerBox.top >= 0,
      railFootInView: railFootBox ? railFootBox.bottom <= viewport + 1 && railFootBox.top >= 0 : true,
      railWidth: Math.round(railBox.width),
      mainWidth: Math.round(main.getBoundingClientRect().width),
      columnCount: columns.length,
    };
  });
}
