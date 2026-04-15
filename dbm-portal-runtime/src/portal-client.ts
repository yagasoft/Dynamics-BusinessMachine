import type {
  DbmPortalRuntimeCreateDraftOptions,
  DbmPortalRuntimeFetchOptions,
  DbmPortalRuntimeRecordV1,
  DbmPortalRuntimeRefreshOptions,
  DbmPortalRuntimeSubmitOptions
} from './types';

function getFetchImpl(options: DbmPortalRuntimeFetchOptions): typeof fetch {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new Error('Portal runtime requires fetch.');
  }

  return fetchImpl;
}

function normalizeApiBasePath(apiBasePath?: string): string {
  if (!apiBasePath) {
    return '/api/runtime';
  }

  const normalized = apiBasePath.trim().replace(/\/+$/, '');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function normalizeGuid(id: string): string {
  return id.replace(/[{}]/g, '');
}

async function parseResponse(response: Response): Promise<DbmPortalRuntimeRecordV1> {
  const payload = await response.json() as DbmPortalRuntimeRecordV1 | { message?: string };
  if (!response.ok) {
    throw new Error(
      typeof payload === 'object' && payload && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : `Portal runtime request failed with status ${response.status}.`
    );
  }

  return payload as DbmPortalRuntimeRecordV1;
}

export async function refreshPortalRuntimeRecord(
  options: DbmPortalRuntimeRefreshOptions
): Promise<DbmPortalRuntimeRecordV1> {
  const fetchImpl = getFetchImpl(options);
  const response = await fetchImpl(
    `${normalizeApiBasePath(options.apiBasePath)}/requests/${encodeURIComponent(normalizeGuid(options.requestId))}`,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json'
      }
    }
  );

  return parseResponse(response);
}

export async function createPortalRuntimeDraft(
  options: DbmPortalRuntimeCreateDraftOptions
): Promise<DbmPortalRuntimeRecordV1> {
  const fetchImpl = getFetchImpl(options);
  const response = await fetchImpl(`${normalizeApiBasePath(options.apiBasePath)}/drafts`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options.values)
  });

  return parseResponse(response);
}

export async function submitPortalRuntimeRequest(
  options: DbmPortalRuntimeSubmitOptions
): Promise<DbmPortalRuntimeRecordV1> {
  const fetchImpl = getFetchImpl(options);
  const response = await fetchImpl(
    `${normalizeApiBasePath(options.apiBasePath)}/requests/${encodeURIComponent(normalizeGuid(options.requestId))}/submit`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json'
      }
    }
  );

  return parseResponse(response);
}
