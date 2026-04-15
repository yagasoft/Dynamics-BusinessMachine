import type { DbmPortalRuntimeCreateDraftOptions, DbmPortalRuntimeRecordV1, DbmPortalRuntimeRefreshOptions, DbmPortalRuntimeSubmitOptions } from './types';
export declare function refreshPortalRuntimeRecord(options: DbmPortalRuntimeRefreshOptions): Promise<DbmPortalRuntimeRecordV1>;
export declare function createPortalRuntimeDraft(options: DbmPortalRuntimeCreateDraftOptions): Promise<DbmPortalRuntimeRecordV1>;
export declare function submitPortalRuntimeRequest(options: DbmPortalRuntimeSubmitOptions): Promise<void>;
