import { jsx as _jsx } from "react/jsx-runtime";
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { parsePortalRuntimeBootstrap } from './bootstrap';
import { PortalRuntimeApp } from './PortalRuntimeApp';
import { createPortalRuntimeDraft, refreshPortalRuntimeRecord, submitPortalRuntimeRequest } from './portal-client';
import { getPortalRuntimeSessionStorageKey, loadPortalRuntimeSessionState, savePortalRuntimeSessionState } from './session';
const bootstrap = {
    schemaVersion: 'dbm.portal-runtime.bootstrap/v1',
    packageId: 'dbm-approval-request',
    packageVersion: '1.2.1',
    processId: 'approval-request-process',
    identityMode: 'anonymous-generic-profile',
    genericProfileKey: 'dev-anonymous-requester',
    entryPage: {
        pageId: 'portal-entry-page',
        routePath: '/request'
    },
    requestShellPage: {
        pageId: 'portal-request-shell-page',
        routePath: '/request/status'
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
    allowedActions: ['create-draft', 'submit-request', 'refresh-status'],
    devAnonymousReadbackEnabled: true
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
afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.shell;
    window.sessionStorage.clear();
});
test('parsePortalRuntimeBootstrap accepts a JSON string payload', () => {
    const parsed = parsePortalRuntimeBootstrap(JSON.stringify(bootstrap));
    expect(parsed.requestEntitySetName).toBe('dbm_requests');
});
test('portal runtime session storage preserves request continuity', () => {
    const state = {
        requestId: 'request-123',
        requestReference: 'Draft request',
        sessionKey: 'session-123'
    };
    savePortalRuntimeSessionState(window.sessionStorage, bootstrap, state);
    expect(window.sessionStorage.getItem(getPortalRuntimeSessionStorageKey(bootstrap))).toBeTruthy();
    expect(loadPortalRuntimeSessionState(window.sessionStorage, bootstrap)).toEqual(state);
});
test('portal client creates, submits, and refreshes through the supported CRUD contract', async () => {
    const fetchSpy = vi.fn()
        .mockResolvedValueOnce(new Response(null, {
        status: 204,
        headers: {
            entityid: 'request-123'
        }
    }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
        dbm_requestid: 'request-123',
        dbm_title: 'Portal Request',
        dbm_currentstageid: 'draft-request',
        dbm_currentstepid: 'capture-request',
        dbm_currentformstateid: 'request-edit-state',
        dbm_internalstatusid: 'draft',
        dbm_portalstatusid: 'draft'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
        dbm_requestid: 'request-123',
        dbm_title: 'Portal Request',
        dbm_currentstageid: 'internal-screening-stage',
        dbm_currentstepid: 'screen-request',
        dbm_currentformstateid: 'request-screening-state',
        dbm_internalstatusid: 'under-review',
        dbm_portalstatusid: 'under-review'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const createdRecord = await createPortalRuntimeDraft({
        bootstrap,
        values: { dbm_title: 'Portal Request' },
        fetchImpl: fetchSpy,
        siteOrigin: 'https://example.test'
    });
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ dbm_title: 'Portal Request' }));
    expect(createdRecord.runtimeState.stageId).toBe('draft-request');
    await submitPortalRuntimeRequest({
        bootstrap,
        requestId: createdRecord.id,
        fetchImpl: fetchSpy,
        siteOrigin: 'https://example.test'
    });
    const refreshedRecord = await refreshPortalRuntimeRecord({
        bootstrap,
        requestId: createdRecord.id,
        fetchImpl: fetchSpy,
        siteOrigin: 'https://example.test'
    });
    expect(refreshedRecord.runtimeState.stageId).toBe('internal-screening-stage');
    expect(refreshedRecord.runtimeState.portalStatusId).toBe('under-review');
});
test('portal client forwards the Power Pages verification token when the shell is available', async () => {
    globalThis.shell = {
        getTokenDeferred: vi.fn().mockResolvedValue('portal-token')
    };
    const fetchSpy = vi.fn()
        .mockResolvedValueOnce(new Response(null, {
        status: 204,
        headers: {
            entityid: 'request-token-test'
        }
    }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
        dbm_requestid: 'request-token-test',
        dbm_title: 'Portal Request',
        dbm_currentstageid: 'draft-request',
        dbm_currentstepid: 'capture-request',
        dbm_currentformstateid: 'request-edit-state',
        dbm_internalstatusid: 'draft',
        dbm_portalstatusid: 'draft'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await createPortalRuntimeDraft({
        bootstrap,
        values: { dbm_title: 'Portal Request' },
        fetchImpl: fetchSpy,
        siteOrigin: 'https://example.test'
    });
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toMatchObject({
        __RequestVerificationToken: 'portal-token'
    });
    await submitPortalRuntimeRequest({
        bootstrap,
        requestId: 'request-token-test',
        fetchImpl: fetchSpy,
        siteOrigin: 'https://example.test'
    });
    expect(fetchSpy.mock.calls[2]?.[1]?.headers).toMatchObject({
        __RequestVerificationToken: 'portal-token',
        'If-Match': '*'
    });
});
test('PortalRuntimeApp captures entry fields before creating a draft', async () => {
    const fetchSpy = vi.fn()
        .mockResolvedValueOnce(new Response(null, {
        status: 204,
        headers: {
            entityid: 'request-123'
        }
    }))
        .mockResolvedValueOnce(new Response(JSON.stringify({
        dbm_requestid: 'request-123',
        dbm_title: 'Portal Request',
        dbm_currentstageid: 'draft-request',
        dbm_currentstepid: 'capture-request',
        dbm_currentformstateid: 'request-edit-state',
        dbm_internalstatusid: 'draft',
        dbm_portalstatusid: 'draft'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(_jsx(PortalRuntimeApp, { bootstrap: bootstrap, runtimeModel: runtimeModel, fetchImpl: fetchSpy, storage: window.sessionStorage, siteOrigin: "https://example.test" }));
    fireEvent.change(screen.getByLabelText('Request Title'), { target: { value: 'Portal Request' } });
    fireEvent.change(screen.getByLabelText('Request Amount'), { target: { value: '1250' } });
    fireEvent.change(screen.getByLabelText('Assigned Approver'), { target: { value: 'manager@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Create draft/i }));
    await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({
        dbm_title: 'Portal Request',
        dbm_amount: 1250,
        dbm_assignedapprover: 'manager@example.com'
    }));
});
test('PortalRuntimeApp resumes the same-session request and refreshes the portal-safe status', async () => {
    savePortalRuntimeSessionState(window.sessionStorage, bootstrap, {
        requestId: 'request-123',
        requestReference: 'Portal Request',
        sessionKey: 'session-123'
    });
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
        dbm_requestid: 'request-123',
        dbm_title: 'Portal Request',
        dbm_currentstageid: 'internal-screening-stage',
        dbm_currentstepid: 'screen-request',
        dbm_currentformstateid: 'request-screening-state',
        dbm_internalstatusid: 'under-review',
        dbm_portalstatusid: 'under-review'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    render(_jsx(PortalRuntimeApp, { bootstrap: bootstrap, runtimeModel: runtimeModel, fetchImpl: fetchSpy, storage: window.sessionStorage, siteOrigin: "https://example.test" }));
    await waitFor(() => {
        expect(screen.getAllByText('Portal Request').length).toBeGreaterThan(0);
        expect(screen.getByText('Under Review')).toBeTruthy();
    });
});
