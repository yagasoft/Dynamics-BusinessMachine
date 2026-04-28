import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { parsePortalRuntimeBootstrap } from './bootstrap.js';
import { PortalRuntimeApp } from './PortalRuntimeApp.js';
import { createPortalRuntimeDraft, refreshPortalRuntimeRecord, submitPortalRuntimeRequest } from './portal-client.js';
import { getPortalRuntimeSessionStorageKey, loadPortalRuntimeSessionState, PORTAL_RUNTIME_SESSION_EVENT, savePortalRuntimeSessionState } from './session.js';
const bootstrap = {
    schemaVersion: 'dbm.portal-runtime.bootstrap/v1',
    packageId: 'dbm-approval-request',
    packageVersion: '1.2.1',
    processId: 'approval-request-process',
    identityMode: 'generic-profile',
    genericProfileKey: 'dev-anonymous-requester',
    routes: {
        entryPath: '/approval-request',
        statusPath: '/approval-request/status'
    },
    requestEntityLogicalName: 'dbm_request',
    requestEntitySetName: 'dbm_requests',
    startFormId: 'request-form',
    entryFields: [
        {
            logicalName: 'dbm_title',
            displayName: 'Request Title',
            dataType: 'string',
            required: true,
            hint: 'Enter the request title.'
        },
        {
            logicalName: 'dbm_amount',
            displayName: 'Request Amount',
            dataType: 'currency',
            required: true,
            hint: 'Enter the amount requested.'
        },
        {
            logicalName: 'dbm_assignedapprover',
            displayName: 'Assigned Approver',
            dataType: 'string',
            required: true,
            hint: 'Capture the assigned approver name.'
        },
        {
            logicalName: 'dbm_supportingnotes',
            displayName: 'Supporting Notes',
            dataType: 'multiline-string',
            required: false,
            hint: 'Explain why more detail is needed.'
        }
    ],
    portalCommandFieldLogicalName: 'dbm_portalcommand',
    runtimeStateFieldLogicalNames: {
        stageId: 'dbm_currentstageid',
        stepId: 'dbm_currentstepid',
        formStateId: 'dbm_currentformstateid',
        internalStatusId: 'dbm_internalstatusid',
        portalStatusId: 'dbm_portalstatusid',
        portalProfileKey: 'dbm_portalprofilekey'
    },
    defaultState: {
        stageId: 'draft-request',
        stepId: 'capture-request',
        formStateId: 'request-edit-state',
        internalStatusId: 'draft',
        portalStatusId: 'draft'
    },
    allowedActions: ['create-draft', 'submit-request', 'refresh-status']
};
const runtimeModel = {
    packageId: 'dbm-approval-request',
    packageVersion: '1.2.1',
    processId: 'approval-request-process',
    actors: [
        { id: 'requester', displayName: 'Requester', actorType: 'requester' },
        { id: 'finance-reviewer', displayName: 'Finance Reviewer', actorType: 'approver' }
    ],
    statuses: [
        { id: 'draft', displayName: 'Draft', audience: 'shared', kind: 'progress' },
        { id: 'under-review', displayName: 'Under Review', audience: 'shared', kind: 'progress' }
    ],
    outcomes: [{ id: 'submit', displayName: 'Submit' }],
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
            id: 'internal-screening-stage',
            displayName: 'Internal Screening',
            stageType: 'system',
            actorId: 'finance-reviewer',
            formId: 'request-form',
            portalVisibility: 'hidden',
            stepIds: ['screen-request'],
            defaultStepId: 'screen-request',
            allowedOutcomeIds: []
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
            formStateId: 'request-edit-state'
        },
        {
            id: 'screen-request',
            stageId: 'internal-screening-stage',
            displayName: 'Screen Request',
            stepType: 'review',
            ownerActorId: 'finance-reviewer',
            internalStatusId: 'under-review',
            portalStatusId: 'under-review',
            formStateId: 'request-screening-state'
        }
    ],
    transitions: [
        {
            id: 'submit-request',
            fromStageId: 'draft-request',
            toStageId: 'internal-screening-stage',
            outcomeId: 'submit'
        }
    ]
};
const draftRecord = {
    id: 'request-123',
    requestReference: 'Portal Request',
    values: {
        dbm_requestid: 'request-123',
        dbm_title: 'Portal Request',
        dbm_currentstageid: 'draft-request',
        dbm_currentstepid: 'capture-request',
        dbm_currentformstateid: 'request-edit-state',
        dbm_internalstatusid: 'draft',
        dbm_portalstatusid: 'draft'
    },
    runtimeState: {
        stageId: 'draft-request',
        stepId: 'capture-request',
        formStateId: 'request-edit-state',
        internalStatusId: 'draft',
        portalStatusId: 'draft'
    }
};
const submittedRecord = {
    id: 'request-123',
    requestReference: 'Portal Request',
    values: {
        dbm_requestid: 'request-123',
        dbm_title: 'Portal Request',
        dbm_currentstageid: 'internal-screening-stage',
        dbm_currentstepid: 'screen-request',
        dbm_currentformstateid: 'request-screening-state',
        dbm_internalstatusid: 'under-review',
        dbm_portalstatusid: 'under-review'
    },
    runtimeState: {
        stageId: 'internal-screening-stage',
        stepId: 'screen-request',
        formStateId: 'request-screening-state',
        internalStatusId: 'under-review',
        portalStatusId: 'under-review'
    }
};
afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
});
test('parsePortalRuntimeBootstrap accepts the host-neutral route payload', () => {
    const parsed = parsePortalRuntimeBootstrap(JSON.stringify(bootstrap));
    expect(parsed.routes.statusPath).toBe('/approval-request/status');
});
test('portal runtime session storage preserves request continuity and emits a session event', () => {
    const listener = vi.fn();
    window.addEventListener(PORTAL_RUNTIME_SESSION_EVENT, listener);
    const state = {
        requestId: 'request-123',
        requestReference: 'Draft request',
        sessionKey: 'session-123'
    };
    savePortalRuntimeSessionState(window.sessionStorage, bootstrap, state);
    expect(window.sessionStorage.getItem(getPortalRuntimeSessionStorageKey(bootstrap))).toBeTruthy();
    expect(loadPortalRuntimeSessionState(window.sessionStorage, bootstrap)).toEqual(state);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(PORTAL_RUNTIME_SESSION_EVENT, listener);
});
test('portal client creates, submits, and refreshes through the local proof host API contract', async () => {
    const fetchSpy = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify(draftRecord), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    }))
        .mockResolvedValueOnce(new Response(JSON.stringify(submittedRecord), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    }))
        .mockResolvedValueOnce(new Response(JSON.stringify(submittedRecord), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    }));
    const createdRecord = await createPortalRuntimeDraft({
        values: { dbm_title: 'Portal Request' },
        fetchImpl: fetchSpy,
        apiBasePath: '/api/runtime'
    });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/runtime/drafts');
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ dbm_title: 'Portal Request' }));
    expect(createdRecord.runtimeState.stageId).toBe('draft-request');
    const nextRecord = await submitPortalRuntimeRequest({
        requestId: createdRecord.id,
        fetchImpl: fetchSpy,
        apiBasePath: '/api/runtime'
    });
    expect(fetchSpy.mock.calls[1]?.[0]).toBe('/api/runtime/requests/request-123/submit');
    expect(nextRecord.runtimeState.stageId).toBe('internal-screening-stage');
    const refreshedRecord = await refreshPortalRuntimeRecord({
        requestId: createdRecord.id,
        fetchImpl: fetchSpy,
        apiBasePath: '/api/runtime'
    });
    expect(fetchSpy.mock.calls[2]?.[0]).toBe('/api/runtime/requests/request-123');
    expect(refreshedRecord.runtimeState.portalStatusId).toBe('under-review');
});
test('PortalRuntimeApp captures entry fields before creating a draft', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(draftRecord), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
    }));
    render(_jsx(PortalRuntimeApp, { bootstrap: bootstrap, runtimeModel: runtimeModel, fetchImpl: fetchSpy, storage: window.sessionStorage, apiBasePath: "/api/runtime" }));
    fireEvent.change(screen.getByLabelText('Request Title'), { target: { value: 'Portal Request' } });
    fireEvent.change(screen.getByLabelText('Request Amount'), { target: { value: '1250' } });
    fireEvent.change(screen.getByLabelText('Assigned Approver'), { target: { value: 'manager@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create draft/i }));
    await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
        dbm_title: 'Portal Request',
        dbm_amount: 1250,
        dbm_assignedapprover: 'manager@example.com'
    }));
});
test('PortalRuntimeApp resumes the same-session request and refreshes the external-safe status', async () => {
    savePortalRuntimeSessionState(window.sessionStorage, bootstrap, {
        requestId: 'request-123',
        requestReference: 'Portal Request',
        sessionKey: 'session-123'
    });
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify(submittedRecord), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    }));
    render(_jsx(PortalRuntimeApp, { bootstrap: bootstrap, runtimeModel: runtimeModel, fetchImpl: fetchSpy, storage: window.sessionStorage, apiBasePath: "/api/runtime" }));
    await waitFor(() => {
        expect(screen.getAllByText('Portal Request').length).toBeGreaterThan(0);
        expect(screen.getByText('Under Review')).toBeTruthy();
    });
});
