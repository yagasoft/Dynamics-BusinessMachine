import Ajv from 'ajv';
import type {
  DbmDesignerGraphDocumentV1,
  DbmDesignerWorkspaceV1,
  DbmModelV1,
  DbmProcessPortfolioValidationIssueV1
} from 'dbm-contract';
import graphDocumentSchema from '../../dbm-contract/schema/dbm-designer-graph-document-v1.schema.json';
import modelSchema from '../../dbm-contract/schema/dbm-model-v1.schema.json';
import workspaceSchema from '../../dbm-contract/schema/dbm-designer-workspace-v1.schema.json';
import { buildDesignerGraphDocument, isStableDesignerGraphNodeId, validateDesignerGraphDocument } from './graph-document';
import {
  PROCESS_PORTFOLIO_NODE_ID,
  processNodeId,
  stageNodeId
} from './node-ids';
import { resolveMainProcess } from './portfolio';
import type { DesignerDocument, DesignerIssue } from './types';

const ajv = new Ajv({
  allErrors: true,
  strict: false
});

const validateSchema = ajv.compile(modelSchema as object);
const validateWorkspaceSchema = ajv.compile(workspaceSchema as object);
const validateGraphDocumentSchema = ajv.compile(graphDocumentSchema as object);

function issue(level: DesignerIssue['level'], code: string, message: string, path: string, nodeId?: string): DesignerIssue {
  return { level, code, message, path, nodeId };
}

function addSchemaIssues(
  issues: DesignerIssue[],
  valid: boolean,
  errors: { instancePath?: string; message?: string }[] | null | undefined,
  code: string,
  pathPrefix: string
): void {
  if (valid) {
    return;
  }

  (errors ?? []).forEach((error) => {
    const instancePath = error.instancePath || '/';
    const normalizedPath = instancePath === '/' ? (pathPrefix || '/') : `${pathPrefix}${instancePath}`;
    issues.push(issue('error', code, `${normalizedPath} ${error.message ?? 'is invalid'}`.trim(), normalizedPath));
  });
}

function addDuplicateIdIssues(
  issues: DesignerIssue[],
  ids: string[],
  code: string,
  pathPrefix: string,
  nodeIdFactory: (id: string) => string
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
    issues.push(issue('error', code, `Duplicate identifier '${duplicate}' is not allowed.`, `${pathPrefix}/${duplicate}`, nodeIdFactory(duplicate)));
  });
}

function mapPortfolioIssue(model: DbmModelV1, portfolioIssue: DbmProcessPortfolioValidationIssueV1): DesignerIssue {
  const processMatch = /^\/processPortfolio\/processes\/(?<processIndex>\d+)/.exec(portfolioIssue.path);
  const processIndex = processMatch?.groups?.processIndex ? Number(processMatch.groups.processIndex) : null;
  const process = processIndex === null ? null : model.processPortfolio.processes[processIndex] ?? null;
  return issue(
    'error',
    portfolioIssue.code,
    portfolioIssue.message,
    portfolioIssue.path,
    process ? processNodeId(process.id) : PROCESS_PORTFOLIO_NODE_ID
  );
}

function createPortfolioIssue(code: DbmProcessPortfolioValidationIssueV1['code'], path: string, message: string): DbmProcessPortfolioValidationIssueV1 {
  return { code, path, message };
}

