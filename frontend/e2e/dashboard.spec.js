/** Exercise real persisted author content through the Admin overview and override journey. */
import { test, expect } from './fixtures';

const author = {
  id: 'dashboard-author', displayName: 'Dashboard Writer', username: 'mira', password: 'demo-only',
  role: 'user', createdAt: '2026-05-01T12:00:00.000Z',
};

test('author publishes then Admin enters from landing, edits, cancels deletion and deletes persistently', async ({ page, browserErrors }, testInfo) => {
  await page.goto('/');
  await page.evaluate((account) => localStorage.setItem('writespace_users', JSON.stringify([account])), author);
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await page.getByLabel('Username', { exact: true }).fill(author.username);
  await page.getByLabel('Password', { exact: true }).fill(author.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('A writer’s local story');
  await page.getByLabel('Content', { exact: true }).fill('Original author text, saved in this browser.');
  await page.getByRole('button', { name: 'Publish' }).click();
  const original = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0]);
  expect(original).toMatchObject({ authorId: author.id, authorName: author.displayName });
  await page.getByRole('button', { name: `Account for ${author.displayName}` }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'WriteSpace', exact: true }).click();
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  const stats = page.getByLabel('Local statistics');
  await expect(stats.locator('dt')).toHaveText(['Total Posts', 'Total Users', 'Total Admins', 'Total Users']);
  await expect(stats.locator('dd').filter({ hasText: /^\d+$/ })).toHaveText(['1', '1', '0', '1']);
  await expect(stats.getByText(/Unresolved: repeated metric/)).toBeVisible();
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByText(`By ${author.displayName}`)).toBeVisible();
  await expect(recent.getByRole('link', { name: original.title, exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('dashboard-populated.png'), fullPage: true });
  await recent.getByRole('link', { name: `Edit ${original.title}` }).click();
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(original.content);
  await page.getByLabel('Title', { exact: true }).fill('Admin-reviewed story');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('heading', { name: 'Admin-reviewed story' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([
    { ...original, title: 'Admin-reviewed story' },
  ]);
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Admin-reviewed story' }).click();
  await expect(recent.getByRole('link', { name: 'Admin-reviewed story', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toHaveLength(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Admin-reviewed story' }).click();
  await expect(page.getByRole('status')).toHaveText('Post deleted locally.');
  await expect(page.getByText('No posts yet. Be the first to write!')).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([author]);
  await page.getByRole('link', { name: 'Write a Post', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Write a Post' })).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
  expect(browserErrors).toEqual([]);
});
