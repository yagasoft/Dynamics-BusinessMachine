import test from 'node:test';
import assert from 'node:assert/strict';

import { buildModelDrivenRecordUrl, shouldRunModelDrivenSmoke } from '../src/portal-runtime-smoke.js';

test('portal runtime smoke builds model-driven record URLs without Power Pages routes', () => {
  const recordUrl = buildModelDrivenRecordUrl(
    {
      dataverseUrl: 'https://example.crm.dynamics.com/',
      entityLogicalName: 'dbm_request'
    },
    '11111111-1111-1111-1111-111111111111'
  );

  assert.equal(
    recordUrl,
    'https://example.crm.dynamics.com/main.aspx?forceUCI=1&pagetype=entityrecord&etn=dbm_request&id=11111111-1111-1111-1111-111111111111'
  );
  assert.equal(recordUrl.includes('powerpages'), false);
  assert.equal(recordUrl.includes('portal-runtime-context.js'), false);
});

test('portal runtime smoke treats model-driven verification as supplemental without a persisted session', () => {
  assert.equal(shouldRunModelDrivenSmoke({ persistedSessionStatePath: null }), false);
  assert.equal(shouldRunModelDrivenSmoke({ persistedSessionStatePath: '' }), false);
  assert.equal(shouldRunModelDrivenSmoke({ persistedSessionStatePath: 'C:/tmp/session-state.json' }), true);
});
