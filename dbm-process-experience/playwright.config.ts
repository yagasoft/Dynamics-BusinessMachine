import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/visual',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/{testFileName}-snapshots/{arg}{ext}',
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: {
      width: 1440,
      height: 900
    },
    deviceScaleFactor: 1,
    colorScheme: 'light'
  }
});
