import type {
  DbmDesignerGraphDocumentV1,
  DbmDesignerGraphEdgeV1,
  DbmDesignerGraphGroupV1,
  DbmDesignerGraphNodeKindV1,
  DbmDesignerGraphNodeV1,
  DbmDesignerGraphPortV1,
  DbmModelV1,
  DbmOutcomeV1,
  DbmProcessV1,
  DbmStageV1,
  DbmStepV1,
  DbmStepTransitionV1
} from 'dbm-contract';
import {
  outcomeNodeId,
  parseProcessScopedNodeId,
  processOutcomesNodeId,
  processStagesNodeId,
  processStepTransitionsNodeId,
  processTransitionsNodeId,
  stageNodeId,
  stageStepsNodeId,
  stepNodeId,
  stepTransitionNodeId,
  transitionNodeId
} from './node-ids';
import { addNode, moveNode, removeNode, updateNode } from './commands';
import {
  findProcess,
  resolveMainProcess,
  uniqueId
} from './portfolio';
import type {
  DesignerClipboardPayload,
  DesignerCommand,
  DesignerCommandResult,
  DesignerDocument,
  DesignerGraphConnectionTarget,
  DesignerGraphIntent,
  DesignerIssue
} from './types';

function issue(level: DesignerIssue['level'], code: string, message: string, path: string, nodeId?: string): DesignerIssue {
  return { level, code, message, path, nodeId };
}

export function graphActorGroupId(processId: string, actorId: string): string {
  return `group:actor:${processId}:${actorId}`;
}

export function graphStageInPortId(processId: string, stageId: string): string {
  return `port:stage:${processId}:${stageId}:in`;
}

export function graphStageOutcomePortId(processId: string, stageId: string, outcomeId: string): string {
  return `port:stage:${processId}:${stageId}:outcome:${outcomeId}`;
}

export function graphStepInPortId(processId: string, stepId: string): string {
  return `port:step:${processId}:${stepId}:in`;
}

export function graphStepOutPortId(processId: string, stepId: string): string {
  return `port:step:${processId}:${stepId}:out`;
}

export function graphOutcomeInPortId(processId: string, outcomeId: string): string {
  return `port:outcome:${processId}:${outcomeId}:in`;
}

export function isStableDesignerGraphNodeId(nodeId: string): boolean {
  return nodeId.startsWith('stage:') || nodeId.startsWith('step:') || nodeId.startsWith('outcome:');
}

function buildStagePorts(process: DbmProcessV1, stageId: string): DbmDesignerGraphPortV1[] {
  const outcomeMap = new Map(process.outcomes.map((outcome) => [outcome.id, outcome]));
  const outcomeIds = new Set<string>();
  const stage = process.stages.find((entry) => entry.id === stageId);
  stage?.allowedOutcomeIds.forEach((outcomeId) => outcomeIds.add(outcomeId));
  process.transitions
    .filter((transition) => transition.fromStageId === stageId)
    .forEach((transition) => outcomeIds.add(transition.outcomeId));

  return [
    {
      id: graphStageInPortId(process.id, stageId),
      label: null,
      direction: 'in',
      role: 'primary-in'
    },
    ...[...outcomeIds]
      .sort((left, right) => left.localeCompare(right))
      .map((outcomeId) => ({
        id: graphStageOutcomePortId(process.id, stageId, outcomeId),
        label: outcomeMap.get(outcomeId)?.displayName ?? outcomeId,
        direction: 'out' as const,
        role: 'outcome' as const
      }))
  ];
}

function buildStepPorts(processId: string, stepId: string): DbmDesignerGraphPortV1[] {
  return [
    {
      id: graphStepInPortId(processId, stepId),
      label: null,
      direction: 'in',
      role: 'primary-in'
    },
    {
      id: graphStepOutPortId(processId, stepId),
      label: null,
      direction: 'out',
      role: 'primary-out'
    }
  ];
}

function buildOutcomePorts(processId: string, outcomeId: string): DbmDesignerGraphPortV1[] {
  return [
    {
      id: graphOutcomeInPortId(processId, outcomeId),
      label: null,
      direction: 'in',
      role: 'primary-in'
    }
  ];
}

