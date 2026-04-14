import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { ProcessExperienceSurface } from './ProcessExperienceSurface';
import { buildRuntimeProcessExperienceSnapshot } from './runtime-snapshot';
import { approvalRequestRuntimeModel } from './test-fixtures/approvalRequestFixture';
test('buildRuntimeProcessExperienceSnapshot collapses hidden stages for portal projection and surfaces cross-form handoff', () => {
    const snapshot = buildRuntimeProcessExperienceSnapshot(approvalRequestRuntimeModel, {
        stageId: 'manager-review',
        stepId: 'review-request',
        formStateId: 'review-state',
        internalStatusId: 'under-review',
        portalStatusId: 'under-review'
    }, {
        audience: 'portal',
        currentFormId: 'request-form'
    });
    expect(snapshot.stages.find((stage) => stage.id === 'manager-review')?.visibility).toBe('collapsed-hidden');
    expect(snapshot.projection.message ?? '').toMatch(/different DBM form/i);
    expect(snapshot.projection.message ?? '').toMatch(/internal stage/i);
});
test('ProcessExperienceSurface renders available outcomes and callback actions', async () => {
    const user = userEvent.setup();
    const events = [];
    const snapshot = buildRuntimeProcessExperienceSnapshot(approvalRequestRuntimeModel, {
        stageId: 'draft-request',
        stepId: 'capture-request',
        formStateId: 'request-basic-state',
        internalStatusId: 'draft',
        portalStatusId: 'draft'
    }, {
        currentFormId: 'request-form'
    });
    render(_jsx(ProcessExperienceSurface, { snapshot: snapshot, mode: "model-driven-section", navigationTarget: {
            label: 'Request Details',
            tabName: 'request_main_tab',
            sectionName: 'request_details_section',
            controlName: 'dbm_title'
        }, onNavigateToFormRegion: (target) => events.push(`navigate:${target.controlName}`), onInvokeOutcome: (outcomeId) => events.push(`outcome:${outcomeId}`), onRequestFocus: (targetId) => events.push(`focus:${targetId}`) }));
    await user.click(screen.getByText('Draft Request'));
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText('Capture Request')).toBeTruthy();
    expect(events).toEqual(['focus:stage:draft-request', 'outcome:submit']);
});
