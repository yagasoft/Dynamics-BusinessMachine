import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadCaseCatalog, selectCases } from '../src/case-loader.js';
import { readTrackedEnvironmentConfig } from '../src/config.js';
import { executeCase } from '../src/live-runner.js';
import type { LiveE2ECaseDefinition, LiveE2EEnvironmentConfig, LiveE2ERunContext } from '../src/types.js';

type FakeResponse = {
  ok(): boolean;
  status(): number;
  json(): Promise<Record<string, unknown>>;
  text(): Promise<string>;
};

function response(status: number, payload: Record<string, unknown> = {}): FakeResponse {
  return {
    ok: () => status >= 200 && status < 300,
    status: () => status,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  };
}

function createEnvironmentConfig(): LiveE2EEnvironmentConfig {
  return {
    environment: 'Dev',
    dataverseUrl: 'https://example.crm.dynamics.com/',
    modelDrivenAppUrl: 'https://example.crm.dynamics.com/main.aspx?forceUCI=1',
    liveE2E: {
      enabledModes: ['local-on-demand'],
      lock: {
        webResourceName: 'ys_/dbm/live-e2e/system/dev-lock.json',
        staleAfterMinutes: 120
      },
      cleanup: {
        namePrefix: 'DBM-E2E-TEST',
        orphanAgeHours: 24,
        deleteCreatedRecords: true
      },
      authentication: {
        mode: 'persisted-user-session',
        sessionScope: 'environment',
        identityModel: 'single-user-simulation',
        sessionUserDisplayName: 'DBM Live E2E Session User'
      },
      caseSets: {
        full: ['offline-runtime-state'],
        promotion: ['offline-runtime-state']
      },
      entities: {
        request: {
          logicalName: 'dbm_request',
          entitySetName: 'dbm_requests',
          primaryIdField: 'dbm_requestid',
          primaryNameField: 'dbm_title',
          stateFields: {
            stageIdField: 'dbm_currentstageid',
            stepIdField: 'dbm_currentstepid',
            internalStatusField: 'dbm_internalstatusid',
            portalStatusField: 'dbm_portalstatusid'
          }
        }
      }
    }
  };
}

function createRunContext(evidenceRoot: string, environmentConfig = createEnvironmentConfig()): LiveE2ERunContext {
  return {
    environmentName: 'Dev',
    caseSet: 'full',
    runId: 'run-123',
    preserveOnFailure: false,
    dataverseUrl: environmentConfig.dataverseUrl,
    modelDrivenAppUrl: environmentConfig.modelDrivenAppUrl,
    evidenceRoot,
    environmentConfig,
    session: {
      authenticationMode: 'persisted-user-session',
      sessionScope: 'environment',
      identityModel: 'single-user-simulation',
      physicalUserMode: 'single-user-simulation',
      userDisplayName: 'DBM Live E2E Session User'
    },
    cases: []
  };
}

function createOfflineCase(): LiveE2ECaseDefinition {
  return {
    scenarioId: 'offline-runtime-state',
    title: 'Offline runtime state assertion',
    description: 'Deterministic runner proof for create, assert, cleanup, and evidence without live Dataverse.',
    runModes: ['full', 'promotion'],
    requiredRole: 'requester',
    setup: {
      operations: [
        {
          kind: 'seed-record',
          entityAlias: 'request',
          recordAlias: 'requestRecord',
          fields: {
            dbm_title: '{{cleanupName}} Request',
            dbm_currentstageid: 'internal-screening-stage',
            dbm_currentstepid: 'screen-request',
            dbm_internalstatusid: 'internal-screening',
            dbm_portalstatusid: 'under-review'
          }
        }
      ]
    },
    actions: [],
    assertions: [
      { kind: 'record-exists', entityAlias: 'request', recordAlias: 'requestRecord' },
      {
        kind: 'record-field',
        entityAlias: 'request',
        recordAlias: 'requestRecord',
        fieldLogicalName: 'dbm_title',
        equals: 'DBM-E2E-TEST-run-123 Request'
      },
      {
        kind: 'process-state',
        entityAlias: 'request',
        recordAlias: 'requestRecord',
        expected: {
          stageId: 'internal-screening-stage',
          stepId: 'screen-request',
          internalStatus: 'internal-screening',
          portalStatus: 'under-review'
        }
      }
    ],
    cleanup: {
      targets: [
        { kind: 'delete-record', entityAlias: 'request', recordAlias: 'requestRecord' }
      ]
    },
    evidence: {
      captureScreenshotOnSuccess: false,
      captureTimeline: true
    }
  };
}

