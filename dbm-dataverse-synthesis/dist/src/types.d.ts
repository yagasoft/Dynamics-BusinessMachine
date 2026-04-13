import type { DbmElementTypeV1, DbmFieldDataTypeV1, DbmModelV1, DbmRelationshipTypeV1 } from 'dbm-contract';
export type DataverseSynthesisSeverity = 'info' | 'warning' | 'error';
export type DataverseApplyStatus = 'success' | 'warning' | 'error';
export type DataversePlanSource = 'field' | 'synthetic';
export type DataverseAttributeType = 'String' | 'Memo' | 'Money' | 'Integer' | 'Decimal' | 'Boolean' | 'Picklist' | 'Lookup' | 'DateTime';
export type DataverseApplyActionState = 'created' | 'updated' | 'skipped' | 'failed';
export type DataverseFormKind = 'main';
export type DataverseFormFolder = 'main';
export type DataverseBehaviorKind = 'shared-runtime' | 'form-config';
export interface DataverseSynthesisDiagnostic {
    code: string;
    severity: DataverseSynthesisSeverity;
    message: string;
    modelPath?: string | null;
}
export interface DataverseChoiceOptionPlan {
    id: string;
    displayName: string;
    value: number;
}
export interface DataverseColumnPlan {
    id: string;
    entityId: string;
    fieldId: string | null;
    logicalName: string;
    schemaName: string;
    displayName: string;
    dataType: DbmFieldDataTypeV1 | 'string';
    attributeType: DataverseAttributeType;
    required: boolean;
    readOnly: boolean;
    supported: boolean;
    unsupportedReason: string | null;
    source: DataversePlanSource;
    isPrimaryNameAttribute: boolean;
    maxLength?: number | null;
    precision?: number | null;
    dateTimeFormat?: 'DateOnly' | 'DateAndTime' | null;
    lookupTargetEntityId?: string | null;
    lookupTargetLogicalName?: string | null;
    choiceOptions?: DataverseChoiceOptionPlan[];
}
export interface DataverseRelationshipPlan {
    id: string;
    logicalName: string;
    schemaName: string;
    relationshipType: DbmRelationshipTypeV1;
    fromEntityId: string;
    toEntityId: string;
    referencedEntityLogicalName: string;
    referencingEntityLogicalName: string;
    referencingFieldId: string | null;
    referencingAttributeLogicalName: string | null;
    supported: boolean;
    unsupportedReason: string | null;
}
export interface DataverseEntityPlan {
    id: string;
    displayName: string;
    logicalName: string;
    schemaName: string;
    logicalCollectionName: string;
    collectionSchemaName: string;
    primaryIdLogicalName: string;
    primaryNameAttributeLogicalName: string;
    columns: DataverseColumnPlan[];
    relationships: DataverseRelationshipPlan[];
}
export interface DataverseFormLibraryPlan {
    name: string;
    libraryUniqueId: string;
}
export interface DataverseFormEventHandlerPlan {
    eventName: string;
    functionName: string;
    libraryName: string;
    handlerUniqueId: string;
    enabled: boolean;
    passExecutionContext: boolean;
    parameters: string;
    application: boolean;
    active: boolean;
    eventType: 'DataEvent' | 'ControlEvent';
}
export interface DataverseFormControlPlan {
    id: string;
    displayName: string;
    elementType: DbmElementTypeV1;
    entityBindingId: string;
    entityLogicalName: string;
    dataFieldName: string | null;
    controlName: string;
    readOnly: boolean;
    requiredByDefault: boolean;
    sourceElementIds: string[];
}
export interface DataverseFormSectionPlan {
    id: string;
    displayName: string;
    order: number;
    tabName: string;
    sectionName: string;
    controls: DataverseFormControlPlan[];
}
export interface DataverseFormStatePlan {
    id: string;
    displayName: string;
    visibleControlNames: string[];
    requiredControlNames: string[];
    lockedControlNames: string[];
}
export interface DataverseFormPlan {
    id: string;
    sourceFormId: string;
    sourceEntityBindingId: string;
    kind: DataverseFormKind;
    folder: DataverseFormFolder;
    displayName: string;
    entityId: string;
    entityLogicalName: string;
    systemFormId: string;
    supported: boolean;
    reason: string | null;
    templateRelativePath: string;
    relativePath: string;
    sections: DataverseFormSectionPlan[];
    libraries: DataverseFormLibraryPlan[];
    eventHandlers: DataverseFormEventHandlerPlan[];
    managedFormLibrariesXml: string;
    managedEventsXml: string;
    defaultFormStateId: string | null;
    states: DataverseFormStatePlan[];
    configBehaviorId: string;
}
export interface DataverseBehaviorPlan {
    id: string;
    kind: DataverseBehaviorKind;
    displayName: string;
    webResourceName: string;
    webResourceId: string;
    supported: boolean;
    reason: string | null;
    webResourceType: number;
    relativePath: string;
    content: string;
    attachedFormIds: string[];
}
export interface DataverseSynthesisPlanSummary {
    supportedEntities: number;
    supportedColumns: number;
    supportedRelationships: number;
    supportedForms: number;
    supportedBehaviors: number;
    blockingDiagnostics: number;
}
export interface DataverseSynthesisPlan {
    generatedUtc: string;
    modelId: string;
    modelVersion: string;
    model: DbmModelV1;
    modelDeploymentSolutionName: string;
    generatedMetadataSolutionName: string;
    entities: DataverseEntityPlan[];
    relationships: DataverseRelationshipPlan[];
    forms: DataverseFormPlan[];
    behaviors: DataverseBehaviorPlan[];
    diagnostics: DataverseSynthesisDiagnostic[];
    summary: DataverseSynthesisPlanSummary;
}
export interface DataverseEnvironmentConfig {
    dataverseUrl: string;
    localeCode?: number;
}
export interface DataverseAuthContext {
    accessToken: string;
}
export interface DataverseApplyAction {
    componentType: 'solution' | 'entity' | 'column' | 'relationship' | 'publish';
    logicalName: string;
    state: DataverseApplyActionState;
    message: string;
}
export interface DataverseApplyReport {
    generatedUtc: string;
    dataverseUrl: string;
    solutionName: string;
    status: DataverseApplyStatus;
    actions: DataverseApplyAction[];
    diagnostics: DataverseSynthesisDiagnostic[];
}
export interface DataverseReadbackColumn {
    logicalName: string;
    schemaName: string;
    attributeType: string;
    isPrimaryNameAttribute: boolean;
    requiredLevel: string | null;
    targets: string[];
    optionValues: number[];
}
export interface DataverseReadbackEntity {
    logicalName: string;
    schemaName: string;
    primaryIdLogicalName: string | null;
    primaryNameAttributeLogicalName: string | null;
    columns: DataverseReadbackColumn[];
}
export interface DataverseReadbackForm {
    formId: string;
    name: string;
    entityLogicalName: string;
    type: number | null;
    formXml: string;
    managedFormLibrariesXml: string;
    managedEventsXml: string;
    libraries: DataverseFormLibraryPlan[];
    eventHandlers: DataverseFormEventHandlerPlan[];
}
export interface DataverseReadbackWebResource {
    id: string;
    name: string;
    displayName: string | null;
    webResourceType: number | null;
    content: string;
}
export interface DataverseReadbackSnapshot {
    generatedUtc: string;
    dataverseUrl: string;
    solutionName: string;
    entities: DataverseReadbackEntity[];
    relationships: DataverseReadbackRelationship[];
    forms: DataverseReadbackForm[];
    webResources: DataverseReadbackWebResource[];
    diagnostics: DataverseSynthesisDiagnostic[];
}
export interface DataverseReadbackRelationship {
    logicalName: string;
    schemaName: string;
    relationshipType: 'OneToManyRelationship';
    referencedEntityLogicalName: string;
    referencingEntityLogicalName: string;
    referencingAttributeLogicalName: string | null;
}
export interface DataverseDriftDifference {
    kind: 'entity' | 'column' | 'relationship' | 'form' | 'webresource';
    severity: DataverseSynthesisSeverity;
    logicalName: string;
    message: string;
}
export interface DataverseDriftReport {
    generatedUtc: string;
    solutionName: string;
    hasBlockingDrift: boolean;
    differences: DataverseDriftDifference[];
    diagnostics: DataverseSynthesisDiagnostic[];
}
