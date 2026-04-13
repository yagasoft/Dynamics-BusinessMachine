import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimeIcons, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { SplitterModule } from 'primeng/splitter';
import { TreeModule } from 'primeng/tree';
import { ResourceDetailsComponent } from '../resource-details/resource-details.component';
import { getDbmHostBridge, type DbmHostModelDocumentSummary } from '../host-bridge';

interface ModelDocumentEntry {
	id?: string;
	name: string;
	label: string;
	modifiedOn?: Date | null;
}

interface DataverseWebResourceSummary {
	webresourceid?: string;
	name: string;
	displayname?: string | null;
	modifiedon?: string | null;
}

@Component({
	selector: 'ys-resources-list',
	standalone: true,
	templateUrl: './resources-list.component.html',
	styleUrl: './resources-list.component.scss',
	imports: [CommonModule, ButtonModule, ToolbarModule, SplitterModule, TreeModule, ResourceDetailsComponent]
})
export class ResourcesListComponent
{
	readonly PrimeIcons = PrimeIcons;
	private readonly modelRoot = 'ys_/dbm/data/models/';
	private readonly dbStore = 'dbmModelDocuments';

	treeEntries: TreeNode<ModelDocumentEntry>[] = [];
	selectedTreeEntry: TreeNode<ModelDocumentEntry> | null = null;
	isLoading = false;

	private db!: IDBDatabase;

	async ngOnInit()
	{
		await this.initDb();
		await this.loadModelDocuments();
	}

	async initDb()
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

	async createModel()
	{
		const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
		const name = `${this.modelRoot}dbm-model-${stamp}.json`;
		const label = `DBM Model ${stamp}`;
		const node: TreeNode<ModelDocumentEntry> = {
			key: name,
			label,
			data: {
				name,
				label,
				modifiedOn: null
			}
		};

		this.treeEntries = [...this.treeEntries, node];
		this.selectedTreeEntry = node;
	}

	async refresh()
	{
		await this.loadModelDocuments();
	}

	async removeEntry()
	{
		const entry = this.selectedTreeEntry?.data;
		if (!entry)
		{
			return;
		}

		const hostBridge = getDbmHostBridge();
		if (hostBridge)
		{
			await hostBridge.deleteModelDocument({
				id: entry.id,
				name: entry.name
			});
		}
		else if (globalThis.Xrm && entry.id)
		{
			await this.deleteDataverseEntry(entry);
		}
		else
		{
			await this.deleteIndexedDbEntry(entry.name);
		}

		await this.loadModelDocuments();
	}

	async handleResourceSaved()
	{
		await this.loadModelDocuments();
	}

	handleDisplayNameChange(label: string)
	{
		if (this.selectedTreeEntry?.data)
		{
			this.selectedTreeEntry.label = label;
			this.selectedTreeEntry.data.label = label;
		}
	}

	private async loadModelDocuments()
	{
		const previousSelection = this.selectedTreeEntry?.data?.name;
		this.isLoading = true;

		try
		{
			const hostBridge = getDbmHostBridge();
			const entries = hostBridge
				? await this.loadHostBridgeEntries(hostBridge)
				: globalThis.Xrm
					? await this.loadDataverseEntries()
					: await this.loadIndexedDbEntries();

			this.treeEntries =
				entries
					.sort((left, right) => left.label.localeCompare(right.label))
					.map((entry) =>
						({
							key: entry.name,
							label: entry.label,
							data: entry,
							leaf: true
						}) satisfies TreeNode<ModelDocumentEntry>);

			this.selectedTreeEntry =
				this.treeEntries.find((entry) => entry.data?.name === previousSelection)
				?? this.treeEntries[0]
				?? null;
		}
		finally
		{
			this.isLoading = false;
		}
	}

	private async loadDataverseEntries(): Promise<ModelDocumentEntry[]>
	{
		const resources =
			await Ys.Common.retrieveRecords(
				`webresourceset/Microsoft.Dynamics.CRM.RetrieveUnpublishedMultiple()?$select=displayname,name,webresourceid,modifiedon&$filter=startswith(name,'${this.modelRoot}')`,
				9999,
				true) as DataverseWebResourceSummary[];

		return resources.map((resource) => ({
			id: resource.webresourceid,
			name: resource.name,
			label: resource.displayname || this.toFallbackLabel(resource.name),
			modifiedOn: resource.modifiedon ? new Date(resource.modifiedon) : null
		}));
	}

	private async loadHostBridgeEntries(hostBridge: NonNullable<ReturnType<typeof getDbmHostBridge>>): Promise<ModelDocumentEntry[]>
	{
		const resources = await hostBridge.listModelDocuments();
		return resources.map((resource: DbmHostModelDocumentSummary) => ({
			id: resource.id ?? undefined,
			name: resource.name,
			label: resource.displayname || this.toFallbackLabel(resource.name),
			modifiedOn: resource.modifiedon ? new Date(resource.modifiedon) : null
		}));
	}

	private async loadIndexedDbEntries(): Promise<ModelDocumentEntry[]>
	{
		const transaction = this.db.transaction(this.dbStore, 'readonly');
		const store = transaction.objectStore(this.dbStore);

		const resources = await new Promise<any[]>((resolve) =>
		{
			const getRequest = store.getAll();
			getRequest.onsuccess = () => resolve(getRequest.result || []);
			getRequest.onerror = () => resolve([]);
		});

		return resources
			.filter((resource) => typeof resource?.name === 'string' && resource.name.startsWith(this.modelRoot))
			.map((resource) => ({
				id: resource.id,
				name: resource.name,
				label: resource.displayname || this.toFallbackLabel(resource.name),
				modifiedOn: resource.modifiedon ? new Date(resource.modifiedon) : null
			}));
	}

	private async deleteDataverseEntry(entry: ModelDocumentEntry)
	{
		const response = await fetch(
			`${globalThis.Xrm.Utility.getGlobalContext().getClientUrl()}/api/data/v9.1/webresourceset(${entry.id})`,
			{
				method: 'DELETE',
				headers: Ys.Common.buildWebApiHeaders([])
			});

		if (!response.ok)
		{
			throw new Error(`Failed to delete model document '${entry.name}'.`);
		}
	}

	private async deleteIndexedDbEntry(name: string)
	{
		const transaction = this.db.transaction(this.dbStore, 'readwrite');
		const store = transaction.objectStore(this.dbStore);

		await new Promise<void>((resolve, reject) =>
		{
			const deleteRequest = store.delete(name);
			deleteRequest.onsuccess = () => resolve();
			deleteRequest.onerror = () => reject(deleteRequest.error);
		});
	}

	private toFallbackLabel(resourceName: string): string
	{
		return resourceName.replace(this.modelRoot, '');
	}
}
