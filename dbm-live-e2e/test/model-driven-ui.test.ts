import test from 'node:test';
import assert from 'node:assert/strict';

import { getKnownModelDrivenPageIssue } from '../src/model-driven-ui.js';

test('getKnownModelDrivenPageIssue detects unknown entity error pages', () => {
  const issue = getKnownModelDrivenPageIssue(
    'https://example.crm4.dynamics.com/_common/error/errorhandler.aspx?ErrorCode=0x80041102',
    "Microsoft Dynamics 365 Unknown Entity Name The entity name doesn't exist. Please specify an existing entity name."
  );

  assert.ok(issue);
  assert.match(issue, /Unknown Entity Name/i);
  assert.match(issue, /errorhandler\.aspx/i);
});

test('getKnownModelDrivenPageIssue ignores normal model-driven pages', () => {
  const issue = getKnownModelDrivenPageIssue(
    'https://example.crm4.dynamics.com/main.aspx?forceUCI=1&pagetype=entityrecord&etn=account',
    'Account Main Form Save'
  );

  assert.equal(issue, null);
});
