import {SQLQuery, Queryable} from '@databases/pg';

type ColumnName = string | number | symbol;
export interface BulkOperationOptions<TColumnName extends ColumnName> {
  readonly database: Queryable;
  readonly tableName: string;
  readonly columnTypes: {readonly [K in TColumnName]: SQLQuery};
  readonly schemaName?: string;
  readonly serializeValue?: (columnName: string, value: unknown) => unknown;
}

export interface BulkInsertOptions<TColumnToInsert extends ColumnName>
  extends BulkOperationOptions<TColumnToInsert> {
  readonly columnsToInsert: readonly TColumnToInsert[];
  readonly records: readonly any[];
}

export interface BulkSelectOptions<TWhereColumn extends ColumnName>
  extends BulkOperationOptions<TWhereColumn> {
  readonly whereColumnNames: readonly TWhereColumn[];
  readonly whereConditions: readonly any[];
  readonly selectColumnNames?: readonly string[];
  readonly orderBy?: readonly {
    readonly columnName: string;
    readonly direction: 'ASC' | 'DESC';
  }[];
  readonly limit?: number;
}

export interface BulkUpdateOptions<
  TWhereColumn extends ColumnName,
  TSetColumn extends ColumnName,
> extends BulkOperationOptions<TWhereColumn | TSetColumn> {
  readonly whereColumnNames: readonly TWhereColumn[];
  readonly setColumnNames: readonly TSetColumn[];
  readonly updates: readonly {readonly where: any; readonly set: any}[];
}

export interface BulkDeleteOptions<TWhereColumn extends ColumnName>
  extends BulkOperationOptions<TWhereColumn> {
  readonly whereColumnNames: readonly TWhereColumn[];
  readonly whereConditions: readonly any[];
}

function tableId<TColumnName extends ColumnName>(
  options: BulkOperationOptions<TColumnName>,
) {
  const {sql} = options.database;
  return options.schemaName
    ? sql.ident(options.schemaName, options.tableName)
    : sql.ident(options.tableName);
}

function selectionSet<TColumnName extends ColumnName>(
  columns: readonly {
    readonly name: TColumnName;
    readonly alias?: ColumnName;
    readonly getValue?: (record: any) => unknown;
  }[],
  records: readonly any[],
  options: BulkOperationOptions<TColumnName>,
) {
  const {database, columnTypes, serializeValue} = options;
  const {sql} = database;
  return sql.join(
    columns.map(({name, alias, getValue}) => {
      const typeName = columnTypes[name];
      if (!typeName) {
        throw new Error(`Missing type name for ${name}`);
      }
      return sql`UNNEST(${records.map((r) => {
        const value = getValue ? getValue(r) : r[name];
        return serializeValue ? serializeValue(`${name}`, value) : value;
      })}::${typeName}[])${alias ? sql` AS ${sql.ident(alias)}` : sql``}`;
    }),
    `,`,
  );
}

function selection<TColumnName extends ColumnName>(
  columns: readonly {
    readonly name: TColumnName;
    readonly alias?: ColumnName;
    readonly getValue?: (record: any) => unknown;
  }[],
  records: readonly any[],
  options: BulkOperationOptions<TColumnName>,
) {
  const {database} = options;
  const {sql} = database;
  return sql`(SELECT ${selectionSet(columns, records, options)}) AS bulk_query`;
}

function condition<TColumnName extends ColumnName>(
  columnNames: readonly TColumnName[],
  options: BulkOperationOptions<TColumnName>,
) {
  const {database, tableName} = options;
  const {sql} = database;
  return sql.join(
    columnNames.map(
      (columnName) =>
        sql`${sql.ident(tableName, columnName)} = ${sql.ident(
          `bulk_query`,
          columnName,
        )}`,
    ),
    ` AND `,
  );
}

export async function bulkInsert<TColumnToInsert extends ColumnName>(
  options: BulkInsertOptions<TColumnToInsert>,
): Promise<void> {
  const {database, columnsToInsert, records} = options;
  const {sql} = database;
  await database.query(
    sql`INSERT INTO ${tableId(options)} (${sql.join(
      columnsToInsert.map((columnName) => sql.ident(columnName)),
      `,`,
    )}) SELECT ${selectionSet(
      columnsToInsert.map((name) => ({name})),
      records,
      options,
    )}`,
  );
}

export async function bulkSelect<TWhereColumn extends ColumnName>(
  options: BulkSelectOptions<TWhereColumn>,
): Promise<any[]> {
  const {
    database,
    tableName,
    whereColumnNames,
    whereConditions,
    selectColumnNames,
    orderBy,
    limit,
  } = options;
  const {sql} = database;
  return await database.query(
    sql.join(
      [
        sql`SELECT ${
          selectColumnNames
            ? sql.join(
                selectColumnNames.map((columnName) =>
                  sql.ident(tableName, columnName),
                ),
                ',',
              )
            : sql`${sql.ident(tableName)}.*`
        } FROM ${tableId(options)} INNER JOIN ${selection(
          whereColumnNames.map((columnName) => ({
            name: columnName,
            alias: columnName,
          })),
          whereConditions,
          options,
        )} ON (${condition(whereColumnNames, options)})`,
        orderBy?.length
          ? sql`ORDER BY ${sql.join(
              orderBy.map((q) =>
                q.direction === 'ASC'
                  ? sql`${sql.ident(tableName, q.columnName)} ASC`
                  : sql`${sql.ident(tableName, q.columnName)} DESC`,
              ),
              sql`, `,
            )}`
          : null,
        limit ? sql`LIMIT ${limit}` : null,
      ].filter(<T>(v: T): v is Exclude<T, null> => v !== null),
      sql` `,
    ),
  );
}

export async function bulkUpdate<
  TWhereColumn extends ColumnName,
  TSetColumn extends ColumnName,
>(options: BulkUpdateOptions<TWhereColumn, TSetColumn>): Promise<void> {
  const {database, whereColumnNames, setColumnNames, updates} = options;
  const {sql} = database;
  await database.query(
    sql`UPDATE ${tableId(options)} SET ${sql.join(
      setColumnNames.map(
        (columnName) =>
          sql`${sql.ident(columnName)} = ${sql.ident(
            `bulk_query`,
            `updated_value_of_${columnName}`,
          )}`,
      ),
      `,`,
    )} FROM ${selection(
      [
        ...whereColumnNames.map((columnName) => ({
          name: columnName,
          alias: columnName,
          getValue: (u: any) => u.where[columnName],
        })),
        ...setColumnNames.map((columnName) => ({
          name: columnName,
          alias: `updated_value_of_${columnName}`,
          getValue: (u: any) => u.set[columnName],
        })),
      ],
      updates,
      options,
    )} WHERE ${condition(whereColumnNames, options)}`,
  );
}

export async function bulkDelete<TWhereColumn extends ColumnName>(
  options: BulkDeleteOptions<TWhereColumn>,
): Promise<void> {
  const {database, whereColumnNames, whereConditions} = options;
  const {sql} = database;
  await database.query(
    sql`DELETE FROM ${tableId(options)} WHERE EXISTS (SELECT * FROM ${selection(
      whereColumnNames.map((columnName) => ({
        name: columnName,
        alias: columnName,
      })),
      whereConditions,
      options,
    )} WHERE ${condition(whereColumnNames, options)})`,
  );
}
