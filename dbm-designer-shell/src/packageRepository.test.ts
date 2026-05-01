import { afterEach, describe, expect, it } from 'vitest';
import type { DbmHostModelPackageRecord } from './hostBridge';
import {
  buildPackageResourceNames,
  createPackageRepository,
  createDraftPackageRecord,
  groupModelPackageResources,
  parsePackageNameFromResourceName
} from './packageRepository';

const originalGlobalBridge = globalThis.dbmHostBridge;
const originalWindowBridge = globalThis.window?.dbmHostBridge;

afterEach(() => {
  globalThis.dbmHostBridge = originalGlobalBridge;
  if (globalThis.window) {
    globalThis.window.dbmHostBridge = originalWindowBridge;
  }
});

describe('package repository helpers', () => {
  it('builds stable model and workspace resource names', () => {
    expect(buildPackageResourceNames('approval-request')).toEqual({
      modelName: 'ys_/dbm/data/models/approval-request.json',
      workspaceName: 'ys_/dbm/data/models/approval-request.workspace.json'
    });
  });

  it('parses canonical and workspace package names from resource names', () => {
    expect(parsePackageNameFromResourceName('ys_/dbm/data/models/approval-request.json')).toEqual({
      packageName: 'approval-request',
      isWorkspace: false
    });

    expect(parsePackageNameFromResourceName('ys_/dbm/data/models/approval-request.workspace.json')).toEqual({
      packageName: 'approval-request',
      isWorkspace: true
    });
  });

  it('groups canonical model resources with optional sidecars and ignores orphan workspaces', () => {
    const grouped = groupModelPackageResources([
      {
        id: 'model-1',
        name: 'ys_/dbm/data/models/approval-request.json',
        displayName: 'Approval Request',
        modifiedOn: '2026-04-14T10:00:00.000Z'
      },
      {
        id: 'workspace-1',
        name: 'ys_/dbm/data/models/approval-request.workspace.json',
        displayName: 'Approval Request Workspace',
        modifiedOn: '2026-04-14T11:00:00.000Z'
      },
      {
        id: 'workspace-orphan',
        name: 'ys_/dbm/data/models/orphan.workspace.json',
        displayName: 'Orphan Workspace',
        modifiedOn: '2026-04-14T09:00:00.000Z'
      }
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({
      packageName: 'approval-request',
      modelId: 'model-1',
      workspaceId: 'workspace-1',
      displayName: 'Approval Request',
      hasWorkspace: true,
      modifiedOn: '2026-04-14T11:00:00.000Z'
    });
  });

  it('creates draft records with both model and workspace payloads', () => {
    const draft = createDraftPackageRecord('20260414123045');

    expect(draft.packageName).toBe('dbm-model-20260414123045');
    expect(draft.modelName).toBe('ys_/dbm/data/models/dbm-model-20260414123045.json');
    expect(draft.workspaceName).toBe('ys_/dbm/data/models/dbm-model-20260414123045.workspace.json');
    expect(draft.modelContent).toContain('"schemaVersion": "dbm.model/v1"');
    expect(draft.workspaceContent).toContain('"schemaVersion": "dbm.designer.workspace/v1"');
  });

  it('delegates package persistence to a hosted designer bridge when one is available on window', async () => {
    const calls: string[] = [];
    const record: DbmHostModelPackageRecord = {
      modelId: 'model-id',
      workspaceId: 'workspace-id',
      packageName: 'approval-request',
      displayName: 'Approval Request',
      modelName: 'ys_/dbm/data/models/approval-request.json',
      workspaceName: 'ys_/dbm/data/models/approval-request.workspace.json',
      modifiedOn: '2026-04-15T08:00:00.000Z',
      hasWorkspace: true,
      modelContent: '{"schemaVersion":"dbm.model/v1"}',
      workspaceContent: '{"schemaVersion":"dbm.designer.workspace/v1"}'
    };

    globalThis.dbmHostBridge = undefined;
    globalThis.window.dbmHostBridge = {
      hostKind: 'xrmtoolbox',
      async listModelPackages() {
        calls.push('list');
        return [record];
      },
      async loadModelPackage(packageName) {
        calls.push(`load:${packageName}`);
        return record;
      },
      async saveModelPackage(savedRecord) {
        calls.push(`save:${savedRecord.packageName}`);
        return {
          ...savedRecord,
          modelId: 'saved-model-id',
          workspaceId: 'saved-workspace-id'
        };
      },
      async deleteModelPackage(deletedRecord) {
        calls.push(`delete:${deletedRecord.packageName}`);
      }
    };

    const repository = createPackageRepository();

    await expect(repository.listPackages()).resolves.toEqual([record]);
    await expect(repository.loadPackage('approval-request')).resolves.toEqual(record);
    await expect(repository.savePackage(record)).resolves.toMatchObject({
      packageName: 'approval-request',
      modelId: 'saved-model-id',
      workspaceId: 'saved-workspace-id'
    });
    await expect(repository.deletePackage(record)).resolves.toBeUndefined();
    expect(repository.kind).toBe('xrmtoolbox');
    expect(calls).toEqual(['list', 'load:approval-request', 'save:approval-request', 'delete:approval-request']);
  });
});
