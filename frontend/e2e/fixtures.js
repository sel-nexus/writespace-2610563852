/** Capture browser failures before entry and isolate app-owned storage. */
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  browserErrors: [async ({ page }, use) => {
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('writespace_test_initialized')) {
        for (const key of ['writespace_posts', 'writespace_users', 'writespace_session']) {
          localStorage.removeItem(key);
        }
        sessionStorage.setItem('writespace_test_initialized', 'true');
      }
    });
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
});

export { expect };
