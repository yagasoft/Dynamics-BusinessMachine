const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const test = require('node:test');
const Ajv = require('ajv');

const projectRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(projectRoot, '..');
const schemaRoot = path.join(projectRoot, 'schema');
const genericMatrixRoot = path.join(projectRoot, 'fixtures', 'valid', 'generic-process-matrix');
const {
  createProcessPortfolioProjectionV1,
  validateProcessPortfolioModelV1
} = require(path.join(projectRoot, 'dist', 'index.js'));

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

function expectedGenericMatrixFixtureNames() {
  return [
    'linear-service-fulfilment.model.json',
    'employee-onboarding.model.json',
    'case-investigation.model.json',
    'document-lifecycle.model.json',
    'field-inspection.model.json'
  ];
}

function assertNoApprovalSpecificContractKeys(value, location = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoApprovalSpecificContractKeys(item, `${location}[${index}]`));
    return;
  }

  if (!value || typeof value !== 'object') {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    assert.notEqual(key, 'scenarioType', `${location}.${key} should be replaced by processTypeId`);
    assert.notEqual(key, 'actorType', `${location}.${key} should be replaced by actorCategory and roleKey`);
    assert.notEqual(key, 'stageType', `${location}.${key} should be replaced by stageCategory and stageKindId`);
    assert.notEqual(key, 'taskType', `${location}.${key} should be replaced by workCategory and workKindId`);
    assert.notEqual(key, 'stepType', `${location}.${key} should be replaced by workCategory and workKindId`);
    assertNoApprovalSpecificContractKeys(child, `${location}.${key}`);
  }
}

test('R1.2 generic process fixture matrix is the active DbmModelV1 proof', () => {
  const validateModel = compileSchema('dbm-model-v1.schema.json');

  for (const fixtureName of expectedGenericMatrixFixtureNames()) {
    const fixturePath = path.join(genericMatrixRoot, fixtureName);
    assert.equal(fs.existsSync(fixturePath), true, `generic process fixture is missing: ${fixtureName}`);

    const model = loadJson(fixturePath);
    expectValid(validateModel, model, fixtureName);
    assert.deepEqual(validateProcessPortfolioModelV1(model), [], `${fixtureName} should satisfy executable portfolio validation`);
    assertNoApprovalSpecificContractKeys(model);
  }
});

test('R1.2 generic process vocabulary accepts user-defined process, role, stage, and work kind IDs', () => {
  const model = loadJson(path.join(genericMatrixRoot, 'employee-onboarding.model.json'));
  const mainProcess = model.processPortfolio.processes.find((process) => process.id === model.processPortfolio.mainProcessId);

  assert.equal(mainProcess.processTypeId, 'employee-onboarding');
  assert.equal(mainProcess.actors.some((actor) => actor.actorCategory === 'team' && actor.roleKey === 'people-operations'), true);
  assert.equal(mainProcess.stages.some((stage) => stage.stageCategory === 'milestone' && stage.stageKindId === 'employment-start'), true);
  assert.equal(mainProcess.tasks.some((task) => task.workCategory === 'work' && task.workKindId === 'prepare-workspace'), true);
  assert.equal(mainProcess.steps.some((step) => step.workCategory === 'work' && step.workKindId === 'provision-access'), true);
});

test('R1.2 projections are domain-neutral across the generic fixture matrix', () => {
  for (const fixtureName of expectedGenericMatrixFixtureNames()) {
    const model = loadJson(path.join(genericMatrixRoot, fixtureName));
    const projection = createProcessPortfolioProjectionV1(model, {
      audience: 'form',
      ruleResults: Object.fromEntries(model.rules.map((rule) => [rule.id, true]))
    });
    const projectionJson = JSON.stringify(projection).toLowerCase();

    assert.equal(projection.portalRuntimeInvoked, false);
    assert.equal(projection.processIdAuthority, 'processPortfolio.mainProcessId');
    assert.equal(projectionJson.includes('approval'), false, `${fixtureName} projection should not depend on approval naming`);
    assert.equal(projectionJson.includes('approver'), false, `${fixtureName} projection should not depend on approver naming`);
    assert.equal(projectionJson.includes('requester'), false, `${fixtureName} projection should not depend on requester naming`);
  }
});