function createFakeRequest() {
  const records = new Map<string, Record<string, unknown>>();
  const calls: Array<{ method: string; url: string }> = [];

  return {
    calls,
    request: {
      fetch: async (url: string, init?: { method?: string; data?: Record<string, unknown> }) => {
        const method = init?.method ?? 'GET';
        calls.push({ method, url });

        if (method === 'POST' && url.endsWith('/dbm_requests')) {
          const id = '11111111-1111-1111-1111-111111111111';
          const record = {
            ...(init?.data ?? {}),
            dbm_requestid: id
          };
          records.set(id, record);
          return response(201, record);
        }

        const recordMatch = url.match(/dbm_requests\(([^)]+)\)/);
        if (recordMatch && method === 'GET') {
          const record = records.get(recordMatch[1]);
          return record ? response(200, record) : response(404, { error: 'missing' });
        }

        if (recordMatch && method === 'DELETE') {
          records.delete(recordMatch[1]);
          return response(204);
        }

        throw new Error(`Unexpected fake Dataverse request: ${method} ${url}`);
      }
    }
  };
}

test('executeCase proves runtime state assertions, cleanup, and evidence offline', async () => {
  const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), 'dbm-live-e2e-offline-'));
  const fake = createFakeRequest();

  try {
    const result = await executeCase(
      {} as never,
      fake.request as never,
      createRunContext(evidenceRoot),
      createOfflineCase(),
      'offline-token'
    );

    assert.equal(result.passed, true);
    assert.deepEqual(result.logicalRolesExercised, ['requester']);
    assert.equal(result.createdRecords[0]?.id, '11111111-1111-1111-1111-111111111111');
    assert.equal(result.observedProcessState[0]?.dbm_portalstatusid, 'under-review');
    assert.ok(fake.calls.some((entry) => entry.method === 'DELETE' && entry.url.includes('dbm_requests(')));

    const evidence = JSON.parse(
      await readFile(path.join(evidenceRoot, 'offline-runtime-state', 'case-result.json'), 'utf8')
    ) as { passed: boolean; observedProcessState: Array<Record<string, unknown>> };
    assert.equal(evidence.passed, true);
    assert.equal(evidence.observedProcessState[0]?.dbm_currentstageid, 'internal-screening-stage');
  } finally {
    await rm(evidenceRoot, { recursive: true, force: true });
  }
});

test('tracked full case set includes the generic existing-form proof and promotion stays reference-safe', () => {
  const repoRoot = path.resolve(process.cwd(), '..');
  const config = readTrackedEnvironmentConfig(repoRoot, 'Dev');
  const catalog = loadCaseCatalog(repoRoot);

  const fullCases = selectCases(catalog, config, 'full').map((entry) => entry.scenarioId);
  const promotionCases = selectCases(catalog, config, 'promotion').map((entry) => entry.scenarioId);

  assert.ok(fullCases.includes('generic-existing-form-create-related'));
  assert.equal(promotionCases.includes('generic-existing-form-create-related'), false);

  const genericCase = catalog.find((entry) => entry.scenarioId === 'generic-existing-form-create-related');
  assert.ok(genericCase);
  assert.equal(genericCase.assertions.some((entry) => entry.kind === 'record-field' && entry.entityAlias === 'testTableTwo'), true);
  assert.equal(genericCase.assertions.some((entry) => entry.kind === 'process-state' && entry.entityAlias === 'testTableOne'), true);
});
