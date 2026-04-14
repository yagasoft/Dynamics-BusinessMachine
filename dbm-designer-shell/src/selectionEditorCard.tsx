import { useEffect, useRef, useState } from 'react';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import type { InspectorSelection } from './inspectorPanel';

interface SelectionEditorCardProps {
  document: DesignerDocument | null;
  selection: InspectorSelection | null;
  focusToken: number;
  onIntent(intent: DesignerGraphIntent): void;
  onToggleStageCollapse(stageId: string): void;
  isStageCollapsed(stageId: string): boolean;
}

const stageTypeOptions = ['start', 'task', 'approval', 'system', 'end'] as const;
const stepTypeOptions = ['data-entry', 'review', 'approval', 'system'] as const;

export function SelectionEditorCard({
  document,
  selection,
  focusToken,
  onIntent,
  onToggleStageCollapse,
  isStageCollapsed
}: SelectionEditorCardProps) {
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [draftLabel, setDraftLabel] = useState('');

  useEffect(() => {
    if (selection?.kind === 'stage') {
      setDraftLabel(selection.stage.displayName);
      return;
    }

    if (selection?.kind === 'step') {
      setDraftLabel(selection.step.displayName);
      return;
    }

    if (selection?.kind === 'outcome') {
      setDraftLabel(selection.outcome.displayName);
      return;
    }

    setDraftLabel('');
  }, [selection]);

  useEffect(() => {
    if (!renameInputRef.current) {
      return;
    }

    renameInputRef.current.focus();
    renameInputRef.current.select();
  }, [focusToken, selection?.kind, selection && 'stage' in selection ? selection.stage?.id : null, selection && 'step' in selection ? selection.step?.id : null]);

  if (!document || !selection || selection.kind === 'document') {
    return null;
  }

  if (selection.kind === 'stage') {
    const collapsed = isStageCollapsed(selection.stage.id);

    return (
      <div style={cardStyle}>
        <div style={sectionLabelStyle}>Stage</div>
        <div style={titleStyle}>{selection.stage.displayName}</div>
        <form
          style={formGridStyle}
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = draftLabel.trim();
            if (!trimmed) {
              return;
            }

            onIntent({
              kind: 'update-stage',
              stageId: selection.stage.id,
              value: {
                displayName: trimmed
              }
            });
          }}
        >
          <label style={fieldStyle}>
            <span>Name</span>
            <input
              ref={renameInputRef}
              aria-label="Stage name"
              style={inputStyle}
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
            />
          </label>

          <label style={fieldStyle}>
            <span>Type</span>
            <select
              aria-label="Stage type"
              style={inputStyle}
              value={selection.stage.stageType}
              onChange={(event) =>
                onIntent({
                  kind: 'update-stage',
                  stageId: selection.stage.id,
                  value: {
                    stageType: event.target.value as typeof stageTypeOptions[number]
                  }
                })
              }
            >
              {stageTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Actor</span>
            <select
              aria-label="Stage actor"
              style={inputStyle}
              value={selection.stage.actorId}
              onChange={(event) =>
                onIntent({
                  kind: 'update-stage',
                  stageId: selection.stage.id,
                  value: {
                    actorId: event.target.value
                  }
                })
              }
            >
              {document.model.process.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.displayName}
                </option>
              ))}
            </select>
          </label>

          <div style={buttonRowStyle}>
            <button type="submit" style={primaryButtonStyle}>
              Apply
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={() => onToggleStageCollapse(selection.stage.id)}>
              {collapsed ? 'Expand Stage' : 'Collapse Stage'}
            </button>
          </div>

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
              disabled={selection.stageIndex >= document.model.process.stages.length - 1}
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
              style={secondaryButtonStyle}
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
        </form>
      </div>
    );
  }

  if (selection.kind === 'step') {
    const stageForm = selection.stage.formId
      ? document.model.forms.find((form) => form.id === selection.stage.formId)
      : null;
    const internalStatuses = document.model.process.statuses.filter((status) => status.audience !== 'portal');
    const portalStatuses = document.model.process.statuses.filter((status) => status.audience !== 'internal');

    return (
      <div style={cardStyle}>
        <div style={sectionLabelStyle}>Step</div>
        <div style={titleStyle}>{selection.step.displayName}</div>
        <form
          style={formGridStyle}
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = draftLabel.trim();
            if (!trimmed) {
              return;
            }

            onIntent({
              kind: 'update-step',
              stepId: selection.step.id,
              value: {
                displayName: trimmed
              }
            });
          }}
        >
          <label style={fieldStyle}>
            <span>Name</span>
            <input
              ref={renameInputRef}
              aria-label="Step name"
              style={inputStyle}
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
            />
          </label>

          <label style={fieldStyle}>
            <span>Type</span>
            <select
              aria-label="Step type"
              style={inputStyle}
              value={selection.step.stepType}
              onChange={(event) =>
                onIntent({
                  kind: 'update-step',
                  stepId: selection.step.id,
                  value: {
                    stepType: event.target.value as typeof stepTypeOptions[number]
                  }
                })
              }
            >
              {stepTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Owner</span>
            <select
              aria-label="Step owner"
              style={inputStyle}
              value={selection.step.ownerActorId}
              onChange={(event) =>
                onIntent({
                  kind: 'update-step',
                  stepId: selection.step.id,
                  value: {
                    ownerActorId: event.target.value
                  }
                })
              }
            >
              {document.model.process.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.displayName}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Stage</span>
            <select
              aria-label="Step stage"
              style={inputStyle}
              value={selection.stage.id}
              onChange={(event) =>
                onIntent({
                  kind: 'move-step',
                  stepId: selection.step.id,
                  targetStageId: event.target.value,
                  targetIndex: document.model.process.stages.find((stage) => stage.id === event.target.value)?.stepIds.length ?? 0
                })
              }
            >
              {document.model.process.stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.displayName}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Internal Status</span>
            <select
              aria-label="Internal status"
              style={inputStyle}
              value={selection.step.internalStatusId}
              onChange={(event) =>
                onIntent({
                  kind: 'update-step',
                  stepId: selection.step.id,
                  value: {
                    internalStatusId: event.target.value
                  }
                })
              }
            >
              {internalStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.displayName}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Portal Status</span>
            <select
              aria-label="Portal status"
              style={inputStyle}
              value={selection.step.portalStatusId ?? ''}
              onChange={(event) =>
                onIntent({
                  kind: 'update-step',
                  stepId: selection.step.id,
                  value: {
                    portalStatusId: event.target.value || null
                  }
                })
              }
            >
              <option value="">None</option>
              {portalStatuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.displayName}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Form State</span>
            <select
              aria-label="Form state"
              style={inputStyle}
              value={selection.step.formStateId ?? ''}
              onChange={(event) =>
                onIntent({
                  kind: 'update-step',
                  stepId: selection.step.id,
                  value: {
                    formStateId: event.target.value || null
                  }
                })
              }
            >
              <option value="">None</option>
              {(stageForm?.formStates ?? []).map((state) => (
                <option key={state.id} value={state.id}>
                  {state.displayName}
                </option>
              ))}
            </select>
          </label>

          <div style={buttonRowStyle}>
            <button type="submit" style={primaryButtonStyle}>
              Apply
            </button>
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
              Move Left
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
              Move Right
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
        </form>
      </div>
    );
  }

  if (selection.kind === 'outcome') {
    return (
      <div style={cardStyle}>
        <div style={sectionLabelStyle}>Outcome</div>
        <form
          style={formGridStyle}
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = draftLabel.trim();
            if (!trimmed) {
              return;
            }

            onIntent({
              kind: 'rename-node',
              nodeId: `outcome:${selection.outcome.id}`,
              label: trimmed
            });
          }}
        >
          <label style={fieldStyle}>
            <span>Name</span>
            <input
              ref={renameInputRef}
              aria-label="Outcome name"
              style={inputStyle}
              value={draftLabel}
              onChange={(event) => setDraftLabel(event.target.value)}
            />
          </label>
          <button type="submit" style={primaryButtonStyle}>
            Apply
          </button>
        </form>
      </div>
    );
  }

  if (selection.kind === 'transition') {
    return (
      <div style={cardStyle}>
        <div style={sectionLabelStyle}>Stage Connection</div>
        <div style={metaStyle}>
          {selection.transition.fromStageId}
          {' -> '}
          {selection.transition.toStageId}
        </div>
        <div style={metaStyle}>Outcome: {selection.transition.outcomeId}</div>
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
          Delete Connection
        </button>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={sectionLabelStyle}>Step Connection</div>
      <div style={metaStyle}>From: {selection.transition.fromStepId}</div>
      <div style={metaStyle}>
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
        Delete Connection
      </button>
    </div>
  );
}

