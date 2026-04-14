import { useEffect, useMemo, useState } from 'react';
import { DndContext, DragOverlay, useDraggable } from '@dnd-kit/core';
import type { DbmDesignerWorkspaceV1, DbmModelV1, DbmProcessExperienceSnapshotV1, DbmRuntimeStateV1 } from 'dbm-contract';
import {
  applyGraphIntent,
  buildDesignerClipboardPayload,
  buildProcessExperienceSnapshot,
  loadModelPackage,
  pasteDesignerClipboardPayload,
  serializeModel,
  serializeModelPackage,
  type DesignerClipboardPayload,
  type DesignerDocument,
  type DesignerGraphIntent,
  type DesignerModelPackage
} from 'dbm-designer-core';
import type { DbmHostModelPackageRecord, DbmHostModelPackageSummary } from './hostBridge';
import { DiagnosticsDrawer } from './diagnosticsDrawer';
import { GraphCanvas } from './graphCanvas';
import { type InspectorSelection, resolveInspectorSelection } from './inspectorPanel';
import { buildPackageResourceNames, createDraftPackageRecord, type DbmPackageRepository } from './packageRepository';
import { PreviewDock } from './previewDock';
import { ProcessOverviewStrip } from './processOverviewStrip';
import { SelectionEditorCard } from './selectionEditorCard';

interface DesignerShellProps {
  repository: DbmPackageRepository;
}

interface EditorState {
  document: DesignerDocument | null;
  snapshot: DbmProcessExperienceSnapshotV1 | null;
  parseError: string | null;
}

interface HistoryState {
  past: DesignerModelPackage[];
  future: DesignerModelPackage[];
}

type PaletteItemKind = 'stage' | 'step';

function buildPreviewRuntimeState(model: DbmModelV1, workspace: DbmDesignerWorkspaceV1): DbmRuntimeStateV1 {
  const currentStage =
    model.process.stages.find((stage) => stage.id === workspace.preview.stageId)
    ?? model.process.stages.find((stage) => stage.stageType === 'start')
    ?? model.process.stages[0];
  const currentStep =
    model.process.steps.find((step) => step.id === workspace.preview.stepId && step.stageId === currentStage?.id)
    ?? model.process.steps.find((step) => step.id === currentStage?.defaultStepId)
    ?? model.process.steps.find((step) => step.stageId === currentStage?.id)
    ?? model.process.steps[0];

  if (!currentStage || !currentStep) {
    throw new Error('Preview requires at least one stage and one step in the model.');
  }

  return {
    stageId: currentStage.id,
    stepId: currentStep.id,
    formStateId: currentStep.formStateId,
    internalStatusId: currentStep.internalStatusId,
    portalStatusId: currentStep.portalStatusId,
    records: [],
    variables: {}
  };
}

function buildEditorState(document: DesignerDocument): EditorState {
  const serialized = serializeModelPackage(document);
  return {
    document,
    snapshot: buildProcessExperienceSnapshot(serialized.model, buildPreviewRuntimeState(serialized.model, serialized.workspace), {
      audience: serialized.workspace.preview.mode
    }),
    parseError: null
  };
}

function normalizeRecord(record: DbmHostModelPackageRecord): DbmHostModelPackageRecord {
  const parsedModel = JSON.parse(record.modelContent) as DbmModelV1;
  const parsedWorkspace = record.workspaceContent ? (JSON.parse(record.workspaceContent) as DbmDesignerWorkspaceV1) : null;
  const document = loadModelPackage(parsedModel, parsedWorkspace);
  const serialized = serializeModelPackage(document);
  const resourceNames = buildPackageResourceNames(record.packageName);

  return {
    ...record,
    displayName: serialized.model.package.displayName,
    modelName: resourceNames.modelName,
    workspaceName: resourceNames.workspaceName,
    hasWorkspace: true,
    modelContent: JSON.stringify(serialized.model, null, 2),
    workspaceContent: JSON.stringify(serialized.workspace, null, 2)
  };
}

