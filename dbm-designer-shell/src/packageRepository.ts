import type { DbmDesignerWorkspaceV1, DbmModelV1 } from 'dbm-contract';
import { createApprovalRequestTemplate, createDefaultWorkspace } from 'dbm-designer-core';
import type { DbmHostModelPackageRecord, DbmHostModelPackageSummary } from './hostBridge';
import { getDbmHostBridge } from './hostBridge';
import { decodeUtf8Base64, encodeUtf8Base64 } from './utf8Base64';

export const MODEL_ROOT = 'ys_/dbm/data/models/';
const MODEL_SUFFIX = '.json';
const WORKSPACE_SUFFIX = '.workspace.json';
const INDEXED_DB_NAME = 'dbmModelPackages';
const INDEXED_DB_STORE = 'packages';

interface DataverseWebResourceRecord {
  webresourceid?: string;
  name: string;
  displayname?: string | null;
  modifiedon?: string | null;
  content?: string | null;
}

interface PackageResourceDescriptor {
  id?: string | null;
  name: string;
  displayName?: string | null;
  modifiedOn?: string | null;
  content?: string | null;
}

export interface DbmPackageRepository {
  kind: 'xrmtoolbox' | 'model-driven' | 'browser';
  listPackages(): Promise<DbmHostModelPackageSummary[]>;
  loadPackage(packageName: string): Promise<DbmHostModelPackageRecord | null>;
  savePackage(record: DbmHostModelPackageRecord): Promise<DbmHostModelPackageRecord>;
  deletePackage(record: { packageName: string; modelId?: string | null; workspaceId?: string | null }): Promise<void>;
}

export function buildPackageResourceNames(packageName: string): { modelName: string; workspaceName: string } {
  return {
    modelName: `${MODEL_ROOT}${packageName}${MODEL_SUFFIX}`,
    workspaceName: `${MODEL_ROOT}${packageName}${WORKSPACE_SUFFIX}`
  };
}

export function parsePackageNameFromResourceName(resourceName: string): { packageName: string; isWorkspace: boolean } | null {
  if (!resourceName.startsWith(MODEL_ROOT)) {
    return null;
  }

  const suffix = resourceName.slice(MODEL_ROOT.length);
  if (suffix.endsWith(WORKSPACE_SUFFIX)) {
    return {
      packageName: suffix.slice(0, -WORKSPACE_SUFFIX.length),
      isWorkspace: true
    };
  }

  if (suffix.endsWith(MODEL_SUFFIX)) {
    return {
      packageName: suffix.slice(0, -MODEL_SUFFIX.length),
      isWorkspace: false
    };
  }

  return null;
}

export function groupModelPackageResources(resources: PackageResourceDescriptor[]): DbmHostModelPackageSummary[] {
  const grouped = new Map<
    string,
    {
      model?: PackageResourceDescriptor;
      workspace?: PackageResourceDescriptor;
    }
  >();

  for (const resource of resources) {
    const parsed = parsePackageNameFromResourceName(resource.name);
    if (!parsed) {
      continue;
    }

    const current = grouped.get(parsed.packageName) ?? {};
    if (parsed.isWorkspace) {
      current.workspace = resource;
    } else {
      current.model = resource;
    }

    grouped.set(parsed.packageName, current);
  }

  return [...grouped.entries()]
    .filter(([, group]) => !!group.model)
    .map(([packageName, group]) => {
      const { modelName, workspaceName } = buildPackageResourceNames(packageName);
      const model = group.model!;
      const workspace = group.workspace;

      return {
        modelId: model.id ?? null,
        workspaceId: workspace?.id ?? null,
        packageName,
        displayName: model.displayName ?? toFallbackDisplayName(packageName),
        modelName,
        workspaceName,
        modifiedOn: latestModifiedOn(model.modifiedOn, workspace?.modifiedOn),
        hasWorkspace: !!workspace
      };
    })
    .sort((left, right) => (left.displayName ?? left.packageName).localeCompare(right.displayName ?? right.packageName));
}

export function createDraftPackageRecord(seed?: string): DbmHostModelPackageRecord {
  const stamp = seed ?? new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const packageName = `dbm-model-${stamp}`;
  const model = createApprovalRequestTemplate();
  const displayName = `DBM Model ${stamp}`;

  model.package.id = packageName;
  model.package.displayName = displayName;
  model.package.deployment.solutionName = displayName;
  model.package.deployment.artifactRoot = `artifacts/${packageName}`;

  const workspace = createDefaultWorkspace(model);
  const { modelName, workspaceName } = buildPackageResourceNames(packageName);

  return {
    modelId: null,
    workspaceId: null,
    packageName,
    displayName,
    modelName,
    workspaceName,
    modifiedOn: null,
    hasWorkspace: true,
    modelContent: JSON.stringify(model, null, 2),
    workspaceContent: JSON.stringify(workspace, null, 2)
  };
}

