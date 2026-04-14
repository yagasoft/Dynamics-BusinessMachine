import { useEffect, useMemo, useState } from 'react';
import { DndContext, DragOverlay, useDraggable } from '@dnd-kit/core';
import type {
  DbmDesignerPreviewStateV1,
  DbmDesignerWorkspaceV1,
  DbmModelV1,
  DbmProcessExperienceSnapshotV1,
  DbmRuntimeStateV1
} from 'dbm-contract';
import {
  applyGraphIntent,
  loadModelPackage,
  serializeModel,
  serializeModelPackage,
  type DesignerDocument,
  type DesignerGraphIntent
} from 'dbm-designer-core';
import type { DbmHostModelPackageRecord, DbmHostModelPackageSummary } from './hostBridge';
import {
  buildPackageResourceNames,
  createDraftPackageRecord,
  type DbmPackageRepository
} from './packageRepository';
import { buildProcessExperienceSnapshot } from 'dbm-designer-core';
import { DiagnosticsDrawer } from './diagnosticsDrawer';
import { GraphCanvas } from './graphCanvas';
import { InspectorPanel, resolveInspectorSelection } from './inspectorPanel';

interface DesignerShellProps {
  repository: DbmPackageRepository;
}

interface EditorState {
  document: DesignerDocument | null;
  snapshot: DbmProcessExperienceSnapshotV1 | null;
  parseError: string | null;
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
  const snapshot = buildProcessExperienceSnapshot(
    serialized.model,
    buildPreviewRuntimeState(serialized.model, serialized.workspace),
    {
      audience: serialized.workspace.preview.mode
    }
  );

