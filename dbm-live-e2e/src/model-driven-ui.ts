import type { Frame, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import type { LiveE2EEnvironmentConfig } from './types.js';

const NETWORK_IDLE_TIMEOUT_MS = 5_000;

export async function ensureActivePersistedSession(
  page: Page,
  environmentConfig: LiveE2EEnvironmentConfig,
  timeoutMs = 90_000
): Promise<void> {
  await page.goto(environmentConfig.modelDrivenAppUrl, { waitUntil: 'domcontentloaded' });
  await waitForAuthenticatedModelDrivenApp(page, environmentConfig, timeoutMs);
}

export async function waitForAuthenticatedModelDrivenApp(
  page: Page,
  environmentConfig: LiveE2EEnvironmentConfig,
  timeoutMs = 90_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastUrl = page.url();

  while (Date.now() < deadline) {
    lastUrl = page.url();
    if (await isAuthenticationRequired(page)) {
      throw new Error(
        `Persisted browser session for '${environmentConfig.environment}' is expired or missing. ` +
        `Re-run 'eng/scripts/Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment ${environmentConfig.environment}'. Current URL: ${lastUrl}`
      );
    }

    if (isModelDrivenAppPage(lastUrl, environmentConfig.modelDrivenAppUrl)) {
      await waitForReasonableSettling(page);
      await assertHealthyModelDrivenPage(
        page,
        `Opening the model-driven app '${environmentConfig.modelDrivenAppUrl}'`
      );
      await expect(page).toHaveURL(/main\.aspx/i, { timeout: 5_000 });
      return;
    }

    await page.waitForTimeout(1_000);
  }

  throw new Error(
    `Timed out waiting for authenticated access to '${environmentConfig.modelDrivenAppUrl}'. ` +
    `Re-run 'eng/scripts/Initialize-LiveDbmE2ESession.ps1 -TargetEnvironment ${environmentConfig.environment}' if the persisted session has expired. Current URL: ${lastUrl}`
  );
}

export async function navigateToRecord(page: Page, dataverseUrl: string, entityLogicalName: string, recordId?: string): Promise<void> {
  const baseUrl = `${dataverseUrl.replace(/\/$/, '')}/main.aspx?forceUCI=1&pagetype=entityrecord&etn=${encodeURIComponent(entityLogicalName)}`;
  const url = recordId ? `${baseUrl}&id=${encodeURIComponent(recordId)}` : baseUrl;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForReasonableSettling(page);
  await assertHealthyModelDrivenPage(page, `Opening Dataverse record form for entity '${entityLogicalName}'`);
}

export async function fillField(page: Page, label: string, value: string): Promise<void> {
  await assertHealthyModelDrivenPage(page, `Filling field '${label}'`);
  const locator = page.getByLabel(label, { exact: false }).first();
  await locator.fill('');
  await locator.fill(value);
  await locator.press('Tab').catch(() => undefined);
  await page.waitForTimeout(250);
}

export async function setLookupField(page: Page, label: string, value: string): Promise<void> {
  await assertHealthyModelDrivenPage(page, `Setting lookup field '${label}'`);
  const locator = page.getByLabel(label, { exact: false }).first();
  await locator.click();
  await locator.fill(value);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
}

export async function clickButton(page: Page, label: string): Promise<void> {
  await assertHealthyModelDrivenPage(page, `Clicking button '${label}'`);
  const button = await waitForVisibleLocator(
    page,
    (scope) => scope.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}$`, 'i') }).first(),
    30_000
  );
  try {
    await button.click();
  }
  catch (error) {
    if (error instanceof Error && /intercepts pointer events/i.test(error.message)) {
      await button.evaluate((element) => {
        if (element && typeof (element as HTMLButtonElement).click === 'function') {
          (element as HTMLButtonElement).click();
        }
      });
    }
    else {
      throw error;
    }
  }
  await waitForReasonableSettling(page);
  await assertHealthyModelDrivenPage(page, `Waiting for post-click state after '${label}'`);
}

export async function waitForText(page: Page, text: string, timeoutMs = 30_000): Promise<void> {
  await assertHealthyModelDrivenPage(page, `Waiting for text '${text}'`);
  await waitForVisibleLocator(
    page,
    (scope) => scope.getByText(text, { exact: false }).first(),
    timeoutMs
  );
}

export async function assertTextNotVisible(page: Page, text: string, timeoutMs = 2_000): Promise<void> {
  await assertHealthyModelDrivenPage(page, `Checking hidden text '${text}'`);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const visible = await hasVisibleLocator(
      page,
      (scope) => scope.getByText(text, { exact: false }).first()
    );
    if (!visible) {
      return;
    }

    await page.waitForTimeout(250);
  }

  await expect(page.getByText(text, { exact: false }).first()).toHaveCount(0, { timeout: 1 });
}

export function captureRecordIdFromPage(page: Page): string {
  const url = new URL(page.url());
  const recordId = url.searchParams.get('id');
  if (!recordId) {
    throw new Error(`The current URL '${page.url()}' does not contain a Dataverse record id.`);
  }

  return recordId.replace(/[{}]/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getKnownModelDrivenPageIssue(currentUrl: string, pageText: string): string | null {
  const normalizedUrl = currentUrl.toLowerCase();
  const normalizedText = pageText.replace(/\s+/g, ' ').trim();
  const summary = summarizePageText(normalizedText);

  if (normalizedUrl.includes('/_common/error/errorhandler.aspx')) {
    if (/unknown entity name/i.test(normalizedText) || /entity name doesn't exist/i.test(normalizedText)) {
      return `Dynamics opened an 'Unknown Entity Name' page at '${currentUrl}'. ${summary}`;
    }

    return `Dynamics opened an error page at '${currentUrl}'. ${summary}`;
  }

  if (/unknown entity name/i.test(normalizedText) && /entity name doesn't exist/i.test(normalizedText)) {
    return `Dynamics showed an 'Unknown Entity Name' error in the current page. ${summary}`;
  }

  return null;
}

async function isAuthenticationRequired(page: Page): Promise<boolean> {
  const currentUrl = page.url().toLowerCase();
  if (currentUrl.includes('login.microsoftonline.com') || currentUrl.includes('aadcdn')) {
    return true;
  }

  for (const selector of [
    'input[type="email"]',
    'input[type="password"]',
    'input[name="loginfmt"]',
    'input[name="passwd"]',
    'input[name="otc"]'
  ]) {
    if (await page.locator(selector).count() > 0) {
      return true;
    }
  }

  return false;
}

function isModelDrivenAppPage(currentUrl: string, modelDrivenAppUrl: string): boolean {
  if (!currentUrl) {
    return false;
  }

  const current = new URL(currentUrl);
  const expected = new URL(modelDrivenAppUrl);
  return current.origin === expected.origin && /\/main\.aspx/i.test(current.pathname);
}

async function waitForReasonableSettling(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS }).catch(() => undefined);
}

async function waitForVisibleLocator(
  page: Page,
  getLocator: (scope: Page | Frame) => Locator,
  timeoutMs: number
): Promise<Locator> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const locator = await getFirstVisibleLocator(page, getLocator);
    if (locator) {
      return locator;
    }

    await page.waitForTimeout(250);
  }

  await expect(getLocator(page)).toBeVisible({ timeout: 1 });
  return getLocator(page);
}

async function hasVisibleLocator(
  page: Page,
  getLocator: (scope: Page | Frame) => Locator
): Promise<boolean> {
  const locator = await getFirstVisibleLocator(page, getLocator);
  return Boolean(locator);
}

async function getFirstVisibleLocator(
  page: Page,
  getLocator: (scope: Page | Frame) => Locator
): Promise<Locator | null> {
  for (const scope of [page, ...page.frames()]) {
    const locator = getLocator(scope).first();
    const count = await locator.count().catch(() => 0);
    if (count < 1) {
      continue;
    }

    const visible = await locator.isVisible().catch(() => false);
    if (visible) {
      return locator;
    }
  }

  return null;
}

async function assertHealthyModelDrivenPage(page: Page, context: string): Promise<void> {
  const pageText = await page.locator('body').innerText({ timeout: 2_000 }).catch(() => '');
  const issue = getKnownModelDrivenPageIssue(page.url(), pageText);
  if (issue) {
    throw new Error(`${context} failed: ${issue}`);
  }
}

function summarizePageText(pageText: string): string {
  if (!pageText) {
    return 'No readable page text was available.'
  }

  const trimmed = pageText.trim().replace(/\s+/g, ' ');
  return `Page text: '${trimmed.slice(0, 200)}${trimmed.length > 200 ? '...' : ''}'.`;
}
