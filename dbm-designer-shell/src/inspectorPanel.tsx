import type { CSSProperties } from 'react';
import type { DbmProcessExperienceSnapshotV1, DbmProcessV1, DbmStageV1 } from 'dbm-contract';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import { orderedProcesses } from 'dbm-designer-core';

export type InspectorSelection =
  | { kind: 'document' }
  | { kind: 'process'; process: DbmProcessV1 }
  | { kind: 'stage'; process: DbmProcessV1; stage: DbmStageV1 };

interface InspectorPanelProps {
  document: DesignerDocument | null;
  selection: InspectorSelection | null;
  onIntent(intent: DesignerGraphIntent): void;
  onPreviewStageChange(stageId: string | null): void;
  onPreviewStepChange(stepId: string | null): void;
  onPreviewModeChange(mode: 'internal' | 'portal'): void;
  snapshot: DbmProcessExperienceSnapshotV1 | null;
}

export function resolveInspectorSelection(document: DesignerDocument | null): InspectorSelection | null {
  if (!document?.selectionId) {
    return { kind: 'document' };
  }

  const processMatch = /^process:(?<processId>[^:]+)$/.exec(document.selectionId);
  if (processMatch?.groups) {
    const process = document.model.processPortfolio.processes.find((entry) => entry.id === processMatch.groups?.processId);
    return process ? { kind: 'process', process } : { kind: 'document' };
  }

  const stageMatch = /^stage:(?<processId>[^:]+):(?<stageId>[^:]+)$/.exec(document.selectionId);
  if (stageMatch?.groups) {
    const process = document.model.processPortfolio.processes.find((entry) => entry.id === stageMatch.groups?.processId);
    const stage = process?.stages.find((entry) => entry.id === stageMatch.groups?.stageId);
    return process && stage ? { kind: 'stage', process, stage } : { kind: 'document' };
  }

  return { kind: 'document' };
}

export function InspectorPanel({ document, selection, snapshot, onPreviewModeChange }: InspectorPanelProps) {
  const processes = document ? orderedProcesses(document.model) : [];

  return (
    <aside style={panelStyle}>
      <div style={eyebrowStyle}>Inspector</div>
      <h2 style={headingStyle}>Timeline Studio selection</h2>
      {selection?.kind === 'process' ? (
        <p style={copyStyle}>Selected process: {selection.process.displayName}</p>
      ) : selection?.kind === 'stage' ? (
        <p style={copyStyle}>Selected stage: {selection.stage.displayName} in {selection.process.displayName}</p>
      ) : (
        <p style={copyStyle}>Portfolio contains {processes.length} process(es).</p>
      )}
      <div style={buttonRowStyle}>
        <button type="button" style={buttonStyle} onClick={() => onPreviewModeChange('internal')}>Internal preview</button>
        <button type="button" style={buttonStyle} onClick={() => onPreviewModeChange('portal')}>Portal preview</button>
      </div>
      {snapshot ? <p style={copyStyle}>Snapshot stages: {snapshot.stages.length}</p> : null}
    </aside>
  );
}

const panelStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 14,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#ffffff'
};

const eyebrowStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 18
};

const copyStyle: CSSProperties = {
  margin: 0,
  color: '#64748b',
  lineHeight: 1.5,
  fontSize: 14
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
};

const buttonStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '7px 10px',
  background: '#f8fafc',
  cursor: 'pointer'
};