  return {
    document,
    snapshot,
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
  return {
    ...nextDocument,
    dirty
  };
}

function mutateWorkspace(
  document: DesignerDocument,
  mutate: (workspace: DbmDesignerWorkspaceV1) => void,
  dirty = true
): DesignerDocument {
  const nextWorkspace = structuredClone(document.workspace);
  mutate(nextWorkspace);
  const nextDocument = loadModelPackage(serializeModel(document), nextWorkspace);
  return {
    ...nextDocument,
    dirty
  };
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
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{
        ...paletteButtonStyle,
        ...(disabled ? disabledPaletteButtonStyle : {}),
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.72 : 1
      }}
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
  const [editorState, setEditorState] = useState<EditorState>({
    document: null,
    snapshot: null,
    parseError: null
  });
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);

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

  function applyLoadedRecord(record: DbmHostModelPackageRecord) {
    const normalized = normalizeRecord(record);
    setCurrentRecord(normalized);
    setSelectedPackageName(normalized.packageName);

    try {
      const parsedModel = JSON.parse(normalized.modelContent) as DbmModelV1;
      const parsedWorkspace = normalized.workspaceContent ? (JSON.parse(normalized.workspaceContent) as DbmDesignerWorkspaceV1) : null;
      const document = loadModelPackage(parsedModel, parsedWorkspace);
      setEditorState(buildEditorState(document));
    } catch (error) {
      setEditorState({
        document: null,
        snapshot: null,
        parseError: error instanceof Error ? error.message : 'Unknown load error.'
      });
    }
  }

  function applyDocument(document: DesignerDocument) {
    setEditorState(buildEditorState(document));
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
        setStatusMessage(
          `Save blocked: model.package.id ('${serialized.model.package.id}') must stay aligned with the package resource name ('${currentRecord.packageName}') in R2.2.`
        );
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
      setEditorState({
        document: null,
        snapshot: null,
        parseError: null
      });
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
      setEditorState({
        document: null,
        snapshot: null,
        parseError: null
      });
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

    applyDocument(
      mutateWorkspace(editorState.document, (workspace) => {
        workspace.nodePositions[nodeId] = position;
      })
    );
  }

  function handlePreviewStageChange(stageId: string | null) {
    if (!editorState.document) {
      return;
    }

    applyDocument(
      mutateWorkspace(editorState.document, (workspace) => {
        workspace.preview.stageId = stageId;
        const stage = editorState.document?.model.process.stages.find((entry) => entry.id === stageId);
        workspace.preview.stepId =
          stage?.defaultStepId
          ?? stage?.stepIds[0]
          ?? editorState.document?.model.process.steps.find((step) => step.stageId === stage?.id)?.id
          ?? null;
      })
    );
  }

  function handlePreviewStepChange(stepId: string | null) {
    if (!editorState.document) {
      return;
    }

    applyDocument(
      mutateWorkspace(editorState.document, (workspace) => {
        workspace.preview.stepId = stepId;
      })
    );
  }

  function handlePreviewModeChange(mode: 'internal' | 'portal') {
    if (!editorState.document) {
      return;
    }

    applyDocument(
      mutateWorkspace(editorState.document, (workspace) => {
        workspace.preview.mode = mode;
      })
    );
  }

  function handleGraphIntent(intent: DesignerGraphIntent) {
    if (!editorState.document) {
      return;
    }

    const result = applyGraphIntent(editorState.document, intent);
    const nextSelectionId = result.affectedNodeId ?? result.document.selectionId;
    applyDocument(syncSelectionPreview(result.document, nextSelectionId, true));
  }

  function handleAddPaletteItem(kind: PaletteItemKind) {
    if (!editorState.document) {
      return;
    }

    if (kind === 'stage') {
      handleGraphIntent({
        kind: 'add-stage',
        actorId: editorState.document.model.process.actors[0]?.id
      });
      return;
    }

    const stageId = resolvePaletteStageId(editorState.document);
    if (!stageId) {
      setStatusMessage('Select a stage before adding a step.');
      return;
    }

    handleGraphIntent({
      kind: 'add-step',
      stageId
    });
  }

  useEffect(() => {
    void refreshPackages(null);
  }, []);

  useEffect(() => {
    if (!selectedPackageName) {
      return;
    }

    const isPersisted = packages.some((entry) => entry.packageName === selectedPackageName);
    if (!isPersisted) {
      return;
    }

    if (currentRecord?.packageName === selectedPackageName) {
      return;
    }

    void loadSelectedPackage(selectedPackageName);
  }, [packages, selectedPackageName]);

  const validationIssues = editorState.document?.issues ?? [];
  const errorIssues = validationIssues.filter((issue) => issue.level === 'error');
  const selection = useMemo(
    () => resolveInspectorSelection(editorState.document),
    [editorState.document]
  );
  const paletteStageId = resolvePaletteStageId(editorState.document);
  const diagnosticsPayload = editorState.document
    ? serializeModelPackage(editorState.document)
    : null;

  return (
    <DndContext
      onDragStart={(event) => {
        if (event.active.id === 'palette-stage') {
          setActiveDragLabel('New Stage');
        } else if (event.active.id === 'palette-step') {
          setActiveDragLabel('New Step');
        }
      }}
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
            <button type="button" style={primaryButtonStyle} onClick={() => void handleCreatePackage()}>
              New Package
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={() => void refreshPackages(selectedPackageName)}>
              Refresh
            </button>
          </div>

          <div style={packageListStyle}>
            {packages.map((entry) => (
              <button
                key={entry.packageName}
                type="button"
                style={{
                  ...packageButtonStyle,
                  ...(selectedPackageName === entry.packageName ? packageButtonActiveStyle : {})
                }}
                onClick={() => setSelectedPackageName(entry.packageName)}
              >
                <span style={packageButtonTitleStyle}>{entry.displayName ?? entry.packageName}</span>
                <span style={packageButtonMetaStyle}>{entry.packageName}</span>
                <span style={packageButtonMetaStyle}>{entry.hasWorkspace ? 'workspace ready' : 'legacy model only'}</span>
              </button>
            ))}
          </div>

          <div style={panelCardStyle}>
            <div style={eyebrowStyle}>Palette</div>
            <div style={mutedCopyStyle}>
              Drag to the canvas or click to author through DBM graph intents.
            </div>
            <PaletteButton
              id="palette-stage"
              label="Stage"
              description="Add a new durable process milestone."
              onClick={() => handleAddPaletteItem('stage')}
            />
            <PaletteButton
              id="palette-step"
              label="Step"
              description={paletteStageId ? `Add to ${paletteStageId}` : 'Select a stage first.'}
              disabled={!paletteStageId}
              onClick={() => handleAddPaletteItem('step')}
            />
          </div>

          <div style={panelCardStyle}>
            <div style={eyebrowStyle}>Validation</div>
            <div style={validationSummaryStyle}>
              <span>{validationIssues.length} issue(s)</span>
              <span>{errorIssues.length} blocking</span>
            </div>
            {validationIssues.length > 0 ? (
              <div style={issueListStyle}>
                {validationIssues.map((issue) => (
                  <button
                    key={`${issue.code}:${issue.path}`}
                    type="button"
                    style={issueButtonStyle}
                    onClick={() => handleSelectionChange(issue.nodeId ?? 'document:root')}
                  >
                    <strong>{issue.level}</strong> {issue.code}
                    <span style={issuePathStyle}>{issue.path}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div style={mutedCopyStyle}>The current model passes designer-core validation.</div>
            )}
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
              <div style={workspaceMetaStyle}>
                {currentRecord ? `${currentRecord.modelName} + ${currentRecord.workspaceName}` : 'No package selected'}
              </div>
            </div>

            <div style={workspaceActionsStyle}>
              <button type="button" style={secondaryButtonStyle} onClick={() => setDiagnosticsOpen(true)} disabled={!editorState.document}>
                Diagnostics
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={() => void handleDelete()} disabled={!currentRecord || isBusy}>
                Delete
              </button>
              <button type="button" style={primaryButtonStyle} onClick={() => void handleSave()} disabled={!currentRecord || isBusy || !!editorState.parseError}>
                Save Package
              </button>
            </div>
          </header>

          {statusMessage ? <div style={statusBannerStyle}>{statusMessage}</div> : null}
          {editorState.parseError ? <div style={errorBannerStyle}>Editor parse error: {editorState.parseError}</div> : null}
          {isBusy ? <div style={statusBannerStyle}>Working...</div> : null}

          <div style={designerGridStyle}>
            <section style={canvasColumnStyle}>
              <GraphCanvas
                document={editorState.document}
                onSelectionChange={handleSelectionChange}
                onGraphIntent={handleGraphIntent}
                onNodePositionCommit={handleNodePositionCommit}
              />
            </section>

            <aside style={inspectorColumnStyle}>
              <InspectorPanel
                document={editorState.document}
                selection={selection}
                onIntent={handleGraphIntent}
                onPreviewStageChange={handlePreviewStageChange}
                onPreviewStepChange={handlePreviewStepChange}
                onPreviewModeChange={handlePreviewModeChange}
                snapshot={editorState.snapshot}
              />
            </aside>
          </div>
        </main>
      </div>

      <DragOverlay>
        {activeDragLabel ? <div style={dragOverlayStyle}>{activeDragLabel}</div> : null}
      </DragOverlay>

      <DiagnosticsDrawer
        open={diagnosticsOpen}
        onOpenChange={setDiagnosticsOpen}
        modelText={diagnosticsPayload ? JSON.stringify(diagnosticsPayload.model, null, 2) : ''}
        workspaceText={diagnosticsPayload ? JSON.stringify(diagnosticsPayload.workspace, null, 2) : ''}
        graphText={editorState.document ? JSON.stringify(editorState.document.graph, null, 2) : ''}
      />
    </DndContext>
  );
}

const shellStyle = {
  minHeight: '100vh',
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  background: 'linear-gradient(180deg, #f7f4ed 0%, #eef2f7 100%)',
  color: '#111827',
  fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif'
} as const;

const sidebarStyle = {
  padding: '1.35rem',
  borderRight: '1px solid #d6d3d1',
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(12px)',
  display: 'grid',
  gap: '1rem',
  alignContent: 'start'
} as const;

const mainStyle = {
  display: 'grid',
  gap: '1rem',
  padding: '1.35rem'
} as const;

const designerGridStyle = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'minmax(0, 1fr) 420px',
  alignItems: 'start'
} as const;

const canvasColumnStyle = {
  minWidth: 0
} as const;

const inspectorColumnStyle = {
  display: 'grid',
  gap: '1rem'
} as const;

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  alignItems: 'flex-start'
} as const;

