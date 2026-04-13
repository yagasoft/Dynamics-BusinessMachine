import type {
  DbmFormElementV1,
  DbmFormStateV1,
  DbmModelV1
} from 'dbm-contract';
import {
  createDeterministicGuid,
  createDiagnostic,
  getDataverseLogicalName,
  getEntityById,
  getFieldById
} from './common';
import type {
  DataverseBehaviorPlan,
  DataverseEntityPlan,
  DataverseFormControlPlan,
  DataverseFormEventHandlerPlan,
  DataverseFormLibraryPlan,
  DataverseFormPlan,
  DataverseFormRuntimePlan,
  DataverseFormSectionPlan,
  DataverseFormStatePlan,
  DataverseRuntimeStateFieldPlan,
  DataverseRuntimeValueBindingPlan,
  DataverseSynthesisDiagnostic
} from './types';

export const SHARED_FORM_RUNTIME_BEHAVIOR_ID = 'dbm-shared-form-runtime';
export const SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME = 'ys_/dbm/forms/runtime.js';

function escapeForJavaScriptString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function sanitizeFunctionIdentifier(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, '_');
  return /^[A-Za-z_]/.test(normalized) ? normalized : `_${normalized}`;
}

function getDefaultFormStateId(model: DbmModelV1, formId: string): string | null {
  const stageMap = new Map(model.process.stages.map((stage) => [stage.id, stage]));
  for (const step of model.process.steps) {
    const stage = stageMap.get(step.stageId);
    if (stage?.formId === formId && step.formStateId) {
      return step.formStateId;
    }
  }

  const form = model.forms.find((entry) => entry.id === formId);
  return form?.formStates[0]?.id ?? null;
}

function buildFormLibrariesXml(libraries: DataverseFormLibraryPlan[]): string {
  const libraryXml = libraries
    .map((library) => `    <Library name="${library.name}" libraryUniqueId="${library.libraryUniqueId}" />`)
    .join('\n');

  return `<formLibraries>\n${libraryXml}\n  </formLibraries>`;
}

function buildFormEventsXml(eventHandlers: DataverseFormEventHandlerPlan[]): string {
  const onLoadHandlers = eventHandlers
    .filter((handler) => handler.eventName === 'onload')
    .map(
      (handler) =>
        `        <Handler functionName="${handler.functionName}" libraryName="${handler.libraryName}" handlerUniqueId="${handler.handlerUniqueId}" enabled="${handler.enabled}" passExecutionContext="${handler.passExecutionContext}" parameters="${handler.parameters}" />`
    )
    .join('\n');

  return [
    '<events>',
    '    <event name="onload" application="false" active="true">',
    '      <Handlers>',
    onLoadHandlers,
    '      </Handlers>',
    '    </event>',
    '  </events>'
  ].join('\n');
}

function mapStateElementBehavior(
  state: DbmFormStateV1,
  elementId: string
): DbmFormStateV1['elementBehaviors'][number] | undefined {
  return state.elementBehaviors.find((entry) => entry.elementId === elementId);
}

function buildStatePlans(
  form: DbmModelV1['forms'][number],
  controlsByElementId: Map<string, DataverseFormControlPlan>
): DataverseFormStatePlan[] {
  const allControlNames = [...controlsByElementId.values()].map((control) => control.controlName);

  return form.formStates.map((state) => {
    const explicitElementIds = state.elementBehaviors.map((entry) => entry.elementId);
    const visibleControlNames =
      explicitElementIds.length > 0
        ? explicitElementIds
            .map((elementId) => controlsByElementId.get(elementId)?.controlName ?? null)
            .filter((value): value is string => Boolean(value))
        : allControlNames;

    const requiredControlNames: string[] = [];
    const lockedControlNames: string[] = [];

    for (const element of form.elements) {
      const control = controlsByElementId.get(element.id);
      if (!control) {
        continue;
      }

      const stateBehavior = mapStateElementBehavior(state, element.id);
      const requiredRuleIds = stateBehavior?.requiredRuleIds ?? element.behavior.requiredRuleIds;
      const editableRuleIds = stateBehavior?.editableRuleIds ?? element.behavior.editableRuleIds;

      if (requiredRuleIds.length > 0 && visibleControlNames.includes(control.controlName)) {
        requiredControlNames.push(control.controlName);
      }

      if (control.readOnly || editableRuleIds.length === 0 && element.elementType === 'read-only-text') {
        lockedControlNames.push(control.controlName);
      }
    }

    return {
      id: state.id,
      displayName: state.displayName,
      visibleControlNames: [...new Set(visibleControlNames)],
      requiredControlNames: [...new Set(requiredControlNames)],
      lockedControlNames: [...new Set(lockedControlNames)]
    };
  });
}

function getRuntimeOwnerEntityId(model: DbmModelV1): string | null {
  const startStage = model.process.stages.find((stage) => stage.stageType === 'start') ?? model.process.stages[0];
  if (!startStage?.formId) {
    return null;
  }

  const form = model.forms.find((entry) => entry.id === startStage.formId);
  const primaryBinding = form?.entityBindings.find((binding) => binding.id === form.primaryEntityBindingId);
  return primaryBinding?.entityId ?? null;
}

function getRuntimeStateFieldLogicalNames(entityPlan: DataverseEntityPlan): DataverseRuntimeStateFieldPlan {
  const prefix = entityPlan.logicalName.split('_')[0] ?? entityPlan.logicalName;
  return {
    stageId: `${prefix}_currentstageid`,
    stepId: `${prefix}_currentstepid`,
    formStateId: `${prefix}_currentformstateid`,
    internalStatusId: `${prefix}_internalstatusid`,
    portalStatusId: `${prefix}_portalstatusid`
  };
}

function buildChoiceMap(field: NonNullable<ReturnType<typeof getFieldById>>): Record<string, string> | undefined {
  if (field.dataType !== 'choice' || !field.choiceOptions?.length) {
    return undefined;
  }

  return Object.fromEntries(field.choiceOptions.map((option) => [String(option.value), option.id]));
}

