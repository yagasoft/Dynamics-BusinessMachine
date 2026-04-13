import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeIcons, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { SplitterModule } from 'primeng/splitter';
import { TreeModule } from 'primeng/tree';
import { InputTextModule } from 'primeng/inputtext';
import { FieldsetModule } from 'primeng/fieldset';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import {
	addNode,
	createApprovalRequestTemplate,
	loadModel,
	moveNode,
	removeNode,
	serializeModel,
	type AddNodeCommand,
	type DesignerDocument,
	type DesignerIssue,
	type DesignerNodeRef,
	updateNode,
	validateDocument,
} from '../../../../dbm-designer-core/dist/index.js';

interface ModelDocumentRecord
{
	id?: string;
	name: string;
	displayname: string;
	modifiedon?: Date | null;
	model: any;
}

interface DataverseModelResource
{
	webresourceid?: string;
	name: string;
	displayname?: string | null;
	modifiedon?: string | null;
	content?: string | null;
}

interface AddAction
{
	kind: AddNodeCommand['kind'];
	label: string;
	parentId: string;
}

@Component({
	selector: 'ys-resource-details',
	standalone: true,
	imports: [FormsModule, InputTextModule, CommonModule, ButtonModule, ToolbarModule, SplitterModule, TreeModule, FieldsetModule, ProgressSpinnerModule],
	templateUrl: './resource-details.component.html',
	styleUrl: './resource-details.component.scss'
})
export class ResourceDetailsComponent
{
	readonly PrimeIcons = PrimeIcons;
	readonly supportedHosts = ['model-driven', 'xrmtoolbox'];
	readonly supportedRuntimes = ['pcf', 'dataverse', 'azure'];
	readonly actorTypes = ['requester', 'approver', 'system'];
	readonly actorSources = ['current-user', 'field-binding', 'rule-derived', 'system'];
	readonly fieldTypes = ['string', 'multiline-string', 'integer', 'decimal', 'currency', 'boolean', 'choice', 'lookup', 'date', 'datetime'];
	readonly stageTypes = ['start', 'task', 'approval', 'system', 'end'];
	readonly elementTypes = ['text', 'multiline-text', 'number', 'currency', 'choice', 'lookup', 'date', 'read-only-text'];
	readonly relationshipTypes = ['one-to-many', 'many-to-one'];
	readonly ruleTypes = ['condition', 'validation', 'derivation', 'action'];
	readonly ruleScopes = ['process', 'stage', 'transition', 'form', 'field'];
	readonly ruleLanguages = ['dbm-expression-v1', 'javascript-artifact-v1'];
	readonly artifactTypes = ['script', 'template', 'static-asset', 'pcf-control', 'plugin-assembly', 'config'];
	readonly packagingTargets = ['dataverse-webresource', 'dataverse-plugin', 'repo-only', 'azure-app'];
	readonly runtimeCapabilities = ['load-record', 'render-form', 'validate-input', 'evaluate-rules', 'persist-record', 'advance-stage', 'invoke-artifact', 'emit-notification'];
	readonly requestOperations = ['initialize', 'load-form', 'validate', 'submit', 'transition'];
	readonly resultStatuses = ['ok', 'validation-failed', 'blocked', 'error'];

	private readonly dbStore = 'dbmModelDocuments';
	private readonly modelRoot = 'ys_/dbm/data/models/';

	private _webResourceName: string | null = null;
	private _webResourceDisplayname = '';
	private _isInitialized = false;

	@Input() set webResourceName(value: string | null | undefined)
	{
		this._webResourceName = value ?? null;
		if (this._isInitialized)
		{
			void this.loadResource();
		}
	}

	@Input() set webResourceDisplayname(value: string | null | undefined)
	{
		this._webResourceDisplayname = value ?? '';
		if (this.resourceRecord && value)
		{
			this.resourceRecord.displayname = value;
		}
	}

	@Output() webResourceDisplaynameChange = new EventEmitter<string>();
	@Output() resourceSaved = new EventEmitter<void>();

	document: DesignerDocument | null = null;
	resourceRecord: ModelDocumentRecord | null = null;
	treeEntries: TreeNode<DesignerNodeRef>[] = [];
	selectedTreeEntry: TreeNode<DesignerNodeRef> | null = null;
	validationIssues: DesignerIssue[] = [];
	isLoading = false;
	isSaving = false;

	private db!: IDBDatabase;

