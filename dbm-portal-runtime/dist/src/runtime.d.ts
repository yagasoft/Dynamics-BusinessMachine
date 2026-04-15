import type { DbmPortalRuntimeBootstrapV1 } from 'dbm-contract';
import { type DbmProcessExperienceRuntimeModelV1 } from 'dbm-process-experience';
import type { DbmPortalRuntimeRecordV1, DbmPortalRuntimeViewModel, DbmPortalRuntimeViewModelOptions } from './types';
export declare function buildPortalRuntimeSnapshot(bootstrap: DbmPortalRuntimeBootstrapV1, runtimeModel: DbmProcessExperienceRuntimeModelV1, record: DbmPortalRuntimeRecordV1 | null): import("dbm-contract").DbmProcessExperienceSnapshotV1 | null;
export declare function buildPortalRuntimeViewModel(options: DbmPortalRuntimeViewModelOptions): DbmPortalRuntimeViewModel;