const cardStyle = {
  width: '340px',
  maxWidth: 'calc(100vw - 4rem)',
  display: 'grid',
  gap: '0.8rem',
  padding: '1rem',
  borderRadius: '1rem',
  background: 'rgba(255,255,255,0.94)',
  border: '1px solid rgba(214, 211, 209, 0.96)',
  boxShadow: '0 24px 54px rgba(15, 23, 42, 0.16)',
  backdropFilter: 'blur(14px)',
  pointerEvents: 'auto'
} as const;

const sectionLabelStyle = {
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#64748b'
} as const;

const titleStyle = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: '#0f172a'
} as const;

const formGridStyle = {
  display: 'grid',
  gap: '0.75rem'
} as const;

const fieldStyle = {
  display: 'grid',
  gap: '0.3rem',
  fontSize: '0.86rem',
  color: '#334155'
} as const;

const inputStyle = {
  padding: '0.66rem 0.78rem',
  borderRadius: '0.82rem',
  border: '1px solid #d6d3d1',
  background: '#fff'
} as const;

const buttonRowStyle = {
  display: 'flex',
  gap: '0.6rem',
  flexWrap: 'wrap'
} as const;

const primaryButtonStyle = {
  padding: '0.7rem 0.95rem',
  borderRadius: '0.9rem',
  border: '1px solid #8b5e34',
  background: '#b45309',
  color: '#fff',
  cursor: 'pointer'
} as const;

const secondaryButtonStyle = {
  padding: '0.7rem 0.95rem',
  borderRadius: '0.9rem',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer'
} as const;

const dangerButtonStyle = {
  padding: '0.7rem 0.95rem',
  borderRadius: '0.9rem',
  border: '1px solid #ef4444',
  background: '#fff1f2',
  color: '#9f1239',
  cursor: 'pointer'
} as const;

const metaStyle = {
  fontSize: '0.9rem',
  color: '#475569'
} as const;
