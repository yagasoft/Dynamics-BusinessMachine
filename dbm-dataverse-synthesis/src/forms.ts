import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  DbmFormElementV1,
  DbmFormStateV1,
  DbmModelV1
} from 'dbm-contract';
import type {
  DbmProcessExperienceHostConfigV1,
  DbmProcessExperienceNavigationTargetV1,
  DbmProcessExperienceRuntimeModelV1
} from 'dbm-process-experience' with { "resolution-mode": "import" };
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
export const SHARED_PROCESS_EXPERIENCE_RENDERER_BEHAVIOR_ID = 'dbm-process-experience-renderer';
export const SHARED_PROCESS_EXPERIENCE_RENDERER_WEB_RESOURCE_NAME = 'ys_/dbm/process-experience/renderer.js';
export const SHARED_PROCESS_EXPERIENCE_HOST_PAGE_BEHAVIOR_ID = 'dbm-process-experience-host-page';
export const SHARED_PROCESS_EXPERIENCE_HOST_PAGE_WEB_RESOURCE_NAME = 'ys_/dbm/process-experience/host.html';
export const HTML_WEB_RESOURCE_CLASS_ID = '{9FDF5F91-88B1-47f4-AD53-C11EFC01A01D}';
const SHARED_PROCESS_EXPERIENCE_SECTION_LABEL = 'DBM Process';
const HOSTED_DESIGNER_ENTRY_PATH = '/main.aspx?pagetype=webresource&webresourceName=ys_%2Fdbm%2Fapps%2Feditor%2Findex.html';
const PROCESS_HOST_MIN_HEIGHT_PX = 320;

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

function buildDesignerEntryUrl(packageId: string): string {
  return `${HOSTED_DESIGNER_ENTRY_PATH}&data=${encodeURIComponent(JSON.stringify({ packageName: packageId }))}`;
}

