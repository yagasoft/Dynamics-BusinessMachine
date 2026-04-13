import { defineConfig } from '@playwright/test';

const runContextPath = process.env.DBM_LIVE_E2E_RUN_CONTEXT_PATH;

if (!runContextPath) {
  throw new Error('DBM_LIVE_E2E_RUN_CONTEXT_PATH must be set before running Playwright live E2E tests.');
}

export default defineConfig({
  testDir: './test',
  testMatch: /live-e2e\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30 * 1000,
  expect: {
    timeout: 5 * 1000
  },
  use: {
    headless: true,
    actionTimeout: 10 * 1000,
    navigationTimeout: 20 * 1000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  reporter: [
    ['list'],
    ['json', { outputFile: process.env.DBM_LIVE_E2E_PLAYWRIGHT_REPORT_PATH ?? 'playwright-report/results.json' }]
  ]
});
