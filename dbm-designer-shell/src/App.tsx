import { useEffect, useState } from 'react';
import type {
  DbmDesignerPreviewStateV1,
  DbmDesignerWorkspaceV1,
  DbmModelV1,
  DbmProcessExperienceSnapshotV1,
  DbmRuntimeStateV1
} from 'dbm-contract';
import { buildProcessExperienceSnapshot, loadModelPackage, serializeModelPackage } from 'dbm-designer-core';
import type { DesignerDocument } from 'dbm-designer-core';
import { previewGraphAdapter } from './graphAdapter';
import type { DbmHostModelPackageRecord, DbmHostModelPackageSummary } from './hostBridge';
import {
  buildPackageResourceNames,
  createDraftPackageRecord,
  createPackageRepository,
  type DbmPackageRepository
} from './packageRepository';
import { ProcessPreview } from './processPreview';

interface EditorState {
  document: DesignerDocument | null;
  snapshot: DbmProcessExperienceSnapshotV1 | null;
  parseError: string | null;
}

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

export function App() {
  const [repository] = useState<DbmPackageRepository>(() => createPackageRepository());
  const [packages, setPackages] = useState<DbmHostModelPackageSummary[]>([]);
  const [selectedPackageName, setSelectedPackageName] = useState<string | null>(null);
  const [currentRecord, setCurrentRecord] = useState<DbmHostModelPackageRecord | null>(null);
  const [modelText, setModelText] = useState('');
  const [workspaceText, setWorkspaceText] = useState('');
  const [editorState, setEditorState] = useState<EditorState>({
    document: null,
    snapshot: null,
    parseError: null
  });
  const [isBusy, setIsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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

  function applyRecord(record: DbmHostModelPackageRecord) {
    const normalized = normalizeRecord(record);
    setCurrentRecord(normalized);
    setSelectedPackageName(normalized.packageName);
    setModelText(normalized.modelContent);
    setWorkspaceText(normalized.workspaceContent ?? '');
  }

  async function loadSelectedPackage(packageName: string) {
    setIsBusy(true);
    try {
      const loaded = await repository.loadPackage(packageName);
      if (!loaded) {
        setStatusMessage(`Package '${packageName}' could not be found.`);
        return;
      }

      applyRecord(loaded);
      setStatusMessage(`Loaded ${loaded.displayName ?? loaded.packageName}.`);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreatePackage() {
    const draft = createDraftPackageRecord();
    applyRecord(draft);
    setStatusMessage(`Created a draft package named ${draft.packageName}. Save it when you are ready.`);
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
          `Save blocked: model.package.id ('${serialized.model.package.id}') must stay aligned with the package resource name ('${currentRecord.packageName}') in R2.1.`
        );
        return;
      }

      const savedRecord = await repository.savePackage({
        ...currentRecord,
        displayName: serialized.model.package.displayName,
        modelContent: JSON.stringify(serialized.model, null, 2),
        workspaceContent: JSON.stringify(serialized.workspace, null, 2)
      });

      applyRecord(savedRecord);
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
      setModelText('');
      setWorkspaceText('');
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
      setModelText('');
      setWorkspaceText('');
      await refreshPackages(null);
      setStatusMessage(`Deleted ${currentRecord.packageName}.`);
    } finally {
      setIsBusy(false);
    }
  }

  function updateWorkspacePreview(previewPatch: Partial<DbmDesignerPreviewStateV1>) {
    if (!workspaceText) {
      return;
    }

    try {
      const workspace = JSON.parse(workspaceText) as DbmDesignerWorkspaceV1;
      const nextPreview: DbmDesignerPreviewStateV1 = {
        ...workspace.preview,
        ...previewPatch
      };

      if (previewPatch.stageId && editorState.document) {
        const targetStage = editorState.document.model.process.stages.find((stage) => stage.id === previewPatch.stageId);
        nextPreview.stepId =
          targetStage?.defaultStepId
          ?? targetStage?.stepIds[0]
          ?? editorState.document.model.process.steps.find((step) => step.stageId === targetStage?.id)?.id
          ?? null;
      }

      const nextWorkspace: DbmDesignerWorkspaceV1 = {
        ...workspace,
        preview: nextPreview
      };

      setWorkspaceText(JSON.stringify(nextWorkspace, null, 2));
    } catch {
      setStatusMessage('Preview controls require valid workspace JSON.');
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
    if (!isPersisted) {
      return;
    }

    if (currentRecord?.packageName === selectedPackageName) {
      return;
    }

    void loadSelectedPackage(selectedPackageName);
  }, [packages, selectedPackageName]);

  useEffect(() => {
    if (!modelText.trim()) {
      setEditorState({
        document: null,
        snapshot: null,
        parseError: null
      });
      return;
    }

    try {
      const model = JSON.parse(modelText) as DbmModelV1;
      const workspace = workspaceText.trim() ? (JSON.parse(workspaceText) as DbmDesignerWorkspaceV1) : null;
      const document = loadModelPackage(model, workspace);
      const serialized = serializeModelPackage(document);
      const snapshot = buildProcessExperienceSnapshot(
        serialized.model,
        buildPreviewRuntimeState(serialized.model, serialized.workspace),
        { audience: serialized.workspace.preview.mode }
      );

      setEditorState({
        document,
        snapshot,
        parseError: null
      });
    } catch (error) {
      setEditorState({
        document: null,
        snapshot: null,
        parseError: error instanceof Error ? error.message : 'Unknown editor parse error.'
      });
    }
  }, [modelText, workspaceText]);

  const validationIssues = editorState.document?.issues ?? [];
  const errorIssues = validationIssues.filter((issue) => issue.level === 'error');
  const currentWorkspace = editorState.document?.workspace ?? null;
  const graphDocument = editorState.document?.graph ?? null;
  const previewGraph = graphDocument ? previewGraphAdapter.toLibraryGraph(graphDocument) : null;
  const graphText = graphDocument ? JSON.stringify(graphDocument, null, 2) : '';

  return (
    <div style={appShellStyle}>
      <aside style={sidebarStyle}>
        <div style={panelHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>R2.1 Shell</div>
            <h1 style={sidebarHeadingStyle}>DBM Packages</h1>
          </div>
          <span style={hostBadgeStyle}>{repository.kind}</span>
        </div>

        <div style={sidebarActionsStyle}>
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
      </aside>

      <main style={mainStyle}>
        <header style={workspaceHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Package Workspace</div>
            <h2 style={workspaceTitleStyle}>{currentRecord?.displayName ?? 'Select or create a package'}</h2>
            <div style={workspaceMetaStyle}>
              {currentRecord ? `${currentRecord.modelName} + ${currentRecord.workspaceName}` : 'No package selected'}
            </div>
          </div>

          <div style={workspaceActionsStyle}>
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

        <section style={previewControlsSectionStyle}>
          <div style={controlCardStyle}>
            <div style={eyebrowStyle}>Preview Controls</div>
            {currentWorkspace && editorState.document ? (
              <div style={controlGridStyle}>
                <label style={fieldStyle}>
                  <span>Audience</span>
                  <select
                    value={currentWorkspace.preview.mode}
                    onChange={(event) => updateWorkspacePreview({ mode: event.target.value as DbmDesignerPreviewStateV1['mode'] })}
                    style={selectStyle}
                  >
                    <option value="internal">internal</option>
                    <option value="portal">portal</option>
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span>Stage</span>
                  <select
                    value={currentWorkspace.preview.stageId ?? ''}
                    onChange={(event) => updateWorkspacePreview({ stageId: event.target.value || null })}
                    style={selectStyle}
                  >
                    {editorState.document.model.process.stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span>Step</span>
                  <select
                    value={currentWorkspace.preview.stepId ?? ''}
                    onChange={(event) => updateWorkspacePreview({ stepId: event.target.value || null })}
                    style={selectStyle}
                  >
                    {editorState.document.model.process.steps
                      .filter((step) => step.stageId === currentWorkspace.preview.stageId)
                      .map((step) => (
                        <option key={step.id} value={step.id}>
                          {step.displayName}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            ) : (
              <div style={mutedCopyStyle}>Preview controls become available after a package is loaded.</div>
            )}
          </div>

          <div style={controlCardStyle}>
            <div style={eyebrowStyle}>Validation</div>
            <div style={validationSummaryStyle}>
              <span>{validationIssues.length} issue(s)</span>
              <span>{errorIssues.length} blocking</span>
            </div>
            {validationIssues.length > 0 ? (
              <div style={issueListStyle}>
                {validationIssues.map((issue) => (
                  <div key={`${issue.code}:${issue.path}`} style={issueItemStyle}>
                    <strong>{issue.level}</strong> {issue.code} at {issue.path}
                  </div>
                ))}
              </div>
            ) : (
              <div style={mutedCopyStyle}>The current model passes designer-core validation.</div>
            )}
          </div>

          <div style={controlCardStyle}>
            <div style={eyebrowStyle}>Portability Boundary</div>
            {previewGraph ? (
              <div style={portabilitySummaryStyle}>
                <span>{previewGraphAdapter.name}</span>
                <span>{previewGraph.groups.length} group(s)</span>
                <span>{previewGraph.nodes.length} node(s)</span>
                <span>{previewGraph.edges.length} edge(s)</span>
              </div>
            ) : (
              <div style={mutedCopyStyle}>The derived DBM graph document appears here after a package is loaded.</div>
            )}
            <div style={mutedCopyStyle}>
              The shell consumes a DBM-owned graph document rebuilt from the canonical model instead of persisting library graph JSON.
            </div>
          </div>
        </section>

        <section style={editorGridStyle}>
          <article style={editorPanelStyle}>
            <div style={editorPanelHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Canonical Model</div>
                <div style={editorPanelTitleStyle}>{currentRecord?.modelName ?? 'model.json'}</div>
              </div>
            </div>
            <textarea
              spellCheck={false}
              value={modelText}
              onChange={(event) => setModelText(event.target.value)}
              style={textareaStyle}
              placeholder="Model JSON"
            />
          </article>

          <article style={editorPanelStyle}>
            <div style={editorPanelHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Designer Workspace</div>
                <div style={editorPanelTitleStyle}>{currentRecord?.workspaceName ?? 'model.workspace.json'}</div>
              </div>
            </div>
            <textarea
              spellCheck={false}
              value={workspaceText}
              onChange={(event) => setWorkspaceText(event.target.value)}
              style={textareaStyle}
              placeholder="Workspace JSON"
            />
          </article>

          <article style={editorPanelStyle}>
            <div style={editorPanelHeaderStyle}>
              <div>
                <div style={eyebrowStyle}>Designer Graph Document</div>
                <div style={editorPanelTitleStyle}>Derived, portable, and not persisted in R2.1</div>
              </div>
            </div>
            <textarea
              spellCheck={false}
              value={graphText}
              readOnly
              style={textareaStyle}
              placeholder="Derived graph document JSON"
            />
          </article>
        </section>

        <section style={previewPanelStyle}>
          <ProcessPreview snapshot={editorState.snapshot} />
        </section>
      </main>
    </div>
  );
}

const appShellStyle = {
  minHeight: '100vh',
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  background: 'linear-gradient(180deg, #f7f4ed 0%, #eef2f7 100%)',
  color: '#111827',
  fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif'
} as const;

const sidebarStyle = {
  padding: '1.5rem',
  borderRight: '1px solid #d6d3d1',
  background: 'rgba(255,255,255,0.82)',
  backdropFilter: 'blur(10px)',
  display: 'grid',
  gap: '1rem',
  alignContent: 'start'
} as const;

const panelHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.75rem',
  alignItems: 'flex-start'
} as const;

const sidebarHeadingStyle = {
  margin: '0.35rem 0 0',
  fontSize: '1.5rem'
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

const sidebarActionsStyle = {
  display: 'flex',
  gap: '0.65rem'
} as const;

const packageListStyle = {
  display: 'grid',
  gap: '0.75rem',
  maxHeight: 'calc(100vh - 12rem)',
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

const mainStyle = {
  display: 'grid',
  gap: '1rem',
  padding: '1.5rem'
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
  fontSize: '1.8rem'
} as const;

const workspaceMetaStyle = {
  marginTop: '0.45rem',
  color: '#6b7280'
} as const;

const workspaceActionsStyle = {
  display: 'flex',
  gap: '0.65rem'
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

const previewControlsSectionStyle = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'
} as const;

const controlCardStyle = {
  padding: '1rem',
  borderRadius: '1rem',
  background: 'rgba(255,255,255,0.88)',
  border: '1px solid #d6d3d1',
  display: 'grid',
  gap: '0.9rem'
} as const;

const controlGridStyle = {
  display: 'grid',
  gap: '0.85rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))'
} as const;

const fieldStyle = {
  display: 'grid',
  gap: '0.35rem',
  fontSize: '0.9rem'
} as const;

const selectStyle = {
  padding: '0.65rem 0.75rem',
  borderRadius: '0.75rem',
  border: '1px solid #d6d3d1',
  background: '#fff'
} as const;

const validationSummaryStyle = {
  display: 'flex',
  gap: '0.9rem',
  fontSize: '0.92rem'
} as const;

const portabilitySummaryStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.9rem',
  fontSize: '0.92rem'
} as const;

const issueListStyle = {
  display: 'grid',
  gap: '0.5rem',
  maxHeight: '180px',
  overflow: 'auto'
} as const;

const issueItemStyle = {
  padding: '0.7rem 0.8rem',
  borderRadius: '0.8rem',
  background: '#f4f4f5',
  fontSize: '0.84rem'
} as const;

const editorGridStyle = {
  display: 'grid',
  gap: '1rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))'
} as const;

const editorPanelStyle = {
  minHeight: '420px',
  borderRadius: '1rem',
  border: '1px solid #d6d3d1',
  background: 'rgba(255,255,255,0.88)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)'
} as const;

const editorPanelHeaderStyle = {
  padding: '1rem 1rem 0.75rem',
  borderBottom: '1px solid #e7e5e4'
} as const;

const editorPanelTitleStyle = {
  marginTop: '0.3rem',
  fontWeight: 700,
  fontFamily: '"Cascadia Code", "Consolas", monospace'
} as const;

const textareaStyle = {
  width: '100%',
  minHeight: '360px',
  border: '0',
  resize: 'vertical',
  background: 'transparent',
  padding: '1rem',
  fontFamily: '"Cascadia Code", "Consolas", monospace',
  fontSize: '0.84rem',
  lineHeight: 1.55,
  color: '#111827'
} as const;

const previewPanelStyle = {
  padding: '1rem',
  borderRadius: '1rem',
  border: '1px solid #d6d3d1',
  background: 'rgba(255,255,255,0.88)'
} as const;

const mutedCopyStyle = {
  color: '#6b7280',
  fontSize: '0.9rem'
} as const;
