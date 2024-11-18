"use strict";
var Ys;
(function (Ys) {
    var Common;
    (function (Common) {
        function buildWebApiHeaders(additionalHeaders) {
            const headers = [
                ["OData-MaxVersion", "4.0"],
                ["OData-Version", "4.0"],
                ["Content-Type", "application/json; charset=utf-8"],
                ["Accept", "application/json"],
            ];
            for (const header of additionalHeaders) {
                headers.push(header);
            }
            if (!!globalThis.xrmGlobal?.accessToken) {
                headers.push(["Authorization", `Bearer ${globalThis.xrmGlobal.accessToken}`]);
            }
            return headers;
        }
        Common.buildWebApiHeaders = buildWebApiHeaders;
        async function retrieveWebResource(name) {
            const code = (await retrieveRecords(`webresourceset?$select=content&$filter=name eq '${name}'`))[0]?.content;
            validateCode(code, name);
            return code;
        }
        Common.retrieveWebResource = retrieveWebResource;
        async function retrieveRecords(query, top, isSkipValidation) {
            const response = await fetch(Xrm.Utility.getGlobalContext().getClientUrl() + `/api/data/v9.1/${query}`, {
                method: "GET",
                headers: buildWebApiHeaders([["Prefer", `odata.maxpagesize=${top ?? 1}`]])
            });
            if (!response.ok) {
                throw new Error('Fetch failed.', { cause: await response.json() });
            }
            const records = (await response.json()).value;
            if (isSkipValidation) {
                return records;
            }
            validateExists(records, query);
            return records;
        }
        Common.retrieveRecords = retrieveRecords;
        function validateExists(record, name) {
            if (record == null || record.length <= 0 || record[0] == null) {
                throw new Error(`Record '${name}' not found.`);
            }
        }
        function validateCode(code, name) {
            if (code == null || code.length <= 0) {
                throw new Error(`Script '${name}' not found.`);
            }
        }
        Common.validateCode = validateCode;
    })(Common = Ys.Common || (Ys.Common = {}));
})(Ys || (Ys = {}));
