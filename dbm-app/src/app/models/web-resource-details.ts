import { EventEmitter } from "@angular/core";
import { WebResourceContent } from "./web-resource-content";

export class WebResourceDetails
{
	id: string;

	public get name(): string
	{
		return this._name;
	}

	public set name(v: string)
	{
		this._name = v;
		this.propertyChanged('name');
	}

	private _name: string = '<name-or-path>';

	public get displayname(): string
	{
		return this._displayname;
	}

	public set displayname(v: string)
	{
		this._displayname = v;
		this.propertyChanged('displayname');
	}

	private _displayname: string = '<label-or-displayname>';

	content: WebResourceContent = new WebResourceContent();
	modifiedon: Date;

	public get propertyChange(): EventEmitter<string>
	{
		return this._propertyChange = this._propertyChange ?? new EventEmitter<string>();
	}

	public set propertyChange(v: EventEmitter<string>)
	{
		this._propertyChange = v ?? new EventEmitter<string>();
	}

	private _propertyChange = new EventEmitter<string>();

	public constructor(init?: Partial<WebResourceDetails>)
	{
		if (init)
		{
			Object.assign(this, init);
		}
	}

	private propertyChanged(name: string)
	{
		this.propertyChange.emit(name);
	}
}
