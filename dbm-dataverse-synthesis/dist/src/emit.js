"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitGeneratedMetadataSolution = emitGeneratedMetadataSolution;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const xmlbuilder2_1 = require("xmlbuilder2");
const common_1 = require("./common");
function createSolutionXml(plan) {
    const root = (0, xmlbuilder2_1.create)({ version: '1.0', encoding: 'utf-8' }).ele('ImportExportXml', {
        version: '9.2.26033.170',
        SolutionPackageVersion: '9.2',
        languagecode: '1033',
        generatedBy: 'DBMSynthesis',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    });
    const manifest = root.ele('SolutionManifest');
    manifest.ele('UniqueName').txt(plan.generatedMetadataSolutionName);
    const localizedNames = manifest.ele('LocalizedNames');
    localizedNames.ele('LocalizedName', { description: plan.generatedMetadataSolutionName, languagecode: '1033' });
    manifest.ele('Descriptions');
    manifest.ele('Version').txt(common_1.DEFAULT_GENERATED_METADATA_SOLUTION_VERSION);
    manifest.ele('Managed').txt('0');
    const publisher = manifest.ele('Publisher');
    publisher.ele('UniqueName').txt('yagasoft');
    const publisherNames = publisher.ele('LocalizedNames');
    publisherNames.ele('LocalizedName', { description: 'Yagasoft', languagecode: '1033' });
    publisher.ele('Descriptions');
    publisher.ele('EMailAddress').txt('mail@yagasoft.com');
    publisher.ele('SupportingWebsiteUrl').txt('http://yagasoft.com');
    publisher.ele('CustomizationPrefix').txt('ys');
    publisher.ele('CustomizationOptionValuePrefix').txt('71786');
    const addresses = publisher.ele('Addresses');
    for (const addressNumber of ['1', '2']) {
        const address = addresses.ele('Address');
        address.ele('AddressNumber').txt(addressNumber);
        address.ele('AddressTypeCode').txt('1');
    }
    const rootComponents = manifest.ele('RootComponents');
    for (const entity of plan.entities) {
        rootComponents.ele('RootComponent', {
            type: '1',
            schemaName: entity.logicalName,
            behavior: '0'
        });
    }
    for (const behavior of plan.behaviors.filter((entry) => entry.supported)) {
        rootComponents.ele('RootComponent', {
            type: '61',
            schemaName: behavior.webResourceName,
            behavior: '0'
        });
    }
    manifest.ele('MissingDependencies');
    return root.end({ prettyPrint: true });
}
function createCustomizationsXml() {
    const root = (0, xmlbuilder2_1.create)({ version: '1.0', encoding: 'utf-8' }).ele('ImportExportXml', {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        OrganizationVersion: '9.2.26033.170',
        OrganizationSchemaType: 'Standard',
        CRMServerServiceabilityVersion: '9.2.26033.00170'
    });
    root.ele('Entities');
    root.ele('Roles');
    root.ele('Workflows');
    root.ele('FieldSecurityProfiles');
    root.ele('Templates');
    root.ele('EntityMaps');
    root.ele('EntityRelationships');
    root.ele('OrganizationSettings');
    root.ele('optionsets');
    root.ele('WebResources');
    root.ele('CustomControls');
    root.ele('AppModuleSiteMaps');
    root.ele('AppModules');
    root.ele('EntityDataProviders');
    const languages = root.ele('Languages');
    languages.ele('Language').txt('1033');
    return root.end({ prettyPrint: true });
}
function createRelationshipsIndex(relationships) {
    const root = (0, xmlbuilder2_1.create)({ version: '1.0', encoding: 'utf-8' }).ele('EntityRelationships', {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    });
    for (const relationship of relationships.filter((entry) => entry.supported)) {
        root.ele('EntityRelationship', { Name: relationship.logicalName });
    }
    return root.end({ prettyPrint: true });
}
function addCommonAttributeFlags(attribute, isPrimaryName, isPrimaryKey) {
    attribute.ele('ValidForUpdateApi').txt(isPrimaryKey ? '0' : '1');
    attribute.ele('ValidForReadApi').txt('1');
    attribute.ele('ValidForCreateApi').txt('1');
    attribute.ele('IsCustomField').txt(isPrimaryKey ? '0' : '1');
    attribute.ele('IsAuditEnabled').txt(isPrimaryKey ? '0' : '1');
    attribute.ele('IsSecured').txt('0');
    attribute.ele('IntroducedVersion').txt('1.0.0.0');
    attribute.ele('IsCustomizable').txt('1');
    attribute.ele('IsRenameable').txt('1');
    attribute.ele('CanModifySearchSettings').txt('1');
    attribute.ele('CanModifyRequirementLevelSettings').txt(isPrimaryKey ? '0' : '1');
    attribute.ele('CanModifyAdditionalSettings').txt('1');
    attribute.ele('SourceType').txt('0');
    attribute.ele('IsGlobalFilterEnabled').txt('0');
    attribute.ele('IsSortableEnabled').txt('0');
    attribute.ele('CanModifyGlobalFilterSettings').txt('1');
    attribute.ele('CanModifyIsSortableSettings').txt('1');
    attribute.ele('IsDataSourceSecret').txt('0');
    attribute.ele('AutoNumberFormat').txt('');
    attribute.ele('IsSearchable').txt(isPrimaryName ? '1' : '0');
    attribute.ele('IsFilterable').txt(isPrimaryKey ? '1' : '0');
    attribute.ele('IsRetrievable').txt(isPrimaryName || isPrimaryKey ? '1' : '0');
    attribute.ele('IsLocalizable').txt('0');
}
function addDisplayNodes(attribute, displayName, description) {
    const displayNames = attribute.ele('displaynames');
    displayNames.ele('displayname', { description: displayName, languagecode: '1033' });
    const descriptions = attribute.ele('Descriptions');
    descriptions.ele('Description', { description, languagecode: '1033' });
}
function writePrimaryKeyAttribute(attributes, entity) {
    const attribute = attributes.ele('attribute', { PhysicalName: entity.primaryIdLogicalName });
    attribute.ele('Type').txt('primarykey');
    attribute.ele('Name').txt(entity.primaryIdLogicalName);
    attribute.ele('LogicalName').txt(entity.primaryIdLogicalName);
    attribute.ele('RequiredLevel').txt('systemrequired');
    attribute.ele('DisplayMask').txt('ValidForAdvancedFind|RequiredForGrid');
    attribute.ele('ImeMode').txt('auto');
    addCommonAttributeFlags(attribute, false, true);
    addDisplayNodes(attribute, entity.displayName, 'Unique identifier for entity instances');
}
function appendOptionSet(attribute, type, name, displayName, options) {
    const optionSet = attribute.ele('optionset', { Name: name });
    optionSet.ele('OptionSetType').txt(type);
    optionSet.ele('IntroducedVersion').txt('1.0.0.0');
    optionSet.ele('IsCustomizable').txt('1');
    const optionDisplayNames = optionSet.ele('displaynames');
    optionDisplayNames.ele('displayname', { description: displayName, languagecode: '1033' });
    const optionDescriptions = optionSet.ele('Descriptions');
    optionDescriptions.ele('Description', {
        description: `${displayName} generated by DBM synthesis.`,
        languagecode: '1033'
    });
    const optionNodes = optionSet.ele('options');
    for (const option of options) {
        const optionNode = optionNodes.ele('option', {
            value: String(option.value),
            ExternalValue: '',
            IsHidden: '0'
        });
        const labels = optionNode.ele('labels');
        labels.ele('label', { description: option.label, languagecode: '1033' });
    }
}
function getXmlAttributeType(column) {
    switch (column.attributeType) {
        case 'String':
            return 'nvarchar';
        case 'Memo':
            return 'ntext';
        case 'Money':
            return 'money';
        case 'Integer':
            return 'int';
        case 'Decimal':
            return 'decimal';
        case 'Boolean':
            return 'bit';
        case 'Picklist':
            return 'picklist';
        case 'Lookup':
            return 'lookup';
        case 'DateTime':
            return 'datetime';
        default:
            return 'nvarchar';
    }
}
function writeColumnAttribute(attributes, entity, column) {
    const attribute = attributes.ele('attribute', { PhysicalName: column.schemaName });
    const isPrimaryName = column.isPrimaryNameAttribute;
    attribute.ele('Type').txt(getXmlAttributeType(column));
    attribute.ele('Name').txt(column.logicalName);
    attribute.ele('LogicalName').txt(column.logicalName);
    attribute.ele('RequiredLevel').txt(isPrimaryName ? 'none' : column.required ? 'applicationrequired' : 'none');
    attribute.ele('DisplayMask').txt(isPrimaryName
        ? 'PrimaryName|ValidForAdvancedFind|ValidForForm|ValidForGrid|RequiredForForm'
        : 'ValidForAdvancedFind|ValidForForm|ValidForGrid');
    attribute.ele('ImeMode').txt(column.attributeType === 'Money' || column.attributeType === 'Integer' || column.attributeType === 'Decimal'
        ? 'disabled'
        : 'auto');
    addCommonAttributeFlags(attribute, isPrimaryName, false);
    switch (column.attributeType) {
        case 'String':
            attribute.ele('Format').txt('text');
            attribute.ele('MaxLength').txt(String(column.maxLength ?? 200));
            attribute.ele('Length').txt(String((column.maxLength ?? 200) * 2));
            break;
        case 'Memo':
            attribute.ele('Format').txt('textarea');
            attribute.ele('MaxLength').txt(String(column.maxLength ?? 2000));
            break;
        case 'Money':
            attribute.ele('MinValue').txt('0');
            attribute.ele('MaxValue').txt('1000000000');
            attribute.ele('Precision').txt(String(column.precision ?? 2));
            attribute.ele('PrecisionSource').txt('1');
            break;
        case 'Integer':
            attribute.ele('Format').txt('none');
            attribute.ele('MinValue').txt('-2147483648');
            attribute.ele('MaxValue').txt('2147483647');
            break;
        case 'Decimal':
            attribute.ele('MinValue').txt('-1000000000');
            attribute.ele('MaxValue').txt('1000000000');
            attribute.ele('Accuracy').txt(String(column.precision ?? 2));
            break;
        case 'Boolean':
            appendOptionSet(attribute, 'bit', `${entity.logicalName}_${column.logicalName}`, column.displayName, [
                { value: 1, label: 'Yes' },
                { value: 0, label: 'No' }
            ]);
            break;
        case 'Picklist':
            appendOptionSet(attribute, 'picklist', `${entity.logicalName}_${column.logicalName}`, column.displayName, (column.choiceOptions ?? []).map((option) => ({ value: option.value, label: option.displayName })));
            break;
        case 'Lookup':
            attribute.ele('LookupStyle').txt('single');
            attribute.ele('LookupTypes');
            break;
        case 'DateTime':
            attribute.ele('Format').txt(column.dateTimeFormat === 'DateAndTime' ? 'datetime' : 'date');
            attribute.ele('CanChangeDateTimeBehavior').txt('1');
            attribute.ele('Behavior').txt(column.dateTimeFormat === 'DateAndTime' ? '2' : '1');
            break;
        default:
            break;
    }
    addDisplayNodes(attribute, column.displayName, `${column.displayName} generated by DBM synthesis.`);
}
function writeEntityPlan(entity) {
    const root = (0, xmlbuilder2_1.create)({ version: '1.0', encoding: 'utf-8' }).ele('Entity', {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    });
    root.ele('Name', { LocalizedName: entity.displayName, OriginalName: entity.displayName }).txt(entity.schemaName);
    const info = root.ele('EntityInfo').ele('entity', { Name: entity.schemaName, unmodified: '0' });
    const localizedNames = info.ele('LocalizedNames');
    localizedNames.ele('LocalizedName', { description: entity.displayName, languagecode: '1033' });
    const localizedCollectionNames = info.ele('LocalizedCollectionNames');
    localizedCollectionNames.ele('LocalizedCollectionName', { description: `${entity.displayName}s`, languagecode: '1033' });
    const descriptions = info.ele('Descriptions');
    descriptions.ele('Description', {
        description: `${entity.displayName} generated by the DBM synthesis pipeline.`,
        languagecode: '1033'
    });
    const attributes = info.ele('attributes');
    writePrimaryKeyAttribute(attributes, entity);
    for (const column of entity.columns.filter((entry) => entry.supported)) {
        writeColumnAttribute(attributes, entity, column);
    }
    info.ele('EntitySetName').txt(entity.logicalCollectionName);
    info.ele('IsDuplicateCheckSupported').txt('0');
    info.ele('IsBusinessProcessEnabled').txt('0');
    info.ele('IsRequiredOffline').txt('0');
    info.ele('IsInteractionCentricEnabled').txt('0');
    info.ele('IsCollaboration').txt('0');
    info.ele('AutoRouteToOwnerQueue').txt('0');
    info.ele('IsConnectionsEnabled').txt('0');
    info.ele('IsDocumentManagementEnabled').txt('0');
    info.ele('AutoCreateAccessTeams').txt('0');
    info.ele('IsOneNoteIntegrationEnabled').txt('0');
    info.ele('IsKnowledgeManagementEnabled').txt('0');
    info.ele('IsSLAEnabled').txt('0');
    info.ele('IsDocumentRecommendationsEnabled').txt('0');
    info.ele('IsBPFEntity').txt('0');
    info.ele('OwnershipTypeMask').txt('UserOwned');
    info.ele('IsAuditEnabled').txt('0');
    info.ele('IsRetrieveAuditEnabled').txt('0');
    info.ele('IsRetrieveMultipleAuditEnabled').txt('0');
    info.ele('IsActivity').txt('0');
    info.ele('ActivityTypeMask').txt('');
    info.ele('IsActivityParty').txt('0');
    info.ele('IsReplicated').txt('0');
    info.ele('IsReplicationUserFiltered').txt('0');
    info.ele('IsMailMergeEnabled').txt('0');
    info.ele('IsVisibleInMobile').txt('0');
    info.ele('IsVisibleInMobileClient').txt('0');
    info.ele('IsReadOnlyInMobileClient').txt('0');
    info.ele('IsOfflineInMobileClient').txt('0');
    info.ele('DaysSinceRecordLastModified').txt('0');
    info.ele('MobileOfflineFilters').txt('');
    info.ele('IsMapiGridEnabled').txt('1');
    info.ele('IsReadingPaneEnabled').txt('1');
    info.ele('IsQuickCreateEnabled').txt('0');
    info.ele('SyncToExternalSearchIndex').txt('0');
    info.ele('IntroducedVersion').txt('1.0.0.0');
    info.ele('IsCustomizable').txt('1');
    info.ele('IsRenameable').txt('1');
    info.ele('IsMappable').txt('1');
    info.ele('CanModifyAuditSettings').txt('1');
    info.ele('CanModifyMobileVisibility').txt('1');
    info.ele('CanModifyMobileClientVisibility').txt('1');
    info.ele('CanModifyMobileClientReadOnly').txt('1');
    info.ele('CanModifyMobileClientOffline').txt('1');
    info.ele('CanModifyConnectionSettings').txt('1');
    info.ele('CanModifyDuplicateDetectionSettings').txt('1');
    info.ele('CanModifyMailMergeSettings').txt('1');
    info.ele('CanModifyQueueSettings').txt('1');
    info.ele('CanCreateAttributes').txt('1');
    info.ele('CanCreateForms').txt('1');
    info.ele('CanCreateCharts').txt('1');
    info.ele('CanCreateViews').txt('1');
    info.ele('CanModifyAdditionalSettings').txt('1');
    info.ele('CanEnableSyncToExternalSearchIndex').txt('1');
    info.ele('EnforceStateTransitions').txt('0');
    info.ele('CanChangeHierarchicalRelationship').txt('1');
    info.ele('EntityHelpUrlEnabled').txt('0');
    info.ele('ChangeTrackingEnabled').txt('0');
    info.ele('CanChangeTrackingBeEnabled').txt('1');
    info.ele('IsEnabledForExternalChannels').txt('0');
    info.ele('IsMSTeamsIntegrationEnabled').txt('0');
    info.ele('IsSolutionAware').txt('0');
    root.ele('FormXml');
    root.ele('SavedQueries');
    root.ele('RibbonDiffXml');
    return root.end({ prettyPrint: true });
}
function writeRelationshipPlan(relationship) {
    const root = (0, xmlbuilder2_1.create)({ version: '1.0', encoding: 'utf-8' }).ele('EntityRelationships', {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    });
    const relationshipNode = root.ele('EntityRelationship', { Name: relationship.logicalName });
    relationshipNode.ele('EntityRelationshipType').txt('OneToMany');
    relationshipNode.ele('IsCustomizable').txt('1');
    relationshipNode.ele('IntroducedVersion').txt('1.0.0.0');
    relationshipNode.ele('IsHierarchical').txt('0');
    relationshipNode.ele('ReferencingEntityName').txt(relationship.referencingEntityLogicalName);
    relationshipNode.ele('ReferencedEntityName').txt(relationship.referencedEntityLogicalName);
    relationshipNode.ele('CascadeAssign').txt('NoCascade');
    relationshipNode.ele('CascadeDelete').txt('RemoveLink');
    relationshipNode.ele('CascadeArchive').txt('RemoveLink');
    relationshipNode.ele('CascadeReparent').txt('NoCascade');
    relationshipNode.ele('CascadeShare').txt('NoCascade');
    relationshipNode.ele('CascadeUnshare').txt('NoCascade');
    relationshipNode.ele('CascadeRollupView').txt('NoCascade');
    relationshipNode.ele('IsValidForAdvancedFind').txt('1');
    relationshipNode.ele('ReferencingAttributeName').txt(relationship.referencingAttributeLogicalName ?? '');
    const relationshipDescription = relationshipNode.ele('RelationshipDescription').ele('Descriptions');
    relationshipDescription.ele('Description', {
        description: `${relationship.logicalName} generated by DBM synthesis.`,
        languagecode: '1033'
    });
    const roles = relationshipNode.ele('EntityRelationshipRoles');
    const referencingRole = roles.ele('EntityRelationshipRole');
    referencingRole.ele('NavPaneDisplayOption').txt('UseCollectionName');
    referencingRole.ele('NavPaneArea').txt('Details');
    referencingRole.ele('NavPaneOrder').txt('10000');
    referencingRole.ele('NavigationPropertyName').txt(relationship.referencingAttributeLogicalName ?? relationship.logicalName);
    const customLabels = referencingRole.ele('CustomLabels');
    customLabels.ele('CustomLabel', { description: relationship.logicalName, languagecode: '1033' });
    referencingRole.ele('RelationshipRoleType').txt('1');
    const referencedRole = roles.ele('EntityRelationshipRole');
    referencedRole.ele('NavigationPropertyName').txt(relationship.logicalName);
    referencedRole.ele('RelationshipRoleType').txt('0');
    return root.end({ prettyPrint: true });
}
function createWebResourceMetadata(behavior) {
    const root = (0, xmlbuilder2_1.create)({ version: '1.0', encoding: 'utf-8' }).ele('WebResource', {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    });
    root.ele('WebResourceId').txt(behavior.webResourceId);
    root.ele('Name').txt(behavior.webResourceName);
    root.ele('DisplayName').txt(behavior.displayName);
    root.ele('WebResourceType').txt(String(behavior.webResourceType));
    root.ele('IntroducedVersion').txt(common_1.DEFAULT_GENERATED_METADATA_SOLUTION_VERSION);
    root.ele('IsEnabledForMobileClient').txt('0');
    root.ele('IsAvailableForMobileOffline').txt('0');
    root.ele('DependencyXml').txt('<Dependencies><Dependency componentType="WebResource"/></Dependencies>');
    root.ele('IsCustomizable').txt('1');
    root.ele('CanBeDeleted').txt('1');
    root.ele('IsHidden').txt('0');
    root.ele('FileName').txt(`/WebResources/${(0, common_1.toDataverseWebResourceFileName)(behavior.webResourceName, behavior.webResourceId)}`);
    return root.end({ prettyPrint: true });
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
function escapeForRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    const existingSectionPattern = new RegExp(`<section\\b[^>]*name="${escapeForRegex(processHost.sectionName)}"[^>]*>[\\s\\S]*?<\\/section>`, 'i');
    if (existingSectionPattern.test(xml)) {
        return xml.replace(existingSectionPattern, buildProcessHostSectionXml(formPlan));
    }
    const sectionXml = buildProcessHostSectionXml(formPlan);
    if (!sectionXml) {
        return xml;
    }
    const sectionsPattern = new RegExp(`(<tab\\b[^>]*name="${escapeForRegex(processHost.tabName)}"[^>]*>[\\s\\S]*?<columns>\\s*<column[^>]*>\\s*<sections>)`, 'i');
    if (sectionsPattern.test(xml)) {
        return xml.replace(sectionsPattern, `$1\n${sectionXml}`);
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
async function writeTextFile(filePath, content) {
    await node_fs_1.promises.mkdir(node_path_1.default.dirname(filePath), { recursive: true });
    await node_fs_1.promises.writeFile(filePath, `${content.trimEnd()}\n`, 'utf8');
}
async function copyTemplateArtifacts(templateRoot, outputRoot) {
    const templateSourceRoot = node_path_1.default.join(templateRoot, 'src');
    try {
        await node_fs_1.promises.access(templateSourceRoot);
        await node_fs_1.promises.cp(templateSourceRoot, node_path_1.default.join(outputRoot, 'src'), { recursive: true, force: true });
    }
    catch {
        // No template source tree is acceptable for early metadata-only slices.
    }
}
async function emitPatchedForms(outputRoot, forms) {
    for (const form of forms.filter((entry) => entry.supported)) {
        const formPath = node_path_1.default.join(outputRoot, form.relativePath);
        const existingXml = await node_fs_1.promises.readFile(formPath, 'utf8');
        const patchedXml = patchFormXml(existingXml, form);
        await writeTextFile(formPath, patchedXml);
    }
}
async function emitBehaviorWebResources(outputRoot, behaviors) {
    for (const behavior of behaviors.filter((entry) => entry.supported)) {
        const filePath = node_path_1.default.join(outputRoot, behavior.relativePath);
        await writeTextFile(filePath, behavior.content);
        await writeTextFile(`${filePath}.data.xml`, createWebResourceMetadata(behavior));
    }
}
async function emitGeneratedMetadataSolution(plan, outputRoot, templateRoot = node_path_1.default.join(node_path_1.default.dirname(outputRoot), 'template')) {
    const otherRoot = node_path_1.default.join(outputRoot, 'src', 'Other');
    const entitiesRoot = node_path_1.default.join(outputRoot, 'src', 'Entities');
    const relationshipsRoot = node_path_1.default.join(outputRoot, 'src', 'Other', 'Relationships');
    await node_fs_1.promises.rm(outputRoot, { recursive: true, force: true });
    await node_fs_1.promises.mkdir(outputRoot, { recursive: true });
    await copyTemplateArtifacts(templateRoot, outputRoot);
    await node_fs_1.promises.mkdir(otherRoot, { recursive: true });
    await node_fs_1.promises.mkdir(entitiesRoot, { recursive: true });
    await node_fs_1.promises.mkdir(relationshipsRoot, { recursive: true });
    await writeTextFile(node_path_1.default.join(otherRoot, 'Solution.xml'), createSolutionXml(plan));
    await writeTextFile(node_path_1.default.join(otherRoot, 'Customizations.xml'), createCustomizationsXml());
    await writeTextFile(node_path_1.default.join(otherRoot, 'Relationships.xml'), createRelationshipsIndex(plan.relationships));
    await writeTextFile(node_path_1.default.join(outputRoot, 'dbm-generated-metadata.plan.json'), JSON.stringify(plan, null, 2));
    for (const entity of plan.entities) {
        const entityRoot = node_path_1.default.join(entitiesRoot, (0, common_1.sanitizeFileName)(entity.schemaName));
        await writeTextFile(node_path_1.default.join(entityRoot, 'Entity.xml'), writeEntityPlan(entity));
        await writeTextFile(node_path_1.default.join(entityRoot, 'RibbonDiff.xml'), '<RibbonDiffXml />');
    }
    for (const relationship of plan.relationships.filter((entry) => entry.supported)) {
        await writeTextFile(node_path_1.default.join(relationshipsRoot, `${(0, common_1.sanitizeFileName)(relationship.schemaName)}.xml`), writeRelationshipPlan(relationship));
    }
    await emitPatchedForms(outputRoot, plan.forms);
    await emitBehaviorWebResources(outputRoot, plan.behaviors);
}
