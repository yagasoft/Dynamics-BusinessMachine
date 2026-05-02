import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type {
  DbmDesignerWorkspaceV1,
  DbmModelV1,
  DbmProcessPortfolioProjectionAudienceV1,
  DbmProcessV1,
  DbmStageCategoryV1,
  DbmStageSpanV1,
  DbmStageV1,
  DbmSubProcessVisibilityRuleV1
} from 'dbm-contract';
import {
  applyGraphIntent,
  loadModelPackage,
  orderedProcesses,
  resolveMainProcess,
  serializeModelPackage
} from 'dbm-designer-core';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import { GraphCanvas } from './graphCanvas';
import type { DbmHostModelPackageRecord, DbmHostModelPackageSummary } from './hostBridge';
import { createDraftPackageRecord, type DbmPackageRepository } from './packageRepository';

interface DesignerShellProps {
  repository: DbmPackageRepository;
}

const stageCategoryOptions: DbmStageCategoryV1[] = ['start', 'work', 'decision', 'system', 'milestone', 'end'];

function uniqueId(existingIds: string[], prefix: string): string {
  let counter = 1;
  let candidate = prefix;
  while (existingIds.includes(candidate)) {
    counter += 1;
    candidate = `${prefix}-${counter}`;
  }

  return candidate;
}

function parsePackageRecord(record: DbmHostModelPackageRecord): DesignerDocument {
  const model = JSON.parse(record.modelContent) as DbmModelV1;
  const workspace = record.workspaceContent
    ? JSON.parse(record.workspaceContent) as DbmDesignerWorkspaceV1
    : null;
  return loadModelPackage(model, workspace);
}

function safeMainProcess(document: DesignerDocument | null): DbmProcessV1 | null {
  if (!document) {
    return null;
  }

  try {
    return resolveMainProcess(document);
  } catch {
    return document.model.processPortfolio.processes[0] ?? null;
  }
}

function createSubProcess(document: DesignerDocument): DbmProcessV1 {
  const main = safeMainProcess(document);
  const id = uniqueId(document.model.processPortfolio.processes.map((process) => process.id), 'sub-process');
  const actorId = uniqueId([], `${id}-owner`);
  const defaultRule = document.model.rules.find((rule) => rule.scope === 'process')?.id ?? null;

  return {
    id,
    displayName: 'New sub-process',
    role: 'sub-process',
    processTypeId: id,
    mainDisplayMode: 'expanded',
    statusId: main?.statuses[0]?.id ?? '',
    portalStatusId: null,
    renderOrder: document.model.processPortfolio.processes.length,
    subProcessVisibility: defaultRule ? [{ audience: 'form', ruleId: defaultRule, visibleWhen: true }] : [],
    actors: [
      {
        id: actorId,
        displayName: 'Sub-process owner',
        actorCategory: 'team',
        roleKey: id,
        source: 'field-binding'
      }
    ],
    variables: [],
    statuses: main?.statuses[0] ? [structuredClone(main.statuses[0])] : [],
    tasks: [],
    notifications: [],
    stages: [],
    steps: [],
    transitions: [],
    stepTransitions: [],
    outcomes: []
  };
}

function stageSpanValue(stage: DbmStageV1 | null): DbmStageSpanV1 | null {
  return stage?.stageSpan ?? null;
}

