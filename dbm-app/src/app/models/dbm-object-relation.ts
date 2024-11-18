import { DbmObjectProperty } from "./dbm-object-property";

export class DbmObjectRelation extends DbmObjectProperty
{
	override isRelation: boolean = true;
	entries: DbmObjectProperty[] = [];

	public constructor(init?: Partial<DbmObjectRelation>)
	{
		super(init);
		Object.assign(this, init);
	}
}
