import type { DbmModelV1 } from 'dbm-contract';
import type { DataverseBehaviorPlan, DataverseEntityPlan, DataverseFormPlan, DataverseSynthesisDiagnostic } from './types';
export declare const SHARED_FORM_RUNTIME_BEHAVIOR_ID = "dbm-shared-form-runtime";
export declare const SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME = "ys_/dbm/forms/runtime.js";
export declare function planExistingDataverseForms(model: DbmModelV1, entityPlans: Map<string, DataverseEntityPlan>, diagnostics: DataverseSynthesisDiagnostic[]): {
    forms: DataverseFormPlan[];
    behaviors: DataverseBehaviorPlan[];
};
