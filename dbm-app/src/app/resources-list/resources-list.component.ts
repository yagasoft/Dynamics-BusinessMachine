import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PrimeIcons, TreeDragDropService, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { DividerModule } from 'primeng/divider';
import { SplitterModule } from 'primeng/splitter';
import { TreeModule } from 'primeng/tree';
import { ResourceDetailsComponent } from "../resource-details/resource-details.component";
import { HttpClient } from '@angular/common/http';

@Component({
	selector: 'ys-resources-list',
	standalone: true,
	providers: [TreeDragDropService],
	templateUrl: './resources-list.component.html',
	styleUrl: './resources-list.component.scss',
	imports: [CommonModule, RouterOutlet, ButtonModule, ToolbarModule, DividerModule, SplitterModule, TreeModule, ResourceDetailsComponent]
})
export class ResourcesListComponent
{
	PrimeIcons = PrimeIcons;

	get selectedTreeEntry(): TreeNode
	{
		return this._selectedTreeEntry;
	}

	set selectedTreeEntry(value: TreeNode)
	{
		if (value !== this._selectedTreeEntry)
		{
			setTimeout(() => this.isClearView = true, 0);
			setTimeout(() => this.isClearView = false, 1);
		}

		this._selectedTreeEntry = value;
	}

	private _selectedTreeEntry: TreeNode;

	isClearView: boolean = false;

	treeEntries: TreeNode[] = [];

	private db: IDBDatabase;
	private dbStore = 'dbmObjects';

	constructor(private http: HttpClient) { }

	async ngOnInit()
	{
		await this.initDb();
		await this.loadWebResources();
	}

	async initDb()
	{
		return new Promise<void>(
			(r, x) => 
			{
				const dbRequest = indexedDB.open('dbmResourceFiles', 1);

				dbRequest.onupgradeneeded =
					_ =>
					{
						let db = dbRequest.result;

						if (db && !db.objectStoreNames.contains(this.dbStore))
						{
							db.createObjectStore(this.dbStore, { keyPath: 'name' });
						}

						r();
					};

				dbRequest.onsuccess =
					_ =>
					{
						this.db = dbRequest.result;
						r();
					}
			});
	}

	private async loadWebResources()
	{
		let currentSelectedNode = this.selectedTreeEntry;

		try
		{
			let webResources: any[];

			if (globalThis.Xrm)
			{
				webResources =
					await Ys.Common
					.retrieveRecords(`webresourceset/Microsoft.Dynamics.CRM.RetrieveUnpublishedMultiple()?$select=displayname,name&$filter=startswith(name,'ys_/dbm/data')`, 9999, true)
			}
			else
			{
				const transaction = this.db.transaction(this.dbStore, 'readonly');
				const store = transaction.objectStore(this.dbStore);

				webResources = await (async () =>
					new Promise<any[]>((r, x) =>
					{
						const getRequest = store.getAll();
						getRequest.onsuccess = _ => r(getRequest.result);
					}))();
			}

			this.treeEntries = [{ children: [], expanded: true, data: new FolderEntry({ label: 'root' }) } as TreeNode];
			this.selectedTreeEntry = this.treeEntries[0];

			for (const resource of webResources)
			{
				let path = resource.name.replace('ys_/dbm/data', '');
				const pathSplit = path.split('/').filter(e => e);
				path = pathSplit[pathSplit.length - 1];
				pathSplit.splice(pathSplit.length - 1, 1);

				for (const pathNode of pathSplit)
				{
					let foundNode = (this.selectedTreeEntry.children).find(e => e.data?.name === pathNode);

					if (foundNode == null)
					{
						this.addFolder();
						this.selectedTreeEntry.data.name = this.selectedTreeEntry.data.label = pathNode;
					}
					else
					{
						this.selectedTreeEntry = foundNode;
					}
				}

				this.addResource();
				this.selectedTreeEntry.data.name = resource.name;
				this.selectedTreeEntry.data.label = resource.displayname;
				currentSelectedNode = resource.name === currentSelectedNode?.data?.name ? this.selectedTreeEntry : currentSelectedNode;

				this.selectedTreeEntry = this.treeEntries[0];
			}

			this.selectedTreeEntry = currentSelectedNode ?? this.treeEntries[0];
		}
		catch (error)
		{
			console.error(`Failed to load script ...`);
			console.error(error);
			this.selectedTreeEntry = null;
		}
	}

	addFolder()
	{
		const newNode = { children: [], expanded: true } as TreeNode;
		newNode.data = new FolderEntry({ name: '<path-node>', label: '<path-node>' });

		if (this.selectedTreeEntry)
		{
			this.selectedTreeEntry.children.push(newNode);
			newNode.parent = this.selectedTreeEntry;
			this.selectedTreeEntry.children.sort((a, b) => a?.data?.label.localeCompare(b?.data?.label));
		}
		else
		{
			this.treeEntries[0].children.push(newNode);
			newNode.parent = this.treeEntries[0];
			this.treeEntries[0].children.sort((a, b) => a?.data?.label.localeCompare(b?.data?.label));
		}

		this.selectedTreeEntry = newNode;
	}

	addResource()
	{
		const newNode = {} as TreeNode;
		newNode.data = new Resource({ name: '<resource>', label: '<resource>' });

		if (this.selectedTreeEntry)
		{
			const siblings = this.selectedTreeEntry.children ?? this.selectedTreeEntry.parent.children;

			if (siblings)
			{
				siblings.push(newNode);
				newNode.parent = this.selectedTreeEntry;
				siblings.sort((a, b) => a?.data?.label.localeCompare(b?.data?.label));
			}
			else
			{
				return;
			}
		}
		else
		{
			this.treeEntries[0].children.push(newNode);
			newNode.parent = this.treeEntries[0];
			this.treeEntries[0].children.sort((a, b) => a?.data?.label.localeCompare(b?.data?.label));
		}

		this.selectedTreeEntry = newNode;
	}

	refresh()
	{
		this.loadWebResources();
	}

	removeEntry()
	{
		const parent = this.selectedTreeEntry.parent;
		const siblings = parent?.children;

		if (siblings)
		{
			const currentIndex = siblings.indexOf(this.selectedTreeEntry);
			siblings.splice(currentIndex, 1);

			if (siblings?.length >= 1)
			{
				const newIndex = currentIndex === 0 ? 0 : (currentIndex + 1 >= siblings.length ? siblings.length - 1 : currentIndex + 1)
				this.selectedTreeEntry = siblings[newIndex];
			}
			else
			{
				this.selectedTreeEntry = parent;
			}
		}
	}

	codeUpdated()
	{

	}
}

class Resource
{
	name: string;
	label: string;
	content: string;
	isFolder: boolean = false;

	public constructor(init?: Partial<Resource>)
	{
		Object.assign(this, init);
	}
}

class FolderEntry extends Resource
{
	override isFolder: boolean = true;
	entries: Resource[];

	public constructor(init?: Partial<FolderEntry>)
	{
		super(init);
		Object.assign(this, init);
	}
}
