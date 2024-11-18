namespace Ys.Common
{
	export function buildWebApiHeaders(additionalHeaders: [string, string][]): [string, string][]
	{
		const headers: [string, string][] =
			[
				["OData-MaxVersion", "4.0"],
				["OData-Version", "4.0"],
				["Content-Type", "application/json; charset=utf-8"],
				["Accept", "application/json"],
			];

		for (const header of additionalHeaders)
		{
			headers.push(header);
		}

		if (!!globalThis.xrmGlobal?.accessToken)
		{
			headers.push(["Authorization", `Bearer ${globalThis.xrmGlobal.accessToken}`]);
		}

		return headers;
	}

	export async function retrieveWebResource(name: string): Promise<string>
	{
		const code = (await retrieveRecords(`webresourceset?$select=content&$filter=name eq '${name}'`))[0]?.content;
		validateCode(code, name);
		return code;
	}

	export async function retrieveRecords(query: string, top?: number, isSkipValidation?: boolean): Promise<any[]>
	{
		// TODO cache result
		const response =
			await fetch(Xrm.Utility.getGlobalContext().getClientUrl() + `/api/data/v9.1/${query}`,
				{
					method: "GET",
					headers: buildWebApiHeaders([["Prefer", `odata.maxpagesize=${top ?? 1}`]])
				});

		if (!response.ok)
		{
			throw new Error('Fetch failed.', { cause: await response.json() });
		}

		const records = (await response.json()).value;

		if (isSkipValidation)
		{
			return records;
		}

		validateExists(records, query);

		return records;
	}

	function validateExists(record: any, name: string)
	{
		if (record == null || record.length <= 0 || record[0] == null)
		{
			throw new Error(`Record '${name}' not found.`);
		}
	}

	export function validateCode(code: string, name: string)
	{
		if (code == null || code.length <= 0)
		{
			throw new Error(`Script '${name}' not found.`);
		}
	}
}
