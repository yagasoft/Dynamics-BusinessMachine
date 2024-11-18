import { Reference } from "./reference";
import { ICache } from "../../cache/i-cache";
import { Cache } from "../../cache/cache";
import { IAsyncLoadHandler } from "../../async-loader/i-async-load-handler";
import { Guid } from "../../../node_modules/guid-typescript/dist/guid";
import { BulkLoader, IBulkLoader } from "../../global-auto";

export class Entity extends Reference implements ICache, IBulkLoader
{
	// TODO: handle relation loading
	// create a 'related' class, pass id and logical name, and tryProxy handle the relation loading
	// related = 
	// 			`Relation: ${prop}`;

	get name(): string
	{
		// TODO: handle name loading
		return `Entity name`;
	}

	attributes = new Cache(this,
		(t: Cache, p: string, value?: any) =>
			value === undefined ? this.load(p) : value);
	cache = this.attributes;

	defer = new BulkLoader(this);

	constructor(logicalName?: string, id?: Guid, attributes?: any)
	{
		super(logicalName, id);
		this.attributes.add(attributes);
	}

	// async handleAsyncLoad(prop: any): Promise<any>
	// {
	// 	return await new Promise((resolve, reject) =>
	// 	{
	// 		resolve(this.tryProxy(prop as string, context));
	// 	});
	// }

	load(attributes: string | string[])
	{
		const deferred = this.defer.getItems();

		const queue = typeof attributes === 'string'
			? [...deferred, attributes]
			: [...deferred, ...attributes];
		const missing = [];

		for (const e of queue.filter(e => !this.cache.has(e)))
		{
			$log.debug(`Missing: ${e}.`);
			missing.push(e);
		}

		const result = $service.retrieve(this.logicalName, this.id, missing).attributes;

		for (const e of missing)
		{
			$log.debug(`Caching: ${e}: ${result.get(e)}.`);
			this.cache[e] = result.get(e);
		}

		for (const e of queue)
		{
			this.defer.remove(e);
		}

		return typeof attributes === 'string'
			? result.get(attributes)
			: attributes.map(v => result.get(v));
	}

	toJSON()
	{
		return Object.assign(Object.assign({}, super.toJSON()), { name: this.name, attributes: this.attributes.unproxied.toJSON() });
	}
}