function validatePortfolioModel(model: DbmModelV1): DbmProcessPortfolioValidationIssueV1[] {
  const issues: DbmProcessPortfolioValidationIssueV1[] = [];
  const mainProcess = model.processPortfolio.processes.find((process) => process.id === model.processPortfolio.mainProcessId);

  if (!mainProcess) {
    issues.push(createPortfolioIssue(
      'main-process-not-found',
      '/processPortfolio/mainProcessId',
      'processPortfolio.mainProcessId must resolve to a process in processPortfolio.processes.'
    ));
    return issues;
  }

  if (mainProcess.role !== 'main') {
    issues.push(createPortfolioIssue(
      'main-process-role-invalid',
      `/processPortfolio/processes/${model.processPortfolio.processes.indexOf(mainProcess)}/role`,
      'The process identified by processPortfolio.mainProcessId must have role main.'
    ));
  }

  const mainRoleProcesses = model.processPortfolio.processes.filter((process) => process.role === 'main');
  if (mainRoleProcesses.length !== 1) {
    issues.push(createPortfolioIssue(
      'main-process-duplicate',
      '/processPortfolio/processes',
      'Exactly one process must have role main.'
    ));
  }

  const mainStageIndex = new Map(mainProcess.stages.map((stage, index) => [stage.id, index]));
  model.processPortfolio.processes.forEach((process, processIndex) => {
    if (process.id !== mainProcess.id && process.role !== 'sub-process') {
      issues.push(createPortfolioIssue(
        'sub-process-role-invalid',
        `/processPortfolio/processes/${processIndex}/role`,
        'Every non-main process in the portfolio must have role sub-process.'
      ));
    }

    process.stages.forEach((stage, stageIndex) => {
      const spanPath = `/processPortfolio/processes/${processIndex}/stages/${stageIndex}/stageSpan`;
      const anchors = [
        ['start', stage.stageSpan.start],
        ['end', stage.stageSpan.end]
      ] as const;

      anchors.forEach(([anchorName, anchor]) => {
        if (anchor.fraction < 0 || anchor.fraction > 1) {
          issues.push(createPortfolioIssue(
            'stage-span-fraction-out-of-range',
            `${spanPath}/${anchorName}/fraction`,
            'stageSpan anchor fraction must be between 0 and 1.'
          ));
        }
        if (!mainStageIndex.has(anchor.stageId)) {
          issues.push(createPortfolioIssue(
            'stage-span-anchor-not-found',
            `${spanPath}/${anchorName}/stageId`,
            'stageSpan anchor stageId must resolve to a stage in the main process timeline.'
          ));
        }
      });

      const start = mainStageIndex.has(stage.stageSpan.start.stageId) ? (mainStageIndex.get(stage.stageSpan.start.stageId) ?? 0) + stage.stageSpan.start.fraction : null;
      const end = mainStageIndex.has(stage.stageSpan.end.stageId) ? (mainStageIndex.get(stage.stageSpan.end.stageId) ?? 0) + stage.stageSpan.end.fraction : null;
      if (start !== null && end !== null && start > end) {
        issues.push(createPortfolioIssue(
          'stage-span-reversed',
          spanPath,
          'stageSpan start anchor must not appear after the end anchor on the main process timeline.'
        ));
      }
    });
  });

  return issues;
}

function addAmbiguousMainStageAnchorIssues(model: DbmModelV1, issues: DesignerIssue[]): void {
  let mainProcess;
  try {
    mainProcess = resolveMainProcess(model);
  } catch {
    return;
  }

  const counts = new Map<string, number>();
  mainProcess.stages.forEach((stage) => {
    counts.set(stage.id, (counts.get(stage.id) ?? 0) + 1);
  });

  const ambiguousStageIds = new Set([...counts.entries()].filter(([, count]) => count > 1).map(([stageId]) => stageId));
  if (ambiguousStageIds.size === 0) {
    return;
  }

  model.processPortfolio.processes.forEach((process, processIndex) => {
    process.stages.forEach((stage, stageIndex) => {
      const anchors = [
        ['start', stage.stageSpan.start.stageId],
        ['end', stage.stageSpan.end.stageId]
      ] as const;
      anchors.forEach(([anchorName, stageId]) => {
        if (!ambiguousStageIds.has(stageId)) {
          return;
        }
        issues.push(issue(
          'error',
          'stage-span-anchor-ambiguous',
          `stageSpan ${anchorName} anchor '${stageId}' matches more than one main-process stage.`,
          `/processPortfolio/processes/${processIndex}/stages/${stageIndex}/stageSpan/${anchorName}/stageId`,
          stageNodeId(process.id, stage.id)
        ));
      });
    });
  });
}

