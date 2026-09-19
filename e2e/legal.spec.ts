import { expect, test } from '@playwright/test';

const PAGES = [
  { path: '/privacy', title: 'What KayaMo keeps, and why.' },
  { path: '/terms', title: 'What KayaMo is, and is not.' },
  { path: '/accessibility', title: 'Usable by more people, on purpose.' },
];

test.describe('legal pages', () => {
  test('render without sign-in, link to each other, and fit 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    for (const { path, title } of PAGES) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace('/', '\\/') + '$'));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      // Published as drafts until the owner approves the texts.
      await expect(page.getByRole('note')).toContainText('Draft, under review.');
      // The contact is real and the same on every page.
      await expect(page.getByRole('main').getByRole('link', { name: /@/ }).first()).toHaveAttribute(
        'href',
        /^mailto:/,
      );
      for (const other of PAGES) {
        await expect(
          page.getByRole('navigation', { name: 'Policies' }).getByRole('link', {
            name: other.path === '/privacy' ? 'Privacy' : other.path === '/terms' ? 'Terms' : 'Accessibility',
          }),
        ).toBeVisible();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    }
  });

  test('the landing, login and profile link to the policies', async ({ page }) => {
    // Both footers sit inside <main>, so they carry no contentinfo role; the
    // links live in a nav named "Legal".
    await page.goto('/');
    for (const name of ['Privacy', 'Terms', 'Accessibility']) {
      await expect(
        page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name, exact: true }),
      ).toBeVisible();
    }
    await page.goto('/login');
    await expect(
      page.getByRole('navigation', { name: 'Legal' }).getByRole('link', { name: 'Privacy', exact: true }),
    ).toBeVisible();
  });
});
