import { useState } from 'react';
import { DesignerShell } from './DesignerShell';
import { createPackageRepository, type DbmPackageRepository } from './packageRepository';

export function App() {
  const [repository] = useState<DbmPackageRepository>(() => createPackageRepository());
  return <DesignerShell repository={repository} />;
}
