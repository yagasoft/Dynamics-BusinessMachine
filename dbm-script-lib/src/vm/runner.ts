import { Context, LogLevel } from "../models/context/context";
import { User } from "../models/context/user";
import { Service } from "./service";
import { Memory } from "./memory";
import { Logger } from "../log/logger";

globalThis.$context = new Context();
$context.user = new User();
$context.isServer = globalThis.window == null || window.document == null;

globalThis.$service = new Service();
globalThis.$mem = new Memory();

globalThis.$log = new Logger();

globalThis.$this = null;

globalThis.$output = null;

export function processFile(fileId: string, $this: any, logLevel: LogLevel = LogLevel.Warn)
{
	// evaluate(expr, $this, logLevel);
}

export function evaluate(file: CodeFile, $this: any, logLevel: LogLevel = LogLevel.Warn)
{
	globalThis.$this = $this;

	$log.logLevel = logLevel;

	$log.debug('Executing ...');
	$log.trace(file);

	switch (file.type)
	{
		case 'js':
			$log.debug('Parsing JS file ...');
			return eval(`(() => { ${file.code} })()`);

		case 'json':
			$log.debug('Parsing JSON file ...');
			parseJson(file.code);
			return file.code;
		
		default:
			if (Object.hasOwn(file, 'type'))
			{
				throw new Error(`Unsupported file type: ${file.type}.`);
			}
			
			if (typeof file === 'string')
			{
				$log.debug('Parsing quick JS file ...');
				return eval(`(() => { ${file} })()`);
			}
			
			if (typeof file === 'object')
			{
				$log.debug('Parsing Quick JSON file ...');
				return parseQuickJson(file);
			}
			
			throw new Error(`Unsupported file type.`);
	}
}

export function parseJson(code: JsonCode | JsonCode[])
{
	if (Array.isArray(code))
	{
		for (const e of code)
		{
			parseJson(e);
		}
	}
	else if (code.isRelation && Array.isArray(code.code))
	{
		parseJson(code.code);
	}
	else
	{
		code.code = eval(`(() => { ${code.code} })()`);
	}
}

export function parseQuickJson(json: object | object[])
{
	if (Array.isArray(json))
	{
		for (const i in json)
		{
			json[i] = parseQuickJson(json[i]);
		}
		
		return json;
	}
	else if (typeof json !== 'object')
	{
		return json;
	}
	else
	{
		for (const key in json)
		{
			const value = json[key];
			json[key] = typeof value === 'string' ? eval(`(() => { ${value} })()`) : parseQuickJson(value);
		}

		return json;
	}
}

class CodeFile
{
	type: 'js' | 'json' = 'js';
	version: string;
	code: JsonCode[]
}

class JsonCode
{
	id: string;
	isRelation: boolean;
	code: string | JsonCode[];
}
