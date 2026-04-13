import { TestBed } from '@angular/core/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { ResourcesListComponent } from './resources-list.component';

describe('ResourcesListComponent', () =>
{
	afterEach(() =>
	{
		delete (globalThis as any).dbmHostBridge;
	});

	it('lists and deletes model documents through the shared host bridge', async () =>
	{
		let resources = [
			{
				id: 'first-id',
				name: 'ys_/dbm/data/models/first.json',
				displayname: 'First Model',
				modifiedon: new Date('2026-04-13T12:00:00Z').toISOString()
			},
			{
				id: 'second-id',
				name: 'ys_/dbm/data/models/second.json',
				displayname: 'Second Model',
				modifiedon: new Date('2026-04-13T12:05:00Z').toISOString()
			}
		];
		const deleteSpy = jasmine.createSpy('deleteModelDocument').and.callFake(async (record: { name: string }) =>
		{
			resources = resources.filter((entry) => entry.name !== record.name);
		});

		(globalThis as any).dbmHostBridge = {
			hostKind: 'xrmtoolbox',
			listModelDocuments: async () => resources,
			loadModelDocument: async () => null,
			saveModelDocument: async (record: unknown) => record,
			deleteModelDocument: deleteSpy
		};

		await TestBed.configureTestingModule({
			imports: [ResourcesListComponent],
			providers: [provideAnimations()]
		}).compileComponents();

		const fixture = TestBed.createComponent(ResourcesListComponent);
		const component = fixture.componentInstance;
		await component.ngOnInit();

		expect(component.treeEntries.length).toBe(2);
		expect(component.treeEntries[0].label).toBe('First Model');
		expect(component.selectedTreeEntry?.data?.name).toBe('ys_/dbm/data/models/first.json');

		await component.removeEntry();

		expect(deleteSpy).toHaveBeenCalledWith({
			id: 'first-id',
			name: 'ys_/dbm/data/models/first.json'
		});
		expect(component.treeEntries.length).toBe(1);
		expect(component.treeEntries[0].label).toBe('Second Model');
	});
});
