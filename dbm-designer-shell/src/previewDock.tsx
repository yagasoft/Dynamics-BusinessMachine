import type { DesignerDocument } from 'dbm-designer-core';
import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import { ProcessPreview } from './processPreview';

interface PreviewDockProps {
  document: DesignerDocument | null;
  snapshot: DbmProcessExperienceSnapshotV1 | null;
  onPreviewStageChange(stageId: string | null): void;
  onPreviewStepChange(stepId: string | null): void;
  onPreviewModeChange(mode: 'internal' | 'portal'): void;
}

export function PreviewDock({
  document,
  snapshot,
  onPreviewModeChange,
  onPreviewStageChange,
  onPreviewStepChange
}: PreviewDockProps) {
  const workspace = document?.workspace;

  return (
    <div data-testid="preview-dock-panel" style={dockStyle}>
      <div style={eyebrowStyle}>Live Preview</div>
      {workspace && document ? (
        <div style={controlsStyle}>
          <label style={fieldStyle}>
            <span>Audience</span>
            <select
              style={inputStyle}
              value={workspace.preview.mode}
              onChange={(event) => onPreviewModeChange(event.target.value as 'internal' | 'portal')}
            >
              <option value="internal">internal</option>
              <option value="portal">portal</option>
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Stage</span>
            <select
              style={inputStyle}
              value={workspace.preview.stageId ?? ''}
              onChange={(event) => onPreviewStageChange(event.target.value || null)}
            >
              {document.model.process.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.displayName}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Step</span>
            <select
              style={inputStyle}
              value={workspace.preview.stepId ?? ''}
              onChange={(event) => onPreviewStepChange(event.target.value || null)}
            >
              {document.model.process.steps
                .filter((step) => step.stageId === workspace.preview.stageId)
                .map((step) => (
                  <option key={step.id} value={step.id}>
                    {step.displayName}
                  </option>
                ))}
            </select>
          </label>
        </div>
      ) : null}

      <div style={previewShellStyle}>
        <ProcessPreview snapshot={snapshot} />
      </div>
    </div>
  );
}

const dockStyle = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  display: 'grid',
  gap: '0.8rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(214, 211, 209, 0.96)',
  boxShadow: '0 24px 54px rgba(15, 23, 42, 0.16)',
  backdropFilter: 'blur(14px)',
  pointerEvents: 'auto',
  overflow: 'hidden'
} as const;

const eyebrowStyle = {
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#64748b'
} as const;

const controlsStyle = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  minWidth: 0
} as const;

const fieldStyle = {
  display: 'grid',
  gap: '0.3rem',
  fontSize: '0.84rem',
  color: '#334155',
  minWidth: 0
} as const;

const inputStyle = {
  padding: '0.64rem 0.76rem',
  borderRadius: '0.82rem',
  border: '1px solid #d6d3d1',
  background: '#fff'
} as const;

const previewShellStyle = {
  maxHeight: '360px',
  overflow: 'auto',
  paddingRight: '0.25rem',
  minWidth: 0
} as const;
