/** Verify direct static route delivery without introducing an application API. */
import { test, expect } from './fixtures';

test('direct guarded route and unknown route serve the SPA document', async ({ page, request, browserErrors }) => {
  for (const path of ['/', '/blogs', '/admin', '/users']) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('id="root"');
  }
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('unknown route offers a safe home link and emits no application API requests', async ({ page, browserErrors }) => {
  const apiRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api')) apiRequests.push(request.url());
  });
  await page.goto('/missing-route');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'WriteSpace', exact: true })).toBeVisible();
  expect(apiRequests).toEqual([]);
  expect(browserErrors).toEqual([]);
});
