/** Author local account lifecycle journeys; browser execution belongs to the parent gate. */
import { test, expect } from './fixtures';

/** Sign in through the visible local form.
 * Args:
 *   page: Browser page already at login.
 *   username: Exact demo username.
 *   password: Exact demo password.
 */
async function signIn(page, username, password) {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
}

/** Sign out through the account disclosure, not storage manipulation.
 * Args:
 *   page: Authenticated page.
 *   name: Current display name.
 */
async function signOut(page, name) {
  await page.getByRole('button', { name: `Account for ${name}`, exact: true }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
}

test('Admin creates both roles, new accounts sign in, protected identities remain, eligible removal persists', async ({ page, browserErrors }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await signIn(page, 'admin', 'admin');
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await expect(page.getByText('No managed accounts yet.')).toBeVisible();
  const fixedDelete = page.getByRole('button', { name: 'Delete admin', exact: true });
  await expect(fixedDelete).toBeDisabled();
  await expect(fixedDelete.locator('..')).toHaveAttribute('title', 'Default admin cannot be deleted.');
  await fixedDelete.locator('..').hover();
  await expect(page.getByText('Default admin cannot be deleted.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByText('Display name is required.', { exact: true })).toBeVisible();
  const created = [];
  for (const [username, displayName, role] of [['mira', 'Demo Writer', 'user'], ['ari', 'Demo Manager', 'admin']]) {
    await page.getByLabel('Display name', { exact: true }).fill(displayName);
    await page.getByLabel('Username', { exact: true }).fill(username);
    await page.getByLabel('Password', { exact: true }).fill('demo-only');
    await page.getByLabel('Role', { exact: true }).selectOption(role);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Account created locally. Your sign-in is unchanged.');
    const records = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
    const record = records.find((item) => item.username === username);
    expect(record).toMatchObject({ username, displayName, role, password: 'demo-only' });
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Date(record.createdAt).toISOString()).toBe(record.createdAt);
    created.push(record);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).userId)).toBe('default-admin');
    await expect(page.getByRole('table')).not.toContainText('demo-only');
  }
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(created);
  await signOut(page, 'Admin');
  await signIn(page, 'mira', 'demo-only');
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Account removal keeps this story');
  await page.getByLabel('Content', { exact: true }).fill('Plain text by the newly created writer.');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const posts = await page.evaluate(() => localStorage.getItem('writespace_posts'));
  await signOut(page, 'Demo Writer');
  await signIn(page, 'ari', 'demo-only');
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete ari', exact: true })).toBeDisabled();
  await expect(page.getByText('Your active account cannot be deleted.', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete mira', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(created);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete mira', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Account deleted locally. Its posts remain unchanged.');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Delete mira', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([created[1]]);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(posts);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')).userId)).toBe(created[1].id);
  expect(browserErrors).toEqual([]);
});

test('mobile Admin manages stacked cards using the same controls', async ({ page, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await signIn(page, 'admin', 'admin');
  await page.getByRole('link', { name: 'Manage Users' }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Mobile Writer');
  await page.getByLabel('Username', { exact: true }).fill('mobile-writer');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Delete mobile-writer', exact: true }) });
  await expect(row).toBeVisible();
  expect(await row.evaluate((element) => getComputedStyle(element).display)).toBe('block');
  await expect(row.getByText('Username:', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete admin', exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('users-mobile.png'), fullPage: true });
  page.once('dialog', (dialog) => dialog.accept());
  await row.getByRole('button', { name: 'Delete mobile-writer', exact: true }).click();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([]);
  expect(browserErrors).toEqual([]);
});
