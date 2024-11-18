/**
 * Defines a base to allow for defining and accessing common properties across all objects in DBM.
 */
export abstract class ProxyBase<TThis extends object>
{
	unproxied: TThis;

	private _parent: any = null;

	constructor(
		getHandler?: (t: TThis, p: string, receiver?: any, parent?: any) => any,
		setHandler?: (t: TThis, p: string, v: any, receiver?: any, parent?: any) => boolean,
		parent?: any)
	{
		this._parent = parent;
		this.unproxied = this as any;

		return new Proxy(this,
			{
				get: (target, prop: string, receiver) =>
				{
					if (target.unproxied == null)
					{
						target.unproxied = target as any;
					}

					return getHandler
						? getHandler(target as any, prop, receiver, this._parent)
						: Reflect.get(target, prop, receiver)
				},
				set: (target, prop: string, value: any, receiver) =>
				{
					if (target.unproxied == null)
					{
						target.unproxied = target as any;
					}

					return setHandler
						? setHandler(target as any, prop, value, receiver, this._parent)
						: Reflect.set(target, prop, value, receiver)
				}
			});
	}

	abstract toJSON(): any;
}
