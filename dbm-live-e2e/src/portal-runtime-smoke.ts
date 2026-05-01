import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium, type BrowserContext, type Page } from '@playwright/test';

type SmokeConfig = {
  entryUrl: string;
  requestShellUrl: string;
  dataverseUrl: string;
  entityLogicalName: string;
  requestTitle: string;
  requestAmount: string;
  assignedApprover: string;
  expectedPortalStatus: string;
  hiddenLabels: string[];
  persistedSessionStatePath?: string | null;
};

type SmokeResult = {
  generatedUtc: string;
  shellMode: 'local-spa';
  entryRoutePath: string;
  statusRoutePath: string;
  requestId: string;
  requestTitle: string;
  portalStatusLabel: string;
  requestShellStatusLabel: string;
  modelDriven: {
    executed: boolean;
    passed: boolean;
  };
};

function parseArgs(argv: string[]): { configPath: string; outputPath: string } {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      continue;
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith('--')) {
      throw new Error(`Missing value for argument '${value}'.`);
    }

    args.set(value.slice(2), nextValue);
    index += 1;
  }

  const configPath = args.get('config');
  const outputPath = args.get('output');
  if (!configPath || !outputPath) {
    throw new Error('Usage: tsx src/portal-runtime-smoke.ts --config <path> --output <path>');
  }

  return { configPath, outputPath };
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

export function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

async function collectPageText(page: Page): Promise<string> {
  const frameTexts = await Promise.all(
    page.frames().map(async (frame) => {
      try {
        const text = await frame.locator('body').innerText({ timeout: 1000 });
        return text ?? '';
      } catch {
        return '';
      }
    })
  );

  return normalizeText(frameTexts.join(' '));
}