const titleStyle = {
  margin: '0.35rem 0 0',
  fontSize: '1.45rem'
} as const;

const workspaceHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'flex-start',
  flexWrap: 'wrap'
} as const;

const workspaceTitleStyle = {
  margin: '0.35rem 0 0',
  fontSize: '1.7rem',
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'center',
  flexWrap: 'wrap'
} as const;

const workspaceMetaStyle = {
  marginTop: '0.45rem',
  color: '#6b7280'
} as const;

const workspaceActionsStyle = {
  display: 'flex',
  gap: '0.65rem',
  flexWrap: 'wrap'
} as const;

const packageListStyle = {
  display: 'grid',
  gap: '0.75rem',
  maxHeight: 'calc(100vh - 24rem)',
  overflow: 'auto',
  paddingRight: '0.35rem'
} as const;

const packageButtonStyle = {
  padding: '0.95rem 1rem',
  borderRadius: '1rem',
  border: '1px solid #d6d3d1',
  background: '#ffffff',
  display: 'grid',
  gap: '0.25rem',
  textAlign: 'left',
  cursor: 'pointer'
} as const;

const packageButtonActiveStyle = {
  borderColor: '#b45309',
  boxShadow: '0 16px 30px rgba(180, 83, 9, 0.12)',
  transform: 'translateY(-1px)'
} as const;

