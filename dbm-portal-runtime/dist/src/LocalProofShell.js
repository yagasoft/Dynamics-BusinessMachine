import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { PortalRuntimeApp } from './PortalRuntimeApp';
import { portalRuntimeBootstrap, portalRuntimeModel } from './generated-plan';
import { getPortalRuntimeSessionStorageKey, PORTAL_RUNTIME_SESSION_EVENT } from './session';
function normalizePathname(pathname) {
    if (!pathname) {
        return '/';
    }
    const normalized = pathname.replace(/\/+$/, '');
    return normalized.length > 0 ? normalized : '/';
}
function resolveRouteKind(pathname) {
    const normalized = normalizePathname(pathname);
    if (normalized === portalRuntimeBootstrap.routes.entryPath) {
        return 'entry';
    }
    if (normalized === portalRuntimeBootstrap.routes.statusPath) {
        return 'status';
    }
    return 'unknown';
}
function getDraftSessionPresence() {
    if (typeof window === 'undefined') {
        return false;
    }
    return Boolean(window.sessionStorage.getItem(getPortalRuntimeSessionStorageKey(portalRuntimeBootstrap)));
}
function shortDataverseHost(dataverseUrl) {
    if (!dataverseUrl) {
        return 'Live Dataverse';
    }
    try {
        return new URL(dataverseUrl).host;
    }
    catch {
        return dataverseUrl;
    }
}
export function LocalProofShell() {
    const [pathname, setPathname] = useState(() => typeof window === 'undefined' ? portalRuntimeBootstrap.routes.entryPath : normalizePathname(window.location.pathname));
    const [hasSession, setHasSession] = useState(() => getDraftSessionPresence());
    const [health, setHealth] = useState(null);
    const routeKind = useMemo(() => resolveRouteKind(pathname), [pathname]);
    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const handleNavigation = () => {
            setPathname(normalizePathname(window.location.pathname));
        };
        const handleSessionChange = () => {
            setHasSession(getDraftSessionPresence());
        };
        window.addEventListener('popstate', handleNavigation);
        window.addEventListener(PORTAL_RUNTIME_SESSION_EVENT, handleSessionChange);
        return () => {
            window.removeEventListener('popstate', handleNavigation);
            window.removeEventListener(PORTAL_RUNTIME_SESSION_EVENT, handleSessionChange);
        };
    }, []);
    useEffect(() => {
        let cancelled = false;
        void fetch('/api/runtime/health', { headers: { Accept: 'application/json' } })
            .then(async (response) => {
            if (!response.ok) {
                throw new Error(`Health check failed with status ${response.status}.`);
            }
            return response.json();
        })
            .then((nextHealth) => {
            if (!cancelled) {
                setHealth(nextHealth);
            }
        })
            .catch(() => {
            if (!cancelled) {
                setHealth(null);
            }
        });
        return () => {
            cancelled = true;
        };
    }, []);
    function navigateTo(path) {
        if (typeof window === 'undefined') {
            return;
        }
        window.history.pushState({}, '', path);
        setPathname(normalizePathname(path));
    }
    return (_jsxs("div", { style: pageShellStyle, children: [_jsx("div", { style: pageBackdropStyle }), _jsxs("main", { style: contentShellStyle, children: [_jsxs("header", { style: heroStyle, children: [_jsxs("div", { style: heroCopyStyle, children: [_jsx("div", { style: eyebrowStyle, children: "R3.1 Local SPA Runtime Proof" }), _jsx("h1", { style: headlineStyle, children: "External entry stays local while Dataverse keeps authority." }), _jsx("p", { style: introStyle, children: "This proof host runs entirely on your machine, proxies live Dev Dataverse through a local Node runtime, and keeps hidden internal screening details out of the external shell." })] }), _jsxs("div", { style: heroMetaStyle, children: [_jsx("button", { type: "button", style: routeKind === 'entry' ? primaryNavButtonStyle : secondaryNavButtonStyle, onClick: () => navigateTo(portalRuntimeBootstrap.routes.entryPath), children: "Approval Request" }), _jsx("button", { type: "button", style: routeKind === 'status' ? primaryNavButtonStyle : secondaryNavButtonStyle, onClick: () => navigateTo(portalRuntimeBootstrap.routes.statusPath), children: "Request Status" }), _jsxs("div", { style: badgeRowStyle, children: [_jsx("span", { style: badgeStyle, children: "Local Node proxy" }), _jsx("span", { style: badgeStyle, children: "Generic profile proof" }), _jsx("span", { style: badgeStyle, children: shortDataverseHost(health?.dataverseUrl ?? null) })] })] })] }), routeKind === 'unknown' ? (_jsxs("section", { style: noticeCardStyle, children: [_jsx("div", { style: noticeLabelStyle, children: "Unknown route" }), _jsx("h2", { style: noticeTitleStyle, children: "Use one of the proof routes to continue." }), _jsx("p", { style: noticeCopyStyle, children: "This local proof currently serves the approval-request entry and status routes only." }), _jsxs("div", { style: badgeRowStyle, children: [_jsx("button", { type: "button", style: primaryNavButtonStyle, onClick: () => navigateTo(portalRuntimeBootstrap.routes.entryPath), children: "Open entry route" }), _jsx("button", { type: "button", style: secondaryNavButtonStyle, onClick: () => navigateTo(portalRuntimeBootstrap.routes.statusPath), children: "Open status route" })] })] })) : routeKind === 'status' && !hasSession ? (_jsxs("section", { style: noticeCardStyle, children: [_jsx("div", { style: noticeLabelStyle, children: "Same-session continuity" }), _jsx("h2", { style: noticeTitleStyle, children: "No local request is active in this browser session yet." }), _jsx("p", { style: noticeCopyStyle, children: "Start the request from the entry route first, then come back here to prove the refreshed external runtime shell." }), _jsx("button", { type: "button", style: primaryNavButtonStyle, onClick: () => navigateTo(portalRuntimeBootstrap.routes.entryPath), children: "Start a request" })] })) : (_jsxs("section", { style: runtimeShellStyle, children: [_jsxs("div", { style: runtimeHeaderStyle, children: [_jsxs("div", { children: [_jsx("div", { style: runtimeLabelStyle, children: routeKind === 'entry' ? 'Entry route' : 'Status route' }), _jsx("h2", { style: runtimeTitleStyle, children: routeKind === 'entry' ? 'Approval request intake' : 'Portal-visible status view' })] }), health ? (_jsxs("div", { style: runtimeHealthStyle, children: [_jsxs("span", { children: ["Environment: ", health.environment] }), _jsxs("span", { children: ["Status: ", health.status] })] })) : null] }), _jsx(PortalRuntimeApp, { bootstrap: portalRuntimeBootstrap, runtimeModel: portalRuntimeModel, apiBasePath: "/api/runtime", storage: typeof window !== 'undefined' ? window.sessionStorage : null })] }))] })] }));
}
const pageShellStyle = {
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    background: '#f6f1e8',
    color: '#17212e'
};
const pageBackdropStyle = {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at top left, rgba(207, 155, 54, 0.22), transparent 38%), linear-gradient(180deg, #f4ecde 0%, #f8f4ec 48%, #efe6d4 100%)'
};
const contentShellStyle = {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '2.25rem 1.25rem 2.75rem',
    display: 'grid',
    gap: '1.25rem'
};
const heroStyle = {
    display: 'grid',
    gap: '1rem',
    gridTemplateColumns: 'minmax(0, 1.8fr) minmax(280px, 1fr)',
    alignItems: 'start',
    padding: '1.35rem',
    borderRadius: '1.7rem',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,248,235,0.94) 100%)',
    border: '1px solid rgba(176, 136, 56, 0.24)',
    boxShadow: '0 24px 60px rgba(93, 71, 24, 0.12)'
};
const heroCopyStyle = {
    display: 'grid',
    gap: '0.7rem'
};
const eyebrowStyle = {
    fontSize: '0.78rem',
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    color: '#7a5b1e',
    fontWeight: 700
};
const headlineStyle = {
    margin: 0,
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 'clamp(2rem, 3.6vw, 3.35rem)',
    lineHeight: 1.02,
    color: '#1f2937'
};
const introStyle = {
    margin: 0,
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#4b5563',
    maxWidth: '60ch'
};
const heroMetaStyle = {
    display: 'grid',
    gap: '0.8rem',
    justifyItems: 'start',
    alignContent: 'start',
    padding: '1rem',
    borderRadius: '1.2rem',
    background: 'rgba(23, 33, 46, 0.94)',
    color: '#f7f3ea'
};
const badgeRowStyle = {
    display: 'flex',
    gap: '0.55rem',
    flexWrap: 'wrap'
};
const badgeStyle = {
    padding: '0.45rem 0.72rem',
    borderRadius: '999px',
    border: '1px solid rgba(241, 211, 140, 0.35)',
    background: 'rgba(255,255,255,0.08)',
    color: '#f7f3ea',
    fontSize: '0.82rem',
    fontWeight: 700
};
const primaryNavButtonStyle = {
    padding: '0.78rem 1rem',
    borderRadius: '0.95rem',
    border: '1px solid #c48b12',
    background: '#d7961f',
    color: '#1f2937',
    fontWeight: 800,
    cursor: 'pointer'
};
const secondaryNavButtonStyle = {
    padding: '0.78rem 1rem',
    borderRadius: '0.95rem',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.08)',
    color: '#f7f3ea',
    fontWeight: 700,
    cursor: 'pointer'
};
const noticeCardStyle = {
    display: 'grid',
    gap: '0.7rem',
    padding: '1.35rem',
    borderRadius: '1.4rem',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(255,248,238,0.92) 100%)',
    border: '1px solid rgba(176, 136, 56, 0.22)'
};
const noticeLabelStyle = {
    fontSize: '0.76rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: '#8b5e00',
    fontWeight: 800
};
const noticeTitleStyle = {
    margin: 0,
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '1.45rem'
};
const noticeCopyStyle = {
    margin: 0,
    color: '#5b6470',
    lineHeight: 1.6
};
const runtimeShellStyle = {
    display: 'grid',
    gap: '1rem',
    padding: '1.15rem',
    borderRadius: '1.5rem',
    background: 'rgba(255,255,255,0.9)',
    border: '1px solid rgba(176, 136, 56, 0.18)',
    boxShadow: '0 16px 44px rgba(93, 71, 24, 0.08)'
};
const runtimeHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap',
    alignItems: 'center'
};
const runtimeLabelStyle = {
    fontSize: '0.76rem',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#8b5e00',
    fontWeight: 800
};
const runtimeTitleStyle = {
    margin: '0.2rem 0 0',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '1.5rem'
};
const runtimeHealthStyle = {
    display: 'flex',
    gap: '0.55rem',
    flexWrap: 'wrap',
    fontSize: '0.86rem',
    color: '#576273'
};
