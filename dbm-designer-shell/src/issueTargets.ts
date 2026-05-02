import type { DesignerDocument, DesignerIssue } from 'dbm-designer-core';
import { PROCESS_PORTFOLIO_NODE_ID, processNodeId, stageNodeId } from 'dbm-designer-core';

export interface IssueDecorationSummary {
  level: DesignerIssue['level'];
  count: number;
  issues: DesignerIssue[];
}

function addTarget(targets: string[], targetId: string | null | undefined) {
  if (targetId && !targets.includes(targetId)) {
    targets.push(targetId);
  }
}

function processTargetFromPath(document: DesignerDocument, path: string): string | null {
  const match = /\/processPortfolio\/processes\/(?<processRef>[^/]+)/.exec(path);
  const processRef = match?.groups?.processRef;
  if (!processRef) {
    return null;
  }

  const byId = document.model.processPortfolio.processes.find((process) => process.id === processRef);
  if (byId) {
    return processNodeId(byId.id);
  }

  const index = Number(processRef);
  const byIndex = Number.isInteger(index) ? document.model.processPortfolio.processes[index] : null;
  return byIndex ? processNodeId(byIndex.id) : null;
}

function stageTargetFromPath(document: DesignerDocument, path: string): string | null {
  const match = /\/processPortfolio\/processes\/(?<processRef>[^/]+)\/stages\/(?<stageRef>[^/]+)/.exec(path);
  const processRef = match?.groups?.processRef;
  const stageRef = match?.groups?.stageRef;
  if (!processRef || !stageRef) {
    return null;
  }

  const process = document.model.processPortfolio.processes.find((entry) => entry.id === processRef)
    ?? document.model.processPortfolio.processes[Number(processRef)];
  const stage = process?.stages.find((entry) => entry.id === stageRef) ?? process?.stages[Number(stageRef)];
  return process && stage ? stageNodeId(process.id, stage.id) : null;
}

export function resolveIssueTargetIds(document: DesignerDocument, issue: DesignerIssue): string[] {
  const targets: string[] = [];
  addTarget(targets, issue.nodeId);
  addTarget(targets, stageTargetFromPath(document, issue.path));
  addTarget(targets, processTargetFromPath(document, issue.path));
  if (issue.path.startsWith('/processPortfolio')) {
    addTarget(targets, PROCESS_PORTFOLIO_NODE_ID);
  }

  return targets;
}

export function resolveIssueNavigationTargetId(document: DesignerDocument, issue: DesignerIssue): string | null {
  return resolveIssueTargetIds(document, issue)[0] ?? null;
}

export function buildIssueDecorationMap(document: DesignerDocument): Record<string, IssueDecorationSummary> {
  const summaries: Record<string, IssueDecorationSummary> = {};
  document.issues.forEach((issue) => {
    resolveIssueTargetIds(document, issue).forEach((targetId) => {
      const summary = summaries[targetId] ?? { level: issue.level, count: 0, issues: [] };
      summary.count += 1;
      summary.issues.push(issue);
      if (issue.level === 'error' || (issue.level === 'warning' && summary.level === 'info')) {
        summary.level = issue.level;
      }
      summaries[targetId] = summary;
    });
  });

  return summaries;
}