test('R1.1 historical approval request model fixture remains reference-only compatible', () => {
  const validateModel = compileSchema('dbm-model-v1.schema.json');
  const model = loadJson(path.join(repoRoot, 'docs', 'architecture', 'examples', 'approval-request-v1.model.json'));

  expectValid(validateModel, model, 'approval request model');
});

test('R1.1 process portfolio fixture validates against DbmModelV1 schema', () => {
  const validateModel = compileSchema('dbm-model-v1.schema.json');
  const model = loadJson(path.join(projectRoot, 'fixtures', 'valid', 'process-portfolio-r1-1.model.json'));

  expectValid(validateModel, model, 'R1.1 process portfolio model');
  assert.equal(model.processPortfolio.mainProcessId, 'approval-main');
  assert.equal(model.package.entryProcessId, 'legacy-entry-not-authoritative');
});

test('R1.1 executable validation rejects an unresolved main process', () => {
  assert.equal(typeof validateProcessPortfolioModelV1, 'function');

  const model = loadJson(path.join(projectRoot, 'fixtures', 'valid', 'process-portfolio-r1-1.model.json'));
  model.processPortfolio.mainProcessId = 'missing-main';

  const issues = validateProcessPortfolioModelV1(model);

  assert.equal(issues.some((issue) => issue.code === 'main-process-not-found'), true);
});

test('R1.1 form projection always includes the main process from processPortfolio.mainProcessId', () => {
  assert.equal(typeof createProcessPortfolioProjectionV1, 'function');

  const model = loadJson(path.join(projectRoot, 'fixtures', 'valid', 'process-portfolio-r1-1.model.json'));
  const projection = createProcessPortfolioProjectionV1(model, {
    audience: 'form',
    ruleResults: {
      'show-internal-screening-on-form': true,
      'show-portal-follow-up-on-form': false
    }
  });

  assert.equal(projection.mainProcess.id, 'approval-main');
  assert.equal(projection.processIdAuthority, 'processPortfolio.mainProcessId');
  assert.equal(projection.mainProcess.statusId, 'under-review');
});

test('R1.1 sub-process visibility is evaluated separately for form and portal audiences', () => {
  const model = loadJson(path.join(projectRoot, 'fixtures', 'valid', 'process-portfolio-r1-1.model.json'));
  const formProjection = createProcessPortfolioProjectionV1(model, {
    audience: 'form',
    ruleResults: {
      'show-internal-screening-on-form': true,
      'show-internal-screening-on-portal': false,
      'show-portal-follow-up-on-form': false,
      'show-portal-follow-up-on-portal': true
    }
  });
  const portalProjection = createProcessPortfolioProjectionV1(model, {
    audience: 'portal',
    ruleResults: {
      'show-internal-screening-on-form': true,
      'show-internal-screening-on-portal': false,
      'show-portal-follow-up-on-form': false,
      'show-portal-follow-up-on-portal': true
    }
  });

  assert.deepEqual(formProjection.subProcesses.map((process) => process.id), ['internal-screening']);
  assert.deepEqual(portalProjection.subProcesses.map((process) => process.id), ['portal-follow-up']);
});

test('R1.1 active contract rejects historical flat stageSpan data', () => {
  const validateModel = compileSchema('dbm-model-v1.schema.json');
  const model = loadJson(path.join(projectRoot, 'fixtures', 'valid', 'process-portfolio-r1-1.model.json'));

  model.processPortfolio.processes[0].stages[0].stageSpan = {
    start: { stageId: 'approval-draft', fraction: 0 },
    end: { stageId: 'approval-draft', fraction: 1 }
  };

  expectInvalid(
    validateModel,
    model,
    'historical stageSpan model',
    (error) => error.keyword === 'additionalProperties' && error.params?.additionalProperty === 'stageSpan'
  );
});

