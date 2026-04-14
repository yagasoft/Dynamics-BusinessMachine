import { useEffect, useState, type ComponentProps } from 'react';
import type {
  DbmOutcomeV1,
  DbmStageV1,
  DbmStepTransitionV1,
  DbmStepV1,
  DbmTransitionV1
} from 'dbm-contract';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import { ProcessPreview } from './processPreview';

type InspectorSelection =
  | {
      kind: 'document';
    }
  | {
      kind: 'stage';
      stage: DbmStageV1;
      stageIndex: number;
    }
  | {
      kind: 'step';
      step: DbmStepV1;
      stage: DbmStageV1;
      stepIndex: number;
    }
  | {
      kind: 'outcome';
      outcome: DbmOutcomeV1;
    }
  | {
      kind: 'transition';
      transition: DbmTransitionV1;
    }
  | {
      kind: 'step-transition';
      transition: DbmStepTransitionV1;
    };

interface InspectorPanelProps {
  document: DesignerDocument | null;
  selection: InspectorSelection | null;
  onIntent(intent: DesignerGraphIntent): void;
  onPreviewStageChange(stageId: string | null): void;
  onPreviewStepChange(stepId: string | null): void;
  onPreviewModeChange(mode: 'internal' | 'portal'): void;
  snapshot: ComponentProps<typeof ProcessPreview>['snapshot'];
}

function RenameCard({
  nodeId,
  label,
  caption,
  onRename
}: {
  nodeId: string;
  label: string;
  caption: string;
  onRename(intent: DesignerGraphIntent): void;
}) {
  const [draft, setDraft] = useState(label);

  useEffect(() => {
    setDraft(label);
  }, [label, nodeId]);

  return (
    <form
      style={cardStyle}
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed) {
          return;
        }

        onRename({
          kind: 'rename-node',
          nodeId,
          label: trimmed
        });
      }}
    >
      <div style={eyebrowStyle}>{caption}</div>
      <label style={fieldStyle}>
        <span>Display Name</span>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} style={inputStyle} />
      </label>
      <button type="submit" style={primaryButtonStyle}>
        Update Label
      </button>
    </form>
  );
}

export function resolveInspectorSelection(document: DesignerDocument | null): InspectorSelection | null {
  if (!document || !document.selectionId || document.selectionId === 'document:root') {
    return {
      kind: 'document'
    };
  }

  const selectionId = document.selectionId;
  if (selectionId.startsWith('stage:')) {
    const stageId = selectionId.slice('stage:'.length);
    const stageIndex = document.model.process.stages.findIndex((stage) => stage.id === stageId);
    const stage = document.model.process.stages[stageIndex];
    return stage ? { kind: 'stage', stage, stageIndex } : { kind: 'document' };
  }

  if (selectionId.startsWith('step:')) {
    const stepId = selectionId.slice('step:'.length);
    const step = document.model.process.steps.find((entry) => entry.id === stepId);
    const stage = step ? document.model.process.stages.find((entry) => entry.id === step.stageId) : null;
    const stepIndex = step && stage ? stage.stepIds.findIndex((candidate) => candidate === step.id) : -1;
    return step && stage ? { kind: 'step', step, stage, stepIndex } : { kind: 'document' };
  }

  if (selectionId.startsWith('outcome:')) {
    const outcomeId = selectionId.slice('outcome:'.length);
    const outcome = document.model.process.outcomes.find((entry) => entry.id === outcomeId);
    return outcome ? { kind: 'outcome', outcome } : { kind: 'document' };
  }

  if (selectionId.startsWith('transition:')) {
    const transitionId = selectionId.slice('transition:'.length);
    const transition = document.model.process.transitions.find((entry) => entry.id === transitionId);
    return transition ? { kind: 'transition', transition } : { kind: 'document' };
  }

  if (selectionId.startsWith('step-transition:')) {
    const transitionId = selectionId.slice('step-transition:'.length);
    const transition = document.model.process.stepTransitions.find((entry) => entry.id === transitionId);
    return transition ? { kind: 'step-transition', transition } : { kind: 'document' };
  }

  return {
    kind: 'document'
  };
}

