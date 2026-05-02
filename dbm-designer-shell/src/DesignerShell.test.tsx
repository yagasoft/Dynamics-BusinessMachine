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

describe('DesignerShell hierarchy studio', () => {
  it('renders parent and child process hierarchy with hook placeholders', async () => {
    render(<DesignerShell repository={createRepository(createRecord())} />);

    expect(await screen.findByText('Hierarchy Studio')).toBeTruthy();
    expect(screen.getByText('Parent process')).toBeTruthy();
    expect(screen.getByText('Child process')).toBeTruthy();
    expect(screen.getByText('Parent stage')).toBeTruthy();
    expect(screen.getByText('Parent stage blocked until child process completion')).toBeTruthy();
    expect(screen.getByText('Onboarding timeline')).toBeTruthy();
    expect(screen.getAllByText('IT readiness').length).toBeGreaterThan(0);
    expect(screen.getByText('Stage hooks')).toBeTruthy();
    expect(screen.getByText('JavaScript hook placeholder')).toBeTruthy();
    expect(screen.getByText('Notification WYSIWYG placeholder')).toBeTruthy();
    expect(screen.getByText('Routing and SLA placeholders')).toBeTruthy();
  });

  it('saves process and stage authoring through processPortfolio only', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.fn();
    render(<DesignerShell repository={createRepository(createRecord(), saveSpy)} />);

    await screen.findByText('Loaded Employee Onboarding');
    await user.click(screen.getByRole('button', { name: 'Add child process' }));
    await user.click(screen.getByRole('button', { name: 'Add stage' }));
    await user.click(screen.getByRole('button', { name: 'Save package' }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    const saved = JSON.parse(saveSpy.mock.calls.at(-1)?.[0].modelContent) as DbmModelV1 & { process?: unknown };
    const addedProcess = saved.processPortfolio.processes.find((process) => process.id === 'sub-process');

    expect(saved.process).toBeUndefined();
    expect(addedProcess?.role).toBe('sub-process');
    expect(addedProcess?.stages[0]?.stageCategory).toBe('work');
    expect(addedProcess?.stages[0]?.stageKindId).toBe('work');
    expect(
      saved.processPortfolio.processes
        .find((process) => process.id === 'onboarding-main')
        ?.stages.some((stage) => stage.childProcessRefs?.some((ref) => ref.processId === 'sub-process'))
    ).toBe(true);
  });

  it('round-trips child process link and visibility edits', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.fn();
    render(<DesignerShell repository={createRepository(createRecord(), saveSpy)} />);

    await screen.findByText('Hierarchy Studio');
    await user.selectOptions(screen.getByLabelText('Selected process'), 'it-readiness');
    await user.selectOptions(screen.getByLabelText('Selected stage'), 'prepare-access');
    await user.click(screen.getByRole('button', { name: 'Add child process under selected stage' }));
    await user.selectOptions(screen.getByLabelText('Portal visibility rule'), 'show-it-readiness:false');
    await user.click(screen.getByRole('button', { name: 'Save package' }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    const saved = JSON.parse(saveSpy.mock.calls.at(-1)?.[0].modelContent) as DbmModelV1;
    const process = saved.processPortfolio.processes.find((entry) => entry.id === 'it-readiness');
    const stage = process?.stages.find((entry) => entry.id === 'prepare-access');

    expect(stage?.childProcessRefs?.at(-1)?.processId).toBe('child-process');
    expect(stage?.childProcessRefs?.at(-1)?.blocksParent).toBe(true);
    expect(process?.subProcessVisibility).toContainEqual({
      audience: 'portal',
      ruleId: 'show-it-readiness',
      visibleWhen: false
    });
  });

  it('attaches, reconnects, detaches, and removes hierarchy items from the inspector', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.fn();
    render(<DesignerShell repository={createRepository(createRecord(), saveSpy)} />);

    await screen.findByText('Loaded Employee Onboarding');
    await user.selectOptions(screen.getByLabelText('Selected process'), 'onboarding-main');
    await user.selectOptions(screen.getByLabelText('Selected stage'), 'first-day');
    await user.selectOptions(screen.getByLabelText('Attach existing child process'), 'facilities-readiness');
    await user.click(screen.getByRole('button', { name: 'Attach child process' }));
    await user.selectOptions(screen.getByLabelText('Reconnect facilities readiness'), 'onboarding-main:onboarding-complete');
    await user.click(screen.getByRole('button', { name: 'Reconnect facilities readiness' }));
    await user.click(screen.getByRole('button', { name: 'Remove facilities readiness from parent stage' }));
    await user.selectOptions(screen.getByLabelText('Selected stage'), 'first-day');
    await user.click(screen.getByRole('button', { name: 'Remove selected stage' }));
    await user.click(screen.getByRole('button', { name: 'Save package' }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    const saved = JSON.parse(saveSpy.mock.calls.at(-1)?.[0].modelContent) as DbmModelV1 & { process?: unknown; xyflow?: unknown };
    const main = saved.processPortfolio.processes.find((process) => process.id === 'onboarding-main');

    expect(saved.process).toBeUndefined();
    expect(saved.xyflow).toBeUndefined();
    expect(main?.stages.some((stage) => stage.id === 'first-day')).toBe(false);
    expect(
      main?.stages.some((stage) => stage.childProcessRefs.some((ref) => ref.processId === 'facilities-readiness'))
    ).toBe(false);
    expect(saved.processPortfolio.processes.some((process) => process.id === 'facilities-readiness')).toBe(true);
  });
});