function buildRuntimeValueBindings(model: DbmModelV1): DataverseRuntimeValueBindingPlan[] {
  const bindings: DataverseRuntimeValueBindingPlan[] = [];

  for (const entity of model.metadata.entities) {
    const entityLogicalName = entity.providerBindings.dataverse?.logicalName?.trim();
    if (!entityLogicalName) {
      continue;
    }

    for (const field of entity.fields) {
      const fieldLogicalName = field.providerBindings.dataverse?.logicalName?.trim();
      if (!fieldLogicalName) {
        continue;
      }

      bindings.push({
        token: field.id,
        entityLogicalName,
        fieldLogicalName,
        fieldType: field.dataType,
        choiceMap: buildChoiceMap(field)
      });
    }
  }

  return bindings;
}

function buildFormRuntimePlan(
  model: DbmModelV1,
  form: DbmModelV1['forms'][number],
  entityPlans: Map<string, DataverseEntityPlan>,
  primaryEntityPlan: DataverseEntityPlan | undefined,
  diagnostics: DataverseSynthesisDiagnostic[]
): DataverseFormRuntimePlan | null {
  const runtimeOwnerEntityId = getRuntimeOwnerEntityId(model);
  if (!runtimeOwnerEntityId) {
    diagnostics.push(
      createDiagnostic(
        'missing-runtime-owner-entity',
        'error',
        'Could not determine the runtime owner entity from the start-stage form.',
        `forms.${form.id}`
      )
    );
    return null;
  }

  const runtimeOwnerMetadataEntity = model.metadata.entities.find((entry) => entry.id === runtimeOwnerEntityId);
  const runtimeOwnerLogicalName = runtimeOwnerMetadataEntity?.providerBindings.dataverse?.logicalName?.trim() ?? '';
  const runtimeOwnerEntityPlan = entityPlans.get(runtimeOwnerEntityId);
  if (!runtimeOwnerLogicalName || !runtimeOwnerEntityPlan || !primaryEntityPlan) {
    diagnostics.push(
      createDiagnostic(
        'missing-runtime-form-binding',
        'error',
        `Form '${form.id}' could not resolve runtime owner or primary entity bindings.`,
        `forms.${form.id}`
      )
    );
    return null;
  }

  const runtimeStateFieldLogicalNames = getRuntimeStateFieldLogicalNames(runtimeOwnerEntityPlan);

  const startStage = model.process.stages.find((stage) => stage.stageType === 'start') ?? model.process.stages[0];
  const defaultStepId = startStage?.defaultStepId ?? model.process.steps[0]?.id ?? '';
  const defaultStep = model.process.steps.find((step) => step.id === defaultStepId) ?? model.process.steps[0];

  const relatedRequestLookupFieldLogicalName =
    primaryEntityPlan.id === runtimeOwnerEntityId
      ? null
      : (() => {
          const relatedBinding = form.entityBindings.find((binding) => binding.entityId === runtimeOwnerEntityId);
          if (!relatedBinding?.relationshipId) {
            return null;
          }

          const relationship = model.metadata.relationships.find((entry) => entry.id === relatedBinding.relationshipId);
          if (!relationship?.referencingFieldId) {
            return null;
          }

          const primaryEntity = model.metadata.entities.find((entry) => entry.id === primaryEntityPlan.id);
          const field = primaryEntity ? getFieldById(primaryEntity, relationship.referencingFieldId) : undefined;
          return field?.providerBindings.dataverse?.logicalName?.trim() ?? null;
        })();

  const reviewEntityLogicalName =
    model.metadata.entities.find((entry) => entry.id === 'request-decision')?.providerBindings.dataverse?.logicalName?.trim() ?? null;

  const reviewEntityRequestLookupFieldLogicalName =
    model.metadata.entities
      .find((entry) => entry.id === 'request-decision')
      ?.fields.find((entry) => entry.id === 'decision-request')
      ?.providerBindings.dataverse?.logicalName?.trim() ?? null;

  const reviewMetadataEntity = model.metadata.entities.find((entry) => entry.id === 'request-decision');

  const decisionOutcomeFieldLogicalName = (() => {
    const field = reviewMetadataEntity ? getFieldById(reviewMetadataEntity, 'decision-outcome') : undefined;
    return field?.providerBindings.dataverse?.logicalName?.trim() ?? null;
  })();

  const decisionSummaryFieldLogicalName = (() => {
    const field = reviewMetadataEntity ? getFieldById(reviewMetadataEntity, 'decision-summary') : undefined;
    return field?.providerBindings.dataverse?.logicalName?.trim() ?? null;
  })();

  const decisionCommentFieldLogicalName = (() => {
    const field = reviewMetadataEntity ? getFieldById(reviewMetadataEntity, 'decision-comment') : undefined;
    return field?.providerBindings.dataverse?.logicalName?.trim() ?? null;
  })();

  const valueBindings = buildRuntimeValueBindings(model);
  if (decisionOutcomeFieldLogicalName) {
    const outcomeField = reviewMetadataEntity?.fields.find((entry) => entry.id === 'decision-outcome');
    valueBindings.push({
      token: 'requestedOutcomeId',
      entityLogicalName: reviewEntityLogicalName ?? primaryEntityPlan.logicalName,
      fieldLogicalName: decisionOutcomeFieldLogicalName,
      fieldType: outcomeField?.dataType ?? 'string',
      choiceMap: outcomeField ? buildChoiceMap(outcomeField) : undefined
    });
  }

  return {
    requestEntityLogicalName: runtimeOwnerLogicalName,
    requestEntityPrimaryIdLogicalName:
      runtimeOwnerMetadataEntity?.fields
        .find((entry) => entry.id === runtimeOwnerMetadataEntity.primaryKeyFieldId)
        ?.providerBindings.dataverse?.logicalName?.trim() ?? `${runtimeOwnerLogicalName}id`,
    currentFormEntityLogicalName: primaryEntityPlan.logicalName,
    relatedRequestLookupFieldLogicalName,
    reviewEntityLogicalName,
    reviewEntityRequestLookupFieldLogicalName,
    runtimeStateFieldLogicalNames,
    decisionOutcomeFieldLogicalName,
    decisionSummaryFieldLogicalName,
    decisionCommentFieldLogicalName,
    defaultStageId: startStage?.id ?? '',
    defaultStepId,
    defaultFormStateId: defaultStep?.formStateId ?? null,
    statuses: model.process.statuses.map((status) => ({
      id: status.id,
      displayName: status.displayName
    })),
    stages: model.process.stages.map((stage) => ({
      id: stage.id,
      displayName: stage.displayName,
      stageType: stage.stageType,
      formId: stage.formId,
      defaultStepId: stage.defaultStepId
    })),
    steps: model.process.steps.map((step) => ({
      id: step.id,
      stageId: step.stageId,
      displayName: step.displayName,
      internalStatusId: step.internalStatusId,
      portalStatusId: step.portalStatusId,
      formStateId: step.formStateId,
      entryRuleIds: step.entryRuleIds,
      exitRuleIds: step.exitRuleIds
    })),
    stepTransitions: model.process.stepTransitions.map((transition) => ({
      id: transition.id,
      fromStepId: transition.fromStepId,
      guardRuleId: transition.guardRuleId,
      target: 'stepId' in transition.target
        ? { stepId: transition.target.stepId }
        : 'stageId' in transition.target
          ? { stageId: transition.target.stageId }
          : { outcomeId: transition.target.outcomeId }
    })),
    rules: Object.fromEntries(
      model.rules
        .filter((rule) => rule.language === 'dbm-expression-v1')
        .map((rule) => [rule.id, rule.body])
    ),
    valueBindings
  };
}

