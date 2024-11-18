import { AfterViewInit, Component, ElementRef, EventEmitter, Inject, Input, Output, ViewChild } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PrimeIcons, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { DividerModule } from 'primeng/divider';
import { SplitterModule } from 'primeng/splitter';
import { TreeModule } from 'primeng/tree';
import { YsEditorComponent } from '../editor/editor.component';
import { JsEditorComponent } from '../editors/js-editor/js-editor.component';
import { JsonEditorComponent } from '../editors/json-editor/json-editor.component';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { FieldsetModule } from 'primeng/fieldset';
import { WebResourceDetails } from '../models/web-resource-details';
import { DbmObjectProperty } from '../models/dbm-object-property';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
	selector: 'ys-resource-details',
	standalone: true,
	imports: [FormsModule, InputTextModule, CommonModule, RouterOutlet, JsEditorComponent, JsonEditorComponent, YsEditorComponent, ButtonModule, ToolbarModule, DividerModule, SplitterModule, TreeModule, FieldsetModule, ProgressSpinnerModule],
	templateUrl: './resource-details.component.html',
	styleUrl: './resource-details.component.scss'
})
export class ResourceDetailsComponent implements AfterViewInit
{
	PrimeIcons = PrimeIcons;

	get webResourceName()
	{
		return this.webResource?.name ?? this._webResourceName;
	}

	@Input() set webResourceName(value: string)
	{
		this._webResourceName = value;
		this.loadWebResource();
	}

	private _webResourceName: string;

	webResource: WebResourceDetails;

	get webResourceDisplayname(): string
	{
		return this.webResource?.displayname;
	}

	@Input() set webResourceDisplayname(value: string)
	{
		if (this._isInitialised)
		{
			this.webResourceDisplaynameChange.emit(value);
		}

		if (this.webResource == null)
		{
			return;
		}

		this.webResource.displayname = value;
	}

	@Output() webResourceDisplaynameChange = new EventEmitter<string>();

	private _isInitialised = false;

	@ViewChild('nameEditorElement') nameEditorElement!: ElementRef;
	isEditName: boolean;
	webResourceNameTemp: string;

	public get webResourceNameTrunc(): string
	{
		return this.webResource?.name.replace('ys_/dbm/data/', '');
	}

	resourceId: string;

	public get contentType(): string
	{
		return this.webResource?.name.split('.').pop();
	}

	public get code(): string | DbmObjectProperty[]
	{
		return this.webResource?.content?.code;
	}

	public set code(value: string | DbmObjectProperty[])
	{
		this.webResource.content.code = value;
	}

	public get codeAsString(): string
	{
		return this.code as string;
	}

	public set codeAsString(value: string)
	{
		this.code = value;
	}

	public get codeAsProp(): DbmObjectProperty[]
	{
		return this.code as DbmObjectProperty[];
	}

	public set codeAsProp(value: DbmObjectProperty[])
	{
		this.code = value;
	}

	public get isSaveEnabled(): boolean
	{
		return !this.isSaving && this.isUnsavedChanges;
	}

	isSaving: boolean;
	latestSaved: number = 0;
	changes: number = 0;

	public get isUnsavedChanges(): boolean
	{
		return this.changes !== this.latestSaved;
	}

	private db: IDBDatabase;
	private dbStore = 'dbmObjects';

	constructor(@Inject(DOCUMENT) private document: Document) { }

