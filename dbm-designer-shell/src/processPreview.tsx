import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import { ProcessExperienceSurface } from 'dbm-process-experience';

interface ProcessPreviewProps {
  snapshot: DbmProcessExperienceSnapshotV1 | null;
}

export function ProcessPreview({ snapshot }: ProcessPreviewProps) {
  return <ProcessExperienceSurface snapshot={snapshot} mode="designer-preview" />;
}
