import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against the stack started by `docker compose up -d`, not against a
 * server Playwright starts itself: the flow being proven is the real one,
 * through the dev server's proxy to the backend and into PostgreSQL.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BMAPP_WEB_URL ?? 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
