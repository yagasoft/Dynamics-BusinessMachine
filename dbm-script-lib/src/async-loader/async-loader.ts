import { ProxyBase } from "../proxy/proxy-base";
import { IAsyncLoadHandler } from "./i-async-load-handler";
import { IAsyncLoader } from "./i-async-loader";

/**
 * A property loader that queues properties called upon for later reference.
 */
export class AsyncLoader extends ProxyBase<AsyncLoader>
{
	asyncLoadHandler: IAsyncLoadHandler;

	constructor(init?: Partial<AsyncLoader>)
	{
		super();
		Object.assign(this, init);
	}

	// tryProxy(prop: string, context: RunnerContext)
	// {
	// 	context.log.debug(`Async loading ${prop} ...`);
	// 	return this.asyncLoadHandler.handleAsyncLoad(prop, context);
	// }

	// tryProxySet(prop: string, value: any, context: RunnerContext): void
	// {
	// 	throw new Error('Object is read-only.');
	// }

	toJSON()
	{
		return {};
	}
}
