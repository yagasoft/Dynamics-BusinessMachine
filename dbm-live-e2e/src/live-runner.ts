import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';

import {
  assertProcessState,
  assertRecordField,
  createRecord,
  deleteRecord,
  resolveEntityConfig,
  retrieveRecord
} from './dataverse.js';
import {
  assertTextNotVisible,
  captureRecordIdFromPage,
  clickButton,
  ensureActivePersistedSession,
  fillField,
  navigateToRecord,
  setLookupField,
  waitForText
} from './model-driven-ui.js';
import { resolveLogicalRolesExercised } from './session.js';
import type {
  LiveE2EAction,
  LiveE2EAssertion,
  LiveE2ECaseDefinition,
  LiveE2ECaseResult,
  LiveE2ERecordReference,
  LiveE2ERole,
  LiveE2ERunContext
} from './types.js';

interface ExecutionState {
  records: Record<string, LiveE2ERecordReference>;
  pageState?: { context: BrowserContext; page: Page };
}

export async function executeCase(
  browser: Browser,
  request: APIRequestContext,
  runContext: LiveE2ERunContext,
  liveCase: LiveE2ECaseDefinition,
  accessToken: string
): Promise<LiveE2ECaseResult> {
  const caseResult: LiveE2ECaseResult = {
    scenarioId: liveCase.scenarioId,
    title: liveCase.title,
    passed: false,
    startedUtc: new Date().toISOString(),
    completedUtc: new Date().toISOString(),
    physicalUserMode: runContext.session.physicalUserMode,
    logicalRolesExercised: [],
    createdRecords: [],
    observedProcessState: [],
    notes: []
  };

  const state: ExecutionState = {
    records: {}
  };

  try {
    caseResult.logicalRolesExercised = resolveLogicalRolesExercised(liveCase);

    for (const operation of liveCase.setup.operations) {
      const entityConfig = resolveEntityConfig(runContext.environmentConfig, operation.entityAlias);
      const seededFields = resolveTemplates(operation.fields, runContext, caseResult, state.records) as Record<string, unknown>;
      const recordId = await createRecord(request, accessToken, runContext.dataverseUrl, entityConfig, seededFields);
      state.records[operation.recordAlias] = { entityAlias: operation.entityAlias, id: recordId };
      caseResult.createdRecords.push({ entityAlias: operation.entityAlias, id: recordId });
    }

    for (const action of liveCase.actions) {
      await executeAction(browser, runContext, liveCase, action, caseResult, state);
    }

    for (const assertion of liveCase.assertions) {
      await executeAssertion(request, accessToken, runContext, assertion, caseResult, state.records);
    }

    caseResult.passed = true;
  }
  catch (error) {
    caseResult.error = error instanceof Error ? error.message : String(error);
    throw error;
  }
  finally {
    caseResult.completedUtc = new Date().toISOString();
    await writeCaseEvidence(runContext, caseResult);

    if (runContext.preserveOnFailure && !caseResult.passed) {
      caseResult.notes.push('Preserve-on-failure is enabled; created records were not cleaned up.');
    }
    else {
      await cleanupCase(request, accessToken, runContext, liveCase, caseResult, state.records);
    }

    if (state.pageState) {
      const refreshStatePath = process.env.DBM_LIVE_E2E_SESSION_REFRESH_PATH;
      if (refreshStatePath) {
        await state.pageState.context.storageState({ path: refreshStatePath });
      }

      await state.pageState.context.close();
    }
  }

  return caseResult;
}

