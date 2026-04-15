import { useEffect, useMemo, useState } from 'react';
import { ProcessExperienceSurface } from 'dbm-process-experience';
import {
  clearPortalRuntimeSessionState,
  loadPortalRuntimeSessionState,
  savePortalRuntimeSessionState
} from './session';
import {
  createPortalRuntimeDraft,
  refreshPortalRuntimeRecord,
  submitPortalRuntimeRequest
} from './portal-client';
import { buildPortalRuntimeSnapshot, buildPortalRuntimeViewModel } from './runtime';
import type { DbmPortalRuntimeAppProps, DbmPortalRuntimeRecordV1 } from './types';

function buildInitialDraftValues(props: DbmPortalRuntimeAppProps): Record<string, string> {
  const initialValues = props.initialDraftValues ?? {};
  const normalized: Record<string, string> = {};
  for (const field of props.bootstrap.entryFields) {
    const value = initialValues[field.logicalName];
    normalized[field.logicalName] = value == null ? '' : String(value);
  }

  return normalized;
}

function isBlankValue(value: string): boolean {
  return !value.trim();
}

function buildDraftValidationErrors(
  props: DbmPortalRuntimeAppProps,
  draftValues: Record<string, string>
): string[] {
  const errors: string[] = [];
  for (const field of props.bootstrap.entryFields) {
    const value = draftValues[field.logicalName] ?? '';
    if (field.required && isBlankValue(value)) {
      errors.push(`${field.displayName} is required before creating a portal draft.`);
      continue;
    }

    if (field.dataType === 'currency' || field.dataType === 'decimal' || field.dataType === 'integer') {
      if (!isBlankValue(value) && Number.isNaN(Number(value))) {
        errors.push(`${field.displayName} must be a valid number.`);
      }
    }
  }

  return errors;
}

function toDraftPayload(props: DbmPortalRuntimeAppProps, draftValues: Record<string, string>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of props.bootstrap.entryFields) {
    const rawValue = draftValues[field.logicalName] ?? '';
    if (isBlankValue(rawValue)) {
      continue;
    }

    switch (field.dataType) {
      case 'currency':
      case 'decimal':
        payload[field.logicalName] = Number(rawValue);
        break;
      case 'integer':
        payload[field.logicalName] = Number.parseInt(rawValue, 10);
        break;
      default:
        payload[field.logicalName] = rawValue.trim();
        break;
    }
  }

  return payload;
}

