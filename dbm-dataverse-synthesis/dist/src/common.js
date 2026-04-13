"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LOCALE_CODE = exports.DEFAULT_GENERATED_METADATA_SOLUTION_VERSION = exports.DEFAULT_GENERATED_METADATA_SOLUTION_PUBLISHER_UNIQUE_NAME = exports.DEFAULT_GENERATED_METADATA_SOLUTION_NAME = void 0;
exports.createDiagnostic = createDiagnostic;
exports.getDataverseLogicalName = getDataverseLogicalName;
exports.toSchemaName = toSchemaName;
exports.toLogicalCollectionName = toLogicalCollectionName;
exports.toCollectionSchemaName = toCollectionSchemaName;
exports.buildLabel = buildLabel;
exports.buildRequiredLevel = buildRequiredLevel;
exports.getEntityById = getEntityById;
exports.getFieldById = getFieldById;
exports.getPublisherPrefix = getPublisherPrefix;
exports.sanitizeFileName = sanitizeFileName;
exports.DEFAULT_GENERATED_METADATA_SOLUTION_NAME = 'DynamicsBusinessMachineGeneratedMetadata';
exports.DEFAULT_GENERATED_METADATA_SOLUTION_PUBLISHER_UNIQUE_NAME = 'yagasoft';
exports.DEFAULT_GENERATED_METADATA_SOLUTION_VERSION = '0.2.0.0';
exports.DEFAULT_LOCALE_CODE = 1033;
function createDiagnostic(code, severity, message, modelPath) {
    return {
        code,
        severity,
        message,
        modelPath: modelPath ?? null
    };
}
function getDataverseLogicalName(binding, fallbackLabel) {
    const logicalName = binding.providerBindings?.dataverse?.logicalName?.trim();
    if (!logicalName) {
        throw new Error(`Missing Dataverse logical name for ${fallbackLabel}.`);
    }
    return logicalName;
}
function toSchemaName(logicalName) {
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
function toLogicalCollectionName(logicalName) {
    return logicalName.endsWith('s') ? `${logicalName}es` : `${logicalName}s`;
}
function toCollectionSchemaName(schemaName) {
    return schemaName.endsWith('s') ? `${schemaName}es` : `${schemaName}s`;
}
function buildLabel(value, languageCode = exports.DEFAULT_LOCALE_CODE) {
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
function buildRequiredLevel(required) {
    return {
        Value: required ? 'ApplicationRequired' : 'None',
        CanBeChanged: false,
        ManagedPropertyLogicalName: 'canmodifyrequirementlevelsettings'
    };
}
function getEntityById(model, entityId) {
    return model.metadata.entities.find((entity) => entity.id === entityId);
}
function getFieldById(entity, fieldId) {
    return entity.fields.find((field) => field.id === fieldId);
}
function getPublisherPrefix(logicalName) {
    const separatorIndex = logicalName.indexOf('_');
    if (separatorIndex <= 0) {
        return logicalName;
    }
    return logicalName.slice(0, separatorIndex);
}
function sanitizeFileName(value) {
    return value.replace(/[^A-Za-z0-9_.-]/g, '_');
}
