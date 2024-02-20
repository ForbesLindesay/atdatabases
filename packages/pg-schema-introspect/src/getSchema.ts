import connect, {Queryable, ConnectionPool, sql} from '@databases/pg';
import ClassKind from './enums/ClassKind';
import getAttributes, {Attribute} from './getAttributes';
import getClasses, {Class} from './getClasses';
import getConstraints, {Constraint} from './getConstraints';
import getSchemaName from './getSchemaName';
import getSearchPath from './getSearchPath';
import getTypes, {Type} from './getTypes';

export {connect, Queryable, ConnectionPool, sql};
export interface SchemaQuery {
  schemaID?: number;
  schemaName?: string;
}

export interface ClassDetails extends Class {
  attributes: Attribute[];
  constraints: Constraint[];
}

export interface Schema {
  types: Type[];
  classes: ClassDetails[];
}
export default async function getSchema(
  connection: Queryable,
  query: SchemaQuery = {},
): Promise<Schema> {
  const schemaName = query.schemaName
    ? query.schemaName
    : query.schemaID
      ? await getSchemaName(connection, query.schemaID)
      : (await getSearchPath(connection))[0];
  if (!schemaName) {
    throw new Error('No schema found');
  }

  const [types, classes, allAttributes, allConstraints] = await Promise.all([
    getTypes(connection, {schemaName}),
    getClasses(connection, {
      schemaName,
      kind: [
        ClassKind.OrdinaryTable,
        ClassKind.PartitionedTable,
        ClassKind.View,
        ClassKind.MaterializedView,
      ],
    }),
    getAttributes(connection, {schemaName}),
    getConstraints(connection, {schemaName}),
  ]);

  return {
    types,
    classes: classes.map(
      (cls): ClassDetails => ({
        ...cls,
        attributes: allAttributes.filter((att) => att.classID === cls.classID),
        constraints: allConstraints.filter(
          (con) => con.classID === cls.classID,
        ),
      }),
    ),
  };
}
