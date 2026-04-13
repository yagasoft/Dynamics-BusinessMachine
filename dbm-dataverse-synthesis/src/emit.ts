import { promises as fs } from 'node:fs';
import path from 'node:path';
import { create } from 'xmlbuilder2';
import { sanitizeFileName } from './common';
import type { DataverseEntityPlan, DataverseRelationshipPlan, DataverseSynthesisPlan } from './types';

function createSolutionXml(plan: DataverseSynthesisPlan): string {
  const root = create({ version: '1.0', encoding: 'utf-8' }).ele('ImportExportXml', {
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

function createCustomizationsXml(): string {
  const root = create({ version: '1.0', encoding: 'utf-8' }).ele('ImportExportXml', {
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

function writeEntityPlan(entity: DataverseEntityPlan): string {
  const root = create({ version: '1.0', encoding: 'utf-8' }).ele('Entity', {
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

function writeRelationshipPlan(relationship: DataverseRelationshipPlan): string {
  const root = create({ version: '1.0', encoding: 'utf-8' }).ele('EntityRelationship');
  root.ele('Name').txt(relationship.logicalName);
  root.ele('SchemaName').txt(relationship.schemaName);
  root.ele('RelationshipType').txt(relationship.relationshipType);
  root.ele('ReferencedEntity').txt(relationship.referencedEntityLogicalName);
  root.ele('ReferencingEntity').txt(relationship.referencingEntityLogicalName);
  root.ele('ReferencingAttribute').txt(relationship.referencingAttributeLogicalName ?? '');
  return root.end({ prettyPrint: true });
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${content.trimEnd()}\n`, 'utf8');
}

export async function emitGeneratedMetadataSolution(
  plan: DataverseSynthesisPlan,
  outputRoot: string
): Promise<void> {
  const otherRoot = path.join(outputRoot, 'src', 'Other');
  const entitiesRoot = path.join(outputRoot, 'src', 'Entities');
  const relationshipsRoot = path.join(outputRoot, 'src', 'Other', 'Relationships');

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(otherRoot, { recursive: true });
  await fs.mkdir(entitiesRoot, { recursive: true });
  await fs.mkdir(relationshipsRoot, { recursive: true });

  await writeTextFile(path.join(otherRoot, 'Solution.xml'), createSolutionXml(plan));
  await writeTextFile(path.join(otherRoot, 'Customizations.xml'), createCustomizationsXml());
  await writeTextFile(
    path.join(outputRoot, 'dbm-generated-metadata.plan.json'),
    JSON.stringify(plan, null, 2)
  );

  for (const entity of plan.entities) {
    const entityRoot = path.join(entitiesRoot, sanitizeFileName(entity.schemaName));
    await writeTextFile(path.join(entityRoot, 'Entity.xml'), writeEntityPlan(entity));
    await writeTextFile(path.join(entityRoot, 'RibbonDiff.xml'), '<RibbonDiffXml />');
  }

  for (const relationship of plan.relationships.filter((entry) => entry.supported)) {
    await writeTextFile(
      path.join(relationshipsRoot, `${sanitizeFileName(relationship.schemaName)}.xml`),
      writeRelationshipPlan(relationship)
    );
  }
}