test('R1.1 stage-owned child process references validate nested process hierarchy', () => {
  const model = loadJson(path.join(genericMatrixRoot, 'employee-onboarding.model.json'));
  const rootProcess = model.processPortfolio.processes.find((process) => process.id === model.processPortfolio.mainProcessId);
  const preparationStage = rootProcess.stages.find((stage) => stage.id === 'preparation');
  const itProcess = model.processPortfolio.processes.find((process) => process.id === 'it-readiness');
  const accessStage = itProcess.stages.find((stage) => stage.id === 'prepare-access');

  assert.deepEqual(validateProcessPortfolioModelV1(model), []);
  assert.deepEqual(preparationStage.childProcessRefs, [
    {
      id: 'spawn-it-readiness',
      processId: 'it-readiness',
      displayName: 'IT readiness',
      activationRuleId: 'show-it-readiness',
      blocksParent: true
    }
  ]);
  assert.deepEqual(accessStage.childProcessRefs, [
    {
      id: 'spawn-access-review',
      processId: 'access-review',
      displayName: 'Access review',
      activationRuleId: null,
      blocksParent: true
    }
  ]);
});

test('R1.1 hierarchy validation rejects missing, duplicate, circular, and invalid child process refs', () => {
  const model = loadJson(path.join(genericMatrixRoot, 'employee-onboarding.model.json'));
  const rootProcess = model.processPortfolio.processes.find((process) => process.id === model.processPortfolio.mainProcessId);
  const preparationStage = rootProcess.stages.find((stage) => stage.id === 'preparation');

  preparationStage.childProcessRefs.push({
    id: 'missing-child',
    processId: 'missing-process',
    displayName: 'Missing child',
    activationRuleId: null,
    blocksParent: true
  });
  assert.equal(validateProcessPortfolioModelV1(model).some((issue) => issue.code === 'child-process-target-not-found'), true);

  preparationStage.childProcessRefs.at(-1).processId = 'facilities-readiness';
  preparationStage.childProcessRefs.at(-1).id = 'spawn-it-readiness';
  assert.equal(validateProcessPortfolioModelV1(model).some((issue) => issue.code === 'duplicate-child-process-ref'), true);

  preparationStage.childProcessRefs.at(-1).id = 'spawn-facilities-readiness';
  preparationStage.childProcessRefs.at(-1).blocksParent = 'yes';
  assert.equal(validateProcessPortfolioModelV1(model).some((issue) => issue.code === 'child-process-blocking-invalid'), true);

  preparationStage.childProcessRefs.at(-1).blocksParent = true;
  const accessReview = model.processPortfolio.processes.find((process) => process.id === 'access-review');
  accessReview.stages[0].childProcessRefs.push({
    id: 'cycle-to-root',
    processId: 'onboarding-main',
    displayName: 'Cycle to root',
    activationRuleId: null,
    blocksParent: true
  });
  assert.equal(validateProcessPortfolioModelV1(model).some((issue) => issue.code === 'child-process-cycle'), true);
});

test('R1.1 collapsed main-process projection preserves business-user process status', () => {
  const model = loadJson(path.join(projectRoot, 'fixtures', 'valid', 'process-portfolio-r1-1.model.json'));
  const projection = createProcessPortfolioProjectionV1(model, {
    audience: 'form',
    mainDisplayMode: 'collapsed',
    ruleResults: {}
  });

  assert.equal(projection.mainProcess.displayMode, 'collapsed');
  assert.equal(projection.mainProcess.statusId, 'under-review');
  assert.equal(projection.mainProcess.portalStatusId, 'under-review');
});

test('R1.1 portal projection contract output validates without portal runtime', () => {
  const validateProjection = compileSchema('dbm-process-portfolio-projection-v1.schema.json');
  const model = loadJson(path.join(projectRoot, 'fixtures', 'valid', 'process-portfolio-r1-1.model.json'));
  const projection = createProcessPortfolioProjectionV1(model, {
    audience: 'portal',
    ruleResults: {
      'show-internal-screening-on-portal': false,
      'show-portal-follow-up-on-portal': true
    }
  });

  expectValid(validateProjection, projection, 'portal projection contract');
  assert.equal(projection.schemaVersion, 'dbm.process-portfolio.projection/v1');
  assert.equal(projection.audience, 'portal');
  assert.equal(projection.portalRuntimeInvoked, false);
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