function buildSharedRuntimeBehaviorContent(): string {
  return `
(function (global) {
  const DBM = (global.DBM = global.DBM || {});
  const STATE_NOTIFICATION_ID = 'dbm-runtime-state';
  const ACTION_NOTIFICATION_ID = 'dbm-runtime-action';
  function getFormContext(executionContext) {
    if (!executionContext) {
      return null;
    }
    if (typeof executionContext.getFormContext === 'function') {
      return executionContext.getFormContext();
    }
    return executionContext;
  }
  function normalizeId(value) {
    if (!value) {
      return '';
    }
    return String(value).replace(/[{}]/g, '').toLowerCase();
  }
  function getTab(formContext, tabName) {
    return formContext?.ui?.tabs?.get ? formContext.ui.tabs.get(tabName) : null;
  }
  function getSection(formContext, tabName, sectionName) {
    const tab = getTab(formContext, tabName);
    return tab?.sections?.get ? tab.sections.get(sectionName) : null;
  }
  function getControl(formContext, controlName) {
    return formContext?.getControl ? formContext.getControl(controlName) : null;
  }
  function setRequiredLevel(control, isRequired) {
    if (typeof control?.getAttribute !== 'function') {
      return;
    }
    const attribute = control.getAttribute();
    if (!attribute || typeof attribute.setRequiredLevel !== 'function') {
      return;
    }
    attribute.setRequiredLevel(isRequired ? 'required' : 'none');
  }
  function setControlDisabled(control, isDisabled) {
    if (typeof control?.setDisabled === 'function') {
      control.setDisabled(Boolean(isDisabled));
    }
  }
  function applyState(executionContext, config, activeStateId) {
    const formContext = getFormContext(executionContext);
    if (!formContext || !config) {
      return;
    }
    const states = config.states || [];
    const activeState = states.find((entry) => entry.id === activeStateId) || states[0] || null;
    const visibleControls = new Set(activeState?.visibleControlNames || []);
    const requiredControls = new Set(activeState?.requiredControlNames || []);
    const lockedControls = new Set(activeState?.lockedControlNames || []);
    (config.sections || []).forEach((sectionConfig) => {
      const section = getSection(formContext, sectionConfig.tabName, sectionConfig.sectionName);
      const tab = getTab(formContext, sectionConfig.tabName);
      const hasVisibleControl = (sectionConfig.controls || []).some((control) => visibleControls.has(control.controlName));
      if (section && typeof section.setVisible === 'function') {
        section.setVisible(hasVisibleControl);
      }
      if (tab && typeof tab.setVisible === 'function') {
        const tabHasVisibleControl = (config.sections || []).some((candidateSection) =>
          candidateSection.tabName === sectionConfig.tabName &&
          (candidateSection.controls || []).some((candidateControl) => visibleControls.has(candidateControl.controlName))
        );
        tab.setVisible(tabHasVisibleControl);
      }
      (sectionConfig.controls || []).forEach((controlConfig) => {
        const control = getControl(formContext, controlConfig.controlName);
        if (!control) {
          return;
        }
        const shouldBeVisible = visibleControls.has(controlConfig.controlName);
        if (typeof control.setVisible === 'function') {
          control.setVisible(shouldBeVisible);
        }
        if (!shouldBeVisible) {
          setRequiredLevel(control, false);
          return;
        }
        setControlDisabled(control, Boolean(controlConfig.readOnly) || lockedControls.has(controlConfig.controlName));
        setRequiredLevel(control, requiredControls.has(controlConfig.controlName));
      });
    });
  }
  function applyInactiveState(executionContext, config) {
    const formContext = getFormContext(executionContext);
    if (!formContext || !config) {
      return;
    }
    (config.sections || []).forEach((sectionConfig) => {
      const section = getSection(formContext, sectionConfig.tabName, sectionConfig.sectionName);
      const tab = getTab(formContext, sectionConfig.tabName);
      if (section && typeof section.setVisible === 'function') {
        section.setVisible(true);
      }
      if (tab && typeof tab.setVisible === 'function') {
        tab.setVisible(true);
      }
      (sectionConfig.controls || []).forEach((controlConfig) => {
        const control = getControl(formContext, controlConfig.controlName);
        if (!control) {
          return;
        }
        if (typeof control.setVisible === 'function') {
          control.setVisible(true);
        }
        setControlDisabled(control, true);
        setRequiredLevel(control, false);
      });
    });
  }
  function splitExpression(expression, separator) {
    const segments = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < expression.length; index += 1) {
      const current = expression[index];
      if (current === '(') {
        depth += 1;
      } else if (current === ')') {
        depth = Math.max(0, depth - 1);
      }
      if (depth === 0 && expression.slice(index, index + separator.length) === separator) {
        segments.push(expression.slice(start, index).trim());
        start = index + separator.length;
        index += separator.length - 1;
      }
    }
    const tail = expression.slice(start).trim();
    if (tail) {
      segments.push(tail);
    }
    return segments;
  }
  function parseLiteral(value) {
    const trimmed = String(value || '').trim();
    if (trimmed === 'true') {
      return true;
    }
    if (trimmed === 'false') {
      return false;
    }
    if (trimmed === 'null') {
      return null;
    }
    if ((trimmed.startsWith(\"'\") && trimmed.endsWith(\"'\")) || (trimmed.startsWith('\"') && trimmed.endsWith('\"'))) {
      return trimmed.slice(1, -1);
    }
    if (/^-?\\d+(\\.\\d+)?$/.test(trimmed)) {
      return Number(trimmed);
    }
    return trimmed;
  }
  function compareValues(left, operator, right) {
    if (operator === '==') {
      return left === right;
    }
    if (operator === '!=') {
      return left !== right;
    }
    if (operator === '>=') {
      return Number(left) >= Number(right);
    }
    if (operator === '<=') {
      return Number(left) <= Number(right);
    }
    if (operator === '>') {
      return Number(left) > Number(right);
    }
    if (operator === '<') {
      return Number(left) < Number(right);
    }
    return false;
  }
  function notEmpty(value) {
    return !(value === null || value === undefined || value === '');
  }
  function evaluateExpression(expression, values) {
    const normalized = String(expression || '').trim();
    if (!normalized) {
      return true;
    }
    const orSegments = splitExpression(normalized, ' or ');
    if (orSegments.length > 1) {
      return orSegments.some((segment) => evaluateExpression(segment, values));
    }
    const andSegments = splitExpression(normalized, ' and ');
    if (andSegments.length > 1) {
      return andSegments.every((segment) => evaluateExpression(segment, values));
    }
    const notEmptyMatch = /^notEmpty\\(([^)]+)\\)$/.exec(normalized);
    if (notEmptyMatch) {
      return notEmpty(values[notEmptyMatch[1].trim()]);
    }
    const comparisonMatch = /^([A-Za-z][A-Za-z0-9-]*)\\s*(==|!=|>=|<=|>|<)\\s*(.+)$/.exec(normalized);
    if (comparisonMatch) {
      const left = values[comparisonMatch[1]];
      const right = parseLiteral(comparisonMatch[3]);
      return compareValues(left, comparisonMatch[2], right);
    }
    if (normalized in values) {
      return Boolean(values[normalized]);
    }
    return false;
  }
  function getStatusDisplayName(runtime, statusId) {
    return (runtime.statuses || []).find((status) => status.id === statusId)?.displayName || statusId || 'Unknown';
  }
  function getStage(runtime, stageId) {
    return (runtime.stages || []).find((stage) => stage.id === stageId) || null;
  }
  function getStep(runtime, stepId) {
    return (runtime.steps || []).find((step) => step.id === stepId) || null;
  }
  function getValueFromRecord(record, binding) {
    if (!record || !binding) {
      return null;
    }
    let rawValue = record[binding.fieldLogicalName];
    if ((rawValue === null || rawValue === undefined) && binding.fieldType === 'lookup') {
      rawValue = record['_' + binding.fieldLogicalName + '_value'];
    }
    if (binding.choiceMap && rawValue !== null && rawValue !== undefined) {
      const mapped = binding.choiceMap[String(rawValue)];
      return mapped ?? rawValue;
    }
    return rawValue;
  }
  function buildValueMap(runtime, requestRecord, currentFormRecord) {
    const values = {};
    (runtime.valueBindings || []).forEach((binding) => {
      const source = binding.entityLogicalName === runtime.requestEntityLogicalName ? requestRecord : currentFormRecord;
      values[binding.token] = getValueFromRecord(source, binding);
    });
    return values;
  }
  function overlayCurrentFormValues(formContext, runtime, currentFormRecord) {
    const projected = Object.assign({}, currentFormRecord || {});
    if (!formContext?.getAttribute) {
      return projected;
    }
    (runtime.valueBindings || [])
      .filter((binding) => binding.entityLogicalName === runtime.currentFormEntityLogicalName)
      .forEach((binding) => {
        const attribute = formContext.getAttribute(binding.fieldLogicalName);
        if (!attribute || typeof attribute.getValue !== 'function') {
          return;
        }
        let value = attribute.getValue();
        if (Array.isArray(value) && value[0]?.id) {
          value = normalizeId(value[0].id);
        }
        projected[binding.fieldLogicalName] = value;
      });
    return projected;
  }
  function getDefaultRuntimeState(runtime, currentFormId, fallbackFormStateId) {
    const defaultStep = getStep(runtime, runtime.defaultStepId);
    const defaultState = {
      stageId: runtime.defaultStageId,
      stepId: runtime.defaultStepId,
      formStateId: defaultStep?.formStateId || runtime.defaultFormStateId || fallbackFormStateId || null,
      internalStatusId: defaultStep?.internalStatusId || '',
      portalStatusId: defaultStep?.portalStatusId || null
    };
    if (!currentFormId) {
      return defaultState;
    }
    const matchingStage = (runtime.stages || []).find(
      (stage) => stage.formId === currentFormId && stage.defaultStepId
    );
    if (!matchingStage?.defaultStepId) {
      return defaultState;
    }
    const matchingStep = getStep(runtime, matchingStage.defaultStepId);
    return {
      stageId: matchingStage.id,
      stepId: matchingStep?.id || defaultState.stepId,
      formStateId:
        matchingStep?.formStateId ||
        fallbackFormStateId ||
        defaultState.formStateId,
      internalStatusId: matchingStep?.internalStatusId || defaultState.internalStatusId,
      portalStatusId: matchingStep?.portalStatusId || defaultState.portalStatusId
    };
  }
  function getRuntimeStateFromRecord(runtime, requestRecord, config) {
    const fields = runtime.runtimeStateFieldLogicalNames;
    const defaultState = getDefaultRuntimeState(runtime, config?.formId, config?.defaultStateId);
    if (!requestRecord) {
      return defaultState;
    }
    return {
      stageId: requestRecord[fields.stageId] || defaultState.stageId,
      stepId: requestRecord[fields.stepId] || defaultState.stepId,
      formStateId: requestRecord[fields.formStateId] || defaultState.formStateId,
      internalStatusId: requestRecord[fields.internalStatusId] || defaultState.internalStatusId,
      portalStatusId: requestRecord[fields.portalStatusId] || defaultState.portalStatusId
    };
  }
  function deriveStateFromTarget(runtime, currentState, target) {
    if (target.stepId) {
      const nextStep = getStep(runtime, target.stepId);
      if (!nextStep) {
        return currentState;
      }
      return {
        stageId: nextStep.stageId,
        stepId: nextStep.id,
        formStateId: nextStep.formStateId || currentState.formStateId,
        internalStatusId: nextStep.internalStatusId,
        portalStatusId: nextStep.portalStatusId
      };
    }
    if (target.stageId) {
      const nextStage = getStage(runtime, target.stageId);
      const nextStep = nextStage?.defaultStepId ? getStep(runtime, nextStage.defaultStepId) : null;
      return {
        stageId: target.stageId,
        stepId: nextStep?.id || currentState.stepId,
        formStateId: nextStep?.formStateId || currentState.formStateId,
        internalStatusId: nextStep?.internalStatusId || currentState.internalStatusId,
        portalStatusId: nextStep?.portalStatusId || currentState.portalStatusId
      };
    }
    return currentState;
  }
  function evaluate(runtime, values, currentState, correlationId) {
    let nextState = { ...currentState };
    const messages = [];
    let iterations = 0;
    while (iterations < 5) {
      const currentStep = getStep(runtime, nextState.stepId);
      if (!currentStep) {
        break;
      }
      const transition = (runtime.stepTransitions || [])
        .filter((candidate) => candidate.fromStepId === currentStep.id)
        .find((candidate) => evaluateExpression(runtime.rules[candidate.guardRuleId], values));
      if (!transition) {
        break;
      }
      const derived = deriveStateFromTarget(runtime, nextState, transition.target || {});
      if (
        derived.stageId === nextState.stageId &&
        derived.stepId === nextState.stepId &&
        derived.formStateId === nextState.formStateId &&
        derived.internalStatusId === nextState.internalStatusId &&
        derived.portalStatusId === nextState.portalStatusId
      ) {
        break;
      }
      nextState = derived;
      messages.push({
        level: 'info',
        code: 'transition-completed',
        text: 'Request moved to ' + (getStage(runtime, nextState.stageId)?.displayName || nextState.stageId) + '.'
      });
      iterations += 1;
    }
    return {
      schemaVersion: 'dbm.runtime.result/v1',
      status: 'ok',
      state: nextState,
      effects: {
        persist: [],
        notifications: [],
        artifactCalls: []
      },
      messages,
      errors: [],
      correlationId: correlationId || 'dbm-runtime'
    };
  }
  function getClientUrl() {
    return global.Xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.() || null;
  }
  function createHeaders() {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json; charset=utf-8',
      'OData-Version': '4.0',
      'OData-MaxVersion': '4.0'
    };
  }
  async function retrieveRecord(entityLogicalName, recordId, selectFields) {
    const clientUrl = getClientUrl();
    if (!clientUrl || !entityLogicalName || !recordId) {
      return null;
    }
    const query = selectFields?.length ? '?$select=' + Array.from(new Set(selectFields)).join(',') : '';
    const response = await global.fetch(clientUrl + '/api/data/v9.2/' + entityLogicalName + 's(' + recordId + ')' + query, {
      method: 'GET',
      headers: createHeaders(),
      credentials: 'same-origin'
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  }
  async function retrieveMultiple(entityLogicalName, query) {
    const clientUrl = getClientUrl();
    if (!clientUrl || !entityLogicalName) {
      return [];
    }
    const response = await global.fetch(clientUrl + '/api/data/v9.2/' + entityLogicalName + 's' + (query || ''), {
      method: 'GET',
      headers: createHeaders(),
      credentials: 'same-origin'
    });
    if (!response.ok) {
      return [];
    }
    const payload = await response.json();
    return payload.value || [];
  }
  async function updateRecord(entityLogicalName, recordId, payload) {
    const clientUrl = getClientUrl();
    if (!clientUrl || !entityLogicalName || !recordId || !payload || Object.keys(payload).length === 0) {
      return;
    }
    await global.fetch(clientUrl + '/api/data/v9.2/' + entityLogicalName + 's(' + recordId + ')', {
      method: 'PATCH',
      headers: createHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
  }
  async function createRecord(entityLogicalName, payload) {
    const clientUrl = getClientUrl();
    if (!clientUrl || !entityLogicalName || !payload) {
      return null;
    }
    const response = await global.fetch(clientUrl + '/api/data/v9.2/' + entityLogicalName + 's', {
      method: 'POST',
      headers: createHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      return null;
    }
    return await response.json().catch(() => null);
  }
  function clearNotifications(formContext) {
    if (typeof formContext?.ui?.clearFormNotification === 'function') {
      formContext.ui.clearFormNotification(STATE_NOTIFICATION_ID);
      formContext.ui.clearFormNotification(ACTION_NOTIFICATION_ID);
    }
  }
  function renderProcessExperience(formContext, config, result) {
    if (!formContext?.ui?.setFormNotification) {
      return;
    }
    clearNotifications(formContext);
    const runtime = config.runtime;
    const stage = getStage(runtime, result.state.stageId);
    const step = getStep(runtime, result.state.stepId);
    const stageText = stage?.displayName || result.state.stageId;
    const stepText = step?.displayName || result.state.stepId;
    const internalStatus = getStatusDisplayName(runtime, result.state.internalStatusId);
    const portalStatus = result.state.portalStatusId ? getStatusDisplayName(runtime, result.state.portalStatusId) : 'None';
    formContext.ui.setFormNotification(
      'DBM Process: ' + stageText + ' -> ' + stepText + ' | Internal: ' + internalStatus + ' | Portal: ' + portalStatus,
      'INFO',
      STATE_NOTIFICATION_ID
    );
    const activeStage = getStage(runtime, result.state.stageId);
    if (activeStage?.formId && activeStage.formId !== config.formId) {
      formContext.ui.setFormNotification(
        'This record has moved to a different DBM form. Open the active form to continue the process.',
        'INFO',
        ACTION_NOTIFICATION_ID
      );
    }
  }
  async function ensureReviewRecord(runtime, requestId, values) {
    if (!requestId || !runtime.reviewEntityLogicalName || !runtime.reviewEntityRequestLookupFieldLogicalName || !runtime.decisionSummaryFieldLogicalName) {
      return null;
    }
    const existing = await retrieveMultiple(
      runtime.reviewEntityLogicalName,
      '?$select=' + [runtime.reviewEntityLogicalName + 'id', runtime.reviewEntityRequestLookupFieldLogicalName, runtime.decisionSummaryFieldLogicalName].join(',') +
        '&$filter=_' + runtime.reviewEntityRequestLookupFieldLogicalName + '_value eq ' + requestId
    );
    const summaryText = 'Review request ' + (values['request-title'] || requestId) + '.';
    if (existing.length > 0) {
      const existingSummary = existing[0][runtime.decisionSummaryFieldLogicalName];
      if (existingSummary !== summaryText && existing[0][runtime.reviewEntityLogicalName + 'id']) {
        await updateRecord(runtime.reviewEntityLogicalName, normalizeId(existing[0][runtime.reviewEntityLogicalName + 'id']), {
          [runtime.decisionSummaryFieldLogicalName]: summaryText
        });
      }
      return existing[0];
    }
    const payload = {};
    payload[runtime.reviewEntityRequestLookupFieldLogicalName + '@odata.bind'] = '/' + runtime.requestEntityLogicalName + 's(' + requestId + ')';
    payload[runtime.decisionSummaryFieldLogicalName] = summaryText;
    return await createRecord(runtime.reviewEntityLogicalName, payload);
  }
  function selectFields(runtime, entityLogicalName) {
    const fields = [];
    (runtime.valueBindings || [])
      .filter((binding) => binding.entityLogicalName === entityLogicalName)
      .forEach((binding) => fields.push(binding.fieldLogicalName));
    if (entityLogicalName === runtime.requestEntityLogicalName) {
      const stateFields = runtime.runtimeStateFieldLogicalNames;
      fields.push(stateFields.stageId, stateFields.stepId, stateFields.formStateId, stateFields.internalStatusId, stateFields.portalStatusId);
    }
    return Array.from(new Set(fields.filter(Boolean)));
  }
  async function sync(executionContext, config) {
    const formContext = getFormContext(executionContext);
    if (!formContext || !config?.runtime) {
      applyState(executionContext, config, config?.defaultStateId || null);
      return null;
    }
    const runtime = config.runtime;
    const currentRecordId = normalizeId(formContext.data?.entity?.getId?.());
    if (!currentRecordId) {
      applyState(executionContext, config, config.defaultStateId);
      return null;
    }
    const requestId =
      runtime.currentFormEntityLogicalName === runtime.requestEntityLogicalName
        ? currentRecordId
        : normalizeId(formContext.getAttribute(runtime.relatedRequestLookupFieldLogicalName)?.getValue?.()?.[0]?.id);
    const requestRecord = requestId
      ? await retrieveRecord(runtime.requestEntityLogicalName, requestId, selectFields(runtime, runtime.requestEntityLogicalName))
      : null;
    const currentFormRecord = await retrieveRecord(
      runtime.currentFormEntityLogicalName,
      currentRecordId,
      selectFields(runtime, runtime.currentFormEntityLogicalName)
    );
    const projectedCurrentFormRecord = overlayCurrentFormValues(formContext, runtime, currentFormRecord);
    const values = buildValueMap(runtime, requestRecord, projectedCurrentFormRecord);
    const currentState = getRuntimeStateFromRecord(runtime, requestRecord, config);
    const result = evaluate(runtime, values, currentState, 'dbm-runtime-' + currentRecordId);
    if (requestId) {
      const stateFields = runtime.runtimeStateFieldLogicalNames;
      const payload = {};
      payload[stateFields.stageId] = result.state.stageId;
      payload[stateFields.stepId] = result.state.stepId;
      payload[stateFields.formStateId] = result.state.formStateId;
      payload[stateFields.internalStatusId] = result.state.internalStatusId;
      payload[stateFields.portalStatusId] = result.state.portalStatusId;
      await updateRecord(runtime.requestEntityLogicalName, requestId, payload);
      const activeStage = getStage(runtime, result.state.stageId);
      if (activeStage?.id === 'manager-review') {
        await ensureReviewRecord(runtime, requestId, values);
      }
    }
    const activeStage = getStage(runtime, result.state.stageId);
    if (activeStage?.formId && activeStage.formId !== config.formId) {
      applyInactiveState(executionContext, config);
    } else {
      applyState(executionContext, config, result.state.formStateId || config.defaultStateId);
    }
    renderProcessExperience(formContext, config, result);
    return result;
  }
  function initialize(executionContext, config) {
    const formContext = getFormContext(executionContext);
    if (!formContext) {
      return;
    }
    if (formContext.__dbmRuntimeInitialized) {
      void sync(executionContext, config);
      return;
    }
    formContext.__dbmRuntimeInitialized = true;
    if (typeof formContext.data?.entity?.addOnSave === 'function') {
      formContext.data.entity.addOnSave(function () {
        global.setTimeout(function () {
          void sync(executionContext, config);
        }, 750);
      });
    }
    void sync(executionContext, config);
  }
  DBM.FormBehavior = {
    apply: applyState,
    applyInactiveState: applyInactiveState
  };
  DBM.ProcessRuntime = {
    evaluate: evaluate,
    initialize: initialize,
    sync: sync
  };
})(window);
`.trimStart() + '\n';
}

