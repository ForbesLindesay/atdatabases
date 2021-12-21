import * as t from 'funtypes';
import {Queryable, sql} from '@databases/mysql';
import TableType from './enums/TableType';

export interface TableQuery {
  schemaName?: string;
  tableName?: string;
  type?: TableType | TableType[];
}
const TableSchema = t.Named(
  `Table`,
  t.Object({
    schemaName: t.String,
    tableName: t.String,
    tableType: t.Enum(`TableType`, TableType),
    comment: t.String,
  }),
);
export type Table = t.Static<typeof TableSchema>;
export default async function getTables(
  connection: Queryable,
  query: TableQuery,
): Promise<Table[]> {
  const conditions = tableQuery(query);

  const tables = await connection.query(sql`
    SELECT
      TABLE_SCHEMA as "schema_name",
      TABLE_NAME as "table_name",
      TABLE_TYPE as "table_type",
      TABLE_COMMENT as "table_comment"
    FROM INFORMATION_SCHEMA.TABLES
    ${
      conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``
    }
    ORDER BY TABLE_SCHEMA ASC, TABLE_NAME ASC;
  `);

  return tables
    .map(
      (t: any): Table => ({
        schemaName: t.schema_name,
        tableName: t.table_name,
        tableType: t.table_type,
        // Views always have a comment of "VIEW", but that isn't very helpful.
        comment:
          t.table_type === TableType.BaseTable ? t.table_comment ?? '' : '',
      }),
    )
    .map((t) => TableSchema.parse(t));
}

export function tableQuery(query: TableQuery) {
  const conditions = [];
  if (query.type) {
    if (Array.isArray(query.type)) {
      conditions.push(
        sql`TABLE_TYPE IN (${sql.join(
          query.type.map((t) => sql`${t}`),
          sql`, `,
        )})`,
      );
    } else {
      conditions.push(sql`TABLE_TYPE = ${query.type}`);
    }
  }
  if (query.schemaName) {
    conditions.push(sql`TABLE_SCHEMA = ${query.schemaName}`);
  }
  if (query.tableName) {
    conditions.push(sql`TABLE_NAME = ${query.tableName}`);
  }
  return conditions;
}