function resolveStepTransitionTarget(process: DbmProcessV1, transition: DbmStepTransitionV1): { targetNodeId: string; targetPortId: string; outcomeId?: string } {
  if ('stepId' in transition.target) {
    return {
      targetNodeId: stepNodeId(process.id, transition.target.stepId),
      targetPortId: graphStepInPortId(process.id, transition.target.stepId)
    };
  }

  if ('stageId' in transition.target) {
    return {
      targetNodeId: stageNodeId(process.id, transition.target.stageId),
      targetPortId: graphStageInPortId(process.id, transition.target.stageId)
    };
  }

  return {
    targetNodeId: outcomeNodeId(process.id, transition.target.outcomeId),
    targetPortId: graphOutcomeInPortId(process.id, transition.target.outcomeId),
    outcomeId: transition.target.outcomeId
  };
}

function outcomeLabel(outcome: DbmOutcomeV1 | undefined): string | null {
  return outcome?.displayName ?? null;
}

function buildProcessGroups(process: DbmProcessV1): DbmDesignerGraphGroupV1[] {
  return process.actors.map((actor) => ({
    id: graphActorGroupId(process.id, actor.id),
    kind: 'actor-lane',
    label: `${process.displayName} / ${actor.displayName}`,
    parentGroupId: null,
    semanticRef: {
      processId: process.id,
      actorId: actor.id
    }
  }));
}

function buildProcessNodes(process: DbmProcessV1): DbmDesignerGraphNodeV1[] {
  return [
    ...process.stages.map((stage) => ({
      id: stageNodeId(process.id, stage.id),
      kind: 'stage' as DbmDesignerGraphNodeKindV1,
      label: stage.displayName,
      parentNodeId: null,
      groupId: stage.actorId ? graphActorGroupId(process.id, stage.actorId) : null,
      semanticRef: {
        processId: process.id,
        stageId: stage.id,
        actorId: stage.actorId
      },
      ports: buildStagePorts(process, stage.id)
    })),
    ...process.steps.map((step) => ({
      id: stepNodeId(process.id, step.id),
      kind: 'step' as DbmDesignerGraphNodeKindV1,
      label: step.displayName,
      parentNodeId: stageNodeId(process.id, step.stageId),
      groupId: null,
      semanticRef: {
        processId: process.id,
        stageId: step.stageId,
        stepId: step.id
      },
      ports: buildStepPorts(process.id, step.id)
    })),
    ...process.outcomes.map((outcome) => ({
      id: outcomeNodeId(process.id, outcome.id),
      kind: 'outcome' as DbmDesignerGraphNodeKindV1,
      label: outcome.displayName,
      parentNodeId: null,
      groupId: null,
      semanticRef: {
        processId: process.id,
        outcomeId: outcome.id
      },
      ports: buildOutcomePorts(process.id, outcome.id)
    }))
  ];
}

function buildProcessEdges(process: DbmProcessV1): DbmDesignerGraphEdgeV1[] {
  const outcomeMap = new Map(process.outcomes.map((outcome) => [outcome.id, outcome]));
  return [
    ...process.transitions.map((transition) => ({
      id: transitionNodeId(process.id, transition.id),
      kind: 'stage-transition' as const,
      label: outcomeLabel(outcomeMap.get(transition.outcomeId)),
      sourceNodeId: stageNodeId(process.id, transition.fromStageId),
      sourcePortId: graphStageOutcomePortId(process.id, transition.fromStageId, transition.outcomeId),
      targetNodeId: stageNodeId(process.id, transition.toStageId),
      targetPortId: graphStageInPortId(process.id, transition.toStageId),
      semanticRef: {
        processId: process.id,
        transitionId: transition.id,
        outcomeId: transition.outcomeId
      }
    })),
    ...process.stepTransitions.map((transition) => {
      const target = resolveStepTransitionTarget(process, transition);
      return {
        id: stepTransitionNodeId(process.id, transition.id),
        kind: 'step-transition' as const,
        label: target.outcomeId ? outcomeLabel(outcomeMap.get(target.outcomeId)) : null,
        sourceNodeId: stepNodeId(process.id, transition.fromStepId),
        sourcePortId: graphStepOutPortId(process.id, transition.fromStepId),
        targetNodeId: target.targetNodeId,
        targetPortId: target.targetPortId,
        semanticRef: {
          processId: process.id,
          stepTransitionId: transition.id,
          outcomeId: target.outcomeId
        }
      };
    })
  ];
}

