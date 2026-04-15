import { jsx as _jsx } from "react/jsx-runtime";
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { ProcessExperienceSurface } from './ProcessExperienceSurface';
import { buildRuntimeProcessExperienceSnapshot } from './runtime-snapshot';
import { approvalRequestRuntimeModel, buildApprovalRequestSnapshot } from './test-fixtures/approvalRequestFixture';
const genericTerminalRuntimeModel = {
    packageId: 'dbm-case-assignment',
    packageVersion: '1.0.0',
    processId: 'case-assignment-process',
    actors: [
        { id: 'requester', displayName: 'Requester', actorType: 'requester' },
        { id: 'case-worker', displayName: 'Case Worker', actorType: 'approver' },
        { id: 'platform', displayName: 'Platform', actorType: 'system' }
    ],
    statuses: [
        { id: 'draft', displayName: 'Draft', audience: 'shared', kind: 'progress' },
        { id: 'assigned', displayName: 'Assigned', audience: 'shared', kind: 'progress' },
        { id: 'complete', displayName: 'Complete', audience: 'shared', kind: 'terminal' }
    ],
    outcomes: [
        { id: 'submit', displayName: 'Submit' },
        { id: 'complete', displayName: 'Complete' }
    ],
    stages: [
        {
            id: 'draft-case',
            displayName: 'Draft Case',
            stageType: 'start',
            actorId: 'requester',
            formId: 'case-form',
            portalVisibility: 'visible',
            stepIds: ['capture-case'],
            defaultStepId: 'capture-case',
            allowedOutcomeIds: ['submit']
        },
        {
            id: 'assignment-work',
            displayName: 'Assignment Work',
            stageType: 'task',
            actorId: 'case-worker',
            formId: 'assignment-form',
            portalVisibility: 'visible',
            stepIds: ['prepare-assignment'],
            defaultStepId: 'prepare-assignment',
            allowedOutcomeIds: ['complete']
        },
        {
            id: 'completed',
            displayName: 'Completed',
            stageType: 'end',
            actorId: 'platform',
            formId: null,
            portalVisibility: 'visible',
            stepIds: [],
            defaultStepId: null,
            allowedOutcomeIds: []
        }
    ],
    steps: [
        {
            id: 'capture-case',
            stageId: 'draft-case',
            displayName: 'Capture Case',
            stepType: 'data-entry',
            ownerActorId: 'requester',
            internalStatusId: 'draft',
            portalStatusId: 'draft',
            formStateId: 'case-edit-state'
        },
        {
            id: 'prepare-assignment',
            stageId: 'assignment-work',
            displayName: 'Prepare Assignment',
            stepType: 'data-entry',
            ownerActorId: 'case-worker',
            internalStatusId: 'assigned',
            portalStatusId: 'assigned',
            formStateId: 'assignment-work-state'
        }
    ],
    transitions: [
        { id: 'submit-case', fromStageId: 'draft-case', toStageId: 'assignment-work', outcomeId: 'submit' },
        { id: 'complete-assignment', fromStageId: 'assignment-work', toStageId: 'completed', outcomeId: 'complete' }
    ]
};
afterEach(() => {
    cleanup();
});
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
test('ProcessExperienceSurface renders an external-runtime entry shell before a draft exists', async () => {
    const user = userEvent.setup();
    const events = [];
    render(_jsx(ProcessExperienceSurface, { snapshot: null, mode: "external-runtime", audience: "portal", portalShell: {
            entryTitle: 'Start your request',
            entrySummary: 'Create a draft request to begin the local external entry flow.',
            requestStateLabel: 'Ready to start',
            sameSessionEnabled: true,
            actions: {
                'create-draft': {
                    enabled: true
                },
                'refresh-status': {
                    enabled: false
                }
            }
        }, onPortalAction: (actionId) => events.push(actionId) }));
    expect(screen.getByText('Start your request')).toBeTruthy();
    expect(screen.getByText(/local external entry flow/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    expect(events).toEqual(['create-draft']);
});
test('ProcessExperienceSurface uses portal shell actions for the external runtime mode', async () => {
    const user = userEvent.setup();
    const events = [];
    const snapshot = buildApprovalRequestSnapshot('portal-runtime-draft');
    render(_jsx(ProcessExperienceSurface, { snapshot: snapshot, mode: "external-runtime", audience: "portal", portalShell: {
            entryTitle: 'Approval request portal',
            entrySummary: 'Continue the request from this browser session.',
            requestReference: 'Request draft',
            requestStateLabel: 'Draft',
            sameSessionEnabled: true,
            actions: {
                'submit-request': {
                    enabled: true,
                    helperText: 'Move the request into internal screening.'
                },
                'refresh-status': {
                    enabled: true
                }
            }
        }, onPortalAction: (actionId) => events.push(actionId), onInvokeOutcome: () => {
            throw new Error('External runtime mode should use portal shell actions for submission.');
        } }));
    expect(screen.getByText('Approval request portal')).toBeTruthy();
    expect(screen.getByText('Request draft')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Submit request' }).length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole('button', { name: 'Submit request' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Refresh status' })[0]);
    expect(events).toEqual(['submit-request', 'refresh-status']);
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
test('ProcessExperienceSurface auto-opens the flow for model-driven handoff states and exposes Edit process', async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
        value: [{ appmoduleid: 'test-app-id' }]
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    }));
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
    render(_jsx(ProcessExperienceSurface, { snapshot: snapshot, mode: "model-driven-section", designerEntryUrl: "/main.aspx?pagetype=webresource&webresourceName=ys_%2Fdbm%2Fapps%2Feditor%2Findex.html&data=%7B%22packageName%22%3A%22dbm-testtableone-to-testtabletwo%22%7D" }));
    expect(screen.getByRole('button', { name: 'Hide flow' })).toBeTruthy();
    expect(screen.getByText('How this request can move')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Edit process' }));
    expect(openSpy).toHaveBeenCalledWith('http://localhost:3000/main.aspx?appid=test-app-id&pagetype=webresource&webresourceName=ys_%2Fdbm%2Fapps%2Feditor%2Findex.html&data=%7B%22packageName%22%3A%22dbm-testtableone-to-testtabletwo%22%7D', '_blank', 'noopener');
    fetchSpy.mockRestore();
    openSpy.mockRestore();
});
test('ProcessExperienceSurface can transition from an empty snapshot to a loaded snapshot without hook-order errors', () => {
    const snapshot = buildRuntimeProcessExperienceSnapshot(approvalRequestRuntimeModel, {
        stageId: 'draft-request',
        stepId: 'capture-request',
        formStateId: 'request-basic-state',
        internalStatusId: 'draft',
        portalStatusId: 'draft'
    }, {
        currentFormId: 'request-form'
    });
    const rendered = render(_jsx(ProcessExperienceSurface, { snapshot: null, mode: "designer-preview" }));
    expect(screen.getByText(/process experience becomes available/i)).toBeTruthy();
    rendered.rerender(_jsx(ProcessExperienceSurface, { snapshot: snapshot, mode: "designer-preview" }));
    expect(screen.getByText('What to do now')).toBeTruthy();
    expect(screen.getAllByText('Draft Request').length).toBeGreaterThan(0);
});
test('buildRuntimeProcessExperienceSnapshot allows a terminal end stage without an active step', () => {
    const snapshot = buildRuntimeProcessExperienceSnapshot(genericTerminalRuntimeModel, {
        stageId: 'completed',
        stepId: 'prepare-assignment',
        formStateId: 'assignment-work-state',
        internalStatusId: 'complete',
        portalStatusId: 'complete'
    }, {
        currentFormId: 'assignment-form'
    });
    expect(snapshot.currentStageId).toBe('completed');
    expect(snapshot.currentStepId).toBeNull();
    expect(snapshot.activeFormStateId).toBeNull();
    expect(snapshot.internalStatus?.id).toBe('complete');
    expect(snapshot.projection.projectedStepId).toBeNull();
});
test('ProcessExperienceSurface renders a friendly terminal guided workspace without actions', () => {
    const snapshot = buildRuntimeProcessExperienceSnapshot(genericTerminalRuntimeModel, {
        stageId: 'completed',
        stepId: 'prepare-assignment',
        formStateId: 'assignment-work-state',
        internalStatusId: 'complete',
        portalStatusId: 'complete'
    }, {
        currentFormId: 'assignment-form'
    });
    render(_jsx(ProcessExperienceSurface, { snapshot: snapshot, mode: "model-driven-section", onInvokeOutcome: () => {
            throw new Error('Terminal state should not offer outcomes.');
        } }));
    expect(screen.getByText('Process complete')).toBeTruthy();
    expect(screen.getByText('This request has reached its end state. You can review the completed journey below if needed.')).toBeTruthy();
    expect(screen.getByText('No action is needed from this surface right now.')).toBeTruthy();
    expect(screen.getByText('This workflow has finished. No further action is required from this surface.')).toBeTruthy();
});
