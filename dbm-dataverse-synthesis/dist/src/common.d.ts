import type { DbmEntityV1, DbmFieldV1, DbmModelV1 } from 'dbm-contract';
import type { DataverseSynthesisDiagnostic, DataverseSynthesisSeverity } from './types';
export declare const DEFAULT_GENERATED_METADATA_SOLUTION_NAME = "DynamicsBusinessMachineGeneratedMetadata";
export declare const DEFAULT_GENERATED_METADATA_SOLUTION_PUBLISHER_UNIQUE_NAME = "yagasoft";
export declare const DEFAULT_GENERATED_METADATA_SOLUTION_VERSION = "0.2.0.0";
export declare const DEFAULT_LOCALE_CODE = 1033;
export declare function createDiagnostic(code: string, severity: DataverseSynthesisSeverity, message: string, modelPath?: string | null): DataverseSynthesisDiagnostic;
export declare function getDataverseLogicalName(binding: {
    providerBindings?: {
        dataverse?: {
            logicalName?: string;
        };
    };
}, fallbackLabel: string): string;
export declare function toSchemaName(logicalName: string): string;
export declare function toLogicalCollectionName(logicalName: string): string;
export declare function toCollectionSchemaName(schemaName: string): string;
export declare function buildLabel(value: string, languageCode?: number): Record<string, unknown>;
export declare function buildRequiredLevel(required: boolean): Record<string, unknown>;
export declare function getEntityById(model: DbmModelV1, entityId: string): DbmEntityV1 | undefined;
export declare function getFieldById(entity: DbmEntityV1, fieldId: string): DbmFieldV1 | undefined;
export declare function getPublisherPrefix(logicalName: string): string;
export declare function sanitizeFileName(value: string): string;
