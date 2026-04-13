import assert from 'node:assert/strict';
import test from 'node:test';
import { addNode, createApprovalRequestTemplate, loadModel, moveNode, removeNode, serializeModel, updateNode, validateDocument } from '../src/index';
import { PROCESS_ACTORS_NODE_ID, PROCESS_STAGES_NODE_ID, ruleNodeId } from '../src/node-ids';

test('approval request template round-trips through load and serialize', () => {
  const template = createApprovalRequestTemplate();
  const document = loadModel(template);

  assert.equal(document.tree.length, 1);
  assert.equal(document.tree[0].id, 'document:root');
  assert.deepEqual(serializeModel(document), template);
});

test('designer commands preserve author order and update document state', () => {
  let document = loadModel(createApprovalRequestTemplate());

  document = addNode(document, {
    kind: 'actor',
    parentId: PROCESS_ACTORS_NODE_ID,
    value: {
      id: 'finance-reviewer',
      displayName: 'Finance Reviewer',
      actorType: 'approver',
      source: 'field-binding'
    }
  }).document;
  assert.equal(document.model.process.actors.at(-1)?.id, 'finance-reviewer');

  document = moveNode(document, {
    nodeId: 'stage:manager-review',
    targetIndex: 0
  }).document;
  assert.equal(document.model.process.stages[0]?.id, 'manager-review');

  document = updateNode(document, {
    nodeId: 'section:package',
    value: {
      displayName: 'DBM Approval Request Designer'
    }
  }).document;
  assert.equal(document.model.package.displayName, 'DBM Approval Request Designer');

  document = removeNode(document, {
    nodeId: ruleNodeId('request-status-persist')
  }).document;
  assert.equal(document.model.rules.some((rule) => rule.id === 'request-status-persist'), false);
});

test('semantic validation catches broken references', () => {
  const model = createApprovalRequestTemplate();
  model.process.stages[0].actorId = 'missing-actor';
  model.forms[0].elements[0].binding = {
    fieldId: 'missing-field'
  };

  const issues = validateDocument(loadModel(model));

  assert.equal(issues.some((entry) => entry.code === 'missing-stage-actor'), true);
  assert.equal(issues.some((entry) => entry.code === 'missing-element-field-binding'), true);
});

test('template validates without error-level issues', () => {
  const document = loadModel(createApprovalRequestTemplate());
  const issues = validateDocument(document);
  const errorIssues = issues.filter((issue) => issue.level === 'error');

  assert.deepEqual(errorIssues, []);
  assert.equal(issues.some((issue) => issue.code === 'non-condition-transition-guard'), true);
  assert.equal(Array.isArray(document.index[PROCESS_STAGES_NODE_ID].children), true);
});