function syncSelectionPreview(document: DesignerDocument, selectionId: string | null, dirty = true): DesignerDocument {
  const nextWorkspace = structuredClone(document.workspace);
  nextWorkspace.selectionNodeId = selectionId;

  if (selectionId?.startsWith('stage:')) {
    const stageId = selectionId.slice('stage:'.length);
    const stage = document.model.process.stages.find((entry) => entry.id === stageId);
    nextWorkspace.preview.stageId = stageId;
    nextWorkspace.preview.stepId =
      stage?.defaultStepId
      ?? stage?.stepIds[0]
      ?? document.model.process.steps.find((step) => step.stageId === stageId)?.id
      ?? null;
  } else if (selectionId?.startsWith('step:')) {
    const stepId = selectionId.slice('step:'.length);
    const step = document.model.process.steps.find((entry) => entry.id === stepId);
    nextWorkspace.preview.stageId = step?.stageId ?? nextWorkspace.preview.stageId;
    nextWorkspace.preview.stepId = stepId;
  }

  const nextDocument = loadModelPackage(serializeModel(document), nextWorkspace);
  return { ...nextDocument, dirty };
}

function mutateWorkspace(document: DesignerDocument, mutate: (workspace: DbmDesignerWorkspaceV1) => void, dirty = true): DesignerDocument {
  const nextWorkspace = structuredClone(document.workspace);
  mutate(nextWorkspace);
  const nextDocument = loadModelPackage(serializeModel(document), nextWorkspace);
  return { ...nextDocument, dirty };
}

function resolvePaletteStageId(document: DesignerDocument | null) {
  if (!document) {
    return null;
  }
  if (document.selectionId?.startsWith('stage:')) {
    return document.selectionId.slice('stage:'.length);
  }
  if (document.selectionId?.startsWith('step:')) {
    const stepId = document.selectionId.slice('step:'.length);
    return document.model.process.steps.find((step) => step.id === stepId)?.stageId ?? null;
  }
  return document.workspace.preview.stageId;
}

function buildKeyboardSelectionOrder(document: DesignerDocument): string[] {
  const visibleIds: string[] = [];
  const collapsedIds = new Set(document.workspace.collapsedNodeIds);

  document.model.process.stages.forEach((stage) => {
    visibleIds.push(stageNodeId(stage.id));
    const collapsed = collapsedIds.has(stageNodeId(stage.id));
    if (!collapsed) {
      stage.stepIds.forEach((stepId) => visibleIds.push(`step:${stepId}`));
    }
    const stageEdges = document.model.process.transitions
      .filter((transition) => transition.fromStageId === stage.id)
      .map((transition) => `transition:${transition.id}`);
    const stepEdges = document.model.process.stepTransitions
      .filter((transition) => document.model.process.steps.find((step) => step.id === transition.fromStepId)?.stageId === stage.id)
      .map((transition) => `step-transition:${transition.id}`);
    visibleIds.push(...(!collapsed && stepEdges.length > 0 ? stepEdges : stageEdges));
  });

  document.model.process.outcomes.forEach((outcome) => visibleIds.push(`outcome:${outcome.id}`));
  return [...new Set(visibleIds)];
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"]');
}

function toggleCollapsedNodeId(workspace: DbmDesignerWorkspaceV1, nodeId: string) {
  workspace.collapsedNodeIds = workspace.collapsedNodeIds.includes(nodeId)
    ? workspace.collapsedNodeIds.filter((entry) => entry !== nodeId)
    : [...workspace.collapsedNodeIds, nodeId];
}

function packagesEqual(left: DesignerDocument, right: DesignerDocument): boolean {
  return JSON.stringify(serializeModelPackage(left)) === JSON.stringify(serializeModelPackage(right));
}

function toStageNodeId(stageId: string): string {
  return `stage:${stageId}`;
}

function PaletteButton({
  id,
  label,
  description,
  disabled,
  onClick
}: {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
  onClick(): void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ ...paletteButtonStyle, ...(disabled ? disabledPaletteButtonStyle : {}), transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.72 : 1 }}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <span style={paletteButtonTitleStyle}>{label}</span>
      <span style={paletteButtonMetaStyle}>{description}</span>
    </button>
  );
}

