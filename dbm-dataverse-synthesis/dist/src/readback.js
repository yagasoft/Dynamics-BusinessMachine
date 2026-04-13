"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeReadbackEntity = normalizeReadbackEntity;
exports.readbackDataverseMetadata = readbackDataverseMetadata;
const common_1 = require("./common");
async function dataverseRequest(dataverseUrl, accessToken, relativePath) {
    const response = await fetch(`${dataverseUrl.replace(/\/$/, '')}/api/data/v9.2/${relativePath}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'OData-MaxVersion': '4.0',
            'OData-Version': '4.0',
            Consistency: 'Strong'
        }
    });
    const text = await response.text();
    const payload = text.length > 0 ? JSON.parse(text) : null;
    return {
        ok: response.ok,
        status: response.status,
        payload
    };
}
function normalizeTargets(payload) {
    if (!payload || !Array.isArray(payload.Targets)) {
        return [];
    }
    return payload.Targets.filter((target) => typeof target === 'string');
}
function normalizeOptionValues(payload) {
    const optionSetOptions = payload?.OptionSet?.Options;
    if (!Array.isArray(optionSetOptions)) {
        return [];
    }
    return optionSetOptions
        .map((option) => option?.Value)
        .filter((value) => typeof value === 'number');
}
async function enrichAttribute(dataverseUrl, accessToken, entityLogicalName, attribute) {
    if (attribute.AttributeType === 'Lookup') {
        const lookupResult = await dataverseRequest(dataverseUrl, accessToken, `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attribute.LogicalName}')/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`);
        if (!lookupResult.ok) {
            return attribute;
        }
        return {
            ...attribute,
            Targets: lookupResult.payload?.Targets ?? []
        };
    }
    if (attribute.AttributeType === 'Picklist') {
        const picklistResult = await dataverseRequest(dataverseUrl, accessToken, `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attribute.LogicalName}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet`);
        if (!picklistResult.ok) {
            return attribute;
        }
        return {
            ...attribute,
            OptionSet: picklistResult.payload?.OptionSet ?? null
        };
    }
    if (attribute.AttributeType === 'Boolean') {
        const booleanResult = await dataverseRequest(dataverseUrl, accessToken, `EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${attribute.LogicalName}')/Microsoft.Dynamics.CRM.BooleanAttributeMetadata?$select=LogicalName&$expand=OptionSet`);
        if (!booleanResult.ok) {
            return attribute;
        }
        return {
            ...attribute,
            OptionSet: booleanResult.payload?.OptionSet ?? null
        };
    }
    return attribute;
}
function extractManagedXmlFragment(formXml, nodeName) {
    const match = formXml.match(new RegExp(`<${nodeName}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${nodeName}>`, 'i')) ??
        formXml.match(new RegExp(`<${nodeName}(?:\\s[^>]*)?\\s*/>`, 'i'));
    return match ? (0, common_1.normalizeXmlContent)(match[0]) : '';
}
function extractLibraries(fragment) {
    const libraries = [];
    const pattern = /<Library\b[^>]*name="([^"]+)"[^>]*libraryUniqueId="([^"]+)"[^>]*\/?>/gi;
    let match;
    while ((match = pattern.exec(fragment)) !== null) {
        libraries.push({
            name: match[1] ?? '',
            libraryUniqueId: match[2] ?? ''
        });
    }
    return libraries;
}
function extractEventHandlers(fragment) {
    const handlers = [];
    const pattern = /<Handler\b[^>]*functionName="([^"]+)"[^>]*libraryName="([^"]+)"[^>]*handlerUniqueId="([^"]+)"[^>]*enabled="([^"]+)"[^>]*passExecutionContext="([^"]+)"[^>]*parameters="([^"]*)"[^>]*\/?>/gi;
    let match;
    while ((match = pattern.exec(fragment)) !== null) {
        handlers.push({
            eventName: 'onload',
            functionName: match[1] ?? '',
            libraryName: match[2] ?? '',
            handlerUniqueId: match[3] ?? '',
            enabled: (match[4] ?? '').toLowerCase() === 'true',
            passExecutionContext: (match[5] ?? '').toLowerCase() === 'true',
            parameters: match[6] ?? '',
            application: false,
            active: true,
            eventType: 'DataEvent'
        });
    }
    return handlers;
}
function normalizeReadbackEntity(entityPayload, attributePayloads) {
    const columns = attributePayloads.map((attribute) => ({
        logicalName: attribute.LogicalName,
        schemaName: attribute.SchemaName ?? attribute.LogicalName,
        attributeType: attribute.AttributeType ?? attribute['@odata.type'] ?? 'Unknown',
        isPrimaryNameAttribute: Boolean(attribute.IsPrimaryName),
        requiredLevel: attribute.RequiredLevel?.Value ?? attribute.RequiredLevel ?? null,
        targets: normalizeTargets(attribute),
        optionValues: normalizeOptionValues(attribute)
    }));
    return {
        logicalName: entityPayload.LogicalName,
        schemaName: entityPayload.SchemaName ?? entityPayload.LogicalName,
        primaryIdLogicalName: entityPayload.PrimaryIdAttribute ?? null,
        primaryNameAttributeLogicalName: entityPayload.PrimaryNameAttribute ?? null,
        columns
    };
}
function normalizeReadbackForm(payload) {
    const formXml = payload.formxml ?? payload.formXml ?? '';
    const managedFormLibrariesXml = extractManagedXmlFragment(formXml, 'formLibraries');
    const managedEventsXml = extractManagedXmlFragment(formXml, 'events');
    return {
        formId: payload.formid ?? payload.formId ?? '',
        name: payload.name ?? '',
        entityLogicalName: payload.objecttypecode ?? '',
        type: typeof payload.type === 'number' ? payload.type : null,
        formXml,
        managedFormLibrariesXml,
        managedEventsXml,
        libraries: extractLibraries(managedFormLibrariesXml),
        eventHandlers: extractEventHandlers(managedEventsXml)
    };
}
async function readEntitySnapshot(dataverseUrl, accessToken, logicalName) {
    const entityResult = await dataverseRequest(dataverseUrl, accessToken, `EntityDefinitions(LogicalName='${logicalName}')?$select=LogicalName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute`);
    if (!entityResult.ok && entityResult.status === 404) {
        return null;
    }
    if (!entityResult.ok) {
        throw new Error(`Failed to retrieve entity '${logicalName}' from Dataverse.`);
    }
    const attributesResult = await dataverseRequest(dataverseUrl, accessToken, `EntityDefinitions(LogicalName='${logicalName}')/Attributes?$select=LogicalName,SchemaName,AttributeType,IsPrimaryName,RequiredLevel`);
    if (!attributesResult.ok) {
        throw new Error(`Failed to retrieve attributes for entity '${logicalName}' from Dataverse.`);
    }
    const attributes = Array.isArray(attributesResult.payload?.value) ? attributesResult.payload.value : [];
    const normalizedAttributes = await Promise.all(attributes.map((attribute) => enrichAttribute(dataverseUrl, accessToken, logicalName, attribute)));
    return normalizeReadbackEntity(entityResult.payload, normalizedAttributes);
}
async function readRelationshipSnapshot(dataverseUrl, accessToken, relationshipPlan) {
    const candidateNames = [...new Set([relationshipPlan.schemaName, relationshipPlan.logicalName].filter((value) => value.length > 0))];
    for (const candidateName of candidateNames) {
        const filter = encodeURIComponent(`SchemaName eq '${candidateName}'`);
        const result = await dataverseRequest(dataverseUrl, accessToken, `RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute&$filter=${filter}`);
        if (!result.ok) {
            throw new Error(`Failed to retrieve relationship '${candidateName}' from Dataverse.`);
        }
        const relationship = Array.isArray(result.payload?.value) ? result.payload.value[0] : null;
        if (!relationship) {
            continue;
        }
        return {
            logicalName: relationshipPlan.logicalName,
            schemaName: relationship.SchemaName ?? candidateName,
            relationshipType: 'OneToManyRelationship',
            referencedEntityLogicalName: relationship.ReferencedEntity,
            referencingEntityLogicalName: relationship.ReferencingEntity,
            referencingAttributeLogicalName: relationship.ReferencingAttribute ?? null
        };
    }
    return null;
}
async function readFormSnapshot(dataverseUrl, accessToken, formId) {
    const normalizedFormId = formId.replace(/[{}]/g, '');
    const result = await dataverseRequest(dataverseUrl, accessToken, `systemforms(${normalizedFormId})?$select=formid,name,type,objecttypecode,formxml`);
    if (!result.ok && result.status === 404) {
        return null;
    }
    if (!result.ok) {
        throw new Error(`Failed to retrieve form '${formId}' from Dataverse.`);
    }
    return normalizeReadbackForm(result.payload);
}
async function readWebResourceSnapshot(dataverseUrl, accessToken, webResourceName) {
    const filter = encodeURIComponent(`name eq '${webResourceName.replace(/'/g, "''")}'`);
    const result = await dataverseRequest(dataverseUrl, accessToken, `webresourceset?$select=webresourceid,name,displayname,webresourcetype,content&$filter=${filter}`);
    if (!result.ok) {
        throw new Error(`Failed to retrieve web resource '${webResourceName}' from Dataverse.`);
    }
    const webResource = Array.isArray(result.payload?.value) ? result.payload.value[0] : null;
    if (!webResource) {
        return null;
    }
    return {
        id: webResource.webresourceid ?? '',
        name: webResource.name ?? '',
        displayName: webResource.displayname ?? null,
        webResourceType: typeof webResource.webresourcetype === 'number' ? webResource.webresourcetype : null,
        content: (0, common_1.normalizeTextContent)((0, common_1.tryDecodeBase64Utf8)(webResource.content ?? ''))
    };
}
async function readbackDataverseMetadata(plan, environmentConfig, auth) {
    const entities = [];
    for (const entityPlan of plan.entities) {
        const entitySnapshot = await readEntitySnapshot(environmentConfig.dataverseUrl, auth.accessToken, entityPlan.logicalName);
        if (entitySnapshot) {
            entities.push(entitySnapshot);
        }
    }
    const relationships = [];
    for (const relationshipPlan of plan.relationships) {
        const relationshipSnapshot = await readRelationshipSnapshot(environmentConfig.dataverseUrl, auth.accessToken, relationshipPlan);
        if (relationshipSnapshot) {
            relationships.push(relationshipSnapshot);
        }
    }
    const forms = [];
    for (const formPlan of plan.forms.filter((entry) => entry.supported)) {
        const formSnapshot = await readFormSnapshot(environmentConfig.dataverseUrl, auth.accessToken, formPlan.systemFormId);
        if (formSnapshot) {
            forms.push(formSnapshot);
        }
    }
    const webResources = [];
    for (const behaviorPlan of plan.behaviors.filter((entry) => entry.supported)) {
        const webResourceSnapshot = await readWebResourceSnapshot(environmentConfig.dataverseUrl, auth.accessToken, behaviorPlan.webResourceName);
        if (webResourceSnapshot) {
            webResources.push(webResourceSnapshot);
        }
    }
    return {
        generatedUtc: new Date().toISOString(),
        dataverseUrl: environmentConfig.dataverseUrl,
        solutionName: plan.generatedMetadataSolutionName,
        entities,
        relationships,
        forms,
        webResources,
        diagnostics: []
    };
}
