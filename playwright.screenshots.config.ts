import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

/** Demo screenshots: `npm run screenshots` writes them to docs/screenshots/. */
export default defineConfig({
  ...base,
  testDir: './screenshots',
  retries: 0,
  reporter: 'line',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