function buildBehaviorVersionKey(content: string): string {
  return createDeterministicGuid(content).replace(/[{}-]/g, '');
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

function buildProcessExperienceRuntimeModel(model: DbmModelV1): DbmProcessExperienceRuntimeModelV1 {
  return {
    packageId: model.package.id,
    packageVersion: model.package.version,
    processId: model.process.id,
    actors: model.process.actors.map((actor) => ({
      id: actor.id,
      displayName: actor.displayName,
      actorType: actor.actorType
    })),
    statuses: model.process.statuses.map((status) => ({
      id: status.id,
      displayName: status.displayName,
      audience: status.audience,
      kind: status.kind
    })),
    outcomes: model.process.outcomes.map((outcome) => ({
      id: outcome.id,
      displayName: outcome.displayName
    })),
    stages: model.process.stages.map((stage) => ({
      id: stage.id,
      displayName: stage.displayName,
      stageType: stage.stageType,
      actorId: stage.actorId,
      formId: stage.formId,
      portalVisibility: stage.portalVisibility,
      stepIds: [...stage.stepIds],
      defaultStepId: stage.defaultStepId,
      allowedOutcomeIds: [...stage.allowedOutcomeIds]
    })),
    steps: model.process.steps.map((step) => ({
      id: step.id,
      stageId: step.stageId,
      displayName: step.displayName,
      stepType: step.stepType,
      ownerActorId: step.ownerActorId,
      internalStatusId: step.internalStatusId,
      portalStatusId: step.portalStatusId,
      formStateId: step.formStateId
    })),
    transitions: model.process.transitions.map((transition) => ({
      id: transition.id,
      fromStageId: transition.fromStageId,
      toStageId: transition.toStageId,
      outcomeId: transition.outcomeId
    }))
  };
}

function buildStateJumpTarget(
  formPlan: Pick<DataverseFormPlan, 'sections' | 'states'>,
  state: DataverseFormStatePlan
): DbmProcessExperienceNavigationTargetV1 | null {
  const targetControlName = state.visibleControlNames[0] ?? null;
  if (!targetControlName) {
    return null;
  }

  const section = formPlan.sections.find((candidate) =>
    candidate.controls.some((control) => control.controlName === targetControlName)
  );

  if (!section) {
    return null;
  }

  return {
    label: state.displayName,
    tabName: section.tabName,
    sectionName: section.sectionName,
    controlName: targetControlName
  };
}

function buildProcessHostConfig(
  formPlan: Pick<DataverseFormPlan, 'id' | 'sections' | 'states'>,
  displayName: string,
  model: DbmModelV1,
  rendererVersionKey: string,
  hostPageVersionKey: string
): DbmProcessExperienceHostConfigV1 | null {
  const firstSection = formPlan.sections[0];
  if (!firstSection) {
    return null;
  }

  const safeFormId = sanitizeFunctionIdentifier(formPlan.id);
  const jumpTargetsByFormStateId = Object.fromEntries(
    formPlan.states
      .map((state) => {
        const target = buildStateJumpTarget(formPlan, state);
        return target ? [state.id, target] : null;
      })
      .filter((entry): entry is [string, DbmProcessExperienceNavigationTargetV1] => Boolean(entry))
  );

  return {
    packageId: model.package.id,
    processId: model.process.id,
    currentFormId: formPlan.id,
    designerEntryUrl: buildDesignerEntryUrl(model.package.id),
    supported: {
      placementMode: 'section',
      label: SHARED_PROCESS_EXPERIENCE_SECTION_LABEL,
      tabName: firstSection.tabName,
      sectionName: `dbm_process_host_${safeFormId}`,
      sectionId: createDeterministicGuid(`${formPlan.id}:process-host-section`),
      cellId: createDeterministicGuid(`${formPlan.id}:process-host-cell`),
      controlName: `WebResource_dbmProcessHost_${safeFormId}`,
      webResourceName: SHARED_PROCESS_EXPERIENCE_HOST_PAGE_WEB_RESOURCE_NAME,
      webResourceId: createDeterministicGuid(SHARED_PROCESS_EXPERIENCE_HOST_PAGE_WEB_RESOURCE_NAME),
      frameBridgeName: 'ProcessExperienceSectionFrame',
      minHeightPx: PROCESS_HOST_MIN_HEIGHT_PX,
      data: JSON.stringify({
        formId: formPlan.id,
        displayName,
        placement: 'section',
        minHeightPx: PROCESS_HOST_MIN_HEIGHT_PX,
        rendererVersion: rendererVersionKey,
        hostVersion: hostPageVersionKey
      })
    },
    overlay: {
      placementMode: 'overlay',
      enabled: true,
      containerId: `dbm-process-overlay-${safeFormId}`,
      capabilityGuard: 'best-effort-dom'
    },
    jumpTargetsByFormStateId
  };
}

function readSharedProcessExperienceRendererContent(): string {
  let packageRoot = __dirname;
  while (path.basename(packageRoot) !== 'dbm-dataverse-synthesis') {
    const parent = path.dirname(packageRoot);
    if (parent === packageRoot) {
      throw new Error('Unable to locate the dbm-dataverse-synthesis package root.');
    }

    packageRoot = parent;
  }

  const repoRoot = path.dirname(packageRoot);
  const bundlePath = path.join(repoRoot, 'dbm-process-experience', 'dist', 'browser', 'renderer.js');
  return readFileSync(bundlePath, 'utf8');
}

function buildProcessHostPageContent(): string {
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <title>DBM Process Experience</title>',
    '  <style>',
    '    html, body { margin: 0; padding: 0; }',
    '    body { overflow: hidden; background: transparent; font-family: Segoe UI, Arial, sans-serif; }',
    '    #dbm-process-host-root { width: 100%; }',
    '  </style>',
    '</head>',
    '<body>',
    '  <div id="dbm-process-host-root"></div>',
    '  <script>',
    '    (function () {',
    '      let resizeObserver = null;',
    '      let measureScheduled = false;',
    '      function getHostData() {',
    '        try {',
    '          const raw = new URLSearchParams(window.location.search).get(\'data\');',
    '          return raw ? JSON.parse(raw) : null;',
    '        } catch (error) {',
    '          return null;',
    '        }',
    '      }',
    '      function getClientUrl() {',
    '        return window.parent?.Xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.() || \'\';',
    '      }',
    '      function getMinimumHeight(hostData) {',
    '        const raw = Number(hostData?.minHeightPx);',
    '        return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;',
    '      }',
    '      function applyMeasuredHeight(heightPx) {',
    '        const nextHeight = Math.max(0, Math.round(heightPx));',
    '        if (!nextHeight) {',
    '          return;',
    '        }',
    '        const frame = window.frameElement;',
    '        if (!frame || typeof frame !== \'object\' || !(\'style\' in frame) || typeof frame.setAttribute !== \'function\') {',
    '          return;',
    '        }',
    '        const normalized = `${nextHeight}px`;',
    '        frame.setAttribute(\'height\', String(nextHeight));',
    '        frame.style.display = \'block\';',
    '        frame.style.height = normalized;',
    '        frame.style.minHeight = normalized;',
    '        frame.style.width = \'100%\';',
    '        frame.style.overflow = \'hidden\';',
    '        let current = frame.parentElement;',
    '        let depth = 0;',
    '        while (current && depth < 4) {',
    '          current.style.minHeight = normalized;',
    '          current.style.overflow = \'visible\';',
    '          if (depth < 2) {',
    '            current.style.height = normalized;',
    '          }',
    '          current = current.parentElement;',
    '          depth += 1;',
    '        }',
    '      }',
    '      function measureAndApplyHeight(root, hostData) {',
    '        if (!root) {',
    '          return;',
    '        }',
    '        root.style.minHeight = `${getMinimumHeight(hostData)}px`;',
    '        const measurements = [',
    '          root.scrollHeight,',
    '          root.offsetHeight,',
    '          root.getBoundingClientRect().height,',
    '          document.body?.scrollHeight || 0,',
    '          document.documentElement?.scrollHeight || 0',
    '        ].filter((value) => Number.isFinite(value) && value > 0);',
    '        const contentHeight = measurements.length > 0 ? Math.max.apply(Math, measurements) : 0;',
    '        const nextHeight = Math.max(getMinimumHeight(hostData), Math.ceil(contentHeight));',
    '        if (!nextHeight) {',
    '          return;',
    '        }',
    '        applyMeasuredHeight(nextHeight);',
    '      }',
    '      function scheduleMeasure(root, hostData) {',
    '        if (measureScheduled) {',
    '          return;',
    '        }',
    '        measureScheduled = true;',
    '        window.requestAnimationFrame(function () {',
    '          window.requestAnimationFrame(function () {',
    '            measureScheduled = false;',
    '            measureAndApplyHeight(root, hostData);',
    '          });',
    '        });',
    '      }',
    '      function bindAutoSizing(root, hostData) {',
    '        if (!root) {',
    '          return;',
    '        }',
    '        scheduleMeasure(root, hostData);',
    '        if (typeof ResizeObserver === \'function\') {',
    '          resizeObserver = new ResizeObserver(function () {',
    '            scheduleMeasure(root, hostData);',
    '          });',
    '          resizeObserver.observe(root);',
    '        }',
    '        window.addEventListener(\'resize\', function () {',
    '          scheduleMeasure(root, hostData);',
    '        });',
    '        window.setTimeout(function () {',
    '          scheduleMeasure(root, hostData);',
    '        }, 0);',
    '        window.setTimeout(function () {',
    '          scheduleMeasure(root, hostData);',
    '        }, 150);',
    '        window.setTimeout(function () {',
    '          scheduleMeasure(root, hostData);',
    '        }, 500);',
    '        if (document.fonts?.ready && typeof document.fonts.ready.then === \'function\') {',
    '          document.fonts.ready.then(function () {',
    '            scheduleMeasure(root, hostData);',
    '          }).catch(function () {});',
    '        }',
    '      }',
    '      function bootFrameBridge() {',
    '        if (!window.DBM || !window.DBM.ProcessExperienceHost) {',
    '          window.setTimeout(bootFrameBridge, 50);',
    '          return;',
    '        }',
    '        const root = document.getElementById(\'dbm-process-host-root\');',
    '        const hostData = getHostData();',
    '        bindAutoSizing(root, hostData);',
    '        window.DBM = window.DBM || {};',
    '        window.DBM.ProcessExperienceSectionFrame = {',
    '          render: function (props) {',
    '            window.DBM.ProcessExperienceHost.render(root, props);',
    '            scheduleMeasure(root, hostData);',
    '          },',
    '          unmount: function () {',
    '            window.DBM.ProcessExperienceHost.unmount(root);',
    '            if (resizeObserver) {',
    '              resizeObserver.disconnect();',
    '              resizeObserver = null;',
    '            }',
    '          }',
    '        };',
    '        scheduleMeasure(root, hostData);',
    '      }',
    '      function loadRenderer() {',
    '        const hostData = getHostData();',
    `        let scriptUrl = getClientUrl().replace(/\\/$/, '') + '/WebResources/${SHARED_PROCESS_EXPERIENCE_RENDERER_WEB_RESOURCE_NAME}';`,
    '        if (hostData?.rendererVersion) {',
    '          scriptUrl += \'?v=\' + encodeURIComponent(hostData.rendererVersion);',
    '        }',
    '        const script = document.createElement(\'script\');',
    '        script.src = scriptUrl;',
    '        script.onload = bootFrameBridge;',
    '        document.head.appendChild(script);',
    '      }',
    '      loadRenderer();',
    '    })();',
    '  </script>',
    '</body>',
    '</html>',
    ''
  ].join('\n');
}

