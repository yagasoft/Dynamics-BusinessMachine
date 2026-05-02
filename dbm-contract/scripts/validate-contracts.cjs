const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const {
  createProcessPortfolioProjectionV1,
  validateProcessPortfolioModelV1
} = require('../dist/index.js');

const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..');
const schemaRoot = path.join(projectRoot, 'schema');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function formatErrors(errors) {
  return (errors || [])
    .map((error) => {
      const location = error.instancePath || '/';
      return `${location}: ${error.message}`;
    })
    .join('\n');
}

function runPositiveValidation(validator, label, filePath) {
  const payload = loadJson(filePath);
  const valid = validator(payload);
  if (!valid) {
    throw new Error(`Validation failed for ${label}:\n${formatErrors(validator.errors)}`);
  }

  console.log(`Validated ${label}`);
}

function runExpectedFailureValidation(validator, label, filePath, expectation) {
  const payload = loadJson(filePath);
  const valid = validator(payload);
  if (valid) {
    throw new Error(`Expected ${label} to fail validation, but it passed.`);
  }

  const matched = (validator.errors || []).some(expectation);
  if (!matched) {
    throw new Error(
      `Expected ${label} to fail with the required condition, but got:\n${formatErrors(validator.errors)}`
    );
  }

  console.log(`Rejected ${label} as expected`);
}

const ajv = new Ajv({
  allErrors: true,
  strict: false
});

const modelSchema = loadJson(path.join(schemaRoot, 'dbm-model-v1.schema.json'));
const processPortfolioProjectionSchema = loadJson(path.join(schemaRoot, 'dbm-process-portfolio-projection-v1.schema.json'));
const workspaceSchema = loadJson(path.join(schemaRoot, 'dbm-designer-workspace-v1.schema.json'));
const graphDocumentSchema = loadJson(path.join(schemaRoot, 'dbm-designer-graph-document-v1.schema.json'));
const snapshotSchema = loadJson(path.join(schemaRoot, 'dbm-process-experience-snapshot-v1.schema.json'));
const requestSchema = loadJson(path.join(schemaRoot, 'dbm-runtime-request-v1.schema.json'));
const resultSchema = loadJson(path.join(schemaRoot, 'dbm-runtime-result-v1.schema.json'));
const portalBootstrapSchema = loadJson(path.join(schemaRoot, 'dbm-portal-runtime-bootstrap-v1.schema.json'));

const validateWorkspace = ajv.compile(workspaceSchema);
const validateGraphDocument = ajv.compile(graphDocumentSchema);
const validateSnapshot = ajv.compile(snapshotSchema);
const validateRequest = ajv.compile(requestSchema);
const validateResult = ajv.compile(resultSchema);
const validatePortalBootstrap = ajv.compile(portalBootstrapSchema);
const validateModel = ajv.compile(modelSchema);
const validateProcessPortfolioProjection = ajv.compile(processPortfolioProjectionSchema);

const genericMatrixRoot = path.join(projectRoot, 'fixtures', 'valid', 'generic-process-matrix');
const genericMatrixFixtureNames = [
  'linear-service-fulfilment.model.json',
  'employee-onboarding.model.json',
  'case-investigation.model.json',
  'document-lifecycle.model.json',
  'field-inspection.model.json'
];

for (const fixtureName of genericMatrixFixtureNames) {
  const fixturePath = path.join(genericMatrixRoot, fixtureName);
  runPositiveValidation(validateModel, `R1.2 generic process matrix fixture ${fixtureName}`, fixturePath);

  const genericModel = loadJson(fixturePath);
  const genericIssues = validateProcessPortfolioModelV1(genericModel);
  if (genericIssues.length > 0) {
    throw new Error(
      `R1.2 generic process matrix executable validation failed for ${fixtureName}:\n${JSON.stringify(genericIssues, null, 2)}`
    );
  }

  const genericProjection = createProcessPortfolioProjectionV1(genericModel, {
    audience: 'form',
    ruleResults: Object.fromEntries(genericModel.rules.map((rule) => [rule.id, true]))
  });
  if (!validateProcessPortfolioProjection(genericProjection)) {
    throw new Error(
      `R1.2 generic process matrix projection validation failed for ${fixtureName}:\n${formatErrors(validateProcessPortfolioProjection.errors)}`
    );
  }
}