export function buildDesignerGraphDocument(model: DbmModelV1): DbmDesignerGraphDocumentV1 {
  const mainProcess = (() => {
    try {
      return resolveMainProcess(model);
    } catch {
      return model.processPortfolio.processes[0] ?? null;
    }
  })();
  return {
    schemaVersion: 'dbm.designer.graph-document/v1',
    packageId: model.package.id,
    packageVersion: model.package.version,
    processId: mainProcess?.id ?? model.processPortfolio.mainProcessId,
    groups: model.processPortfolio.processes.flatMap((process) => buildProcessGroups(process)),
    nodes: model.processPortfolio.processes.flatMap((process) => buildProcessNodes(process)),
    edges: model.processPortfolio.processes.flatMap((process) => buildProcessEdges(process))
  };
}

function addDuplicateIdIssues(issues: DesignerIssue[], ids: string[], code: string, pathPrefix: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  ids.forEach((id) => {
    if (seen.has(id)) {
      duplicates.add(id);
      return;
    }
    seen.add(id);
  });
  duplicates.forEach((duplicate) => {
    issues.push(issue('error', code, `Duplicate identifier '${duplicate}' is not allowed.`, `${pathPrefix}/${duplicate}`, duplicate));
  });
}

export function validateDesignerGraphDocument(graph: DbmDesignerGraphDocumentV1): DesignerIssue[] {
  const issues: DesignerIssue[] = [];
  const groupIds = new Set(graph.groups.map((group) => group.id));
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const portOwners = new Map<string, string>();

  addDuplicateIdIssues(issues, graph.groups.map((group) => group.id), 'duplicate-graph-group-id', '/graph/groups');
  addDuplicateIdIssues(issues, graph.nodes.map((node) => node.id), 'duplicate-graph-node-id', '/graph/nodes');
  addDuplicateIdIssues(issues, graph.edges.map((edge) => edge.id), 'duplicate-graph-edge-id', '/graph/edges');

  graph.groups.forEach((group) => {
    if (group.parentGroupId && !groupIds.has(group.parentGroupId)) {
      issues.push(issue('error', 'missing-graph-parent-group', `Group '${group.id}' references missing parent group '${group.parentGroupId}'.`, `/graph/groups/${group.id}`, group.id));
    }
    if (group.kind === 'actor-lane' && (!group.semanticRef.actorId || !group.semanticRef.processId)) {
      issues.push(issue('error', 'missing-graph-group-actor-ref', `Group '${group.id}' must reference processId and actorId.`, `/graph/groups/${group.id}/semanticRef`, group.id));
    }
  });

  graph.nodes.forEach((node) => {
    if (node.parentNodeId && !nodeMap.has(node.parentNodeId)) {
      issues.push(issue('error', 'missing-graph-parent-node', `Node '${node.id}' references missing parent node '${node.parentNodeId}'.`, `/graph/nodes/${node.id}/parentNodeId`, node.id));
    }
    if (node.groupId && !groupIds.has(node.groupId)) {
      issues.push(issue('error', 'missing-graph-node-group', `Node '${node.id}' references missing group '${node.groupId}'.`, `/graph/nodes/${node.id}/groupId`, node.id));
    }
    if (node.kind === 'stage' && (!node.semanticRef.processId || !node.semanticRef.stageId)) {
      issues.push(issue('error', 'missing-graph-stage-ref', `Stage node '${node.id}' must reference processId and stageId.`, `/graph/nodes/${node.id}/semanticRef`, node.id));
    }
    if (node.kind === 'step' && (!node.semanticRef.processId || !node.semanticRef.stageId || !node.semanticRef.stepId)) {
      issues.push(issue('error', 'missing-graph-step-ref', `Step node '${node.id}' must reference processId, stageId, and stepId.`, `/graph/nodes/${node.id}/semanticRef`, node.id));
    }
    if (node.kind === 'outcome' && (!node.semanticRef.processId || !node.semanticRef.outcomeId)) {
      issues.push(issue('error', 'missing-graph-outcome-ref', `Outcome node '${node.id}' must reference processId and outcomeId.`, `/graph/nodes/${node.id}/semanticRef`, node.id));
    }

    addDuplicateIdIssues(issues, node.ports.map((port) => port.id), 'duplicate-graph-port-id', `/graph/nodes/${node.id}/ports`);
    node.ports.forEach((port) => {
      if (portOwners.has(port.id)) {
        issues.push(issue('error', 'duplicate-graph-port-id-global', `Port '${port.id}' is already owned by node '${portOwners.get(port.id)}'.`, `/graph/nodes/${node.id}/ports/${port.id}`, node.id));
        return;
      }
      portOwners.set(port.id, node.id);
    });
  });

  graph.edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.sourceNodeId);
    const targetNode = nodeMap.get(edge.targetNodeId);
    if (!sourceNode) {
      issues.push(issue('error', 'missing-graph-edge-source-node', `Edge '${edge.id}' references missing source node '${edge.sourceNodeId}'.`, `/graph/edges/${edge.id}/sourceNodeId`, edge.id));
    }
    if (!targetNode) {
      issues.push(issue('error', 'missing-graph-edge-target-node', `Edge '${edge.id}' references missing target node '${edge.targetNodeId}'.`, `/graph/edges/${edge.id}/targetNodeId`, edge.id));
    }
    if (sourceNode && !sourceNode.ports.some((port) => port.id === edge.sourcePortId)) {
      issues.push(issue('error', 'missing-graph-edge-source-port', `Edge '${edge.id}' references missing source port '${edge.sourcePortId}'.`, `/graph/edges/${edge.id}/sourcePortId`, edge.id));
    }
    if (targetNode && !targetNode.ports.some((port) => port.id === edge.targetPortId)) {
      issues.push(issue('error', 'missing-graph-edge-target-port', `Edge '${edge.id}' references missing target port '${edge.targetPortId}'.`, `/graph/edges/${edge.id}/targetPortId`, edge.id));
    }
    if (edge.kind === 'stage-transition' && (!edge.semanticRef.processId || !edge.semanticRef.transitionId)) {
      issues.push(issue('error', 'missing-graph-transition-ref', `Stage transition edge '${edge.id}' must reference processId and transitionId.`, `/graph/edges/${edge.id}/semanticRef`, edge.id));
    }
    if (edge.kind === 'step-transition' && (!edge.semanticRef.processId || !edge.semanticRef.stepTransitionId)) {
      issues.push(issue('error', 'missing-graph-step-transition-ref', `Step transition edge '${edge.id}' must reference processId and stepTransitionId.`, `/graph/edges/${edge.id}/semanticRef`, edge.id));
    }
  });

  return issues;
}

