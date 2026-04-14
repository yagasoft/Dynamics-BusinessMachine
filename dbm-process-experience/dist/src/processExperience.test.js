import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, within } from '@testing-library/react';
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
test('ProcessExperienceSurface renders a guided workspace, callbacks, and flow drawer', async () => {
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
    expect(screen.getByText('What to do now')).toBeTruthy();
    expect(screen.getByText('Fill in the details needed to keep this request moving.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'View flow' }));
    const flowHeading = screen.getByText('How this request can move');
    expect(flowHeading).toBeTruthy();
    const flowDrawer = flowHeading.closest('aside');
    expect(flowDrawer).toBeTruthy();
    expect(within(flowDrawer).getAllByText('Manager Review').length).toBeGreaterThan(0);
    const trackerButton = screen
        .getAllByRole('button')
        .find((button) => button.textContent?.includes('Draft Request'));
    const stepSequenceCard = screen.getByText('Step sequence').parentElement;
    const stepButton = stepSequenceCard
        ? within(stepSequenceCard).getByRole('button')
        : null;
    expect(trackerButton).toBeTruthy();
    expect(stepButton).toBeTruthy();
    await user.click(trackerButton);
    await user.click(stepButton);
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(events).toEqual(['focus:stage:draft-request', 'focus:step:capture-request', 'outcome:submit']);
});
test('ProcessExperienceSurface keeps hidden portal stages read-only and friendly', () => {
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
    render(_jsx(ProcessExperienceSurface, { snapshot: snapshot, mode: "portal-fixture", audience: "portal", onInvokeOutcome: () => {
            throw new Error('Portal hidden stages should not surface direct actions.');
        } }));
    expect(screen.getByText('Under internal review')).toBeTruthy();
    expect(screen.getByText('No action is needed from this surface right now.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
});
test('ProcessExperienceSurface keeps cross-form handoff navigation visible', async () => {
    const user = userEvent.setup();
    const events = [];
    const snapshot = buildRuntimeProcessExperienceSnapshot(approvalRequestRuntimeModel, {
        stageId: 'manager-review',
        stepId: 'review-request',
        formStateId: 'review-state',
        internalStatusId: 'under-review',
        portalStatusId: 'under-review'
    }, {
        audience: 'internal',
        currentFormId: 'request-form'
    });
    render(_jsx(ProcessExperienceSurface, { snapshot: snapshot, mode: "model-driven-section", navigationTarget: {
            label: 'Review Details',
            tabName: 'review_main_tab',
            sectionName: 'review_summary_section',
            controlName: 'dbm_review_status'
        }, onNavigateToFormRegion: (target) => events.push(`navigate:${target.controlName}`) }));
    await user.click(screen.getByRole('button', { name: 'Open Review Details' }));
    expect(events).toEqual(['navigate:dbm_review_status']);
});