export function InspectorPanel({
  document,
  selection,
  onIntent,
  onPreviewStageChange,
  onPreviewStepChange,
  onPreviewModeChange,
  snapshot
}: InspectorPanelProps) {
  const previewWorkspace = document?.workspace ?? null;

  return (
    <div style={panelShellStyle}>
      <div style={columnSectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Inspector</div>
            <h2 style={headingStyle}>Selection Details</h2>
          </div>
        </div>

        {selection?.kind === 'stage' ? (
          <>
            <RenameCard
              nodeId={`stage:${selection.stage.id}`}
              label={selection.stage.displayName}
              caption="Stage"
              onRename={onIntent}
            />
            <div style={cardStyle}>
              <div style={eyebrowStyle}>Stage Actions</div>
              <div style={mutedMetaStyle}>Actor: {selection.stage.actorId || 'none'}</div>
              <div style={mutedMetaStyle}>Form: {selection.stage.formId ?? 'none'}</div>
              <div style={buttonRowStyle}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  disabled={selection.stageIndex <= 0}
                  onClick={() =>
                    onIntent({
                      kind: 'move-stage',
                      stageId: selection.stage.id,
                      targetIndex: selection.stageIndex - 1
                    })
                  }
                >
                  Move Left
                </button>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  disabled={selection.stageIndex >= (document?.model.process.stages.length ?? 1) - 1}
                  onClick={() =>
                    onIntent({
                      kind: 'move-stage',
                      stageId: selection.stage.id,
                      targetIndex: selection.stageIndex + 1
                    })
                  }
                >
                  Move Right
                </button>
              </div>
              <div style={buttonRowStyle}>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() =>
                    onIntent({
                      kind: 'add-step',
                      stageId: selection.stage.id
                    })
                  }
                >
                  Add Step
                </button>
                <button
                  type="button"
                  style={dangerButtonStyle}
                  onClick={() =>
                    onIntent({
                      kind: 'remove-node',
                      nodeId: `stage:${selection.stage.id}`
                    })
                  }
                >
                  Delete Stage
                </button>
              </div>
            </div>
          </>
        ) : null}

        {selection?.kind === 'step' ? (
          <>
            <RenameCard
              nodeId={`step:${selection.step.id}`}
              label={selection.step.displayName}
              caption="Step"
              onRename={onIntent}
            />
            <div style={cardStyle}>
              <div style={eyebrowStyle}>Step Actions</div>
              <div style={fieldStyle}>
                <span>Stage</span>
                <select
                  style={inputStyle}
                  value={selection.stage.id}
                  onChange={(event) =>
                    onIntent({
                      kind: 'move-step',
                      stepId: selection.step.id,
                      targetStageId: event.target.value,
                      targetIndex: document?.model.process.stages.find((stage) => stage.id === event.target.value)?.stepIds.length ?? 0
                    })
                  }
                >
                  {document?.model.process.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div style={buttonRowStyle}>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  disabled={selection.stepIndex <= 0}
                  onClick={() =>
                    onIntent({
                      kind: 'move-step',
                      stepId: selection.step.id,
                      targetStageId: selection.stage.id,
                      targetIndex: selection.stepIndex - 1
                    })
                  }
                >
                  Move Up
                </button>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  disabled={selection.stepIndex >= selection.stage.stepIds.length - 1}
                  onClick={() =>
                    onIntent({
                      kind: 'move-step',
                      stepId: selection.step.id,
                      targetStageId: selection.stage.id,
                      targetIndex: selection.stepIndex + 1
                    })
                  }
                >
                  Move Down
                </button>
              </div>
              <button
                type="button"
                style={dangerButtonStyle}
                onClick={() =>
                  onIntent({
                    kind: 'remove-node',
                    nodeId: `step:${selection.step.id}`
                  })
                }
              >
                Delete Step
              </button>
            </div>
          </>
        ) : null}

        {selection?.kind === 'outcome' ? (
          <>
            <RenameCard
              nodeId={`outcome:${selection.outcome.id}`}
              label={selection.outcome.displayName}
              caption="Outcome"
              onRename={onIntent}
            />
          </>
        ) : null}

        {selection?.kind === 'transition' ? (
          <div style={cardStyle}>
            <div style={eyebrowStyle}>Stage Transition</div>
            <div style={mutedMetaStyle}>
              {selection.transition.fromStageId}
              {' -> '}
              {selection.transition.toStageId}
            </div>
            <div style={mutedMetaStyle}>Outcome: {selection.transition.outcomeId}</div>
            <button
              type="button"
              style={dangerButtonStyle}
              onClick={() =>
                onIntent({
                  kind: 'remove-edge',
                  edgeId: `transition:${selection.transition.id}`
                })
              }
            >
              Delete Edge
            </button>
          </div>
        ) : null}

        {selection?.kind === 'step-transition' ? (
          <div style={cardStyle}>
            <div style={eyebrowStyle}>Step Transition</div>
            <div style={mutedMetaStyle}>From: {selection.transition.fromStepId}</div>
            <div style={mutedMetaStyle}>
              Target:{' '}
              {'stepId' in selection.transition.target
                ? selection.transition.target.stepId
                : 'stageId' in selection.transition.target
                  ? selection.transition.target.stageId
                  : selection.transition.target.outcomeId}
            </div>
            <button
              type="button"
              style={dangerButtonStyle}
              onClick={() =>
                onIntent({
                  kind: 'remove-edge',
                  edgeId: `step-transition:${selection.transition.id}`
                })
              }
            >
              Delete Edge
            </button>
          </div>
        ) : null}

        {selection?.kind === 'document' || !selection ? (
          <div style={cardStyle}>
            <div style={eyebrowStyle}>Document</div>
            <div style={mutedMetaStyle}>Select a stage, step, outcome, or edge to inspect and edit it.</div>
          </div>
        ) : null}
      </div>

      <div style={columnSectionStyle}>
        <div style={sectionHeaderStyle}>
          <div>
            <div style={eyebrowStyle}>Live Preview</div>
            <h2 style={headingStyle}>Process Experience</h2>
          </div>
        </div>

        <div style={cardStyle}>
          {previewWorkspace && document ? (
            <div style={previewControlsGridStyle}>
              <label style={fieldStyle}>
                <span>Audience</span>
                <select
                  style={inputStyle}
                  value={previewWorkspace.preview.mode}
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
                  value={previewWorkspace.preview.stageId ?? ''}
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
                  value={previewWorkspace.preview.stepId ?? ''}
                  onChange={(event) => onPreviewStepChange(event.target.value || null)}
                >
                  {document.model.process.steps
                    .filter((step) => step.stageId === previewWorkspace.preview.stageId)
                    .map((step) => (
                      <option key={step.id} value={step.id}>
                        {step.displayName}
                      </option>
                    ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>

        <div style={previewCardStyle}>
          <ProcessPreview snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}

const panelShellStyle = {
  display: 'grid',
  gap: '1rem',
  alignContent: 'start'
} as const;

const columnSectionStyle = {
  display: 'grid',
  gap: '0.9rem'
} as const;

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  alignItems: 'flex-start'
} as const;

const eyebrowStyle = {
  fontSize: '0.74rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#64748b'
} as const;

const headingStyle = {
  margin: '0.35rem 0 0',
  fontSize: '1.3rem'
} as const;

const cardStyle = {
  display: 'grid',
  gap: '0.8rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: 'rgba(255,255,255,0.9)',
  border: '1px solid #d6d3d1'
} as const;

const previewCardStyle = {
  padding: '1rem',
  borderRadius: '1rem',
  background: 'rgba(255,255,255,0.9)',
  border: '1px solid #d6d3d1'
} as const;

const fieldStyle = {
  display: 'grid',
  gap: '0.35rem',
  fontSize: '0.9rem'
} as const;

const inputStyle = {
  padding: '0.68rem 0.78rem',
  borderRadius: '0.85rem',
  border: '1px solid #d6d3d1',
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
  cursor: 'pointer'
} as const;

const dangerButtonStyle = {
  padding: '0.72rem 1rem',
  borderRadius: '0.9rem',
  border: '1px solid #ef4444',
  background: '#fff1f2',
  color: '#9f1239',
  cursor: 'pointer'
} as const;

const mutedMetaStyle = {
  fontSize: '0.88rem',
  color: '#475569'
} as const;

const previewControlsGridStyle = {
  display: 'grid',
  gap: '0.85rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))'
} as const;
