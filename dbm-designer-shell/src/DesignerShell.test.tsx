import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApprovalRequestTemplate } from 'dbm-designer-core';
import { DesignerShell } from './DesignerShell';
import {
  createNormalizedModelPackage,
  type DbmPackageRepository
} from './packageRepository';

vi.mock('./graphCanvas', () => ({
  GraphCanvas: ({
    document,
    onSelectionChange,
    onGraphIntent,
    onNodePositionCommit,
    focusTargetId,
    focusRequestToken
  }: {
    document: { graph: { nodes: unknown[] } } | null;
    onSelectionChange(selectionId: string | null): void;
    onGraphIntent(intent: unknown): void;
    onNodePositionCommit(nodeId: string, position: { x: number; y: number }): void;
    focusTargetId: string | null;
    focusRequestToken: number;
  }) => React.createElement(
    'div',
    { 'data-testid': 'graph-canvas' },
    React.createElement('div', null, document ? `graph:${document.graph.nodes.length}` : 'empty'),
    React.createElement('div', null, `focus:${focusTargetId ?? 'none'}:${focusRequestToken}`),
    React.createElement(
      'button',
      { type: 'button', onClick: () => onSelectionChange('stage:draft-request') },
      'Select Draft Stage'
    ),
    React.createElement(
      'button',
      { type: 'button', onClick: () => onSelectionChange('step:capture-request') },
      'Select Capture Step'
    ),
    React.createElement(
      'button',
      { type: 'button', onClick: () => onNodePositionCommit('stage:draft-request', { x: 880, y: 220 }) },
      'Move Draft Stage'
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: () =>
          onGraphIntent({
            kind: 'create-stage-transition',
            fromStageId: 'draft-request',
            toStageId: 'approved',
            outcomeId: 'submit'
          })
      },
      'Connect Draft To Approved'
    ),
    React.createElement(
      'button',
      {
        type: 'button',
        onClick: () => onGraphIntent({ kind: 'add-outcome' })
      },
      'Add Outcome Intent'
    )
  )
}));

vi.mock('./diagnosticsDrawer', () => ({
  DiagnosticsDrawer: () => null
}));

vi.mock('./previewDock', () => ({
  PreviewDock: () => React.createElement('div', { 'data-testid': 'preview-dock' }, 'preview')
}));

vi.mock('./metadataBrowserPanel', () => ({
  MetadataBrowserPanel: () => React.createElement('div', { 'data-testid': 'metadata-browser-panel' }, 'metadata')
}));

afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

function createRepositoryHarness(model = createApprovalRequestTemplate(), kind: DbmPackageRepository['kind'] = 'browser') {
  let currentRecord = createNormalizedModelPackage(model);

  const repository: DbmPackageRepository = {
    kind,
    listPackages: vi.fn(async () => [
      {
        modelId: currentRecord.modelId,
        workspaceId: currentRecord.workspaceId,
        packageName: currentRecord.packageName,
        displayName: currentRecord.displayName,
        modelName: currentRecord.modelName,
        workspaceName: currentRecord.workspaceName,
        modifiedOn: currentRecord.modifiedOn,
        hasWorkspace: currentRecord.hasWorkspace
      }
    ]),
    loadPackage: vi.fn(async (packageName) => (packageName === currentRecord.packageName ? currentRecord : null)),
    savePackage: vi.fn(async (record) => {
      currentRecord = {
        ...record,
        modifiedOn: '2026-04-14T10:55:00.000Z',
        hasWorkspace: true
      };

      return currentRecord;
    }),
    deletePackage: vi.fn(async () => undefined)
  };

  return {
    repository,
    getCurrentRecord: () => currentRecord
  };
}

