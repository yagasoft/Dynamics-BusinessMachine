import { jsx as _jsx } from "react/jsx-runtime";
import { createRoot } from 'react-dom/client';
import { ProcessExperienceSurface } from './ProcessExperienceSurface';
import { buildRuntimeProcessExperienceSnapshot } from './runtime-snapshot';
const roots = new WeakMap();
function getRoot(target) {
    const existing = roots.get(target);
    if (existing) {
        return existing;
    }
    const root = createRoot(target);
    roots.set(target, root);
    return root;
}
function render(target, props) {
    getRoot(target).render(_jsx(ProcessExperienceSurface, { ...props }));
}
function unmount(target) {
    const existing = roots.get(target);
    if (!existing) {
        return;
    }
    existing.unmount();
    roots.delete(target);
}
export function registerBrowserHost() {
    const globalScope = globalThis;
    globalScope.DBM = globalScope.DBM ?? {};
    globalScope.DBM.ProcessExperienceHost = {
        render,
        unmount,
        buildRuntimeProcessExperienceSnapshot
    };
}
