/** Exercise real browser-local publishing, editing, cancellation and ownership journeys. */
import { test, expect } from './fixtures';

const account = {
  id: 'demo-author', displayName: 'Demo Writer', username: 'mira', password: 'demo-only',
  role: 'user', createdAt: '2026-05-01T12:00:00.000Z',
};

test('author publishes, reloads, cancels edits, saves edits and confirms deletion', async ({ page, browserErrors }) => {
  await page.goto('/');
  await page.evaluate((user) => localStorage.setItem('writespace_users', JSON.stringify([user])), account);
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('No posts yet. Be the first to write!')).toBeVisible();
  await page.getByRole('link', { name: 'Write a Post', exact: true }).click();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText('Title is required.')).toBeVisible();
  await expect(page.getByText('Content is required.')).toBeVisible();
  const body = '  First line\n<script>literal text</script>\nLast line  ';
  await page.getByLabel('Title', { exact: true }).fill('Browser garden');
  await page.getByLabel('Content', { exact: true }).fill(body);
  await expect(page.getByText(`${body.length} characters`)).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByRole('heading', { name: 'Browser garden' })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts'))[0]);
  expect(saved).toMatchObject({ title: 'Browser garden', content: body, authorId: account.id, authorName: account.displayName });
  expect(saved.id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);
  await page.reload();
  await expect(page.getByRole('article')).toContainText('<script>literal text</script>');
  await expect(page.locator('article script')).toHaveCount(0);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(body);
  await page.getByLabel('Title', { exact: true }).fill('Canceled title');
  await page.getByRole('link', { name: 'Cancel' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([saved]);
  await page.getByRole('link', { name: 'Edit Browser garden' }).click();
  await page.getByLabel('Title', { exact: true }).fill('Revisited garden');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('heading', { name: 'Revisited garden' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([{ ...saved, title: 'Revisited garden' }]);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'Revisited garden' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toHaveLength(1);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('No posts yet. Be the first to write!')).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual([]);
  expect(browserErrors).toEqual([]);
});

test('another author cannot edit a real published post, including a stale eligible edit link', async ({ page, browserErrors }) => {
  await page.goto('/login');
  await page.evaluate((user) => localStorage.setItem('writespace_users', JSON.stringify([
    user, { ...user, id: 'other-author', displayName: 'Other Writer', username: 'other' },
  ])), account);
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Owned story');
  await page.getByLabel('Content', { exact: true }).fill('Original author body');
  await page.getByRole('button', { name: 'Publish' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  await page.getByRole('link', { name: 'Back to Blogs' }).click();
  await page.evaluate(() => localStorage.setItem('writespace_session', JSON.stringify({
    userId: 'other-author', displayName: 'Other Writer', username: 'other', role: 'user',
  })));
  await page.getByRole('link', { name: 'Edit Owned story' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit Owned story' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Owned story', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('article')).toContainText('Original author body');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')))).toEqual(saved);
  expect(browserErrors).toEqual([]);
});
