import connect, {ConnectionPool, Queryable, sql} from '@databases/mysql';
import TableType from './enums/TableType';
import getColumns, {Column} from './getColumns';
import getConstraints, {Constraint} from './getConstraints';
import getTables, {Table} from './getTables';

export {connect, Queryable, ConnectionPool, sql};

export interface SchemaQuery {
  schemaName?: string;
}

export interface TableDetails extends Table {
  columns: Column[];
  constraints: Constraint[];
}

export interface Schema {
  tables: TableDetails[];
}

export default async function getSchema(
  connection: Queryable,
  {schemaName}: SchemaQuery = {},
): Promise<Schema> {
  const [tables, allColumns, allConstraints] = await Promise.all([
    getTables(connection, {
      schemaName,
      type: [TableType.BaseTable, TableType.View],
    }),
    getColumns(connection, {schemaName}),
    getConstraints(connection, {schemaName}),
  ]);

  return {
    tables: tables.map(
      (t): TableDetails => ({
        ...t,
        columns: allColumns.filter(
          (c) => c.schemaName === t.schemaName && c.tableName === t.tableName,
        ),
        constraints: allConstraints.filter(
          (c) => c.schemaName === t.schemaName && c.tableName === t.tableName,
        ),
      }),
    ),
  };
}
