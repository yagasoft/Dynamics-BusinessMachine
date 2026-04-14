import type {
  DbmChoiceOptionV1,
  DbmElementTypeV1,
  DbmEntityV1,
  DbmFieldDataTypeV1,
  DbmFieldV1,
  DbmFormElementV1,
  DbmFormEntityBindingV1,
  DbmFormStateElementBehaviorV1,
  DbmFormStateV1,
  DbmFormV1,
  DbmRelationshipV1
} from 'dbm-contract';

interface DataverseEntityDefinitionRecord {
  LogicalName: string;
  SchemaName?: string | null;
  PrimaryIdAttribute?: string | null;
  PrimaryNameAttribute?: string | null;
}

interface DataverseAttributeMetadataRecord {
  LogicalName: string;
  SchemaName?: string | null;
  AttributeType?: string | null;
  IsPrimaryName?: boolean | null;
  RequiredLevel?: { Value?: string | null } | null;
}

interface DataverseLookupTargetsRecord {
  Targets?: string[];
}

interface DataversePicklistOptionSetRecord {
  OptionSet?: {
    Options?: Array<{ Value?: number | null; Label?: { UserLocalizedLabel?: { Label?: string | null } | null } | null }>;
  };
}

interface DataverseSystemFormRecord {
  formid: string;
  name: string;
  objecttypecode: string;
  type: number;
  formxml?: string | null;
}

interface DataverseRelationshipRecord {
  SchemaName?: string | null;
  ReferencedEntity?: string | null;
  ReferencingEntity?: string | null;
  ReferencingAttribute?: string | null;
}

export interface DataverseEntitySummary {
  logicalName: string;
  schemaName: string;
  primaryIdLogicalName: string;
  primaryNameLogicalName: string | null;
}

export interface DataverseFormSummary {
  entityLogicalName: string;
  formId: string;
  name: string;
}

export interface DataverseRelationshipSummary {
  id: string;
  logicalName: string;
  sourceEntityLogicalName: string;
  targetEntityLogicalName: string;
  referencingFieldLogicalName: string | null;
}

export interface DataverseRegionSummary {
  id: string;
  displayName: string;
  tabName: string;
  sectionName: string;
  controlCount: number;
}

export interface DataverseImportedFormBundle {
  entitySummary: DataverseEntitySummary;
  entity: DbmEntityV1;
  form: DbmFormV1;
  importedRelationships: DbmRelationshipV1[];
  availableRelationships: DataverseRelationshipSummary[];
  regions: DataverseRegionSummary[];
}

type ParsedControl = {
  controlName: string;
  dataFieldName: string;
  tabName: string;
  sectionName: string;
  sectionLabel: string;
  order: number;
};

function getDataverseClientUrl(): string | null {
  const candidateWindows = [globalThis.window, globalThis.window?.parent].filter(Boolean) as Window[];
  for (const candidate of candidateWindows) {
    try {
      const xrm = candidate.Xrm as { Utility?: { getGlobalContext?: () => { getClientUrl: () => string } } } | undefined;
      const clientUrl = xrm?.Utility?.getGlobalContext?.().getClientUrl();
      if (clientUrl) {
        return clientUrl.replace(/\/$/, '');
      }
    } catch {
      // Ignore cross-frame access issues and continue.
    }
  }

  return null;
}

function buildDataverseHeaders(): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json; charset=utf-8',
    'OData-MaxVersion': '4.0',
    'OData-Version': '4.0'
  };
}

async function requestDataverseJson<T>(path: string): Promise<T> {
  const clientUrl = getDataverseClientUrl();
  if (!clientUrl) {
    throw new Error('Dataverse client URL is unavailable for metadata browsing.');
  }

  const response = await fetch(`${clientUrl}${path}`, {
    headers: buildDataverseHeaders()
  });
  if (!response.ok) {
    throw new Error(`Dataverse metadata request failed with ${response.status}: ${path}`);
  }

  return (await response.json()) as T;
}

