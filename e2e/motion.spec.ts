import { expect, test, type Page } from '@playwright/test';
import { waitForUserIndexedDb } from './helpers/idb';

async function demo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await expect(page.getByLabel('Capture a thought or task')).toBeEnabled();
}

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test.describe(reducedMotion + ' motion', () => {
    test.use({ contextOptions: { reducedMotion } });
    test('press feedback, target sizes and modal focus survive motion preferences', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await demo(page);
      const controls = await page
        .locator('button, a[href], summary')
        .evaluateAll((elements) =>
          elements
            .filter((el) => el.getClientRects().length)
            .map((el) => getComputedStyle(el).transitionDuration),
        );
      expect(controls.length).toBeGreaterThan(20);
      expect(controls.every((value) => value !== '0s')).toBe(true);
      for (const link of [
        page.getByRole('link', { name: 'KayaMo', exact: true }),
        page.getByRole('link', {
          name: 'Sign in · demo entries won’t transfer',
          exact: true,
        }),
      ])
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);

      const button = page.getByRole('button', { name: 'Add a task…', exact: true });
      const box = (await button.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await expect
        .poll(() => button.evaluate((el) => Number(getComputedStyle(el).opacity)))
        .toBeLessThan(1);
      const scale = await button.evaluate((el) => getComputedStyle(el).scale);
      if (reducedMotion === 'reduce') expect(scale).toBe('none');
      else expect(parseFloat(scale)).toBeLessThan(1);
      await page.mouse.up();

      await page.getByLabel('Capture a thought or task').fill('Motion review');
      await page.getByRole('button', { name: 'Add task', exact: true }).click();
      const opener = page.getByRole('button', {
        name: 'Edit Motion review',
        exact: true,
      });
      await opener.click();
      const dialog = page.getByRole('dialog');
      await expect(page.getByLabel('Task', { exact: true })).toBeFocused();
      if (reducedMotion === 'reduce') {
        expect(await dialog.evaluate((el) => getComputedStyle(el).transform)).toBe(
          'none',
        );
      }
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      await page.goto('/mus');
      const permission = page.getByRole('button', { name: /Sign in to manage access/ });
      expect((await permission.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });
  });
}

test('timeline tap, cancel, bounded flick, interruption and keyboard parity', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.clock.setFixedTime(new Date('2026-09-13T04:00:00Z'));
  await demo(page);
  const dbName = await waitForUserIndexedDb(page);
  const userId = (await context.cookies()).find(
    (cookie) => cookie.name === 'kayamo_guest',
  )!.value;
  await page.evaluate(
    async ({ dbName, userId }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('time_blocks', 'readwrite');
          tx.objectStore('time_blocks').put({
            id: 'motion-review-block',
            user_id: userId,
            title: 'Motion schedule',
            logical_date: '2026-09-13',
            kind: 'TASK',
            start_min: 540,
            end_min: 600,
            flexibility: 'FLEXIBLE',
            locked: false,
            source_table: null,
            source_id: null,
            notes: null,
            created_at: '2026-09-13T04:00:00Z',
            updated_at: '2026-09-13T04:00:00Z',
            deleted_at: null,
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        request.onerror = () => reject(request.error);
      });
    },
    { dbName, userId },
  );
  await page.goto('/todos');
  const block = page.getByRole('button', { name: /Motion schedule.*09:00/ });
  await expect(block).toBeVisible();
  const box = (await block.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  expect(await block.evaluate((el) => getComputedStyle(el).scale)).toBe('none');
  await page.mouse.move(x, y + 3);
  await page.mouse.up();
  await expect(block).toContainText('09:00–10:00');
  await page.mouse.down();
  await page.mouse.move(x, y + 25, { steps: 4 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(block).toContainText('09:00–10:00');
  // Escape intentionally cleared selection; select the block again before using
  // the timeline's documented selected-block keyboard commands.
  await block.click();
  await page.keyboard.press('ArrowDown');
  await expect(
    page.getByRole('button', { name: /Motion schedule.*09:15/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: /Motion schedule.*09:15/ }),
  ).toBeVisible();
  const moving = page.getByRole('button', { name: /^Motion schedule/ });
  const position = (await moving.boundingBox())!;
  const startX = position.x + position.width / 2;
  const startY = position.y + position.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + 30, { steps: 3 });
  await page.mouse.up();
  // Re-grab during the settling spring, then cancel. No intermediate schedule
  // is persisted, and the prior confirmed 09:15 record must remain intact.
  await page.mouse.down();
  await page.mouse.move(startX, startY + 45);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(moving).toContainText('09:15–10:15');
  const again = (await moving.boundingBox())!;
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
  await page.mouse.down();
  await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2 + 30, {
    steps: 3,
  });
  await page.mouse.up();
  await expect.poll(() => moving.locator('..').getAttribute('data-dragging')).toBeNull();
  const text = await moving.innerText();
  const time = text.match(/(\d{2}):(\d{2})–/)!;
  const minutes = Number(time[1]) * 60 + Number(time[2]);
  expect(minutes).toBeGreaterThanOrEqual(585);
  expect(minutes).toBeLessThanOrEqual(615);
  expect(minutes % 15).toBe(0);
  await page.reload();
  await expect(page.getByRole('button', { name: /^Motion schedule/ })).toContainText(
    time[0],
  );
  const keyboardBlock = page.getByRole('button', { name: /^Motion schedule/ });
  await keyboardBlock.click();
  await page.keyboard.press('Shift+ArrowDown');
  const expectedEnd = minutes + 75;
  const endLabel = `${String(Math.floor(expectedEnd / 60)).padStart(2, '0')}:${String(expectedEnd % 60).padStart(2, '0')}`;
  await expect(keyboardBlock).toContainText('–' + endLabel);
  await page.reload();
  await expect(page.getByRole('button', { name: /^Motion schedule/ })).toContainText(
    '–' + endLabel,
  );
});