async function waitForPageText(page: Page, expectedText: string, timeoutMs = 60000): Promise<void> {
  const expectedNeedle = normalizeText(expectedText).toLowerCase();
  const start = Date.now();
  while ((Date.now() - start) < timeoutMs) {
    const text = (await collectPageText(page)).toLowerCase();
    if (text.includes(expectedNeedle)) {
      return;
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Timed out waiting for page text '${expectedText}'.`);
}

async function assertPageTextExcludes(page: Page, unexpectedText: string): Promise<void> {
  const text = (await collectPageText(page)).toLowerCase();
  const unexpectedNeedle = normalizeText(unexpectedText).toLowerCase();
  if (text.includes(unexpectedNeedle)) {
    throw new Error(`Page text unexpectedly exposed '${unexpectedText}'.`);
  }
}

async function readPortalSessionRequestId(page: Page): Promise<string> {
  const sessionState = await page.evaluate(() => {
    const entries: Record<string, string> = {};
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (!key) {
        continue;
      }

      const value = sessionStorage.getItem(key);
      if (value != null) {
        entries[key] = value;
      }
    }

    return entries;
  });

  for (const [key, value] of Object.entries(sessionState)) {
    if (!key.startsWith('dbm.portal-runtime.session:')) {
      continue;
    }

    try {
      const parsed = JSON.parse(value) as { requestId?: string };
      if (parsed.requestId?.trim()) {
        return parsed.requestId.trim();
      }
    } catch {
    }
  }

  throw new Error('Portal smoke could not resolve a requestId from sessionStorage.');
}

function getPagePath(page: Page): string {
  return new URL(page.url()).pathname;
}

async function runLocalSpaSmoke(page: Page, config: SmokeConfig): Promise<Omit<SmokeResult, 'generatedUtc' | 'modelDriven'>> {
  await page.goto(config.entryUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dbm-local-proof-root', { timeout: 60000 });
  await waitForPageText(page, 'R3.1 Local SPA Runtime Proof');
  await waitForPageText(page, 'Approval request intake');

  await page.getByLabel('Request Title').fill(config.requestTitle);
  await page.getByLabel('Request Amount').fill(config.requestAmount);
  await page.getByLabel('Assigned Approver').fill(config.assignedApprover);
  await page.getByRole('button', { name: 'Create draft' }).first().click();

  await waitForPageText(page, config.requestTitle);
  await waitForPageText(page, 'Draft');

  await page.getByRole('button', { name: 'Submit request' }).first().click();
  await waitForPageText(page, config.expectedPortalStatus);

  for (const hiddenLabel of config.hiddenLabels) {
    await assertPageTextExcludes(page, hiddenLabel);
  }

  const requestId = await readPortalSessionRequestId(page);
  const entryRoutePath = getPagePath(page);

  await page.goto(config.requestShellUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dbm-local-proof-root', { timeout: 60000 });
  await waitForPageText(page, config.requestTitle);
  await waitForPageText(page, config.expectedPortalStatus);
  await waitForPageText(page, 'Portal-visible status view');

  for (const hiddenLabel of config.hiddenLabels) {
    await assertPageTextExcludes(page, hiddenLabel);
  }

  return {
    shellMode: 'local-spa',
    entryRoutePath,
    statusRoutePath: getPagePath(page),
    requestId,
    requestTitle: config.requestTitle,
    portalStatusLabel: config.expectedPortalStatus,
    requestShellStatusLabel: config.expectedPortalStatus
  };
}

export function shouldRunModelDrivenSmoke(config: Pick<SmokeConfig, 'persistedSessionStatePath'>): boolean {
  return typeof config.persistedSessionStatePath === 'string' && config.persistedSessionStatePath.trim().length > 0;
}

export function buildModelDrivenRecordUrl(
  config: Pick<SmokeConfig, 'dataverseUrl' | 'entityLogicalName'>,
  requestId: string
): string {
  return `${config.dataverseUrl.replace(/\/$/, '')}/main.aspx?forceUCI=1&pagetype=entityrecord&etn=${encodeURIComponent(config.entityLogicalName)}&id=${encodeURIComponent(requestId)}`;
}

async function runModelDrivenSmoke(config: SmokeConfig, requestId: string): Promise<{ executed: boolean; passed: boolean }> {
  const persistedSessionStatePath = config.persistedSessionStatePath?.trim();
  if (!persistedSessionStatePath) {
    return {
      executed: false,
      passed: false
    };
  }

  const browser = await chromium.launch({ headless: true });
  const browserContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    storageState: persistedSessionStatePath
  });

  try {
    const page = await browserContext.newPage();
    const recordUrl = buildModelDrivenRecordUrl(config, requestId);
    await page.goto(recordUrl, { waitUntil: 'domcontentloaded' });
    await waitForPageText(page, config.requestTitle, 90000);

    const expectedInternalLabel = config.hiddenLabels.find((label) => normalizeText(label).length > 0);
    if (expectedInternalLabel) {
      await waitForPageText(page, expectedInternalLabel, 90000);
    } else {
      await waitForPageText(page, config.expectedPortalStatus, 90000);
    }

    return {
      executed: true,
      passed: true
    };
  } finally {
    await browserContext.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const { configPath, outputPath } = parseArgs(process.argv.slice(2));
  const config = JSON.parse(await fs.readFile(configPath, 'utf8')) as SmokeConfig;

  const browser = await chromium.launch({ headless: true });
  let anonymousContext: BrowserContext | null = null;
  try {
    anonymousContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await anonymousContext.newPage();
    const anonymousResult = await runLocalSpaSmoke(page, config);

    let modelDrivenResult: { executed: boolean; passed: boolean } = {
      executed: false,
      passed: false
    };

    if (shouldRunModelDrivenSmoke(config)) {
      modelDrivenResult = await runModelDrivenSmoke(config, anonymousResult.requestId);
    }

    const result: SmokeResult = {
      generatedUtc: new Date().toISOString(),
      ...anonymousResult,
      modelDriven: modelDrivenResult
    };

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  } finally {
    await anonymousContext?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

function isMainModule(): boolean {
  const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return fileURLToPath(import.meta.url) === invokedPath;
}

if (isMainModule()) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
