import { useEffect, useRef, useState } from 'react';
import type { DbmFormStateV1, DbmFormV1 } from 'dbm-contract';
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
const stagePortalVisibilityOptions = ['visible', 'hidden'] as const;
const handoffStrategyOptions = ['select-existing-related', 'create-related'] as const;

function summarizeRuleLabels(document: DesignerDocument, ruleIds: string[]): string {
  if (ruleIds.length === 0) {
    return 'None';
  }

  return ruleIds
    .map((ruleId) => document.model.rules.find((rule) => rule.id === ruleId)?.displayName ?? ruleId)
    .join(', ');
}

function summarizeBindingLabels(form: DbmFormV1, bindingIds: string[]): string {
  if (bindingIds.length === 0) {
    return 'None';
  }

  return bindingIds
    .map((bindingId) => form.entityBindings.find((binding) => binding.id === bindingId)?.displayName ?? bindingId)
    .join(', ');
}

function resolveFormStateIssues(document: DesignerDocument, stepId: string, formId: string | null, formStateId: string | null): string[] {
  const issueMessages = new Set<string>();
  const stepNodeId = `step:${stepId}`;
  const formStateNodeId = formId && formStateId ? `form-state:${formId}:${formStateId}` : null;

  document.issues
    .filter((issue) =>
      issue.code.includes('form-state')
      && (issue.nodeId === stepNodeId || (formStateNodeId ? issue.nodeId === formStateNodeId : false))
    )
    .forEach((issue) => issueMessages.add(issue.message));

  return [...issueMessages];
}

function resolveStageForm(document: DesignerDocument, stageId: string): DbmFormV1 | null {
  const stage = document.model.process.stages.find((entry) => entry.id === stageId);
  return stage?.formId ? document.model.forms.find((form) => form.id === stage.formId) ?? null : null;
}

function resolveStagePrimaryEntityId(document: DesignerDocument, stageId: string): string | null {
  const form = resolveStageForm(document, stageId);
  const binding = form?.entityBindings.find((entry) => entry.id === form.primaryEntityBindingId);
  return binding?.entityId ?? null;
}

function resolveRelationshipOptions(document: DesignerDocument, sourceStageId: string, targetStageId: string) {
  const sourceEntityId = resolveStagePrimaryEntityId(document, sourceStageId);
  const targetEntityId = resolveStagePrimaryEntityId(document, targetStageId);
  if (!sourceEntityId || !targetEntityId || sourceEntityId === targetEntityId) {
    return [];
  }

  return document.model.metadata.relationships.filter((relationship) => {
    const pair = new Set([relationship.fromEntityId, relationship.toEntityId]);
    return pair.has(sourceEntityId) && pair.has(targetEntityId);
  });
}

