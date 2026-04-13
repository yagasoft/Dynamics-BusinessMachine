import { createHash } from 'node:crypto';
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

export function createDeterministicGuid(seed: string): string {
  const hash = createHash('sha1').update(seed).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  const parts = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ];

  return `{${parts.join('-')}}`;
}

export function normalizeXmlContent(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/^\uFEFF/, '')
    .replace(/<\?xml[^>]*\?>\s*/i, '')
    .replace(/>\s+</g, '><')
    .trim();
}

export function normalizeTextContent(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim();
}

export function tryDecodeBase64Utf8(value: string): string {
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    const reencoded = Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/g, '');
    const normalizedInput = value.replace(/\s+/g, '').replace(/=+$/g, '');
    if (reencoded === normalizedInput) {
      return decoded;
    }
  } catch {
    // Fall through to raw value.
  }

  return value;
}

export function toDataverseWebResourceFileName(webResourceName: string, webResourceId: string): string {
  const normalizedName = webResourceName.replace(/[^A-Za-z0-9_]/g, '');
  const normalizedId = webResourceId.replace(/[{}-]/g, '').toUpperCase();
  return `${normalizedName}${normalizedId}`;
}
