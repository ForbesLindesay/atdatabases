import * as t from 'funtypes';
import {Queryable, sql} from '@databases/mysql';
import {tableQuery} from './getTables';

export interface ConstraintQuery {
  schemaName?: string;
  tableName?: string;
}
const KeyColumnUsageSchema = t.Object({
  constraint_name: t.String,
  schema_name: t.String,
  table_name: t.String,
  column_name: t.String,
  referenced_table_schema: t.Union(t.String, t.Null),
  referenced_table_name: t.Union(t.String, t.Null),
  referenced_column_name: t.Union(t.String, t.Null),
});

export interface Constraint {
  schemaName: string;
  tableName: string;
  constraintName: string;
  columns: {
    columnName: string;
    referenced: null | {
      schemaName: string;
      tableName: string;
      columnName: string;
    };
  }[];
}
export default async function getTables(
  connection: Queryable,
  query: ConstraintQuery,
): Promise<Constraint[]> {
  const conditions = tableQuery(query);

  const keys = (
    await connection.query(sql`
      SELECT
        CONSTRAINT_NAME as "constraint_name",
        TABLE_SCHEMA as "schema_name",
        TABLE_NAME as "table_name",
        COLUMN_NAME as "column_name",
        REFERENCED_TABLE_SCHEMA as "referenced_table_schema",
        REFERENCED_TABLE_NAME as "referenced_table_name",
        REFERENCED_COLUMN_NAME as "referenced_column_name"
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      ${
        conditions.length
          ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
          : sql``
      }
      ORDER BY TABLE_SCHEMA ASC, TABLE_NAME ASC, COLUMN_NAME ASC;
    `)
  ).map((k) => KeyColumnUsageSchema.parse(k));

  const constraints = new Map<string, Constraint>();
  for (const k of keys) {
    const constraintId = JSON.stringify([
      k.schema_name,
      k.table_name,
      k.constraint_name,
    ]);
    const constraint = constraints.get(constraintId) ?? {
      schemaName: k.schema_name,
      tableName: k.table_name,
      constraintName: k.constraint_name,
      columns: [],
    };
    constraints.set(constraintId, constraint);
    constraint.columns.push({
      columnName: k.column_name,
      referenced:
        k.referenced_table_schema !== null &&
        k.referenced_table_name !== null &&
        k.referenced_column_name !== null
          ? {
              schemaName: k.referenced_table_schema,
              tableName: k.referenced_table_name,
              columnName: k.referenced_column_name,
            }
          : null,
    });
  }
  return [...constraints.values()].sort((a, b) =>
    JSON.stringify([a.schemaName, a.tableName, a.constraintName]) <
    JSON.stringify([b.schemaName, b.tableName, b.constraintName])
      ? -1
      : 1,
  );
}
