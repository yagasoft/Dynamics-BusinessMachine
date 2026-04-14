import type { DbmModelV1 } from 'dbm-contract';
import type { DataverseBehaviorPlan, DataverseEntityPlan, DataverseFormPlan, DataverseSynthesisDiagnostic } from './types';
export declare const SHARED_FORM_RUNTIME_BEHAVIOR_ID = "dbm-shared-form-runtime";
export declare const SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME = "ys_/dbm/forms/runtime.js";
export declare const SHARED_PROCESS_EXPERIENCE_RENDERER_BEHAVIOR_ID = "dbm-process-experience-renderer";
export declare const SHARED_PROCESS_EXPERIENCE_RENDERER_WEB_RESOURCE_NAME = "ys_/dbm/process-experience/renderer.js";
export declare const SHARED_PROCESS_EXPERIENCE_HOST_PAGE_BEHAVIOR_ID = "dbm-process-experience-host-page";
export declare const SHARED_PROCESS_EXPERIENCE_HOST_PAGE_WEB_RESOURCE_NAME = "ys_/dbm/process-experience/host.html";
export declare const HTML_WEB_RESOURCE_CLASS_ID = "{9FDF5F91-88B1-47f4-AD53-C11EFC01A01D}";
export declare function planExistingDataverseForms(model: DbmModelV1, entityPlans: Map<string, DataverseEntityPlan>, diagnostics: DataverseSynthesisDiagnostic[]): {
    forms: DataverseFormPlan[];
    behaviors: DataverseBehaviorPlan[];
};
