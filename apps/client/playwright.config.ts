import { defineConfig, devices } from '@playwright/test';
import { E2E_API_PORT, E2E_API_URL, E2E_WEB_PORT, E2E_WEB_URL } from './e2e/ports.mjs';

/**
 * Web smoke tests against the EXPORTED web build (Part 2.7) and the real API (Part 2.5).
 * Run with `pnpm --filter @chronos/client e2e` (builds first). Needs the local stack: `pnpm dev:up`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: E2E_WEB_URL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // The real API, allowing the e2e web origin. DATABASE_URL/REDIS_URL come from the root .env (main.ts).
      command: 'node --import tsx src/main.ts',
      cwd: '../api',
      url: `${E2E_API_URL}/health`,
      env: { NODE_ENV: 'test', API_PORT: String(E2E_API_PORT), CORS_ORIGINS: E2E_WEB_URL, LOG_LEVEL: 'warn' },
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node e2e/serve.mjs',
      url: E2E_WEB_URL,
      env: { PORT: String(E2E_WEB_PORT) },
      reuseExistingServer: false,
      timeout: 10_000,
    },
  ],
});