function getEntryInputType(dataType: string): string {
  switch (dataType) {
    case 'currency':
    case 'decimal':
    case 'integer':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

export function PortalRuntimeApp(props: DbmPortalRuntimeAppProps) {
  const [record, setRecord] = useState<DbmPortalRuntimeRecordV1 | null>(props.initialRecord ?? null);
  const [isBusy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draftValues, setDraftValues] = useState<Record<string, string>>(() => buildInitialDraftValues(props));
  const storage = props.storage ?? (typeof window !== 'undefined' ? window.sessionStorage : null);

  useEffect(() => {
    const session = loadPortalRuntimeSessionState(storage, props.bootstrap);
    if (!session?.requestId) {
      return;
    }

    let cancelled = false;
    setBusy(true);
    void refreshPortalRuntimeRecord({
      requestId: session.requestId,
      fetchImpl: props.fetchImpl,
      apiBasePath: props.apiBasePath
    })
      .then((nextRecord) => {
        if (!cancelled) {
          setRecord(nextRecord);
          setErrorMessage(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          clearPortalRuntimeSessionState(storage, props.bootstrap);
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [props.apiBasePath, props.bootstrap, props.fetchImpl, storage]);

  const draftValidationErrors = useMemo(
    () => buildDraftValidationErrors(props, draftValues),
    [props, draftValues]
  );
  const snapshot = useMemo(
    () => buildPortalRuntimeSnapshot(props.bootstrap, props.runtimeModel, record),
    [props.bootstrap, props.runtimeModel, record]
  );
  const viewModel = useMemo(
    () =>
      buildPortalRuntimeViewModel({
        bootstrap: props.bootstrap,
        runtimeModel: props.runtimeModel,
        record,
        isBusy,
        canCreateDraft: draftValidationErrors.length === 0,
        sameSessionEnabled: true
      }),
    [draftValidationErrors.length, isBusy, props.bootstrap, props.runtimeModel, record]
  );

  async function handlePortalAction(actionId: 'create-draft' | 'submit-request' | 'refresh-status') {
    setBusy(true);
    setErrorMessage(null);

    try {
      if (actionId === 'create-draft') {
        if (draftValidationErrors.length > 0) {
          setErrorMessage(draftValidationErrors[0] ?? 'Portal draft values are incomplete.');
          return;
        }

        const nextRecord = await createPortalRuntimeDraft({
          values: toDraftPayload(props, draftValues),
          fetchImpl: props.fetchImpl,
          apiBasePath: props.apiBasePath
        });

        savePortalRuntimeSessionState(storage, props.bootstrap, {
          requestId: nextRecord.id,
          requestReference: nextRecord.requestReference,
          sessionKey: nextRecord.id
        });
        setRecord(nextRecord);
        return;
      }

      if (!record) {
        return;
      }

      if (actionId === 'submit-request') {
        const submittedRecord = await submitPortalRuntimeRequest({
          requestId: record.id,
          fetchImpl: props.fetchImpl,
          apiBasePath: props.apiBasePath
        });

        savePortalRuntimeSessionState(storage, props.bootstrap, {
          requestId: submittedRecord.id,
          requestReference: submittedRecord.requestReference,
          sessionKey: submittedRecord.id
        });
        setRecord(submittedRecord);
        return;
      }

      const refreshedRecord = await refreshPortalRuntimeRecord({
        requestId: record.id,
        fetchImpl: props.fetchImpl,
        apiBasePath: props.apiBasePath
      });

      savePortalRuntimeSessionState(storage, props.bootstrap, {
        requestId: refreshedRecord.id,
        requestReference: refreshedRecord.requestReference,
        sessionKey: refreshedRecord.id
      });
      setRecord(refreshedRecord);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {errorMessage ? (
        <div
          style={{
            marginBottom: '1rem',
            padding: '0.85rem 1rem',
            borderRadius: '0.9rem',
            border: '1px solid #f5b7b1',
            background: '#fff5f5',
            color: '#8a1c1c'
          }}
        >
          {errorMessage}
        </div>
      ) : null}
      {!record ? (
        <section
          aria-label="Portal entry form"
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            borderRadius: '1rem',
            border: '1px solid #d7dee8',
            background: '#ffffff',
            display: 'grid',
            gap: '0.85rem'
          }}
        >
          <div style={{ display: 'grid', gap: '0.3rem' }}>
            <strong style={{ fontSize: '1rem' }}>Request details</strong>
            <span style={{ color: '#576273', fontSize: '0.92rem', lineHeight: 1.45 }}>
              Capture the approval request fields before creating the same-session portal draft.
            </span>
          </div>
          <div style={{ display: 'grid', gap: '0.85rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {props.bootstrap.entryFields.map((field) => (
              <label
                key={field.logicalName}
                style={{ display: 'grid', gap: '0.4rem', color: '#10233f', fontWeight: 600 }}
              >
                <span>
                  {field.displayName}
                  {field.required ? ' *' : ''}
                </span>
                {field.dataType === 'multiline-string' ? (
                  <textarea
                    aria-label={field.displayName}
                    value={draftValues[field.logicalName] ?? ''}
                    onChange={(event) => {
                      setDraftValues((current) => ({
                        ...current,
                        [field.logicalName]: event.target.value
                      }));
                    }}
                    rows={4}
                    style={{
                      width: '100%',
                      minHeight: '7rem',
                      borderRadius: '0.8rem',
                      border: '1px solid #cbd5e1',
                      padding: '0.7rem 0.85rem',
                      font: 'inherit'
                    }}
                  />
                ) : (
                  <input
                    aria-label={field.displayName}
                    type={getEntryInputType(field.dataType)}
                    inputMode={
                      field.dataType === 'currency' || field.dataType === 'decimal' || field.dataType === 'integer'
                        ? 'decimal'
                        : undefined
                    }
                    step={
                      field.dataType === 'integer'
                        ? '1'
                        : field.dataType === 'currency' || field.dataType === 'decimal'
                          ? '0.01'
                          : undefined
                    }
                    value={draftValues[field.logicalName] ?? ''}
                    onChange={(event) => {
                      setDraftValues((current) => ({
                        ...current,
                        [field.logicalName]: event.target.value
                      }));
                    }}
                    style={{
                      width: '100%',
                      borderRadius: '0.8rem',
                      border: '1px solid #cbd5e1',
                      padding: '0.7rem 0.85rem',
                      font: 'inherit'
                    }}
                  />
                )}
                {field.hint ? (
                  <span style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: 1.35 }}>
                    {field.hint}
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </section>
      ) : null}
      <ProcessExperienceSurface
        snapshot={snapshot}
        mode="external-runtime"
        audience="portal"
        portalShell={viewModel.portalShell}
        onPortalAction={(actionId) => {
          void handlePortalAction(actionId);
        }}
      />
    </div>
  );
}
