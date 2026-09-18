import { expect, test } from '@playwright/test';

test('public metadata, assets and private-page indexing stay separated', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('KayaMo — small steps, room to grow');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  // Next normalizes the bare origin without a trailing slash. URL comparison
  // still requires the exact HTTPS origin, root path, and no query/fragment.
  expect(new URL(canonical!).href).toBe('https://www.kayamo.fit/');
  const schema = JSON.parse(
    await page.locator('script[type="application/ld+json"]').innerText(),
  );
  expect(schema['@type']).toBe('WebSite');
  expect(schema.url).toBe('https://www.kayamo.fit');

  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(ogImage).toBeTruthy();
  // Check the candidate's asset, not a potentially older production deployment.
  const asset = await request.get(new URL(ogImage!).pathname);
  expect(asset.ok()).toBe(true);
  expect(asset.headers()['content-type']).toContain('image/');

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('User-Agent: *');
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml).toContain('<urlset');
  expect(xml).not.toMatch(
    /\/(today|goals|grove|life|mus|foods|calories|settings|login)</,
  );

  await page.getByRole('button', { name: 'Explore the demo', exact: true }).click();
  await page.waitForURL('**/today');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await page.goto('/login?from=demo');
  await expect(page).toHaveTitle('Sign in | KayaMo');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
