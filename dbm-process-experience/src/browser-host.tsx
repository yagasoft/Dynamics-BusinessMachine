import { createRoot, type Root } from 'react-dom/client';
import { ProcessExperienceSurface } from './ProcessExperienceSurface';
import { buildProcessPortfolioExperienceSnapshot, buildRuntimeProcessExperienceSnapshot } from './runtime-snapshot';
import type { ProcessExperienceSurfaceProps } from './types';

const roots = new WeakMap<HTMLElement, Root>();

function getRoot(target: HTMLElement): Root {
  const existing = roots.get(target);
  if (existing) {
    return existing;
  }

  const root = createRoot(target);
  roots.set(target, root);
  return root;
}

function render(target: HTMLElement, props: ProcessExperienceSurfaceProps): void {
  getRoot(target).render(<ProcessExperienceSurface {...props} />);
}

function unmount(target: HTMLElement): void {
  const existing = roots.get(target);
  if (!existing) {
    return;
  }

  existing.unmount();
  roots.delete(target);
}

export function registerBrowserHost(): void {
  const globalScope = globalThis as typeof globalThis & { DBM?: Record<string, unknown> };
  globalScope.DBM = globalScope.DBM ?? {};
  globalScope.DBM.ProcessExperienceHost = {
    render,
    unmount,
    buildProcessPortfolioExperienceSnapshot,
    buildRuntimeProcessExperienceSnapshot
  };
}
