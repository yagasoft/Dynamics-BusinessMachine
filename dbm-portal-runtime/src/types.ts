import type { DbmPortalRuntimeBootstrapV1 } from 'dbm-contract';
import type {
  DbmProcessExperiencePortalShellStateV1,
  DbmProcessExperienceRuntimeModelV1,
  DbmProcessExperienceRuntimeStateV1
} from 'dbm-process-experience';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DbmPortalRuntimeSessionStateV1 {
  requestId: string;
  sessionKey: string;
  requestReference: string | null;
}

export interface DbmPortalRuntimeRecordV1 {
  id: string;
  values: Record<string, unknown>;
  runtimeState: DbmProcessExperienceRuntimeStateV1;
  requestReference: string | null;
}

export interface DbmPortalRuntimeFetchOptions {
  apiBasePath?: string;
  fetchImpl?: typeof fetch;
}

export interface DbmPortalRuntimeCreateDraftOptions extends DbmPortalRuntimeFetchOptions {
  values: Record<string, unknown>;
}

export interface DbmPortalRuntimeSubmitOptions extends DbmPortalRuntimeFetchOptions {
  requestId: string;
}

export interface DbmPortalRuntimeRefreshOptions extends DbmPortalRuntimeFetchOptions {
  requestId: string;
}

export interface DbmPortalRuntimeViewModelOptions {
  bootstrap: DbmPortalRuntimeBootstrapV1;
  runtimeModel: DbmProcessExperienceRuntimeModelV1;
  record: DbmPortalRuntimeRecordV1 | null;
  sameSessionEnabled?: boolean;
  isBusy?: boolean;
  canCreateDraft?: boolean;
}

export interface DbmPortalRuntimeAppProps {
  bootstrap: DbmPortalRuntimeBootstrapV1;
  runtimeModel: DbmProcessExperienceRuntimeModelV1;
  initialDraftValues?: Record<string, unknown>;
  initialRecord?: DbmPortalRuntimeRecordV1 | null;
  apiBasePath?: string;
  fetchImpl?: typeof fetch;
  storage?: StorageLike | null;
}

export interface DbmPortalRuntimeViewModel {
  portalShell: DbmProcessExperiencePortalShellStateV1;
}