runPositiveValidation(
  validateModel,
  'historical approval/request reference model',
  path.join(repoRoot, 'docs', 'architecture', 'examples', 'approval-request-v1.model.json')
);

const processPortfolioModelPath = path.join(projectRoot, 'fixtures', 'valid', 'process-portfolio-r1-1.model.json');
runPositiveValidation(
  validateModel,
  'valid R1.1 process portfolio model fixture',
  processPortfolioModelPath
);

const processPortfolioModel = loadJson(processPortfolioModelPath);
const processPortfolioIssues = validateProcessPortfolioModelV1(processPortfolioModel);
if (processPortfolioIssues.length > 0) {
  throw new Error(`R1.1 process portfolio executable validation failed:\n${JSON.stringify(processPortfolioIssues, null, 2)}`);
}

const processPortfolioProjection = createProcessPortfolioProjectionV1(processPortfolioModel, {
  audience: 'portal',
  ruleResults: {
    'show-internal-screening-on-portal': false,
    'show-portal-follow-up-on-portal': true
  }
});
if (!validateProcessPortfolioProjection(processPortfolioProjection)) {
  throw new Error(`R1.1 process portfolio projection validation failed:\n${formatErrors(validateProcessPortfolioProjection.errors)}`);
}

runPositiveValidation(
  validateWorkspace,
  'valid designer workspace fixture',
  path.join(projectRoot, 'fixtures', 'valid', 'designer-workspace-v1.json')
);

runPositiveValidation(
  validateGraphDocument,
  'valid designer graph document fixture',
  path.join(projectRoot, 'fixtures', 'valid', 'designer-graph-document-v1.json')
);

runPositiveValidation(
  validateSnapshot,
  'valid process experience snapshot fixture',
  path.join(projectRoot, 'fixtures', 'valid', 'process-experience-snapshot-v1.json')
);

const hierarchySnapshotPath = path.join(projectRoot, 'fixtures', 'valid', 'process-experience-hierarchy-snapshot-v1.json');
runPositiveValidation(
  validateSnapshot,
  'valid process experience hierarchy snapshot fixture',
  hierarchySnapshotPath
);

const hierarchySnapshot = loadJson(hierarchySnapshotPath);
if (hierarchySnapshot.rootProcess?.id !== 'onboarding-main') {
  throw new Error('R1.4 process experience hierarchy snapshot fixture must carry the root parent process context.');
}

if (hierarchySnapshot.activeProcess?.id !== 'it-readiness') {
  throw new Error('R1.4 process experience hierarchy snapshot fixture must carry the active child process context.');
}

if (hierarchySnapshot.blockedParentStage?.parentStageId !== 'preparation') {
  throw new Error('R1.4 process experience hierarchy snapshot fixture must carry the blocked parent stage context.');
}

runPositiveValidation(
  validateRequest,
  'valid runtime request fixture',
  path.join(projectRoot, 'fixtures', 'valid', 'runtime-request-v1.json')
);

runPositiveValidation(
  validateResult,
  'valid runtime result fixture',
  path.join(projectRoot, 'fixtures', 'valid', 'runtime-result-v1.json')
);

runPositiveValidation(
  validatePortalBootstrap,
  'valid portal runtime bootstrap fixture',
  path.join(projectRoot, 'fixtures', 'valid', 'portal-runtime-bootstrap-v1.json')
);

runExpectedFailureValidation(
  validateModel,
  'invalid model fixture',
  path.join(projectRoot, 'fixtures', 'invalid', 'model-missing-stage-step-flow-v1.json'),
  (error) => error.keyword === 'required' && error.params && error.params.missingProperty === 'stepIds'
);

runExpectedFailureValidation(
  validateWorkspace,
  'invalid designer workspace fixture with canonical leakage',
  path.join(projectRoot, 'fixtures', 'invalid', 'designer-workspace-canonical-leakage-v1.json'),
  (error) => error.keyword === 'additionalProperties' && error.params && error.params.additionalProperty === 'process'
);

runExpectedFailureValidation(
  validateGraphDocument,
  'invalid designer graph document fixture with library leakage',
  path.join(projectRoot, 'fixtures', 'invalid', 'designer-graph-document-library-leakage-v1.json'),
  (error) => error.keyword === 'additionalProperties' && error.params && error.params.additionalProperty === 'selected'
);