function createDefaultRule(document: DesignerDocument, prefix: string, displayName: string, scope: 'transition' | 'step-transition'): { ruleId: string; command: DesignerCommand } {
  const ruleId = uniqueId(document.model.rules.map((rule) => rule.id), prefix);
  return {
    ruleId,
    command: {
      kind: 'rule',
      parentId: 'section:rules',
      value: {
        id: ruleId,
        displayName,
        ruleType: 'condition',
        scope,
        language: 'dbm-expression-v1',
        body: 'true'
      }
    }
  };
}

function buildNewStage(document: DesignerDocument, processId: string, actorId?: string): DbmStageV1 {
  const process = findProcess(document.model, processId);
  if (!process) {
    throw new Error(`Cannot add stage. Process '${processId}' was not found.`);
  }

  const id = uniqueId(process.stages.map((stage) => stage.id), 'stage');
  return {
    id,
    displayName: `New stage ${process.stages.length + 1}`,
    stageCategory: 'work',
    stageKindId: 'work',
    scope: 'back-office',
    childProcessRefs: [],
    actorId: actorId ?? process.actors[0]?.id ?? '',
    formId: document.model.forms[0]?.id ?? null,
    portalVisibility: 'hidden',
    statusId: process.statuses[0]?.id ?? '',
    portalStatusId: null,
    stepIds: [],
    defaultStepId: null,
    entryRuleIds: [],
    exitRuleIds: [],
    allowedOutcomeIds: process.outcomes[0]?.id ? [process.outcomes[0].id] : []
  };
}

