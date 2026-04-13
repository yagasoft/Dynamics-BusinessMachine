export interface DbmHostModelDocumentSummary
{
	id?: string | null;
	name: string;
	displayname?: string | null;
	modifiedon?: string | null;
}

export interface DbmHostModelDocumentRecord extends DbmHostModelDocumentSummary
{
	content?: string | null;
}

export interface DbmHostBridge
{
	hostKind: 'xrmtoolbox' | string;
	listModelDocuments(): Promise<DbmHostModelDocumentSummary[]>;
	loadModelDocument(name: string): Promise<DbmHostModelDocumentRecord | null>;
	saveModelDocument(record: DbmHostModelDocumentRecord): Promise<DbmHostModelDocumentRecord>;
	deleteModelDocument(record: { id?: string | null; name: string }): Promise<void>;
}

declare global
{
	interface Window
	{
		dbmHostBridge?: DbmHostBridge;
	}

	// eslint-disable-next-line no-var
	var dbmHostBridge: DbmHostBridge | undefined;
}

export function getDbmHostBridge(): DbmHostBridge | null
{
	return globalThis.dbmHostBridge ?? globalThis.window?.dbmHostBridge ?? null;
}
