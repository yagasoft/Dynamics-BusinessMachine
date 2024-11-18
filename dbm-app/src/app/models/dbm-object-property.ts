export class DbmObjectProperty
{
	id: string;
	code: string;
	isRichText: boolean;
	isRelation: boolean = false;

	public constructor(init?: Partial<DbmObjectProperty>)
	{
		Object.assign(this, init);
	}
}