function HandoffEditor({
  document,
  sourceStageId,
  targetStageId,
  handoff,
  onChange
}: {
  document: DesignerDocument;
  sourceStageId: string;
  targetStageId: string;
  handoff: { strategy: 'reuse-current-primary' | 'select-existing-related' | 'create-related'; relationshipId: string | null } | null | undefined;
  onChange(subjectHandoff: { strategy: 'reuse-current-primary' | 'select-existing-related' | 'create-related'; relationshipId: string | null } | null): void;
}) {
  const sourceEntityId = resolveStagePrimaryEntityId(document, sourceStageId);
  const targetEntityId = resolveStagePrimaryEntityId(document, targetStageId);
  const relationshipOptions = resolveRelationshipOptions(document, sourceStageId, targetStageId);
  const sourceEntity = sourceEntityId ? document.model.metadata.entities.find((entity) => entity.id === sourceEntityId) : null;
  const targetEntity = targetEntityId ? document.model.metadata.entities.find((entity) => entity.id === targetEntityId) : null;

  if (!sourceEntityId || !targetEntityId) {
    return (
      <div style={inspectionPanelStyle}>
        <div style={inspectionHeadingStyle}>Cross-Form Handoff</div>
        <div style={metaStyle}>Import and bind both source and target forms before configuring handoff behavior.</div>
      </div>
    );
  }

  if (sourceEntityId === targetEntityId) {
    return (
      <div style={inspectionPanelStyle}>
        <div style={inspectionHeadingStyle}>Cross-Form Handoff</div>
        <div style={metaStyle}>Same primary entity: no handoff is required for this connection.</div>
      </div>
    );
  }

  return (
    <div style={inspectionPanelStyle}>
      <div style={inspectionHeadingStyle}>Cross-Form Handoff</div>
      <div style={metaStyle}>
        {sourceEntity?.displayName ?? sourceEntityId}
        {' -> '}
        {targetEntity?.displayName ?? targetEntityId}
      </div>
      <label style={fieldStyle}>
        <span>Strategy</span>
        <select
          style={inputStyle}
          value={handoff?.strategy ?? ''}
          onChange={(event) =>
            onChange(
              event.target.value
                ? {
                    strategy: event.target.value as typeof handoffStrategyOptions[number],
                    relationshipId: handoff?.relationshipId ?? relationshipOptions[0]?.id ?? null
                  }
                : null
            )
          }
        >
          <option value="">Select strategy</option>
          {handoffStrategyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label style={fieldStyle}>
        <span>Relationship</span>
        <select
          style={inputStyle}
          value={handoff?.relationshipId ?? ''}
          onChange={(event) =>
            onChange(
              handoff?.strategy
                ? {
                    strategy: handoff.strategy,
                    relationshipId: event.target.value || null
                  }
                : null
            )
          }
        >
          <option value="">Select relationship</option>
          {relationshipOptions.map((relationship) => (
            <option key={relationship.id} value={relationship.id}>
              {relationship.providerBindings.dataverse?.logicalName ?? relationship.id}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function FormStateInspectionSummary({
  document,
  stepId,
  form,
  formState
}: {
  document: DesignerDocument;
  stepId: string;
  form: DbmFormV1 | null;
  formState: DbmFormStateV1 | null;
}) {
  const formStateIssues = resolveFormStateIssues(document, stepId, form?.id ?? null, formState?.id ?? null);

  if (!formState || !form) {
    return (
      <div style={inspectionPanelStyle}>
        <div style={inspectionHeadingStyle}>Form-State Effects</div>
        <div style={metaStyle}>No form state is currently assigned to this step.</div>
        {formStateIssues.length > 0
          ? formStateIssues.map((message) => (
            <div key={message} style={issueBannerStyle}>
              {message}
            </div>
          ))
          : null}
      </div>
    );
  }

  return (
    <div style={inspectionPanelStyle}>
      <div style={inspectionHeadingStyle}>Form-State Effects</div>
      <div style={summaryGridStyle}>
        <div>
          <div style={summaryLabelStyle}>Form</div>
          <div style={metaStyle}>{form.displayName}</div>
        </div>
        <div>
          <div style={summaryLabelStyle}>State</div>
          <div style={metaStyle}>{formState.displayName}</div>
        </div>
      </div>
      <div style={summaryGridStyle}>
        <div>
          <div style={summaryLabelStyle}>Activation Rules</div>
          <div style={metaStyle}>{summarizeRuleLabels(document, formState.activationRuleIds)}</div>
        </div>
        <div>
          <div style={summaryLabelStyle}>Visible Bindings</div>
          <div style={metaStyle}>{summarizeBindingLabels(form, formState.visibleEntityBindingIds)}</div>
        </div>
      </div>
      {formStateIssues.length > 0
        ? formStateIssues.map((message) => (
          <div key={message} style={issueBannerStyle}>
            {message}
          </div>
        ))
        : null}
      {formState.elementBehaviors.length > 0 ? (
        <div style={behaviorListStyle}>
          {formState.elementBehaviors.map((behavior) => {
            const element = form.elements.find((entry) => entry.id === behavior.elementId);
            return (
              <div key={behavior.elementId} style={behaviorCardStyle}>
                <div style={behaviorHeaderStyle}>
                  <div>
                    <div style={summaryLabelStyle}>Element</div>
                    <div style={titleStyle}>{element?.displayName ?? behavior.elementId}</div>
                  </div>
                  <div style={behaviorBadgeRowStyle}>
                    <span style={summaryChipStyle}>Visible {behavior.visibleRuleIds.length}</span>
                    <span style={summaryChipStyle}>Required {behavior.requiredRuleIds.length}</span>
                    <span style={summaryChipStyle}>Editable {behavior.editableRuleIds.length}</span>
                  </div>
                </div>
                {behavior.label ? <div style={metaStyle}>Label: {behavior.label}</div> : null}
                {behavior.hint ? <div style={metaStyle}>Hint: {behavior.hint}</div> : null}
                <div style={metaStyle}>Visible Rules: {summarizeRuleLabels(document, behavior.visibleRuleIds)}</div>
                <div style={metaStyle}>Required Rules: {summarizeRuleLabels(document, behavior.requiredRuleIds)}</div>
                <div style={metaStyle}>Editable Rules: {summarizeRuleLabels(document, behavior.editableRuleIds)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={metaStyle}>This form state does not override any element behaviors.</div>
      )}
    </div>
  );
}

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
    const selectedOutcomeIds = new Set(selection.stage.allowedOutcomeIds);
    const availableForms = document.model.forms;
    const currentForm = selection.stage.formId
      ? document.model.forms.find((form) => form.id === selection.stage.formId) ?? null
      : null;
    const currentPrimaryBinding = currentForm?.entityBindings.find((binding) => binding.id === currentForm.primaryEntityBindingId) ?? null;
    const currentPrimaryEntity = currentPrimaryBinding
      ? document.model.metadata.entities.find((entity) => entity.id === currentPrimaryBinding.entityId) ?? null
      : null;

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

          <label style={fieldStyle}>
            <span>Bound Form</span>
            <select
              aria-label="Stage form"
              style={inputStyle}
              value={selection.stage.formId ?? ''}
              onChange={(event) => {
                const nextFormId = event.target.value || null;
                if (!nextFormId) {
                  onIntent({
                    kind: 'update-stage',
                    stageId: selection.stage.id,
                    value: {
                      formId: null
                    }
                  });
                  return;
                }
                onIntent({
                  kind: 'rebind-stage-form',
                  stageId: selection.stage.id,
                  formId: nextFormId
                });
              }}
            >
              <option value="">None</option>
              {availableForms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.displayName}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldStyle}>
            <span>Portal Visibility</span>
            <select
              aria-label="Stage portal visibility"
              style={inputStyle}
              value={selection.stage.portalVisibility}
              onChange={(event) =>
                onIntent({
                  kind: 'update-stage',
                  stageId: selection.stage.id,
                  value: {
                    portalVisibility: event.target.value as typeof stagePortalVisibilityOptions[number]
                  }
                })
              }
            >
              {stagePortalVisibilityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div style={inspectionPanelStyle}>
            <div style={inspectionHeadingStyle}>Form Binding</div>
            <div style={metaStyle}>Form: {currentForm?.displayName ?? 'None'}</div>
            <div style={metaStyle}>Primary Table: {currentPrimaryEntity?.displayName ?? currentPrimaryBinding?.entityId ?? 'None'}</div>
          </div>

          <div style={fieldStyle}>
            <span>Allowed Outcomes</span>
            {document.model.process.outcomes.length > 0 ? (
              <div style={toggleChipWrapStyle}>
                {document.model.process.outcomes.map((outcome) => {
                  const active = selectedOutcomeIds.has(outcome.id);
                  return (
                    <button
                      key={outcome.id}
                      type="button"
                      style={{
                        ...toggleChipStyle,
                        ...(active ? activeToggleChipStyle : {})
                      }}
                      onClick={() =>
                        onIntent({
                          kind: 'update-stage-outcomes',
                          stageId: selection.stage.id,
                          outcomeIds: active
                            ? document.model.process.outcomes.filter((entry) => selectedOutcomeIds.has(entry.id) && entry.id !== outcome.id).map((entry) => entry.id)
                            : document.model.process.outcomes.filter((entry) => selectedOutcomeIds.has(entry.id) || entry.id === outcome.id).map((entry) => entry.id)
                        })
                      }
                    >
                      {outcome.displayName}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={metaStyle}>Use the palette to create an outcome.</div>
            )}
          </div>

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
    const selectedFormState = selection.step.formStateId
      ? stageForm?.formStates.find((state) => state.id === selection.step.formStateId) ?? null
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

          <FormStateInspectionSummary
            document={document}
            stepId={selection.step.id}
            form={stageForm ?? null}
            formState={selectedFormState}
          />

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
          <button
            type="button"
            style={dangerButtonStyle}
            onClick={() =>
              onIntent({
                kind: 'remove-node',
                nodeId: `outcome:${selection.outcome.id}`
              })
            }
          >
            Delete Outcome
          </button>
        </form>
      </div>
    );
  }

  if (selection.kind === 'transition') {
    const sourceStage = document.model.process.stages.find((stage) => stage.id === selection.transition.fromStageId);
    const targetStage = document.model.process.stages.find((stage) => stage.id === selection.transition.toStageId);
    const outcome = document.model.process.outcomes.find((entry) => entry.id === selection.transition.outcomeId);

    return (
      <div style={cardStyle}>
        <div style={sectionLabelStyle}>Stage Connection</div>
        <div style={metaStyle}>
          {sourceStage?.displayName ?? selection.transition.fromStageId}
          {' -> '}
          {targetStage?.displayName ?? selection.transition.toStageId}
        </div>
        <div style={metaStyle}>Outcome: {outcome?.displayName ?? selection.transition.outcomeId}</div>
        <HandoffEditor
          document={document}
          sourceStageId={selection.transition.fromStageId}
          targetStageId={selection.transition.toStageId}
          handoff={selection.transition.subjectHandoff ?? null}
          onChange={(subjectHandoff) =>
            onIntent({
              kind: 'update-transition-handoff',
              transitionId: selection.transition.id,
              subjectHandoff
            })
          }
        />
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

  const sourceStep = document.model.process.steps.find((step) => step.id === selection.transition.fromStepId) ?? null;
  const sourceStage = sourceStep ? document.model.process.stages.find((stage) => stage.id === sourceStep.stageId) ?? null : null;
  const targetStageId = 'stageId' in selection.transition.target
    ? selection.transition.target.stageId
    : 'stepId' in selection.transition.target
      ? document.model.process.steps.find((step) => step.id === selection.transition.target.stepId)?.stageId ?? null
      : null;
  const targetLabel =
    'stepId' in selection.transition.target
      ? document.model.process.steps.find((step) => step.id === selection.transition.target.stepId)?.displayName ?? selection.transition.target.stepId
      : 'stageId' in selection.transition.target
        ? document.model.process.stages.find((stage) => stage.id === selection.transition.target.stageId)?.displayName ?? selection.transition.target.stageId
        : document.model.process.outcomes.find((outcome) => outcome.id === selection.transition.target.outcomeId)?.displayName ?? selection.transition.target.outcomeId;

  return (
    <div style={cardStyle}>
      <div style={sectionLabelStyle}>Step Connection</div>
      <div style={metaStyle}>From: {sourceStep?.displayName ?? selection.transition.fromStepId}</div>
      <div style={metaStyle}>
        Target:{' '}
        {targetLabel}
      </div>
      {'outcomeId' in selection.transition.target ? null : (
        <HandoffEditor
          document={document}
          sourceStageId={sourceStage?.id ?? selection.transition.fromStepId}
          targetStageId={targetStageId ?? sourceStage?.id ?? selection.transition.fromStepId}
          handoff={selection.transition.subjectHandoff ?? null}
          onChange={(subjectHandoff) =>
            onIntent({
              kind: 'update-step-transition-handoff',
              transitionId: selection.transition.id,
              subjectHandoff
            })
          }
        />
      )}
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
const toggleChipWrapStyle = {
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap'
} as const;
const toggleChipStyle = {
  padding: '0.45rem 0.68rem',
  borderRadius: '999px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  cursor: 'pointer'
} as const;
const activeToggleChipStyle = {
  borderColor: '#b45309',
  background: '#fff7ed',
  color: '#9a3412'
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
const inspectionPanelStyle = {
  display: 'grid',
  gap: '0.7rem',
  padding: '0.85rem',
  borderRadius: '0.92rem',
  border: '1px solid #dbe4f0',
  background: '#f8fbff'
} as const;
const inspectionHeadingStyle = {
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#475569'
} as const;
const summaryGridStyle = {
  display: 'grid',
  gap: '0.7rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))'
} as const;
const summaryLabelStyle = {
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#64748b'
} as const;
const summaryChipStyle = {
  padding: '0.26rem 0.55rem',
  borderRadius: '999px',
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  fontSize: '0.76rem',
  color: '#1d4ed8'
} as const;
const behaviorListStyle = {
  display: 'grid',
  gap: '0.7rem'
} as const;
const behaviorCardStyle = {
  display: 'grid',
  gap: '0.45rem',
  padding: '0.75rem',
  borderRadius: '0.85rem',
  border: '1px solid #dbe4f0',
  background: '#fff'
} as const;
const behaviorHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '0.8rem',
  alignItems: 'flex-start',
  flexWrap: 'wrap'
} as const;
const behaviorBadgeRowStyle = {
  display: 'flex',
  gap: '0.35rem',
  flexWrap: 'wrap'
} as const;
const issueBannerStyle = {
  padding: '0.6rem 0.75rem',
  borderRadius: '0.8rem',
  border: '1px solid #fecaca',
  background: '#fff1f2',
  color: '#9f1239',
  fontSize: '0.88rem'
} as const;
