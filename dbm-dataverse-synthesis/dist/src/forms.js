"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME = exports.SHARED_FORM_RUNTIME_BEHAVIOR_ID = void 0;
exports.planExistingDataverseForms = planExistingDataverseForms;
const common_1 = require("./common");
exports.SHARED_FORM_RUNTIME_BEHAVIOR_ID = 'dbm-shared-form-runtime';
exports.SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME = 'ys_/dbm/forms/runtime.js';
function escapeForJavaScriptString(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}
function sanitizeFunctionIdentifier(value) {
    const normalized = value.replace(/[^A-Za-z0-9_]/g, '_');
    return /^[A-Za-z_]/.test(normalized) ? normalized : `_${normalized}`;
}
function getDefaultFormStateId(model, formId) {
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
function buildFormLibrariesXml(libraries) {
    const libraryXml = libraries
        .map((library) => `    <Library name="${library.name}" libraryUniqueId="${library.libraryUniqueId}" />`)
        .join('\n');
    return `<formLibraries>\n${libraryXml}\n  </formLibraries>`;
}
function buildFormEventsXml(eventHandlers) {
    const onLoadHandlers = eventHandlers
        .filter((handler) => handler.eventName === 'onload')
        .map((handler) => `        <Handler functionName="${handler.functionName}" libraryName="${handler.libraryName}" handlerUniqueId="${handler.handlerUniqueId}" enabled="${handler.enabled}" passExecutionContext="${handler.passExecutionContext}" parameters="${handler.parameters}" />`)
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
function mapStateElementBehavior(state, elementId) {
    return state.elementBehaviors.find((entry) => entry.elementId === elementId);
}
function buildStatePlans(form, controlsByElementId) {
    const allControlNames = [...controlsByElementId.values()].map((control) => control.controlName);
    return form.formStates.map((state) => {
        const explicitElementIds = state.elementBehaviors.map((entry) => entry.elementId);
        const visibleControlNames = explicitElementIds.length > 0
            ? explicitElementIds
                .map((elementId) => controlsByElementId.get(elementId)?.controlName ?? null)
                .filter((value) => Boolean(value))
            : allControlNames;
        const requiredControlNames = [];
        const lockedControlNames = [];
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
function buildSharedRuntimeBehaviorContent() {
    return [
        '(function (global) {',
        "  const DBM = (global.DBM = global.DBM || {});",
        '  function getFormContext(executionContext) {',
        '    if (!executionContext) {',
        '      return null;',
        '    }',
        "    if (typeof executionContext.getFormContext === 'function') {",
        '      return executionContext.getFormContext();',
        '    }',
        '    return executionContext;',
        '  }',
        '  function getTab(formContext, tabName) {',
        '    return formContext?.ui?.tabs?.get ? formContext.ui.tabs.get(tabName) : null;',
        '  }',
        '  function getSection(formContext, tabName, sectionName) {',
        '    const tab = getTab(formContext, tabName);',
        "    return tab?.sections?.get ? tab.sections.get(sectionName) : null;",
        '  }',
        '  function getControl(formContext, controlName) {',
        '    return formContext?.getControl ? formContext.getControl(controlName) : null;',
        '  }',
        '  function setRequiredLevel(control, isRequired) {',
        '    if (typeof control?.getAttribute !== "function") {',
        '      return;',
        '    }',
        '    const attribute = control.getAttribute();',
        '    if (!attribute || typeof attribute.setRequiredLevel !== "function") {',
        '      return;',
        '    }',
        '    attribute.setRequiredLevel(isRequired ? "required" : "none");',
        '  }',
        '  function applyState(executionContext, config, activeStateId) {',
        '    const formContext = getFormContext(executionContext);',
        '    if (!formContext || !config) {',
        '      return;',
        '    }',
        '    const states = config.states || [];',
        '    const activeState = states.find((entry) => entry.id === activeStateId) || states[0] || null;',
        '    const visibleControls = new Set(activeState?.visibleControlNames || []);',
        '    const requiredControls = new Set(activeState?.requiredControlNames || []);',
        '    const lockedControls = new Set(activeState?.lockedControlNames || []);',
        '    (config.sections || []).forEach((sectionConfig) => {',
        '      const section = getSection(formContext, sectionConfig.tabName, sectionConfig.sectionName);',
        '      const tab = getTab(formContext, sectionConfig.tabName);',
        '      const hasVisibleControl = (sectionConfig.controls || []).some((control) => visibleControls.has(control.controlName));',
        '      if (section && typeof section.setVisible === "function") {',
        '        section.setVisible(hasVisibleControl);',
        '      }',
        '      if (tab && typeof tab.setVisible === "function") {',
        '        const tabHasVisibleControl = (config.sections || []).some((candidateSection) =>',
        '          candidateSection.tabName === sectionConfig.tabName &&',
        '          (candidateSection.controls || []).some((candidateControl) => visibleControls.has(candidateControl.controlName))',
        '        );',
        '        tab.setVisible(tabHasVisibleControl);',
        '      }',
        '      (sectionConfig.controls || []).forEach((controlConfig) => {',
        '        const control = getControl(formContext, controlConfig.controlName);',
        '        if (!control) {',
        '          return;',
        '        }',
        '        const shouldBeVisible = visibleControls.has(controlConfig.controlName);',
        '        if (typeof control.setVisible === "function") {',
        '          control.setVisible(shouldBeVisible);',
        '        }',
        '        if (!shouldBeVisible) {',
        '          setRequiredLevel(control, false);',
        '          return;',
        '        }',
        '        if (typeof control.setDisabled === "function") {',
        '          control.setDisabled(Boolean(controlConfig.readOnly) || lockedControls.has(controlConfig.controlName));',
        '        }',
        '        setRequiredLevel(control, requiredControls.has(controlConfig.controlName));',
        '      });',
        '    });',
        '  }',
        '  DBM.FormBehavior = {',
        '    apply: applyState',
        '  };',
        '})(window);',
        ''
    ].join('\n');
}
function buildFormConfigBehaviorContent(formPlan) {
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
        states: formPlan.states
    };
    return [
        '(function (global) {',
        `  const config = ${JSON.stringify(config, null, 2)};`,
        `  function ${onLoadFunctionName}(executionContext) {`,
        '    if (!global.DBM || !global.DBM.FormBehavior || typeof global.DBM.FormBehavior.apply !== "function") {',
        '      return;',
        '    }',
        '    global.DBM.FormBehavior.apply(executionContext, config, config.defaultStateId);',
        '  }',
        `  global.${onLoadFunctionName} = ${onLoadFunctionName};`,
        '})(window);',
        ''
    ].join('\n');
}
function resolveControlPlan(model, form, element, diagnostics) {
    const elementBinding = element.binding;
    if (!('entityBindingId' in elementBinding)) {
        diagnostics.push((0, common_1.createDiagnostic)('unsupported-variable-form-binding', 'error', `Form element '${element.id}' binds to a variable. R1 only supports existing Dataverse field controls on model-driven forms.`, `forms.${form.id}.elements.${element.id}`));
        return null;
    }
    const controlName = element.providerBindings?.dataverse?.controlName?.trim();
    if (!controlName) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-form-control-name', 'error', `Form element '${element.id}' is missing providerBindings.dataverse.controlName.`, `forms.${form.id}.elements.${element.id}`));
        return null;
    }
    const entityBinding = form.entityBindings.find((binding) => binding.id === elementBinding.entityBindingId);
    if (!entityBinding) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-form-entity-binding', 'error', `Form element '${element.id}' references missing entity binding '${elementBinding.entityBindingId}'.`, `forms.${form.id}.elements.${element.id}`));
        return null;
    }
    const entity = (0, common_1.getEntityById)(model, entityBinding.entityId);
    if (!entity) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-form-entity', 'error', `Form element '${element.id}' references missing entity '${entityBinding.entityId}'.`, `forms.${form.id}.elements.${element.id}`));
        return null;
    }
    const field = (0, common_1.getFieldById)(entity, elementBinding.fieldId);
    if (!field) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-form-field', 'error', `Form element '${element.id}' references missing field '${elementBinding.fieldId}'.`, `forms.${form.id}.elements.${element.id}`));
        return null;
    }
    let entityLogicalName;
    let dataFieldName;
    try {
        entityLogicalName = (0, common_1.getDataverseLogicalName)(entity, `entity '${entity.id}'`);
        dataFieldName = (0, common_1.getDataverseLogicalName)(field, `field '${field.id}'`);
    }
    catch (error) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-form-dataverse-binding', 'error', error instanceof Error ? error.message : `Dataverse bindings are missing for form element '${element.id}'.`, `forms.${form.id}.elements.${element.id}`));
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
function createFormPlan(model, form, entityPlans, diagnostics) {
    const formId = form.providerBindings?.dataverse?.formId?.trim() ?? '';
    if (!formId) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-form-id-binding', 'error', `Form '${form.id}' is missing providerBindings.dataverse.formId.`, `forms.${form.id}`));
    }
    const primaryBinding = form.entityBindings.find((binding) => binding.id === form.primaryEntityBindingId);
    if (!primaryBinding) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-primary-form-binding', 'error', `Form '${form.id}' is missing primary entity binding '${form.primaryEntityBindingId}'.`, `forms.${form.id}`));
    }
    else if (primaryBinding.role !== 'primary') {
        diagnostics.push((0, common_1.createDiagnostic)('non-primary-primary-binding', 'error', `Form '${form.id}' declares '${primaryBinding.id}' as the primary entity binding, but its role is '${primaryBinding.role}'.`, `forms.${form.id}.entityBindings.${primaryBinding.id}`));
    }
    const primaryEntityPlan = primaryBinding ? entityPlans.get(primaryBinding.entityId) : undefined;
    if (primaryBinding && !primaryEntityPlan) {
        diagnostics.push((0, common_1.createDiagnostic)('missing-primary-entity-plan', 'error', `Form '${form.id}' references unsupported primary entity '${primaryBinding.entityId}'.`, `forms.${form.id}`));
    }
    const controlsByRegionId = new Map();
    const controlsByElementId = new Map();
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
    const sections = form.layout.regions
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((region) => {
        const tabName = region.providerBindings?.dataverse?.tabName?.trim() ?? '';
        const sectionName = region.providerBindings?.dataverse?.sectionName?.trim() ?? '';
        if (!tabName || !sectionName) {
            diagnostics.push((0, common_1.createDiagnostic)('missing-form-region-binding', 'error', `Region '${region.id}' on form '${form.id}' is missing providerBindings.dataverse.tabName or sectionName.`, `forms.${form.id}.layout.regions.${region.id}`));
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
    const libraries = [
        {
            name: exports.SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME,
            libraryUniqueId: (0, common_1.createDeterministicGuid)(`${form.id}:runtime-library`)
        },
        {
            name: configWebResourceName,
            libraryUniqueId: (0, common_1.createDeterministicGuid)(`${form.id}:config-library`)
        }
    ];
    const eventHandlers = [
        {
            eventName: 'onload',
            functionName: configFunctionName,
            libraryName: configWebResourceName,
            handlerUniqueId: (0, common_1.createDeterministicGuid)(`${form.id}:onload-handler`),
            enabled: true,
            passExecutionContext: true,
            parameters: '',
            application: false,
            active: true,
            eventType: 'DataEvent'
        }
    ];
    const plan = {
        id: form.id,
        sourceFormId: form.id,
        sourceEntityBindingId: form.primaryEntityBindingId,
        kind: 'main',
        folder: 'main',
        displayName: form.displayName,
        entityId: primaryBinding?.entityId ?? '',
        entityLogicalName: primaryEntityPlan?.logicalName ?? '',
        systemFormId: formId,
        supported: Boolean(formId) &&
            Boolean(primaryBinding) &&
            primaryBinding?.role === 'primary' &&
            Boolean(primaryEntityPlan) &&
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
        configBehaviorId
    };
    if (!plan.supported && !plan.reason) {
        plan.reason = 'Form bindings are incomplete for the existing-form R1 synthesis path.';
    }
    return plan;
}
function planExistingDataverseForms(model, entityPlans, diagnostics) {
    const forms = model.forms.map((form) => createFormPlan(model, form, entityPlans, diagnostics));
    const behaviors = [
        {
            id: exports.SHARED_FORM_RUNTIME_BEHAVIOR_ID,
            kind: 'shared-runtime',
            displayName: 'DBM Form Behavior Runtime',
            webResourceName: exports.SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME,
            webResourceId: (0, common_1.createDeterministicGuid)(exports.SHARED_FORM_RUNTIME_WEB_RESOURCE_NAME),
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
            webResourceId: (0, common_1.createDeterministicGuid)(webResourceName),
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