function getFormPrimaryBinding(form: DbmModelV1['forms'][number]): DbmModelV1['forms'][number]['entityBindings'][number] | undefined {
  return form.entityBindings.find((binding) => binding.id === form.primaryEntityBindingId);
}

function getPrimaryIdLogicalName(entity: DbmModelV1['metadata']['entities'][number] | undefined, entityPlan: DataverseEntityPlan | undefined): string {
  const primaryIdFieldId = entity?.primaryKeyFieldId ?? null;
  const fieldLogicalName = primaryIdFieldId
    ? entity?.fields.find((field) => field.id === primaryIdFieldId)?.providerBindings.dataverse?.logicalName?.trim()
    : null;
  return fieldLogicalName || entityPlan?.primaryIdLogicalName || `${entityPlan?.logicalName ?? 'record'}id`;
}

function buildStageHandoffsByStageId(
  model: DbmModelV1,
  entityPlans: Map<string, DataverseEntityPlan>,
  diagnostics: DataverseSynthesisDiagnostic[]
) {
  const stageMap = new Map(model.process.stages.map((stage) => [stage.id, stage]));
  const stepMap = new Map(model.process.steps.map((step) => [step.id, step]));
  const formMap = new Map(model.forms.map((form) => [form.id, form]));
  const entityMap = new Map(model.metadata.entities.map((entity) => [entity.id, entity]));
  const handoffs: NonNullable<DataverseFormRuntimePlan['stageHandoffsByStageId']> = {};

  const registerHandoff = (
    sourceStageId: string,
    targetStageId: string,
    subjectHandoff: DbmModelV1['process']['transitions'][number]['subjectHandoff'] | DbmModelV1['process']['stepTransitions'][number]['subjectHandoff']
  ) => {
    if (!subjectHandoff) {
      return;
    }

    const sourceStage = stageMap.get(sourceStageId);
    const targetStage = stageMap.get(targetStageId);
    const sourceForm = sourceStage?.formId ? formMap.get(sourceStage.formId) : null;
    const targetForm = targetStage?.formId ? formMap.get(targetStage.formId) : null;
    const sourcePrimaryBinding = sourceForm ? getFormPrimaryBinding(sourceForm) : null;
    const targetPrimaryBinding = targetForm ? getFormPrimaryBinding(targetForm) : null;
    const sourceEntity = sourcePrimaryBinding ? entityMap.get(sourcePrimaryBinding.entityId) : null;
    const targetEntity = targetPrimaryBinding ? entityMap.get(targetPrimaryBinding.entityId) : null;
    const sourceEntityPlan = sourcePrimaryBinding ? entityPlans.get(sourcePrimaryBinding.entityId) : undefined;
    const targetEntityPlan = targetPrimaryBinding ? entityPlans.get(targetPrimaryBinding.entityId) : undefined;
    const relationship = subjectHandoff.relationshipId
      ? model.metadata.relationships.find((entry) => entry.id === subjectHandoff.relationshipId)
      : null;

    if (!sourceStage || !targetStage || !sourceEntityPlan || !targetEntityPlan || !sourceEntity || !targetEntity) {
      diagnostics.push(
        createDiagnostic(
          'missing-stage-handoff-binding',
          'error',
          `Target stage '${targetStageId}' could not resolve source/target entity bindings for runtime handoff.`,
          `process.stages.${targetStageId}`
        )
      );
      return;
    }

    const referencedEntity = relationship
      ? relationship.relationshipType === 'one-to-many'
        ? entityMap.get(relationship.fromEntityId)
        : entityMap.get(relationship.toEntityId)
      : null;
    const referencingEntity = relationship
      ? relationship.relationshipType === 'one-to-many'
        ? entityMap.get(relationship.toEntityId)
        : entityMap.get(relationship.fromEntityId)
      : null;
    const referencingField =
      relationship?.referencingFieldId && referencingEntity
        ? getFieldById(referencingEntity, relationship.referencingFieldId)
        : undefined;
    const referencingFieldDataverseBinding = referencingField?.providerBindings.dataverse as { logicalName?: string; schemaName?: string } | undefined;
    const referencingAttributeLogicalName = referencingFieldDataverseBinding?.logicalName?.trim() ?? null;
    const referencingFieldSchemaName = referencingFieldDataverseBinding?.schemaName?.trim() ?? null;
    const referencingFieldDisplayName = referencingField?.displayName?.trim() ?? null;
    const referencingNavigationPropertyName = referencingFieldSchemaName
      || (
        referencingFieldDisplayName &&
        referencingAttributeLogicalName &&
        referencingFieldDisplayName.toLowerCase() === referencingAttributeLogicalName.toLowerCase()
          ? referencingFieldDisplayName
          : null
      )
      || referencingAttributeLogicalName;

    const nextPlan = {
      sourceStageId,
      targetStageId,
      sourceEntityLogicalName: sourceEntityPlan.logicalName,
      targetEntityLogicalName: targetEntityPlan.logicalName,
      targetFormId: targetStage.formId,
      targetSystemFormId: targetForm?.providerBindings?.dataverse?.formId?.trim() ?? null,
      targetPrimaryIdLogicalName: getPrimaryIdLogicalName(targetEntity, targetEntityPlan),
      targetPrimaryNameLogicalName: targetEntityPlan.primaryNameAttributeLogicalName ?? null,
      strategy: subjectHandoff.strategy,
      relationshipId: subjectHandoff.relationshipId ?? null,
      relationshipLogicalName: relationship?.providerBindings.dataverse?.logicalName?.trim() ?? null,
      referencingEntityLogicalName: referencingEntity ? entityPlans.get(referencingEntity.id)?.logicalName ?? null : null,
      referencingAttributeLogicalName,
      referencingNavigationPropertyName
    };

    const current = handoffs[targetStageId];
    if (current && JSON.stringify(current) !== JSON.stringify(nextPlan)) {
      diagnostics.push(
        createDiagnostic(
          'conflicting-target-stage-handoff',
          'warning',
          `Target stage '${targetStageId}' is reached through conflicting cross-entity handoff definitions. The first definition will be used in the generated runtime.`,
          `process.stages.${targetStageId}`
        )
      );
      return;
    }

    handoffs[targetStageId] = nextPlan;
  };

  model.process.transitions.forEach((transition) => registerHandoff(transition.fromStageId, transition.toStageId, transition.subjectHandoff));
  model.process.stepTransitions.forEach((transition) => {
    if ('outcomeId' in transition.target) {
      return;
    }
    const sourceStageId = stepMap.get(transition.fromStepId)?.stageId ?? null;
    const targetStageId =
      'stageId' in transition.target
        ? transition.target.stageId
        : stepMap.get(transition.target.stepId)?.stageId ?? null;
    if (sourceStageId && targetStageId) {
      registerHandoff(sourceStageId, targetStageId, transition.subjectHandoff);
    }
  });

  return handoffs;
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
  const formPrimaryBinding = getFormPrimaryBinding(form);
  const currentFormEntity = formPrimaryBinding ? model.metadata.entities.find((entry) => entry.id === formPrimaryBinding.entityId) : null;

  const startStage = model.process.stages.find((stage) => stage.stageType === 'start') ?? model.process.stages[0];
  const defaultStepId = startStage?.defaultStepId ?? model.process.steps[0]?.id ?? '';
  const defaultStep = model.process.steps.find((step) => step.id === defaultStepId) ?? model.process.steps[0];

  const relatedProcessOwnerLookupFieldLogicalName =
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

  const valueBindings = buildRuntimeValueBindings(model);
  const processExperienceRuntime = buildProcessExperienceRuntimeModel(model);
  const stageHandoffsByStageId = buildStageHandoffsByStageId(model, entityPlans, diagnostics);

  return {
    processOwner: {
      entityId: runtimeOwnerEntityId,
      entityLogicalName: runtimeOwnerLogicalName,
      primaryIdLogicalName: getPrimaryIdLogicalName(runtimeOwnerMetadataEntity, runtimeOwnerEntityPlan),
      runtimeStateFieldLogicalNames
    },
    currentForm: {
      entityId: primaryEntityPlan.id,
      entityLogicalName: primaryEntityPlan.logicalName,
      primaryIdLogicalName: getPrimaryIdLogicalName(currentFormEntity ?? undefined, primaryEntityPlan),
      relatedProcessOwnerLookupFieldLogicalName
    },
    stageHandoffsByStageId,
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
      entityLogicalName:
        stage.formId
          ? (() => {
              const stageForm = model.forms.find((candidate) => candidate.id === stage.formId);
              const stagePrimaryBinding = stageForm ? getFormPrimaryBinding(stageForm) : null;
              return stagePrimaryBinding ? entityPlans.get(stagePrimaryBinding.entityId)?.logicalName ?? null : null;
            })()
          : null,
      systemFormId:
        stage.formId
          ? model.forms.find((form) => form.id === stage.formId)?.providerBindings?.dataverse?.formId?.trim() ?? null
          : null,
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
    transitions: model.process.transitions.map((transition) => ({
      id: transition.id,
      fromStageId: transition.fromStageId,
      toStageId: transition.toStageId,
      outcomeId: transition.outcomeId,
      guardRuleId: transition.guardRuleId
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
    valueBindings,
    processExperienceRuntime
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
  function normalizeStatusKey(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
  function resolveTerminalStatusId(runtime, stage, target) {
    const keys = [
      target?.outcomeId,
      stage?.id,
      stage?.displayName
    ]
      .map((value) => normalizeStatusKey(value))
      .filter(Boolean);
    if (keys.length === 0) {
      return null;
    }
    const match = (runtime.statuses || []).find((status) => {
      const statusId = normalizeStatusKey(status.id);
      const displayName = normalizeStatusKey(status.displayName);
      return keys.includes(statusId) || keys.includes(displayName);
    });
    return match?.id || null;
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
  function buildValueMap(runtime, processOwnerRecord, currentFormRecord, requestedOutcomeId) {
    const values = {};
    (runtime.valueBindings || []).forEach((binding) => {
      const source = binding.entityLogicalName === runtime.processOwner.entityLogicalName ? processOwnerRecord : currentFormRecord;
      values[binding.token] = getValueFromRecord(source, binding);
    });
    values.requestedOutcomeId = requestedOutcomeId || null;
    return values;
  }
  function overlayCurrentFormValues(formContext, runtime, currentFormRecord) {
    const projected = Object.assign({}, currentFormRecord || {});
    if (!formContext?.getAttribute) {
      return projected;
    }
    (runtime.valueBindings || [])
      .filter((binding) => binding.entityLogicalName === runtime.currentForm.entityLogicalName)
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
  function getRuntimeStateFromRecord(runtime, processOwnerRecord, config) {
    const fields = runtime.processOwner.runtimeStateFieldLogicalNames;
    const defaultState = getDefaultRuntimeState(runtime, config?.formId, config?.defaultStateId);
    if (!processOwnerRecord) {
      return defaultState;
    }
    return {
      stageId: processOwnerRecord[fields.stageId] || defaultState.stageId,
      stepId: processOwnerRecord[fields.stepId] || defaultState.stepId,
      formStateId: processOwnerRecord[fields.formStateId] || defaultState.formStateId,
      internalStatusId: processOwnerRecord[fields.internalStatusId] || defaultState.internalStatusId,
      portalStatusId: processOwnerRecord[fields.portalStatusId] || defaultState.portalStatusId
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
      const terminalStatusId = !nextStep && nextStage?.stageType === 'end'
        ? resolveTerminalStatusId(runtime, nextStage, target)
        : null;
      return {
        stageId: target.stageId,
        stepId: nextStep?.id || currentState.stepId,
        formStateId: nextStep?.formStateId || currentState.formStateId,
        internalStatusId: nextStep?.internalStatusId || terminalStatusId || currentState.internalStatusId,
        portalStatusId: nextStep?.portalStatusId || terminalStatusId || currentState.portalStatusId
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
      const currentStage = getStage(runtime, nextState.stageId);
      const stepTransition = currentStep
        ? (runtime.stepTransitions || [])
            .filter((candidate) => candidate.fromStepId === currentStep.id)
            .find((candidate) => evaluateExpression(runtime.rules[candidate.guardRuleId], values))
        : null;
      const stageTransition =
        !stepTransition && currentStage && values.requestedOutcomeId
          ? (runtime.transitions || [])
              .filter(
                (candidate) =>
                  candidate.fromStageId === currentStage.id &&
                  candidate.outcomeId === values.requestedOutcomeId
              )
              .find((candidate) => evaluateExpression(runtime.rules[candidate.guardRuleId], values))
          : null;
      const target = stepTransition
        ? (stepTransition.target || {})
        : stageTransition
          ? { stageId: stageTransition.toStageId, outcomeId: stageTransition.outcomeId }
          : null;
      if (!target) {
        break;
      }
      const derived = deriveStateFromTarget(runtime, nextState, target);
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
        text: 'Process moved to ' + (getStage(runtime, nextState.stageId)?.displayName || nextState.stageId) + '.'
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
      headers: {
        ...createHeaders(),
        Prefer: 'return=representation'
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error('Failed to create related ' + entityLogicalName + ' record: ' + (body || response.status));
    }
    const created = await response.json().catch(() => null);
    if (created) {
      return created;
    }
    const entityIdHeader = response.headers?.get?.('OData-EntityId') || response.headers?.get?.('odata-entityid') || '';
    const match = /\\(([0-9a-fA-F-]{36})\\)/.exec(entityIdHeader);
    return match ? { id: match[1] } : null;
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
  function getRecordIdFromLookupValue(value) {
    if (Array.isArray(value) && value[0]?.id) {
      return normalizeId(value[0].id);
    }
    if (value && typeof value === 'object' && value.id) {
      return normalizeId(value.id);
    }
    return normalizeId(value);
  }
  function getRecordIdFromAttribute(formContext, logicalName) {
    if (!formContext?.getAttribute || !logicalName) {
      return '';
    }
    const attribute = formContext.getAttribute(logicalName);
    if (!attribute || typeof attribute.getValue !== 'function') {
      return '';
    }
    return getRecordIdFromLookupValue(attribute.getValue());
  }
  function getLookupValueFromRecord(record, logicalName) {
    if (!record || !logicalName) {
      return '';
    }
    return normalizeId(record['_' + logicalName + '_value'] || record[logicalName]);
  }
  function getEntityCollectionName(entityLogicalName) {
    return entityLogicalName ? entityLogicalName + 's' : '';
  }
  function buildEntityBind(entityLogicalName, recordId) {
    const collectionName = getEntityCollectionName(entityLogicalName);
    return collectionName && recordId ? '/' + collectionName + '(' + recordId + ')' : '';
  }
  function getCreatedRecordId(record, primaryIdLogicalName, entityLogicalName) {
    if (!record) {
      return '';
    }
    return normalizeId(record[primaryIdLogicalName] || record[entityLogicalName + 'id'] || record.id);
  }
  function buildGeneratedRelatedRecordName(handoff, sourceRecordId) {
    const suffix = normalizeId(sourceRecordId).replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'record';
    const entityLabel = (handoff?.targetEntityLogicalName || 'related-record').replace(/_/g, ' ');
    return entityLabel + ' ' + suffix;
  }
  function getProcessOwnerRecordId(formContext, runtime, currentRecordId, currentFormRecord) {
    if (runtime.currentForm.entityLogicalName === runtime.processOwner.entityLogicalName) {
      return currentRecordId;
    }
    return getRecordIdFromAttribute(formContext, runtime.currentForm.relatedProcessOwnerLookupFieldLogicalName)
      || getLookupValueFromRecord(currentFormRecord, runtime.currentForm.relatedProcessOwnerLookupFieldLogicalName);
  }
  function getSourceRecordId(handoff, runtime, currentRecordId, processOwnerRecordId) {
    if (!handoff) {
      return '';
    }
    if (handoff.sourceEntityLogicalName === runtime.currentForm.entityLogicalName) {
      return currentRecordId;
    }
    if (handoff.sourceEntityLogicalName === runtime.processOwner.entityLogicalName) {
      return processOwnerRecordId;
    }
    return '';
  }
  async function selectExistingRelatedRecord(handoff, runtime, sourceRecordId, currentFormRecord, processOwnerRecord) {
    if (!handoff || !sourceRecordId) {
      return '';
    }
    if (handoff.referencingEntityLogicalName === handoff.targetEntityLogicalName) {
      if (!handoff.referencingAttributeLogicalName) {
        return '';
      }
      const existing = await retrieveMultiple(
        handoff.targetEntityLogicalName,
        '?$select=' + [handoff.targetPrimaryIdLogicalName, handoff.referencingAttributeLogicalName].filter(Boolean).join(',') +
          '&$filter=_' + handoff.referencingAttributeLogicalName + '_value eq ' + sourceRecordId
      );
      if (existing.length === 0) {
        return '';
      }
      if (existing.length === 1 || typeof global.Xrm?.Utility?.lookupObjects !== 'function') {
        return getCreatedRecordId(existing[0], handoff.targetPrimaryIdLogicalName, handoff.targetEntityLogicalName);
      }
      try {
        const choices = await global.Xrm.Utility.lookupObjects({
          allowMultiSelect: false,
          defaultEntityType: handoff.targetEntityLogicalName,
          entityTypes: [handoff.targetEntityLogicalName],
          filters: [
            {
              entityLogicalName: handoff.targetEntityLogicalName,
              filterXml:
                '<filter><condition attribute="' +
                handoff.referencingAttributeLogicalName +
                '" operator="eq" value="' +
                sourceRecordId +
                '" /></filter>'
            }
          ]
        });
        return getRecordIdFromLookupValue(choices);
      } catch {
        return getCreatedRecordId(existing[0], handoff.targetPrimaryIdLogicalName, handoff.targetEntityLogicalName);
      }
    }
    const sourceRecord =
      handoff.sourceEntityLogicalName === runtime.currentForm.entityLogicalName
        ? currentFormRecord
        : processOwnerRecord;
    return getLookupValueFromRecord(sourceRecord, handoff.referencingAttributeLogicalName);
  }
  async function createRelatedTargetRecord(handoff, sourceRecordId) {
    if (!handoff || !sourceRecordId) {
      return '';
    }
    const payload = {};
    const bindPropertyName = handoff.referencingNavigationPropertyName || handoff.referencingAttributeLogicalName;
    if (handoff.targetPrimaryNameLogicalName) {
      payload[handoff.targetPrimaryNameLogicalName] = buildGeneratedRelatedRecordName(handoff, sourceRecordId);
    }
    if (handoff.referencingEntityLogicalName === handoff.targetEntityLogicalName) {
      if (bindPropertyName) {
        payload[bindPropertyName + '@odata.bind'] = buildEntityBind(handoff.sourceEntityLogicalName, sourceRecordId);
      }
      const created = await createRecord(handoff.targetEntityLogicalName, payload);
      return getCreatedRecordId(created, handoff.targetPrimaryIdLogicalName, handoff.targetEntityLogicalName);
    }
    const created = await createRecord(handoff.targetEntityLogicalName, payload);
    const targetRecordId = getCreatedRecordId(created, handoff.targetPrimaryIdLogicalName, handoff.targetEntityLogicalName);
    if (!targetRecordId || !bindPropertyName) {
      return targetRecordId;
    }
    const sourcePayload = {};
    sourcePayload[bindPropertyName + '@odata.bind'] = buildEntityBind(handoff.targetEntityLogicalName, targetRecordId);
    await updateRecord(handoff.sourceEntityLogicalName, sourceRecordId, sourcePayload);
    return targetRecordId;
  }
  async function resolveTargetRecordId(runtime, handoff, currentRecordId, processOwnerRecordId, currentFormRecord, processOwnerRecord) {
    if (!handoff) {
      return '';
    }
    if (handoff.targetEntityLogicalName === runtime.currentForm.entityLogicalName) {
      return currentRecordId;
    }
    if (handoff.targetEntityLogicalName === runtime.processOwner.entityLogicalName) {
      return processOwnerRecordId;
    }
    const sourceRecordId = getSourceRecordId(handoff, runtime, currentRecordId, processOwnerRecordId);
    if (!sourceRecordId) {
      return '';
    }
    if (handoff.strategy === 'select-existing-related') {
      return await selectExistingRelatedRecord(handoff, runtime, sourceRecordId, currentFormRecord, processOwnerRecord);
    }
    if (handoff.strategy === 'create-related') {
      return await createRelatedTargetRecord(handoff, sourceRecordId);
    }
    return '';
  }
  async function openTargetForm(entityLogicalName, recordId, systemFormId) {
    if (!entityLogicalName || !recordId || !systemFormId || typeof global.Xrm?.Navigation?.openForm !== 'function') {
      return false;
    }
    await global.Xrm.Navigation.openForm({
      entityName: entityLogicalName,
      entityId: recordId,
      formId: systemFormId,
      openInNewWindow: false
    });
    return true;
  }
  async function navigateToActiveStage(runtime, activeStage, currentRecordId, processOwnerRecordId, currentFormRecord, processOwnerRecord) {
    if (!activeStage?.formId || !activeStage.entityLogicalName || !activeStage.systemFormId) {
      return false;
    }
    let targetRecordId = '';
    if (activeStage.entityLogicalName === runtime.currentForm.entityLogicalName) {
      targetRecordId = currentRecordId;
    } else if (activeStage.entityLogicalName === runtime.processOwner.entityLogicalName) {
      targetRecordId = processOwnerRecordId;
    } else {
      const handoff = runtime.stageHandoffsByStageId?.[activeStage.id] || null;
      targetRecordId = await resolveTargetRecordId(runtime, handoff, currentRecordId, processOwnerRecordId, currentFormRecord, processOwnerRecord);
    }
    return await openTargetForm(activeStage.entityLogicalName, targetRecordId, activeStage.systemFormId);
  }
  async function resolveActiveStageNavigation(runtime, activeStage, currentFormId, currentRecordId, processOwnerRecordId, currentFormRecord, processOwnerRecord) {
    if (!activeStage?.formId || activeStage.formId === currentFormId) {
      return null;
    }
    let targetRecordId = '';
    if (activeStage.entityLogicalName === runtime.currentForm.entityLogicalName) {
      targetRecordId = currentRecordId;
    } else if (activeStage.entityLogicalName === runtime.processOwner.entityLogicalName) {
      targetRecordId = processOwnerRecordId;
    } else {
      const handoff = runtime.stageHandoffsByStageId?.[activeStage.id] || null;
      targetRecordId = await resolveTargetRecordId(runtime, handoff, currentRecordId, processOwnerRecordId, currentFormRecord, processOwnerRecord);
    }
    if (!targetRecordId) {
      return null;
    }
    return {
      entityLogicalName: activeStage.entityLogicalName,
      recordId: targetRecordId,
      systemFormId: activeStage.systemFormId
    };
  }
  function applyOutcomeSelection(formContext, runtime, outcomeId) {
    const candidate = (runtime.valueBindings || []).find((binding) => {
      if (binding.entityLogicalName !== runtime.currentForm.entityLogicalName || !binding.choiceMap) {
        return false;
      }
      return Object.values(binding.choiceMap).includes(outcomeId) && !!formContext?.getAttribute?.(binding.fieldLogicalName);
    });
    if (!candidate?.choiceMap) {
      return false;
    }
    const optionValueEntry = Object.entries(candidate.choiceMap).find((entry) => entry[1] === outcomeId);
    if (!optionValueEntry) {
      return false;
    }
    const attribute = formContext?.getAttribute?.(candidate.fieldLogicalName);
    if (!attribute || typeof attribute.setValue !== 'function') {
      return false;
    }
    const rawValue = optionValueEntry[0];
    const numericValue = Number(rawValue);
    attribute.setValue(Number.isNaN(numericValue) ? rawValue : numericValue);
    if (typeof attribute.fireOnChange === 'function') {
      attribute.fireOnChange();
    }
    return true;
  }
  function resolveDesignerEntryUrl(config) {
    const fallback = config?.processHost?.designerEntryUrl || null;
    const clientUrl = global.Xrm?.Utility?.getGlobalContext?.()?.getClientUrl?.() || '';
    if (fallback && clientUrl && fallback.charAt(0) === '/') {
      return clientUrl.replace(/\\/$/, '') + fallback;
    }
    return fallback;
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
      designerEntryUrl: resolveDesignerEntryUrl(config),
      navigationTarget,
      onNavigateToFormRegion: function (target) {
        focusNavigationTarget(formContext, target);
      },
      onInvokeOutcome: function (outcomeId) {
        applyOutcomeSelection(formContext, config.runtime, outcomeId);
        void sync(formContext, config, outcomeId);
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
  function selectFields(runtime, entityLogicalName) {
    const fields = [];
    (runtime.valueBindings || [])
      .filter((binding) => binding.entityLogicalName === entityLogicalName)
      .forEach((binding) => fields.push(binding.fieldLogicalName));
    if (entityLogicalName === runtime.processOwner.entityLogicalName) {
      const stateFields = runtime.processOwner.runtimeStateFieldLogicalNames;
      fields.push(stateFields.stageId, stateFields.stepId, stateFields.formStateId, stateFields.internalStatusId, stateFields.portalStatusId);
    }
    if (entityLogicalName === runtime.currentForm.entityLogicalName && runtime.currentForm.relatedProcessOwnerLookupFieldLogicalName) {
      fields.push(runtime.currentForm.relatedProcessOwnerLookupFieldLogicalName);
    }
    Object.values(runtime.stageHandoffsByStageId || {}).forEach((handoff) => {
      if (handoff.referencingEntityLogicalName === entityLogicalName && handoff.referencingAttributeLogicalName) {
        fields.push(handoff.referencingAttributeLogicalName);
      }
    });
    return Array.from(new Set(fields.filter(Boolean)));
  }
  async function sync(executionContext, config, requestedOutcomeId) {
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
    if (requestedOutcomeId) {
      applyOutcomeSelection(formContext, runtime, requestedOutcomeId);
    }
    const currentFormRecord = await retrieveRecord(
      runtime.currentForm.entityLogicalName,
      currentRecordId,
      selectFields(runtime, runtime.currentForm.entityLogicalName)
    );
    const processOwnerRecordId = getProcessOwnerRecordId(formContext, runtime, currentRecordId, currentFormRecord);
    const processOwnerRecord = processOwnerRecordId
      ? runtime.currentForm.entityLogicalName === runtime.processOwner.entityLogicalName && processOwnerRecordId === currentRecordId
        ? currentFormRecord
        : await retrieveRecord(
            runtime.processOwner.entityLogicalName,
            processOwnerRecordId,
            selectFields(runtime, runtime.processOwner.entityLogicalName)
          )
      : null;
    const projectedCurrentFormRecord = overlayCurrentFormValues(formContext, runtime, currentFormRecord);
    const values = buildValueMap(runtime, processOwnerRecord, projectedCurrentFormRecord, requestedOutcomeId || null);
    const currentState = getRuntimeStateFromRecord(runtime, processOwnerRecord, config);
    const result = evaluate(runtime, values, currentState, 'dbm-runtime-' + processOwnerRecordId + '-' + currentRecordId);
    const activeStage = getStage(runtime, result.state.stageId);
    let navigationError = null;
    let navigationTarget = null;
    if (activeStage?.formId && activeStage.formId !== config.formId) {
      try {
        navigationTarget = await resolveActiveStageNavigation(
          runtime,
          activeStage,
          config.formId,
          currentRecordId,
          processOwnerRecordId,
          projectedCurrentFormRecord,
          processOwnerRecord
        );
      } catch (error) {
        navigationError = error;
      }
    }
    const effectiveResult =
      activeStage?.formId && activeStage.formId !== config.formId && !navigationTarget
        ? {
            ...result,
            status: 'error',
            state: currentState,
            messages: [
              ...(result.messages || []),
              {
                level: 'error',
                code: 'handoff-target-resolution-failed',
                text: navigationError?.message || 'DBM could not create or locate the next related record.'
              }
            ]
          }
        : result;
    const effectiveActiveStage = getStage(runtime, effectiveResult.state.stageId);
    if (processOwnerRecordId) {
      const stateFields = runtime.processOwner.runtimeStateFieldLogicalNames;
      const payload = {};
      payload[stateFields.stageId] = effectiveResult.state.stageId;
      payload[stateFields.stepId] = effectiveResult.state.stepId;
      payload[stateFields.formStateId] = effectiveResult.state.formStateId;
      payload[stateFields.internalStatusId] = effectiveResult.state.internalStatusId;
      payload[stateFields.portalStatusId] = effectiveResult.state.portalStatusId;
      await updateRecord(runtime.processOwner.entityLogicalName, processOwnerRecordId, payload);
    }
    if (effectiveActiveStage?.formId && effectiveActiveStage.formId !== config.formId) {
      applyInactiveState(executionContext, config);
    } else {
      applyState(executionContext, config, effectiveResult.state.formStateId || config.defaultStateId);
    }
    await renderProcessExperience(formContext, config, effectiveResult);
    if (navigationTarget) {
      await openTargetForm(navigationTarget.entityLogicalName, navigationTarget.recordId, navigationTarget.systemFormId);
    }
    return effectiveResult;
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
    runtime: formPlan.runtime,
    processHost: formPlan.processHost
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
  diagnostics: DataverseSynthesisDiagnostic[],
  rendererVersionKey: string,
  hostPageVersionKey: string
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
      name: SHARED_PROCESS_EXPERIENCE_RENDERER_WEB_RESOURCE_NAME,
      libraryUniqueId: createDeterministicGuid(`${form.id}:process-renderer-library`)
    },
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
  const states = buildStatePlans(form, controlsByElementId);
  const processHost = buildProcessHostConfig(
    {
      id: form.id,
      sections,
      states
    },
    form.displayName,
    model,
    rendererVersionKey,
    hostPageVersionKey
  );

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
      Boolean(processHost) &&
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
    states,
    configBehaviorId,
    runtime: runtimePlan,
    processHost
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
  const rendererContent = readSharedProcessExperienceRendererContent();
  const rendererVersionKey = buildBehaviorVersionKey(`${SHARED_PROCESS_EXPERIENCE_RENDERER_WEB_RESOURCE_NAME}:${rendererContent}`);
  const hostPageContent = buildProcessHostPageContent();
  const hostPageVersionKey = buildBehaviorVersionKey(`${SHARED_PROCESS_EXPERIENCE_HOST_PAGE_WEB_RESOURCE_NAME}:${hostPageContent}`);
  const forms = model.forms.map((form) => createFormPlan(model, form, entityPlans, diagnostics, rendererVersionKey, hostPageVersionKey));

  const behaviors: DataverseBehaviorPlan[] = [
    {
      id: SHARED_PROCESS_EXPERIENCE_RENDERER_BEHAVIOR_ID,
      kind: 'process-renderer',
      displayName: 'DBM Process Experience Renderer',
      webResourceName: SHARED_PROCESS_EXPERIENCE_RENDERER_WEB_RESOURCE_NAME,
      webResourceId: createDeterministicGuid(SHARED_PROCESS_EXPERIENCE_RENDERER_WEB_RESOURCE_NAME),
      supported: true,
      reason: null,
      webResourceType: 3,
      relativePath: 'src/WebResources/ys_/dbm/process-experience/renderer.js',
      content: rendererContent,
      attachedFormIds: forms.filter((form) => form.supported).map((form) => form.id)
    },
    {
      id: SHARED_PROCESS_EXPERIENCE_HOST_PAGE_BEHAVIOR_ID,
      kind: 'process-host-page',
      displayName: 'DBM Process Experience Host Page',
      webResourceName: SHARED_PROCESS_EXPERIENCE_HOST_PAGE_WEB_RESOURCE_NAME,
      webResourceId: createDeterministicGuid(SHARED_PROCESS_EXPERIENCE_HOST_PAGE_WEB_RESOURCE_NAME),
      supported: true,
      reason: null,
      webResourceType: 1,
      relativePath: 'src/WebResources/ys_/dbm/process-experience/host.html',
      content: hostPageContent,
      attachedFormIds: forms.filter((form) => form.supported).map((form) => form.id)
    },
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
