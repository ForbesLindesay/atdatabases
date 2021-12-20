import * as t from 'funtypes';
import {Queryable, sql} from '@databases/mysql';
import getColumnType, {ColumnTypeSchema} from './getColumnType';
import {TableQuery, tableQuery} from './getTables';

export interface ColumnQuery extends Omit<TableQuery, 'type'> {
  columnName?: string;
}
const ColumnSchema = t.Object({
  schemaName: t.String,
  tableName: t.String,
  columnName: t.String,
  ordinalPosition: t.Number,

  isPrimaryKey: t.Boolean,
  isNullable: t.Boolean,
  default: t.Union(t.Null, t.String),
  type: ColumnTypeSchema,

  comment: t.String,
});
export type Column = t.Static<typeof ColumnSchema>;
export default async function getColumns(
  connection: Queryable,
  query: ColumnQuery,
): Promise<Column[]> {
  const conditions = tableQuery(query);
  if (query.columnName) {
    conditions.push(sql`COLUMN_NAME = ${query.columnName}`);
  }

  const columns = await connection.query(sql`
    SELECT
      TABLE_SCHEMA as "schema_name",
      TABLE_NAME as "table_name",
      COLUMN_NAME as "column_name",
      ORDINAL_POSITION as "ordinal_position",

      COLUMN_DEFAULT as "column_default",
      IS_NULLABLE as "is_nullable",
      DATA_TYPE as "data_type",
      COLUMN_TYPE as "column_type",

      COLUMN_COMMENT as "column_comment",

      CHARACTER_MAXIMUM_LENGTH as "character_maximum_length",
      CHARACTER_OCTET_LENGTH as "character_octet_length",
      NUMERIC_PRECISION as "numeric_precision",
      NUMERIC_SCALE as "numeric_scale",
      DATETIME_PRECISION as "datetime_precision",
      CHARACTER_SET_NAME as "character_set_name",
      COLLATION_NAME as "collation_name",
      COLUMN_KEY as "column_key",
      EXTRA as "extra"
    FROM INFORMATION_SCHEMA.COLUMNS
    ${
      conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``
    }
    ORDER BY TABLE_SCHEMA ASC, TABLE_NAME ASC, COLUMN_NAME ASC;
  `);

  return columns
    .map(
      (c: any): Column => ({
        schemaName: c.schema_name,
        tableName: c.table_name,
        columnName: c.column_name,
        ordinalPosition: c.ordinal_position,
        default: c.column_default,
        isNullable: c.is_nullable === 'YES',
        type: getColumnType(c),
        comment: c.column_comment,
        isPrimaryKey: c.column_key === 'PRI',
      }),
    )
    .map((t) => ColumnSchema.parse(t));
}
