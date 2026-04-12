import { Context, LogLevel } from "../models/context/context";

export class Logger
{
	context: Context;
	logLevel: LogLevel;

	constructor(context?: Context)
	{
		this.context = context ?? globalThis.$context ?? new Context();
		this.logLevel = this.context.logLevel ?? LogLevel.Warn;
	}

	error(...args: any[]): void
	{
		this.log(LogLevel.Error, ...args);
	}

	warn(...args: any[]): void
	{
		this.log(LogLevel.Warn, ...args);
	}

	info(...args: any[]): void
	{
		this.log(LogLevel.Info, ...args);
	}

	debug(...args: any[]): void
	{
		this.log(LogLevel.Debug, ...args);
	}

	trace(...args: any[]): void
	{
		this.log(LogLevel.Trace, ...args);
	}

	log(logLevel: LogLevel, ...args: any[]): void
	{
		const effectiveLogLevel = this.logLevel ?? this.context.logLevel ?? LogLevel.Warn;
		if (effectiveLogLevel === LogLevel.None || logLevel > effectiveLogLevel)
		{
			return;
		}

		const levelName = LogLevel[logLevel]?.toUpperCase() ?? 'LOG';
		const prefix = `[DBM:${levelName}]`;
		const writer =
			logLevel <= LogLevel.Error ? console.error :
			logLevel === LogLevel.Warn ? console.warn :
			logLevel === LogLevel.Info ? console.info :
			console.debug;

		writer(prefix, ...args);
	}
}
