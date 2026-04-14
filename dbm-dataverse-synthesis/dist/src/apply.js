"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySynthesisPlanToDev = applySynthesisPlanToDev;
const common_1 = require("./common");
const readback_1 = require("./readback");
function dataverseHeaders(accessToken, solutionName) {
    const headers = {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0'
    };
    if (solutionName) {
        headers['MSCRM.SolutionUniqueName'] = solutionName;
    }
    return headers;
}
async function dataverseRequest(dataverseUrl, accessToken, method, relativePath, body, solutionName) {
    const response = await fetch(`${dataverseUrl.replace(/\/$/, '')}/api/data/v9.2/${relativePath}`, {
        method,
        headers: dataverseHeaders(accessToken, solutionName),
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    let payload = null;
    if (text.length > 0) {
        try {
            payload = JSON.parse(text);
        }
        catch {
            payload = { raw: text };
        }
    }
    return {
        ok: response.ok,
        status: response.status,
        payload
    };
}
function escapeForRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function replaceXmlNode(xml, nodeName, replacement) {
    const fullNodePattern = new RegExp(`<${nodeName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${nodeName}>`, 'i');
    if (fullNodePattern.test(xml)) {
        return xml.replace(fullNodePattern, replacement);
    }
    const selfClosingPattern = new RegExp(`<${nodeName}(?:\\s[^>]*)?\\s*/>`, 'i');
    if (selfClosingPattern.test(xml)) {
        return xml.replace(selfClosingPattern, replacement);
    }
    return xml.replace(/<\/form>/i, `${replacement}\n    </form>`);
}
function buildProcessHostSectionXml(formPlan) {
    const processHost = formPlan.processHost?.supported;
    if (!processHost) {
        return '';
    }
    return [
        `                <section name="${processHost.sectionName}" id="${processHost.sectionId}" IsUserDefined="1" showlabel="false" showbar="false" columns="1">`,
        '                  <labels>',
        `                    <label description="${processHost.label}" languagecode="1033" />`,
        '                  </labels>',
        '                  <rows>',
        '                    <row>',
        `                      <cell id="${processHost.cellId}" showlabel="false" rowspan="4">`,
        '                        <labels>',
        `                          <label description="${processHost.label}" languagecode="1033" />`,
        '                        </labels>',
        `                        <control id="${processHost.controlName}" classid="{9FDF5F91-88B1-47f4-AD53-C11EFC01A01D}">`,
        '                          <parameters>',
        `                            <Url>${processHost.webResourceName}</Url>`,
        `                            <Data>${encodeURIComponent(processHost.data)}</Data>`,
        '                            <PassParameters>false</PassParameters>',
        '                            <ShowOnMobileClient>false</ShowOnMobileClient>',
        '                            <Security>false</Security>',
        '                            <Scrolling>auto</Scrolling>',
        '                            <Border>false</Border>',
        `                            <WebResourceId>${processHost.webResourceId}</WebResourceId>`,
        '                          </parameters>',
        '                        </control>',
        '                      </cell>',
        '                    </row>',
        '                    <row />',
        '                    <row />',
        '                    <row />',
        '                  </rows>',
        '                </section>'
    ].join('\n');
}
function insertProcessHostSection(xml, formPlan) {
    const processHost = formPlan.processHost?.supported;
    if (!processHost) {
        return xml;
    }
    if (new RegExp(`<section\\b[^>]*name="${escapeForRegex(processHost.sectionName)}"`, 'i').test(xml)) {
        return xml;
    }
    const sectionXml = buildProcessHostSectionXml(formPlan);
    if (!sectionXml) {
        return xml;
    }
    const sectionsPattern = new RegExp(`(<tab\\b[^>]*name="${escapeForRegex(processHost.tabName)}"[^>]*>[\\s\\S]*?<columns>\\s*<column[^>]*>\\s*<sections>)`, 'i');
    if (sectionsPattern.test(xml)) {
        return xml.replace(sectionsPattern, `$1\n${sectionXml}`);
    }
    // Existing Dataverse main forms do not always persist `name` attributes on tabs.
    // In that case we still want the supported host at the top of the first business tab.
    const firstSectionsPattern = /(<tabs>\s*<tab\b[\s\S]*?<columns>\s*<column[^>]*>\s*<sections>)/i;
    if (firstSectionsPattern.test(xml)) {
        return xml.replace(firstSectionsPattern, `$1\n${sectionXml}`);
    }
    return xml;
}
function patchFormXml(formXml, formPlan) {
    let patchedXml = formXml.replace(/\r\n/g, '\n');
    patchedXml = insertProcessHostSection(patchedXml, formPlan);
    patchedXml = replaceXmlNode(patchedXml, 'formLibraries', formPlan.managedFormLibrariesXml);
    patchedXml = replaceXmlNode(patchedXml, 'events', formPlan.managedEventsXml);
    return patchedXml.endsWith('\n') ? patchedXml : `${patchedXml}\n`;
}
function encodeUtf8Base64(value) {
    return Buffer.from(value, 'utf8').toString('base64');
}
function decodeUtf8Base64(value) {
    if (!value) {
        return '';
    }
    return Buffer.from(value, 'base64').toString('utf8');
}
function getDataverseErrorMessage(result, fallback) {
    const nestedMessage = result.payload?.error?.message ??
        result.payload?.Message ??
        result.payload?.message ??
        result.payload?.raw;
    if (typeof nestedMessage === 'string' && nestedMessage.trim().length > 0) {
        return `${fallback} (${nestedMessage.trim()})`;
    }
    return fallback;
}
function buildOptionLabel(optionLabel, languageCode) {
    return {
        Value: optionLabel === 'Yes' ? 1 : 0,
        Label: (0, common_1.buildLabel)(optionLabel, languageCode),
        Description: (0, common_1.buildLabel)(optionLabel, languageCode)
    };
}
function buildAttributeBody(column, languageCode) {
    const common = {
        Description: (0, common_1.buildLabel)(column.displayName, languageCode),
        DisplayName: (0, common_1.buildLabel)(column.displayName, languageCode),
        RequiredLevel: (0, common_1.buildRequiredLevel)(column.required),
        SchemaName: column.schemaName
    };
    switch (column.attributeType) {
        case 'String':
            return {
                '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
                AttributeType: 'String',
                AttributeTypeName: { Value: 'StringType' },
                FormatName: { Value: 'Text' },
                MaxLength: column.maxLength ?? 200,
                ...common,
                ...(column.isPrimaryNameAttribute ? { IsPrimaryName: true } : {})
            };
        case 'Memo':
            return {
                '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
                AttributeType: 'Memo',
                AttributeTypeName: { Value: 'MemoType' },
                Format: 'TextArea',
                ImeMode: 'Disabled',
                IsLocalizable: false,
                MaxLength: column.maxLength ?? 2000,
                ...common
            };
        case 'Money':
            return {
                '@odata.type': 'Microsoft.Dynamics.CRM.MoneyAttributeMetadata',
                AttributeType: 'Money',
                AttributeTypeName: { Value: 'MoneyType' },
                ImeMode: 'Disabled',
                MaxValue: 1000000000.0,
                MinValue: 0.0,
                Precision: column.precision ?? 2,
                PrecisionSource: 1,
                SourceTypeMask: 0,
                IsBaseCurrency: false,
                ...common
            };
        case 'Integer':
            return {
                '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
                AttributeType: 'Integer',
                AttributeTypeName: { Value: 'IntegerType' },
                MaxValue: 2147483647,
                MinValue: -2147483648,
                Format: 'None',
                SourceTypeMask: 0,
                ...common
            };
        case 'Decimal':
            return {
                '@odata.type': 'Microsoft.Dynamics.CRM.DecimalAttributeMetadata',
                AttributeType: 'Decimal',
                AttributeTypeName: { Value: 'DecimalType' },
                MaxValue: 1000000000,
                MinValue: -1000000000,
                Precision: column.precision ?? 2,
                ...common
            };
        case 'Boolean':
            return {
                '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
                AttributeType: 'Boolean',
                AttributeTypeName: { Value: 'BooleanType' },
                OptionSet: {
                    '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
                    FalseOption: buildOptionLabel('No', languageCode),
                    TrueOption: buildOptionLabel('Yes', languageCode),
                    OptionSetType: 'Boolean'
                },
                ...common
            };
        case 'Picklist':
            return {
                '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
                AttributeType: 'Picklist',
                AttributeTypeName: { Value: 'PicklistType' },
                SourceTypeMask: 0,
                OptionSet: {
                    '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
                    Options: (column.choiceOptions ?? []).map((option) => ({
                        Value: option.value,
                        Label: (0, common_1.buildLabel)(option.displayName, languageCode)
                    })),
                    IsGlobal: false,
                    OptionSetType: 'Picklist'
                },
                ...common
            };
        case 'Lookup':
            return {
                '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata',
                AttributeType: 'Lookup',
                AttributeTypeName: { Value: 'LookupType' },
                Targets: column.lookupTargetLogicalName ? [column.lookupTargetLogicalName] : [],
                ...common
            };
        case 'DateTime':
            return {
                '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
                AttributeType: 'DateTime',
                AttributeTypeName: { Value: 'DateTimeType' },
                Format: column.dateTimeFormat ?? 'DateOnly',
                DateTimeBehavior: {
                    Value: column.dateTimeFormat ?? 'DateOnly'
                },
                ImeMode: 'Disabled',
                ...common
            };
        default:
            throw new Error(`Unsupported Dataverse attribute type '${column.attributeType}'.`);
    }
}
function buildEntityBody(entity, languageCode) {
    const primaryNameColumn = entity.columns.find((column) => column.isPrimaryNameAttribute);
    if (!primaryNameColumn) {
        throw new Error(`Entity '${entity.logicalName}' does not define a primary name attribute.`);
    }
    return {
        '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
        SchemaName: entity.schemaName,
        LogicalName: entity.logicalName,
        LogicalCollectionName: entity.logicalCollectionName,
        CollectionSchemaName: entity.collectionSchemaName,
        PrimaryNameAttribute: primaryNameColumn.logicalName,
        DisplayName: (0, common_1.buildLabel)(entity.displayName, languageCode),
        DisplayCollectionName: (0, common_1.buildLabel)(`${entity.displayName}s`, languageCode),
        Description: (0, common_1.buildLabel)(`${entity.displayName} generated by DBM synthesis.`, languageCode),
        OwnershipType: 'UserOwned',
        IsActivity: false,
        HasActivities: false,
        HasNotes: true,
        Attributes: [buildAttributeBody(primaryNameColumn, languageCode)]
    };
}
function buildRelationshipBody(relationship, referencedEntity, referencingEntity, lookupColumn, languageCode) {
    return {
        '@odata.type': 'Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata',
        SchemaName: relationship.schemaName,
        ReferencedAttribute: referencedEntity.primaryIdLogicalName,
        ReferencedEntity: relationship.referencedEntityLogicalName,
        ReferencingEntity: relationship.referencingEntityLogicalName,
        AssociatedMenuConfiguration: {
            Behavior: 'UseCollectionName',
            Group: 'Details',
            Label: (0, common_1.buildLabel)(`${referencedEntity.displayName}s`, languageCode),
            Order: 10000
        },
        CascadeConfiguration: {
            Assign: 'NoCascade',
            Delete: 'RemoveLink',
            Merge: 'NoCascade',
            Reparent: 'NoCascade',
            Share: 'NoCascade',
            Unshare: 'NoCascade',
            RollupView: 'NoCascade'
        },
        IsHierarchical: false,
        IsCustomRelationship: true,
        IsManaged: false,
        IsValidForAdvancedFind: true,
        RelationshipType: 'OneToManyRelationship',
        SecurityTypes: 'Append',
        Lookup: {
            ...buildAttributeBody(lookupColumn, languageCode),
            '@odata.type': 'Microsoft.Dynamics.CRM.LookupAttributeMetadata'
        }
    };
}
async function tryGetExistingPublisher(environmentConfig, accessToken, publisherUniqueName) {
    const filter = encodeURIComponent(`uniquename eq '${publisherUniqueName.replace(/'/g, "''")}'`);
    const result = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'GET', `publishers?$select=publisherid,uniquename&$filter=${filter}`);
    if (!result.ok) {
        throw new Error(getDataverseErrorMessage(result, `Failed to query Dataverse publisher '${publisherUniqueName}'.`));
    }
    const publisher = Array.isArray(result.payload?.value) ? result.payload.value[0] : null;
    if (!publisher?.publisherid || !publisher?.uniquename) {
        return null;
    }
    return {
        publisherid: String(publisher.publisherid),
        uniquename: String(publisher.uniquename)
    };
}
async function ensureGeneratedMetadataSolution(plan, environmentConfig, accessToken, actions) {
    const filter = encodeURIComponent(`uniquename eq '${plan.generatedMetadataSolutionName.replace(/'/g, "''")}'`);
    const existing = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'GET', `solutions?$select=solutionid,uniquename,version&$filter=${filter}`);
    if (!existing.ok) {
        throw new Error(getDataverseErrorMessage(existing, `Failed to query Dataverse solution '${plan.generatedMetadataSolutionName}'.`));
    }
    const existingSolution = Array.isArray(existing.payload?.value) ? existing.payload.value[0] : null;
    if (existingSolution?.solutionid) {
        actions.push({
            componentType: 'solution',
            logicalName: plan.generatedMetadataSolutionName,
            state: 'skipped',
            message: `Generated metadata solution '${plan.generatedMetadataSolutionName}' already exists in Dataverse.`
        });
        return;
    }
    const publisher = await tryGetExistingPublisher(environmentConfig, accessToken, common_1.DEFAULT_GENERATED_METADATA_SOLUTION_PUBLISHER_UNIQUE_NAME);
    if (!publisher) {
        throw new Error(`Dataverse publisher '${common_1.DEFAULT_GENERATED_METADATA_SOLUTION_PUBLISHER_UNIQUE_NAME}' was not found. Bootstrap the core solution first.`);
    }
    const createResult = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'POST', 'solutions', {
        friendlyname: plan.generatedMetadataSolutionName,
        uniquename: plan.generatedMetadataSolutionName,
        description: 'Generated metadata solution created by the DBM Dataverse synthesis pipeline.',
        version: common_1.DEFAULT_GENERATED_METADATA_SOLUTION_VERSION,
        'publisherid@odata.bind': `publishers(${publisher.publisherid})`
    });
    if (!createResult.ok) {
        throw new Error(getDataverseErrorMessage(createResult, `Failed to create Dataverse solution '${plan.generatedMetadataSolutionName}'.`));
    }
    actions.push({
        componentType: 'solution',
        logicalName: plan.generatedMetadataSolutionName,
        state: 'created',
        message: `Created generated metadata solution '${plan.generatedMetadataSolutionName}' in Dataverse.`
    });
}
async function ensureEntity(entity, environmentConfig, accessToken, solutionName, actions, languageCode) {
    const existing = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'GET', `EntityDefinitions(LogicalName='${entity.logicalName}')?$select=LogicalName`);
    if (existing.ok) {
        actions.push({
            componentType: 'entity',
            logicalName: entity.logicalName,
            state: 'skipped',
            message: `Entity '${entity.logicalName}' already exists in Dataverse.`
        });
        return;
    }
    if (existing.status !== 404) {
        throw new Error(getDataverseErrorMessage(existing, `Failed to query entity '${entity.logicalName}' in Dataverse.`));
    }
    const result = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'POST', 'EntityDefinitions', buildEntityBody(entity, languageCode), solutionName);
    if (!result.ok) {
        throw new Error(getDataverseErrorMessage(result, `Failed to create entity '${entity.logicalName}'.`));
    }
    actions.push({
        componentType: 'entity',
        logicalName: entity.logicalName,
        state: 'created',
        message: `Created entity '${entity.logicalName}'.`
    });
}
async function ensureColumn(entity, column, environmentConfig, accessToken, solutionName, actions, languageCode) {
    if (!column.supported || column.isPrimaryNameAttribute) {
        actions.push({
            componentType: 'column',
            logicalName: `${entity.logicalName}.${column.logicalName}`,
            state: 'skipped',
            message: column.supported
                ? `Column '${column.logicalName}' is already handled as the primary name attribute.`
                : `Column '${column.logicalName}' is skipped: ${column.unsupportedReason ?? 'unsupported'}.`
        });
        return;
    }
    const existing = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'GET', `EntityDefinitions(LogicalName='${entity.logicalName}')/Attributes(LogicalName='${column.logicalName}')?$select=LogicalName`);
    if (existing.ok) {
        actions.push({
            componentType: 'column',
            logicalName: `${entity.logicalName}.${column.logicalName}`,
            state: 'skipped',
            message: `Column '${column.logicalName}' already exists in Dataverse.`
        });
        return;
    }
    if (existing.status !== 404) {
        throw new Error(getDataverseErrorMessage(existing, `Failed to query column '${column.logicalName}' on entity '${entity.logicalName}'.`));
    }
    const result = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'POST', `EntityDefinitions(LogicalName='${entity.logicalName}')/Attributes`, buildAttributeBody(column, languageCode), solutionName);
    if (!result.ok) {
        throw new Error(getDataverseErrorMessage(result, `Failed to create column '${column.logicalName}' on entity '${entity.logicalName}'.`));
    }
    actions.push({
        componentType: 'column',
        logicalName: `${entity.logicalName}.${column.logicalName}`,
        state: 'created',
        message: `Created column '${column.logicalName}' on entity '${entity.logicalName}'.`
    });
}
async function ensureRelationship(relationship, plan, environmentConfig, accessToken, solutionName, actions, languageCode) {
    if (!relationship.supported) {
        actions.push({
            componentType: 'relationship',
            logicalName: relationship.logicalName,
            state: 'skipped',
            message: `Relationship '${relationship.logicalName}' is skipped: ${relationship.unsupportedReason ?? 'unsupported'}.`
        });
        return;
    }
    const relationshipFilters = [...new Set([relationship.schemaName, relationship.logicalName].filter((value) => value.length > 0))]
        .map((value) => `SchemaName eq '${value.replace(/'/g, "''")}'`);
    const filter = encodeURIComponent(relationshipFilters.join(' or '));
    const result = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'GET', `RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?$select=SchemaName&$filter=${filter}`);
    if (!result.ok) {
        throw new Error(getDataverseErrorMessage(result, `Failed to validate relationship '${relationship.logicalName}' in Dataverse.`));
    }
    const exists = Array.isArray(result.payload?.value) && result.payload.value.length > 0;
    if (exists) {
        actions.push({
            componentType: 'relationship',
            logicalName: relationship.logicalName,
            state: 'skipped',
            message: `Relationship '${relationship.logicalName}' already exists in Dataverse.`
        });
        return;
    }
    const referencedEntity = plan.entities.find((entity) => entity.logicalName === relationship.referencedEntityLogicalName);
    const referencingEntity = plan.entities.find((entity) => entity.logicalName === relationship.referencingEntityLogicalName);
    const lookupColumn = referencingEntity?.columns.find((column) => column.logicalName === relationship.referencingAttributeLogicalName);
    if (!referencedEntity || !referencingEntity || !lookupColumn) {
        throw new Error(`Relationship '${relationship.logicalName}' could not resolve the referenced entity, referencing entity, or lookup column from the synthesis plan.`);
    }
    const createResult = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'POST', 'RelationshipDefinitions', buildRelationshipBody(relationship, referencedEntity, referencingEntity, lookupColumn, languageCode), solutionName);
    if (!createResult.ok) {
        throw new Error(getDataverseErrorMessage(createResult, `Failed to create relationship '${relationship.logicalName}'.`));
    }
    actions.push({
        componentType: 'relationship',
        logicalName: relationship.logicalName,
        state: 'created',
        message: `Created relationship '${relationship.logicalName}' in Dataverse.`
    });
}
async function ensureBehaviorWebResource(behavior, environmentConfig, accessToken, solutionName, actions) {
    if (!behavior.supported) {
        actions.push({
            componentType: 'webresource',
            logicalName: behavior.webResourceName,
            state: 'skipped',
            message: `Web resource '${behavior.webResourceName}' is skipped: ${behavior.reason ?? 'unsupported'}.`
        });
        return;
    }
    const filter = encodeURIComponent(`name eq '${behavior.webResourceName.replace(/'/g, "''")}'`);
    const existing = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'GET', `webresourceset?$select=webresourceid,name,content,displayname,webresourcetype&$filter=${filter}`);
    if (!existing.ok) {
        throw new Error(getDataverseErrorMessage(existing, `Failed to query web resource '${behavior.webResourceName}'.`));
    }
    const existingResource = Array.isArray(existing.payload?.value) ? existing.payload.value[0] : null;
    const desiredContent = (0, common_1.normalizeTextContent)(behavior.content);
    const existingContent = (0, common_1.normalizeTextContent)(decodeUtf8Base64(existingResource?.content));
    const existingType = typeof existingResource?.webresourcetype === 'number' ? existingResource.webresourcetype : null;
    const existingDisplayName = typeof existingResource?.displayname === 'string' ? existingResource.displayname : null;
    if (existingResource?.webresourceid &&
        existingContent === desiredContent &&
        existingType === behavior.webResourceType &&
        existingDisplayName === behavior.displayName) {
        actions.push({
            componentType: 'webresource',
            logicalName: behavior.webResourceName,
            state: 'skipped',
            message: `Web resource '${behavior.webResourceName}' already matches the DBM-generated plan.`
        });
        return;
    }
    const body = {
        name: behavior.webResourceName,
        displayname: behavior.displayName,
        webresourcetype: behavior.webResourceType,
        content: encodeUtf8Base64(behavior.content)
    };
    const result = existingResource?.webresourceid
        ? await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'PATCH', `webresourceset(${existingResource.webresourceid})`, body, solutionName)
        : await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'POST', 'webresourceset', body, solutionName);
    if (!result.ok) {
        throw new Error(getDataverseErrorMessage(result, `Failed to upsert web resource '${behavior.webResourceName}'.`));
    }
    actions.push({
        componentType: 'webresource',
        logicalName: behavior.webResourceName,
        state: existingResource?.webresourceid ? 'updated' : 'created',
        message: `${existingResource?.webresourceid ? 'Updated' : 'Created'} web resource '${behavior.webResourceName}'.`
    });
}
async function ensureForm(form, environmentConfig, accessToken, solutionName, actions) {
    if (!form.supported) {
        actions.push({
            componentType: 'form',
            logicalName: form.systemFormId,
            state: 'skipped',
            message: `Form '${form.displayName}' is skipped: ${form.reason ?? 'unsupported'}.`
        });
        return;
    }
    const normalizedFormId = form.systemFormId.replace(/[{}]/g, '');
    const existing = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'GET', `systemforms(${normalizedFormId})?$select=formid,name,formxml`);
    if (!existing.ok) {
        throw new Error(getDataverseErrorMessage(existing, `Failed to query form '${form.displayName}' (${form.systemFormId}).`));
    }
    const currentFormXml = String(existing.payload?.formxml ?? '');
    const patchedFormXml = patchFormXml(currentFormXml, form);
    if ((0, common_1.normalizeTextContent)(currentFormXml) === (0, common_1.normalizeTextContent)(patchedFormXml)) {
        actions.push({
            componentType: 'form',
            logicalName: form.systemFormId,
            state: 'skipped',
            message: `Form '${form.displayName}' already matches the DBM-managed process-host plan.`
        });
        return;
    }
    const result = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'PATCH', `systemforms(${normalizedFormId})`, {
        formxml: patchedFormXml
    }, solutionName);
    if (!result.ok) {
        throw new Error(getDataverseErrorMessage(result, `Failed to patch form '${form.displayName}' (${form.systemFormId}).`));
    }
    actions.push({
        componentType: 'form',
        logicalName: form.systemFormId,
        state: 'updated',
        message: `Patched form '${form.displayName}' with DBM-managed process-host artifacts.`
    });
}
async function publishChanges(environmentConfig, accessToken, actions) {
    const result = await dataverseRequest(environmentConfig.dataverseUrl, accessToken, 'POST', 'PublishAllXml', {});
    if (!result.ok) {
        throw new Error(getDataverseErrorMessage(result, 'Failed to publish Dataverse metadata changes.'));
    }
    actions.push({
        componentType: 'publish',
        logicalName: 'PublishAllXml',
        state: 'updated',
        message: 'Published Dataverse metadata changes.'
    });
}
async function applySynthesisPlanToDev(plan, environmentConfig, auth) {
    const actions = [];
    const languageCode = environmentConfig.localeCode ?? common_1.DEFAULT_LOCALE_CODE;
    const relationshipBackedLookupColumns = new Set(plan.relationships
        .filter((relationship) => relationship.supported && relationship.referencingAttributeLogicalName)
        .map((relationship) => `${relationship.referencingEntityLogicalName}.${relationship.referencingAttributeLogicalName}`));
    await ensureGeneratedMetadataSolution(plan, environmentConfig, auth.accessToken, actions);
    for (const entity of plan.entities) {
        await ensureEntity(entity, environmentConfig, auth.accessToken, plan.generatedMetadataSolutionName, actions, languageCode);
        for (const column of entity.columns) {
            if (relationshipBackedLookupColumns.has(`${entity.logicalName}.${column.logicalName}`)) {
                actions.push({
                    componentType: 'column',
                    logicalName: `${entity.logicalName}.${column.logicalName}`,
                    state: 'skipped',
                    message: `Column '${column.logicalName}' is created as part of its relationship metadata.`
                });
                continue;
            }
            await ensureColumn(entity, column, environmentConfig, auth.accessToken, plan.generatedMetadataSolutionName, actions, languageCode);
        }
    }
    for (const relationship of plan.relationships) {
        await ensureRelationship(relationship, plan, environmentConfig, auth.accessToken, plan.generatedMetadataSolutionName, actions, languageCode);
    }
    for (const behavior of plan.behaviors) {
        await ensureBehaviorWebResource(behavior, environmentConfig, auth.accessToken, plan.generatedMetadataSolutionName, actions);
    }
    for (const form of plan.forms) {
        await ensureForm(form, environmentConfig, auth.accessToken, plan.generatedMetadataSolutionName, actions);
    }
    await publishChanges(environmentConfig, auth.accessToken, actions);
    const snapshot = await (0, readback_1.readbackDataverseMetadata)(plan, environmentConfig, auth);
    const failedActions = actions.some((action) => action.state === 'failed');
    const blockingDiagnostics = plan.diagnostics.some((entry) => entry.severity === 'error');
    return {
        generatedUtc: new Date().toISOString(),
        dataverseUrl: environmentConfig.dataverseUrl,
        solutionName: plan.generatedMetadataSolutionName,
        status: failedActions ? 'error' : blockingDiagnostics ? 'warning' : 'success',
        actions,
        diagnostics: [...plan.diagnostics, ...snapshot.diagnostics]
    };
}
