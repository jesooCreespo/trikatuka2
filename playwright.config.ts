import { defineConfig, devices } from '@playwright/test';

/** E2E_PORT lets several checkouts run their e2e tests at the same time. */
const port = Number(process.env['E2E_PORT'] ?? 4173);
const url = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env['CI'] ? 2 : 0,
  use: {
    baseURL: url,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run i18n:sync && npx ng serve --configuration production --port ${port}`,
    url,
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
