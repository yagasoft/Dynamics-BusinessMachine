import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import type { DbmProcessExperienceAudienceV1, DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import type { DbmProcessExperienceModeV1 } from '../../src/types';
import { buildApprovalRequestSnapshot, type ApprovalRequestFixtureScenario } from '../../src/test-fixtures/approvalRequestFixture';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererScriptPath = path.resolve(__dirname, '../../dist/browser/renderer.js');

async function renderSnapshot(
  page: Page,
  options: {
    snapshot: DbmProcessExperienceSnapshotV1;
    mode: DbmProcessExperienceModeV1;
    audience?: DbmProcessExperienceAudienceV1;
  }
) {
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          html, body {
            margin: 0;
            background: #f7f2e8;
            color: #0f172a;
            font-family: "Segoe UI", Arial, sans-serif;
          }

          #root-shell {
            max-width: 1180px;
            margin: 0 auto;
            padding: 32px;
          }
        </style>
      </head>
      <body>
        <div id="root-shell">
          <div id="root"></div>
        </div>
      </body>
    </html>
  `);

  await page.addScriptTag({ path: rendererScriptPath });
  await page.evaluate((props) => {
    const root = document.getElementById('root');
    if (!root) {
      throw new Error('Missing root element for process-experience visual test.');
    }

    const host = (window as typeof window & {
      DBM?: {
        ProcessExperienceHost?: {
          render(target: HTMLElement, renderProps: unknown): void;
        };
      };
    }).DBM?.ProcessExperienceHost;

    if (!host?.render) {
      throw new Error('ProcessExperienceHost.render was not registered in the visual harness.');
    }

    host.render(root, props);
  }, options);
}

async function expectScenarioScreenshot(
  page: Page,
  scenario: ApprovalRequestFixtureScenario,
  mode: DbmProcessExperienceModeV1,
  fileName: string
) {
  const snapshot = buildApprovalRequestSnapshot(scenario);
  await renderSnapshot(page, {
    snapshot,
    mode,
    audience: snapshot.audience
  });

  await expect(page.locator('#root')).toContainText('Approval Request');
  await expect(page.locator('#root')).toHaveScreenshot(fileName, {
    animations: 'disabled'
  });
}

test('designer-preview current-stage visual baseline', async ({ page }) => {
  await expectScenarioScreenshot(
    page,
    'designer-preview-current-stage',
    'designer-preview',
    'designer-preview-current-stage.png'
  );
});

test('portal-fixture hidden-stage-collapsed visual baseline', async ({ page }) => {
  await expectScenarioScreenshot(
    page,
    'portal-hidden-stage-collapsed',
    'portal-fixture',
    'portal-fixture-hidden-stage-collapsed.png'
  );
});

test('designer-preview cross-form handoff visual baseline', async ({ page }) => {
  await expectScenarioScreenshot(
    page,
    'designer-cross-form-handoff',
    'designer-preview',
    'designer-preview-cross-form-handoff.png'
  );
});
