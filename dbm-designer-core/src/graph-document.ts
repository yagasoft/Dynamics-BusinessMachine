import type {
  DbmDesignerGraphDocumentV1,
  DbmDesignerGraphEdgeV1,
  DbmDesignerGraphGroupV1,
  DbmDesignerGraphNodeKindV1,
  DbmDesignerGraphNodeV1,
  DbmDesignerGraphPortV1,
  DbmModelV1,
  DbmOutcomeV1,
  DbmStepTransitionV1
} from 'dbm-contract';
import {
  outcomeNodeId,
  stageNodeId,
  stageStepsNodeId,
  stepNodeId,
  stepTransitionNodeId,
  transitionNodeId
} from './node-ids';
import type { DesignerCommand, DesignerGraphIntent, DesignerIssue, DesignerDocument } from './types';

function issue(
  level: DesignerIssue['level'],
  code: string,
  message: string,
  path: string,
  nodeId?: string
): DesignerIssue {
  return {
    level,
    code,
    message,
    path,
    nodeId
  };
}

export function graphActorGroupId(actorId: string): string {
  return `group:actor:${actorId}`;
}

export function graphStageInPortId(stageId: string): string {
  return `port:stage:${stageId}:in`;
}

export function graphStageOutcomePortId(stageId: string, outcomeId: string): string {
  return `port:stage:${stageId}:outcome:${outcomeId}`;
}

export function graphStepInPortId(stepId: string): string {
  return `port:step:${stepId}:in`;
}

export function graphStepOutPortId(stepId: string): string {
  return `port:step:${stepId}:out`;
}

export function graphOutcomeInPortId(outcomeId: string): string {
  return `port:outcome:${outcomeId}:in`;
}

export function isStableDesignerGraphNodeId(nodeId: string): boolean {
  return nodeId.startsWith('stage:') || nodeId.startsWith('step:') || nodeId.startsWith('outcome:');
}

function buildStagePorts(model: DbmModelV1, stageId: string): DbmDesignerGraphPortV1[] {
  const outcomeMap = new Map(model.process.outcomes.map((outcome) => [outcome.id, outcome]));
  const outcomeIds = new Set<string>();
  const stage = model.process.stages.find((entry) => entry.id === stageId);
  stage?.allowedOutcomeIds.forEach((outcomeId) => outcomeIds.add(outcomeId));
  model.process.transitions
    .filter((transition) => transition.fromStageId === stageId)
    .forEach((transition) => outcomeIds.add(transition.outcomeId));

  return [
    {
      id: graphStageInPortId(stageId),
      label: null,
      direction: 'in',
      role: 'primary-in'
    },
    ...[...outcomeIds]
      .sort((left, right) => left.localeCompare(right))
      .map((outcomeId) => ({
        id: graphStageOutcomePortId(stageId, outcomeId),
        label: outcomeMap.get(outcomeId)?.displayName ?? outcomeId,
        direction: 'out' as const,
        role: 'outcome' as const
      }))
  ];
}

function buildStepPorts(stepId: string): DbmDesignerGraphPortV1[] {
  return [
    {
      id: graphStepInPortId(stepId),
      label: null,
      direction: 'in',
      role: 'primary-in'
    },
    {
      id: graphStepOutPortId(stepId),
      label: null,
      direction: 'out',
      role: 'primary-out'
    }
  ];
}

function buildOutcomePorts(outcomeId: string): DbmDesignerGraphPortV1[] {
  return [
    {
      id: graphOutcomeInPortId(outcomeId),
      label: null,
      direction: 'in',
      role: 'primary-in'
    }
  ];
}

function resolveStepTransitionTarget(transition: DbmStepTransitionV1): { targetNodeId: string; targetPortId: string; outcomeId?: string } {
  if ('stepId' in transition.target) {
    return {
      targetNodeId: stepNodeId(transition.target.stepId),
      targetPortId: graphStepInPortId(transition.target.stepId)
    };
  }

  if ('stageId' in transition.target) {
    return {
      targetNodeId: stageNodeId(transition.target.stageId),
      targetPortId: graphStageInPortId(transition.target.stageId)
    };
  }

  return {
    targetNodeId: outcomeNodeId(transition.target.outcomeId),
    targetPortId: graphOutcomeInPortId(transition.target.outcomeId),
    outcomeId: transition.target.outcomeId
  };
}

