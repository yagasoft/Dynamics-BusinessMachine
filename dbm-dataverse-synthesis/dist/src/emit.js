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
    manifest.ele('Version').txt('0.2.0.0');
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
function writeEntityPlan(entity) {
    const root = (0, xmlbuilder2_1.create)({ version: '1.0', encoding: 'utf-8' }).ele('Entity', {
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
    });
    root.ele('Name', { LocalizedName: entity.displayName, OriginalName: '' }).txt(entity.logicalName);
    const info = root.ele('EntityInfo').ele('entity', { Name: entity.logicalName, unmodified: '0' });
    const attributes = info.ele('attributes');
    for (const column of entity.columns.filter((entry) => entry.supported)) {
        const attribute = attributes.ele('attribute', {
            PhysicalName: column.logicalName,
            Name: column.logicalName
        });
        attribute.ele('Type').txt(column.attributeType);
        attribute.ele('LogicalName').txt(column.logicalName);
        attribute.ele('SchemaName').txt(column.schemaName);
        attribute.ele('DisplayName').txt(column.displayName);
        attribute.ele('RequiredLevel').txt(column.required ? 'ApplicationRequired' : 'None');
        attribute.ele('IsPrimaryName').txt(column.isPrimaryNameAttribute ? '1' : '0');
        if (column.attributeType === 'Lookup' && column.lookupTargetLogicalName) {
            const targets = attribute.ele('Targets');
            targets.ele('Target').txt(column.lookupTargetLogicalName);
        }
        if (column.attributeType === 'Picklist' && column.choiceOptions) {
            const options = attribute.ele('Options');
            for (const option of column.choiceOptions) {
                options.ele('Option', {
                    Value: String(option.value),
                    Id: option.id,
                    Label: option.displayName
                });
            }
        }
    }
    root.ele('FormXml');
    root.ele('RibbonDiffXml');
    return root.end({ prettyPrint: true });
}
function writeRelationshipPlan(relationship) {
    const root = (0, xmlbuilder2_1.create)({ version: '1.0', encoding: 'utf-8' }).ele('EntityRelationship');
    root.ele('Name').txt(relationship.logicalName);
    root.ele('SchemaName').txt(relationship.schemaName);
    root.ele('RelationshipType').txt(relationship.relationshipType);
    root.ele('ReferencedEntity').txt(relationship.referencedEntityLogicalName);
    root.ele('ReferencingEntity').txt(relationship.referencingEntityLogicalName);
    root.ele('ReferencingAttribute').txt(relationship.referencingAttributeLogicalName ?? '');
    return root.end({ prettyPrint: true });
}
async function writeTextFile(filePath, content) {
    await node_fs_1.promises.mkdir(node_path_1.default.dirname(filePath), { recursive: true });
    await node_fs_1.promises.writeFile(filePath, `${content.trimEnd()}\n`, 'utf8');
}
async function emitGeneratedMetadataSolution(plan, outputRoot) {
    const otherRoot = node_path_1.default.join(outputRoot, 'src', 'Other');
    const entitiesRoot = node_path_1.default.join(outputRoot, 'src', 'Entities');
    const relationshipsRoot = node_path_1.default.join(outputRoot, 'src', 'Other', 'Relationships');
    await node_fs_1.promises.rm(outputRoot, { recursive: true, force: true });
    await node_fs_1.promises.mkdir(otherRoot, { recursive: true });
    await node_fs_1.promises.mkdir(entitiesRoot, { recursive: true });
    await node_fs_1.promises.mkdir(relationshipsRoot, { recursive: true });
    await writeTextFile(node_path_1.default.join(otherRoot, 'Solution.xml'), createSolutionXml(plan));
    await writeTextFile(node_path_1.default.join(otherRoot, 'Customizations.xml'), createCustomizationsXml());
    await writeTextFile(node_path_1.default.join(outputRoot, 'dbm-generated-metadata.plan.json'), JSON.stringify(plan, null, 2));
    for (const entity of plan.entities) {
        const entityRoot = node_path_1.default.join(entitiesRoot, (0, common_1.sanitizeFileName)(entity.schemaName));
        await writeTextFile(node_path_1.default.join(entityRoot, 'Entity.xml'), writeEntityPlan(entity));
        await writeTextFile(node_path_1.default.join(entityRoot, 'RibbonDiff.xml'), '<RibbonDiffXml />');
    }
    for (const relationship of plan.relationships.filter((entry) => entry.supported)) {
        await writeTextFile(node_path_1.default.join(relationshipsRoot, `${(0, common_1.sanitizeFileName)(relationship.schemaName)}.xml`), writeRelationshipPlan(relationship));
    }
}
