import type { DbmEntityV1, DbmFieldV1, DbmModelV1 } from 'dbm-contract';
import type { DataverseSynthesisDiagnostic, DataverseSynthesisSeverity } from './types';

export const DEFAULT_GENERATED_METADATA_SOLUTION_NAME = 'DynamicsBusinessMachineGeneratedMetadata';
export const DEFAULT_GENERATED_METADATA_SOLUTION_PUBLISHER_UNIQUE_NAME = 'yagasoft';
export const DEFAULT_GENERATED_METADATA_SOLUTION_VERSION = '0.2.0.0';
export const DEFAULT_LOCALE_CODE = 1033;

export function createDiagnostic(
  code: string,
  severity: DataverseSynthesisSeverity,
  message: string,
  modelPath?: string | null
): DataverseSynthesisDiagnostic {
  return {
    code,
    severity,
    message,
    modelPath: modelPath ?? null
  };
}

export function getDataverseLogicalName(
  binding: { providerBindings?: { dataverse?: { logicalName?: string } } },
  fallbackLabel: string
): string {
  const logicalName = binding.providerBindings?.dataverse?.logicalName?.trim();
  if (!logicalName) {
    throw new Error(`Missing Dataverse logical name for ${fallbackLabel}.`);
  }

  return logicalName;
}

export function toSchemaName(logicalName: string): string {
  const segments = logicalName.split('_').filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return logicalName;
  }

  const [prefix, ...rest] = segments;
  const formattedTail = rest
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');

  return `${prefix}_${formattedTail}`;
}

export function toLogicalCollectionName(logicalName: string): string {
  return logicalName.endsWith('s') ? `${logicalName}es` : `${logicalName}s`;
}

export function toCollectionSchemaName(schemaName: string): string {
  return schemaName.endsWith('s') ? `${schemaName}es` : `${schemaName}s`;
}

export function buildLabel(value: string, languageCode = DEFAULT_LOCALE_CODE): Record<string, unknown> {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.Label',
    LocalizedLabels: [
      {
        '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
        Label: value,
        LanguageCode: languageCode,
        IsManaged: false
      }
    ],
    UserLocalizedLabel: {
      '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
      Label: value,
      LanguageCode: languageCode,
      IsManaged: false
    }
  };
}

export function buildRequiredLevel(required: boolean): Record<string, unknown> {
  return {
    Value: required ? 'ApplicationRequired' : 'None',
    CanBeChanged: false,
    ManagedPropertyLogicalName: 'canmodifyrequirementlevelsettings'
  };
}

export function getEntityById(model: DbmModelV1, entityId: string): DbmEntityV1 | undefined {
  return model.metadata.entities.find((entity) => entity.id === entityId);
}

export function getFieldById(entity: DbmEntityV1, fieldId: string): DbmFieldV1 | undefined {
  return entity.fields.find((field) => field.id === fieldId);
}

export function getPublisherPrefix(logicalName: string): string {
  const separatorIndex = logicalName.indexOf('_');
  if (separatorIndex <= 0) {
    return logicalName;
  }

  return logicalName.slice(0, separatorIndex);
}

export function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]/g, '_');
}