async function executeAction(
  browser: Browser,
  runContext: LiveE2ERunContext,
  liveCase: LiveE2ECaseDefinition,
  action: LiveE2EAction,
  caseResult: LiveE2ECaseResult,
  state: ExecutionState
): Promise<void> {
  const pageState = await getPage(browser, runContext, state);
  const page = pageState.page;

  switch (action.kind) {
    case 'open-model-driven-url': {
      const relativeUrl = action.relativeUrlTemplate
        ? resolveTemplate(action.relativeUrlTemplate, runContext, caseResult, state.records)
        : '';
      const targetUrl = relativeUrl ? new URL(relativeUrl, runContext.modelDrivenAppUrl).toString() : runContext.modelDrivenAppUrl;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
      break;
    }

    case 'open-new-record-form': {
      const entityConfig = resolveEntityConfig(runContext.environmentConfig, action.entityAlias);
      await navigateToRecord(page, runContext.dataverseUrl, entityConfig.logicalName);
      break;
    }

    case 'open-record-form': {
      const record = state.records[action.recordAlias];
      if (!record) {
        throw new Error(`Action '${action.kind}' references unknown record alias '${action.recordAlias}'.`);
      }

      const entityConfig = resolveEntityConfig(runContext.environmentConfig, action.entityAlias);
      await navigateToRecord(page, runContext.dataverseUrl, entityConfig.logicalName, record.id);
      break;
    }

    case 'fill-field':
      await fillField(page, action.label, resolveTemplate(action.value, runContext, caseResult, state.records));
      break;

    case 'set-lookup-field':
      await setLookupField(page, action.label, resolveTemplate(action.value, runContext, caseResult, state.records));
      break;

    case 'click-button':
      await clickButton(page, action.label);
      break;

    case 'wait-for-text':
      await waitForText(page, resolveTemplate(action.text, runContext, caseResult, state.records), action.timeoutMs);
      break;

    case 'assert-text-not-visible':
      await assertTextNotVisible(page, resolveTemplate(action.text, runContext, caseResult, state.records), action.timeoutMs);
      break;

    case 'capture-current-record-id': {
      const existing = state.records[action.recordAlias];
      const entityAlias = existing?.entityAlias ?? inferDefaultEntityAlias(runContext);
      const recordId = captureRecordIdFromPage(page);
      state.records[action.recordAlias] = { entityAlias, id: recordId };
      caseResult.createdRecords.push({ entityAlias, id: recordId });
      break;
    }

    case 'wait-for-idle':
      await page.waitForTimeout(action.delayMs ?? 2_000);
      break;

    default:
      throw new Error(`Unsupported live E2E action kind '${(action as { kind: string }).kind}'.`);
  }
}

async function executeAssertion(
  request: APIRequestContext,
  accessToken: string,
  runContext: LiveE2ERunContext,
  assertion: LiveE2EAssertion,
  caseResult: LiveE2ECaseResult,
  records: Record<string, LiveE2ERecordReference>
): Promise<void> {
  switch (assertion.kind) {
    case 'record-exists': {
      const record = records[assertion.recordAlias];
      if (!record) {
        throw new Error(`Assertion '${assertion.kind}' references unknown record alias '${assertion.recordAlias}'.`);
      }

      const entityConfig = resolveEntityConfig(runContext.environmentConfig, assertion.entityAlias);
      await retrieveRecord(request, accessToken, runContext.dataverseUrl, entityConfig, record.id, [entityConfig.primaryIdField]);
      break;
    }

    case 'record-field': {
      const record = records[assertion.recordAlias];
      if (!record) {
        throw new Error(`Assertion '${assertion.kind}' references unknown record alias '${assertion.recordAlias}'.`);
      }

      const entityConfig = resolveEntityConfig(runContext.environmentConfig, assertion.entityAlias);
      await assertRecordField(request, accessToken, runContext.dataverseUrl, entityConfig, record, {
        ...assertion,
        equals: typeof assertion.equals === 'string' ? resolveTemplate(assertion.equals, runContext, caseResult, records) : assertion.equals,
        notEquals: typeof assertion.notEquals === 'string' ? resolveTemplate(assertion.notEquals, runContext, caseResult, records) : assertion.notEquals
      });
      break;
    }

    case 'process-state': {
      const record = records[assertion.recordAlias];
      if (!record) {
        throw new Error(`Assertion '${assertion.kind}' references unknown record alias '${assertion.recordAlias}'.`);
      }

      const entityConfig = resolveEntityConfig(runContext.environmentConfig, assertion.entityAlias);
      await assertProcessState(request, accessToken, runContext.dataverseUrl, entityConfig, record, {
        ...assertion,
        expected: {
          stageId: assertion.expected.stageId ? resolveTemplate(assertion.expected.stageId, runContext, caseResult, records) : undefined,
          stepId: assertion.expected.stepId ? resolveTemplate(assertion.expected.stepId, runContext, caseResult, records) : undefined,
          internalStatus: assertion.expected.internalStatus ? resolveTemplate(assertion.expected.internalStatus, runContext, caseResult, records) : undefined,
          portalStatus: assertion.expected.portalStatus ? resolveTemplate(assertion.expected.portalStatus, runContext, caseResult, records) : undefined
        }
      }, caseResult);
      break;
    }

    case 'text-visible':
    case 'text-not-visible':
      caseResult.notes.push(`UI text assertion '${assertion.kind}' remains action-driven in this slice.`);
      break;

    default:
      throw new Error(`Unsupported live E2E assertion kind '${(assertion as { kind: string }).kind}'.`);
  }
}