describe('DesignerShell', () => {
  it('loads a package into the graph-first shell and routes selection into the inline editor', async () => {
    const { repository } = createRepositoryHarness();
    const user = userEvent.setup();

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });
    await screen.findByText(/^graph:/);

    await user.click(screen.getByRole('button', { name: 'Select Draft Stage' }));

    const renameInput = await screen.findByRole('textbox', { name: 'Stage name' });
    expect((renameInput as HTMLInputElement).value).toBe('Draft Request');
    expect(screen.getByRole('button', { name: 'Add Step' })).toBeTruthy();
  });

  it('persists node-position changes to the workspace sidecar without changing canonical process semantics', async () => {
    const { repository, getCurrentRecord } = createRepositoryHarness();
    const user = userEvent.setup();

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });
    await user.click(screen.getByRole('button', { name: 'Move Draft Stage' }));
    await user.click(screen.getByRole('button', { name: 'Save Package' }));

    await waitFor(() => {
      expect(repository.savePackage).toHaveBeenCalledTimes(1);
    });

    const savedWorkspace = JSON.parse(getCurrentRecord().workspaceContent ?? '{}');
    const savedModel = JSON.parse(getCurrentRecord().modelContent);

    expect(savedWorkspace.nodePositions['stage:draft-request']).toEqual({ x: 880, y: 220 });
    expect(savedWorkspace).not.toHaveProperty('nodes');
    expect(savedWorkspace).not.toHaveProperty('edges');
    expect(savedModel.process.transitions).toHaveLength(4);
    expect(savedModel.process.stages.find((stage: { id: string }) => stage.id === 'draft-request')?.displayName).toBe('Draft Request');
  });

  it('saves graph connect actions as canonical transitions rather than library graph JSON', async () => {
    const { repository, getCurrentRecord } = createRepositoryHarness();
    const user = userEvent.setup();

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });
    await user.click(screen.getByRole('button', { name: 'Connect Draft To Approved' }));
    await user.click(screen.getByRole('button', { name: 'Save Package' }));

    await waitFor(() => {
      expect(repository.savePackage).toHaveBeenCalledTimes(1);
    });

    const savedModel = JSON.parse(getCurrentRecord().modelContent);
    const savedWorkspace = JSON.parse(getCurrentRecord().workspaceContent ?? '{}');
    const addedTransition = savedModel.process.transitions.find(
      (transition: { fromStageId: string; toStageId: string; outcomeId: string }) =>
        transition.fromStageId === 'draft-request'
        && transition.toStageId === 'approved'
        && transition.outcomeId === 'submit'
    );

    expect(savedModel.process.transitions).toHaveLength(5);
    expect(addedTransition).toBeTruthy();
    expect(JSON.stringify(savedModel)).not.toContain('xyflow');
    expect(JSON.stringify(savedWorkspace)).not.toContain('xyflow');
  });

  it('supports adding outcomes from the palette and assigning them to a stage without JSON editing', async () => {
    const { repository, getCurrentRecord } = createRepositoryHarness();
    const user = userEvent.setup();

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });
    await user.click(screen.getByRole('button', { name: 'Add Outcome Intent' }));
    await user.click(screen.getByRole('button', { name: 'Select Draft Stage' }));
    await user.click(screen.getByRole('button', { name: 'New Outcome 6' }));
    await user.click(screen.getByRole('button', { name: 'Save Package' }));

    await waitFor(() => {
      expect(repository.savePackage).toHaveBeenCalledTimes(1);
    });

    const savedModel = JSON.parse(getCurrentRecord().modelContent);
    const addedOutcome = savedModel.process.outcomes.find((outcome: { displayName: string }) => outcome.displayName === 'New Outcome 6');

    expect(addedOutcome).toBeTruthy();
    expect(savedModel.process.stages.find((stage: { id: string }) => stage.id === 'draft-request')?.allowedOutcomeIds).toContain(addedOutcome.id);
  });

  it('shows direct form-state effect inspection when a step is selected', async () => {
    const { repository } = createRepositoryHarness();
    const user = userEvent.setup();

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });
    await user.click(screen.getByRole('button', { name: 'Select Capture Step' }));

    expect(await screen.findByText('Form-State Effects')).toBeTruthy();
    expect(screen.getByText('Request Form')).toBeTruthy();
    expect(screen.getAllByText('Request Edit').length).toBeGreaterThan(0);
    expect(screen.getByText(/Activation Rules/i)).toBeTruthy();
    expect(screen.getByText(/Visible Bindings/i)).toBeTruthy();
  });

  it('routes validation issue clicks into focused graph navigation targets', async () => {
    const model = createApprovalRequestTemplate();
    const requestForm = model.forms.find((form) => form.id === 'request-form');
    const requestEditState = requestForm?.formStates.find((state) => state.id === 'request-edit-state');
    requestEditState?.elementBehaviors.push({
      elementId: 'missing-element',
      label: null,
      hint: null,
      requiredRuleIds: [],
      visibleRuleIds: [],
      editableRuleIds: []
    });
    const { repository } = createRepositoryHarness(model);
    const user = userEvent.setup();

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });
    await user.click(await screen.findByRole('button', { name: /missing-form-state-element/i }));

    expect(await screen.findByText('focus:step:capture-request:1')).toBeTruthy();
  });

  it('auto-loads the requested package from the packageName query parameter', async () => {
    const { repository, getCurrentRecord } = createRepositoryHarness();
    window.history.replaceState({}, '', `/?packageName=${getCurrentRecord().packageName}`);

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });

    expect(repository.loadPackage).toHaveBeenCalledWith(getCurrentRecord().packageName);
  });

  it('auto-loads the requested package from the supported data query parameter', async () => {
    const { repository, getCurrentRecord } = createRepositoryHarness();
    const payload = encodeURIComponent(JSON.stringify({ packageName: getCurrentRecord().packageName }));
    window.history.replaceState({}, '', `/?data=${payload}`);

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });

    expect(repository.loadPackage).toHaveBeenCalledWith(getCurrentRecord().packageName);
  });

  it('falls back safely when the requested packageName query parameter is invalid', async () => {
    const { repository } = createRepositoryHarness();
    window.history.replaceState({}, '', '/?packageName=missing-package');

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });
    expect(await screen.findByText("Requested package 'missing-package' was not found. Showing the available package list instead.")).toBeTruthy();
  });

  it('falls back safely when the requested data query parameter is invalid', async () => {
    const { repository } = createRepositoryHarness();
    window.history.replaceState({}, '', '/?data=%7Bbad-json');

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });
    expect(await screen.findByText('The requested designer deep link could not be parsed. Showing the available package list instead.')).toBeTruthy();
  });

  it('keeps the hosted designer graph-first by moving preview and metadata into secondary workspace panels', async () => {
    const { repository } = createRepositoryHarness(createApprovalRequestTemplate(), 'model-driven');
    const user = userEvent.setup();

    render(React.createElement(DesignerShell, { repository }));

    await screen.findByRole('heading', { name: 'DBM Approval Request' });

    const sidebar = screen.getByTestId('designer-sidebar');
    expect(within(sidebar).queryByTestId('preview-dock')).toBeNull();
    expect(within(sidebar).queryByTestId('metadata-browser-panel')).toBeNull();
    expect(screen.queryByTestId('designer-secondary-panels')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByTestId('designer-secondary-panels')).toBeTruthy();
    expect(screen.getByTestId('preview-dock')).toBeTruthy();
    expect(within(sidebar).queryByTestId('preview-dock')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Metadata' }));
    expect(screen.getByTestId('metadata-browser-panel')).toBeTruthy();
    expect(within(sidebar).queryByTestId('metadata-browser-panel')).toBeNull();
  });
});
