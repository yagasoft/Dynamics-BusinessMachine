// execution context; includes language, user, trace state

import { User } from "./user";

export class Context
{
	user: User;
	lcid: number;
	logLevel: LogLevel;
	isServer: boolean;
}

export enum LogLevel
{
	None,
	Error,
	Warn,
	Info,
	Debug,
	Trace
}
