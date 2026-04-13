import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { loadCaseCatalog } from '../src/case-loader.js';
import { readTrackedEnvironmentConfig } from '../src/config.js';
import { resolveTemplate } from '../src/live-runner.js';
import { resolveLogicalRolesExercised, validateSessionMetadata } from '../src/session.js';
import type { LiveE2ECaseResult, LiveE2ERunContext } from '../src/types.js';

const repoRoot = path.resolve(process.cwd(), '..');

test('tracked environment config uses persisted single-user session auth', () => {
  const config = readTrackedEnvironmentConfig(repoRoot, 'Dev');
  assert.equal(config.liveE2E.authentication.mode, 'persisted-user-session');
  assert.equal(config.liveE2E.authentication.sessionScope, 'environment');
  assert.equal(config.liveE2E.authentication.identityModel, 'single-user-simulation');
});

test('session metadata validator accepts healthy single-user metadata', () => {
  const config = readTrackedEnvironmentConfig(repoRoot, 'Dev');
  const metadataErrors = validateSessionMetadata({
    targetEnvironment: 'Dev',
    authenticationMode: 'persisted-user-session',
    sessionScope: 'environment',
    identityModel: 'single-user-simulation',
    physicalUserMode: 'single-user-simulation',
    physicalUserDisplayName: 'DBM Live E2E Session User',
    modelDrivenAppUrl: config.modelDrivenAppUrl,
    bootstrapUtc: new Date().toISOString(),
    lastSuccessfulUseUtc: new Date().toISOString(),
    lastRefreshUtc: new Date().toISOString(),
    lastHealthCheckUtc: new Date().toISOString(),
    sessionHealthStatus: 'healthy'
  }, config);

  assert.deepEqual(metadataErrors, []);
});

test('session metadata validator rejects mismatched environment and missing display name', () => {
  const config = readTrackedEnvironmentConfig(repoRoot, 'Dev');
  const metadataErrors = validateSessionMetadata({
    targetEnvironment: 'UAT',
    authenticationMode: 'persisted-user-session',
    sessionScope: 'environment',
    identityModel: 'single-user-simulation',
    physicalUserMode: 'single-user-simulation',
    physicalUserDisplayName: '',
    modelDrivenAppUrl: 'https://wrong.example/main.aspx',
    bootstrapUtc: 'not-a-date',
    sessionHealthStatus: 'expired'
  }, config);

  assert.ok(metadataErrors.some((entry) => entry.includes('targets')));
  assert.ok(metadataErrors.some((entry) => entry.includes('physicalUserDisplayName')));
  assert.ok(metadataErrors.some((entry) => entry.includes('modelDrivenAppUrl')));
  assert.ok(metadataErrors.some((entry) => entry.includes('bootstrapUtc')));
});

test('logical workflow roles are preserved while physical execution stays single-user', () => {
  const approvalCase = loadCaseCatalog().find((entry) => entry.scenarioId === 'approval-path');
  assert.ok(approvalCase);
  assert.deepEqual(resolveLogicalRolesExercised(approvalCase), ['requester', 'manager-approver']);
});

test('session template tokens resolve from the run context instead of test-user credentials', () => {
  const config = readTrackedEnvironmentConfig(repoRoot, 'Dev');
  const runContext: LiveE2ERunContext = {
    environmentName: 'Dev',
    caseSet: 'full',
    runId: 'run-123',
    preserveOnFailure: false,
    dataverseUrl: config.dataverseUrl,
    modelDrivenAppUrl: config.modelDrivenAppUrl,
    evidenceRoot: 'artifacts/live-e2e/dev/run-123',
    environmentConfig: config,
    session: {
      authenticationMode: 'persisted-user-session',
      sessionScope: 'environment',
      identityModel: 'single-user-simulation',
      physicalUserMode: 'single-user-simulation',
      userDisplayName: 'DBM Live E2E Session User'
    },
    cases: []
  };
  const caseResult: LiveE2ECaseResult = {
    scenarioId: 'case-1',
    title: 'Case',
    passed: false,
    startedUtc: new Date().toISOString(),
    completedUtc: new Date().toISOString(),
    physicalUserMode: 'single-user-simulation',
    logicalRolesExercised: ['requester'],
    createdRecords: [],
    observedProcessState: [],
    notes: []
  };

  assert.equal(resolveTemplate('{{session.userDisplayName}}', runContext, caseResult, {}), 'DBM Live E2E Session User');
});
