import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DbmModelV1 } from 'dbm-contract';
import { loadModel } from 'dbm-designer-core';
import employeeOnboarding from '../../dbm-contract/fixtures/valid/generic-process-matrix/employee-onboarding.model.json';
import { GraphCanvas } from './graphCanvas';

describe('GraphCanvas', () => {
  it('renders the React Flow timeline canvas from a process portfolio document', () => {
    const document = loadModel(structuredClone(employeeOnboarding as DbmModelV1));

    render(<GraphCanvas document={document} onSelectionChange={vi.fn()} />);

    expect(screen.getByTestId('timeline-graph-canvas')).toBeTruthy();
  });
});