	async ngOnInit()
	{
		await this.initDb();
		this._isInitialized = true;
		await this.loadResource();
	}

	get resourceName(): string
	{
		return this.resourceRecord?.name ?? this._webResourceName ?? '';
	}

	set resourceName(value: string)
	{
		if (!this.resourceRecord)
		{
			return;
		}

		this.resourceRecord.name = value.startsWith(this.modelRoot) ? value : `${this.modelRoot}${value}`;
	}

	get resourceNameSuffix(): string
	{
		return this.resourceName.replace(this.modelRoot, '');
	}

	get displayName(): string
	{
		return this.resourceRecord?.displayname ?? this._webResourceDisplayname;
	}

	set displayName(value: string)
	{
		this._webResourceDisplayname = value;
		if (this.resourceRecord)
		{
			this.resourceRecord.displayname = value;
		}
		this.webResourceDisplaynameChange.emit(value);
	}

	get selectedNode(): DesignerNodeRef | null
	{
		return this.selectedTreeEntry?.data ?? null;
	}

	get selectedPackage()
	{
		return this.selectedNode?.kind === 'package' ? this.document?.model.package ?? null : null;
	}

	get selectedProcess()
	{
		return this.selectedNode?.kind === 'process' ? this.document?.model.process ?? null : null;
	}