function buildNewChildProcess(document: DesignerDocument, parentProcessId: string, parentStageId: string): DbmProcessV1 {
  const parentProcess = findProcess(document.model, parentProcessId);
  const parentStage = parentProcess?.stages.find((stage) => stage.id === parentStageId);
  const mainProcess = resolveMainProcess(document.model);
  const id = uniqueId(document.model.processPortfolio.processes.map((process) => process.id), 'child-process');
  const inheritedActor = parentStage?.actorId
    ? parentProcess?.actors.find((actor) => actor.id === parentStage.actorId)
    : undefined;

  return {
    id,
    displayName: 'New child process',
    role: 'sub-process',
    processTypeId: 'child-process',
    mainDisplayMode: 'expanded',
    statusId: parentStage?.statusId ?? mainProcess.statusId,
    portalStatusId: parentStage?.portalStatusId ?? null,
    renderOrder: document.model.processPortfolio.processes.length,
    subProcessVisibility: [],
    actors: inheritedActor ? [structuredClone(inheritedActor)] : mainProcess.actors.slice(0, 1).map((actor) => structuredClone(actor)),
    variables: [],
    statuses: parentProcess?.statuses.slice(0, 1).map((status) => structuredClone(status)) ?? mainProcess.statuses.slice(0, 1).map((status) => structuredClone(status)),
    tasks: [],
    notifications: [],
    stages: [],
    steps: [],
    transitions: [],
    stepTransitions: [],
    outcomes: []
  };
}

function buildNewStep(document: DesignerDocument, processId: string, stageId: string): DbmStepV1 {
  const process = findProcess(document.model, processId);
  const stage = process?.stages.find((entry) => entry.id === stageId);
  if (!process || !stage) {
    throw new Error(`Cannot add step. Stage '${stageId}' was not found in process '${processId}'.`);
  }

  const id = uniqueId(process.steps.map((step) => step.id), 'step');
  return {
    id,
    stageId,
    displayName: `New step ${stage.stepIds.length + 1}`,
    workCategory: 'work',
    workKindId: 'work',
    ownerActorId: stage.actorId || process.actors[0]?.id || '',
    notificationId: process.notifications[0]?.id ?? null,
    taskId: process.tasks[0]?.id ?? null,
    internalStatusId: process.statuses.find((status) => status.audience !== 'portal')?.id ?? process.statuses[0]?.id ?? '',
    portalStatusId: process.statuses.find((status) => status.audience !== 'internal')?.id ?? null,
    formStateId: null,
    entryRuleIds: [],
    exitRuleIds: []
  };
}

function buildNewOutcome(document: DesignerDocument, processId: string): DbmOutcomeV1 {
  const process = findProcess(document.model, processId);
  if (!process) {
    throw new Error(`Cannot add outcome. Process '${processId}' was not found.`);
  }
  const id = uniqueId(process.outcomes.map((outcome) => outcome.id), 'outcome');
  return { id, displayName: `New outcome ${process.outcomes.length + 1}` };
}

function buildTransitionTargetLabel(target: DesignerGraphConnectionTarget): string {
  if ('stepId' in target) return target.stepId;
  if ('stageId' in target) return target.stageId;
  return target.outcomeId;
}

function findStage(model: DbmModelV1, processId: string, stageId: string): { process: DbmProcessV1; stage: DbmStageV1 } {
  const process = findProcess(model, processId);
  const stage = process?.stages.find((entry) => entry.id === stageId);
  if (!process || !stage) {
    throw new Error(`Stage '${stageId}' was not found in process '${processId}'.`);
  }
  return { process, stage };
}

function processHasPathTo(model: DbmModelV1, startProcessId: string, targetProcessId: string): boolean {
  const processes = new Map(model.processPortfolio.processes.map((process) => [process.id, process]));
  const visited = new Set<string>();
  const stack = [startProcessId];

  while (stack.length > 0) {
    const processId = stack.pop();
    if (!processId || visited.has(processId)) {
      continue;
    }
    if (processId === targetProcessId) {
      return true;
    }
    visited.add(processId);
    const process = processes.get(processId);
    process?.stages.forEach((stage) => {
      stage.childProcessRefs.forEach((ref) => stack.push(ref.processId));
    });
  }

  return false;
}

function assertCanAttachChildProcess(model: DbmModelV1, parentProcessId: string, childProcessId: string): DbmProcessV1 {
  const childProcess = findProcess(model, childProcessId);
  if (!childProcess) {
    throw new Error(`Cannot attach child process '${childProcessId}'. The process was not found.`);
  }
  if (parentProcessId === childProcessId) {
    throw new Error(`Cannot attach child process '${childProcessId}' to itself.`);
  }
  if (processHasPathTo(model, childProcessId, parentProcessId)) {
    throw new Error(`Attaching child process '${childProcessId}' to process '${parentProcessId}' would create a circular process hierarchy.`);
  }
  return childProcess;
}