async function getPage(
  browser: Browser,
  runContext: LiveE2ERunContext,
  state: ExecutionState
): Promise<{ context: BrowserContext; page: Page }> {
  if (state.pageState) {
    return state.pageState;
  }

  const sessionStatePath = process.env.DBM_LIVE_E2E_SESSION_STATE_PATH;
  if (!sessionStatePath) {
    throw new Error('DBM_LIVE_E2E_SESSION_STATE_PATH must be set before running connected live E2E.');
  }

  const context = await browser.newContext({
    storageState: sessionStatePath
  });
  const page = await context.newPage();
  await ensureActivePersistedSession(page, runContext.environmentConfig);
  const pageState = { context, page };
  state.pageState = pageState;
  return pageState;
}

async function cleanupCase(
  request: APIRequestContext,
  accessToken: string,
  runContext: LiveE2ERunContext,
  liveCase: LiveE2ECaseDefinition,
  caseResult: LiveE2ECaseResult,
  records: Record<string, LiveE2ERecordReference>
): Promise<void> {
  if (!runContext.environmentConfig.liveE2E.cleanup.deleteCreatedRecords) {
    caseResult.notes.push('Tracked environment config disabled deleteCreatedRecords, so live E2E cleanup was skipped.');
    return;
  }

  for (const target of liveCase.cleanup.targets) {
    const record = records[target.recordAlias];
    if (!record) {
      if (!target.ignoreMissing) {
        caseResult.notes.push(`Cleanup target '${target.recordAlias}' was not captured during execution.`);
      }
      continue;
    }

    const entityConfig = resolveEntityConfig(runContext.environmentConfig, target.entityAlias);
    await deleteRecord(request, accessToken, runContext.dataverseUrl, entityConfig, record.id, target.ignoreMissing);
  }
}

async function writeCaseEvidence(runContext: LiveE2ERunContext, caseResult: LiveE2ECaseResult): Promise<void> {
  const caseRoot = path.join(runContext.evidenceRoot, caseResult.scenarioId);
  mkdirSync(caseRoot, { recursive: true });
  writeFileSync(path.join(caseRoot, 'case-result.json'), JSON.stringify(caseResult, null, 2), 'utf8');
}

function inferDefaultEntityAlias(runContext: LiveE2ERunContext): string {
  const [firstAlias] = Object.keys(runContext.environmentConfig.liveE2E.entities);
  if (!firstAlias) {
    throw new Error('The tracked environment config does not define any live E2E entity aliases.');
  }

  return firstAlias;
}

export function resolveTemplate(
  value: string,
  runContext: LiveE2ERunContext,
  caseResult: LiveE2ECaseResult,
  records: Record<string, LiveE2ERecordReference>
): string {
  return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, rawToken: string) => {
    const token = rawToken.trim();
    const resolved = resolveTemplateToken(token, runContext, caseResult, records);
    return typeof resolved === 'string' ? resolved : JSON.stringify(resolved);
  });
}

export function resolveTemplates<T>(
  value: T,
  runContext: LiveE2ERunContext,
  caseResult: LiveE2ECaseResult,
  records: Record<string, LiveE2ERecordReference>
): T {
  if (typeof value === 'string') {
    return resolveTemplate(value, runContext, caseResult, records) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveTemplates(entry, runContext, caseResult, records)) as T;
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, resolveTemplates(entry, runContext, caseResult, records)])
    ) as T;
  }

  return value;
}

function resolveTemplateToken(
  token: string,
  runContext: LiveE2ERunContext,
  caseResult: LiveE2ECaseResult,
  records: Record<string, LiveE2ERecordReference>
): unknown {
  if (token === 'runId') {
    return runContext.runId;
  }

  if (token === 'cleanupName') {
    return `${runContext.environmentConfig.liveE2E.cleanup.namePrefix}-${runContext.runId}`;
  }

  if (token === 'caseId') {
    return caseResult.scenarioId;
  }

  if (token.startsWith('records.')) {
    const [, recordAlias, propertyName] = token.split('.');
    const record = recordAlias ? records[recordAlias] : undefined;
    if (!record || !propertyName) {
      throw new Error(`Invalid or unresolved live E2E record token '${token}'.`);
    }

    return (record as unknown as Record<string, unknown>)[propertyName];
  }

  if (token.startsWith('session.')) {
    const [, propertyName] = token.split('.');
    if (!propertyName) {
      throw new Error(`Invalid or unresolved live E2E session token '${token}'.`);
    }

    return (runContext.session as unknown as Record<string, unknown>)[propertyName];
  }

  throw new Error(`Unsupported live E2E template token '${token}'.`);
}
