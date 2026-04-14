import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useState } from 'react';
import type { DataverseEntitySummary, DataverseFormSummary } from './dataverseMetadata';

export interface BlankStarterDraft {
  packageId: string;
  displayName: string;
  entityLogicalName: string;
  formId: string;
  currentUserActorDisplayName: string;
  systemActorDisplayName: string;
  draftStatusDisplayName: string;
  inProgressStatusDisplayName: string;
  completeStatusDisplayName: string;
}

interface StarterGalleryDialogProps {
  open: boolean;
  onOpenChange(nextOpen: boolean): void;
  modelDrivenAvailable: boolean;
  entities: DataverseEntitySummary[];
  forms: DataverseFormSummary[];
  metadataBusy: boolean;
  metadataError: string | null;
  onSelectEntity(entityLogicalName: string): void;
  onCreateReference(): void;
  onCreateBlank(draft: BlankStarterDraft): void;
}

type StarterKind = 'blank-existing-form' | 'approval-reference';

export function StarterGalleryDialog({
  open,
  onOpenChange,
  modelDrivenAvailable,
  entities,
  forms,
  metadataBusy,
  metadataError,
  onSelectEntity,
  onCreateReference,
  onCreateBlank
}: StarterGalleryDialogProps) {
  const [starterKind, setStarterKind] = useState<StarterKind>('blank-existing-form');
  const [packageId, setPackageId] = useState('dbm-custom-process');
  const [displayName, setDisplayName] = useState('DBM Custom Process');
  const [entityLogicalName, setEntityLogicalName] = useState('');
  const [formId, setFormId] = useState('');
  const [currentUserActorDisplayName, setCurrentUserActorDisplayName] = useState('Current User');
  const [systemActorDisplayName, setSystemActorDisplayName] = useState('Platform');
  const [draftStatusDisplayName, setDraftStatusDisplayName] = useState('Draft');
  const [inProgressStatusDisplayName, setInProgressStatusDisplayName] = useState('In Progress');
  const [completeStatusDisplayName, setCompleteStatusDisplayName] = useState('Complete');

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!entityLogicalName && entities[0]?.logicalName) {
      setEntityLogicalName(entities[0].logicalName);
      onSelectEntity(entities[0].logicalName);
    }
  }, [entities, entityLogicalName, onSelectEntity, open]);

  useEffect(() => {
    if (!open || !entityLogicalName) {
      return;
    }
    onSelectEntity(entityLogicalName);
  }, [entityLogicalName, onSelectEntity, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (forms.length === 0) {
      setFormId('');
      return;
    }
    if (!forms.some((form) => form.formId === formId)) {
      setFormId(forms[0].formId);
    }
  }, [formId, forms, open]);

  const canCreateBlank = useMemo(() => {
    return modelDrivenAvailable && !!entityLogicalName && !!formId && packageId.trim().length > 0 && displayName.trim().length > 0;
  }, [displayName, entityLogicalName, formId, modelDrivenAvailable, packageId]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content style={contentStyle}>
          <div style={eyebrowStyle}>Starter Gallery</div>
          <Dialog.Title style={titleStyle}>Create a DBM package</Dialog.Title>
          <Dialog.Description style={descriptionStyle}>
            Start from a guided existing-form scaffold or load the approval/reference sample.
          </Dialog.Description>

          <div style={starterGridStyle}>
            <button
              type="button"
              style={{ ...starterCardStyle, ...(starterKind === 'blank-existing-form' ? starterCardActiveStyle : {}) }}
              onClick={() => setStarterKind('blank-existing-form')}
              disabled={!modelDrivenAvailable}
            >
              <span style={starterTitleStyle}>Blank Existing-Form Starter</span>
              <span style={starterCopyStyle}>
                Pick a Dataverse table and main form, then start with a valid minimal DBM package.
              </span>
            </button>
            <button
              type="button"
              style={{ ...starterCardStyle, ...(starterKind === 'approval-reference' ? starterCardActiveStyle : {}) }}
              onClick={() => setStarterKind('approval-reference')}
            >
              <span style={starterTitleStyle}>Approval / Request Reference</span>
              <span style={starterCopyStyle}>
                Load the tracked reference sample for the existing approval/request scenario.
              </span>
            </button>
          </div>

          {starterKind === 'blank-existing-form' ? (
            <div style={panelStyle}>
              {!modelDrivenAvailable ? (
                <div style={warningStyle}>
                  Blank existing-form authoring is available only when the designer is hosted inside a model-driven Dataverse app.
                </div>
              ) : null}
              {metadataError ? <div style={warningStyle}>{metadataError}</div> : null}
              <div style={fieldGridStyle}>
                <label style={fieldStyle}>
                  <span>Package Id</span>
                  <input style={inputStyle} value={packageId} onChange={(event) => setPackageId(event.target.value)} />
                </label>
                <label style={fieldStyle}>
                  <span>Display Name</span>
                  <input style={inputStyle} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                </label>
                <label style={fieldStyle}>
                  <span>Primary Table</span>
                  <select
                    style={inputStyle}
                    value={entityLogicalName}
                    onChange={(event) => setEntityLogicalName(event.target.value)}
                    disabled={metadataBusy || entities.length === 0}
                  >
                    <option value="">Select a table</option>
                    {entities.map((entity) => (
                      <option key={entity.logicalName} value={entity.logicalName}>
                        {entity.schemaName} ({entity.logicalName})
                      </option>
                    ))}
                  </select>
                </label>
                <label style={fieldStyle}>
                  <span>Start Form</span>
                  <select style={inputStyle} value={formId} onChange={(event) => setFormId(event.target.value)} disabled={metadataBusy || forms.length === 0}>
                    <option value="">Select a form</option>
                    {forms.map((form) => (
                      <option key={form.formId} value={form.formId}>
                        {form.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div style={fieldGridStyle}>
                <label style={fieldStyle}>
                  <span>Current User Actor</span>
                  <input style={inputStyle} value={currentUserActorDisplayName} onChange={(event) => setCurrentUserActorDisplayName(event.target.value)} />
                </label>
                <label style={fieldStyle}>
                  <span>System Actor</span>
                  <input style={inputStyle} value={systemActorDisplayName} onChange={(event) => setSystemActorDisplayName(event.target.value)} />
                </label>
                <label style={fieldStyle}>
                  <span>Draft Status</span>
                  <input style={inputStyle} value={draftStatusDisplayName} onChange={(event) => setDraftStatusDisplayName(event.target.value)} />
                </label>
                <label style={fieldStyle}>
                  <span>In Progress Status</span>
                  <input style={inputStyle} value={inProgressStatusDisplayName} onChange={(event) => setInProgressStatusDisplayName(event.target.value)} />
                </label>
                <label style={fieldStyle}>
                  <span>Complete Status</span>
                  <input style={inputStyle} value={completeStatusDisplayName} onChange={(event) => setCompleteStatusDisplayName(event.target.value)} />
                </label>
              </div>
            </div>
          ) : (
            <div style={panelStyle}>
              <div style={descriptionStyle}>
                The reference sample remains available for regression checks and side-by-side comparison while R2.5 closes the generic authoring gap.
              </div>
            </div>
          )}

          <div style={buttonRowStyle}>
            <Dialog.Close asChild>
              <button type="button" style={secondaryButtonStyle}>Cancel</button>
            </Dialog.Close>
            {starterKind === 'approval-reference' ? (
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => {
                  onCreateReference();
                  onOpenChange(false);
                }}
              >
                Use Reference Starter
              </button>
            ) : (
              <button
                type="button"
                style={primaryButtonStyle}
                disabled={!canCreateBlank}
                onClick={() => {
                  onCreateBlank({
                    packageId: packageId.trim(),
                    displayName: displayName.trim(),
                    entityLogicalName,
                    formId,
                    currentUserActorDisplayName: currentUserActorDisplayName.trim(),
                    systemActorDisplayName: systemActorDisplayName.trim(),
                    draftStatusDisplayName: draftStatusDisplayName.trim(),
                    inProgressStatusDisplayName: inProgressStatusDisplayName.trim(),
                    completeStatusDisplayName: completeStatusDisplayName.trim()
                  });
                  onOpenChange(false);
                }}
              >
                Create Blank Starter
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.36)',
  backdropFilter: 'blur(6px)',
  zIndex: 40
} as const;

const contentStyle = {
  position: 'fixed',
  inset: '8vh 10vw auto',
  maxHeight: '84vh',
  overflow: 'auto',
  padding: '1.25rem',
  borderRadius: '1.2rem',
  border: '1px solid #d6d3d1',
  background: 'rgba(255,255,255,0.97)',
  boxShadow: '0 28px 70px rgba(15, 23, 42, 0.22)',
  zIndex: 41,
  display: 'grid',
  gap: '1rem'
} as const;

const eyebrowStyle = {
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#64748b'
} as const;

const titleStyle = {
  margin: 0,
  fontSize: '1.5rem',
  color: '#0f172a'
} as const;

const descriptionStyle = {
  color: '#475569',
  fontSize: '0.95rem'
} as const;

const starterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '0.85rem'
} as const;

const starterCardStyle = {
  padding: '1rem',
  borderRadius: '1rem',
  border: '1px solid #d6d3d1',
  background: '#fff',
  display: 'grid',
  gap: '0.4rem',
  textAlign: 'left',
  cursor: 'pointer'
} as const;

const starterCardActiveStyle = {
  borderColor: '#b45309',
  background: '#fff7ed',
  boxShadow: '0 14px 28px rgba(180, 83, 9, 0.14)'
} as const;

const starterTitleStyle = {
  fontWeight: 700,
  color: '#111827'
} as const;

const starterCopyStyle = {
  color: '#475569',
  fontSize: '0.9rem'
} as const;

const panelStyle = {
  display: 'grid',
  gap: '0.85rem',
  padding: '1rem',
  borderRadius: '1rem',
  border: '1px solid #e7e5e4',
  background: '#f8fafc'
} as const;

const fieldGridStyle = {
  display: 'grid',
  gap: '0.75rem',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
} as const;

const fieldStyle = {
  display: 'grid',
  gap: '0.35rem',
  fontSize: '0.88rem',
  color: '#334155'
} as const;

const inputStyle = {
  padding: '0.72rem 0.8rem',
  borderRadius: '0.9rem',
  border: '1px solid #d6d3d1',
  background: '#fff'
} as const;

const warningStyle = {
  padding: '0.75rem 0.9rem',
  borderRadius: '0.9rem',
  border: '1px solid #fdba74',
  background: '#fff7ed',
  color: '#9a3412'
} as const;

const buttonRowStyle = {
  display: 'flex',
  gap: '0.7rem',
  justifyContent: 'flex-end',
  flexWrap: 'wrap'
} as const;

const primaryButtonStyle = {
  padding: '0.76rem 1rem',
  borderRadius: '0.9rem',
  border: '1px solid #8b5e34',
  background: '#b45309',
  color: '#fff',
  cursor: 'pointer'
} as const;

const secondaryButtonStyle = {
  padding: '0.76rem 1rem',
  borderRadius: '0.9rem',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#111827',
  cursor: 'pointer'
} as const;
