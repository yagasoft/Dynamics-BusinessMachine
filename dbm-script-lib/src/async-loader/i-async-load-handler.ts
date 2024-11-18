export interface IAsyncLoadHandler
{
	handleAsyncLoad(obj: any): Promise<any>;
}
