/** Isolate DOM state and only WriteSpace's browser-local keys. */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/** Remove app records without touching unrelated browser data. */
function resetAppStorage() {
  for (const key of ['writespace_posts', 'writespace_users', 'writespace_session']) {
    localStorage.removeItem(key);
  }
}

beforeEach(resetAppStorage);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetAppStorage();
});