function attachChildProcessRefCommands(document: DesignerDocument, parentProcessId: string, parentStageId: string, childProcessId: string): DesignerCommand[] {
  const { stage } = findStage(document.model, parentProcessId, parentStageId);
  const childProcess = assertCanAttachChildProcess(document.model, parentProcessId, childProcessId);
  if (stage.childProcessRefs.some((ref) => ref.processId === childProcess.id)) {
    return [];
  }

  return [{
    nodeId: stageNodeId(parentProcessId, parentStageId),
    value: {
      childProcessRefs: [
        ...stage.childProcessRefs,
        {
          id: uniqueId(stage.childProcessRefs.map((ref) => ref.id), `spawn-${childProcess.id}`),
          processId: childProcess.id,
          displayName: childProcess.displayName,
          activationRuleId: null,
          blocksParent: true
        }
      ]
    }
  }];
}

function detachChildProcessRefCommands(document: DesignerDocument, parentProcessId: string, parentStageId: string, refId: string): DesignerCommand[] {
  const { stage } = findStage(document.model, parentProcessId, parentStageId);
  return [{
    nodeId: stageNodeId(parentProcessId, parentStageId),
    value: {
      childProcessRefs: stage.childProcessRefs.filter((ref) => ref.id !== refId)
    }
  }];
}

function moveChildProcessRefCommands(
  document: DesignerDocument,
  sourceProcessId: string,
  sourceStageId: string,
  refId: string,
  targetProcessId: string,
  targetStageId: string
): DesignerCommand[] {
  const source = findStage(document.model, sourceProcessId, sourceStageId);
  const target = findStage(document.model, targetProcessId, targetStageId);
  const ref = source.stage.childProcessRefs.find((entry) => entry.id === refId);
  if (!ref) {
    return [];
  }
  assertCanAttachChildProcess(document.model, target.process.id, ref.processId);
  if (target.stage.childProcessRefs.some((entry) => entry.processId === ref.processId && entry.id !== ref.id)) {
    throw new Error(`Stage '${targetStageId}' already references child process '${ref.processId}'.`);
  }

  return [
    {
      nodeId: stageNodeId(sourceProcessId, sourceStageId),
      value: {
        childProcessRefs: source.stage.childProcessRefs.filter((entry) => entry.id !== ref.id)
      }
    },
    {
      nodeId: stageNodeId(targetProcessId, targetStageId),
      value: {
        childProcessRefs: [...target.stage.childProcessRefs, structuredClone(ref)]
      }
    }
  ];
}

function buildCopyDisplayName(label: string): string {
  return label.endsWith(' Copy') ? `${label} 2` : `${label} Copy`;
}

function cloneStageForPaste(process: DbmProcessV1, stage: DbmStageV1, steps: DbmStepV1[]): { stage: DbmStageV1; steps: DbmStepV1[] } {
  const nextStageId = uniqueId(process.stages.map((entry) => entry.id), `${stage.id}-copy`);
  const stepIdMap = new Map<string, string>();
  steps.forEach((step) => {
    stepIdMap.set(step.id, uniqueId([...process.steps.map((entry) => entry.id), ...stepIdMap.values()], `${step.id}-copy`));
  });
  return {
    stage: {
      ...structuredClone(stage),
      id: nextStageId,
      displayName: buildCopyDisplayName(stage.displayName),
      stepIds: steps.map((step) => stepIdMap.get(step.id) ?? step.id),
      defaultStepId: stage.defaultStepId ? (stepIdMap.get(stage.defaultStepId) ?? null) : null
    },
    steps: steps.map((step) => ({
      ...structuredClone(step),
      id: stepIdMap.get(step.id) ?? step.id,
      stageId: nextStageId
    }))
  };
}

function cloneStepForPaste(process: DbmProcessV1, step: DbmStepV1): DbmStepV1 {
  return {
    ...structuredClone(step),
    id: uniqueId(process.steps.map((entry) => entry.id), `${step.id}-copy`),
    displayName: buildCopyDisplayName(step.displayName)
  };
}