function outcomeLabel(outcome: DbmOutcomeV1 | undefined): string | null {
  return outcome?.displayName ?? null;
}

export function buildDesignerGraphDocument(model: DbmModelV1): DbmDesignerGraphDocumentV1 {
  const outcomeMap = new Map(model.process.outcomes.map((outcome) => [outcome.id, outcome]));

  const groups: DbmDesignerGraphGroupV1[] = model.process.actors.map((actor) => ({
    id: graphActorGroupId(actor.id),
    kind: 'actor-lane',
    label: actor.displayName,
    parentGroupId: null,
    semanticRef: {
      actorId: actor.id
    }
  }));

  const nodes: DbmDesignerGraphNodeV1[] = [
    ...model.process.stages.map((stage) => ({
      id: stageNodeId(stage.id),
      kind: 'stage' as DbmDesignerGraphNodeKindV1,
      label: stage.displayName,
      parentNodeId: null,
      groupId: stage.actorId ? graphActorGroupId(stage.actorId) : null,
      semanticRef: {
        stageId: stage.id,
        actorId: stage.actorId
      },
      ports: buildStagePorts(model, stage.id)
    })),
    ...model.process.steps.map((step) => ({
      id: stepNodeId(step.id),
      kind: 'step' as DbmDesignerGraphNodeKindV1,
      label: step.displayName,
      parentNodeId: stageNodeId(step.stageId),
      groupId: null,
      semanticRef: {
        stageId: step.stageId,
        stepId: step.id
      },
      ports: buildStepPorts(step.id)
    })),
    ...model.process.outcomes.map((outcome) => ({
      id: outcomeNodeId(outcome.id),
      kind: 'outcome' as DbmDesignerGraphNodeKindV1,
      label: outcome.displayName,
      parentNodeId: null,
      groupId: null,
      semanticRef: {
        outcomeId: outcome.id
      },
      ports: buildOutcomePorts(outcome.id)
    }))
  ];

  const edges: DbmDesignerGraphEdgeV1[] = [
    ...model.process.transitions.map((transition) => ({
      id: transitionNodeId(transition.id),
      kind: 'stage-transition' as const,
      label: outcomeLabel(outcomeMap.get(transition.outcomeId)),
      sourceNodeId: stageNodeId(transition.fromStageId),
      sourcePortId: graphStageOutcomePortId(transition.fromStageId, transition.outcomeId),
      targetNodeId: stageNodeId(transition.toStageId),
      targetPortId: graphStageInPortId(transition.toStageId),
      semanticRef: {
        transitionId: transition.id,
        outcomeId: transition.outcomeId
      }
    })),
    ...model.process.stepTransitions.map((transition) => {
      const target = resolveStepTransitionTarget(transition);

      return {
        id: stepTransitionNodeId(transition.id),
        kind: 'step-transition' as const,
        label: target.outcomeId ? outcomeLabel(outcomeMap.get(target.outcomeId)) : null,
        sourceNodeId: stepNodeId(transition.fromStepId),
        sourcePortId: graphStepOutPortId(transition.fromStepId),
        targetNodeId: target.targetNodeId,
        targetPortId: target.targetPortId,
        semanticRef: {
          stepTransitionId: transition.id,
          outcomeId: target.outcomeId
        }
      };
    })
  ];

  return {
    schemaVersion: 'dbm.designer.graph-document/v1',
    packageId: model.package.id,
    packageVersion: model.package.version,
    processId: model.process.id,
    groups,
    nodes,
    edges
  };
}

