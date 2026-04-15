import { createRoot, type Root } from 'react-dom/client';
import { PortalRuntimeApp } from './PortalRuntimeApp';
import type { DbmPortalRuntimeAppProps } from './types';

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

function mount(target: HTMLElement, props: DbmPortalRuntimeAppProps): void {
  getRoot(target).render(<PortalRuntimeApp {...props} />);
}

function unmount(target: HTMLElement): void {
  const existing = roots.get(target);
  if (!existing) {
    return;
  }

  existing.unmount();
  roots.delete(target);
}

export function registerPortalRuntimeBrowserHost(): void {
  const globalScope = globalThis as typeof globalThis & { DBM?: Record<string, unknown> };
  globalScope.DBM = globalScope.DBM ?? {};
  globalScope.DBM.PortalRuntime = {
    mount,
    unmount
  };
}
