import test from 'node:test';
import assert from 'node:assert/strict';

import { loadCaseCatalog } from '../src/case-loader.js';

test('live E2E case catalog loads and keeps scenario ids unique', () => {
  const caseCatalog = loadCaseCatalog();
  assert.ok(caseCatalog.length >= 5);

  const scenarioIds = new Set(caseCatalog.map((entry) => entry.scenarioId));
  assert.equal(scenarioIds.size, caseCatalog.length);
});

test('live E2E case catalog contains the deterministic core suite', () => {
  const caseCatalog = loadCaseCatalog();
  const scenarioIds = new Set(caseCatalog.map((entry) => entry.scenarioId));

  for (const scenarioId of [
    'create-request-draft',
    'submit-request-advance',
    'hidden-internal-stage-projection',
    'approval-path',
    'rejection-path'
  ]) {
    assert.ok(scenarioIds.has(scenarioId), `Expected deterministic live case '${scenarioId}' to exist.`);
  }
});

test('live E2E case catalog no longer relies on tracked test-user credential tokens', () => {
  const caseCatalog = loadCaseCatalog();
  const serialized = JSON.stringify(caseCatalog);

  assert.equal(serialized.includes('testUsers.'), false);
  assert.equal(serialized.includes('session.userDisplayName'), true);
});
