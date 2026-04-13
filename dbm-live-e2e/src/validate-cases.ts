import { loadCaseCatalog } from './case-loader.js';

const requiredScenarios = [
  'create-request-draft',
  'submit-request-advance',
  'hidden-internal-stage-projection',
  'approval-path',
  'rejection-path'
];

const caseCatalog = loadCaseCatalog();
const scenarioIds = new Set(caseCatalog.map((entry) => entry.scenarioId));

for (const scenarioId of requiredScenarios) {
  if (!scenarioIds.has(scenarioId)) {
    throw new Error(`Live E2E case catalog is missing required deterministic scenario '${scenarioId}'.`);
  }
}

console.log(`Validated ${caseCatalog.length} live E2E case definitions.`);