function validateProcessSemantics(model: DbmModelV1): DesignerIssue[] {
  const issues: DesignerIssue[] = [];
  addDuplicateIdIssues(issues, model.processPortfolio.processes.map((process) => process.id), 'duplicate-process-id', '/processPortfolio/processes', processNodeId);

  model.processPortfolio.processes.forEach((process) => {
    addDuplicateIdIssues(issues, process.actors.map((actor) => actor.id), 'duplicate-actor-id', `/processPortfolio/processes/${process.id}/actors`, (id) => `actor:${process.id}:${id}`);
    addDuplicateIdIssues(issues, process.statuses.map((status) => status.id), 'duplicate-status-id', `/processPortfolio/processes/${process.id}/statuses`, (id) => `status:${process.id}:${id}`);
    addDuplicateIdIssues(issues, process.stages.map((stage) => stage.id), 'duplicate-stage-id', `/processPortfolio/processes/${process.id}/stages`, (id) => stageNodeId(process.id, id));
    addDuplicateIdIssues(issues, process.steps.map((step) => step.id), 'duplicate-step-id', `/processPortfolio/processes/${process.id}/steps`, (id) => `step:${process.id}:${id}`);
    addDuplicateIdIssues(issues, process.transitions.map((transition) => transition.id), 'duplicate-transition-id', `/processPortfolio/processes/${process.id}/transitions`, (id) => `transition:${process.id}:${id}`);
    addDuplicateIdIssues(issues, process.outcomes.map((outcome) => outcome.id), 'duplicate-outcome-id', `/processPortfolio/processes/${process.id}/outcomes`, (id) => `outcome:${process.id}:${id}`);

    const actorIds = new Set(process.actors.map((actor) => actor.id));
    const statusIds = new Set(process.statuses.map((status) => status.id));
    const stageIds = new Set(process.stages.map((stage) => stage.id));
    const stepIds = new Set(process.steps.map((step) => step.id));
    const outcomeIds = new Set(process.outcomes.map((outcome) => outcome.id));

    process.stages.forEach((stage) => {
      if (stage.actorId && !actorIds.has(stage.actorId)) {
        issues.push(issue('error', 'missing-stage-actor', `Stage '${stage.id}' references missing actor '${stage.actorId}'.`, `/processPortfolio/processes/${process.id}/stages/${stage.id}/actorId`, stageNodeId(process.id, stage.id)));
      }
      if (stage.statusId && !statusIds.has(stage.statusId)) {
        issues.push(issue('error', 'missing-stage-status', `Stage '${stage.id}' references missing status '${stage.statusId}'.`, `/processPortfolio/processes/${process.id}/stages/${stage.id}/statusId`, stageNodeId(process.id, stage.id)));
      }
      stage.stepIds.forEach((stepId) => {
        if (!stepIds.has(stepId)) {
          issues.push(issue('error', 'missing-stage-step-reference', `Stage '${stage.id}' references missing step '${stepId}'.`, `/processPortfolio/processes/${process.id}/stages/${stage.id}/stepIds`, stageNodeId(process.id, stage.id)));
        }
      });
      stage.allowedOutcomeIds.forEach((outcomeId) => {
        if (!outcomeIds.has(outcomeId)) {
          issues.push(issue('error', 'missing-stage-outcome-reference', `Stage '${stage.id}' references missing outcome '${outcomeId}'.`, `/processPortfolio/processes/${process.id}/stages/${stage.id}/allowedOutcomeIds`, stageNodeId(process.id, stage.id)));
        }
      });
    });

    process.steps.forEach((step) => {
      if (!stageIds.has(step.stageId)) {
        issues.push(issue('error', 'missing-step-stage', `Step '${step.id}' references missing stage '${step.stageId}'.`, `/processPortfolio/processes/${process.id}/steps/${step.id}/stageId`, `step:${process.id}:${step.id}`));
      }
      if (step.ownerActorId && !actorIds.has(step.ownerActorId)) {
        issues.push(issue('error', 'missing-step-owner', `Step '${step.id}' references missing owner actor '${step.ownerActorId}'.`, `/processPortfolio/processes/${process.id}/steps/${step.id}/ownerActorId`, `step:${process.id}:${step.id}`));
      }
    });

    process.transitions.forEach((transition) => {
      if (!stageIds.has(transition.fromStageId)) {
        issues.push(issue('error', 'missing-transition-source', `Transition '${transition.id}' references missing source stage '${transition.fromStageId}'.`, `/processPortfolio/processes/${process.id}/transitions/${transition.id}/fromStageId`, `transition:${process.id}:${transition.id}`));
      }
      if (!stageIds.has(transition.toStageId)) {
        issues.push(issue('error', 'missing-transition-target', `Transition '${transition.id}' references missing target stage '${transition.toStageId}'.`, `/processPortfolio/processes/${process.id}/transitions/${transition.id}/toStageId`, `transition:${process.id}:${transition.id}`));
      }
      if (!outcomeIds.has(transition.outcomeId)) {
        issues.push(issue('error', 'missing-transition-outcome', `Transition '${transition.id}' references missing outcome '${transition.outcomeId}'.`, `/processPortfolio/processes/${process.id}/transitions/${transition.id}/outcomeId`, `transition:${process.id}:${transition.id}`));
      }
    });
  });

  addAmbiguousMainStageAnchorIssues(model, issues);
  return issues;
}

