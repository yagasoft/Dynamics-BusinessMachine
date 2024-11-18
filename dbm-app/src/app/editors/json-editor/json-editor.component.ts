import { AfterViewInit, Component, ElementRef, EventEmitter, Inject, Input, Output, ViewChild } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PrimeIcons, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToolbarModule } from 'primeng/toolbar';
import { DividerModule } from 'primeng/divider';
import { SplitterModule } from 'primeng/splitter';
import { TreeModule } from 'primeng/tree';
import { JsEditorComponent } from '../../editors/js-editor/js-editor.component';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { FieldsetModule } from 'primeng/fieldset';
import { DbmObjectRelation } from '../../models/dbm-object-relation';
import { DbmObjectProperty } from '../../models/dbm-object-property';

@Component({
	selector: 'ys-json-editor',
	standalone: true,
	imports: [FormsModule, InputTextModule, CommonModule, RouterOutlet, JsEditorComponent, ButtonModule, ToolbarModule, DividerModule, SplitterModule, TreeModule, FieldsetModule],
	templateUrl: './json-editor.component.html',
	styleUrl: './json-editor.component.scss'
})
export class JsonEditorComponent
{
	PrimeIcons = PrimeIcons;

	get code(): DbmObjectProperty[]
	{
		return this._code;
	}

	@Input() set code(value: DbmObjectProperty[])
	{
		if (this._code === value)
		{
			return;
		}

		this._code = value;

		if (this._isInitialised)
		{
			this.loadTree();
		}
	}

	@Output() codeChange = new EventEmitter<DbmObjectProperty[]>();

	get entryId(): string
	{
		return this.selectedTreeEntry.data.id;
	}

	set entryId(value: string)
	{
		this.selectedTreeEntry.data.id = value;
		this.codeUpdated();
	}

	private _code: DbmObjectProperty[];

	private _isInitialised = false;

	treeEntries: TreeNode[] = [];
	selectedTreeEntry: TreeNode;

	constructor(@Inject(DOCUMENT) private document: Document) { }

	async ngOnInit()
	{
		await this.loadTree();
		this._isInitialised = true;
	}

	private async loadTree()
	{
		try
		{
			this.treeEntries = [{ children: [], expanded: true, data: new DbmObjectRelation({ id: 'root' }) } as TreeNode];
			this.selectedTreeEntry = this.treeEntries[0];

			this.processEntries(this.code);
		}
		catch (error)
		{
			console.error(`Failed to load tree:`, error);
		}
	}

	private processEntries(entries: DbmObjectProperty[])
	{
		if (!entries || !Array.isArray(entries))
		{
			return;
		}

		for (const resource of entries)
		{
			const relation = resource.isRelation ? resource as DbmObjectRelation : null;

			if (relation)
			{
				this.addRelation();
				this.selectedTreeEntry.data.id = relation.id;

				this.processEntries(relation.entries);
			}
			else
			{
				this.addProperty();
				this.selectedTreeEntry.data = resource;
			}

			this.selectedTreeEntry = this.treeEntries[0];
		}
	}

	addProperty()
	{
		const newNode = {} as TreeNode;
		newNode.data = new DbmObjectProperty({ id: '<property>' });

		if (this.selectedTreeEntry)
		{
			const parent = Array.isArray(this.selectedTreeEntry.children)
				? this.selectedTreeEntry
				: this.selectedTreeEntry.parent;
			const siblings = parent?.children;

			if (siblings)
			{
				siblings.push(newNode);
				newNode.parent = parent;
				(parent.data as DbmObjectRelation)?.entries?.push(newNode.data as DbmObjectProperty);
				siblings.sort((a, b) => a?.data?.id.localeCompare(b?.data?.id));
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
			this.treeEntries[0].children.sort((a, b) => a?.data?.id.localeCompare(b?.data?.id));
		}

		this.selectedTreeEntry = newNode;
		this.codeUpdated();
	}

	addRelation()
	{
		const newNode = { children: [], expanded: true } as TreeNode;
		newNode.data = new DbmObjectRelation({ id: '<relation-node>' });

		if (this.selectedTreeEntry)
		{
			this.selectedTreeEntry.children.push(newNode);
			newNode.parent = this.selectedTreeEntry;
			this.selectedTreeEntry.children.sort((a, b) => a?.data?.id.localeCompare(b?.data?.id));
		}
		else
		{
			this.treeEntries[0].children.push(newNode);
			newNode.parent = this.treeEntries[0];
			this.treeEntries[0].children.sort((a, b) => a?.data?.id.localeCompare(b?.data?.id));
		}

		this.selectedTreeEntry = newNode;
		this.codeUpdated();
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

		this.codeUpdated();
	}

	codeUpdated()
	{
		this._code = this.treeEntries[0]?.children?.map(e => e.data);

		if (this._isInitialised)
		{
			this.codeChange.emit(this._code);
		}
	}
}
