import { expect, test, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function audit(page: Page, info: TestInfo, name: string) {
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
  ).toBe(true);
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    );
  });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  await info.attach(name + '-axe', {
    body: JSON.stringify(
      { violations: results.violations, incomplete: results.incomplete },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  expect
    .soft(
      results.violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ html, failureSummary }) => ({ html, failureSummary })),
      })),
      name,
    )
    .toEqual([]);
}
async function demo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByLabel('Capture a thought or task')).toBeEnabled();
}
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme + ' accessibility', () => {
    test.use({ colorScheme, contextOptions: { reducedMotion: 'reduce' } });
    test('public entry and all destinations meet automated accessibility checks', async ({
      page,
    }, info) => {
      test.setTimeout(180_000);
      for (const route of ['/', '/login', '/privacy', '/terms', '/accessibility']) {
        await page.goto(route);
        await audit(page, info, route === '/' ? 'landing' : route.slice(1));
      }
      await demo(page);
      for (const route of [
        'today',
        'goals',
        'life',
        'grove',
        'mus',
        'settings',
        'calories',
        'gym',
        'todos',
        'foods',
        'verify',
      ]) {
        await page.goto('/' + route);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await audit(page, info, route);
      }
    });
    test('long content and open editors reflow at 320px and 200% text size', async ({
      page,
    }, info) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 320, height: 900 });
      await demo(page);
      const title =
        'Prepare a thoughtful outline for the environmental science presentation and discuss the next practical steps with the study group';
      await page.getByLabel('Capture a thought or task').fill(title);
      await page.getByRole('button', { name: 'Add task', exact: true }).click();
      await page.getByRole('button', { name: 'Edit ' + title, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page, info, 'task-editor');
      await page.screenshot({
        path: info.outputPath('task-editor-320.png'),
        fullPage: false,
      });
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await page.goto('/goals');
      await page
        .getByRole('button', { name: 'Create your first goal', exact: true })
        .click();
      await page.getByRole('button', { name: 'Write it myself', exact: true }).click();
      await page.getByLabel('The goal', { exact: true }).fill(title);
      const goalDialog = page.getByRole('dialog', { name: 'Goal editor' });
      const scrollBounds = await goalDialog
        .locator('[data-goal-editor="scroll"]')
        .boundingBox();
      const footerBounds = await goalDialog
        .locator('[data-goal-editor="footer"]')
        .boundingBox();
      expect(scrollBounds).not.toBeNull();
      expect(footerBounds).not.toBeNull();
      expect(scrollBounds!.y + scrollBounds!.height).toBeLessThanOrEqual(
        footerBounds!.y + 1,
      );
      await audit(page, info, 'goal-editor');
      await page.screenshot({
        path: info.outputPath('goal-editor-320.png'),
        fullPage: false,
      });
      // Navigation/reload draft retention is separately exercised in botanical.spec.ts.
      await page.goto('/settings');
      await page
        .getByRole('checkbox', { name: 'Reduce Transparency', exact: false })
        .check();
      const material = await page.locator('[data-shell="sidebar"]').evaluate((el) => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, blur: style.backdropFilter };
      });
      expect(material.blur).toBe('none');
      expect(material.background).toMatch(/^rgb\(/);
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.addStyleTag({
        content: 'html[data-kayamo-web] { font-size: 32px !important; }',
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await audit(page, info, 'settings-large-text-opaque');
      await page.screenshot({
        path: info.outputPath('settings-large-text.png'),
        fullPage: true,
      });
    });
  });
}
