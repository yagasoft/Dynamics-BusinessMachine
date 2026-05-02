import type { CSSProperties } from 'react';
import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import type { DesignerDocument } from 'dbm-designer-core';
import { resolveMainProcess } from 'dbm-designer-core';

interface PreviewDockProps {
  document: DesignerDocument | null;
  snapshot?: DbmProcessExperienceSnapshotV1 | null;
  onPreviewStageChange?(stageId: string | null): void;
  onPreviewStepChange?(stepId: string | null): void;
  onPreviewModeChange?(mode: 'internal' | 'portal'): void;
}

function safeMainProcess(document: DesignerDocument | null) {
  if (!document) {
    return null;
  }

  try {
    return resolveMainProcess(document);
  } catch {
    return document.model.processPortfolio.processes[0] ?? null;
  }
}

export function PreviewDock({
  document,
  snapshot,
  onPreviewStageChange,
  onPreviewStepChange,
  onPreviewModeChange
}: PreviewDockProps) {
  const mainProcess = safeMainProcess(document);

  if (!document || !mainProcess) {
    return null;
  }

  return (
    <section style={panelStyle}>
      <div style={eyebrowStyle}>Preview placeholder</div>
      <h2 style={headingStyle}>Portfolio preview</h2>
      <p style={copyStyle}>
        R1.3 keeps full rendered form runtime out of scope. This dock reflects the selected process portfolio without invoking portal, routing or action execution.
      </p>
      <div style={chipRowStyle}>
        <button type="button" style={chipStyle} onClick={() => onPreviewModeChange?.('internal')}>Internal</button>
        <button type="button" style={chipStyle} onClick={() => onPreviewModeChange?.('portal')}>Portal</button>
      </div>
      <div style={stageListStyle}>
        {mainProcess.stages.map((stage) => (
          <button
            key={stage.id}
            type="button"
            style={stageButtonStyle}
            onClick={() => {
              onPreviewStageChange?.(stage.id);
              onPreviewStepChange?.(stage.defaultStepId);
            }}
          >
            {stage.displayName}
          </button>
        ))}
      </div>
      {snapshot ? <p style={copyStyle}>Snapshot stages: {snapshot.stages.length}</p> : null}
    </section>
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

const chipRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8
};

const chipStyle: CSSProperties = {
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  padding: '7px 10px',
  background: '#f8fafc',
  cursor: 'pointer'
};

const stageListStyle: CSSProperties = {
  display: 'grid',
  gap: 8
};

const stageButtonStyle: CSSProperties = {
  border: '1px solid #dbeafe',
  borderRadius: 8,
  padding: 9,
  background: '#eff6ff',
  color: '#1d4ed8',
  textAlign: 'left',
  cursor: 'pointer'
};