function formatFraction(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

function processOptionLabel(process: DbmProcessV1, mainProcessId: string | null): string {
  return `${process.displayName} - ${process.id}${process.id === mainProcessId ? ' - main' : ''}`;
}

function stageOptionLabel(stage: DbmStageV1): string {
  return `${stage.displayName} - ${stage.id}`;
}

function visibilityValue(process: DbmProcessV1 | null, audience: DbmProcessPortfolioProjectionAudienceV1): string {
  const rule = process?.subProcessVisibility?.find((entry) => entry.audience === audience);
  return rule?.ruleId ? `${rule.ruleId}:${String(rule.visibleWhen)}` : '';
}

function updateVisibilityRules(
  rules: DbmSubProcessVisibilityRuleV1[] | undefined,
  audience: DbmProcessPortfolioProjectionAudienceV1,
  value: string
): DbmSubProcessVisibilityRuleV1[] {
  const retainedRules = (rules ?? []).filter((rule) => rule.audience !== audience);
  if (!value) {
    return retainedRules;
  }

  const [ruleId, visibleWhen] = value.split(':');
  return [
    ...retainedRules,
    {
      audience,
      ruleId,
      visibleWhen: visibleWhen !== 'false'
    }
  ];
}

function resolveSelectedProcess(document: DesignerDocument | null, selectedProcessId: string | null): DbmProcessV1 | null {
  if (!document) {
    return null;
  }

  const processes = orderedProcesses(document.model);
  return processes.find((process) => process.id === selectedProcessId) ?? safeMainProcess(document) ?? processes[0] ?? null;
}

function resolveSelectedStage(process: DbmProcessV1 | null, selectedStageId: string | null): DbmStageV1 | null {
  return process?.stages.find((stage) => stage.id === selectedStageId) ?? process?.stages[0] ?? null;
}

export function DesignerShell({ repository }: DesignerShellProps) {
  const [packages, setPackages] = useState<DbmHostModelPackageSummary[]>([]);
  const [record, setRecord] = useState<DbmHostModelPackageRecord | null>(null);
  const [document, setDocument] = useState<DesignerDocument | null>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [spanStartFractionDraft, setSpanStartFractionDraft] = useState('0');
  const [spanEndFractionDraft, setSpanEndFractionDraft] = useState('1');
  const [status, setStatus] = useState('Loading packages...');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadInitialPackage() {
      setBusy(true);
      try {
        const packageSummaries = await repository.listPackages();
        if (!mounted) {
          return;
        }

        const initialRecord = packageSummaries[0]
          ? await repository.loadPackage(packageSummaries[0].packageName)
          : createDraftPackageRecord();
        const resolvedRecord = initialRecord ?? createDraftPackageRecord();
        const nextDocument = parsePackageRecord(resolvedRecord);
        const main = safeMainProcess(nextDocument);

        setPackages(packageSummaries);
        setRecord(resolvedRecord);
        setDocument(nextDocument);
        setSelectedProcessId(main?.id ?? nextDocument.model.processPortfolio.processes[0]?.id ?? null);
        setSelectedStageId(main?.stages[0]?.id ?? null);
        setStatus(packageSummaries.length > 0 ? `Loaded ${resolvedRecord.displayName ?? resolvedRecord.packageName}` : 'Started a new browser draft');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to load designer package.');
      } finally {
        if (mounted) {
          setBusy(false);
        }
      }
    }

    void loadInitialPackage();
    return () => {
      mounted = false;
    };
  }, [repository]);

  const mainProcess = useMemo(() => safeMainProcess(document), [document]);
  const processes = useMemo(() => (document ? orderedProcesses(document.model) : []), [document]);
  const selectedProcess = useMemo(() => resolveSelectedProcess(document, selectedProcessId), [document, selectedProcessId]);
  const selectedStage = useMemo(() => resolveSelectedStage(selectedProcess, selectedStageId), [selectedProcess, selectedStageId]);
  const processRules = document?.model.rules.filter((rule) => rule.scope === 'process') ?? [];

  useEffect(() => {
    setSpanStartFractionDraft(formatFraction(selectedStage?.stageSpan.start.fraction ?? 0));
    setSpanEndFractionDraft(formatFraction(selectedStage?.stageSpan.end.fraction ?? 1));
  }, [selectedProcess?.id, selectedStage?.id]);

  function applyIntent(intent: DesignerGraphIntent, nextSelection?: { processId?: string | null; stageId?: string | null }) {
    if (!document) {
      return null;
    }

    const result = applyGraphIntent(document, intent);
    setDocument(result.document);
    if (nextSelection?.processId !== undefined) {
      setSelectedProcessId(nextSelection.processId);
    }
    if (nextSelection?.stageId !== undefined) {
      setSelectedStageId(nextSelection.stageId);
    }
    setStatus(result.issues.some((issue) => issue.level === 'error') ? 'Saved model has validation errors to resolve.' : 'Authoring change applied.');
    return result.document;
  }

  function handleSelectPackage(packageName: string) {
    async function loadSelectedPackage() {
      setBusy(true);
      try {
        const loaded = await repository.loadPackage(packageName);
        if (!loaded) {
          setStatus(`Package ${packageName} was not found.`);
          return;
        }

        const nextDocument = parsePackageRecord(loaded);
        const main = safeMainProcess(nextDocument);
        setRecord(loaded);
        setDocument(nextDocument);
        setSelectedProcessId(main?.id ?? nextDocument.model.processPortfolio.processes[0]?.id ?? null);
        setSelectedStageId(main?.stages[0]?.id ?? null);
        setStatus(`Loaded ${loaded.displayName ?? loaded.packageName}`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Failed to load selected package.');
      } finally {
        setBusy(false);
      }
    }

    void loadSelectedPackage();
  }

  function handleAddSubProcess() {
    if (!document) {
      return;
    }

    const process = createSubProcess(document);
    applyIntent(
      {
        kind: 'add-process',
        process
      },
      {
        processId: process.id,
        stageId: null
      }
    );
  }

  function handleAddStage() {
    if (!document || !selectedProcess) {
      return;
    }

    const beforeStageIds = new Set(selectedProcess.stages.map((stage) => stage.id));
    const nextDocument = applyIntent(
      {
        kind: 'add-stage',
        processId: selectedProcess.id
      },
      {
        processId: selectedProcess.id
      }
    );
    const nextProcess = nextDocument?.model.processPortfolio.processes.find((process) => process.id === selectedProcess.id);
    const addedStage = nextProcess?.stages.find((stage) => !beforeStageIds.has(stage.id)) ?? nextProcess?.stages.at(-1) ?? null;
    setSelectedStageId(addedStage?.id ?? null);
  }

  function updateProcess(value: Partial<Pick<DbmProcessV1, 'displayName' | 'processTypeId' | 'mainDisplayMode' | 'subProcessVisibility'>>) {
    if (!selectedProcess) {
      return;
    }

    applyIntent({
      kind: 'update-process',
      processId: selectedProcess.id,
      value
    });
  }

  function updateStage(value: Partial<Pick<DbmStageV1, 'displayName' | 'stageCategory' | 'stageKindId' | 'scope' | 'stageSpan' | 'portalVisibility'>>) {
    if (!selectedProcess || !selectedStage) {
      return;
    }

    applyIntent({
      kind: 'update-stage',
      processId: selectedProcess.id,
      stageId: selectedStage.id,
      value
    });
  }

  function updateStageSpan(anchor: 'start' | 'end', key: 'stageId' | 'fraction', value: string) {
    const currentSpan = stageSpanValue(selectedStage);
    if (!currentSpan) {
      return;
    }

    const nextSpan: DbmStageSpanV1 = structuredClone(currentSpan);
    if (key === 'fraction') {
      const parsedValue = Number(value);
      if (!Number.isFinite(parsedValue)) {
        return;
      }
      nextSpan[anchor].fraction = parsedValue;
    } else {
      nextSpan[anchor].stageId = value;
    }
    updateStage({ stageSpan: nextSpan });
  }

  function updateStageSpanFraction(anchor: 'start' | 'end', value: string) {
    if (anchor === 'start') {
      setSpanStartFractionDraft(value);
    } else {
      setSpanEndFractionDraft(value);
    }
    updateStageSpan(anchor, 'fraction', value);
  }

  function handleMoveProcess(delta: number) {
    if (!document || !selectedProcess) {
      return;
    }

    const currentIndex = processes.findIndex((process) => process.id === selectedProcess.id);
    if (currentIndex < 0) {
      return;
    }

    applyIntent({
      kind: 'move-process',
      processId: selectedProcess.id,
      targetIndex: Math.max(0, Math.min(processes.length - 1, currentIndex + delta))
    });
  }

  function handleMoveStage(delta: number) {
    if (!selectedProcess || !selectedStage) {
      return;
    }

    const currentIndex = selectedProcess.stages.findIndex((stage) => stage.id === selectedStage.id);
    if (currentIndex < 0) {
      return;
    }

    applyIntent({
      kind: 'move-stage',
      processId: selectedProcess.id,
      stageId: selectedStage.id,
      targetIndex: Math.max(0, Math.min(selectedProcess.stages.length - 1, currentIndex + delta))
    });
  }

  function handleGraphSelection(selectionId: string | null) {
    if (!selectionId) {
      return;
    }

    if (selectionId.startsWith('timeline:')) {
      const processId = selectionId.slice('timeline:'.length);
      const process = processes.find((entry) => entry.id === processId);
      setSelectedProcessId(process?.id ?? selectedProcessId);
      setSelectedStageId(process?.stages[0]?.id ?? null);
      return;
    }

    const stageMatch = /^stage:(?<processId>[^:]+):(?<stageId>[^:]+)$/.exec(selectionId);
    if (stageMatch?.groups) {
      setSelectedProcessId(stageMatch.groups.processId);
      setSelectedStageId(stageMatch.groups.stageId);
    }
  }

  async function handleSave() {
    if (!document || !record) {
      return;
    }

    const modelPackage = serializeModelPackage(document);
    const nextRecord: DbmHostModelPackageRecord = {
      ...record,
      packageName: modelPackage.model.package.id,
      displayName: modelPackage.model.package.displayName,
      modelContent: JSON.stringify(modelPackage.model, null, 2),
      workspaceContent: JSON.stringify(modelPackage.workspace, null, 2)
    };

    setBusy(true);
    try {
      const saved = await repository.savePackage(nextRecord);
      setRecord(saved);
      setDocument(loadModelPackage(modelPackage.model, modelPackage.workspace));
      setStatus(`Saved ${saved.displayName ?? saved.packageName}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save package.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>R1.3 designer authoring foundation</p>
          <h1 style={titleStyle}>Timeline Studio</h1>
        </div>
        <div style={toolbarStyle}>
          <select
            aria-label="Package"
            value={record?.packageName ?? ''}
            onChange={(event) => handleSelectPackage(event.target.value)}
            style={selectStyle}
            disabled={busy || packages.length === 0}
          >
            {record && packages.length === 0 ? (
              <option value={record.packageName}>{record.displayName ?? record.packageName}</option>
            ) : null}
            {packages.map((entry) => (
              <option key={entry.packageName} value={entry.packageName}>
                {entry.displayName ?? entry.packageName}
              </option>
            ))}
          </select>
          <button type="button" style={primaryButtonStyle} onClick={handleSave} disabled={!document || !record || busy}>
            Save package
          </button>
        </div>
      </header>

      <section style={statusBarStyle}>
        <span>{status}</span>
        <span>{document ? `${document.issues.length} validation issue(s)` : 'No document loaded'}</span>
      </section>

      <section style={studioGridStyle}>
        <div style={canvasPanelStyle}>
          <div style={sectionHeadingRowStyle}>
            <div>
              <h2 style={sectionTitleStyle}>Process timeline</h2>
              <p style={sectionCopyStyle}>Main stages form the timeline; sub-process stages author spans against that main-process anchor.</p>
            </div>
            <div style={buttonRowStyle}>
              <button type="button" style={secondaryButtonStyle} onClick={handleAddSubProcess} disabled={!document || busy}>
                Add sub-process
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={handleAddStage} disabled={!selectedProcess || busy}>
                Add stage
              </button>
            </div>
          </div>
          <GraphCanvas document={document} onSelectionChange={handleGraphSelection} />
          <div style={laneListStyle}>
            {processes.map((process) => (
              <button
                key={process.id}
                type="button"
                style={{
                  ...laneButtonStyle,
                  ...(selectedProcess?.id === process.id ? selectedLaneButtonStyle : {})
                }}
                onClick={() => {
                  setSelectedProcessId(process.id);
                  setSelectedStageId(process.stages[0]?.id ?? null);
                }}
              >
                <span style={laneRoleStyle}>{process.role === 'main' ? 'Main process' : 'Sub-process'}</span>
                <span style={laneLabelStyle}>{process.id === mainProcess?.id ? `Main: ${process.displayName}` : `Lane: ${process.displayName}`}</span>
                <span style={laneMetaStyle}>{process.stages.length} stage(s)</span>
              </button>
            ))}
          </div>
        </div>

        <aside style={inspectorStyle}>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Process authoring</h2>
            <label style={fieldStyle}>
              <span>Selected process</span>
              <select
                value={selectedProcess?.id ?? ''}
                onChange={(event) => {
                  const process = processes.find((entry) => entry.id === event.target.value) ?? null;
                  setSelectedProcessId(process?.id ?? null);
                  setSelectedStageId(process?.stages[0]?.id ?? null);
                }}
                style={inputStyle}
              >
                {processes.map((process) => (
                  <option key={process.id} value={process.id}>
                    {processOptionLabel(process, mainProcess?.id ?? null)}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Process display name</span>
              <input
                value={selectedProcess?.displayName ?? ''}
                onChange={(event) => updateProcess({ displayName: event.target.value })}
                style={inputStyle}
                disabled={!selectedProcess}
              />
            </label>
            <label style={fieldStyle}>
              <span>Process type</span>
              <input
                value={selectedProcess?.processTypeId ?? ''}
                onChange={(event) => updateProcess({ processTypeId: event.target.value })}
                style={inputStyle}
                disabled={!selectedProcess}
              />
            </label>
            <div style={buttonRowStyle}>
              <button type="button" style={iconButtonStyle} onClick={() => handleMoveProcess(-1)} disabled={!selectedProcess || selectedProcess.id === mainProcess?.id}>
                Move up
              </button>
              <button type="button" style={iconButtonStyle} onClick={() => handleMoveProcess(1)} disabled={!selectedProcess || selectedProcess.id === mainProcess?.id}>
                Move down
              </button>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Stage authoring</h2>
            <label style={fieldStyle}>
              <span>Selected stage</span>
              <select
                value={selectedStage?.id ?? ''}
                onChange={(event) => setSelectedStageId(event.target.value)}
                style={inputStyle}
                disabled={!selectedProcess || selectedProcess.stages.length === 0}
              >
                {(selectedProcess?.stages ?? []).map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stageOptionLabel(stage)}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Stage display name</span>
              <input
                value={selectedStage?.displayName ?? ''}
                onChange={(event) => updateStage({ displayName: event.target.value })}
                style={inputStyle}
                disabled={!selectedStage}
              />
            </label>
            <label style={fieldStyle}>
              <span>Stage category</span>
              <select
                value={selectedStage?.stageCategory ?? 'work'}
                onChange={(event) => updateStage({ stageCategory: event.target.value as DbmStageCategoryV1 })}
                style={inputStyle}
                disabled={!selectedStage}
              >
                {stageCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Stage kind</span>
              <input
                value={selectedStage?.stageKindId ?? ''}
                onChange={(event) => updateStage({ stageKindId: event.target.value })}
                style={inputStyle}
                disabled={!selectedStage}
              />
            </label>
            <div style={buttonRowStyle}>
              <button type="button" style={iconButtonStyle} onClick={() => handleMoveStage(-1)} disabled={!selectedStage}>
                Move left
              </button>
              <button type="button" style={iconButtonStyle} onClick={() => handleMoveStage(1)} disabled={!selectedStage}>
                Move right
              </button>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Stage span</h2>
            <label style={fieldStyle}>
              <span>Span start anchor</span>
              <select
                value={selectedStage?.stageSpan.start.stageId ?? ''}
                onChange={(event) => updateStageSpan('start', 'stageId', event.target.value)}
                style={inputStyle}
                disabled={!selectedStage}
              >
                {(mainProcess?.stages ?? []).map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stageOptionLabel(stage)}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Span start fraction</span>
              <input
                inputMode="decimal"
                value={spanStartFractionDraft}
                onChange={(event) => updateStageSpanFraction('start', event.target.value)}
                style={inputStyle}
                disabled={!selectedStage}
              />
            </label>
            <label style={fieldStyle}>
              <span>Span end anchor</span>
              <select
                value={selectedStage?.stageSpan.end.stageId ?? ''}
                onChange={(event) => updateStageSpan('end', 'stageId', event.target.value)}
                style={inputStyle}
                disabled={!selectedStage}
              >
                {(mainProcess?.stages ?? []).map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stageOptionLabel(stage)}
                  </option>
                ))}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Span end fraction</span>
              <input
                inputMode="decimal"
                value={spanEndFractionDraft}
                onChange={(event) => updateStageSpanFraction('end', event.target.value)}
                style={inputStyle}
                disabled={!selectedStage}
              />
            </label>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Visibility</h2>
            <label style={fieldStyle}>
              <span>Form visibility rule</span>
              <select
                value={visibilityValue(selectedProcess, 'form')}
                onChange={(event) => updateProcess({ subProcessVisibility: updateVisibilityRules(selectedProcess?.subProcessVisibility, 'form', event.target.value) })}
                style={inputStyle}
                disabled={!selectedProcess || selectedProcess.role === 'main'}
              >
                <option value="">Always visible</option>
                {processRules.flatMap((rule) => [
                  <option key={`${rule.id}:true`} value={`${rule.id}:true`}>
                    {rule.displayName} shows lane
                  </option>,
                  <option key={`${rule.id}:false`} value={`${rule.id}:false`}>
                    {rule.displayName} hides lane
                  </option>
                ])}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Portal visibility rule</span>
              <select
                value={visibilityValue(selectedProcess, 'portal')}
                onChange={(event) => updateProcess({ subProcessVisibility: updateVisibilityRules(selectedProcess?.subProcessVisibility, 'portal', event.target.value) })}
                style={inputStyle}
                disabled={!selectedProcess || selectedProcess.role === 'main'}
              >
                <option value="">Always visible</option>
                {processRules.flatMap((rule) => [
                  <option key={`${rule.id}:portal:true`} value={`${rule.id}:true`}>
                    {rule.displayName} shows lane
                  </option>,
                  <option key={`${rule.id}:portal:false`} value={`${rule.id}:false`}>
                    {rule.displayName} hides lane
                  </option>
                ])}
              </select>
            </label>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Stage hooks</h2>
            <div style={hookListStyle}>
              <div style={hookItemStyle}>
                <strong>JavaScript hook placeholder</strong>
                <span>Reserved for later DBMScript and stage-action authoring.</span>
              </div>
              <div style={hookItemStyle}>
                <strong>Notification WYSIWYG placeholder</strong>
                <span>Reserved for later notification template design.</span>
              </div>
              <div style={hookItemStyle}>
                <strong>Routing and SLA placeholders</strong>
                <span>Reserved for later routing, SLA and operational policy configuration.</span>
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Validation</h2>
            {document?.issues.length ? (
              <ul style={issueListStyle}>
                {document.issues.slice(0, 8).map((issue) => (
                  <li key={`${issue.code}:${issue.path}:${issue.message}`} style={issueItemStyle}>
                    <span style={issueCodeStyle}>{issue.level} / {issue.code}</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={sectionCopyStyle}>No designer validation issues.</p>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  padding: '24px',
  background: '#f1f5f9',
  color: '#0f172a',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: 16,
  marginBottom: 16
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: '#64748b',
  fontSize: 13,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0
};

const titleStyle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 34,
  letterSpacing: 0
};

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  justifyContent: 'flex-end'
};

const statusBarStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  padding: '10px 14px',
  marginBottom: 16,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#ffffff',
  color: '#475569',
  fontSize: 14
};

const studioGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 420px)',
  gap: 16,
  alignItems: 'start'
};

const canvasPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0
};

const sectionHeadingRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  letterSpacing: 0
};

const sectionCopyStyle: CSSProperties = {
  margin: '6px 0 0',
  color: '#64748b',
  lineHeight: 1.5,
  fontSize: 14
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center'
};

const primaryButtonStyle: CSSProperties = {
  border: '1px solid #0f766e',
  background: '#0f766e',
  color: '#ffffff',
  borderRadius: 8,
  padding: '9px 13px',
  fontWeight: 700,
  cursor: 'pointer'
};

const secondaryButtonStyle: CSSProperties = {
  border: '1px solid #2563eb',
  background: '#ffffff',
  color: '#1d4ed8',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 700,
  cursor: 'pointer'
};

const iconButtonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  color: '#334155',
  borderRadius: 8,
  padding: '7px 10px',
  fontWeight: 700,
  cursor: 'pointer'
};

const selectStyle: CSSProperties = {
  minWidth: 220,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '8px 10px',
  background: '#ffffff',
  color: '#0f172a'
};

const inspectorStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  minWidth: 0
};

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 14,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#ffffff'
};

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
  color: '#334155'
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '8px 10px',
  background: '#ffffff',
  color: '#0f172a'
};

const laneListStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 10
};

const laneButtonStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  textAlign: 'left',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: 12,
  background: '#ffffff',
  cursor: 'pointer'
};

const selectedLaneButtonStyle: CSSProperties = {
  border: '1px solid #2563eb',
  boxShadow: '0 0 0 2px rgba(37, 99, 235, 0.14)'
};

const laneRoleStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  fontWeight: 700
};

const laneLabelStyle: CSSProperties = {
  fontWeight: 800,
  overflowWrap: 'anywhere'
};

const laneMetaStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 13
};

const hookListStyle: CSSProperties = {
  display: 'grid',
  gap: 8
};

const hookItemStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  padding: 10,
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  background: '#f8fafc',
  color: '#334155',
  fontSize: 13
};

const issueListStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 0,
  margin: 0,
  listStyle: 'none'
};

const issueItemStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
  padding: 9,
  border: '1px solid #fecaca',
  borderRadius: 8,
  background: '#fef2f2',
  color: '#7f1d1d',
  fontSize: 13
};

const issueCodeStyle: CSSProperties = {
  fontWeight: 800
};
