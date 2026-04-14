import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { ProcessExperienceSurface } from './ProcessExperienceSurface';
import { buildRuntimeProcessExperienceSnapshot } from './runtime-snapshot';
const runtimeModel = {
    packageId: 'dbm-package',
    packageVersion: '1.0.0',
    processId: 'approval-request',
    actors: [
        { id: 'requester', displayName: 'Requester', actorType: 'requester' },
        { id: 'approver', displayName: 'Manager Approver', actorType: 'approver' }
    ],
    statuses: [
        { id: 'draft', displayName: 'Draft', audience: 'shared', kind: 'progress' },
        { id: 'under-review', displayName: 'Under Review', audience: 'shared', kind: 'progress' }
    ],
    outcomes: [
        { id: 'submit', displayName: 'Submit' },
        { id: 'approve', displayName: 'Approve' }
    ],
    stages: [
        {
            id: 'draft-request',
            displayName: 'Draft Request',
            stageType: 'start',
            actorId: 'requester',
            formId: 'request-form',
            portalVisibility: 'visible',
            stepIds: ['capture-request'],
            defaultStepId: 'capture-request',
            allowedOutcomeIds: ['submit']
        },
        {
            id: 'manager-review',
            displayName: 'Manager Review',
            stageType: 'approval',
            actorId: 'approver',
            formId: 'review-form',
            portalVisibility: 'hidden',
            stepIds: ['review-request'],
            defaultStepId: 'review-request',
            allowedOutcomeIds: ['approve']
        }
    ],
    steps: [
        {
            id: 'capture-request',
            stageId: 'draft-request',
            displayName: 'Capture Request',
            stepType: 'data-entry',
            ownerActorId: 'requester',
            internalStatusId: 'draft',
            portalStatusId: 'draft',
            formStateId: 'request-basic-state'
        },
        {
            id: 'review-request',
            stageId: 'manager-review',
            displayName: 'Review Request',
            stepType: 'approval',
            ownerActorId: 'approver',
            internalStatusId: 'under-review',
            portalStatusId: 'under-review',
            formStateId: 'review-state'
        }
    ],
    transitions: [
        { id: 'submit-request', fromStageId: 'draft-request', toStageId: 'manager-review', outcomeId: 'submit' }
    ]
};
test('buildRuntimeProcessExperienceSnapshot collapses hidden stages for portal projection and surfaces cross-form handoff', () => {
    const snapshot = buildRuntimeProcessExperienceSnapshot(runtimeModel, {
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
    const snapshot = buildRuntimeProcessExperienceSnapshot(runtimeModel, {
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