const packageButtonTitleStyle = {
  fontWeight: 700
} as const;

const packageButtonMetaStyle = {
  fontSize: '0.82rem',
  color: '#6b7280'
} as const;

const panelCardStyle = {
  padding: '1rem',
  borderRadius: '1rem',
  border: '1px solid #d6d3d1',
  background: 'rgba(255,255,255,0.88)',
  display: 'grid',
  gap: '0.8rem'
} as const;

const eyebrowStyle = {
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#6b7280'
} as const;

const hostBadgeStyle = {
  padding: '0.4rem 0.7rem',
  borderRadius: '999px',
  border: '1px solid #d4d4d8',
  background: '#fff'
} as const;

const buttonRowStyle = {
  display: 'flex',
  gap: '0.65rem',
  flexWrap: 'wrap'
} as const;

const primaryButtonStyle = {
  padding: '0.72rem 1rem',
  borderRadius: '0.9rem',
  border: '1px solid #8b5e34',
  background: '#b45309',
  color: '#fff',
  cursor: 'pointer'
} as const;

const secondaryButtonStyle = {
  padding: '0.72rem 1rem',
  borderRadius: '0.9rem',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer'
} as const;

const paletteButtonStyle = {
  padding: '0.85rem 0.95rem',
  borderRadius: '0.95rem',
  border: '1px solid #d6d3d1',
  background: '#fff',
  display: 'grid',
  gap: '0.25rem',
  textAlign: 'left',
  cursor: 'grab'
} as const;

const disabledPaletteButtonStyle = {
  opacity: 0.55,
  cursor: 'not-allowed'
} as const;

const paletteButtonTitleStyle = {
  fontWeight: 700
} as const;

const paletteButtonMetaStyle = {
  fontSize: '0.82rem',
  color: '#6b7280'
} as const;

const statusBannerStyle = {
  padding: '0.85rem 1rem',
  borderRadius: '0.85rem',
  border: '1px solid #cbd5e1',
  background: 'rgba(255,255,255,0.88)'
} as const;

const errorBannerStyle = {
  padding: '0.85rem 1rem',
  borderRadius: '0.85rem',
  border: '1px solid #fca5a5',
  background: '#fef2f2',
  color: '#991b1b'
} as const;

const validationSummaryStyle = {
  display: 'flex',
  gap: '0.9rem',
  fontSize: '0.92rem'
} as const;

const issueListStyle = {
  display: 'grid',
  gap: '0.45rem',
  maxHeight: '220px',
  overflow: 'auto'
} as const;

const issueButtonStyle = {
  display: 'grid',
  gap: '0.25rem',
  padding: '0.7rem 0.8rem',
  borderRadius: '0.85rem',
  border: '1px solid #e7e5e4',
  background: '#f8fafc',
  textAlign: 'left',
  cursor: 'pointer'
} as const;

const issuePathStyle = {
  fontSize: '0.76rem',
  color: '#64748b'
} as const;

const mutedCopyStyle = {
  color: '#6b7280',
  fontSize: '0.9rem'
} as const;

const dirtyBadgeStyle = {
  padding: '0.28rem 0.58rem',
  borderRadius: '999px',
  background: '#fff7ed',
  border: '1px solid #fdba74',
  color: '#9a3412',
  fontSize: '0.78rem'
} as const;

const dragOverlayStyle = {
  padding: '0.8rem 1rem',
  borderRadius: '0.95rem',
  border: '1px solid #b45309',
  background: '#fff7ed',
  boxShadow: '0 18px 34px rgba(15, 23, 42, 0.18)'
} as const;
