import type { CSSProperties } from 'react';
import type { DesignerDocument, DesignerGraphIntent } from 'dbm-designer-core';
import { orderedProcesses } from 'dbm-designer-core';

interface SelectionEditorCardProps {
  document: DesignerDocument | null;
  selection?: unknown;
  focusToken?: number;
  onIntent?(intent: DesignerGraphIntent): void;
  onToggleStageCollapse?(stageId: string): void;
  isStageCollapsed?(stageId: string): boolean;
  compact?: boolean;
}

export function SelectionEditorCard({ document }: SelectionEditorCardProps) {
  if (!document) {
    return null;
  }

  const processCount = document.model.processPortfolio.processes.length;
  const stageCount = orderedProcesses(document.model).reduce((total, process) => total + process.stages.length, 0);

  return (
    <section style={cardStyle}>
      <div style={eyebrowStyle}>Selection editor</div>
      <h2 style={headingStyle}>Portfolio-native authoring</h2>
      <p style={copyStyle}>
        The active model contains {processCount} process(es) and {stageCount} stage(s). Detailed edits now flow through Timeline Studio controls and process-aware designer-core commands.
      </p>
    </section>
  );
}

const cardStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 14,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  background: '#ffffff'
};

const eyebrowStyle: CSSProperties = {
  color: '#64748b',
  fontSize: 12,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 0
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 18
};

const copyStyle: CSSProperties = {
  margin: 0,
  color: '#64748b',
  lineHeight: 1.5,
  fontSize: 14
};
