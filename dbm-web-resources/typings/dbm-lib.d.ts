declare module Ys
{
	import { Guid } from "../../node_modules/guid-typescript/dist/guid";
	import { Logger } from "../log/logger";
	import { Entity } from "../models/xrm/entity";
	export class Service {
	    create(entity: Entity, log?: Logger): Guid;
	    update(entity: Entity, log?: Logger): void;
	    delete(id: Guid, log?: Logger): void;
	    retrieve(logicalName: string, id: Guid, columns: string[] | string, log?: Logger): Entity;
	    retrieveMultiple(fetchXml: string, count?: number, page?: number, log?: Logger): Entity[];
	}

	export * from './vm/service';
	export * from './vm/runner';
	export * from './vm/memory';
	export * from './vm/broker';
	export * from './vm/helpers/random';
	export * from './proxy/proxy-base';
	export * from './models/xrm/reference';
	export * from './models/xrm/lookup';
	export * from './models/xrm/entity';
	export * from './models/xrm/choice';
	export * from './models/xrm/org-request/org-request';
	export * from './models/value/date-time';
	export * from './models/context/user';
	export * from './models/context/runner-context';
	export * from './models/context/context';
	export * from './log/logger';
	export * from './loader/i-bulk-loader';
	export * from './loader/bulk-loader';
	export * from './cache/i-cache';
	export * from './cache/cache';
	export * from './cache/cache-delete';
	export * from './async-loader/i-async-loader';
	export * from './async-loader/i-async-load-handler';
	export * from './async-loader/async-loader';

	import { LogLevel } from "../models/context/context";
	export function run(expr: string, $this: any, logLevel?: LogLevel): any;

	export * from './global-auto';
	export * from "../node_modules/guid-typescript/dist/guid";
	global {
	    let $value: any;
	}

	import { Context } from "./context";
	import { User } from "./user";
	import { Service } from "../../vm/service";
	import { Logger } from "../../log/logger";
	export class RunnerContext {
	    $this: any;
	    user: User;
	    context: Context;
	    service: Service;
	    mem: any;
	    log: Logger;
	}

	import { RunnerContext } from "../context/runner-context";
	import { Reference } from "./reference";
	import { Cache } from "../../cache/cache";
	import { IAsyncLoadHandler } from "../../async-loader/i-async-load-handler";
	import { Guid } from "../../../node_modules/guid-typescript/dist/guid";
	export class Entity extends Reference implements IAsyncLoadHandler {
	    get name(): string;
	    get attributes(): Cache;
	    constructor(logicalName?: string, id?: Guid);
	    handleAsyncLoad(prop: any, context: RunnerContext): Promise<any>;
	    tryProxy(prop: string, context: RunnerContext): any;
	    tryProxySet(prop: string, value: any, context: RunnerContext): void;
	    toJSON(): {
	        id: any;
	        logicalName: any;
	        url: any;
	    } & {
	        name: any;
	        attributes: any;
	    };
	}

	global {
	    function ___create(entity: any): string;
	    function ___update(entity: any): void;
	    function ___delete(id: string): void;
	    function ___retrieve(logicalName: string, id: string, columns: string[]): any;
	    function ___retrieveMultiple(fetchXml: string, count: number, page: number): any[];
	}
	export {};

	import { RunnerContext } from "../models/context/runner-context";
	import { BulkLoader } from "../loader/bulk-loader";
	import { IBulkLoader } from "../loader/i-bulk-loader";
	import { Cache } from "../cache/cache";
	import { ICache } from "../cache/i-cache";
	import { IAsyncLoader } from "../async-loader/i-async-loader";
	import { AsyncLoader } from "../async-loader/async-loader";
	export abstract class ProxyBase implements IBulkLoader, IAsyncLoader, ICache {
	    defer: BulkLoader;
	    bulkQueue: string[];
	    async: AsyncLoader;
	    cache: Cache;
	    _parent: any;
	    unproxied: any;
	    constructor();
	    abstract tryProxy(prop: string, context: RunnerContext): any;
	    abstract tryProxySet(prop: string, value: any, context: RunnerContext): any;
	    abstract toJSON(): any;
	}

	import { Guid } from "../../../node_modules/guid-typescript/dist/guid";
	import { ProxyBase } from "../../proxy/proxy-base";
	export abstract class Reference extends ProxyBase {
	    id: Guid;
	    logicalName: string;
	    get url(): string;
	    toJSON(): {
	        id: any;
	        logicalName: any;
	        url: any;
	    };
	}

	import { Reference } from "./reference";
	export class Lookup extends Reference {
	    name: string;
	    tryProxy(prop: string): void;
	    tryProxySet(prop: string, value: any): void;
	    toJSON(): {
	        id: any;
	        logicalName: any;
	        url: any;
	    } & {
	        name: any;
	    };
	}

	import { RunnerContext } from "../models/context/runner-context";
	import { ProxyBase } from "../proxy/proxy-base";
	export class BulkLoader extends ProxyBase {
	    queue: string[];
	    constructor(init?: Partial<BulkLoader>);
	    tryProxy(prop: string, context: RunnerContext): this;
	    tryProxySet(prop: string, value: any, context: RunnerContext): void;
	    toJSON(): any;
	}

	import { BulkLoader } from "./bulk-loader";
	export interface IBulkLoader {
	    defer: BulkLoader;
	}

	import { RunnerContext } from "../models/context/runner-context";
	import { ProxyBase } from "../proxy/proxy-base";
	import { CacheDelete } from "./cache-delete";
	export class Cache extends ProxyBase {
	    cacheInner: Map<string, object>;
	    remove: CacheDelete;
	    constructor();
	    has(prop: string): boolean;
	    set(prop: string, val: object): Map<string, object>;
	    deleteProp(prop: string): boolean;
	    tryProxy(prop: string, context: RunnerContext): object;
	    tryProxySet(prop: string, value: any, context: RunnerContext): void;
	    toJSON(): unknown[];
	}

	import { RunnerContext } from "../models/context/runner-context";
	import { ProxyBase } from "../proxy/proxy-base";
	import { Cache } from "./cache";
	export class CacheDelete extends ProxyBase {
	    cacheInner: Cache;
	    constructor(cache: Cache);
	    tryProxy(prop: string, context: RunnerContext): void;
	    tryProxySet(prop: string, value: any, context: RunnerContext): void;
	    toJSON(): {};
	}

	import { Cache } from "../cache/cache";
	export interface ICache {
	    cache: Cache;
	}

	import { RunnerContext } from "../models/context/runner-context";
	import { ProxyBase } from "../proxy/proxy-base";
	import { IAsyncLoadHandler } from "./i-async-load-handler";
	export class AsyncLoader extends ProxyBase {
	    asyncLoadHandler: IAsyncLoadHandler;
	    constructor(init?: Partial<AsyncLoader>);
	    tryProxy(prop: string, context: RunnerContext): Promise<any>;
	    tryProxySet(prop: string, value: any, context: RunnerContext): void;
	    toJSON(): {};
	}

	import { AsyncLoader } from "./async-loader";
	export interface IAsyncLoader {
	    async: AsyncLoader;
	}

	import { RunnerContext } from "../models/context/runner-context";
	export interface IAsyncLoadHandler {
	    handleAsyncLoad(obj: any, context: RunnerContext): Promise<any>;
	}

	interface Date {
	    add(value: string): Date;
	    addMilliseconds(value: number): Date;
	    addSeconds(value: number): Date;
	    addMinutes(value: number): Date;
	    addHours(value: number): Date;
	    addDays(value: number): Date;
	    addMonths(value: number): Date;
	    addYears(value: number): Date;
	}

	interface String {
	    trimChars(c: string[] | string): string;
	    trimStartChars(c: string[] | string): string;
	    trimEndChars(c: string[] | string): string;
	}

	export class Memory {
	}

	export class Rand {
	    generate(length: any, pool: any, isLetterStart: any, numLetterRatio: any): string;
	}

	import { Context, LogLevel } from "../models/context/context";
	export class Logger {
	    context: Context;
	    constructor(context: Context);
	    error(...args: any[]): void;
	    warn(...args: any[]): void;
	    info(...args: any[]): void;
	    debug(...args: any[]): void;
	    trace(...args: any[]): void;
	    log(logLevel: LogLevel, ...args: any[]): void;
	}

	export class Choice {
	}

	export class OrgRequest {
	}

	export class DateTime {
	}

	export class User {
	}

	import { User } from "./user";
	export class Context {
	    user: User;
	    lcid: number;
	    logLevel: LogLevel;
	    isServer: boolean;
	}
	export enum LogLevel {
	    None = 0,
	    Error = 1,
	    Warn = 2,
	    Info = 3,
	    Debug = 4,
	    Trace = 5
	}

}