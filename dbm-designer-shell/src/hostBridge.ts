export interface DbmHostModelPackageSummary {
  modelId?: string | null;
  workspaceId?: string | null;
  packageName: string;
  displayName?: string | null;
  modelName: string;
  workspaceName: string;
  modifiedOn?: string | null;
  hasWorkspace: boolean;
}

export interface DbmHostModelPackageRecord extends DbmHostModelPackageSummary {
  modelContent: string;
  workspaceContent: string | null;
}

export interface DbmHostBridge {
  hostKind: 'xrmtoolbox' | string;
  listModelPackages(): Promise<DbmHostModelPackageSummary[]>;
  loadModelPackage(packageName: string): Promise<DbmHostModelPackageRecord | null>;
  saveModelPackage(record: DbmHostModelPackageRecord): Promise<DbmHostModelPackageRecord>;
  deleteModelPackage(record: { packageName: string; modelId?: string | null; workspaceId?: string | null }): Promise<void>;
}

declare global {
  interface Window {
    dbmHostBridge?: DbmHostBridge;
    Xrm?: unknown;
  }

  // eslint-disable-next-line no-var
  var dbmHostBridge: DbmHostBridge | undefined;
}

export function getDbmHostBridge(): DbmHostBridge | null {
  return globalThis.dbmHostBridge ?? globalThis.window?.dbmHostBridge ?? null;
}
