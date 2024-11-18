import { Guid } from "../../node_modules/guid-typescript/dist/guid";
import { Entity } from "../models/xrm/entity";

// hooks
globalThis.___create ??= function (entity: any): string { throw new Error('Not implemented'); };
globalThis.___update ??= function (entity: any): void { throw new Error('Not implemented'); };
globalThis.___delete ??= function (id: string): void { throw new Error('Not implemented'); };
globalThis.___retrieve ??= function (logicalName: string, id: string, columns: string[]): any { throw new Error('Not implemented'); };
globalThis.___retrieveMultiple ??= function (fetchXml: string, count: number, page: number): any[] { throw new Error('Not implemented'); };

declare global
{
	function ___create(entity: any): string;
	function ___update(entity: any): void;
	function ___delete(id: string): void;
	function ___retrieve(logicalName: string, id: string, columns: string[]): any;
	function ___retrieveMultiple(fetchXml: string, count: number, page: number): any[];
}
