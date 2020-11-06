import {Queryable} from '@databases/pg';
import getTypes from './getTypes';
import getSearchPath from './getSearchPath';

export interface TypeIdQuery {
  schemaID?: number;
  schemaName?: string;
  typeName: string;
}

export default async function getTypeID(
  connection: Queryable,
  query: TypeIdQuery,
) {
  const types = await getTypes(connection, query);
  const fullTypeName = query.schemaName
    ? `${query.schemaName}.${query.typeName}`
    : query.typeName;
  if (types.length === 0) {
    throw new Error(`Could not find type: ${fullTypeName}`);
  }
  if (types.length === 1) {
    return types[0].typeID;
  }
  const searchPath = await getSearchPath(connection, {
    includeNonExistantSchemas: true,
  });
  for (const schemaName of searchPath) {
    const type = types.find((ty) => ty.schemaName === schemaName);
    if (type) {
      return type.typeID;
    }
  }
  throw new Error(
    `Could not find type: ${fullTypeName}. It could be any of: ${types
      .map((t) => `${t.schemaName}.${t.typeName}`)
      .join(', ')}`,
  );
}