function buildFormConfigBehaviorContent(formPlan: DataverseFormPlan): string {
  const onLoadFunctionName = formPlan.eventHandlers[0]?.functionName ?? sanitizeFunctionIdentifier(`dbmOnLoad_${formPlan.id}`);
  const config = {
    formId: formPlan.id,
    displayName: formPlan.displayName,
    defaultStateId: formPlan.defaultFormStateId,
    sections: formPlan.sections.map((section) => ({
      id: section.id,
      tabName: section.tabName,
      sectionName: section.sectionName,
      controls: section.controls.map((control) => ({
        controlName: control.controlName,
        readOnly: control.readOnly
      }))
    })),
    states: formPlan.states,
    runtime: formPlan.runtime
  };

  return [
    '(function (global) {',
    `  const config = ${JSON.stringify(config, null, 2)};`,
    `  function ${onLoadFunctionName}(executionContext) {`,
    '    if (!global.DBM || !global.DBM.ProcessRuntime || typeof global.DBM.ProcessRuntime.initialize !== "function") {',
      '      return;',
    '    }',
    '    global.DBM.ProcessRuntime.initialize(executionContext, config);',
    '  }',
    `  global.${onLoadFunctionName} = ${onLoadFunctionName};`,
    '})(window);',
    ''
  ].join('\n');
}

