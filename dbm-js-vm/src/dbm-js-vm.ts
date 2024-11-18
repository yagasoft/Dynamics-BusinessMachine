

export async function runScriptById(id: string, contextObject: any)
{
	const expr = await Ys.Common.retrieveScriptById(id);
	runScript(expr, contextObject);
}

export async function runScript(expr: string, contextObject: any)
{
	const codeLibB64 = await Ys.Common.retrieveWebResource('ys_/dbm/libs/core.js');
	const codeLib = atob(codeLibB64);
	eval(codeLib);

	Ys.run(expr, contextObject);
}
