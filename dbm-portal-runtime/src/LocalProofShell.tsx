import { useEffect, useMemo, useState } from 'react';
import { PortalRuntimeApp } from './PortalRuntimeApp.js';
import { portalRuntimeBootstrap, portalRuntimeModel } from './generated-plan.js';
import {
  getPortalRuntimeSessionStorageKey,
  PORTAL_RUNTIME_SESSION_EVENT
} from './session.js';

type LocalProofHealth = {
  status: string;
  environment: string;
  dataverseUrl: string;
  hostPackageName: string;
};

type RouteKind = 'entry' | 'status' | 'unknown';

function normalizePathname(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  const normalized = pathname.replace(/\/+$/, '');
  return normalized.length > 0 ? normalized : '/';
}

function resolveRouteKind(pathname: string): RouteKind {
  const normalized = normalizePathname(pathname);
  if (normalized === portalRuntimeBootstrap.routes.entryPath) {
    return 'entry';
  }

  if (normalized === portalRuntimeBootstrap.routes.statusPath) {
    return 'status';
  }

  return 'unknown';
}

function getDraftSessionPresence(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.sessionStorage.getItem(getPortalRuntimeSessionStorageKey(portalRuntimeBootstrap)));
}

function shortDataverseHost(dataverseUrl: string | null): string {
  if (!dataverseUrl) {
    return 'Live Dataverse';
  }

  try {
    return new URL(dataverseUrl).host;
  } catch {
    return dataverseUrl;
  }
}

export function LocalProofShell() {
  const [pathname, setPathname] = useState(() =>
    typeof window === 'undefined' ? portalRuntimeBootstrap.routes.entryPath : normalizePathname(window.location.pathname)
  );
  const [hasSession, setHasSession] = useState(() => getDraftSessionPresence());
  const [health, setHealth] = useState<LocalProofHealth | null>(null);
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

        return response.json() as Promise<LocalProofHealth>;
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

  function navigateTo(path: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.history.pushState({}, '', path);
    setPathname(normalizePathname(path));
  }

  return (
    <div style={pageShellStyle}>
      <div style={pageBackdropStyle} />
      <main style={contentShellStyle}>
        <header style={heroStyle}>
          <div style={heroCopyStyle}>
            <div style={eyebrowStyle}>R3.1 Local SPA Runtime Proof</div>
            <h1 style={headlineStyle}>External entry stays local while Dataverse keeps authority.</h1>
            <p style={introStyle}>
              This proof host runs entirely on your machine, proxies live Dev Dataverse through a local Node runtime,
              and keeps hidden internal workflow details out of the external shell.
            </p>
          </div>
          <div style={heroMetaStyle}>
            <button
              type="button"
              style={routeKind === 'entry' ? primaryNavButtonStyle : secondaryNavButtonStyle}
              onClick={() => navigateTo(portalRuntimeBootstrap.routes.entryPath)}
            >
              Approval Request
            </button>
            <button
              type="button"
              style={routeKind === 'status' ? primaryNavButtonStyle : secondaryNavButtonStyle}
              onClick={() => navigateTo(portalRuntimeBootstrap.routes.statusPath)}
            >
              Request Status
            </button>
            <div style={badgeRowStyle}>
              <span style={badgeStyle}>Local Node proxy</span>
              <span style={badgeStyle}>Generic profile proof</span>
              <span style={badgeStyle}>{shortDataverseHost(health?.dataverseUrl ?? null)}</span>
            </div>
          </div>
        </header>

        {routeKind === 'unknown' ? (
          <section style={noticeCardStyle}>
            <div style={noticeLabelStyle}>Unknown route</div>
            <h2 style={noticeTitleStyle}>Use one of the proof routes to continue.</h2>
            <p style={noticeCopyStyle}>
              This local proof currently serves the approval-request entry and status routes only.
            </p>
            <div style={badgeRowStyle}>
              <button
                type="button"
                style={primaryNavButtonStyle}
                onClick={() => navigateTo(portalRuntimeBootstrap.routes.entryPath)}
              >
                Open entry route
              </button>
              <button
                type="button"
                style={secondaryNavButtonStyle}
                onClick={() => navigateTo(portalRuntimeBootstrap.routes.statusPath)}
              >
                Open status route
              </button>
            </div>
          </section>
        ) : routeKind === 'status' && !hasSession ? (
          <section style={noticeCardStyle}>
            <div style={noticeLabelStyle}>Same-session continuity</div>
            <h2 style={noticeTitleStyle}>No local request is active in this browser session yet.</h2>
            <p style={noticeCopyStyle}>
              Start the request from the entry route first, then come back here to prove the refreshed external runtime
              shell.
            </p>
            <button
              type="button"
              style={primaryNavButtonStyle}
              onClick={() => navigateTo(portalRuntimeBootstrap.routes.entryPath)}
            >
              Start a request
            </button>
          </section>
        ) : (
          <section style={runtimeShellStyle}>
            <div style={runtimeHeaderStyle}>
              <div>
                <div style={runtimeLabelStyle}>
                  {routeKind === 'entry' ? 'Entry route' : 'Status route'}
                </div>
                <h2 style={runtimeTitleStyle}>
                  {routeKind === 'entry' ? 'Approval request intake' : 'Portal-visible status view'}
                </h2>
              </div>
              {health ? (
                <div style={runtimeHealthStyle}>
                  <span>Environment: {health.environment}</span>
                  <span>Status: {health.status}</span>
                </div>
              ) : null}
            </div>
            <PortalRuntimeApp
              bootstrap={portalRuntimeBootstrap}
              runtimeModel={portalRuntimeModel}
              apiBasePath="/api/runtime"
              storage={typeof window !== 'undefined' ? window.sessionStorage : null}
            />
          </section>
        )}
      </main>
    </div>
  );
}

