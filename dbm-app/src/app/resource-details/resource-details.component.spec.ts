import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import type { TreeNode } from 'primeng/api';
import { ResourceDetailsComponent } from './resource-details.component';
import { decodeUtf8Base64 } from '../utf8-base64';

function flattenTree(nodes: TreeNode[]): TreeNode[] {
	const flattened: TreeNode[] = [];

	for (const node of nodes)
	{
		flattened.push(node);
		flattened.push(...flattenTree(node.children ?? []));
	}

	return flattened;
}

describe('ResourceDetailsComponent', () =>
{
	beforeEach(async () =>
	{
		await TestBed.configureTestingModule({
			imports: [ResourceDetailsComponent],
			providers: [provideAnimations()]
		}).compileComponents();
	});

	it('loads the richer process model and saves local edits with the new node types', async () =>
	{
		const fixture = TestBed.createComponent(ResourceDetailsComponent);
		const component = fixture.componentInstance;
		await (component as any).initDb();
		(component as any)._isInitialized = true;
		component.webResourceName = 'ys_/dbm/data/models/resource-details-smoke.json';
		component.webResourceDisplayname = 'Resource Details Smoke';
		await (component as any).loadResource();

		expect(component.document).not.toBeNull();
		expect(component.document?.model.process.steps.length ?? 0).toBeGreaterThan(0);

		const kinds = new Set(flattenTree(component.treeEntries).map((node) => node.data?.kind));
		expect(kinds.has('status')).toBeTrue();
		expect(kinds.has('step')).toBeTrue();
		expect(kinds.has('form-state')).toBeTrue();

		component.addSelected('status', 'collection:process:statuses');
		component.addSelected('step', 'collection:stage:draft-request:steps');

		expect(component.document?.dirty).toBeTrue();
		expect(component.validationIssues.filter((issue) => issue.level === 'error')).toEqual([]);

		await component.saveResource();

		expect(component.document?.dirty).toBeFalse();
		expect(component.resourceRecord?.name).toBe('ys_/dbm/data/models/resource-details-smoke.json');
	});

	it('saves Unicode model content through the host bridge using UTF-8 safe base64', async () =>
	{
		let savedRecord: any = null;
		(globalThis as any).dbmHostBridge = {
			hostKind: 'xrmtoolbox',
			listModelDocuments: async () => [],
			loadModelDocument: async () => null,
			saveModelDocument: async (record: any) =>
			{
				savedRecord = record;
				return {
					...record,
					id: 'host-record-id',
					modifiedon: new Date().toISOString()
				};
			},
			deleteModelDocument: async () => undefined
		};

		try
		{
			const fixture = TestBed.createComponent(ResourceDetailsComponent);
			const component = fixture.componentInstance;
			await (component as any).initDb();
			(component as any)._isInitialized = true;
			component.webResourceName = 'ys_/dbm/data/models/unicode-host-bridge.json';
			component.webResourceDisplayname = 'Unicode Host Bridge';
			await (component as any).loadResource();

			expect(component.document).not.toBeNull();
			if (component.document)
			{
				component.document.model.package.displayName = 'مرحبا من DBM';
				component.document.dirty = true;
			}
			await component.saveResource();

			expect(savedRecord).not.toBeNull();
			expect(decodeUtf8Base64(savedRecord.content)).toContain('مرحبا من DBM');
			expect(component.resourceRecord?.id).toBe('host-record-id');
			expect(component.document?.dirty).toBeFalse();
		}
		finally
		{
			delete (globalThis as any).dbmHostBridge;
		}
	});
});
