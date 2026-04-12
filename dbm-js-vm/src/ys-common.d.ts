declare namespace Ys.Common {
    function retrieveScriptById(id: string): Promise<string>;
    function retrieveWebResource(name: string): Promise<string>;
    function retrieveRecords(query: string, top?: number, isSkipValidation?: boolean): Promise<any[]>;
    function validateCode(code: string, name: string): void;
}

declare namespace Ys {
    function run(expr: string, contextObject: any): void;
}