function addDuplicateIdIssues(
  issues: DesignerIssue[],
  ids: string[],
  code: string,
  pathPrefix: string
): void {
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

    if (group.kind === 'actor-lane' && !group.semanticRef.actorId) {
      issues.push(issue('error', 'missing-graph-group-actor-ref', `Group '${group.id}' must reference actorId.`, `/graph/groups/${group.id}/semanticRef`, group.id));
    }
  });

  graph.nodes.forEach((node) => {
    if (node.parentNodeId && !nodeMap.has(node.parentNodeId)) {
      issues.push(issue('error', 'missing-graph-parent-node', `Node '${node.id}' references missing parent node '${node.parentNodeId}'.`, `/graph/nodes/${node.id}/parentNodeId`, node.id));
    }

    if (node.groupId && !groupIds.has(node.groupId)) {
      issues.push(issue('error', 'missing-graph-node-group', `Node '${node.id}' references missing group '${node.groupId}'.`, `/graph/nodes/${node.id}/groupId`, node.id));
    }

    if (node.kind === 'stage' && !node.semanticRef.stageId) {
      issues.push(issue('error', 'missing-graph-stage-ref', `Stage node '${node.id}' must reference stageId.`, `/graph/nodes/${node.id}/semanticRef`, node.id));
    }

    if (node.kind === 'step' && (!node.semanticRef.stageId || !node.semanticRef.stepId)) {
      issues.push(issue('error', 'missing-graph-step-ref', `Step node '${node.id}' must reference both stageId and stepId.`, `/graph/nodes/${node.id}/semanticRef`, node.id));
    }

    if (node.kind === 'outcome' && !node.semanticRef.outcomeId) {
      issues.push(issue('error', 'missing-graph-outcome-ref', `Outcome node '${node.id}' must reference outcomeId.`, `/graph/nodes/${node.id}/semanticRef`, node.id));
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

    if (edge.kind === 'stage-transition' && !edge.semanticRef.transitionId) {
      issues.push(issue('error', 'missing-graph-transition-ref', `Stage transition edge '${edge.id}' must reference transitionId.`, `/graph/edges/${edge.id}/semanticRef`, edge.id));
    }

    if (edge.kind === 'step-transition' && !edge.semanticRef.stepTransitionId) {
      issues.push(issue('error', 'missing-graph-step-transition-ref', `Step transition edge '${edge.id}' must reference stepTransitionId.`, `/graph/edges/${edge.id}/semanticRef`, edge.id));
    }
  });

  return issues;
}

function parseGraphNodeIntentNodeId(nodeId: string): 'stage' | 'step' | 'outcome' | 'transition' | 'step-transition' | null {
  if (nodeId.startsWith('stage:')) {
    return 'stage';
  }

  if (nodeId.startsWith('step:')) {
    return 'step';
  }

  if (nodeId.startsWith('outcome:')) {
    return 'outcome';
  }

  if (nodeId.startsWith('transition:')) {
    return 'transition';
  }

  if (nodeId.startsWith('step-transition:')) {
    return 'step-transition';
  }

  return null;
}

export function translateGraphIntentToCommands(intent: DesignerGraphIntent, _document: DesignerDocument): DesignerCommand[] {
  switch (intent.kind) {
    case 'rename-node': {
      const nodeKind = parseGraphNodeIntentNodeId(intent.nodeId);
      if (!nodeKind || nodeKind === 'transition' || nodeKind === 'step-transition') {
        throw new Error(`Graph intent 'rename-node' does not support '${intent.nodeId}'.`);
      }

      return [
        {
          nodeId: intent.nodeId,
          value: {
            displayName: intent.label
          }
        }
      ];
    }

    case 'remove-node':
      return [
        {
          nodeId: intent.nodeId
        }
      ];

    case 'move-stage':
      return [
        {
          nodeId: stageNodeId(intent.stageId),
          targetIndex: intent.targetIndex
        }
      ];

    case 'move-step':
      return [
        {
          nodeId: stepNodeId(intent.stepId),
          targetIndex: intent.targetIndex,
          targetParentId: stageStepsNodeId(intent.targetStageId)
        }
      ];

    default:
      return [];
  }
}
