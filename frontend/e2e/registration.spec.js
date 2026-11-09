/** Verify real registration journeys; browser errors are captured by the pre-entry fixture. */
import { test, expect } from './fixtures';

test('guest registers, reloads persistent records, logs out and signs in with the new account', async ({ page, browserErrors }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started Free', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Register' })).toBeVisible();
  await page.getByLabel('Display name', { exact: true }).fill(' Mira Chen ');
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill(' demo-only ');
  await page.getByLabel('Confirm password', { exact: true }).fill(' demo-only ');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: 'All Blogs' })).toBeVisible();
  const records = await page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
  expect(records.users).toHaveLength(1);
  expect(records.users[0]).toMatchObject({ displayName: 'Mira Chen', username: 'mira', password: ' demo-only ', role: 'user' });
  expect(records.users[0].id).toMatch(/^[0-9a-f-]{36}$/i);
  expect(new Date(records.users[0].createdAt).toISOString()).toBe(records.users[0].createdAt);
  expect(records.session).toEqual({ userId: records.users[0].id, displayName: 'Mira Chen', username: 'mira', role: 'user' });
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(records.users);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(records.session);
  await page.getByRole('button', { name: 'Account for Mira Chen', exact: true }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill(' demo-only ');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual(records.users);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(records.session);
  expect(browserErrors).toEqual([]);
});

test('mobile visitor corrects required, reserved, mismatch and duplicate errors without a second account', async ({ page, browserErrors }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  await page.getByLabel('Display name', { exact: true }).fill('Demo Writer');
  await page.getByLabel('Username', { exact: true }).fill('ADMIN');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('This username is reserved.')).toBeVisible();
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_users'))).toBeNull();
  await page.getByLabel('Username', { exact: true }).fill('writer');
  await page.getByLabel('Confirm password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Account for Demo Writer', exact: true }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await page.getByLabel('Display name', { exact: true }).fill('Second Writer');
  await page.getByLabel('Username', { exact: true }).fill(' WRITER ');
  await page.getByLabel('Password', { exact: true }).fill('demo');
  await page.getByLabel('Confirm password', { exact: true }).fill('demo');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByText('This username is already taken.')).toBeVisible();
  await page.reload();
  const users = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')));
  expect(users).toHaveLength(1);
  expect(users[0].username).toBe('writer');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(browserErrors).toEqual([]);
});
