import { expect, test } from '@playwright/test';

// Hosted-safe: the public landing, keyboard only.
test('keyboard focus keeps a pill round and shows the ring', async ({ page, browserName }) => {
  await page.goto('/');
  // A pointer interaction first, so the Tab presses that follow are keyboard
  // modality on every engine (headless WebKit otherwise tabs into nothing).
  await page.mouse.click(4, 4);

  // Safari, and so WebKit, skips links on Tab unless Option is held; that is
  // the engine's default, not a defect in the page.
  const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  let focusedClass = '';
  for (let i = 0; i < 16 && !/\bkg(Accent|Ghost)\b/.test(focusedClass); i += 1) {
    await page.keyboard.press(tab);
    focusedClass = await page.evaluate(() => document.activeElement?.className ?? '');
  }
  expect(focusedClass).toMatch(/\bkg(Accent|Ghost)\b/);

  const style = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const s = getComputedStyle(el);
    return {
      radius: s.borderRadius,
      focusVisible: el.matches(':focus-visible'),
      outlineStyle: s.outlineStyle,
      outlineWidth: s.outlineWidth,
    };
  });
  // The global :focus-visible rule used to set border-radius: 4px, so every
  // pill snapped square the moment it took keyboard focus.
  expect(style.radius).toBe('999px');
  expect(style.focusVisible).toBe(true);
  expect(style.outlineStyle).not.toBe('none');
  expect(style.outlineWidth).not.toBe('0px');
});
