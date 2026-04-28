// @vitest-environment node

import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import type { DbmPortalRuntimeBootstrapV1 } from 'dbm-contract';
import type { DbmProcessExperienceRuntimeModelV1 } from 'dbm-process-experience';
import { createPortalRuntimeLocalProofServer, type PortalRuntimeLocalProofServerHandle } from './local-proof-server.js';

const bootstrap: DbmPortalRuntimeBootstrapV1 = {
  schemaVersion: 'dbm.portal-runtime.bootstrap/v1',
  packageId: 'dbm-approval-request',
  packageVersion: '1.2.1',
  processId: 'approval-request-process',
  identityMode: 'generic-profile',
  genericProfileKey: 'dev-anonymous-requester',
  routes: {
    entryPath: '/approval-request',
    statusPath: '/approval-request/status'
  },
  requestEntityLogicalName: 'dbm_request',
  requestEntitySetName: 'dbm_requests',
  startFormId: 'request-form',
  entryFields: [
    { logicalName: 'dbm_title', displayName: 'Request Title', dataType: 'string', required: true },
    { logicalName: 'dbm_amount', displayName: 'Request Amount', dataType: 'currency', required: true }
  ],
  portalCommandFieldLogicalName: 'dbm_portalcommand',
  runtimeStateFieldLogicalNames: {
    stageId: 'dbm_currentstageid',
    stepId: 'dbm_currentstepid',
    formStateId: 'dbm_currentformstateid',
    internalStatusId: 'dbm_internalstatusid',
    portalStatusId: 'dbm_portalstatusid',
    portalProfileKey: 'dbm_portalprofilekey'
  },
  defaultState: {
    stageId: 'draft-request',
    stepId: 'capture-request',
    formStateId: 'request-edit-state',
    internalStatusId: 'draft',
    portalStatusId: 'draft'
  },
  allowedActions: ['create-draft', 'submit-request', 'refresh-status']
};

const runtimeModel: DbmProcessExperienceRuntimeModelV1 = {
  packageId: 'dbm-approval-request',
  packageVersion: '1.2.1',
  processId: 'approval-request-process',
  actors: [],
  statuses: [],
  outcomes: [],
  stages: [],
  steps: [],
  transitions: []
};

const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  while (cleanupTasks.length > 0) {
    const task = cleanupTasks.pop();
    if (task) {
      await task();
    }
  }
  vi.restoreAllMocks();
});

async function createTempDistRoot(): Promise<string> {
  const distRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'dbm-local-proof-'));
  await fs.mkdir(path.join(distRoot, 'assets'), { recursive: true });
  await fs.writeFile(
    path.join(distRoot, 'index.html'),
    '<!doctype html><html><body><div id="dbm-local-proof-root"></div></body></html>',
    'utf8'
  );
  await fs.writeFile(path.join(distRoot, 'assets', 'runtime.js'), 'console.log("proof");', 'utf8');
  cleanupTasks.push(async () => {
    await fs.rm(distRoot, { recursive: true, force: true });
  });
  return distRoot;
}

async function startServer(options: {
  fetchImpl?: typeof fetch;
  getAccessToken?: () => Promise<string>;
} = {}): Promise<PortalRuntimeLocalProofServerHandle> {
  const distRoot = await createTempDistRoot();
  const handle = await createPortalRuntimeLocalProofServer({
    bootstrap,
    runtimeModel,
    hostPackageName: 'dbm-portal-runtime',
    distRoot,
    host: '127.0.0.1',
    port: 0,
    environment: 'Dev',
    dataverseUrl: 'https://example.crm.dynamics.com/',
    getAccessToken: options.getAccessToken ?? (async () => 'token'),
    fetchImpl: options.fetchImpl ?? fetch
  });
  cleanupTasks.push(async () => {
    await handle.close();
  });
  return handle;
}

test('local proof host serves SPA routes and health from localhost', async () => {
  const handle = await startServer({
    getAccessToken: async () => {
      throw new Error('health route should not request a Dataverse token');
    }
  });

  const entryResponse = await fetch(`${handle.baseUrl}/approval-request`);
  expect(entryResponse.status).toBe(200);
  expect(await entryResponse.text()).toContain('dbm-local-proof-root');

  const statusResponse = await fetch(`${handle.baseUrl}/approval-request/status`);
  expect(statusResponse.status).toBe(200);
  expect(await statusResponse.text()).toContain('dbm-local-proof-root');

  const healthResponse = await fetch(`${handle.baseUrl}/api/runtime/health`);
  const healthPayload = await healthResponse.json() as { status: string; hostPackageName: string; environment: string };
  expect(healthPayload.status).toBe('ready');
  expect(healthPayload.hostPackageName).toBe('dbm-portal-runtime');
  expect(healthPayload.environment).toBe('Dev');
});

test('local proof host proxies create and submit through live Dataverse contract', async () => {
  let retrieveCount = 0;
  const fetchSpy = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';

    if (url.endsWith('/dbm_requests') && method === 'POST') {
      return new Response(null, {
        status: 204,
        headers: {
          'OData-EntityId': 'https://example.crm.dynamics.com/api/data/v9.2/dbm_requests(11111111-1111-1111-1111-111111111111)'
        }
      });
    }

    if (url.includes('/dbm_requests(11111111-1111-1111-1111-111111111111)?') && method === 'GET') {
      retrieveCount += 1;
      const payload = retrieveCount === 1
        ? {
            dbm_requestid: '11111111-1111-1111-1111-111111111111',
            dbm_title: 'Portal Request',
            dbm_currentstageid: 'draft-request',
            dbm_currentstepid: 'capture-request',
            dbm_currentformstateid: 'request-edit-state',
            dbm_internalstatusid: 'draft',
            dbm_portalstatusid: 'draft'
          }
        : {
            dbm_requestid: '11111111-1111-1111-1111-111111111111',
            dbm_title: 'Portal Request',
            dbm_currentstageid: 'internal-screening-stage',
            dbm_currentstepid: 'screen-request',
            dbm_currentformstateid: 'request-screening-state',
            dbm_internalstatusid: 'under-review',
            dbm_portalstatusid: 'under-review'
          };

      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (url.endsWith('/dbm_requests(11111111-1111-1111-1111-111111111111)') && method === 'PATCH') {
      return new Response(null, { status: 204 });
    }

    throw new Error(`Unexpected Dataverse request in test double: ${method} ${url}`);
  });

  const handle = await startServer({ fetchImpl: fetchSpy });

  const createResponse = await fetch(`${handle.baseUrl}/api/runtime/drafts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dbm_title: 'Portal Request'
    })
  });
  expect(createResponse.status).toBe(201);
  const createdPayload = await createResponse.json() as { runtimeState: { stageId: string } };
  expect(createdPayload.runtimeState.stageId).toBe('draft-request');

  const submitResponse = await fetch(`${handle.baseUrl}/api/runtime/requests/11111111-1111-1111-1111-111111111111/submit`, {
    method: 'POST'
  });
  expect(submitResponse.status).toBe(200);
  const submittedPayload = await submitResponse.json() as { runtimeState: { portalStatusId: string | null } };
  expect(submittedPayload.runtimeState.portalStatusId).toBe('under-review');

  expect(fetchSpy).toHaveBeenCalled();
  expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/dbm_requests');
  expect(fetchSpy.mock.calls[0]?.[1]?.headers).toMatchObject({
    Authorization: 'Bearer token'
  });
  expect(String(fetchSpy.mock.calls[2]?.[0])).toContain('/dbm_requests(11111111-1111-1111-1111-111111111111)');
});
