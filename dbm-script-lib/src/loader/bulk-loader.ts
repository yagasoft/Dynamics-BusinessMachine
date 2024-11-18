import { ProxyBase } from "../proxy/proxy-base";

/**
 * A property loader that queues properties called upon for later reference.
 */
export class BulkLoader extends ProxyBase<BulkLoader>
{
	private queue = [];

	constructor(parent?: any, callback?: (t: BulkLoader, p: string) => any)
	{
		super(
			(target: BulkLoader, p: string, receiver: any, parent?: any) => 
			{
				if (p in target)
				{
					return Reflect.get(target, p, receiver);
				}

				if (!target.queue.includes(p))
				{
					target.queue.push(p);
				}

				if (callback)
				{
					callback(this, p);
				}

				return this;
			},
			(t: BulkLoader, p: string, value: any, receiver: any, parent?: any) =>
			{
				throw new Error(`Use the 'dot' operator to add to the queue.`)
			},
			parent);
	}

	getItems(): string[]
	{
		return [...this.unproxied.queue];
	}

	remove(item: string): BulkLoader
	{
		const o = this.unproxied;
		const index = o.queue.indexOf(item);

		if (index >= 0)
		{
			o.queue.splice(index, 1);
		}

		return this;
	}

	toJSON()
	{
		return this.unproxied.queue;
	}
}
