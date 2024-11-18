import { Guid } from "../../../node_modules/guid-typescript/dist/guid";
import { Reference } from "./reference";

export class Lookup extends Reference
{
	public name: string = null;

	constructor(logicalName?: string, id?: Guid)
	{
		super(logicalName, id);
	}

	toJSON()
	{
		return Object.assign(Object.assign({}, super.toJSON()), { name: this.name });
	}
}
