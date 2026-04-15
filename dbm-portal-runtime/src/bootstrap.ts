import type { DbmPortalRuntimeBootstrapV1 } from 'dbm-contract';

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Portal runtime bootstrap is missing '${label}'.`);
  }

  return value.trim();
}

export function parsePortalRuntimeBootstrap(
  input: string | DbmPortalRuntimeBootstrapV1
): DbmPortalRuntimeBootstrapV1 {
  const parsed = typeof input === 'string' ? JSON.parse(input) : input;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Portal runtime bootstrap must be an object.');
  }

  const bootstrap = parsed as DbmPortalRuntimeBootstrapV1;
  assertNonEmptyString(bootstrap.schemaVersion, 'schemaVersion');
  assertNonEmptyString(bootstrap.packageId, 'packageId');
  assertNonEmptyString(bootstrap.packageVersion, 'packageVersion');
  assertNonEmptyString(bootstrap.processId, 'processId');
  assertNonEmptyString(bootstrap.identityMode, 'identityMode');
  assertNonEmptyString(bootstrap.genericProfileKey, 'genericProfileKey');
  assertNonEmptyString(bootstrap.entryPage?.pageId, 'entryPage.pageId');
  assertNonEmptyString(bootstrap.entryPage?.routePath, 'entryPage.routePath');
  assertNonEmptyString(bootstrap.requestShellPage?.pageId, 'requestShellPage.pageId');
  assertNonEmptyString(bootstrap.requestShellPage?.routePath, 'requestShellPage.routePath');
  assertNonEmptyString(bootstrap.requestEntityLogicalName, 'requestEntityLogicalName');
  assertNonEmptyString(bootstrap.requestEntitySetName, 'requestEntitySetName');
  assertNonEmptyString(bootstrap.startFormId, 'startFormId');
  if (!Array.isArray(bootstrap.entryFields) || bootstrap.entryFields.length === 0) {
    throw new Error('Portal runtime bootstrap is missing entryFields.');
  }
  for (const entryField of bootstrap.entryFields) {
    assertNonEmptyString(entryField.logicalName, 'entryFields.logicalName');
    assertNonEmptyString(entryField.displayName, 'entryFields.displayName');
    assertNonEmptyString(entryField.dataType, 'entryFields.dataType');
  }
  assertNonEmptyString(bootstrap.portalCommandFieldLogicalName, 'portalCommandFieldLogicalName');
  assertNonEmptyString(bootstrap.runtimeStateFieldLogicalNames?.stageId, 'runtimeStateFieldLogicalNames.stageId');
  assertNonEmptyString(bootstrap.runtimeStateFieldLogicalNames?.stepId, 'runtimeStateFieldLogicalNames.stepId');
  assertNonEmptyString(bootstrap.runtimeStateFieldLogicalNames?.formStateId, 'runtimeStateFieldLogicalNames.formStateId');
  assertNonEmptyString(bootstrap.runtimeStateFieldLogicalNames?.internalStatusId, 'runtimeStateFieldLogicalNames.internalStatusId');
  assertNonEmptyString(bootstrap.runtimeStateFieldLogicalNames?.portalStatusId, 'runtimeStateFieldLogicalNames.portalStatusId');
  assertNonEmptyString(bootstrap.runtimeStateFieldLogicalNames?.portalProfileKey, 'runtimeStateFieldLogicalNames.portalProfileKey');
  assertNonEmptyString(bootstrap.defaultState?.stageId, 'defaultState.stageId');
  assertNonEmptyString(bootstrap.defaultState?.stepId, 'defaultState.stepId');
  assertNonEmptyString(bootstrap.defaultState?.internalStatusId, 'defaultState.internalStatusId');

  if (!Array.isArray(bootstrap.allowedActions)) {
    throw new Error('Portal runtime bootstrap is missing allowedActions.');
  }

  return bootstrap;
}
