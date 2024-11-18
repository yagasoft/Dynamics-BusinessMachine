import { ProxyBase } from "../proxy/proxy-base";
import { Cache } from "./cache";

export class CacheDelete extends ProxyBase<CacheDelete>
{
	private cacheInner: Cache;

	constructor(parent: Cache)
	{
		super(
			(target: CacheDelete, p: string, receiver: any, parent?: any) =>
			{
				if (p in target)
				{
					return Reflect.get(target, p, receiver);
				}

				return target.cacheInner.removeEntry(p);
			},
			(target: CacheDelete, p: string, value: any, receiver: any, parent?: any) =>
			{
				throw new Error('Object is read-only.')
			},
			parent);
		
		this.unproxied.cacheInner = parent;
	}

	toJSON()
	{
		return undefined;
	}
}
