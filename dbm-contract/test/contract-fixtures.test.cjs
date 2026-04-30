const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const Ajv = require('ajv');

const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..');
const schemaRoot = path.join(projectRoot, 'schema');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function compileSchema(fileName) {
  const ajv = new Ajv({
    allErrors: true,
    strict: false
  });

  return ajv.compile(loadJson(path.join(schemaRoot, fileName)));
}

function expectValid(validator, payload, label) {
  assert.equal(
    validator(payload),
    true,
    `${label} should satisfy the completed contract fixture. ${JSON.stringify(validator.errors || [])}`
  );
}

function expectInvalid(validator, payload, label, predicate) {
  assert.equal(validator(payload), false, `${label} should be rejected.`);
  assert.equal(
    (validator.errors || []).some(predicate),
    true,
    `${label} did not fail with the expected schema error. ${JSON.stringify(validator.errors || [])}`
  );
}

test('R1.1 canonical approval request model fixture satisfies DbmModelV1', () => {
  const validateModel = compileSchema('dbm-model-v1.schema.json');
  const model = loadJson(path.join(repoRoot, 'docs', 'architecture', 'examples', 'approval-request-v1.model.json'));

  expectValid(validateModel, model, 'approval request model');
});

test('R2.1 designer workspace rejects canonical model leakage', () => {
  const validateWorkspace = compileSchema('dbm-designer-workspace-v1.schema.json');
  const workspace = loadJson(path.join(projectRoot, 'fixtures', 'invalid', 'designer-workspace-canonical-leakage-v1.json'));

  expectInvalid(
    validateWorkspace,
    workspace,
    'designer workspace canonical leakage fixture',
    (error) => error.keyword === 'additionalProperties' && error.params?.additionalProperty === 'process'
  );
});

test('R2.1 graph document rejects library-native selection leakage', () => {
  const validateGraphDocument = compileSchema('dbm-designer-graph-document-v1.schema.json');
  const graphDocument = loadJson(path.join(projectRoot, 'fixtures', 'invalid', 'designer-graph-document-library-leakage-v1.json'));

  expectInvalid(
    validateGraphDocument,
    graphDocument,
    'designer graph document library leakage fixture',
    (error) => error.keyword === 'additionalProperties' && error.params?.additionalProperty === 'selected'
  );
});

test('R3.1 portal bootstrap fixture keeps local SPA proof contract explicit', () => {
  const validatePortalBootstrap = compileSchema('dbm-portal-runtime-bootstrap-v1.schema.json');
  const bootstrap = loadJson(path.join(projectRoot, 'fixtures', 'valid', 'portal-runtime-bootstrap-v1.json'));

  expectValid(validatePortalBootstrap, bootstrap, 'portal runtime bootstrap');
  assert.equal(bootstrap.identityMode, 'generic-profile');
  assert.deepEqual(bootstrap.allowedActions, ['create-draft', 'submit-request', 'refresh-status']);
  assert.equal(bootstrap.routes.entryPath, '/approval-request');
  assert.equal(bootstrap.routes.statusPath, '/approval-request/status');
});

