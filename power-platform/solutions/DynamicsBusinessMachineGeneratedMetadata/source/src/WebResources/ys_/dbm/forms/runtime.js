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
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return trimmed.slice(1, -1);
    }
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
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
    const notEmptyMatch = /^notEmpty\(([^)]+)\)$/.exec(normalized);
    if (notEmptyMatch) {
      return notEmpty(values[notEmptyMatch[1].trim()]);
    }
    const comparisonMatch = /^([A-Za-z][A-Za-z0-9-]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/.exec(normalized);
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
  function getProcessExperienceBridge() {
    return global.DBM?.ProcessExperienceHost ?? null;
  }
  function resolveNavigationTarget(config, formStateId) {
    if (!formStateId || !config?.processHost?.jumpTargetsByFormStateId) {
      return null;
    }
    return config.processHost.jumpTargetsByFormStateId[formStateId] || null;
  }
  function focusNavigationTarget(formContext, target) {
    if (!target) {
      return;
    }
    const tab = target.tabName ? getTab(formContext, target.tabName) : null;
    if (typeof tab?.setVisible === 'function') {
      tab.setVisible(true);
    }
    if (typeof tab?.setFocus === 'function') {
      tab.setFocus();
    }
    const section = target.tabName && target.sectionName ? getSection(formContext, target.tabName, target.sectionName) : null;
    if (typeof section?.setVisible === 'function') {
      section.setVisible(true);
    }
    const control = target.controlName ? getControl(formContext, target.controlName) : null;
    if (typeof control?.setVisible === 'function') {
      control.setVisible(true);
    }
    if (typeof control?.setFocus === 'function') {
      control.setFocus();
    }
  }
  function applyOutcomeSelection(formContext, config, outcomeId) {
    const runtime = config?.runtime;
    if (!runtime?.decisionOutcomeFieldLogicalName) {
      return false;
    }
    const optionValue = runtime.decisionOutcomeOptionValuesByOutcomeId?.[outcomeId];
    if (optionValue === null || optionValue === undefined) {
      return false;
    }
    const attribute = formContext?.getAttribute?.(runtime.decisionOutcomeFieldLogicalName);
    if (!attribute || typeof attribute.setValue !== 'function') {
      return false;
    }
    attribute.setValue(optionValue);
    if (typeof attribute.fireOnChange === 'function') {
      attribute.fireOnChange();
    }
    return true;
  }
  function buildProcessExperienceProps(formContext, config, result, mode) {
    const bridge = getProcessExperienceBridge();
    if (!bridge || typeof bridge.buildRuntimeProcessExperienceSnapshot !== 'function') {
      return null;
    }
    const navigationTarget = resolveNavigationTarget(config, result.state.formStateId);
    const snapshot = bridge.buildRuntimeProcessExperienceSnapshot(
      config.runtime.processExperienceRuntime,
      result.state,
      {
        audience: 'internal',
        currentFormId: config.formId
      }
    );
    return {
      snapshot,
      audience: 'internal',
      mode,
      navigationTarget,
      onNavigateToFormRegion: function (target) {
        focusNavigationTarget(formContext, target);
      },
      onInvokeOutcome: function (outcomeId) {
        if (applyOutcomeSelection(formContext, config, outcomeId)) {
          void sync(formContext, config);
        }
      },
      onRequestFocus: function () {
        if (navigationTarget) {
          focusNavigationTarget(formContext, navigationTarget);
        }
      }
    };
  }
  async function renderSectionHost(formContext, config, result, attempt) {
    const props = buildProcessExperienceProps(formContext, config, result, 'model-driven-section');
    const controlName = config?.processHost?.supported?.controlName;
    if (!props || !controlName) {
      return false;
    }
    const control = getControl(formContext, controlName);
    if (!control || typeof control.getContentWindow !== 'function') {
      return false;
    }
    const contentWindow = await control.getContentWindow().catch(() => null);
    const frame = contentWindow?.DBM?.[config.processHost.supported.frameBridgeName];
    if (frame && typeof frame.render === 'function') {
      frame.render(props);
      return true;
    }
    if ((attempt || 0) < 6) {
      global.setTimeout(function () {
        void renderSectionHost(formContext, config, result, (attempt || 0) + 1);
      }, 120);
    }
    return false;
  }
  function ensureOverlayContainer(config) {
    if (!global.document?.body || !config?.processHost?.overlay?.containerId) {
      return null;
    }
    const existing = global.document.getElementById(config.processHost.overlay.containerId);
    if (existing) {
      return existing;
    }
    const container = global.document.createElement('div');
    container.id = config.processHost.overlay.containerId;
    container.style.position = 'sticky';
    container.style.top = '0';
    container.style.zIndex = '30';
    container.style.margin = '0 0 16px';
    container.style.background = 'transparent';
    container.style.padding = '8px 0';
    if (typeof global.document.body.prepend === 'function') {
      global.document.body.prepend(container);
    } else if (global.document.body.firstChild) {
      global.document.body.insertBefore(container, global.document.body.firstChild);
    } else {
      global.document.body.appendChild(container);
    }
    return container;
  }
  function renderOverlayHost(formContext, config, result) {
    if (!config?.processHost?.overlay?.enabled) {
      return false;
    }
    const bridge = getProcessExperienceBridge();
    const container = ensureOverlayContainer(config);
    if (!bridge || typeof bridge.render !== 'function' || !container) {
      return false;
    }
    const props = buildProcessExperienceProps(formContext, config, result, 'model-driven-overlay');
    if (!props) {
      return false;
    }
    bridge.render(container, props);
    return true;
  }
  async function renderProcessExperience(formContext, config, result) {
    await renderSectionHost(formContext, config, result, 0);
    renderOverlayHost(formContext, config, result);
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
    await renderProcessExperience(formContext, config, result);
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
