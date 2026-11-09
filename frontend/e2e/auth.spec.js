/** Verify local sign-in, role boundaries, persistence and responsive navigation. */
import { test, expect } from './fixtures';

const account = {
  id: 'demo-author', username: 'mira', displayName: 'Demo Writer', password: 'demo-only',
  role: 'user', createdAt: '2026-05-01T12:00:00Z',
};

test('guest enters from landing, corrects invalid login, and logs Admin out without losing accounts', async ({ page, browserErrors }) => {
  await page.goto('/');
  await page.evaluate((user) => {
    localStorage.setItem('writespace_users', JSON.stringify([user]));
    localStorage.setItem('writespace_posts', '[]');
  }, account);
  await page.getByRole('link', { name: 'Start Reading', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual({
    userId: 'default-admin', username: 'admin', displayName: 'Admin', role: 'admin',
  });
  await page.reload();
  await page.getByRole('link', { name: 'Users', exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await page.getByRole('button', { name: 'Account for Admin', exact: true }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_users')))).toEqual([account]);
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe('[]');
  expect(browserErrors).toEqual([]);
});

test('mobile stored author signs in, follows role links and uses account logout', async ({ page, browserErrors }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.evaluate((user) => localStorage.setItem('writespace_users', JSON.stringify([user])), account);
  await page.getByLabel('Username', { exact: true }).fill('mira');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('button', { name: 'Open menu' }).click();
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Users' })).toHaveCount(0);
  await nav.getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Account for Demo Writer', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('auth-mobile-account.png'), fullPage: true });
  await page.getByRole('link', { name: 'Go to Dashboard' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Account for Demo Writer', exact: true }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
  expect(browserErrors).toEqual([]);
});

for (const path of ['/blogs', '/blog/unknown', '/write', '/edit/unknown', '/admin', '/users']) {
  test(`guest deep link ${path} redirects before showing protected content`, async ({ page, browserErrors }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
    expect(browserErrors).toEqual([]);
  });
}

for (const path of ['/admin', '/users']) {
  test(`stored user deep link ${path} redirects to blogs`, async ({ page, browserErrors }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('writespace_test_initialized', 'true');
      localStorage.setItem('writespace_session', JSON.stringify({
        userId: 'demo-author', username: 'mira', displayName: 'Demo Writer', role: 'user',
      }));
    });
    await page.goto(path);
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    expect(browserErrors).toEqual([]);
  });
}

for (const role of ['user', 'admin']) {
  for (const path of ['/login', '/register']) {
    test(`stored ${role} entering ${path} goes to role home`, async ({ page, browserErrors }) => {
      await page.addInitScript((identityRole) => {
        sessionStorage.setItem('writespace_test_initialized', 'true');
        localStorage.setItem('writespace_session', JSON.stringify({
          userId: 'demo-author', username: 'mira', displayName: 'Demo Writer', role: identityRole,
        }));
      }, role);
      await page.goto(path);
      await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
      await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
      expect(browserErrors).toEqual([]);
    });
  }
}
