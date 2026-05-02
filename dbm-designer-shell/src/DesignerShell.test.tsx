import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DbmDesignerWorkspaceV1, DbmModelV1 } from 'dbm-contract';
import { createDefaultWorkspace } from 'dbm-designer-core';
import employeeOnboarding from '../../dbm-contract/fixtures/valid/generic-process-matrix/employee-onboarding.model.json';
import type { DbmHostModelPackageRecord } from './hostBridge';
import type { DbmPackageRepository } from './packageRepository';
import { DesignerShell } from './DesignerShell';

afterEach(() => {
  cleanup();
});

function createRecord(): DbmHostModelPackageRecord {
  const model = structuredClone(employeeOnboarding as DbmModelV1);
  const workspace = createDefaultWorkspace(model);
  return {
    modelId: null,
    workspaceId: null,
    packageName: model.package.id,
    displayName: model.package.displayName,
    modelName: 'ys_/dbm/data/models/dbm-employee-onboarding.json',
    workspaceName: 'ys_/dbm/data/models/dbm-employee-onboarding.workspace.json',
    modifiedOn: null,
    hasWorkspace: true,
    modelContent: JSON.stringify(model, null, 2),
    workspaceContent: JSON.stringify(workspace, null, 2)
  };
}

function createRepository(record: DbmHostModelPackageRecord, onSave = vi.fn()): DbmPackageRepository {
  return {
    kind: 'browser',
    listPackages: vi.fn(async () => [record]),
    loadPackage: vi.fn(async () => record),
    savePackage: vi.fn(async (nextRecord) => {
      onSave(nextRecord);
      return nextRecord;
    }),
    deletePackage: vi.fn(async () => undefined)
  };
}

describe('DesignerShell Timeline Studio', () => {
  it('renders main and sub-process lanes with hook placeholders', async () => {
    render(<DesignerShell repository={createRepository(createRecord())} />);

    expect(await screen.findByText('Timeline Studio')).toBeTruthy();
    expect(screen.getByText('Onboarding timeline')).toBeTruthy();
    expect(screen.getByText('IT readiness')).toBeTruthy();
    expect(screen.getByText('Stage hooks')).toBeTruthy();
    expect(screen.getByText('JavaScript hook placeholder')).toBeTruthy();
    expect(screen.getByText('Notification WYSIWYG placeholder')).toBeTruthy();
    expect(screen.getByText('Routing and SLA placeholders')).toBeTruthy();
  });

  it('saves process and stage authoring through processPortfolio only', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.fn();
    render(<DesignerShell repository={createRepository(createRecord(), saveSpy)} />);

    await screen.findByText('Timeline Studio');
    await user.click(screen.getByRole('button', { name: 'Add sub-process' }));
    await user.click(screen.getByRole('button', { name: 'Add stage' }));
    await user.click(screen.getByRole('button', { name: 'Save package' }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    const saved = JSON.parse(saveSpy.mock.calls.at(-1)?.[0].modelContent) as DbmModelV1 & { process?: unknown };
    const addedProcess = saved.processPortfolio.processes.find((process) => process.id === 'sub-process');

    expect(saved.process).toBeUndefined();
    expect(addedProcess?.role).toBe('sub-process');
    expect(addedProcess?.stages[0]?.stageCategory).toBe('work');
    expect(addedProcess?.stages[0]?.stageKindId).toBe('work');
  });

  it('round-trips span and visibility edits', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.fn();
    render(<DesignerShell repository={createRepository(createRecord(), saveSpy)} />);

    await screen.findByText('Timeline Studio');
    await user.selectOptions(screen.getByLabelText('Selected process'), 'it-readiness');
    await user.selectOptions(screen.getByLabelText('Selected stage'), 'prepare-access');
    await user.clear(screen.getByLabelText('Span start fraction'));
    await user.type(screen.getByLabelText('Span start fraction'), '0.4');
    await user.selectOptions(screen.getByLabelText('Portal visibility rule'), 'show-it-readiness:false');
    await user.click(screen.getByRole('button', { name: 'Save package' }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    const saved = JSON.parse(saveSpy.mock.calls.at(-1)?.[0].modelContent) as DbmModelV1;
    const process = saved.processPortfolio.processes.find((entry) => entry.id === 'it-readiness');
    const stage = process?.stages.find((entry) => entry.id === 'prepare-access');

    expect(stage?.stageSpan.start.fraction).toBe(0.4);
    expect(process?.subProcessVisibility).toContainEqual({
      audience: 'portal',
      ruleId: 'show-it-readiness',
      visibleWhen: false
    });
  });
});
