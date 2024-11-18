declare namespace Ys.Common {
    function retrieveWebResource(name: string): Promise<string>;
    function retrieveRecords(query: string, top?: number, isSkipValidation?: boolean): Promise<any[]>;
    function validateCode(code: string, name: string): void;
}
