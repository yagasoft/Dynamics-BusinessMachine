// access web service

import { Guid } from "../../node_modules/guid-typescript/dist/guid";
import { Entity } from "../models/xrm/entity";

export class Service
{
	/**
	 * Create an Entity record from CRM.
	 * @param entity Entity record to create.
	 * @returns ID of the new entity record as GUID.
	 */
	create(entity: Entity): Guid
	{
		$log.debug(`Creating entity: ${entity?.logicalName} ...`);
		
		const json = entity.toJSON();
		$log.trace(`Creating entity:`, `JSON:`, json);

		const result = ___create(json);
		$log.trace(`Creating entity:`, `result:`, result, `isGuid:`, Guid.isGuid(result));

		entity.id = Guid.parse(result.toString());
		$log.debug(`Created entity: ${entity?.logicalName}:${entity?.id}.`);
		
		return entity.id;
	}

	/**
	 * Update an Entity record in CRM.
	 * @param entity Entity record to create.
	 */
	update(entity: Entity): void
	{
		___update(entity);
	}

	/**
	 * Delete an Entity record from CRM.
	 * @param id ID of the record to delete.
	 */
	delete(id: Guid): void
	{
		___delete(id.toString());
	}

	/**
	 * Retrieves an Entity record from CRM.
	 * @param logicalName Logical name of the table.
	 * @param id ID of the record to retrieve.
	 * @param columns Array of column names, or pass '*' to retrieve all columns (not recommended!).
	 * @returns An Entity record.
	 */
	retrieve(logicalName: string, id: Guid, columns: string[] | string): Entity
	{
		$log.debug(`Retrieve entity:`, `logicalName`, logicalName, `id`, id, `columns`, columns);
		const crmEntity = ___retrieve(logicalName, id.toString(), typeof (columns) === 'string' ? [columns] : columns);
		$log.trace(`Retrieve entity:`, `retrieved`, crmEntity);

		const entity = new Entity();
		entity.logicalName = crmEntity.logicalName;
		entity.id = Guid.parse(crmEntity.id);

		if (crmEntity.attributes)
		{
			for (const a in crmEntity.attributes)
			{
				// TODO: instantiate proper prototypes
				entity.attributes[a] = crmEntity.attributes[a];
			}
		}

		$log.trace(`Retrieve entity:`, `converted to`, entity);

		return entity;
	}

	/**
	 * Retrieves entities from CRM.
	 * @param fetchXml FetchXML query.
	 * @param count [OPTIONAL] Number of records to retrieve, regardless of the count in the FetchXML.
	 * @param page [OPTIONAL] The page to retrieve, regardless of the count in the FetchXML.
	 * @returns An array of Entity records.
	 */
	retrieveMultiple(fetchXml: string, count?: number, page?: number): Entity[]
	{
		const crmEntities = ___retrieveMultiple(fetchXml, count, page) as any[];

		const entities: Entity[] = [];

		$log.trace(`retrieveMultiple:`, `retrieved`, crmEntities);

		for (const crmEntity of crmEntities) {
			const entity = new Entity();
			entity.logicalName = crmEntity.logicalName;
			entity.id = Guid.parse(crmEntity.id);

			if (crmEntity.attributes)
			{
				for (const a in crmEntity.attributes)
				{
					// TODO: instantiate proper prototypes
					entity.attributes[a] = crmEntity.attributes[a];
				}
			}

			entities.push(entity);
		}
		
		$log.trace(`retrieveMultiple:`, `converted to`, entities);

		return entities;
	}

	// /**
	//  * Retrieves an Entity record from CRM.
	//  * @param logicalName Logical name of the table.
	//  * @param id ID of the record to retrieve.
	//  * @param columns Array of column names, or pass '*' to retrieve all columns (not recommended!).
	//  * @returns An Entity record.
	//  */
	// retrieveByAttribute(logicalName: string, id: Guid, columns: string[] | string): Entity
	// {
	// 	return ___retrieve(logicalName, id, typeof (columns) === 'string' ? [columns] : columns);
	// }
}
