const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const projectRoot = path.resolve(__dirname, '..');
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
const requestSchema = loadJson(path.join(schemaRoot, 'dbm-runtime-request-v1.schema.json'));
const resultSchema = loadJson(path.join(schemaRoot, 'dbm-runtime-result-v1.schema.json'));

const validateRequest = ajv.compile(requestSchema);
const validateResult = ajv.compile(resultSchema);
const validateModel = ajv.compile(modelSchema);

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

runExpectedFailureValidation(
  validateModel,
  'invalid model fixture',
  path.join(projectRoot, 'fixtures', 'invalid', 'model-missing-package-v1.json'),
  (error) => error.keyword === 'required' && error.params && error.params.missingProperty === 'package'
);