export function validateModel(model: DbmModelV1): DesignerIssue[] {
  const issues: DesignerIssue[] = [];
  const schemaValid = validateSchema(model);
  addSchemaIssues(issues, schemaValid, validateSchema.errors, 'schema-invalid', '');
  validatePortfolioModel(model).forEach((portfolioIssue) => issues.push(mapPortfolioIssue(model, portfolioIssue)));
  issues.push(...validateProcessSemantics(model));

  model.package.processUiSurfaces.forEach((surface) => {
    if (!model.package.supportedHosts.includes(surface)) {
      issues.push(issue('error', 'invalid-process-ui-surface', `package.processUiSurfaces contains '${surface}', which is not listed in package.supportedHosts.`, '/package/processUiSurfaces'));
    }
  });

  if (model.runtime.requestContract.schemaVersion !== 'dbm.runtime.request/v1') {
    issues.push(issue('error', 'invalid-runtime-request-version', 'runtime.requestContract.schemaVersion must remain dbm.runtime.request/v1.', '/runtime/requestContract/schemaVersion'));
  }
  if (model.runtime.resultContract.schemaVersion !== 'dbm.runtime.result/v1') {
    issues.push(issue('error', 'invalid-runtime-result-version', 'runtime.resultContract.schemaVersion must remain dbm.runtime.result/v1.', '/runtime/resultContract/schemaVersion'));
  }
  if (model.runtime.ownership.azure.responsibilities.length !== 1 || model.runtime.ownership.azure.responsibilities[0] !== 'support-services-only') {
    issues.push(issue('error', 'invalid-azure-ownership', 'Azure ownership must remain support-services-only in R1.3.', '/runtime/ownership/azure'));
  }

  return issues;
}

const librarySpecificGraphKeys = new Set([
  'sourceHandle',
  'targetHandle',
  'markerStart',
  'markerEnd',
  'positionAbsolute',
  'dragging',
  'selected',
  'deletable',
  'selectable'
]);

function validateNoLibrarySpecificKeys(issues: DesignerIssue[], value: unknown, path: string, code: string): void {
  if (!value || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateNoLibrarySpecificKeys(issues, entry, `${path}/${index}`, code));
    return;
  }
  Object.entries(value).forEach(([key, entry]) => {
    const nextPath = path === '/' ? `/${key}` : `${path}/${key}`;
    if (librarySpecificGraphKeys.has(key)) {
      issues.push(issue('error', code, `Library-specific key '${key}' is not allowed in persisted DBM designer contracts.`, nextPath));
    }
    validateNoLibrarySpecificKeys(issues, entry, nextPath, code);
  });
}

function validateWorkspace(workspace: DbmDesignerWorkspaceV1, graph: DbmDesignerGraphDocumentV1): DesignerIssue[] {
  const issues: DesignerIssue[] = [];
  const schemaValid = validateWorkspaceSchema(workspace);
  addSchemaIssues(issues, schemaValid, validateWorkspaceSchema.errors, 'workspace-schema-invalid', '/workspace');

  const graphNodeIds = new Set(graph.nodes.map((node) => node.id));
  Object.keys(workspace.nodePositions).forEach((nodeId) => {
    if (!isStableDesignerGraphNodeId(nodeId)) {
      issues.push(issue('error', 'workspace-graph-node-id-invalid', `Workspace nodePositions key '${nodeId}' is not a DBM-owned stable graph node identifier.`, `/workspace/nodePositions/${nodeId}`));
      return;
    }
    if (!graphNodeIds.has(nodeId)) {
      issues.push(issue('error', 'workspace-graph-node-id-missing', `Workspace nodePositions key '${nodeId}' does not exist in the derived graph document.`, `/workspace/nodePositions/${nodeId}`));
    }
  });

  return issues;
}

function validateGraphDocument(model: DbmModelV1, graph: DbmDesignerGraphDocumentV1): DesignerIssue[] {
  const issues: DesignerIssue[] = [];
  const schemaValid = validateGraphDocumentSchema(graph);
  addSchemaIssues(issues, schemaValid, validateGraphDocumentSchema.errors, 'graph-schema-invalid', '/graph');
  issues.push(...validateDesignerGraphDocument(graph));

  const rebuiltGraph = buildDesignerGraphDocument(model);
  if (JSON.stringify(rebuiltGraph) !== JSON.stringify(graph)) {
    issues.push(issue('error', 'graph-document-not-derived', 'Designer graph document must be deterministically rebuildable from the canonical model.', '/graph'));
  }

  return issues;
}

export function validateDocument(document: DesignerDocument): DesignerIssue[] {
  const issues = validateModel(document.model);
  validateNoLibrarySpecificKeys(issues, document.model, '/', 'library-specific-model-key');
  validateNoLibrarySpecificKeys(issues, document.workspace, '/workspace', 'library-specific-workspace-key');
  validateNoLibrarySpecificKeys(issues, document.graph, '/graph', 'library-specific-graph-key');
  issues.push(...validateWorkspace(document.workspace, document.graph));
  issues.push(...validateGraphDocument(document.model, document.graph));
  return issues;
}