	get selectedActor()
	{
		return this.selectedNode?.kind === 'actor'
			? this.document?.model.process.actors.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get selectedVariable()
	{
		return this.selectedNode?.kind === 'variable'
			? this.document?.model.process.variables.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get selectedStage()
	{
		return this.selectedNode?.kind === 'stage'
			? this.document?.model.process.stages.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get selectedTransition()
	{
		return this.selectedNode?.kind === 'transition'
			? this.document?.model.process.transitions.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get selectedOutcome()
	{
		return this.selectedNode?.kind === 'outcome'
			? this.document?.model.process.outcomes.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get selectedForm()
	{
		return this.selectedNode?.kind === 'form'
			? this.document?.model.forms.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get selectedLayout()
	{
		return this.selectedNode?.kind === 'layout'
			? this.document?.model.forms.find((entry) => entry.id === this.selectedNode?.modelId)?.layout ?? null
			: null;
	}

	get selectedRegion()
	{
		if (this.selectedNode?.kind !== 'region' || !this.document)
		{
			return null;
		}

		const formId = this.selectedNode.parentId?.replace('layout:', '');
		return this.document.model.forms.find((entry) => entry.id === formId)?.layout.regions.find((entry) => entry.id === this.selectedNode?.modelId) ?? null;
	}

	get selectedElement()
	{
		if (this.selectedNode?.kind !== 'element' || !this.document)
		{
			return null;
		}

		const formId = this.selectedNode.parentId?.split(':')[2];
		return this.document.model.forms.find((entry) => entry.id === formId)?.elements.find((entry) => entry.id === this.selectedNode?.modelId) ?? null;
	}

	get selectedEntity()
	{
		return this.selectedNode?.kind === 'entity'
			? this.document?.model.metadata.entities.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get selectedField()
	{
		if (this.selectedNode?.kind !== 'field' || !this.document)
		{
			return null;
		}

		const entityId = this.selectedNode.parentId?.split(':')[2];
		return this.document.model.metadata.entities.find((entry) => entry.id === entityId)?.fields.find((entry) => entry.id === this.selectedNode?.modelId) ?? null;
	}

	get selectedRelationship()
	{
		return this.selectedNode?.kind === 'relationship'
			? this.document?.model.metadata.relationships.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get selectedRule()
	{
		return this.selectedNode?.kind === 'rule'
			? this.document?.model.rules.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get selectedRuntime()
	{
		return this.selectedNode?.kind === 'runtime' ? this.document?.model.runtime ?? null : null;
	}

	get selectedArtifact()
	{
		return this.selectedNode?.kind === 'artifact'
			? this.document?.model.artifacts.find((entry) => entry.id === this.selectedNode?.modelId) ?? null
			: null;
	}

	get errorIssues(): DesignerIssue[]
	{
		return this.validationIssues.filter((issue) => issue.level === 'error');
	}

	get warningIssues(): DesignerIssue[]
	{
		return this.validationIssues.filter((issue) => issue.level === 'warning');
	}

	get isSaveEnabled(): boolean
	{
		return !!this.document && !this.isSaving && !!this.document.dirty;
	}

	get canRemoveSelected(): boolean
	{
		return ['actor', 'variable', 'stage', 'transition', 'outcome', 'form', 'region', 'element', 'entity', 'field', 'relationship', 'rule', 'artifact'].includes(this.selectedNode?.kind ?? '');
	}

	get canMoveUp(): boolean
	{
		return (this.resolveSelectionIndex() ?? 0) > 0;
	}

	get canMoveDown(): boolean
	{
		const context = this.resolveSelectionIndexAndLength();
		return !!context && context.index < context.length - 1;
	}

	get addActions(): AddAction[]
	{
		const node = this.selectedNode;
		if (!node)
		{
			return [];
		}

		switch (node.id)
		{
			case 'section:process':
				return [
					{ kind: 'actor', label: 'Actor', parentId: 'collection:process:actors' },
					{ kind: 'variable', label: 'Variable', parentId: 'collection:process:variables' },
					{ kind: 'stage', label: 'Stage', parentId: 'collection:process:stages' },
					{ kind: 'transition', label: 'Transition', parentId: 'collection:process:transitions' },
					{ kind: 'outcome', label: 'Outcome', parentId: 'collection:process:outcomes' },
				];
			case 'collection:process:actors':
				return [{ kind: 'actor', label: 'Actor', parentId: node.id }];
			case 'collection:process:variables':
				return [{ kind: 'variable', label: 'Variable', parentId: node.id }];
			case 'collection:process:stages':
				return [{ kind: 'stage', label: 'Stage', parentId: node.id }];
			case 'collection:process:transitions':
				return [{ kind: 'transition', label: 'Transition', parentId: node.id }];
			case 'collection:process:outcomes':
				return [{ kind: 'outcome', label: 'Outcome', parentId: node.id }];
			case 'section:forms':
				return [{ kind: 'form', label: 'Form', parentId: node.id }];
			case 'section:metadata':
				return [
					{ kind: 'entity', label: 'Entity', parentId: 'collection:metadata:entities' },
					{ kind: 'relationship', label: 'Relationship', parentId: 'collection:metadata:relationships' },
				];
			case 'collection:metadata:entities':
				return [{ kind: 'entity', label: 'Entity', parentId: node.id }];
			case 'collection:metadata:relationships':
				return [{ kind: 'relationship', label: 'Relationship', parentId: node.id }];
			case 'section:rules':
				return [{ kind: 'rule', label: 'Rule', parentId: node.id }];
			case 'section:artifacts':
				return [{ kind: 'artifact', label: 'Artifact', parentId: node.id }];
		}

		if (node.kind === 'form')
		{
			return [
				{ kind: 'region', label: 'Region', parentId: node.id },
				{ kind: 'element', label: 'Element', parentId: node.id },
			];
		}

		if (node.kind === 'layout')
		{
			return [{ kind: 'region', label: 'Region', parentId: node.id }];
		}

		if (node.kind === 'collection' && node.id.includes(':elements'))
		{
			return [{ kind: 'element', label: 'Element', parentId: node.id }];
		}

		if (node.kind === 'entity')
		{
			return [{ kind: 'field', label: 'Field', parentId: node.id }];
		}

		if (node.kind === 'collection' && node.id.includes(':fields'))
		{
			return [{ kind: 'field', label: 'Field', parentId: node.id }];
		}

		return [];
	}

	actorOptions()
	{
		return this.document?.model.process.actors ?? [];
	}

	formOptions()
	{
		return this.document?.model.forms ?? [];
	}

	stageOptions()
	{
		return this.document?.model.process.stages ?? [];
	}

	entityOptions()
	{
		return this.document?.model.metadata.entities ?? [];
	}

	ruleOptions()
	{
		return this.document?.model.rules ?? [];
	}

	artifactOptions()
	{
		return this.document?.model.artifacts ?? [];
	}

	regionOptions(formId: string | null | undefined)
	{
		return this.document?.model.forms.find((entry) => entry.id === formId)?.layout.regions ?? [];
	}

	fieldOptions(entityId: string | null | undefined)
	{
		return this.document?.model.metadata.entities.find((entry) => entry.id === entityId)?.fields ?? [];
	}

	selectedElementFieldOptions()
	{
		if (!this.selectedNode || !this.document || this.selectedNode.kind !== 'element')
		{
			return [];
		}

		const formId = this.selectedNode.parentId?.split(':')[2];
		const form = this.document.model.forms.find((entry) => entry.id === formId);
		return this.fieldOptions(form?.entityId);
	}

	async saveResource()
	{
		if (!this.document || !this.resourceRecord)
		{
			return;
		}

		this.validationIssues = validateDocument(this.document);
		if (this.errorIssues.length > 0)
		{
			return;
		}

		this.isSaving = true;

		try
		{
			const model = serializeModel(this.document);
			const displayname = this.resourceRecord.displayname || model.package.displayName || this.resourceNameSuffix;
			const content = JSON.stringify(model, null, 2);
			const record = {
				displayname,
				name: this.resourceRecord.name,
				webresourcetype: 3,
				content: btoa(content)
			};

			if (globalThis.Xrm)
			{
				const resourceId = this.resourceRecord.id ??= await this.lookupResourceId(this.resourceRecord.name);
				const response = await fetch(
					`${globalThis.Xrm.Utility.getGlobalContext().getClientUrl()}/api/data/v9.1/webresourceset${resourceId ? `(${resourceId})` : ''}?$select=webresourceid,name`,
					{
						method: resourceId ? 'PATCH' : 'POST',
						headers: Ys.Common.buildWebApiHeaders([['Prefer', 'return=representation']]),
						body: JSON.stringify(record)
					});

				if (!response.ok)
				{
					throw new Error(`Failed to save model document '${this.resourceRecord.name}'.`);
				}

				const json = await response.json();
				this.resourceRecord.id = json.webresourceid ?? resourceId ?? await this.lookupResourceId(this.resourceRecord.name);

				await fetch(
					`${globalThis.Xrm.Utility.getGlobalContext().getClientUrl()}/api/data/v9.1/PublishXml`,
					{
						method: 'POST',
						headers: Ys.Common.buildWebApiHeaders([['Prefer', 'return=representation']]),
						body: JSON.stringify({
							ParameterXml: `<importexportxml><webresources><webresource>{${this.resourceRecord.id}}</webresource></webresources></importexportxml>`
						})
					});
			}
			else
			{
				const transaction = this.db.transaction(this.dbStore, 'readwrite');
				const store = transaction.objectStore(this.dbStore);
				store.put({
					id: this.resourceRecord.id ?? this.resourceRecord.name,
					name: this.resourceRecord.name,
					displayname,
					modifiedon: new Date().toISOString(),
					model
				});
				await new Promise<void>((resolve, reject) =>
				{
					transaction.oncomplete = () => resolve();
					transaction.onerror = () => reject(transaction.error);
				});
			}

			this.displayName = displayname;
			this.resourceRecord.model = model;
			this.document = loadModel(model);
			this.validationIssues = this.document.issues;
			this.rebuildTree(this.selectedNode?.id);
			this.resourceSaved.emit();
		}
		finally
		{
			this.isSaving = false;
		}
	}

	addSelected(kind: AddNodeCommand['kind'], parentId: string)
	{
		if (!this.document)
		{
			return;
		}

		this.applyResult(addNode(this.document, { kind, parentId }));
	}

	removeSelected()
	{
		if (!this.document || !this.selectedNode || !this.canRemoveSelected)
		{
			return;
		}

		this.applyResult(removeNode(this.document, { nodeId: this.selectedNode.id }));
	}

	moveSelected(offset: number)
	{
		if (!this.document || !this.selectedNode)
		{
			return;
		}

		const context = this.resolveSelectionIndexAndLength();
		if (!context)
		{
			return;
		}

		this.applyResult(moveNode(this.document, {
			nodeId: this.selectedNode.id,
			targetIndex: context.index + offset
		}));
	}

	toggleStringOption(values: string[], value: string, checked: boolean): string[]
	{
		return checked
			? Array.from(new Set([...values, value]))
			: values.filter((entry) => entry !== value);
	}

	updateSelectedPartial(value: unknown)
	{
		if (!this.document || !this.selectedNode)
		{
			return;
		}

		this.applyResult(updateNode(this.document, { nodeId: this.selectedNode.id, value }));
	}

	updateSelectedList(fieldName: string, rawValue: string)
	{
		this.updateSelectedPartial({
			[fieldName]: this.parseList(rawValue)
		});
	}

	updateSelectedProviderLogicalName(logicalName: string)
	{
		const current = this.selectedEntity ?? this.selectedField ?? this.selectedRelationship;
		if (!current)
		{
			return;
		}

		this.updateSelectedPartial({
			providerBindings: logicalName
				? { ...current.providerBindings, dataverse: { logicalName } }
				: {}
		});
	}

	updateStageRuleList(fieldName: 'entryRuleIds' | 'exitRuleIds' | 'allowedOutcomeIds', rawValue: string)
	{
		this.updateSelectedPartial({
			[fieldName]: this.parseList(rawValue)
		});
	}

	updateElementRuleList(fieldName: 'requiredRuleIds' | 'visibleRuleIds' | 'editableRuleIds', rawValue: string)
	{
		const element = this.selectedElement;
		if (!element)
		{
			return;
		}

		this.updateSelectedPartial({
			behavior: {
				...element.behavior,
				[fieldName]: this.parseList(rawValue)
			}
		});
	}

	updateElementBindingField(fieldId: string)
	{
		this.updateSelectedPartial({
			binding: { fieldId }
		});
	}

	updateRuntimeResponsibilities(slice: 'pcf' | 'dataverse' | 'azure', rawValue: string)
	{
		const runtime = this.selectedRuntime;
		if (!runtime)
		{
			return;
		}

		this.updateSelectedPartial({
			ownership: {
				...runtime.ownership,
				[slice]: {
					responsibilities: this.parseList(rawValue)
				}
			}
		});
	}

	updateVariableDefaultValue(rawValue: string)
	{
		this.updateSelectedPartial({
			defaultValue: this.parseScalar(rawValue)
		});
	}

	stringifyScalar(value: unknown): string
	{
		return value == null ? '' : `${value}`;
	}

	private async initDb()
	{
		return new Promise<void>((resolve, reject) =>
		{
			const dbRequest = indexedDB.open('dbmModelDocuments', 1);
			dbRequest.onupgradeneeded = () =>
			{
				const db = dbRequest.result;
				if (db && !db.objectStoreNames.contains(this.dbStore))
				{
					db.createObjectStore(this.dbStore, { keyPath: 'name' });
				}
			};
			dbRequest.onsuccess = () =>
			{
				this.db = dbRequest.result;
				resolve();
			};
			dbRequest.onerror = () => reject(dbRequest.error);
		});
	}

	private async loadResource()
	{
		if (!this._isInitialized || !this._webResourceName)
		{
			return;
		}

		this.isLoading = true;

		try
		{
			const existingRecord = globalThis.Xrm
				? await this.loadFromDataverse(this._webResourceName)
				: await this.loadFromIndexedDb(this._webResourceName);

			this.resourceRecord = existingRecord ?? {
				name: this._webResourceName,
				displayname: this._webResourceDisplayname || 'New DBM Model',
				modifiedon: null,
				model: createApprovalRequestTemplate()
			};

			this.displayName = this.resourceRecord.displayname || this._webResourceDisplayname || this.resourceRecord.model.package?.displayName || this.resourceNameSuffix;
			this.document = loadModel(this.resourceRecord.model);
			this.validationIssues = this.document.issues;
			this.rebuildTree(this.selectedNode?.id);
		}
		finally
		{
			this.isLoading = false;
		}
	}

	private async loadFromDataverse(name: string): Promise<ModelDocumentRecord | null>
	{
		const resource = (await Ys.Common.retrieveRecords(
			`webresourceset/Microsoft.Dynamics.CRM.RetrieveUnpublishedMultiple()?$select=displayname,name,modifiedon,content&$filter=name eq '${name}'`,
			1,
			true) as DataverseModelResource[])[0];

		if (!resource)
		{
			return null;
		}

		return {
			id: resource.webresourceid,
			name: resource.name,
			displayname: resource.displayname || this.toFallbackLabel(resource.name),
			modifiedon: resource.modifiedon ? new Date(resource.modifiedon) : null,
			model: resource.content ? JSON.parse(atob(resource.content)) : createApprovalRequestTemplate()
		};
	}

	private async loadFromIndexedDb(name: string): Promise<ModelDocumentRecord | null>
	{
		const transaction = this.db.transaction(this.dbStore, 'readonly');
		const store = transaction.objectStore(this.dbStore);
		return await new Promise<ModelDocumentRecord | null>((resolve) =>
		{
			const getRequest = store.get(name);
			getRequest.onsuccess = () =>
			{
				const result = getRequest.result;
				resolve(result
					? {
						id: result.id,
						name: result.name,
						displayname: result.displayname || this.toFallbackLabel(result.name),
						modifiedon: result.modifiedon ? new Date(result.modifiedon) : null,
						model: result.model ?? createApprovalRequestTemplate()
					}
					: null);
			};
			getRequest.onerror = () => resolve(null);
		});
	}

	private async lookupResourceId(name: string): Promise<string | undefined>
	{
		return (await Ys.Common.retrieveRecords(`webresourceset?$select=webresourceid&$filter=name eq '${name}'`, 1, true))[0]?.webresourceid;
	}

	private rebuildTree(selectedNodeId?: string | null)
	{
		const designerTree = this.document?.tree[0]?.children ?? [];
		this.treeEntries = this.toTreeNodes(designerTree);
		this.selectedTreeEntry = this.findTreeNode(selectedNodeId ?? this.treeEntries[0]?.key ?? null, this.treeEntries);
	}

	private toTreeNodes(nodes: DesignerNodeRef[]): TreeNode<DesignerNodeRef>[]
	{
		return nodes.map((node) => ({
			key: node.id,
			label: node.label,
			data: node,
			expanded: true,
			children: this.toTreeNodes(node.children)
		}));
	}

	private findTreeNode(key: string | null, nodes: TreeNode<DesignerNodeRef>[]): TreeNode<DesignerNodeRef> | null
	{
		if (!key)
		{
			return null;
		}

		for (const node of nodes)
		{
			if (node.key === key)
			{
				return node;
			}

			const childResult = this.findTreeNode(key, node.children ?? []);
			if (childResult)
			{
				return childResult;
			}
		}

		return null;
	}

	private applyResult(result: { document: DesignerDocument; issues: DesignerIssue[]; affectedNodeId: string | null })
	{
		this.document = result.document;
		this.validationIssues = result.issues;
		this.rebuildTree(result.affectedNodeId ?? this.selectedNode?.id ?? null);
	}

	private resolveSelectionIndex(): number | null
	{
		return this.resolveSelectionIndexAndLength()?.index ?? null;
	}

	private resolveSelectionIndexAndLength(): { index: number; length: number } | null
	{
		if (!this.document || !this.selectedNode)
		{
			return null;
		}

		const nodeId = this.selectedNode.id;
		const process = this.document.model.process;
		const metadata = this.document.model.metadata;

		const arrays: Array<{ ids: string[] }> = [
			{ ids: process.actors.map((entry) => `actor:${entry.id}`) },
			{ ids: process.variables.map((entry) => `variable:${entry.id}`) },
			{ ids: process.stages.map((entry) => `stage:${entry.id}`) },
			{ ids: process.transitions.map((entry) => `transition:${entry.id}`) },
			{ ids: process.outcomes.map((entry) => `outcome:${entry.id}`) },
			{ ids: this.document.model.forms.map((entry) => `form:${entry.id}`) },
			{ ids: metadata.entities.map((entry) => `entity:${entry.id}`) },
			{ ids: metadata.relationships.map((entry) => `relationship:${entry.id}`) },
			{ ids: this.document.model.rules.map((entry) => `rule:${entry.id}`) },
			{ ids: this.document.model.artifacts.map((entry) => `artifact:${entry.id}`) },
		];

		for (const form of this.document.model.forms)
		{
			arrays.push({ ids: form.layout.regions.map((entry) => `region:${form.id}:${entry.id}`) });
			arrays.push({ ids: form.elements.map((entry) => `element:${form.id}:${entry.id}`) });
		}

		for (const entity of metadata.entities)
		{
			arrays.push({ ids: entity.fields.map((entry) => `field:${entity.id}:${entry.id}`) });
		}

		for (const array of arrays)
		{
			const index = array.ids.indexOf(nodeId);
			if (index >= 0)
			{
				return {
					index,
					length: array.ids.length
				};
			}
		}

		return null;
	}

	private parseList(rawValue: string): string[]
	{
		return rawValue.split(',').map((entry) => entry.trim()).filter((entry) => !!entry);
	}

	private parseScalar(rawValue: string): string | number | boolean | null
	{
		const trimmed = rawValue.trim();
		if (!trimmed)
		{
			return null;
		}

		if (trimmed === 'true')
		{
			return true;
		}

		if (trimmed === 'false')
		{
			return false;
		}

		const numeric = Number(trimmed);
		if (!Number.isNaN(numeric) && trimmed === `${numeric}`)
		{
			return numeric;
		}

		return trimmed;
	}

	private toFallbackLabel(resourceName: string): string
	{
		return resourceName.replace(this.modelRoot, '');
	}
}
