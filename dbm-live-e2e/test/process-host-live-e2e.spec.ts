import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { loadRunContext } from '../src/case-loader.js';
import { createRecord, deleteRecord, resolveEntityConfig } from '../src/dataverse.js';
import {
  ensureActivePersistedSession,
  getKnownModelDrivenPageIssue,
  navigateToRecord,
  waitForText
} from '../src/model-driven-ui.js';

const runContextPath = process.env.DBM_LIVE_E2E_RUN_CONTEXT_PATH;
const accessToken = process.env.DBM_LIVE_E2E_ACCESS_TOKEN;
const sessionStatePath = process.env.DBM_LIVE_E2E_SESSION_STATE_PATH;
const pinnedPackageName = 'dbm-testtableone-to-testtabletwo';

if (!runContextPath) {
  throw new Error('DBM_LIVE_E2E_RUN_CONTEXT_PATH must be set before running the live process-host suite.');
}

if (!accessToken) {
  throw new Error('DBM_LIVE_E2E_ACCESS_TOKEN must be set before running the live process-host suite.');
}

if (!sessionStatePath) {
  throw new Error('DBM_LIVE_E2E_SESSION_STATE_PATH must be set before running the live process-host suite.');
}

const runContext = loadRunContext(runContextPath);

async function waitForEditorFrame(hostPage: Page, timeoutMs = 60_000) {
  await expect
    .poll(
      () => hostPage.frames().find((frame) => frame.url().includes('ys_/dbm/apps/editor/index.html'))?.url() ?? null,
      { timeout: timeoutMs }
    )
    .not.toBeNull();

  const frame = hostPage.frames().find((entry) => entry.url().includes('ys_/dbm/apps/editor/index.html'));
  if (!frame) {
    throw new Error('Hosted designer frame was not found after navigation.');
  }

  return frame;
}

test('model-driven process host fits the form and reopens the hosted designer', async ({ browser, request }) => {
  const entityConfig = resolveEntityConfig(runContext.environmentConfig, 'testTableOne');
  const cleanupName = `${runContext.environmentConfig.liveE2E.cleanup.namePrefix}-HOST-${Date.now()}`;
  const evidenceRoot = path.join(runContext.evidenceRoot, 'process-host-live-validation');
  mkdirSync(evidenceRoot, { recursive: true });

  const recordId = await createRecord(request, accessToken, runContext.dataverseUrl, entityConfig, {
    ys_testonename: `${cleanupName} Source`,
    ys_description: `${cleanupName} Source description`
  });

  const context = await browser.newContext({ storageState: sessionStatePath });
  let designerPage = null as Awaited<ReturnType<typeof context.newPage>> | null;
  let directDesignerPage = null as Awaited<ReturnType<typeof context.newPage>> | null;

  try {
    const page = await context.newPage();
    await ensureActivePersistedSession(page, runContext.environmentConfig);
    await navigateToRecord(page, runContext.dataverseUrl, entityConfig.logicalName, recordId);
    await waitForText(page, 'Edit process', 60_000);
    await waitForText(page, 'DBM Process', 60_000);

    const hostMetrics = await page.evaluate(() => {
      const frame = Array.from(document.querySelectorAll('iframe')).find((entry) =>
        entry.src.includes('ys_/dbm/process-experience/host.html')
      );

      if (!frame) {
        return null;
      }

      const root = frame.contentDocument?.getElementById('dbm-process-host-root');
      const contentHeight = Math.max(
        root?.scrollHeight ?? 0,
        frame.contentDocument?.body?.scrollHeight ?? 0,
        frame.contentDocument?.documentElement?.scrollHeight ?? 0
      );
      const contentWidth = Math.max(
        root?.scrollWidth ?? 0,
        frame.contentDocument?.body?.scrollWidth ?? 0,
        frame.contentDocument?.documentElement?.scrollWidth ?? 0
      );
      const frameRect = frame.getBoundingClientRect();
      const hostText = frame.contentDocument?.body?.innerText ?? '';

      return {
        src: frame.src,
        frameHeight: Math.ceil(frameRect.height),
        frameWidth: Math.ceil(frameRect.width),
        contentHeight: Math.ceil(contentHeight),
        contentWidth: Math.ceil(contentWidth),
        hostText
      };
    });

    expect(hostMetrics).not.toBeNull();
    expect(hostMetrics?.hostText).toContain('Edit process');
    expect(hostMetrics?.contentHeight ?? 0).toBeLessThanOrEqual((hostMetrics?.frameHeight ?? 0) + 12);
    expect(hostMetrics?.contentWidth ?? 0).toBeLessThanOrEqual((hostMetrics?.frameWidth ?? 0) + 24);

    await page.screenshot({
      path: path.join(evidenceRoot, 'source-form-process-host.png'),
      fullPage: true
    });

    const hostFrame = page.frames().find((entry) => entry.url().includes('ys_/dbm/process-experience/host.html'));
    expect(hostFrame).toBeTruthy();

    const popupPromise = context.waitForEvent('page');
    await hostFrame!.getByRole('button', { name: 'Edit process' }).click();
    designerPage = await popupPromise;
    await designerPage.waitForLoadState('domcontentloaded');
    await designerPage.waitForLoadState('networkidle').catch(() => undefined);

    const popupIssue = getKnownModelDrivenPageIssue(
      designerPage.url(),
      await designerPage.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
    );
    expect(popupIssue).toBeNull();
    expect(designerPage.url()).toContain('appid=');
    expect(designerPage.url()).toContain('data=');
    expect(designerPage.url()).not.toContain('packageName=');
    const designerFrame = await waitForEditorFrame(designerPage);
    await expect(designerFrame.getByText('DBM Packages')).toBeVisible({ timeout: 60_000 });
    await expect(designerFrame.getByRole('heading', { name: /^DBM TestTableOne To TestTableTwo$/i })).toBeVisible({ timeout: 60_000 });

    await designerPage.screenshot({
      path: path.join(evidenceRoot, 'designer-reopen.png'),
      fullPage: true
    });

    const directUrl = new URL(designerPage.url());
    directUrl.searchParams.set('data', JSON.stringify({ packageName: pinnedPackageName }));
    directUrl.searchParams.delete('packageName');

    directDesignerPage = await context.newPage();
    await directDesignerPage.goto(directUrl.toString(), { waitUntil: 'domcontentloaded' });
    await directDesignerPage.waitForLoadState('networkidle').catch(() => undefined);

    const directIssue = getKnownModelDrivenPageIssue(
      directDesignerPage.url(),
      await directDesignerPage.locator('body').innerText({ timeout: 5_000 }).catch(() => '')
    );
    expect(directIssue).toBeNull();
    const directDesignerFrame = await waitForEditorFrame(directDesignerPage);
    await expect(directDesignerFrame.getByText('DBM Packages')).toBeVisible({ timeout: 60_000 });
    await expect(directDesignerFrame.getByRole('heading', { name: /^DBM TestTableOne To TestTableTwo$/i })).toBeVisible({ timeout: 60_000 });
  } finally {
    await designerPage?.close().catch(() => undefined);
    await directDesignerPage?.close().catch(() => undefined);
    await context.close().catch(() => undefined);
    await deleteRecord(request, accessToken, runContext.dataverseUrl, entityConfig, recordId, true);
  }
});