export function buildDesignerClipboardPayload(document: DesignerDocument, selectionId: string | null = document.selectionId): DesignerClipboardPayload | null {
  if (!selectionId) {
    return null;
  }

  const stageSelection = parseProcessScopedNodeId(selectionId, 'stage');
  if (stageSelection) {
    const process = findProcess(document.model, stageSelection.processId);
    const stage = process?.stages.find((entry) => entry.id === stageSelection.id);
    if (!process || !stage) {
      return null;
    }
    return {
      kind: 'stage',
      processId: process.id,
      stage: structuredClone(stage),
      steps: stage.stepIds.map((stepId) => process.steps.find((entry) => entry.id === stepId)).filter((step): step is DbmStepV1 => !!step).map((step) => structuredClone(step))
    };
  }

  const stepSelection = parseProcessScopedNodeId(selectionId, 'step');
  if (stepSelection) {
    const process = findProcess(document.model, stepSelection.processId);
    const step = process?.steps.find((entry) => entry.id === stepSelection.id);
    return process && step ? { kind: 'step', processId: process.id, step: structuredClone(step) } : null;
  }

  return null;
}

export function pasteDesignerClipboardPayload(document: DesignerDocument, payload: DesignerClipboardPayload): DesignerCommandResult {
  const process = findProcess(document.model, payload.processId);
  if (!process) {
    return { document, affectedNodeId: document.selectionId, issues: document.issues };
  }

  if (payload.kind === 'stage') {
    const sourceStageIndex = process.stages.findIndex((entry) => entry.id === payload.stage.id);
    const duplicated = cloneStageForPaste(process, payload.stage, payload.steps);
    let result: DesignerCommandResult = { document, affectedNodeId: document.selectionId, issues: document.issues };
    result = addNode(result.document, {
      kind: 'stage',
      parentId: processStagesNodeId(process.id),
      index: sourceStageIndex >= 0 ? sourceStageIndex + 1 : process.stages.length,
      value: duplicated.stage
    });
    duplicated.steps.forEach((step, index) => {
      result = addNode(result.document, {
        kind: 'step',
        parentId: stageStepsNodeId(process.id, duplicated.stage.id),
        index,
        value: step
      });
    });
    return { ...result, affectedNodeId: stageNodeId(process.id, duplicated.stage.id) };
  }

  const duplicatedStep = cloneStepForPaste(process, payload.step);
  const result = addNode(document, {
    kind: 'step',
    parentId: stageStepsNodeId(process.id, duplicatedStep.stageId),
    value: duplicatedStep
  });
  return { ...result, affectedNodeId: stepNodeId(process.id, duplicatedStep.id) };
}

