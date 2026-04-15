import { jsx as _jsx } from "react/jsx-runtime";
import { createRoot } from 'react-dom/client';
import { PortalRuntimeApp } from './PortalRuntimeApp';
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
function mount(target, props) {
    getRoot(target).render(_jsx(PortalRuntimeApp, { ...props }));
}
function unmount(target) {
    const existing = roots.get(target);
    if (!existing) {
        return;
    }
    existing.unmount();
    roots.delete(target);
}
export function registerPortalRuntimeBrowserHost() {
    const globalScope = globalThis;
    globalScope.DBM = globalScope.DBM ?? {};
    globalScope.DBM.PortalRuntime = {
        mount,
        unmount
    };
}
