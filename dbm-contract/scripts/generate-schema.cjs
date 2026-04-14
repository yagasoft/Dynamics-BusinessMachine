const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const TJS = require('typescript-json-schema');

const projectRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(projectRoot, 'src', 'index.ts');
const schemaRoot = path.join(projectRoot, 'schema');

const targets = [
  { typeName: 'DbmModelV1', fileName: 'dbm-model-v1.schema.json' },
  { typeName: 'DbmDesignerWorkspaceV1', fileName: 'dbm-designer-workspace-v1.schema.json' },
  { typeName: 'DbmDesignerGraphDocumentV1', fileName: 'dbm-designer-graph-document-v1.schema.json' },
  { typeName: 'DbmProcessExperienceSnapshotV1', fileName: 'dbm-process-experience-snapshot-v1.schema.json' },
  { typeName: 'DbmRuntimeRequestV1', fileName: 'dbm-runtime-request-v1.schema.json' },
  { typeName: 'DbmRuntimeResultV1', fileName: 'dbm-runtime-result-v1.schema.json' }
];

const compilerOptions = {
  strictNullChecks: true,
  skipLibCheck: true,
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  esModuleInterop: true
};

const settings = {
  required: true,
  noExtraProps: true,
  topRef: true,
  titles: true,
  ignoreErrors: false
};

const program = TJS.getProgramFromFiles([sourcePath], compilerOptions, projectRoot);

function patchRecordDefinition(schema, definitionName, additionalProperties) {
  const definitions = schema.definitions || {};
  const definition = definitions[definitionName];
  if (!definition) {
    return;
  }

  definition.additionalProperties = additionalProperties;
}

function patchRecordDefinitions(schema) {
  patchRecordDefinition(schema, 'Record<string,DbmScalarValueV1>', {
    type: ['string', 'number', 'boolean', 'null']
  });

  patchRecordDefinition(schema, 'Record<string,DbmDesignerNodeCanvasStateV1>', {
    type: 'object',
    properties: {
      x: {
        type: 'number'
      },
      y: {
        type: 'number'
      }
    },
    additionalProperties: false,
    required: ['x', 'y']
  });
}

for (const target of targets) {
  const schema = TJS.generateSchema(program, target.typeName, settings);
  if (!schema) {
    throw new Error(`Failed to generate JSON schema for ${target.typeName}.`);
  }

  patchRecordDefinitions(schema);

  if (!schema.$schema) {
    schema.$schema = 'http://json-schema.org/draft-07/schema#';
  }

  const outputPath = path.join(schemaRoot, target.fileName);
  fs.writeFileSync(outputPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
  console.log(`Generated ${path.relative(projectRoot, outputPath)}`);
}
