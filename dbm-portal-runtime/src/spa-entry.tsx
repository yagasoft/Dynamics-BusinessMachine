import { createRoot } from 'react-dom/client';
import { LocalProofShell } from './LocalProofShell.js';

const target = document.getElementById('dbm-local-proof-root');
if (!target) {
  throw new Error('Local proof host is missing #dbm-local-proof-root.');
}

createRoot(target).render(<LocalProofShell />);
