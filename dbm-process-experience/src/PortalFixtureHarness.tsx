import type { DbmProcessExperienceSnapshotV1 } from 'dbm-contract';
import { ProcessExperienceSurface } from './ProcessExperienceSurface';

interface PortalFixtureHarnessProps {
  snapshot: DbmProcessExperienceSnapshotV1 | null;
}

export function PortalFixtureHarness({ snapshot }: PortalFixtureHarnessProps) {
  return (
    <div style={fixtureShellStyle}>
      <ProcessExperienceSurface snapshot={snapshot} audience="portal" mode="portal-fixture" />
    </div>
  );
}

const fixtureShellStyle = {
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '2rem'
} as const;