	async ngOnInit()
	{
		await this.initDb();
		await this.loadWebResource();
		this._isInitialised = true;
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

				dbRequest.onerror =
					_ =>
					{
						x();
					}
			});
	}

	async ngAfterViewInit()
	{
		document
			.addEventListener('keydown',
				async e =>
				{
					if (e.ctrlKey && e.key === 's')
					{
						// Prevent the Save dialog to open
						e.preventDefault();
						await this.saveResource();
					}
				});
	}

	private async loadWebResource()
	{
		try
		{
			if (!this.db)
			{
				console.warn('DB not initialised. Retrying ...');
				setTimeout(this.loadWebResource, 100);
				return;
			}

			if (!this.webResourceName)
			{
				throw new Error('ID was not provided with the load event.');
			}

			this.webResource?.propertyChange?.unsubscribe();

			if (globalThis.Xrm)
			{
				const resource =
					(await Ys.Common
						.retrieveRecords(`webresourceset/Microsoft.Dynamics.CRM.RetrieveUnpublishedMultiple()?$select=displayname,name,modifiedon,content&$filter=name eq '${this.webResourceName}'`, 1, true))[0];

				this.webResource =
					resource
						? new WebResourceDetails(
							{
								id: resource.webresourceid,
								name: resource.name,
								displayname: resource.displayname,
								content: JSON.parse(atob(resource.content)),
								modifiedon: new Date(resource.modifiedon)
							})
						: new WebResourceDetails();
			}
			else
			{
				const transaction = this.db.transaction(this.dbStore, 'readonly');
				const store = transaction.objectStore(this.dbStore);

				this.webResource = await (async () =>
					new Promise<WebResourceDetails>((r, x) =>
					{
						const getRequest = store.get(this.webResourceName);
						getRequest.onsuccess = _ => r(new WebResourceDetails(getRequest.result));
						getRequest.onerror = _ => r(new WebResourceDetails());
					}))();

				this.webResource = this.webResource.id
					? this.webResource
					: new WebResourceDetails(
						{
							id: 'id1',
							displayname: 'ID 1',
							name: 'name1',
							content:
							{
								type: 'json',
								version: '1.0',
								code: [new DbmObjectProperty({ id: 'prop1', code: 'test', isRelation: false })]
							}
						});
			}

			this.webResource.propertyChange.subscribe(() => this.codeUpdated());
		}
		catch (error: any)
		{
			console.error(`Failed to load resource ${this.webResourceName} ...`, '\r\n', error, '\r\n', error.cause);
		}
	}

	async saveResource()
	{
		this.isSaving = true;
		const changeTemp = this.latestSaved;
		this.latestSaved = this.changes;

		try
		{
			if (!this.webResourceName)
			{
				throw new Error('ID was not provided with the save event.');
			}

			const toSave = this.webResource;
			toSave.content = {
				type: this.webResource.name.split('.').pop(),
				code: this.codeAsProp,
				version: '1.0'
			};

			if (globalThis.Xrm)
			{
				this.resourceId = toSave.id ??= (await Ys.Common
					.retrieveRecords(`webresourceset?$select=webresourceid,name&$filter=name eq '${toSave.name}'`, 1, true))[0]?.webresourceid;
				// TODO: compare modifiedOn with in-mem web resource, if different, open mergely

				const isExists = !!this.resourceId;

				// TODO: already exists? overwrite? git-like merge through UI?
				var record = {
					displayname: toSave.displayname,
					name: toSave.name,
					webresourcetype: 3, // script
					content: btoa(JSON.stringify(toSave.content))
				};

				let response =
					await fetch(globalThis.Xrm.Utility.getGlobalContext().getClientUrl() +
						`/api/data/v9.1/webresourceset${(isExists ? `(${toSave.id})` : '')}?$select=webresourceid,name`,
						{
							method: isExists ? "PATCH" : "POST",
							headers: Ys.Common.buildWebApiHeaders([["Prefer", "return=representation"]]),
							body: JSON.stringify(record)
						});

				if (!response.ok)
				{
					throw new Error('Fetch failed.', { cause: await response.json() });
				}

				let json = await response.json();

				this.resourceId = toSave.id = json.webresourceid ??= (await Ys.Common
					.retrieveRecords(`webresourceset?$select=webresourceid&$filter=name eq '${toSave.name}'`, 1, true))[0]?.webresourceid;

				var paramXml = {
					ParameterXml: `<importexportxml><webresources><webresource>{${toSave.id}}</webresource></webresources></importexportxml>`
				};

				response = await fetch(globalThis.Xrm.Utility.getGlobalContext().getClientUrl() + `/api/data/v9.1/PublishXml`,
					{
						method: "POST",
						headers: Ys.Common.buildWebApiHeaders([["Prefer", "return=representation"]]),
						body: JSON.stringify(paramXml)
					});

				if (!response.ok)
				{
					throw new Error('Fetch failed.', { cause: await response.json() });
				}
			}

			// TODO: save in indexDB if request above fails, mark it on UI, allow user to 'sync' to save local saves
			// if (!this.db)
			// {
			// 	console.warn('DB not initialised.');
			// 	return;
			// }

			// const transaction = this.db.transaction(this.dbStore, 'readwrite');
			// const store = transaction.objectStore(this.dbStore);

			// store.put(toSave);

			// transaction.oncomplete =
			// 	_ =>
			// 	{
			// 		this.isSaving = false;
			// 	};

			// transaction.onerror =
			// 	_ =>
			// 	{
			// 		this.latestSaved = changeTemp;
			// 		this.isSaving = false;
			// 	};
		}
		catch (error: any)
		{
			console.error(`Failed to save resource ${this.webResourceName} ...`, '\r\n', error, '\r\n', error.cause);
			this.latestSaved = changeTemp;
		}

		this.isSaving = false;
	}

	editName()
	{
		if (this.isEditName)
		{
			return;
		}

		this.webResourceNameTemp = this.webResourceNameTrunc;
		this.isEditName = true;

		setTimeout(
			() =>
			{
				const element = this.nameEditorElement.nativeElement as HTMLInputElement;
				element.focus();
				element.select();
			}, 1);
	}

	confirmName()
	{
		if (!this.isEditName)
		{
			return;
		}

		this.webResource.name = 'ys_/dbm/data/' + this.webResourceNameTemp;
		this.webResource.content.type = this.webResourceNameTemp.split('.').pop();

		this.isEditName = false;
	}

	cancelName()
	{
		if (!this.isEditName)
		{
			return;
		}

		this.webResourceNameTemp = null;

		this.isEditName = false;
	}

	codeUpdated()
	{
		this.changes++;
	}
}
