/** Configure the static frontend and isolated component runner. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** Resolve public development bindings for the selected mode.
 * Args:
 *   mode: Vite environment mode.
 * Returns:
 *   Build, server, and component-test configuration.
 */
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const host = env.VITE_HOST || '127.0.0.1';
  const port = Number(env.VITE_PORT || 5173);
  return {
    plugins: [react()],
    server: { host, port, strictPort: true },
    preview: { host, port, strictPort: true },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
      maxWorkers: 1,
      minWorkers: 1,
    },
  };
});