export function DesignerShell({ repository }: DesignerShellProps) {
  const [packages, setPackages] = useState<DbmHostModelPackageSummary[]>([]);
  const [selectedPackageName, setSelectedPackageName] = useState<string | null>(null);
  const [currentRecord, setCurrentRecord] = useState<DbmHostModelPackageRecord | null>(null);
  const [editorState, setEditorState] = useState<EditorState>({ document: null, snapshot: null, parseError: null });
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [clipboardPayload, setClipboardPayload] = useState<DesignerClipboardPayload | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);

  async function refreshPackages(preferredPackageName?: string | null) {
    setIsBusy(true);
    try {
      const nextPackages = await repository.listPackages();
      setPackages(nextPackages);
      const targetPackageName = preferredPackageName ?? selectedPackageName;
      if (targetPackageName && nextPackages.some((entry) => entry.packageName === targetPackageName)) {
        setSelectedPackageName(targetPackageName);
        return;
      }
      if (!currentRecord && nextPackages.length > 0) {
        setSelectedPackageName(nextPackages[0].packageName);
      }
    } finally {
      setIsBusy(false);
    }
  }

  function applyDocument(document: DesignerDocument) {
    setEditorState(buildEditorState(document));
  }

  function applyDocumentWithHistory(nextDocument: DesignerDocument, previousDocument: DesignerDocument | null, recordHistory = false) {
    if (recordHistory && previousDocument && !packagesEqual(previousDocument, nextDocument)) {
      const previousSnapshot = serializeModelPackage(previousDocument);
      setHistory((current) => ({ past: [...current.past.slice(-99), previousSnapshot], future: [] }));
    }
    applyDocument(nextDocument);
  }

  function restoreFromSnapshot(snapshot: DesignerModelPackage, dirty = true) {
    const restored = loadModelPackage(snapshot.model, snapshot.workspace);
    applyDocument({ ...restored, dirty });
  }

  function applyLoadedRecord(record: DbmHostModelPackageRecord) {
    const normalized = normalizeRecord(record);
    setCurrentRecord(normalized);
    setSelectedPackageName(normalized.packageName);
    setHistory({ past: [], future: [] });
    try {
      const parsedModel = JSON.parse(normalized.modelContent) as DbmModelV1;
      const parsedWorkspace = normalized.workspaceContent ? (JSON.parse(normalized.workspaceContent) as DbmDesignerWorkspaceV1) : null;
      applyDocument(loadModelPackage(parsedModel, parsedWorkspace));
    } catch (error) {
      setEditorState({ document: null, snapshot: null, parseError: error instanceof Error ? error.message : 'Unknown load error.' });
    }
  }

  async function loadSelectedPackage(packageName: string) {
    setIsBusy(true);
    try {
      const loaded = await repository.loadPackage(packageName);
      if (!loaded) {
        setStatusMessage(`Package '${packageName}' could not be found.`);
        return;
      }
      applyLoadedRecord(loaded);
      setStatusMessage(`Loaded ${loaded.displayName ?? loaded.packageName}.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreatePackage() {
    const draft = createDraftPackageRecord();
    applyLoadedRecord(draft);
    setStatusMessage(`Created a draft package named ${draft.packageName}.`);
  }

  async function handleSave() {
    if (!currentRecord || !editorState.document || editorState.parseError) {
      return;
    }
    const errorIssues = editorState.document.issues.filter((issue) => issue.level === 'error');
    if (errorIssues.length > 0) {
      setStatusMessage(`Save blocked: ${errorIssues.length} validation error(s) must be resolved first.`);
      return;
    }
    setIsBusy(true);
    try {
      const serialized = serializeModelPackage(editorState.document);
      if (serialized.model.package.id !== currentRecord.packageName) {
        setStatusMessage(`Save blocked: model.package.id ('${serialized.model.package.id}') must stay aligned with the package resource name ('${currentRecord.packageName}') in R2.2.`);
        return;
      }
      const savedRecord = await repository.savePackage({
        ...currentRecord,
        displayName: serialized.model.package.displayName,
        modelContent: JSON.stringify(serialized.model, null, 2),
        workspaceContent: JSON.stringify(serialized.workspace, null, 2)
      });
      applyLoadedRecord(savedRecord);
      await refreshPackages(savedRecord.packageName);
      setStatusMessage(`Saved ${savedRecord.displayName ?? savedRecord.packageName}.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDelete() {
    if (!currentRecord) {
      return;
    }
    const isPersisted = packages.some((entry) => entry.packageName === currentRecord.packageName);
    if (!isPersisted) {
      setCurrentRecord(null);
      setSelectedPackageName(null);
      setEditorState({ document: null, snapshot: null, parseError: null });
      setStatusMessage(`Discarded the draft package ${currentRecord.packageName}.`);
      return;
    }
    if (!window.confirm(`Delete package '${currentRecord.packageName}' and its workspace sidecar?`)) {
      return;
    }
    setIsBusy(true);
    try {
      await repository.deletePackage(currentRecord);
      setCurrentRecord(null);
      setSelectedPackageName(null);
      setEditorState({ document: null, snapshot: null, parseError: null });
      setHistory({ past: [], future: [] });
      await refreshPackages(null);
      setStatusMessage(`Deleted ${currentRecord.packageName}.`);
    } finally {
      setIsBusy(false);
    }
  }

  function handleSelectionChange(selectionId: string | null) {
    if (!editorState.document) {
      return;
    }
    applyDocument(syncSelectionPreview(editorState.document, selectionId, true));
  }

  function handleNodePositionCommit(nodeId: string, position: { x: number; y: number }) {
    if (!editorState.document) {
      return;
    }
    const previous = editorState.document.workspace.nodePositions[nodeId];
    if (previous && previous.x === position.x && previous.y === position.y) {
      return;
    }
    applyDocumentWithHistory(mutateWorkspace(editorState.document, (workspace) => {
      workspace.nodePositions[nodeId] = position;
    }), editorState.document, true);
  }

  function handlePreviewStageChange(stageId: string | null) {
    if (!editorState.document) {
      return;
    }
    applyDocument(mutateWorkspace(editorState.document, (workspace) => {
      workspace.preview.stageId = stageId;
      const stage = editorState.document?.model.process.stages.find((entry) => entry.id === stageId);
      workspace.preview.stepId =
        stage?.defaultStepId
        ?? stage?.stepIds[0]
        ?? editorState.document?.model.process.steps.find((step) => step.stageId === stage?.id)?.id
        ?? null;
    }));
  }

  function handlePreviewStepChange(stepId: string | null) {
    if (!editorState.document) {
      return;
    }
    applyDocument(mutateWorkspace(editorState.document, (workspace) => {
      workspace.preview.stepId = stepId;
    }));
  }

  function handlePreviewModeChange(mode: 'internal' | 'portal') {
    if (!editorState.document) {
      return;
    }
    applyDocument(mutateWorkspace(editorState.document, (workspace) => {
      workspace.preview.mode = mode;
    }));
  }

  function handleGraphIntent(intent: DesignerGraphIntent) {
    if (!editorState.document) {
      return;
    }
    const result = applyGraphIntent(editorState.document, intent);
    applyDocumentWithHistory(syncSelectionPreview(result.document, result.affectedNodeId ?? result.document.selectionId, true), editorState.document, true);
  }

  function handleToggleStageCollapse(stageId: string) {
    if (!editorState.document) {
      return;
    }
    const nodeId = toStageNodeId(stageId);
    const nextDocument = mutateWorkspace(editorState.document, (workspace) => {
      toggleCollapsedNodeId(workspace, nodeId);
    });
    const effectiveSelectionId = editorState.document.selectionId?.startsWith('step:')
      && editorState.document.model.process.steps.find((step) => step.id === editorState.document.selectionId?.slice('step:'.length))?.stageId === stageId
      ? nodeId
      : editorState.document.selectionId;
    applyDocumentWithHistory(syncSelectionPreview(nextDocument, effectiveSelectionId, true), editorState.document, true);
  }

  function handleAddPaletteItem(kind: PaletteItemKind) {
    if (!editorState.document) {
      return;
    }
    if (kind === 'stage') {
      handleGraphIntent({ kind: 'add-stage', actorId: editorState.document.model.process.actors[0]?.id });
      return;
    }
    const stageId = resolvePaletteStageId(editorState.document);
    if (!stageId) {
      setStatusMessage('Select a stage before adding a step.');
      return;
    }
    handleGraphIntent({ kind: 'add-step', stageId });
  }

  function handleUndo() {
    if (!editorState.document || history.past.length === 0) {
      return;
    }
    const previous = history.past[history.past.length - 1];
    const currentSnapshot = serializeModelPackage(editorState.document);
    setHistory((current) => ({ past: current.past.slice(0, -1), future: [currentSnapshot, ...current.future].slice(0, 100) }));
    restoreFromSnapshot(previous, true);
    setStatusMessage('Undid the last change.');
  }

  function handleRedo() {
    if (!editorState.document || history.future.length === 0) {
      return;
    }
    const [next, ...remaining] = history.future;
    const currentSnapshot = serializeModelPackage(editorState.document);
    setHistory((current) => ({ past: [...current.past.slice(-99), currentSnapshot], future: remaining }));
    restoreFromSnapshot(next, true);
    setStatusMessage('Redid the last change.');
  }

  function handleCopySelection() {
    if (!editorState.document) {
      return;
    }
    const payload = buildDesignerClipboardPayload(editorState.document);
    if (!payload) {
      setStatusMessage('Select a stage or step to copy.');
      return;
    }
    setClipboardPayload(payload);
    setStatusMessage(`${payload.kind === 'stage' ? 'Stage' : 'Step'} copied.`);
  }

  function handlePasteSelection() {
    if (!editorState.document || !clipboardPayload) {
      return;
    }
    const result = pasteDesignerClipboardPayload(editorState.document, clipboardPayload);
    let nextDocument = syncSelectionPreview(result.document, result.affectedNodeId, true);
    if (result.affectedNodeId?.startsWith('stage:')) {
      nextDocument = mutateWorkspace(nextDocument, (workspace) => {
        workspace.collapsedNodeIds = workspace.collapsedNodeIds.filter((entry) => entry !== result.affectedNodeId);
      });
    }
    applyDocumentWithHistory(nextDocument, editorState.document, true);
    setStatusMessage(`${clipboardPayload.kind === 'stage' ? 'Stage' : 'Step'} pasted.`);
  }

  function handleDeleteSelection() {
    if (!editorState.document?.selectionId) {
      return;
    }
    const selectionId = editorState.document.selectionId;
    if (selectionId.startsWith('stage:') || selectionId.startsWith('step:') || selectionId.startsWith('outcome:')) {
      handleGraphIntent({ kind: 'remove-node', nodeId: selectionId });
      return;
    }
    if (selectionId.startsWith('transition:') || selectionId.startsWith('step-transition:')) {
      handleGraphIntent({ kind: 'remove-edge', edgeId: selectionId });
    }
  }

  useEffect(() => {
    void refreshPackages(null);
  }, []);

  useEffect(() => {
    if (!selectedPackageName) {
      return;
    }
    const isPersisted = packages.some((entry) => entry.packageName === selectedPackageName);
    if (!isPersisted || currentRecord?.packageName === selectedPackageName) {
      return;
    }
    void loadSelectedPackage(selectedPackageName);
  }, [packages, selectedPackageName]);

  useEffect(() => {
    if (!editorState.document) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      const metaPressed = event.metaKey || event.ctrlKey;
      const editable = isEditableTarget(event.target);
      if (metaPressed && event.key.toLowerCase() === 'z' && !editable) {
        event.preventDefault();
        event.shiftKey ? handleRedo() : handleUndo();
        return;
      }
      if (metaPressed && event.key.toLowerCase() === 'y' && !editable) {
        event.preventDefault();
        handleRedo();
        return;
      }
      if (metaPressed && event.key.toLowerCase() === 'c' && !editable) {
        event.preventDefault();
        handleCopySelection();
        return;
      }
      if (metaPressed && event.key.toLowerCase() === 'v' && !editable) {
        event.preventDefault();
        handlePasteSelection();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && !editable) {
        event.preventDefault();
        handleDeleteSelection();
        return;
      }
      if ((event.key === 'Enter' || event.key === 'F2') && !editable) {
        event.preventDefault();
        setFocusToken((value) => value + 1);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        handleSelectionChange('document:root');
        return;
      }
      if (event.key === 'Tab' && !editable) {
        event.preventDefault();
        const order = buildKeyboardSelectionOrder(editorState.document);
        if (order.length === 0) {
          return;
        }
        const currentIndex = order.indexOf(editorState.document.selectionId ?? 'document:root');
        const offset = event.shiftKey ? -1 : 1;
        const nextIndex = currentIndex >= 0 ? (currentIndex + offset + order.length) % order.length : 0;
        handleSelectionChange(order[nextIndex]);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [clipboardPayload, editorState.document, history.future, history.past]);

  const validationIssues = editorState.document?.issues ?? [];
  const errorIssues = validationIssues.filter((issue) => issue.level === 'error');
  const selection: InspectorSelection | null = useMemo(() => resolveInspectorSelection(editorState.document), [editorState.document]);
  const paletteStageId = resolvePaletteStageId(editorState.document);
  const diagnosticsPayload = editorState.document ? serializeModelPackage(editorState.document) : null;
  const selectedStageId =
    selection?.kind === 'stage'
      ? selection.stage.id
      : selection?.kind === 'step'
        ? selection.stage.id
        : editorState.document?.workspace.preview.stageId ?? null;

  return (
    <DndContext
      onDragStart={(event) => setActiveDragLabel(event.active.id === 'palette-stage' ? 'New Stage' : event.active.id === 'palette-step' ? 'New Step' : null)}
      onDragEnd={(event) => {
        setActiveDragLabel(null);
        if (!event.over || event.over.id !== 'graph-canvas') {
          return;
        }
        if (event.active.id === 'palette-stage') {
          handleAddPaletteItem('stage');
        } else if (event.active.id === 'palette-step') {
          handleAddPaletteItem('step');
        }
      }}
      onDragCancel={() => setActiveDragLabel(null)}
    >
      <div style={shellStyle}>
        <aside style={sidebarStyle}>
          <div style={sectionHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>R2.2 Designer</div>
              <h1 style={titleStyle}>DBM Packages</h1>
            </div>
            <span style={hostBadgeStyle}>{repository.kind}</span>
          </div>
          <div style={buttonRowStyle}>
            <button type="button" style={primaryButtonStyle} onClick={() => void handleCreatePackage()}>New Package</button>
            <button type="button" style={secondaryButtonStyle} onClick={() => void refreshPackages(selectedPackageName)}>Refresh</button>
          </div>
          <div style={packageListStyle}>
            {packages.map((entry) => (
              <button
                key={entry.packageName}
                type="button"
                style={{ ...packageButtonStyle, ...(selectedPackageName === entry.packageName ? packageButtonActiveStyle : {}) }}
                onClick={() => setSelectedPackageName(entry.packageName)}
              >
                <span style={packageButtonTitleStyle}>{entry.displayName ?? entry.packageName}</span>
                <span style={packageButtonMetaStyle}>{entry.packageName}</span>
                <span style={packageButtonMetaStyle}>{entry.hasWorkspace ? 'workspace ready' : 'legacy model only'}</span>
              </button>
            ))}
          </div>
          <div style={panelCardStyle}>
            <div style={eyebrowStyle}>Validation</div>
            <div style={validationSummaryStyle}><span>{validationIssues.length} issue(s)</span><span>{errorIssues.length} blocking</span></div>
            {validationIssues.length > 0 ? (
              <div style={issueListStyle}>
                {validationIssues.map((issue) => (
                  <button key={`${issue.code}:${issue.path}`} type="button" style={issueButtonStyle} onClick={() => handleSelectionChange(issue.nodeId ?? 'document:root')}>
                    <strong>{issue.level}</strong> {issue.code}
                    <span style={issuePathStyle}>{issue.path}</span>
                  </button>
                ))}
              </div>
            ) : <div style={mutedCopyStyle}>The current model passes designer-core validation.</div>}
          </div>
        </aside>
        <main style={mainStyle}>
          <header style={workspaceHeaderStyle}>
            <div>
              <div style={eyebrowStyle}>Package Workspace</div>
              <h2 style={workspaceTitleStyle}>
                {currentRecord?.displayName ?? 'Select or create a package'}
                {editorState.document?.dirty ? <span style={dirtyBadgeStyle}>Unsaved</span> : null}
              </h2>
              <div style={workspaceMetaStyle}>{currentRecord ? `${currentRecord.modelName} + ${currentRecord.workspaceName}` : 'No package selected'}</div>
            </div>
            <div style={workspaceActionsStyle}>
              <button type="button" style={secondaryButtonStyle} onClick={handleUndo} disabled={history.past.length === 0}>Undo</button>
              <button type="button" style={secondaryButtonStyle} onClick={handleRedo} disabled={history.future.length === 0}>Redo</button>
              <button type="button" style={secondaryButtonStyle} onClick={() => setDiagnosticsOpen(true)} disabled={!editorState.document}>Diagnostics</button>
              <button type="button" style={secondaryButtonStyle} onClick={() => void handleDelete()} disabled={!currentRecord || isBusy}>Delete</button>
              <button type="button" style={primaryButtonStyle} onClick={() => void handleSave()} disabled={!currentRecord || isBusy || !!editorState.parseError}>Save Package</button>
            </div>
          </header>
          {statusMessage ? <div style={statusBannerStyle}>{statusMessage}</div> : null}
          {editorState.parseError ? <div style={errorBannerStyle}>Editor parse error: {editorState.parseError}</div> : null}
          {isBusy ? <div style={statusBannerStyle}>Working...</div> : null}
          <ProcessOverviewStrip snapshot={editorState.snapshot} selectedStageId={selectedStageId} onSelectStage={(stageId) => handleSelectionChange(`stage:${stageId}`)} />
          <section style={graphWorkspaceStyle}>
            <GraphCanvas document={editorState.document} onSelectionChange={handleSelectionChange} onGraphIntent={handleGraphIntent} onNodePositionCommit={handleNodePositionCommit} onToggleStageCollapse={handleToggleStageCollapse} />
            <div style={topLeftOverlayStyle}>
              <SelectionEditorCard document={editorState.document} selection={selection} focusToken={focusToken} onIntent={handleGraphIntent} onToggleStageCollapse={handleToggleStageCollapse} isStageCollapsed={(stageId) => !!editorState.document?.workspace.collapsedNodeIds.includes(toStageNodeId(stageId))} />
            </div>
            <div style={topRightOverlayStyle}>
              <div style={floatingPanelStyle}>
                <div style={eyebrowStyle}>Palette</div>
                <div style={mutedCopyStyle}>Drag to the canvas or click to author through DBM graph intents.</div>
                <PaletteButton id="palette-stage" label="Stage" description="Add a new durable process milestone." onClick={() => handleAddPaletteItem('stage')} />
                <PaletteButton id="palette-step" label="Step" description={paletteStageId ? `Add to ${paletteStageId}` : 'Select a stage first.'} disabled={!paletteStageId} onClick={() => handleAddPaletteItem('step')} />
              </div>
            </div>
            <div style={bottomRightOverlayStyle}>
              <PreviewDock document={editorState.document} snapshot={editorState.snapshot} onPreviewStageChange={handlePreviewStageChange} onPreviewStepChange={handlePreviewStepChange} onPreviewModeChange={handlePreviewModeChange} />
            </div>
          </section>
        </main>
      </div>
      <DragOverlay>{activeDragLabel ? <div style={dragOverlayStyle}>{activeDragLabel}</div> : null}</DragOverlay>
      <DiagnosticsDrawer open={diagnosticsOpen} onOpenChange={setDiagnosticsOpen} modelText={diagnosticsPayload ? JSON.stringify(diagnosticsPayload.model, null, 2) : ''} workspaceText={diagnosticsPayload ? JSON.stringify(diagnosticsPayload.workspace, null, 2) : ''} graphText={editorState.document ? JSON.stringify(editorState.document.graph, null, 2) : ''} />
    </DndContext>
  );
}

const shellStyle = { minHeight: '100vh', display: 'grid', gridTemplateColumns: '272px minmax(0, 1fr)', background: 'linear-gradient(180deg, #f7f4ed 0%, #eef2f7 100%)', color: '#111827', fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif' } as const;
const sidebarStyle = { padding: '1.15rem', borderRight: '1px solid #d6d3d1', background: 'rgba(255,255,255,0.84)', backdropFilter: 'blur(12px)', display: 'grid', gap: '0.95rem', alignContent: 'start' } as const;
const mainStyle = { display: 'grid', gap: '1rem', padding: '1.25rem' } as const;
const graphWorkspaceStyle = { position: 'relative', minWidth: 0 } as const;
const topLeftOverlayStyle = { position: 'absolute', top: '1rem', left: '1rem', zIndex: 12, pointerEvents: 'none' } as const;
const topRightOverlayStyle = { position: 'absolute', top: '1rem', right: '1rem', zIndex: 12, pointerEvents: 'none' } as const;
const bottomRightOverlayStyle = { position: 'absolute', right: '1rem', bottom: '1rem', zIndex: 12, pointerEvents: 'none' } as const;
const floatingPanelStyle = { width: '260px', maxWidth: 'calc(100vw - 4rem)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(214, 211, 209, 0.94)', background: 'rgba(255,255,255,0.94)', display: 'grid', gap: '0.8rem', boxShadow: '0 24px 54px rgba(15, 23, 42, 0.16)', backdropFilter: 'blur(14px)', pointerEvents: 'auto' } as const;
const sectionHeaderStyle = { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' } as const;
const titleStyle = { margin: '0.35rem 0 0', fontSize: '1.35rem' } as const;
const workspaceHeaderStyle = { display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' } as const;
const workspaceTitleStyle = { margin: '0.35rem 0 0', fontSize: '1.7rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' } as const;
const workspaceMetaStyle = { marginTop: '0.45rem', color: '#6b7280' } as const;
const workspaceActionsStyle = { display: 'flex', gap: '0.65rem', flexWrap: 'wrap' } as const;
const packageListStyle = { display: 'grid', gap: '0.7rem', maxHeight: 'calc(100vh - 21rem)', overflow: 'auto', paddingRight: '0.3rem' } as const;
const packageButtonStyle = { padding: '0.9rem 0.95rem', borderRadius: '1rem', border: '1px solid #d6d3d1', background: '#ffffff', display: 'grid', gap: '0.22rem', textAlign: 'left', cursor: 'pointer' } as const;
const packageButtonActiveStyle = { borderColor: '#b45309', boxShadow: '0 16px 30px rgba(180, 83, 9, 0.12)', transform: 'translateY(-1px)' } as const;
const packageButtonTitleStyle = { fontWeight: 700 } as const;
const packageButtonMetaStyle = { fontSize: '0.8rem', color: '#6b7280' } as const;
const panelCardStyle = { padding: '1rem', borderRadius: '1rem', border: '1px solid #d6d3d1', background: 'rgba(255,255,255,0.9)', display: 'grid', gap: '0.8rem' } as const;
const eyebrowStyle = { fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#6b7280' } as const;
const hostBadgeStyle = { padding: '0.4rem 0.7rem', borderRadius: '999px', border: '1px solid #d4d4d8', background: '#fff' } as const;
const buttonRowStyle = { display: 'flex', gap: '0.65rem', flexWrap: 'wrap' } as const;
const primaryButtonStyle = { padding: '0.72rem 1rem', borderRadius: '0.9rem', border: '1px solid #8b5e34', background: '#b45309', color: '#fff', cursor: 'pointer' } as const;
const secondaryButtonStyle = { padding: '0.72rem 1rem', borderRadius: '0.9rem', border: '1px solid #cbd5e1', background: '#fff', color: '#111827', cursor: 'pointer' } as const;
const paletteButtonStyle = { padding: '0.85rem 0.95rem', borderRadius: '0.95rem', border: '1px solid #d6d3d1', background: '#fff', display: 'grid', gap: '0.25rem', textAlign: 'left', cursor: 'grab' } as const;
const disabledPaletteButtonStyle = { opacity: 0.55, cursor: 'not-allowed' } as const;
const paletteButtonTitleStyle = { fontWeight: 700 } as const;
const paletteButtonMetaStyle = { fontSize: '0.82rem', color: '#6b7280' } as const;
const statusBannerStyle = { padding: '0.85rem 1rem', borderRadius: '0.85rem', border: '1px solid #cbd5e1', background: 'rgba(255,255,255,0.88)' } as const;
const errorBannerStyle = { padding: '0.85rem 1rem', borderRadius: '0.85rem', border: '1px solid #fca5a5', background: '#fef2f2', color: '#991b1b' } as const;
const validationSummaryStyle = { display: 'flex', gap: '0.9rem', fontSize: '0.92rem' } as const;
const issueListStyle = { display: 'grid', gap: '0.45rem', maxHeight: '220px', overflow: 'auto' } as const;
const issueButtonStyle = { display: 'grid', gap: '0.25rem', padding: '0.7rem 0.8rem', borderRadius: '0.85rem', border: '1px solid #e7e5e4', background: '#f8fafc', textAlign: 'left', cursor: 'pointer' } as const;
const issuePathStyle = { fontSize: '0.76rem', color: '#64748b' } as const;
const mutedCopyStyle = { color: '#6b7280', fontSize: '0.9rem' } as const;
const dirtyBadgeStyle = { padding: '0.28rem 0.58rem', borderRadius: '999px', background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', fontSize: '0.78rem' } as const;
const dragOverlayStyle = { padding: '0.8rem 1rem', borderRadius: '0.95rem', border: '1px solid #b45309', background: '#fff7ed', boxShadow: '0 18px 34px rgba(15, 23, 42, 0.18)' } as const;
