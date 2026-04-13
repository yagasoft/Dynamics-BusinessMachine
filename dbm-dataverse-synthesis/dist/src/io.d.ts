import type { DbmModelV1 } from 'dbm-contract';
export declare function loadModelFromFile(filePath: string): Promise<DbmModelV1>;
export declare function writeJsonFile(filePath: string, payload: unknown): Promise<void>;
export declare function getGeneratedMetadataTemplateRoot(repoRoot: string): string;