function toDisplayName(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function normalizeId(value: string): string {
  return value.replace(/[{}]/g, '').toLowerCase();
}

function toSafeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function mapAttributeType(attributeType: string | null | undefined): { fieldType: DbmFieldDataTypeV1; elementType: DbmElementTypeV1 } {
  switch ((attributeType ?? '').toLowerCase()) {
    case 'memo':
      return { fieldType: 'multiline-string', elementType: 'multiline-text' };
    case 'money':
      return { fieldType: 'currency', elementType: 'currency' };
    case 'integer':
    case 'bigint':
      return { fieldType: 'integer', elementType: 'number' };
    case 'decimal':
    case 'double':
      return { fieldType: 'decimal', elementType: 'number' };
    case 'boolean':
    case 'picklist':
    case 'state':
    case 'status':
      return { fieldType: 'choice', elementType: 'choice' };
    case 'lookup':
    case 'customer':
    case 'owner':
      return { fieldType: 'lookup', elementType: 'lookup' };
    case 'datetime':
      return { fieldType: 'datetime', elementType: 'date' };
    case 'date':
      return { fieldType: 'date', elementType: 'date' };
    default:
      return { fieldType: 'string', elementType: 'text' };
  }
}

function mapFieldDataTypeToElementType(fieldType: DbmFieldDataTypeV1): DbmElementTypeV1 {
  switch (fieldType) {
    case 'multiline-string':
      return 'multiline-text';
    case 'integer':
    case 'decimal':
      return 'number';
    case 'currency':
      return 'currency';
    case 'choice':
      return 'choice';
    case 'lookup':
      return 'lookup';
    case 'date':
    case 'datetime':
      return 'date';
    default:
      return 'text';
  }
}

function getSectionLabel(sectionElement: Element, fallback: string): string {
  const label = sectionElement.querySelector('labels > label[description]');
  return toDisplayName(label?.getAttribute('description'), fallback);
}

function parseFormControls(formXml: string): ParsedControl[] {
  const parser = new DOMParser();
  const document = parser.parseFromString(formXml, 'text/xml');
  const sections = Array.from(document.querySelectorAll('tab'));
  const controls: ParsedControl[] = [];
  let order = 1;

  sections.forEach((tabElement) => {
    const tabName = tabElement.getAttribute('name') ?? `tab-${order}`;
    Array.from(tabElement.querySelectorAll('section')).forEach((sectionElement) => {
      const sectionName = sectionElement.getAttribute('name') ?? `${tabName}-section-${order}`;
      const sectionLabel = getSectionLabel(sectionElement, sectionName);
      Array.from(sectionElement.querySelectorAll('control[datafieldname]')).forEach((controlElement) => {
        const dataFieldName = controlElement.getAttribute('datafieldname')?.trim();
        if (!dataFieldName) {
          return;
        }
        const controlName = controlElement.getAttribute('id')?.trim() || dataFieldName;
        controls.push({
          controlName,
          dataFieldName,
          tabName,
          sectionName,
          sectionLabel,
          order
        });
        order += 1;
      });
    });
  });

  return controls;
}

async function listEntityAttributes(entityLogicalName: string): Promise<DataverseAttributeMetadataRecord[]> {
  const payload = await requestDataverseJson<{ value?: DataverseAttributeMetadataRecord[] }>(
    `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes?$select=LogicalName,SchemaName,AttributeType,IsPrimaryName,RequiredLevel`
  );
  return payload.value ?? [];
}

async function loadLookupTargets(entityLogicalName: string, logicalName: string): Promise<string[]> {
  const payload = await requestDataverseJson<DataverseLookupTargetsRecord>(
    `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${logicalName}')/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=Targets`
  );
  return payload.Targets ?? [];
}

async function loadPicklistOptions(entityLogicalName: string, logicalName: string): Promise<DbmChoiceOptionV1[]> {
  const payload = await requestDataverseJson<DataversePicklistOptionSetRecord>(
    `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')/Attributes(LogicalName='${logicalName}')/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet`
  );
  return (payload.OptionSet?.Options ?? [])
    .filter((option): option is { Value: number; Label?: { UserLocalizedLabel?: { Label?: string | null } | null } | null } => typeof option.Value === 'number')
    .map((option) => ({
      id: `${logicalName}-${option.Value}`,
      displayName: option.Label?.UserLocalizedLabel?.Label ?? String(option.Value),
      value: option.Value
    }));
}

async function listOneToManyRelationships(entityLogicalName: string): Promise<DataverseRelationshipSummary[]> {
  const payload = await requestDataverseJson<{ value?: DataverseRelationshipRecord[] }>(
    `/api/data/v9.2/RelationshipDefinitions/Microsoft.Dynamics.CRM.OneToManyRelationshipMetadata?$select=SchemaName,ReferencedEntity,ReferencingEntity,ReferencingAttribute&$filter=${encodeURIComponent(`ReferencingEntity eq '${entityLogicalName}'`)}`
  );

  return (payload.value ?? [])
    .filter((relationship): relationship is Required<Pick<DataverseRelationshipRecord, 'SchemaName' | 'ReferencedEntity' | 'ReferencingEntity'>> & DataverseRelationshipRecord =>
      !!relationship.SchemaName && !!relationship.ReferencedEntity && !!relationship.ReferencingEntity
    )
    .map((relationship) => ({
      id: relationship.SchemaName!,
      logicalName: relationship.SchemaName!,
      sourceEntityLogicalName: relationship.ReferencedEntity!,
      targetEntityLogicalName: relationship.ReferencingEntity!,
      referencingFieldLogicalName: relationship.ReferencingAttribute ?? null
    }));
}

export function isDataverseMetadataAvailable(): boolean {
  return Boolean(getDataverseClientUrl());
}

export async function listDataverseEntities(): Promise<DataverseEntitySummary[]> {
  const payload = await requestDataverseJson<{ value?: DataverseEntityDefinitionRecord[] }>(
    `/api/data/v9.2/EntityDefinitions?$select=LogicalName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute&$filter=${encodeURIComponent('IsCustomizable/Value eq true')}`
  );

  return (payload.value ?? [])
    .filter((entity) => !!entity.LogicalName)
    .map((entity) => ({
      logicalName: entity.LogicalName,
      schemaName: entity.SchemaName ?? entity.LogicalName,
      primaryIdLogicalName: entity.PrimaryIdAttribute ?? `${entity.LogicalName}id`,
      primaryNameLogicalName: entity.PrimaryNameAttribute ?? null
    }))
    .sort((left, right) => left.schemaName.localeCompare(right.schemaName));
}

export async function listDataverseMainForms(entityLogicalName: string): Promise<DataverseFormSummary[]> {
  const payload = await requestDataverseJson<{ value?: DataverseSystemFormRecord[] }>(
    `/api/data/v9.2/systemforms?$select=formid,name,objecttypecode,type&$filter=${encodeURIComponent(`objecttypecode eq '${entityLogicalName}' and type eq 2`)}`
  );

  return (payload.value ?? [])
    .filter((form) => !!form.formid)
    .map((form) => ({
      entityLogicalName,
      formId: normalizeId(form.formid),
      name: form.name || form.formid
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function importDataverseFormBundle(
  entityLogicalName: string,
  formId: string,
  knownEntityLogicalNames: string[]
): Promise<DataverseImportedFormBundle> {
  const [entityDefinition, formsPayload, attributes, relationships] = await Promise.all([
    requestDataverseJson<DataverseEntityDefinitionRecord>(
      `/api/data/v9.2/EntityDefinitions(LogicalName='${entityLogicalName}')?$select=LogicalName,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute`
    ),
    requestDataverseJson<DataverseSystemFormRecord>(
      `/api/data/v9.2/systemforms(${formId.replace(/[{}]/g, '')})?$select=formid,name,objecttypecode,type,formxml`
    ),
    listEntityAttributes(entityLogicalName),
    listOneToManyRelationships(entityLogicalName)
  ]);

  const controls = parseFormControls(formsPayload.formxml ?? '');
  const usedFieldNames = new Set([
    entityDefinition.PrimaryIdAttribute ?? `${entityLogicalName}id`,
    entityDefinition.PrimaryNameAttribute ?? '',
    ...controls.map((control) => control.dataFieldName)
  ].filter(Boolean));

  const attributeLookup = new Map(attributes.map((attribute) => [attribute.LogicalName, attribute]));
  const fieldPromises = [...usedFieldNames].map(async (logicalName) => {
    const attribute = attributeLookup.get(logicalName);
    if (!attribute) {
      return null;
    }
    const mappedType = mapAttributeType(attribute.AttributeType);
    const field: DbmFieldV1 = {
      id: logicalName,
      displayName: attribute.SchemaName ?? logicalName,
      dataType: mappedType.fieldType,
      providerBindings: {
        dataverse: {
          logicalName
        }
      },
      isRequired: attribute.RequiredLevel?.Value === 'ApplicationRequired',
      isReadOnly: Boolean(attribute.IsPrimaryName) || logicalName === entityDefinition.PrimaryIdAttribute
    };

    if (mappedType.fieldType === 'lookup') {
      const targets = await loadLookupTargets(entityLogicalName, logicalName);
      field.lookupTargetEntityId = targets[0] ?? null;
    } else if (mappedType.fieldType === 'choice') {
      field.choiceOptions = await loadPicklistOptions(entityLogicalName, logicalName);
    }

    return field;
  });

  const importedFields = (await Promise.all(fieldPromises)).filter((field): field is DbmFieldV1 => Boolean(field));
  if (!importedFields.some((field) => field.id === (entityDefinition.PrimaryIdAttribute ?? `${entityLogicalName}id`))) {
    importedFields.unshift({
      id: entityDefinition.PrimaryIdAttribute ?? `${entityLogicalName}id`,
      displayName: entityDefinition.PrimaryIdAttribute ?? `${entityLogicalName}id`,
      dataType: 'string',
      providerBindings: {
        dataverse: {
          logicalName: entityDefinition.PrimaryIdAttribute ?? `${entityLogicalName}id`
        }
      },
      isRequired: true,
      isReadOnly: true
    });
  }

  const entityId = entityLogicalName;
  const entity: DbmEntityV1 = {
    id: entityId,
    displayName: entityDefinition.SchemaName ?? entityLogicalName,
    providerBindings: {
      dataverse: {
        logicalName: entityLogicalName
      }
    },
    primaryKeyFieldId: entityDefinition.PrimaryIdAttribute ?? importedFields[0]?.id ?? `${entityLogicalName}id`,
    fields: importedFields
  };

  const primaryBindingId = `${entityId}-primary`;
  const formKey = `${entityLogicalName}-${normalizeId(formsPayload.formid)}`;
  const regionsMap = new Map<string, DataverseRegionSummary>();
  const elements: DbmFormElementV1[] = [];
  const elementBehaviors: DbmFormStateElementBehaviorV1[] = [];

  controls.forEach((control, index) => {
    const field = importedFields.find((entry) => entry.providerBindings.dataverse?.logicalName === control.dataFieldName);
    if (!field) {
      return;
    }
    const regionId = `${formKey}:region:${toSafeId(control.tabName)}:${toSafeId(control.sectionName)}`;
    if (!regionsMap.has(regionId)) {
      regionsMap.set(regionId, {
        id: regionId,
        displayName: control.sectionLabel,
        tabName: control.tabName,
        sectionName: control.sectionName,
        controlCount: 0
      });
    }
    const currentRegion = regionsMap.get(regionId)!;
    currentRegion.controlCount += 1;

    const elementId = `${formKey}:element:${toSafeId(control.controlName || field.id || String(index))}`;
    elements.push({
      id: elementId,
      elementType: mapFieldDataTypeToElementType(field.dataType),
      regionId,
      displayName: field.displayName,
      binding: {
        entityBindingId: primaryBindingId,
        fieldId: field.id
      },
      behavior: {
        requiredRuleIds: [],
        visibleRuleIds: [],
        editableRuleIds: []
      },
      providerBindings: {
        dataverse: {
          controlName: control.controlName
        }
      }
    });
    elementBehaviors.push({
      elementId,
      label: field.displayName,
      hint: null,
      requiredRuleIds: [],
      visibleRuleIds: [],
      editableRuleIds: []
    });
  });

  const importedRelationships = relationships
    .filter((relationship) => knownEntityLogicalNames.includes(relationship.sourceEntityLogicalName))
    .map((relationship) => {
      const referencingField = importedFields.find((field) => field.providerBindings.dataverse?.logicalName === relationship.referencingFieldLogicalName);
      return {
        id: relationship.id,
        fromEntityId: relationship.sourceEntityLogicalName,
        toEntityId: relationship.targetEntityLogicalName,
        relationshipType: 'one-to-many' as const,
        providerBindings: {
          dataverse: {
            logicalName: relationship.logicalName
          }
        },
        referencingFieldId: referencingField?.id ?? relationship.referencingFieldLogicalName
      };
    });

  const relatedEntityBindings: DbmFormEntityBindingV1[] = importedRelationships
    .filter((relationship) => relationship.toEntityId === entityId)
    .map((relationship) => ({
      id: `${entityId}:related:${relationship.fromEntityId}`,
      displayName: relationship.fromEntityId,
      entityId: relationship.fromEntityId,
      relationshipId: relationship.id,
      role: 'related' as const
    }));

  const entityBindings: DbmFormEntityBindingV1[] = [
    {
      id: primaryBindingId,
      displayName: entity.displayName,
      entityId,
      relationshipId: null,
      role: 'primary'
    },
    ...relatedEntityBindings
  ];

  const formStateId = `${formKey}-default-state`;
  const formState: DbmFormStateV1 = {
    id: formStateId,
    displayName: 'Default',
    activationRuleIds: [],
    visibleEntityBindingIds: entityBindings.map((binding) => binding.id),
    elementBehaviors
  };

  const form: DbmFormV1 = {
    id: formKey,
    displayName: formsPayload.name || entity.displayName,
    primaryEntityBindingId: primaryBindingId,
    entityBindings,
    layout: {
      layoutType: 'single-page',
      regions: [...regionsMap.values()].map((region, index) => ({
        id: region.id,
        displayName: region.displayName,
        order: index + 1,
        providerBindings: {
          dataverse: {
            tabName: region.tabName,
            sectionName: region.sectionName
          }
        }
      }))
    },
    elements,
    formStates: [formState],
    providerBindings: {
      dataverse: {
        formId: formsPayload.formid
      }
    }
  };

  return {
    entitySummary: {
      logicalName: entityLogicalName,
      schemaName: entityDefinition.SchemaName ?? entityLogicalName,
      primaryIdLogicalName: entityDefinition.PrimaryIdAttribute ?? `${entityLogicalName}id`,
      primaryNameLogicalName: entityDefinition.PrimaryNameAttribute ?? null
    },
    entity,
    form,
    importedRelationships,
    availableRelationships: relationships,
    regions: [...regionsMap.values()]
  };
}
