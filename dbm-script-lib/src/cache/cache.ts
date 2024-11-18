import { ProxyBase } from "../proxy/proxy-base";
import { CacheDelete } from "./cache-delete";

/**
 * Caches values.
 */
export class Cache extends ProxyBase<Cache>
{
	get values(): any
	{
		const values = {};

		for (const [key, value] of this.unproxied.cacheInner)
		{
			values[key] = value;
		}

		return values;
	}

	remove: CacheDelete = new CacheDelete(this.unproxied);

	private cacheInner: Map<string, object> = new Map<string, object>();

	constructor(parent?: any, callback?: (t: Cache, p: string, value?: any) => any)
	{
		super(
			(target: Cache, p: string, receiver: any, parent?: any) => 
			{
				if (p in target)
				{
					return Reflect.get(target, p, receiver);
				}

				let value = undefined;

				if (target.cacheInner.has(p))
				{
					value = target.cacheInner.get(p);
				}

				return callback ? callback(this, p, value) : value;
			},
			(target: Cache, p: string, value: any, receiver: any, parent?: any) =>
			{
				target.cacheInner.set(p, value);
				return true;
			},
			parent);
	}

	/**
	 * Process an object as key/value pairs and add them to the cache.
	 * @param values Key/value pairs as object.
	 * @returns this
	 */
	add(values?: object): Cache
	{
		if (values)
		{
			for (const key in values)
			{
				this[key] = values[key];
			}
		}

		return this;
	}

	has(prop: string)
	{
		return this.unproxied.cacheInner.has(prop);
	}

	get(prop: string)
	{
		return this.unproxied.cacheInner.has(prop)
			? this.unproxied.cacheInner.get(prop)
			: undefined;
	}

	removeEntry(prop: string)
	{
		const o = this.unproxied;

		if (o.cacheInner.has(prop))
		{
			const v = o.cacheInner[prop];
			o.cacheInner.delete(prop);
			return v;
		}

		return undefined;
	}

	clear(): Cache
	{
		this.unproxied.cacheInner.clear();
		return this;
	}

	toJSON()
	{
		const values = {};

		for (const key in this.unproxied.values)
		{
			const value = this.unproxied.values[key];
			values[key] = value.toJSON ? value.toJSON() : value;
		}

		return values;
	};
}
