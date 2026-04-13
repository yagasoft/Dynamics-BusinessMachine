import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

import { waitForAuthenticatedModelDrivenApp } from './model-driven-ui.js';

const environmentName = requireArg('--environment');
const modelDrivenAppUrl = requireArg('--modelDrivenAppUrl');
const inputPath = requireArg('--inputPath');
const outputPath = requireArg('--outputPath');
const evidencePath = requireArg('--evidencePath');

const browser = await chromium.launch({
  headless: true
});

const context = await browser.newContext({
  storageState: inputPath
});

const page = await context.newPage();

try {
  await page.goto(modelDrivenAppUrl, { waitUntil: 'domcontentloaded' });
  await waitForAuthenticatedModelDrivenApp(page, {
    environment: normalizeEnvironment(environmentName),
    dataverseUrl: new URL(modelDrivenAppUrl).origin,
    modelDrivenAppUrl,
    liveE2E: {
      enabledModes: [],
      lock: { webResourceName: '', staleAfterMinutes: 1 },
      cleanup: { namePrefix: '', orphanAgeHours: 1, deleteCreatedRecords: true },
      authentication: {
        mode: 'persisted-user-session',
        sessionScope: 'environment',
        identityModel: 'single-user-simulation',
        sessionUserDisplayName: ''
      },
      caseSets: { full: [], promotion: [] },
      entities: {}
    }
  });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  await context.storageState({ path: outputPath });
  writeFileSync(evidencePath, JSON.stringify({
    checkedUtc: new Date().toISOString(),
    environmentName,
    modelDrivenAppUrl,
    currentUrl: page.url(),
    authenticated: true
  }, null, 2), 'utf8');
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
