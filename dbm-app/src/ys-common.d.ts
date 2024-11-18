declare namespace Ys.Common {
    function buildWebApiHeaders(additionalHeaders: [string, string][]): [string, string][];
    function retrieveWebResource(name: string): Promise<string>;
    function retrieveRecords(query: string, top?: number, isSkipValidation?: boolean): Promise<any[]>;
    function validateCode(code: string, name: string): void;
}
