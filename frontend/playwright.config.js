/** Run frontend-only browser journeys against environment-selected bindings. */
import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const env = { ...loadEnv('test', process.cwd(), ''), ...process.env };
const host = env.E2E_HOST || '127.0.0.1';
const port = Number(env.E2E_PORT || env.VITE_PORT || 5173);
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL, browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js',
    env: { VITE_HOST: env.VITE_HOST || host, VITE_PORT: String(port) },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
