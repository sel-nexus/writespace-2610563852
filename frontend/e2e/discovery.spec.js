/** Verify real guest discovery and mobile navigation without future-page stubs. */
import { test, expect } from './fixtures';

const records = [1, 4, 2, 3].map((day) => ({
  id: `post-${day}`,
  title: `Browser story ${day}`,
  content: `Saved browser text ${day}. ` + 'x'.repeat(130),
  createdAt: `2026-05-0${day}T12:00:00Z`,
  authorId: 'demo-author',
  authorName: 'Demo Writer',
}));

test('guest sees newest local previews, follows a reader link and returns without losing data', async ({ page, browserErrors }, testInfo) => {
  await page.goto('/');
  await page.evaluate((posts) => localStorage.setItem('writespace_posts', JSON.stringify(posts)), records);
  await page.reload();
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Browser story 4', 'Browser story 3', 'Browser story 2']);
  await expect(latest.getByText('May 04, 2026')).toBeVisible();
  await expect(latest.getByText('Demo Writer')).toHaveCount(3);
  await expect(latest.getByText('Saved browser text 4. ' + 'x'.repeat(99))).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('discovery-desktop.png'), fullPage: true });
  await latest.getByRole('link', { name: 'Browser story 4' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(latest.getByRole('link', { name: 'Browser story 4' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(records);
  expect(browserErrors).toEqual([]);
});

test('mobile guest opens navigation, follows entry links and sees exact corrupt-storage fallback', async ({ page, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  const primary = page.getByRole('navigation', { name: 'Primary' });
  await expect(primary.getByRole('link', { name: 'Login' })).toBeHidden();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(primary.getByRole('link', { name: 'Login' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('discovery-mobile-menu.png'), fullPage: true });
  await primary.getByRole('link', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole('link', { name: 'Back to Home' }).click();
  await page.evaluate(() => localStorage.setItem('writespace_posts', '{broken'));
  await page.reload();
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('{broken');
  expect(browserErrors).toEqual([]);
});