export function createNormalizedModelPackage(model: DbmModelV1, workspace?: DbmDesignerWorkspaceV1 | null): DbmHostModelPackageRecord {
  const normalizedWorkspace = workspace ?? createDefaultWorkspace(model);
  const { modelName, workspaceName } = buildPackageResourceNames(model.package.id);

  return {
    modelId: null,
    workspaceId: null,
    packageName: model.package.id,
    displayName: model.package.displayName,
    modelName,
    workspaceName,
    modifiedOn: null,
    hasWorkspace: true,
    modelContent: JSON.stringify(model, null, 2),
    workspaceContent: JSON.stringify(normalizedWorkspace, null, 2)
  };
}

export function createPackageRepository(): DbmPackageRepository {
  const hostBridge = getDbmHostBridge();
  if (hostBridge) {
    return {
      kind: 'xrmtoolbox',
      listPackages: () => hostBridge.listModelPackages(),
      loadPackage: (packageName) => hostBridge.loadModelPackage(packageName),
      savePackage: (record) => hostBridge.saveModelPackage(record),
      deletePackage: (record) => hostBridge.deleteModelPackage(record)
    };
  }

  if (getDataverseClientUrl()) {
    return createDataverseRepository();
  }

  return createIndexedDbRepository();
}

function latestModifiedOn(left?: string | null, right?: string | null): string | null {
  if (!left) {
    return right ?? null;
  }

  if (!right) {
    return left;
  }

  const leftDate = Date.parse(left);
  const rightDate = Date.parse(right);
  if (!Number.isNaN(leftDate) && !Number.isNaN(rightDate)) {
    return leftDate >= rightDate ? left : right;
  }

  return left;
}

function toFallbackDisplayName(packageName: string): string {
  return packageName;
}

function getDataverseClientUrl(): string | null {
  const candidateWindows = [globalThis.window, globalThis.window?.parent].filter(Boolean) as Window[];
  for (const candidate of candidateWindows) {
    try {
      const xrm = candidate.Xrm as { Utility?: { getGlobalContext?: () => { getClientUrl: () => string } } } | undefined;
      const clientUrl = xrm?.Utility?.getGlobalContext?.().getClientUrl();
      if (clientUrl) {
        return clientUrl.replace(/\/$/, '');
      }
    } catch {
      // Ignore cross-frame access issues and continue.
    }
  }

  return null;
}

function buildDataverseHeaders(extraHeaders: Array<[string, string]> = []): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json; charset=utf-8',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0',
    ...Object.fromEntries(extraHeaders)
  };
}