function resolveControlPlan(
  model: DbmModelV1,
  form: DbmModelV1['forms'][number],
  element: DbmFormElementV1,
  diagnostics: DataverseSynthesisDiagnostic[]
): DataverseFormControlPlan | null {
  const elementBinding = element.binding;
  if (!('entityBindingId' in elementBinding)) {
    diagnostics.push(
      createDiagnostic(
        'unsupported-variable-form-binding',
        'error',
        `Form element '${element.id}' binds to a variable. R1 only supports existing Dataverse field controls on model-driven forms.`,
        `forms.${form.id}.elements.${element.id}`
      )
    );
    return null;
  }

  const controlName = element.providerBindings?.dataverse?.controlName?.trim();
  if (!controlName) {
    diagnostics.push(
      createDiagnostic(
        'missing-form-control-name',
        'error',
        `Form element '${element.id}' is missing providerBindings.dataverse.controlName.`,
        `forms.${form.id}.elements.${element.id}`
      )
    );
    return null;
  }

  const entityBinding = form.entityBindings.find((binding) => binding.id === elementBinding.entityBindingId);
  if (!entityBinding) {
    diagnostics.push(
      createDiagnostic(
        'missing-form-entity-binding',
        'error',
        `Form element '${element.id}' references missing entity binding '${elementBinding.entityBindingId}'.`,
        `forms.${form.id}.elements.${element.id}`
      )
    );
    return null;
  }

  const entity = getEntityById(model, entityBinding.entityId);
  if (!entity) {
    diagnostics.push(
      createDiagnostic(
        'missing-form-entity',
        'error',
        `Form element '${element.id}' references missing entity '${entityBinding.entityId}'.`,
        `forms.${form.id}.elements.${element.id}`
      )
    );
    return null;
  }

  const field = getFieldById(entity, elementBinding.fieldId);
  if (!field) {
    diagnostics.push(
      createDiagnostic(
        'missing-form-field',
        'error',
        `Form element '${element.id}' references missing field '${elementBinding.fieldId}'.`,
        `forms.${form.id}.elements.${element.id}`
      )
    );
    return null;
  }

  let entityLogicalName: string;
  let dataFieldName: string;
  try {
    entityLogicalName = getDataverseLogicalName(entity, `entity '${entity.id}'`);
    dataFieldName = getDataverseLogicalName(field, `field '${field.id}'`);
  } catch (error) {
    diagnostics.push(
      createDiagnostic(
        'missing-form-dataverse-binding',
        'error',
        error instanceof Error ? error.message : `Dataverse bindings are missing for form element '${element.id}'.`,
        `forms.${form.id}.elements.${element.id}`
      )
    );
    return null;
  }

  return {
    id: element.id,
    displayName: element.displayName,
    elementType: element.elementType,
    entityBindingId: entityBinding.id,
    entityLogicalName,
    dataFieldName,
    controlName,
    readOnly: field.isReadOnly || element.elementType === 'read-only-text',
    requiredByDefault: element.behavior.requiredRuleIds.length > 0,
    sourceElementIds: [element.id]
  };
}

