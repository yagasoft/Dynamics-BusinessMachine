import type { DataverseEntitySummary, DataverseFormSummary, DataverseImportedFormBundle } from './dataverseMetadata';

interface MetadataBrowserPanelProps {
  available: boolean;
  entities: DataverseEntitySummary[];
  forms: DataverseFormSummary[];
  selectedEntityLogicalName: string;
  selectedFormId: string;
  bundle: DataverseImportedFormBundle | null;
  loading: boolean;
  error: string | null;
  onSelectEntity(entityLogicalName: string): void;
  onSelectForm(formId: string): void;
  onImportSelected(): void;
}

export function MetadataBrowserPanel({
  available,
  entities,
  forms,
  selectedEntityLogicalName,
  selectedFormId,
  bundle,
  loading,
  error,
  onSelectEntity,
  onSelectForm,
  onImportSelected
}: MetadataBrowserPanelProps) {
  return (
    <div style={panelStyle}>
      <div style={eyebrowStyle}>Dataverse Metadata</div>
      {!available ? (
        <div style={mutedStyle}>
          Live metadata browsing is available only in the model-driven hosted designer.
        </div>
      ) : (
        <>
          {error ? <div style={warningStyle}>{error}</div> : null}
          <label style={fieldStyle}>
            <span>Table</span>
            <select style={inputStyle} value={selectedEntityLogicalName} onChange={(event) => onSelectEntity(event.target.value)} disabled={loading || entities.length === 0}>
              <option value="">Select a table</option>
              {entities.map((entity) => (
                <option key={entity.logicalName} value={entity.logicalName}>
                  {entity.schemaName} ({entity.logicalName})
                </option>
              ))}
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Main Form</span>
            <select style={inputStyle} value={selectedFormId} onChange={(event) => onSelectForm(event.target.value)} disabled={loading || forms.length === 0}>
              <option value="">Select a form</option>
              {forms.map((form) => (
                <option key={form.formId} value={form.formId}>
                  {form.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" style={primaryButtonStyle} onClick={onImportSelected} disabled={!bundle || loading}>
            Import Selected Form
          </button>
          {bundle ? (
            <div style={summaryCardStyle}>
              <div style={summaryTitleStyle}>{bundle.form.displayName}</div>
              <div style={metaRowStyle}>Entity: {bundle.entitySummary.schemaName} ({bundle.entitySummary.logicalName})</div>
              <div style={metaRowStyle}>Fields: {bundle.entity.fields.length}</div>
              <div style={metaRowStyle}>Sections: {bundle.regions.length}</div>
              <div style={metaRowStyle}>Imported Relationships: {bundle.importedRelationships.length}</div>
              {bundle.regions.length > 0 ? (
                <div style={chipWrapStyle}>
                  {bundle.regions.map((region) => (
                    <span key={region.id} style={chipStyle}>
                      {region.displayName} ({region.controlCount})
                    </span>
                  ))}
                </div>
              ) : null}
              {bundle.availableRelationships.length > 0 ? (
                <div style={listStyle}>
                  {bundle.availableRelationships.map((relationship) => (
                    <div key={relationship.id} style={listItemStyle}>
                      {relationship.logicalName}
                      <span style={mutedTinyStyle}>
                        {relationship.sourceEntityLogicalName} {'->'} {relationship.targetEntityLogicalName}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={mutedStyle}>No related Dataverse relationships were discovered for this table.</div>
              )}
            </div>
          ) : (
            <div style={mutedStyle}>
              Select a Dataverse table and main form to inspect fields, regions, and relationships before importing them into the DBM model.
            </div>
          )}
        </>
      )}
    </div>
  );
}

const panelStyle = {
  padding: '1rem',
  borderRadius: '1rem',
  border: '1px solid #d6d3d1',
  background: 'rgba(255,255,255,0.9)',
  display: 'grid',
  gap: '0.8rem'
} as const;

const eyebrowStyle = {
  fontSize: '0.78rem',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#64748b'
} as const;

const fieldStyle = {
  display: 'grid',
  gap: '0.32rem',
  color: '#334155',
  fontSize: '0.88rem'
} as const;

const inputStyle = {
  padding: '0.68rem 0.78rem',
  borderRadius: '0.86rem',
  border: '1px solid #d6d3d1',
  background: '#fff'
} as const;

const primaryButtonStyle = {
  padding: '0.72rem 0.95rem',
  borderRadius: '0.9rem',
  border: '1px solid #8b5e34',
  background: '#b45309',
  color: '#fff',
  cursor: 'pointer'
} as const;

const summaryCardStyle = {
  display: 'grid',
  gap: '0.55rem',
  padding: '0.85rem',
  borderRadius: '0.9rem',
  border: '1px solid #e2e8f0',
  background: '#f8fbff'
} as const;

const summaryTitleStyle = {
  fontWeight: 700,
  color: '#0f172a'
} as const;

const metaRowStyle = {
  fontSize: '0.86rem',
  color: '#475569'
} as const;

const chipWrapStyle = {
  display: 'flex',
  gap: '0.45rem',
  flexWrap: 'wrap'
} as const;

const chipStyle = {
  padding: '0.28rem 0.55rem',
  borderRadius: '999px',
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  fontSize: '0.76rem',
  color: '#1d4ed8'
} as const;

const listStyle = {
  display: 'grid',
  gap: '0.45rem'
} as const;

const listItemStyle = {
  display: 'grid',
  gap: '0.15rem',
  padding: '0.55rem 0.65rem',
  borderRadius: '0.8rem',
  border: '1px solid #e2e8f0',
  background: '#fff',
  fontSize: '0.82rem',
  color: '#334155'
} as const;

const mutedStyle = {
  color: '#6b7280',
  fontSize: '0.9rem'
} as const;

const mutedTinyStyle = {
  color: '#64748b',
  fontSize: '0.76rem'
} as const;

const warningStyle = {
  padding: '0.72rem 0.85rem',
  borderRadius: '0.85rem',
  border: '1px solid #fdba74',
  background: '#fff7ed',
  color: '#9a3412'
} as const;
