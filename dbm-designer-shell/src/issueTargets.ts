import type { DesignerDocument, DesignerIssue } from 'dbm-designer-core';

export interface IssueDecorationSummary {
  level: DesignerIssue['level'];
  count: number;
  issues: DesignerIssue[];
}

const directGraphTargetPrefixes = ['stage:', 'step:', 'outcome:', 'transition:', 'step-transition:'] as const;

function levelRank(level: DesignerIssue['level']): number {
  switch (level) {
    case 'error':
      return 3;
    case 'warning':
      return 2;
    case 'info':
      return 1;
  }
}

function parseFormStateNodeId(nodeId: string): { formId: string; stateId: string } | null {
  const match = /^form-state:([^:]+):(.+)$/.exec(nodeId);
  if (!match) {
    return null;
  }

  return {
    formId: match[1],
    stateId: match[2]
  };
}

export function resolveIssueTargetIds(document: DesignerDocument, issue: DesignerIssue): string[] {
  if (!issue.nodeId) {
    return [];
  }

  if (directGraphTargetPrefixes.some((prefix) => issue.nodeId?.startsWith(prefix))) {
    return [issue.nodeId];
  }

  const formStateRef = parseFormStateNodeId(issue.nodeId);
  if (formStateRef) {
    const stepTargets = document.model.process.steps
      .filter((step) => {
        if (step.formStateId !== formStateRef.stateId) {
          return false;
        }

        const stage = document.model.process.stages.find((candidate) => candidate.id === step.stageId);
        return stage?.formId === formStateRef.formId;
      })
      .map((step) => `step:${step.id}`);

    if (stepTargets.length > 0) {
      return stepTargets;
    }

    return document.model.process.stages
      .filter((stage) => stage.formId === formStateRef.formId)
      .map((stage) => `stage:${stage.id}`);
  }

  return [];
}

export function resolveIssueNavigationTargetId(document: DesignerDocument, issue: DesignerIssue): string | null {
  return resolveIssueTargetIds(document, issue)[0] ?? issue.nodeId ?? null;
}

export function buildIssueDecorationMap(document: DesignerDocument): Record<string, IssueDecorationSummary> {
  const summaries: Record<string, IssueDecorationSummary> = {};

  document.issues.forEach((issue) => {
    const targetIds = resolveIssueTargetIds(document, issue);
    targetIds.forEach((targetId) => {
      const existing = summaries[targetId];
      if (!existing) {
        summaries[targetId] = {
          level: issue.level,
          count: 1,
          issues: [issue]
        };
        return;
      }

      existing.count += 1;
      existing.issues.push(issue);
      if (levelRank(issue.level) > levelRank(existing.level)) {
        existing.level = issue.level;
      }
    });
  });

  return summaries;
}