function createFormPlan(
  model: DbmModelV1,
  form: DbmModelV1['forms'][number],
  entityPlans: Map<string, DataverseEntityPlan>,
  diagnostics: DataverseSynthesisDiagnostic[]
): DataverseFormPlan {
  const formId = form.providerBindings?.dataverse?.formId?.trim() ?? '';
  if (!formId) {
    diagnostics.push(
      createDiagnostic(
        'missing-form-id-binding',
        'error',
        `Form '${form.id}' is missing providerBindings.dataverse.formId.`,
        `forms.${form.id}`
      )
    );
  }

  const primaryBinding = form.entityBindings.find((binding) => binding.id === form.primaryEntityBindingId);
  if (!primaryBinding) {
    diagnostics.push(
      createDiagnostic(
        'missing-primary-form-binding',
        'error',
        `Form '${form.id}' is missing primary entity binding '${form.primaryEntityBindingId}'.`,
        `forms.${form.id}`
      )
    );
  } else if (primaryBinding.role !== 'primary') {
    diagnostics.push(
      createDiagnostic(
        'non-primary-primary-binding',
        'error',
        `Form '${form.id}' declares '${primaryBinding.id}' as the primary entity binding, but its role is '${primaryBinding.role}'.`,
        `forms.${form.id}.entityBindings.${primaryBinding.id}`
      )
    );
  }

  const primaryEntityPlan = primaryBinding ? entityPlans.get(primaryBinding.entityId) : undefined;
  if (primaryBinding && !primaryEntityPlan) {
    diagnostics.push(
      createDiagnostic(
        'missing-primary-entity-plan',
        'error',
        `Form '${form.id}' references unsupported primary entity '${primaryBinding.entityId}'.`,
        `forms.${form.id}`
      )
    );
  }

  const controlsByRegionId = new Map<string, DataverseFormControlPlan[]>();
  const controlsByElementId = new Map<string, DataverseFormControlPlan>();
  for (const element of form.elements) {
    const control = resolveControlPlan(model, form, element, diagnostics);
    if (!control) {
      continue;
    }

    const controls = controlsByRegionId.get(element.regionId) ?? [];
    controls.push(control);
    controlsByRegionId.set(element.regionId, controls);
    controlsByElementId.set(element.id, control);
  }

  const sections: DataverseFormSectionPlan[] = form.layout.regions
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((region) => {
      const tabName = region.providerBindings?.dataverse?.tabName?.trim() ?? '';
      const sectionName = region.providerBindings?.dataverse?.sectionName?.trim() ?? '';
      if (!tabName || !sectionName) {
        diagnostics.push(
          createDiagnostic(
            'missing-form-region-binding',
            'error',
            `Region '${region.id}' on form '${form.id}' is missing providerBindings.dataverse.tabName or sectionName.`,
            `forms.${form.id}.layout.regions.${region.id}`
          )
        );
      }

      return {
        id: region.id,
        displayName: region.displayName,
        order: region.order,
        tabName,
        sectionName,
        controls: controlsByRegionId.get(region.id) ?? []
      };
    });

  const configBehaviorId = `${form.id}:behavior-config`;
  const configWebResourceName = `ys_/dbm/forms/config/${form.id}.js`;
  const configFunctionName = sanitizeFunctionIdentifier(`dbmOnLoad_${form.id}`);
  const libraries: DataverseFormLibraryPlan[] = [
    {
      name: SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME,
      libraryUniqueId: createDeterministicGuid(`${form.id}:runtime-library`)
    },
    {
      name: configWebResourceName,
      libraryUniqueId: createDeterministicGuid(`${form.id}:config-library`)
    }
  ];
  const eventHandlers: DataverseFormEventHandlerPlan[] = [
    {
      eventName: 'onload',
      functionName: configFunctionName,
      libraryName: configWebResourceName,
      handlerUniqueId: createDeterministicGuid(`${form.id}:onload-handler`),
      enabled: true,
      passExecutionContext: true,
      parameters: '',
      application: false,
      active: true,
      eventType: 'DataEvent'
    }
  ];

  const runtimePlan = buildFormRuntimePlan(model, form, entityPlans, primaryEntityPlan, diagnostics);

  const plan: DataverseFormPlan = {
    id: form.id,
    sourceFormId: form.id,
    sourceEntityBindingId: form.primaryEntityBindingId,
    kind: 'main',
    folder: 'main',
    displayName: form.displayName,
    entityId: primaryBinding?.entityId ?? '',
    entityLogicalName: primaryEntityPlan?.logicalName ?? '',
    systemFormId: formId,
    supported:
      Boolean(formId) &&
      Boolean(primaryBinding) &&
      primaryBinding?.role === 'primary' &&
      Boolean(primaryEntityPlan) &&
      Boolean(runtimePlan) &&
      sections.every((section) => section.tabName && section.sectionName) &&
      form.elements.length === controlsByElementId.size,
    reason: null,
    templateRelativePath: `src/Entities/${primaryEntityPlan?.schemaName ?? 'Unknown'}/FormXml/main/${formId}.xml`,
    relativePath: `src/Entities/${primaryEntityPlan?.schemaName ?? 'Unknown'}/FormXml/main/${formId}.xml`,
    sections,
    libraries,
    eventHandlers,
    managedFormLibrariesXml: buildFormLibrariesXml(libraries),
    managedEventsXml: buildFormEventsXml(eventHandlers),
    defaultFormStateId: getDefaultFormStateId(model, form.id),
    states: buildStatePlans(form, controlsByElementId),
    configBehaviorId,
    runtime: runtimePlan
  };

  if (!plan.supported && !plan.reason) {
    plan.reason = 'Form bindings are incomplete for the existing-form R1 synthesis path.';
  }

  return plan;
}

