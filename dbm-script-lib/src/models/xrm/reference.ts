import { Guid } from "../../../node_modules/guid-typescript/dist/guid";

export abstract class Reference
{
	public id: Guid = null;
	public logicalName: string = null;

	get url(): string
	{
		// TODO: get URL
		return null;
	}

	constructor(logicalName?: string, id?: Guid, attributes?: any)
	{
		this.logicalName = logicalName;
		this.id = id;
	}

	toJSON()
	{
		return { id: this.id?.toString(), logicalName: this.logicalName, url: this.url };
	}
}