export function translateGraphIntentToCommands(intent: DesignerGraphIntent, document: DesignerDocument): DesignerCommand[] {
  switch (intent.kind) {
    case 'add-process':
      return [{ kind: 'process', parentId: 'collection:process-portfolio:processes', index: intent.targetIndex, value: intent.process }];
    case 'add-child-process':
      return [{
        kind: 'process',
        parentId: stageNodeId(intent.parentProcessId, intent.parentStageId),
        index: intent.targetIndex,
        value: intent.process ?? buildNewChildProcess(document, intent.parentProcessId, intent.parentStageId)
      }];
    case 'add-stage':
      return [{ kind: 'stage', parentId: processStagesNodeId(intent.processId), index: intent.targetIndex, value: buildNewStage(document, intent.processId, intent.actorId) }];
    case 'add-outcome':
      return [{ kind: 'outcome', parentId: processOutcomesNodeId(intent.processId), index: intent.targetIndex, value: buildNewOutcome(document, intent.processId) }];
    case 'add-step':
      return [{ kind: 'step', parentId: stageStepsNodeId(intent.processId, intent.stageId), index: intent.targetIndex, value: buildNewStep(document, intent.processId, intent.stageId) }];
    case 'rename-node':
      return [{ nodeId: intent.nodeId, value: { displayName: intent.label } }];
    case 'update-process':
      return [{ nodeId: `process:${intent.processId}`, value: intent.value }];
    case 'update-stage':
      return [{ nodeId: stageNodeId(intent.processId, intent.stageId), value: intent.value }];
    case 'rebind-stage-form': {
      const process = findProcess(document.model, intent.processId);
      const stage = process?.stages.find((entry) => entry.id === intent.stageId);
      return [
        { nodeId: stageNodeId(intent.processId, intent.stageId), value: { formId: intent.formId } },
        ...(stage?.stepIds ?? []).map((stepId) => ({ nodeId: stepNodeId(intent.processId, stepId), value: { formStateId: null } }))
      ];
    }
    case 'update-stage-outcomes':
      return [{ nodeId: stageNodeId(intent.processId, intent.stageId), value: { allowedOutcomeIds: [...new Set(intent.outcomeIds)] } }];
    case 'update-step':
      return [{ nodeId: stepNodeId(intent.processId, intent.stepId), value: intent.value }];
    case 'update-transition-handoff':
      return [{ nodeId: transitionNodeId(intent.processId, intent.transitionId), value: { subjectHandoff: intent.subjectHandoff } }];
    case 'update-step-transition-handoff':
      return [{ nodeId: stepTransitionNodeId(intent.processId, intent.stepTransitionId), value: { subjectHandoff: intent.subjectHandoff } }];
    case 'remove-node':
      return [{ nodeId: intent.nodeId }];
    case 'move-process':
      return [{ nodeId: `process:${intent.processId}`, targetIndex: intent.targetIndex }];
    case 'move-stage':
      return [{
        nodeId: stageNodeId(intent.sourceProcessId ?? intent.processId ?? '', intent.stageId),
        targetIndex: intent.targetIndex,
        targetParentId: processStagesNodeId(intent.targetProcessId ?? intent.sourceProcessId ?? intent.processId ?? '')
      }];
    case 'attach-child-process-ref':
      return attachChildProcessRefCommands(document, intent.parentProcessId, intent.parentStageId, intent.childProcessId);
    case 'detach-child-process-ref':
      return detachChildProcessRefCommands(document, intent.parentProcessId, intent.parentStageId, intent.refId);
    case 'move-child-process-ref':
      return moveChildProcessRefCommands(document, intent.sourceProcessId, intent.sourceStageId, intent.refId, intent.targetProcessId, intent.targetStageId);
    case 'move-step':
      return [{ nodeId: stepNodeId(intent.processId, intent.stepId), targetIndex: intent.targetIndex, targetParentId: stageStepsNodeId(intent.processId, intent.targetStageId) }];
    case 'create-stage-transition': {
      const rule = createDefaultRule(document, 'transition-guard', `Guard ${intent.fromStageId} to ${intent.toStageId}`, 'transition');
      return [
        rule.command,
        {
          kind: 'transition',
          parentId: processTransitionsNodeId(intent.processId),
          value: {
            id: uniqueId(findProcess(document.model, intent.processId)?.transitions.map((transition) => transition.id) ?? [], 'transition'),
            fromStageId: intent.fromStageId,
            toStageId: intent.toStageId,
            outcomeId: intent.outcomeId,
            guardRuleId: rule.ruleId
          }
        }
      ];
    }
    case 'create-step-transition': {
      const rule = createDefaultRule(document, 'step-transition-guard', `Guard ${intent.fromStepId} to ${buildTransitionTargetLabel(intent.target)}`, 'step-transition');
      return [
        rule.command,
        {
          kind: 'step-transition',
          parentId: processStepTransitionsNodeId(intent.processId),
          value: {
            id: uniqueId(findProcess(document.model, intent.processId)?.stepTransitions.map((transition) => transition.id) ?? [], 'step-transition'),
            fromStepId: intent.fromStepId,
            guardRuleId: rule.ruleId,
            target: intent.target
          }
        }
      ];
    }
    case 'remove-edge':
      return [{ nodeId: intent.edgeId }];
    default:
      return [];
  }
}

function applyDesignerCommand(document: DesignerDocument, command: DesignerCommand): DesignerCommandResult {
  if ('kind' in command && 'parentId' in command) {
    return addNode(document, command);
  }
  if ('targetIndex' in command) {
    return moveNode(document, command);
  }
  if ('value' in command) {
    return updateNode(document, command);
  }
  return removeNode(document, command);
}

export function applyGraphIntent(document: DesignerDocument, intent: DesignerGraphIntent): DesignerCommandResult {
  const commands = translateGraphIntentToCommands(intent, document);
  if (commands.length === 0) {
    return { document, affectedNodeId: document.selectionId, issues: document.issues };
  }
  let currentResult: DesignerCommandResult = { document, affectedNodeId: document.selectionId, issues: document.issues };
  commands.forEach((command) => {
    currentResult = applyDesignerCommand(currentResult.document, command);
  });
  return currentResult;
}