export function planExistingDataverseForms(
  model: DbmModelV1,
  entityPlans: Map<string, DataverseEntityPlan>,
  diagnostics: DataverseSynthesisDiagnostic[]
): {
  forms: DataverseFormPlan[];
  behaviors: DataverseBehaviorPlan[];
} {
  const forms = model.forms.map((form) => createFormPlan(model, form, entityPlans, diagnostics));

  const behaviors: DataverseBehaviorPlan[] = [
    {
      id: SHARED_FORM_RUNTIME_BEHAVIOR_ID,
      kind: 'shared-runtime',
      displayName: 'DBM Form Behavior Runtime',
      webResourceName: SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME,
      webResourceId: createDeterministicGuid(SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME),
      supported: true,
      reason: null,
      webResourceType: 3,
      relativePath: 'src/WebResources/ys_/dbm/forms/runtime.js',
      content: buildSharedRuntimeBehaviorContent(),
      attachedFormIds: forms.filter((form) => form.supported).map((form) => form.id)
    }
  ];

  for (const formPlan of forms) {
    const webResourceName = `ys_/dbm/forms/config/${formPlan.id}.js`;
    behaviors.push({
      id: formPlan.configBehaviorId,
      kind: 'form-config',
      displayName: `${formPlan.displayName} Behavior Config`,
      webResourceName,
      webResourceId: createDeterministicGuid(webResourceName),
      supported: formPlan.supported,
      reason: formPlan.supported ? null : formPlan.reason,
      webResourceType: 3,
      relativePath: `src/WebResources/ys_/dbm/forms/config/${formPlan.id}.js`,
      content: buildFormConfigBehaviorContent(formPlan),
      attachedFormIds: [formPlan.id]
    });
  }

  return {
    forms,
    behaviors
  };
}
