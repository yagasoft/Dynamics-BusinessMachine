import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
    onNodePositionCommit
  }: {
    document: { graph: { nodes: unknown[] } } | null;
    onSelectionChange(selectionId: string | null): void;
    onGraphIntent(intent: unknown): void;
    onNodePositionCommit(nodeId: string, position: { x: number; y: number }): void;
  }) => (
    <div data-testid="graph-canvas">
      <div>{document ? `graph:${document.graph.nodes.length}` : 'empty'}</div>
      <button type="button" onClick={() => onSelectionChange('stage:draft-request')}>
        Select Draft Stage
      </button>
      <button type="button" onClick={() => onNodePositionCommit('stage:draft-request', { x: 880, y: 220 })}>
        Move Draft Stage
      </button>
      <button
        type="button"
        onClick={() =>
          onGraphIntent({
            kind: 'create-stage-transition',
            fromStageId: 'draft-request',
            toStageId: 'approved',
            outcomeId: 'submit'
          })
        }
      >
        Connect Draft To Approved
      </button>
    </div>
  )
}));

vi.mock('./diagnosticsDrawer', () => ({
  DiagnosticsDrawer: () => null
}));

afterEach(() => {
  cleanup();
});

function createRepositoryHarness() {
  let currentRecord = createNormalizedModelPackage(createApprovalRequestTemplate());

  const repository: DbmPackageRepository = {
    kind: 'browser',
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
  it('loads a package into the graph-first shell and routes selection into the inspector', async () => {
    const { repository } = createRepositoryHarness();
    const user = userEvent.setup();

    render(<DesignerShell repository={repository} />);

    await screen.findByRole('heading', { name: 'DBM Approval Request' });
    await screen.findByText(/^graph:/);

    await user.click(screen.getByRole('button', { name: 'Select Draft Stage' }));

    const renameInput = await screen.findByRole('textbox');
    expect((renameInput as HTMLInputElement).value).toBe('Draft Request');
    expect(screen.getByRole('button', { name: 'Add Step' })).toBeTruthy();
  });

  it('persists node-position changes to the workspace sidecar without changing canonical process semantics', async () => {
    const { repository, getCurrentRecord } = createRepositoryHarness();
    const user = userEvent.setup();

    render(<DesignerShell repository={repository} />);

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

    render(<DesignerShell repository={repository} />);

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
});
