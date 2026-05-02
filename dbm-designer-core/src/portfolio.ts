import type { DbmModelV1, DbmProcessV1, DbmStageV1 } from 'dbm-contract';

type ModelSource = DbmModelV1 | { model: DbmModelV1 };

function sourceModel(source: ModelSource): DbmModelV1 {
  return 'model' in source ? source.model : source;
}

export function resolveMainProcess(source: ModelSource): DbmProcessV1 {
  const model = sourceModel(source);
  const process = model.processPortfolio.processes.find((entry) => entry.id === model.processPortfolio.mainProcessId);
  if (!process) {
    throw new Error('processPortfolio.mainProcessId does not resolve to a process.');
  }

  return process;
}

export function findProcess(model: DbmModelV1, processId: string): DbmProcessV1 | undefined {
  return model.processPortfolio.processes.find((process) => process.id === processId);
}

export function orderedProcesses(model: DbmModelV1): DbmProcessV1[] {
  return [...model.processPortfolio.processes].sort((left, right) => {
    if (left.id === model.processPortfolio.mainProcessId) {
      return -1;
    }
    if (right.id === model.processPortfolio.mainProcessId) {
      return 1;
    }

    return (left.renderOrder ?? 0) - (right.renderOrder ?? 0) || left.displayName.localeCompare(right.displayName);
  });
}

export function findProcessContainingStage(model: DbmModelV1, stageId: string): DbmProcessV1 | undefined {
  return model.processPortfolio.processes.find((process) => process.stages.some((stage) => stage.id === stageId));
}

export function uniqueId(existingIds: string[], prefix: string): string {
  let counter = 1;
  let candidate = prefix;
  while (existingIds.includes(candidate)) {
    counter += 1;
    candidate = `${prefix}-${counter}`;
  }
  return candidate;
}

export function insertAt<T>(items: T[], value: T, index?: number): void {
  if (typeof index !== 'number' || index < 0 || index >= items.length) {
    items.push(value);
    return;
  }

  items.splice(index, 0, value);
}

export function moveWithin<T>(items: T[], currentIndex: number, targetIndex: number): void {
  if (currentIndex < 0 || currentIndex >= items.length) {
    return;
  }

  const boundedTarget = Math.max(0, Math.min(targetIndex, items.length - 1));
  const [item] = items.splice(currentIndex, 1);
  items.splice(boundedTarget, 0, item);
}

export function normaliseChildProcessRefsForStage(stage: DbmStageV1): DbmStageV1 {
  if (stage.childProcessRefs) {
    return stage;
  }

  return {
    ...stage,
    childProcessRefs: []
  };
}