const pageShellStyle = {
  minHeight: '100vh',
  position: 'relative',
  overflow: 'hidden',
  background: '#f6f1e8',
  color: '#17212e'
} as const;

const pageBackdropStyle = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(circle at top left, rgba(207, 155, 54, 0.22), transparent 38%), linear-gradient(180deg, #f4ecde 0%, #f8f4ec 48%, #efe6d4 100%)'
} as const;

const contentShellStyle = {
  position: 'relative',
  zIndex: 1,
  maxWidth: '1180px',
  margin: '0 auto',
  padding: '2.25rem 1.25rem 2.75rem',
  display: 'grid',
  gap: '1.25rem'
} as const;

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
} as const;

const heroCopyStyle = {
  display: 'grid',
  gap: '0.7rem'
} as const;

const eyebrowStyle = {
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.16em',
  color: '#7a5b1e',
  fontWeight: 700
} as const;

const headlineStyle = {
  margin: 0,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: 'clamp(2rem, 3.6vw, 3.35rem)',
  lineHeight: 1.02,
  color: '#1f2937'
} as const;

const introStyle = {
  margin: 0,
  fontSize: '1rem',
  lineHeight: 1.6,
  color: '#4b5563',
  maxWidth: '60ch'
} as const;

const heroMetaStyle = {
  display: 'grid',
  gap: '0.8rem',
  justifyItems: 'start',
  alignContent: 'start',
  padding: '1rem',
  borderRadius: '1.2rem',
  background: 'rgba(23, 33, 46, 0.94)',
  color: '#f7f3ea'
} as const;

const badgeRowStyle = {
  display: 'flex',
  gap: '0.55rem',
  flexWrap: 'wrap'
} as const;

const badgeStyle = {
  padding: '0.45rem 0.72rem',
  borderRadius: '999px',
  border: '1px solid rgba(241, 211, 140, 0.35)',
  background: 'rgba(255,255,255,0.08)',
  color: '#f7f3ea',
  fontSize: '0.82rem',
  fontWeight: 700
} as const;

const primaryNavButtonStyle = {
  padding: '0.78rem 1rem',
  borderRadius: '0.95rem',
  border: '1px solid #c48b12',
  background: '#d7961f',
  color: '#1f2937',
  fontWeight: 800,
  cursor: 'pointer'
} as const;

const secondaryNavButtonStyle = {
  padding: '0.78rem 1rem',
  borderRadius: '0.95rem',
  border: '1px solid rgba(255,255,255,0.2)',
  background: 'rgba(255,255,255,0.08)',
  color: '#f7f3ea',
  fontWeight: 700,
  cursor: 'pointer'
} as const;

const noticeCardStyle = {
  display: 'grid',
  gap: '0.7rem',
  padding: '1.35rem',
  borderRadius: '1.4rem',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.94) 0%, rgba(255,248,238,0.92) 100%)',
  border: '1px solid rgba(176, 136, 56, 0.22)'
} as const;

const noticeLabelStyle = {
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.14em',
  color: '#8b5e00',
  fontWeight: 800
} as const;

const noticeTitleStyle = {
  margin: 0,
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '1.45rem'
} as const;

const noticeCopyStyle = {
  margin: 0,
  color: '#5b6470',
  lineHeight: 1.6
} as const;

const runtimeShellStyle = {
  display: 'grid',
  gap: '1rem',
  padding: '1.15rem',
  borderRadius: '1.5rem',
  background: 'rgba(255,255,255,0.9)',
  border: '1px solid rgba(176, 136, 56, 0.18)',
  boxShadow: '0 16px 44px rgba(93, 71, 24, 0.08)'
} as const;

const runtimeHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '1rem',
  flexWrap: 'wrap',
  alignItems: 'center'
} as const;

const runtimeLabelStyle = {
  fontSize: '0.76rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#8b5e00',
  fontWeight: 800
} as const;

const runtimeTitleStyle = {
  margin: '0.2rem 0 0',
  fontFamily: 'Georgia, "Times New Roman", serif',
  fontSize: '1.5rem'
} as const;

const runtimeHealthStyle = {
  display: 'flex',
  gap: '0.55rem',
  flexWrap: 'wrap',
  fontSize: '0.86rem',
  color: '#576273'
} as const;
