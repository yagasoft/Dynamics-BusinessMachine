import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

import { loadRunContext } from '../src/case-loader.js';
import { executeCase } from '../src/live-runner.js';
import type { LiveE2ECaseResult } from '../src/types.js';

const runContextPath = process.env.DBM_LIVE_E2E_RUN_CONTEXT_PATH;
const accessToken = process.env.DBM_LIVE_E2E_ACCESS_TOKEN;

if (!runContextPath) {
  throw new Error('DBM_LIVE_E2E_RUN_CONTEXT_PATH must be set before running the live E2E suite.');
}

if (!accessToken) {
  throw new Error('DBM_LIVE_E2E_ACCESS_TOKEN must be set before running the live E2E suite.');
}

const runContext = loadRunContext(runContextPath);
const summaryRoot = runContext.evidenceRoot;
mkdirSync(summaryRoot, { recursive: true });

const results: LiveE2ECaseResult[] = [];

for (const liveCase of runContext.cases) {
  test(liveCase.scenarioId, async ({ browser, request }) => {
    const result = await executeCase(browser, request, runContext, liveCase, accessToken);
    results.push(result);
  });
}

test.afterAll(async () => {
  writeFileSync(path.join(summaryRoot, 'summary.json'), JSON.stringify({
    generatedUtc: new Date().toISOString(),
    environment: runContext.environmentName,
    caseSet: runContext.caseSet,
    runId: runContext.runId,
    physicalUserMode: runContext.session.physicalUserMode,
    sessionUserDisplayName: runContext.session.userDisplayName,
    logicalRolesExercised: Array.from(new Set(results.flatMap((entry) => entry.logicalRolesExercised))),
    cases: results
  }, null, 2), 'utf8');

  const lines = [
    '# Live Connected E2E Summary',
    '',
    `- Environment: ${runContext.environmentName}`,
    `- Case set: ${runContext.caseSet}`,
    `- Run id: ${runContext.runId}`,
    `- Physical user mode: ${runContext.session.physicalUserMode}`,
    `- Session user: ${runContext.session.userDisplayName}`,
    '',
    '## Cases'
  ];

  for (const result of results) {
    lines.push(`- ${result.scenarioId}: ${result.passed ? 'PASS' : 'FAIL'}`);
  }

  writeFileSync(path.join(summaryRoot, 'summary.md'), lines.join('\n'), 'utf8');
});
