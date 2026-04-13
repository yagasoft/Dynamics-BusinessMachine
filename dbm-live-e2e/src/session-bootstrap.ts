import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

const environmentName = requireArg('--environment');
const modelDrivenAppUrl = requireArg('--modelDrivenAppUrl');
const outputPath = requireArg('--outputPath');
const timeoutMinutes = Number.parseInt(readOptionalArg('--timeoutMinutes') ?? '20', 10);

if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
  throw new Error(`Invalid --timeoutMinutes value '${String(timeoutMinutes)}'.`);
}

const browser = await chromium.launch({
  headless: false
});

const context = await browser.newContext();
const page = await context.newPage();

console.log(
  `Bootstrap the persisted DBM live E2E session for '${environmentName}' by completing sign-in in the opened browser window.`
);

try {
  await page.goto(modelDrivenAppUrl, { waitUntil: 'domcontentloaded' });
  await waitForInteractiveAuthentication(page, modelDrivenAppUrl, timeoutMinutes * 60_000);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  await context.storageState({ path: outputPath });
  console.log(`Saved unencrypted session state to '${outputPath}'.`);
}
finally {
  await context.close();
  await browser.close();
}

function requireArg(name: string): string {
  const value = readOptionalArg(name);
  if (!value) {
    throw new Error(`Missing required argument '${name}'.`);
  }

  return value;
}

function readOptionalArg(name: string): string | undefined {
  const index = process.argv.findIndex((entry) => entry === name);
  if (index < 0) {
    return undefined;
  }

  return process.argv[index + 1];
}

function normalizeEnvironment(value: string): 'Dev' | 'UAT' | 'Prod' {
  if (value === 'Dev' || value === 'UAT' || value === 'Prod') {
    return value;
  }

  throw new Error(`Unsupported environment '${value}'.`);
}

async function waitForInteractiveAuthentication(page: import('@playwright/test').Page, targetUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastUrl = page.url();

  while (Date.now() < deadline) {
    lastUrl = page.url();
    if (isModelDrivenAppPage(lastUrl, targetUrl)) {
      await page.waitForLoadState('networkidle').catch(() => undefined);
      return;
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error(`Timed out waiting for interactive sign-in to finish. Last URL: ${lastUrl}`);
}

function isModelDrivenAppPage(currentUrl: string, modelDrivenAppUrl: string): boolean {
  if (!currentUrl) {
    return false;
  }

  const current = new URL(currentUrl);
  const expected = new URL(modelDrivenAppUrl);
  return current.origin === expected.origin && /\/main\.aspx/i.test(current.pathname);
}
