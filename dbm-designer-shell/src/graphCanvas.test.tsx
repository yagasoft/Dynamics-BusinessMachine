import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApprovalRequestTemplate, createDefaultWorkspace, loadModelPackage } from 'dbm-designer-core';
import { GraphCanvas } from './graphCanvas';

const originalResizeObserver = globalThis.ResizeObserver;
const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

class ResizeObserverMock {
  observe() {
    // no-op for jsdom
  }

  unobserve() {
    // no-op for jsdom
  }

  disconnect() {
    // no-op for jsdom
  }
}

beforeAll(() => {
  globalThis.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;

  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1200,
      bottom: 720,
      width: 1200,
      height: 720,
      toJSON() {
        return this;
      }
    } as DOMRect;
  };

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return 1200;
    }
  });

  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return 720;
    }
  });

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 1200;
    }
  });

  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 720;
    }
  });
});

afterAll(() => {
  globalThis.ResizeObserver = originalResizeObserver;
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;

  if (originalOffsetWidth) {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
  }

  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
  }

  if (originalClientWidth) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
  }

  if (originalClientHeight) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight);
  }
});

afterEach(() => {
  cleanup();
});

describe('GraphCanvas', () => {
  it('renders visible stage and step labels for a loaded approval request package', async () => {
    const template = createApprovalRequestTemplate();
    const workspace = createDefaultWorkspace(template);
    workspace.collapsedNodeIds = workspace.collapsedNodeIds.filter((nodeId) => nodeId !== 'stage:draft-request');
    const document = loadModelPackage(template, workspace);
    const onSelectionChange = vi.fn();
    const onGraphIntent = vi.fn();
    const onNodePositionCommit = vi.fn();
    const onToggleStageCollapse = vi.fn();

    const { container } = render(
      React.createElement(
        'div',
        { style: { width: '1200px', height: '720px' } },
        React.createElement(GraphCanvas, {
          document,
          onSelectionChange,
          onGraphIntent,
          onNodePositionCommit,
          onToggleStageCollapse,
          focusTargetId: null,
          focusRequestToken: 0
        })
      )
    );

    await waitFor(() => {
      expect(container.querySelector('.react-flow')).toBeTruthy();
    });

    const draftRequestLabels = await screen.findAllByText('Draft Request');
    const captureRequestLabels = await screen.findAllByText('Capture Request');

    expect(draftRequestLabels.length).toBeGreaterThan(0);
    expect(captureRequestLabels.length).toBeGreaterThan(0);
    expect(container.querySelector('.react-flow__controls')).toBeTruthy();
  });

  it('renders inline validation markers on graph nodes when designer issues target them', async () => {
    const template = createApprovalRequestTemplate();
    template.process.stages[0].allowedOutcomeIds = ['missing-outcome'];
    const workspace = createDefaultWorkspace(template);
    const document = loadModelPackage(template, workspace);

    const { container } = render(
      React.createElement(
        'div',
        { style: { width: '1200px', height: '720px' } },
        React.createElement(GraphCanvas, {
          document,
          onSelectionChange: vi.fn(),
          onGraphIntent: vi.fn(),
          onNodePositionCommit: vi.fn(),
          onToggleStageCollapse: vi.fn(),
          focusTargetId: null,
          focusRequestToken: 0
        })
      )
    );

    await waitFor(() => {
      expect(container.querySelector('[title*=\"references missing outcome\"]')).toBeTruthy();
    });
  });
});
