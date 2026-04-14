import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import type { DbmModelV1 } from 'dbm-contract';
import approvalRequestModel from '../../docs/architecture/examples/approval-request-v1.model.json';
import {
  applySynthesisPlanToDev,
  diffSynthesisPlan,
  emitGeneratedMetadataSolution,
  normalizeReadbackEntity,
  planDataverseSynthesis
} from '../src/index';
import type { DataverseReadbackSnapshot } from '../src/types';

type MockControlState = {
  controlName: string;
  visible: boolean;
  disabled: boolean;
  requiredLevel: 'none' | 'required';
  focused: boolean;
};

type RuntimeHarness = {
  config: any;
  sandbox: any;
  sync: (executionContext: any, config: any) => Promise<any>;
  cleanup: () => Promise<void>;
};

function jsonResponse(status: number, payload?: unknown): Response {
  return new Response(payload ? JSON.stringify(payload) : null, {
    status,
    headers: payload ? { 'Content-Type': 'application/json' } : undefined
  });
}

async function createRuntimeHarness(formId: 'request-form' | 'review-form'): Promise<RuntimeHarness> {
  const { buildRuntimeProcessExperienceSnapshot } = await import('dbm-process-experience');
  const plan = planDataverseSynthesis(approvalRequestModel as DbmModelV1);
  const outputRoot = path.join(process.cwd(), 'dist', 'runtime-test-output', `${formId}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const templateRoot = path.join(
    process.cwd(),
    '..',
    'power-platform',
    'solutions',
    'DynamicsBusinessMachineGeneratedMetadata',
    'template'
  );
  await emitGeneratedMetadataSolution(plan, outputRoot, templateRoot);

  const runtimeJs = await fs.readFile(
    path.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'runtime.js'),
    'utf8'
  );
  const configFileName = formId === 'request-form' ? 'request-form.js' : 'review-form.js';
  const onLoadName = formId === 'request-form' ? 'dbmOnLoad_request_form' : 'dbmOnLoad_review_form';
  const configJs = await fs.readFile(
    path.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'config', configFileName),
    'utf8'
  );

  const sandbox: any = {
    console,
    Response,
    Headers,
    fetch: async () => jsonResponse(404, { error: 'fetch-not-configured' }),
    setTimeout: (callback: (...args: any[]) => void) => {
      callback();
      return 0;
    },
    clearTimeout: () => undefined,
    Xrm: {
      Utility: {
        getGlobalContext: () => ({
          getClientUrl: () => 'https://example.crm4.dynamics.com'
        })
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  const context = createContext(sandbox);
  runInContext(runtimeJs, context);
  sandbox.DBM.ProcessExperienceHost = {
    buildRuntimeProcessExperienceSnapshot,
    render: () => undefined,
    unmount: () => undefined
  };

  const originalInitialize = sandbox.DBM.ProcessRuntime.initialize;
  let capturedConfig: any = null;
  sandbox.DBM.ProcessRuntime.initialize = (_executionContext: any, config: any) => {
    capturedConfig = config;
  };
  runInContext(configJs, context);
  sandbox[onLoadName]({});
  sandbox.DBM.ProcessRuntime.initialize = originalInitialize;

  assert.ok(capturedConfig, `Failed to capture generated runtime config for '${formId}'.`);

  return {
    config: capturedConfig,
    sandbox,
    sync: sandbox.DBM.ProcessRuntime.sync,
    cleanup: async () => {
      await fs.rm(outputRoot, { recursive: true, force: true });
    }
  };
}

function createMockFormContext(config: any, entityId: string, initialValues: Record<string, unknown>) {
  type MockAttributeState = {
    getValue: () => unknown;
    setValue: (value: unknown) => void;
    setRequiredLevel: (level: 'none' | 'required') => void;
    getRequiredLevel: () => 'none' | 'required';
    fireOnChange: () => void;
  };
  const attributes = new Map<
    string,
    MockAttributeState
  >();
  const controls = new Map<
    string,
    {
      getAttribute: () => MockAttributeState | null;
      setVisible: (value: boolean) => void;
      getVisible: () => boolean;
      setDisabled: (value: boolean) => void;
      getDisabled: () => boolean;
      setFocus: () => void;
      getContentWindow?: () => Promise<any>;
      getObject?: () => any;
      state: MockControlState;
    }
  >();
  const sections = new Map<
    string,
    {
      visible: boolean;
      setVisible: (value: boolean) => void;
      getVisible: () => boolean;
    }
  >();
  const tabs = new Map<
    string,
    {
      visible: boolean;
      focused: boolean;
      sections: { get: (name: string) => { visible: boolean; setVisible: (value: boolean) => void; getVisible: () => boolean } | null };
      setVisible: (value: boolean) => void;
      getVisible: () => boolean;
      setFocus: () => void;
    }
  >();
  const sectionRenders: any[] = [];
  const overlayRenders: any[] = [];
  const notifications: Array<{ message: string; level: string; id: string }> = [];

  for (const sectionConfig of config.sections as any[]) {
    if (!tabs.has(sectionConfig.tabName)) {
      tabs.set(sectionConfig.tabName, {
        visible: true,
        focused: false,
        sections: {
          get: (name: string) => sections.get(`${sectionConfig.tabName}:${name}`) ?? null
        },
        setVisible(value: boolean) {
          this.visible = value;
        },
        getVisible() {
          return this.visible;
        },
        setFocus() {
          this.focused = true;
        }
      });
    }

    const sectionKey = `${sectionConfig.tabName}:${sectionConfig.sectionName}`;
    if (!sections.has(sectionKey)) {
      sections.set(sectionKey, {
        visible: true,
        setVisible(value: boolean) {
          this.visible = value;
        },
        getVisible() {
          return this.visible;
        }
      });
    }

    for (const controlConfig of sectionConfig.controls as any[]) {
      if (!attributes.has(controlConfig.controlName)) {
        let currentValue = initialValues[controlConfig.controlName];
        let requiredLevel: 'none' | 'required' = 'none';
        attributes.set(controlConfig.controlName, {
          getValue: () => currentValue,
          setValue: (value: unknown) => {
            currentValue = value;
          },
          setRequiredLevel: (level: 'none' | 'required') => {
            requiredLevel = level;
          },
          getRequiredLevel: () => requiredLevel,
          fireOnChange: () => undefined
        });
      }

      if (!controls.has(controlConfig.controlName)) {
        const state: MockControlState = {
          controlName: controlConfig.controlName,
          visible: true,
          disabled: false,
          requiredLevel: 'none',
          focused: false
        };
        const attribute = attributes.get(controlConfig.controlName)!;
        controls.set(controlConfig.controlName, {
          getAttribute: () => ({
            getValue: attribute.getValue,
            setValue: attribute.setValue,
            setRequiredLevel: (level: 'none' | 'required') => {
              state.requiredLevel = level;
              attribute.setRequiredLevel(level);
            },
            getRequiredLevel: attribute.getRequiredLevel,
            fireOnChange: attribute.fireOnChange
          }),
          setVisible: (value: boolean) => {
            state.visible = value;
          },
          getVisible: () => state.visible,
          setDisabled: (value: boolean) => {
            state.disabled = value;
          },
          getDisabled: () => state.disabled,
          setFocus: () => {
            state.focused = true;
          },
          state
        });
      }
    }
  }

  if (config.processHost?.supported?.controlName) {
    const controlName = config.processHost.supported.controlName;
    if (!controls.has(controlName)) {
      controls.set(controlName, {
        getAttribute: () => null,
        setVisible: () => undefined,
        getVisible: () => true,
        setDisabled: () => undefined,
        getDisabled: () => false,
        setFocus: () => undefined,
        getContentWindow: async () => ({
          DBM: {
            [config.processHost.supported.frameBridgeName]: {
              render: (props: any) => sectionRenders.push(props)
            }
          }
        }),
        getObject: () => ({ tagName: 'IFRAME', id: controlName }),
        state: {
          controlName,
          visible: true,
          disabled: false,
          requiredLevel: 'none',
          focused: false
        }
      });
    }
  }

  const documentElements = new Map<string, any>();
  const documentBody: any = {
    firstChild: null,
    prepend(node: any) {
      if (node.id) {
        documentElements.set(node.id, node);
      }
      this.firstChild = node;
    },
    insertBefore(node: any) {
      if (node.id) {
        documentElements.set(node.id, node);
      }
      this.firstChild = node;
    },
    appendChild(node: any) {
      if (node.id) {
        documentElements.set(node.id, node);
      }
      this.firstChild = this.firstChild ?? node;
    }
  };

  const document = {
    body: documentBody,
    getElementById: (id: string) => documentElements.get(id) ?? null,
    createElement: (_tagName: string) => ({
      id: '',
      style: {}
    })
  };

  const formContext: any = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    getControl: (name: string) => controls.get(name) ?? null,
    data: {
      entity: {
        getId: () => `{${entityId}}`,
        addOnSave: () => undefined
      }
    },
    ui: {
      tabs: {
        get: (name: string) => tabs.get(name) ?? null
      },
      setFormNotification: (message: string, level: string, id: string) => {
        notifications.push({ message, level, id });
      },
      clearFormNotification: (id: string) => {
        const index = notifications.findIndex((entry) => entry.id === id);
        if (index >= 0) {
          notifications.splice(index, 1);
        }
      }
    }
  };

  return {
    executionContext: {
      getFormContext: () => formContext
    },
    controls,
    sections,
    tabs,
    notifications,
    sectionRenders,
    overlayRenders,
    document,
    installOverlayBridge(targetSandbox: any) {
      targetSandbox.document = document;
      targetSandbox.DBM.ProcessExperienceHost.render = (target: any, props: any) => {
        overlayRenders.push({
          targetId: target?.id ?? null,
          props
        });
      };
    }
  };
}

test('planDataverseSynthesis maps the approval example into entities, existing forms, and JS behaviors', () => {
  const plan = planDataverseSynthesis(approvalRequestModel as DbmModelV1);
  const requestEntity = plan.entities.find((entity) => entity.logicalName === 'dbm_request');
  const reviewForm = plan.forms.find((form) => form.id === 'review-form');

  assert.equal(plan.generatedMetadataSolutionName, 'DynamicsBusinessMachineGeneratedMetadata');
  assert.equal(plan.entities.length, 2);
  assert.equal(plan.relationships.some((relationship) => relationship.logicalName === 'dbm_request_dbm_requestdecision'), true);
  assert.equal(plan.forms.length, 2);
  assert.equal(plan.forms.every((form) => form.supported), true);
  assert.equal(plan.behaviors.filter((behavior) => behavior.supported).length, 5);
  assert.equal(plan.summary.supportedForms, 2);
  assert.equal(plan.summary.supportedBehaviors, 5);
  assert.equal(
    plan.forms.some(
      (form) =>
        form.id === 'request-form' &&
        form.systemFormId === '{8d65fa31-b54d-5d9b-84e0-07d87e113130}' &&
        form.sections.some((section) => section.sectionName === 'request_supporting_section') &&
        form.processHost?.supported?.sectionName === 'dbm_process_host_request_form'
    ),
    true
  );
  assert.equal(
    plan.behaviors.some(
      (behavior) =>
        behavior.webResourceName === 'ys_/dbm/forms/config/request-form.js' &&
        behavior.kind === 'form-config'
    ),
    true
  );
  assert.equal(
    plan.behaviors.some(
      (behavior) =>
        behavior.webResourceName === 'ys_/dbm/process-experience/renderer.js' &&
        behavior.kind === 'process-renderer'
    ),
    true
  );
  assert.ok(requestEntity);
  assert.equal(requestEntity?.columns.some((column) => column.logicalName === 'dbm_currentstageid' && column.source === 'synthetic'), true);
  assert.ok(reviewForm?.runtime);
  assert.equal(reviewForm?.runtime?.decisionOutcomeFieldLogicalName, 'dbm_decisionoutcome');
  assert.equal(reviewForm?.processHost?.overlay.enabled, true);
});

test('normalizeReadbackEntity captures lookup targets and picklist values', () => {
  const entity = normalizeReadbackEntity(
    {
      LogicalName: 'dbm_request',
      SchemaName: 'dbm_Request',
      PrimaryIdAttribute: 'dbm_requestid',
      PrimaryNameAttribute: 'dbm_title'
    },
    [
      {
        LogicalName: 'dbm_title',
        SchemaName: 'dbm_Title',
        AttributeType: 'String',
        IsPrimaryName: true,
        RequiredLevel: { Value: 'ApplicationRequired' }
      },
      {
        LogicalName: 'dbm_requestid',
        SchemaName: 'dbm_RequestId',
        AttributeType: 'Lookup',
        IsPrimaryName: false,
        RequiredLevel: { Value: 'ApplicationRequired' },
        Targets: ['dbm_request']
      },
      {
        LogicalName: 'dbm_screeningresult',
        SchemaName: 'dbm_ScreeningResult',
        AttributeType: 'Picklist',
        IsPrimaryName: false,
        RequiredLevel: { Value: 'None' },
        OptionSet: { Options: [{ Value: 100000000 }, { Value: 100000001 }] }
      }
    ]
  );

  assert.equal(entity.primaryNameAttributeLogicalName, 'dbm_title');
  assert.deepEqual(entity.columns.find((column) => column.logicalName === 'dbm_requestid')?.targets, ['dbm_request']);
  assert.deepEqual(entity.columns.find((column) => column.logicalName === 'dbm_screeningresult')?.optionValues, [100000000, 100000001]);
});

test('diffSynthesisPlan detects missing forms and web resources as blocking drift', () => {
  const plan = planDataverseSynthesis(approvalRequestModel as DbmModelV1);
  const snapshot: DataverseReadbackSnapshot = {
    generatedUtc: new Date().toISOString(),
    dataverseUrl: 'https://example.invalid',
    solutionName: plan.generatedMetadataSolutionName,
    entities: [
      {
        logicalName: 'dbm_request',
        schemaName: 'dbm_Request',
        primaryIdLogicalName: 'dbm_requestid',
        primaryNameAttributeLogicalName: 'dbm_title',
        columns: []
      }
    ],
    relationships: [],
    forms: [],
    webResources: [],
    diagnostics: []
  };

  const report = diffSynthesisPlan(plan, snapshot);
  assert.equal(report.hasBlockingDrift, true);
  assert.equal(report.differences.some((difference) => difference.kind === 'column'), true);
  assert.equal(report.differences.some((difference) => difference.kind === 'relationship'), true);
  assert.equal(report.differences.some((difference) => difference.kind === 'form'), true);
  assert.equal(report.differences.some((difference) => difference.kind === 'webresource'), true);
});

test('emitGeneratedMetadataSolution writes patched forms and behavior web resources', async () => {
  const plan = planDataverseSynthesis(approvalRequestModel as DbmModelV1);
  const outputRoot = path.join(process.cwd(), 'dist', 'test-output');
  const templateRoot = path.join(
    process.cwd(),
    '..',
    'power-platform',
    'solutions',
    'DynamicsBusinessMachineGeneratedMetadata',
    'template'
  );
  await emitGeneratedMetadataSolution(plan, outputRoot, templateRoot);

  const solutionXml = await fs.readFile(path.join(outputRoot, 'src', 'Other', 'Solution.xml'), 'utf8');
  const requestEntityXml = await fs.readFile(path.join(outputRoot, 'src', 'Entities', 'dbm_Request', 'Entity.xml'), 'utf8');
  const requestFormXml = await fs.readFile(
    path.join(outputRoot, 'src', 'Entities', 'dbm_Request', 'FormXml', 'main', '{8d65fa31-b54d-5d9b-84e0-07d87e113130}.xml'),
    'utf8'
  );
  const requestConfigJs = await fs.readFile(
    path.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'config', 'request-form.js'),
    'utf8'
  );
  const reviewConfigJs = await fs.readFile(
    path.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'config', 'review-form.js'),
    'utf8'
  );
  const runtimeJs = await fs.readFile(
    path.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'runtime.js'),
    'utf8'
  );
  const rendererJs = await fs.readFile(
    path.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'process-experience', 'renderer.js'),
    'utf8'
  );
  const hostHtml = await fs.readFile(
    path.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'process-experience', 'host.html'),
    'utf8'
  );
  const reviewFormXml = await fs.readFile(
    path.join(outputRoot, 'src', 'Entities', 'dbm_Requestdecision', 'FormXml', 'main', '{4e37e2e6-61cb-544d-848a-9f870ec4cf4d}.xml'),
    'utf8'
  );
  const runtimeMetadataXml = await fs.readFile(
    path.join(outputRoot, 'src', 'WebResources', 'ys_', 'dbm', 'forms', 'runtime.js.data.xml'),
    'utf8'
  );

  assert.match(solutionXml, /DynamicsBusinessMachineGeneratedMetadata/);
  assert.match(solutionXml, /type="61" schemaName="ys_\/dbm\/process-experience\/renderer\.js"/);
  assert.match(solutionXml, /type="61" schemaName="ys_\/dbm\/forms\/runtime\.js"/);
  assert.match(requestEntityXml, /<Name>dbm_title<\/Name>/);
  assert.match(requestFormXml, /<formLibraries>/);
  assert.match(requestFormXml, /ys_\/dbm\/process-experience\/renderer\.js/);
  assert.match(requestFormXml, /ys_\/dbm\/forms\/runtime\.js/);
  assert.match(requestFormXml, /ys_\/dbm\/forms\/config\/request-form\.js/);
  assert.match(requestFormXml, /WebResource_dbmProcessHost_request_form/);
  assert.match(requestFormXml, /ys_\/dbm\/process-experience\/host\.html/);
  assert.match(requestFormXml, /<event name="onload"/);
  assert.match(requestConfigJs, /dbmOnLoad_request_form/);
  assert.match(requestConfigJs, /"runtime": \{/);
  assert.match(requestConfigJs, /"processHost": \{/);
  assert.match(reviewConfigJs, /dbm_decisionoutcome/);
  assert.match(runtimeJs, /DBM\.ProcessRuntime/);
  assert.match(runtimeJs, /ProcessExperienceHost/);
  assert.match(rendererJs, /ProcessExperienceHost/);
  assert.match(hostHtml, /dbm-process-host-root/);
  assert.match(reviewFormXml, /dbm_decisionoutcome/);
  assert.match(reviewFormXml, /WebResource_dbmProcessHost_review_form/);
  assert.match(runtimeMetadataXml, /<Name>ys_\/dbm\/forms\/runtime\.js<\/Name>/);

  await fs.rm(outputRoot, { recursive: true, force: true });
});

test('generated request runtime sync advances large requests into supporting details and persists runtime state', async () => {
  const harness = await createRuntimeHarness('request-form');
  try {
    const patchedPayloads: any[] = [];
    const requestRecord = {
      dbm_requestid: 'request-1',
      dbm_title: 'Budget Request',
      dbm_amount: 10000,
      dbm_assignedapprover: 'manager@example.com',
      dbm_supportingnotes: '',
      dbm_screeningresult: 100000000
    };

    harness.sandbox.fetch = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
      const method = init?.method ?? 'GET';

      if (method === 'GET' && relative.startsWith('dbm_requests(request-1)')) {
        return jsonResponse(200, requestRecord);
      }

      if (method === 'PATCH' && relative === 'dbm_requests(request-1)') {
        patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
        return jsonResponse(204);
      }

      throw new Error(`Unexpected fetch during request runtime test: ${method} ${relative}`);
    };

    const form = createMockFormContext(harness.config, 'request-1', {
      dbm_title: 'Budget Request',
      dbm_amount: 10000,
      dbm_assignedapprover: 'manager@example.com',
      dbm_supportingnotes: '',
      dbm_screeningresult: 100000000
    });
    form.installOverlayBridge(harness.sandbox);

    const result = await harness.sync(form.executionContext, harness.config);

    assert.equal(result?.state.stageId, 'draft-request');
    assert.equal(result?.state.stepId, 'capture-supporting-details');
    assert.equal(result?.state.formStateId, 'request-supporting-state');
    assert.deepEqual(patchedPayloads, [
      {
        dbm_currentstageid: 'draft-request',
        dbm_currentstepid: 'capture-supporting-details',
        dbm_currentformstateid: 'request-supporting-state',
        dbm_internalstatusid: 'draft',
        dbm_portalstatusid: 'draft'
      }
    ]);
    assert.equal(form.controls.get('dbm_supportingnotes')?.state.visible, true);
    assert.equal(form.controls.get('dbm_screeningresult')?.state.visible, false);
    assert.equal(form.sectionRenders.length, 1);
    assert.equal(form.sectionRenders[0]?.snapshot.currentStepId, 'capture-supporting-details');
    assert.equal(form.sectionRenders[0]?.mode, 'model-driven-section');
    assert.equal(form.sectionRenders[0]?.navigationTarget?.controlName, 'dbm_supportingnotes');
    assert.equal(form.overlayRenders.length, 1);
    assert.equal(form.overlayRenders[0]?.targetId, harness.config.processHost.overlay.containerId);
    assert.equal(form.overlayRenders[0]?.props.mode, 'model-driven-overlay');
    form.sectionRenders[0]?.onNavigateToFormRegion?.(form.sectionRenders[0]?.navigationTarget);
    assert.equal(form.tabs.get('request_main_tab')?.focused, true);
    assert.equal(form.controls.get('dbm_supportingnotes')?.state.focused, true);
  } finally {
    await harness.cleanup();
  }
});

test('generated request runtime creates a review record when screening completes', async () => {
  const harness = await createRuntimeHarness('request-form');
  try {
    const patchedPayloads: any[] = [];
    const createdReviewPayloads: any[] = [];
    const requestRecord = {
      dbm_requestid: 'request-2',
      dbm_title: 'Travel Request',
      dbm_amount: 3000,
      dbm_assignedapprover: 'manager@example.com',
      dbm_supportingnotes: '',
      dbm_screeningresult: 100000001,
      dbm_currentstageid: 'internal-screening-stage',
      dbm_currentstepid: 'screen-request',
      dbm_currentformstateid: 'request-screening-state',
      dbm_internalstatusid: 'internal-screening',
      dbm_portalstatusid: 'under-review'
    };

    harness.sandbox.fetch = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
      const method = init?.method ?? 'GET';

      if (method === 'GET' && relative.startsWith('dbm_requests(request-2)')) {
        return jsonResponse(200, requestRecord);
      }

      if (method === 'GET' && relative.startsWith('dbm_requestdecisions?')) {
        return jsonResponse(200, { value: [] });
      }

      if (method === 'PATCH' && relative === 'dbm_requests(request-2)') {
        patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
        return jsonResponse(204);
      }

      if (method === 'POST' && relative === 'dbm_requestdecisions') {
        createdReviewPayloads.push(JSON.parse(String(init?.body ?? '{}')));
        return jsonResponse(200, { dbm_requestdecisionid: 'review-1' });
      }

      throw new Error(`Unexpected fetch during screening runtime test: ${method} ${relative}`);
    };

    const form = createMockFormContext(harness.config, 'request-2', {
      dbm_title: 'Travel Request',
      dbm_amount: 3000,
      dbm_assignedapprover: 'manager@example.com',
      dbm_supportingnotes: '',
      dbm_screeningresult: 100000001
    });
    form.installOverlayBridge(harness.sandbox);

    const result = await harness.sync(form.executionContext, harness.config);

    assert.equal(result?.state.stageId, 'manager-review');
    assert.equal(result?.state.stepId, 'choose-decision');
    assert.equal(result?.state.formStateId, 'review-decision-state');
    assert.deepEqual(patchedPayloads, [
      {
        dbm_currentstageid: 'manager-review',
        dbm_currentstepid: 'choose-decision',
        dbm_currentformstateid: 'review-decision-state',
        dbm_internalstatusid: 'awaiting-manager-decision',
        dbm_portalstatusid: 'under-review'
      }
    ]);
    assert.deepEqual(createdReviewPayloads, [
      {
        'dbm_requestid@odata.bind': '/dbm_requests(request-2)',
        dbm_decisionsummary: 'Review request Travel Request.'
      }
    ]);
    assert.equal(form.controls.get('dbm_screeningresult')?.state.disabled, true);
    assert.equal(form.sectionRenders.length, 1);
    assert.match(form.sectionRenders[0]?.snapshot.projection.message ?? '', /different DBM form/i);
    assert.equal(form.overlayRenders.length, 1);
  } finally {
    await harness.cleanup();
  }
});

test('generated review runtime uses review-form defaults and resolves lookup values from Dataverse Web API payloads', async () => {
  const harness = await createRuntimeHarness('review-form');
  try {
    const patchedPayloads: any[] = [];
    harness.config.runtime.rules['decision-request-bound'] = "decision-request == 'request-123'";
    harness.config.runtime.stepTransitions = [
      {
        fromStepId: 'choose-decision',
        guardRuleId: 'decision-request-bound',
        target: {
          stepId: 'record-approval'
        }
      }
    ];

    harness.sandbox.fetch = async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
      const method = init?.method ?? 'GET';

      if (method === 'GET' && relative.startsWith('dbm_requests(request-123)')) {
        return jsonResponse(200, {
          dbm_requestid: 'request-123',
          dbm_title: 'Capital Spend',
          dbm_amount: 2500,
          dbm_assignedapprover: 'manager@example.com'
        });
      }

      if (method === 'GET' && relative.startsWith('dbm_requestdecisions(review-1)')) {
        return jsonResponse(200, {
          dbm_requestdecisionid: 'review-1',
          _dbm_requestid_value: 'request-123',
          dbm_decisionsummary: 'Review request Capital Spend.'
        });
      }

      if (method === 'GET' && relative.startsWith('dbm_requestdecisions?')) {
        return jsonResponse(200, {
          value: [
            {
              dbm_requestdecisionid: 'review-1',
              dbm_requestid: 'request-123',
              dbm_decisionsummary: 'Review request Capital Spend.'
            }
          ]
        });
      }

      if (method === 'PATCH' && relative === 'dbm_requests(request-123)') {
        patchedPayloads.push(JSON.parse(String(init?.body ?? '{}')));
        return jsonResponse(204);
      }

      throw new Error(`Unexpected fetch during review runtime test: ${method} ${relative}`);
    };

    const form = createMockFormContext(harness.config, 'review-1', {
      dbm_requestid: [{ id: '{request-123}' }],
      dbm_decisionsummary: 'Review request Capital Spend.',
      dbm_decisionoutcome: null,
      dbm_decisioncomment: ''
    });
    form.installOverlayBridge(harness.sandbox);

    const result = await harness.sync(form.executionContext, harness.config);

    assert.equal(result?.state.stageId, 'manager-review');
    assert.equal(result?.state.stepId, 'record-approval');
    assert.equal(result?.state.formStateId, 'review-approval-state');
    assert.deepEqual(patchedPayloads, [
      {
        dbm_currentstageid: 'manager-review',
        dbm_currentstepid: 'record-approval',
        dbm_currentformstateid: 'review-approval-state',
        dbm_internalstatusid: 'approved',
        dbm_portalstatusid: 'approved'
      }
    ]);
    assert.equal(form.controls.get('dbm_decisionoutcome')?.state.visible, true);
    assert.equal(form.controls.get('dbm_decisioncomment')?.state.visible, false);
    assert.equal(form.sectionRenders.length, 1);
    assert.equal(form.sectionRenders[0]?.snapshot.currentStepId, 'record-approval');
    assert.equal(form.overlayRenders.length, 1);
  } finally {
    await harness.cleanup();
  }
});

test('applySynthesisPlanToDev bootstraps the generated solution and keeps relationship-backed metadata idempotent', async () => {
  const plan = planDataverseSynthesis(approvalRequestModel as DbmModelV1);
  const requests: Array<{ method: string; url: string; body?: any; headers: Record<string, string> }> = [];
  let solutionExists = false;
  const createdEntities = new Set<string>();
  const createdColumns = new Map<string, Set<string>>();
  const createdRelationships = new Set<string>();

  function ensureColumnSet(entityLogicalName: string): Set<string> {
    const existing = createdColumns.get(entityLogicalName);
    if (existing) {
      return existing;
    }

    const next = new Set<string>();
    createdColumns.set(entityLogicalName, next);
    return next;
  }

  function getEntityPlan(entityLogicalName: string) {
    return plan.entities.find((entity) => entity.logicalName === entityLogicalName) ?? null;
  }

  function toAttributePayload(entityLogicalName: string, columnLogicalName: string) {
    const entity = getEntityPlan(entityLogicalName);
    const column = entity?.columns.find((entry) => entry.logicalName === columnLogicalName) ?? null;
    assert.ok(column, `Missing synthesized column '${entityLogicalName}.${columnLogicalName}'.`);

    return {
      LogicalName: column.logicalName,
      SchemaName: column.schemaName,
      AttributeType: column.attributeType,
      IsPrimaryName: column.isPrimaryNameAttribute,
      RequiredLevel: { Value: column.required ? 'ApplicationRequired' : 'None' }
    };
  }

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const url = new URL(String(input));
    const bodyText = typeof init?.body === 'string' ? init.body : undefined;
    requests.push({
      method: init?.method ?? 'GET',
      url: url.toString(),
      body: bodyText ? JSON.parse(bodyText) : undefined,
      headers: Object.fromEntries(new Headers(init?.headers ?? {}).entries())
    });

    const relative = url.pathname.split('/api/data/v9.2/')[1] + url.search;
    const method = init?.method ?? 'GET';

    const json = (status: number, payload?: any) =>
      new Response(payload ? JSON.stringify(payload) : null, {
        status,
        headers: payload ? { 'Content-Type': 'application/json' } : undefined
      });

    if (method === 'GET' && relative.startsWith('solutions?')) {
      return json(200, { value: solutionExists ? [{ solutionid: 'solution-id', uniquename: plan.generatedMetadataSolutionName, version: '1.0.0.0' }] : [] });
    }

    if (method === 'GET' && relative.startsWith('publishers?')) {
      return json(200, { value: [{ publisherid: '11111111-1111-1111-1111-111111111111', uniquename: 'yagasoft' }] });
    }

    if (method === 'POST' && relative === 'solutions') {
      solutionExists = true;
      return json(204);
    }

    const entityMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\?\$select=LogicalName(?:,SchemaName,PrimaryIdAttribute,PrimaryNameAttribute)?/.exec(relative);
    if (method === 'GET' && entityMatch) {
      const entityLogicalName = entityMatch[1] ?? '';
      if (!createdEntities.has(entityLogicalName)) {
        return json(404, { error: { message: 'Not found' } });
      }

      const entity = getEntityPlan(entityLogicalName);
      assert.ok(entity, `Missing synthesized entity '${entityLogicalName}'.`);
      return json(200, {
        LogicalName: entity.logicalName,
        SchemaName: entity.schemaName,
        PrimaryIdAttribute: entity.primaryIdLogicalName,
        PrimaryNameAttribute: entity.columns.find((column) => column.isPrimaryNameAttribute)?.logicalName ?? null
      });
    }

    if (method === 'POST' && relative === 'EntityDefinitions') {
      const logicalName = String(requests[requests.length - 1]?.body?.LogicalName ?? '');
      createdEntities.add(logicalName);
      const primaryNameAttribute = String(requests[requests.length - 1]?.body?.PrimaryNameAttribute ?? '');
      if (primaryNameAttribute) {
        ensureColumnSet(logicalName).add(primaryNameAttribute);
      }
      return json(204);
    }

    const attributeGetMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes\(LogicalName='([^']+)'\)\?\$select=LogicalName/.exec(relative);
    if (method === 'GET' && attributeGetMatch) {
      const entityLogicalName = attributeGetMatch[1] ?? '';
      const columnLogicalName = attributeGetMatch[2] ?? '';
      return ensureColumnSet(entityLogicalName).has(columnLogicalName)
        ? json(200, { LogicalName: columnLogicalName })
        : json(404, { error: { message: 'Not found' } });
    }

    const attributePostMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes$/.exec(relative);
    if (method === 'POST' && attributePostMatch) {
      const entityLogicalName = attributePostMatch[1] ?? '';
      const schemaName = String(requests[requests.length - 1]?.body?.SchemaName ?? '');
      const entity = getEntityPlan(entityLogicalName);
      const column = entity?.columns.find((entry) => entry.schemaName === schemaName) ?? null;
      assert.ok(column, `Missing synthesized column for schema '${schemaName}'.`);
      ensureColumnSet(entityLogicalName).add(column.logicalName);
      return json(204);
    }

    const relationshipQueryMatch = /RelationshipDefinitions\/Microsoft\.Dynamics\.CRM\.OneToManyRelationshipMetadata\?\$select=SchemaName(?:,ReferencedEntity,ReferencingEntity,ReferencingAttribute)?&\$filter=([^&]+)/.exec(relative);
    if (method === 'GET' && relationshipQueryMatch) {
      const filter = decodeURIComponent(relationshipQueryMatch[1] ?? '');
      const relationship = plan.relationships.find(
        (entry) => createdRelationships.has(entry.logicalName) && (filter.includes(entry.schemaName) || filter.includes(entry.logicalName))
      );
      if (!relationship) {
        return json(200, { value: [] });
      }

      return json(200, {
        value: [
          {
            SchemaName: relationship.schemaName,
            ReferencedEntity: relationship.referencedEntityLogicalName,
            ReferencingEntity: relationship.referencingEntityLogicalName,
            ReferencingAttribute: relationship.referencingAttributeLogicalName
          }
        ]
      });
    }

    if (method === 'POST' && relative === 'RelationshipDefinitions') {
      const schemaName = String(requests[requests.length - 1]?.body?.SchemaName ?? '');
      const relationship = plan.relationships.find((entry) => entry.schemaName === schemaName || entry.logicalName === schemaName) ?? null;
      assert.ok(relationship, `Missing synthesized relationship '${schemaName}'.`);
      assert.ok(relationship.referencingAttributeLogicalName, `Missing referencing attribute for relationship '${schemaName}'.`);
      createdRelationships.add(relationship.logicalName);
      ensureColumnSet(relationship.referencingEntityLogicalName).add(relationship.referencingAttributeLogicalName);
      return json(204);
    }

    const entityAttributesMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes\?\$select=LogicalName,SchemaName,AttributeType,IsPrimaryName,RequiredLevel/.exec(relative);
    if (method === 'GET' && entityAttributesMatch) {
      const entityLogicalName = entityAttributesMatch[1] ?? '';
      const logicalNames = [...ensureColumnSet(entityLogicalName)];
      return json(200, {
        value: logicalNames.map((logicalName) => toAttributePayload(entityLogicalName, logicalName))
      });
    }

    const lookupMetadataMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes\(LogicalName='([^']+)'\)\/Microsoft\.Dynamics\.CRM\.LookupAttributeMetadata\?\$select=Targets/.exec(relative);
    if (method === 'GET' && lookupMetadataMatch) {
      const entityLogicalName = lookupMetadataMatch[1] ?? '';
      const columnLogicalName = lookupMetadataMatch[2] ?? '';
      const entity = getEntityPlan(entityLogicalName);
      const column = entity?.columns.find((entry) => entry.logicalName === columnLogicalName) ?? null;
      return json(200, { Targets: column?.lookupTargetLogicalName ? [column.lookupTargetLogicalName] : [] });
    }

    const picklistMetadataMatch = /EntityDefinitions\(LogicalName='([^']+)'\)\/Attributes\(LogicalName='([^']+)'\)\/Microsoft\.Dynamics\.CRM\.PicklistAttributeMetadata\?\$select=LogicalName&\$expand=OptionSet/.exec(relative);
    if (method === 'GET' && picklistMetadataMatch) {
      const entityLogicalName = picklistMetadataMatch[1] ?? '';
      const columnLogicalName = picklistMetadataMatch[2] ?? '';
      const entity = getEntityPlan(entityLogicalName);
      const column = entity?.columns.find((entry) => entry.logicalName === columnLogicalName) ?? null;
      return json(200, {
        OptionSet: {
          Options: (column?.choiceOptions ?? []).map((option) => ({ Value: option.value }))
        }
      });
    }

    if (method === 'POST' && relative === 'PublishAllXml') {
      return json(204);
    }

    if (method === 'GET' && relative.startsWith('systemforms(')) {
      return json(404, { error: { message: 'Not found' } });
    }

    if (method === 'GET' && relative.startsWith('webresourceset?')) {
      return json(200, { value: [] });
    }

    assert.fail(`Unexpected fetch call: ${method} ${relative}`);
  }) as typeof fetch;

  try {
    const report = await applySynthesisPlanToDev(
      plan,
      { dataverseUrl: 'https://example.crm.dynamics.com' },
      { accessToken: 'token' }
    );

    assert.equal(report.status, 'success');
    assert.equal(report.actions.some((action) => action.componentType === 'solution' && action.state === 'created'), true);
    assert.equal(report.actions.some((action) => action.componentType === 'relationship' && action.state === 'created'), true);
    assert.equal(
      report.actions.some(
        (action) =>
          action.componentType === 'column' &&
          action.logicalName === 'dbm_requestdecision.dbm_requestid' &&
          action.message.includes('relationship metadata')
      ),
      true
    );

    const relationshipCreate = requests.find((request) => request.url.endsWith('/RelationshipDefinitions') && request.method === 'POST');
    assert.ok(relationshipCreate);
    assert.equal(relationshipCreate?.headers['mscrm.solutionuniquename'], 'DynamicsBusinessMachineGeneratedMetadata');
    assert.equal(relationshipCreate?.body?.Lookup?.SchemaName, 'dbm_Requestid');
    assert.equal(relationshipCreate?.body?.ReferencedEntity, 'dbm_request');
    assert.equal(relationshipCreate?.body?.ReferencingEntity, 'dbm_requestdecision');

    const entityCreate = requests.find((request) => request.url.endsWith('/EntityDefinitions') && request.method === 'POST');
    assert.ok(entityCreate);
    assert.equal(entityCreate?.body?.PrimaryNameAttribute, 'dbm_title');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