async function requestDataverseJson<T>(path: string, init?: RequestInit): Promise<T> {
  const clientUrl = getDataverseClientUrl();
  if (!clientUrl) {
    throw new Error('Dataverse client URL is unavailable for the model-driven host.');
  }

  const response = await fetch(`${clientUrl}${path}`, init);
  if (!response.ok) {
    throw new Error(`Dataverse request failed with ${response.status}: ${path}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

async function queryDataverseResources(filter: string, select: string): Promise<DataverseWebResourceRecord[]> {
  const payload = await requestDataverseJson<{ value?: DataverseWebResourceRecord[] }>(
    `/api/data/v9.1/webresourceset/Microsoft.Dynamics.CRM.RetrieveUnpublishedMultiple()?$select=${select}&$filter=${encodeURIComponent(filter)}`,
    {
      headers: buildDataverseHeaders()
    }
  );

  return payload.value ?? [];
}

async function findDataverseResourceByName(name: string, includeContent = false): Promise<DataverseWebResourceRecord | null> {
  const select = includeContent ? 'displayname,name,webresourceid,modifiedon,content' : 'displayname,name,webresourceid,modifiedon';
  const resources = await queryDataverseResources(`name eq '${name}'`, select);
  return resources[0] ?? null;
}

async function publishDataverseWebResource(webResourceId: string): Promise<void> {
  await requestDataverseJson(
    '/api/data/v9.1/PublishXml',
    {
      method: 'POST',
      headers: buildDataverseHeaders(),
      body: JSON.stringify({
        ParameterXml: `<importexportxml><webresources><webresource>{${webResourceId}}</webresource></webresources></importexportxml>`
      })
    }
  );
}

async function saveDataverseResource(options: {
  id?: string | null;
  name: string;
  displayName: string;
  content: string;
}): Promise<DataverseWebResourceRecord> {
  const existingId = options.id ?? (await findDataverseResourceByName(options.name, false))?.webresourceid ?? null;
  const path = existingId
    ? `/api/data/v9.1/webresourceset(${existingId})?$select=webresourceid,name,displayname,modifiedon,content`
    : '/api/data/v9.1/webresourceset?$select=webresourceid,name,displayname,modifiedon,content';

  await requestDataverseJson(
    path,
    {
      method: existingId ? 'PATCH' : 'POST',
      headers: buildDataverseHeaders([['Prefer', 'return=representation']]),
      body: JSON.stringify({
        name: options.name,
        displayname: options.displayName,
        content: encodeUtf8Base64(options.content),
        webresourcetype: 3
      })
    }
  );

  const saved = await findDataverseResourceByName(options.name, true);
  if (!saved?.webresourceid) {
    throw new Error(`Failed to reload Dataverse web resource '${options.name}' after save.`);
  }

  await publishDataverseWebResource(saved.webresourceid);
  return saved;
}

function mapDataverseResource(resource: DataverseWebResourceRecord): PackageResourceDescriptor {
  return {
    id: resource.webresourceid ?? null,
    name: resource.name,
    displayName: resource.displayname ?? null,
    modifiedOn: resource.modifiedon ?? null,
    content: resource.content ? decodeUtf8Base64(resource.content) : null
  };
}

function createDataverseRepository(): DbmPackageRepository {
  return {
    kind: 'model-driven',
    async listPackages() {
      const resources = await queryDataverseResources(`startswith(name,'${MODEL_ROOT}')`, 'displayname,name,webresourceid,modifiedon');
      return groupModelPackageResources(resources.map(mapDataverseResource));
    },
    async loadPackage(packageName) {
      const { modelName, workspaceName } = buildPackageResourceNames(packageName);
      const resources = await queryDataverseResources(
        `name eq '${modelName}' or name eq '${workspaceName}'`,
        'displayname,name,webresourceid,modifiedon,content'
      );

      const mappedResources = resources.map(mapDataverseResource);
      const summary = groupModelPackageResources(mappedResources).find((entry) => entry.packageName === packageName) ?? null;
      const model = mappedResources.find((entry) => entry.name === modelName);
      if (!summary || !model?.content) {
        return null;
      }

      const workspace = mappedResources.find((entry) => entry.name === workspaceName);
      return {
        ...summary,
        modelContent: model.content,
        workspaceContent: workspace?.content ?? null
      };
    },
    async savePackage(record) {
      const model = await saveDataverseResource({
        id: record.modelId,
        name: record.modelName,
        displayName: record.displayName ?? record.packageName,
        content: record.modelContent
      });
      const workspace = await saveDataverseResource({
        id: record.workspaceId,
        name: record.workspaceName,
        displayName: `${record.displayName ?? record.packageName} Workspace`,
        content: record.workspaceContent ?? '{}'
      });

      return {
        modelId: model.webresourceid ?? null,
        workspaceId: workspace.webresourceid ?? null,
        packageName: record.packageName,
        displayName: model.displayname ?? record.displayName ?? record.packageName,
        modelName: record.modelName,
        workspaceName: record.workspaceName,
        modifiedOn: latestModifiedOn(model.modifiedon, workspace.modifiedon),
        hasWorkspace: true,
        modelContent: record.modelContent,
        workspaceContent: record.workspaceContent ?? '{}'
      };
    },
    async deletePackage(record) {
      const { modelName, workspaceName } = buildPackageResourceNames(record.packageName);
      const resources = await queryDataverseResources(
        `name eq '${modelName}' or name eq '${workspaceName}'`,
        'webresourceid,name'
      );

      const candidateIds = resources
        .map((resource) => resource.webresourceid)
        .filter((entry): entry is string => !!entry);

      for (const id of candidateIds) {
        await requestDataverseJson(
          `/api/data/v9.1/webresourceset(${id})`,
          {
            method: 'DELETE',
            headers: buildDataverseHeaders()
          }
        );
      }
    }
  };
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(INDEXED_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(INDEXED_DB_STORE)) {
        database.createObjectStore(INDEXED_DB_STORE, { keyPath: 'packageName' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withObjectStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const database = await openIndexedDb();
  const transaction = database.transaction(INDEXED_DB_STORE, mode);
  const store = transaction.objectStore(INDEXED_DB_STORE);

  try {
    const result = await action(store);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    return result;
  } finally {
    database.close();
  }
}

function createIndexedDbRepository(): DbmPackageRepository {
  return {
    kind: 'browser',
    async listPackages() {
      return withObjectStore('readonly', async (store) => {
        const packages = await new Promise<DbmHostModelPackageRecord[]>((resolve) => {
          const request = store.getAll();
          request.onsuccess = () => resolve((request.result ?? []) as DbmHostModelPackageRecord[]);
          request.onerror = () => resolve([]);
        });

        return packages
          .map((entry) => ({
            ...entry,
            displayName: entry.displayName ?? toFallbackDisplayName(entry.packageName),
            hasWorkspace: !!entry.workspaceContent
          }))
          .sort((left, right) => (left.displayName ?? left.packageName).localeCompare(right.displayName ?? right.packageName));
      });
    },
    async loadPackage(packageName) {
      return withObjectStore('readonly', async (store) => {
        return new Promise<DbmHostModelPackageRecord | null>((resolve) => {
          const request = store.get(packageName);
          request.onsuccess = () => resolve((request.result as DbmHostModelPackageRecord | undefined) ?? null);
          request.onerror = () => resolve(null);
        });
      });
    },
    async savePackage(record) {
      const modifiedOn = new Date().toISOString();
      const persistedRecord: DbmHostModelPackageRecord = {
        ...record,
        modifiedOn,
        hasWorkspace: !!record.workspaceContent
      };

      return withObjectStore('readwrite', async (store) => {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(persistedRecord);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        return persistedRecord;
      });
    },
    async deletePackage(record) {
      await withObjectStore('readwrite', async (store) => {
        await new Promise<void>((resolve, reject) => {
          const request = store.delete(record.packageName);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        return undefined;
      });
    }
  };
}
