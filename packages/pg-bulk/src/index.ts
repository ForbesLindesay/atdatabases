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

export interface BulkConditionOptions<TWhereColumn extends ColumnName>
  extends BulkOperationOptions<TWhereColumn> {
  readonly whereColumnNames: readonly TWhereColumn[];
  readonly whereConditions: readonly any[];
}
export interface BulkSelectOptions<TWhereColumn extends ColumnName>
  extends BulkConditionOptions<TWhereColumn> {
  readonly distinctColumnNames?: readonly string[];
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
  extends BulkConditionOptions<TWhereColumn> {}

function tableId<TColumnName extends ColumnName>(
  options: BulkOperationOptions<TColumnName>,
) {
  const {sql} = options.database;
  return options.schemaName
    ? sql.ident(options.schemaName, options.tableName)
    : sql.ident(options.tableName);
}

function select<TColumnName extends ColumnName>(
  columns: readonly {
    readonly name: TColumnName;
    readonly getValue?: (record: any) => unknown;
  }[],
  records: readonly any[],
  options: BulkOperationOptions<TColumnName>,
) {
  const {database, columnTypes, serializeValue} = options;
  const {sql} = database;
  return sql`SELECT * FROM UNNEST(${sql.join(
    columns.map(({name, getValue}) => {
      const typeName = columnTypes[name];
      if (!typeName) {
        throw new Error(`Missing type name for ${name}`);
      }
      return sql`${records.map((r) => {
        const value = getValue ? getValue(r) : r[name];
        return serializeValue ? serializeValue(`${name}`, value) : value;
      })}::${typeName}[]`;
    }),
    `,`,
  )})`;
}

export function bulkInsertStatement<TColumnToInsert extends ColumnName>(
  options: BulkInsertOptions<TColumnToInsert>,
): SQLQuery {
  const {database, columnsToInsert, records} = options;
  const {sql} = database;
  return sql`INSERT INTO ${tableId(options)} (${sql.join(
    columnsToInsert.map((columnName) => sql.ident(columnName)),
    `,`,
  )}) ${select(
    columnsToInsert.map((name) => ({name})),
    records,
    options,
  )}`;
}

export async function bulkInsert<TColumnToInsert extends ColumnName>(
  options: BulkInsertOptions<TColumnToInsert> & {returning: SQLQuery},
): Promise<any[]>;
export async function bulkInsert<TColumnToInsert extends ColumnName>(
  options: BulkInsertOptions<TColumnToInsert>,
): Promise<void>;
export async function bulkInsert<TColumnToInsert extends ColumnName>(
  options: BulkInsertOptions<TColumnToInsert> & {returning?: SQLQuery},
): Promise<any[] | void> {
  const {database, returning} = options;
  const {sql} = database;
  return await database.query(
    returning
      ? sql`${bulkInsertStatement(options)} RETURNING ${returning}`
      : bulkInsertStatement(options),
  );
}

export function bulkCondition<TWhereColumn extends ColumnName>(
  options: BulkConditionOptions<TWhereColumn>,
): SQLQuery {
  const {database, whereColumnNames, whereConditions} = options;
  const {sql} = database;
  return sql`(${sql.join(
    whereColumnNames.map((columnName) => sql.ident(columnName)),
    `,`,
  )}) IN (${select(
    whereColumnNames.map((columnName) => ({name: columnName})),
    whereConditions,
    options,
  )})`;
}

export async function bulkSelect<TWhereColumn extends ColumnName>(
  options: BulkSelectOptions<TWhereColumn>,
): Promise<any[]> {
  const {database, distinctColumnNames, selectColumnNames, orderBy, limit} =
    options;
  const {sql} = database;
  return await database.query(
    sql.join(
      [
        sql`SELECT`,
        distinctColumnNames?.length
          ? sql`DISTINCT ON (${sql.join(
              distinctColumnNames.map((columnName) => sql.ident(columnName)),
              `,`,
            )})`
          : null,
        selectColumnNames
          ? sql.join(
              selectColumnNames.map((columnName) => sql.ident(columnName)),
              ',',
            )
          : sql`*`,
        sql`FROM ${tableId(options)} WHERE`,
        bulkCondition(options),
        orderBy?.length
          ? sql`ORDER BY ${sql.join(
              orderBy.map((q) =>
                q.direction === 'ASC'
                  ? sql`${sql.ident(q.columnName)} ASC`
                  : sql`${sql.ident(q.columnName)} DESC`,
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
>(
  options: BulkUpdateOptions<TWhereColumn, TSetColumn> & {returning: SQLQuery},
): Promise<any[]>;
export async function bulkUpdate<
  TWhereColumn extends ColumnName,
  TSetColumn extends ColumnName,
>(options: BulkUpdateOptions<TWhereColumn, TSetColumn>): Promise<void>;
export async function bulkUpdate<
  TWhereColumn extends ColumnName,
  TSetColumn extends ColumnName,
>(
  options: BulkUpdateOptions<TWhereColumn, TSetColumn> & {returning?: SQLQuery},
): Promise<any[] | void> {
  const {
    database,
    tableName,
    whereColumnNames,
    setColumnNames,
    updates,
    returning,
  } = options;
  const {sql} = database;
  return await database.query(
    sql`UPDATE ${tableId(options)} SET ${sql.join(
      setColumnNames.map(
        (columnName) =>
          sql`${sql.ident(columnName)} = ${sql.ident(
            `bulk_query`,
            `updated_value_of_${columnName}`,
          )}`,
      ),
      `,`,
    )} FROM (${select(
      [
        ...whereColumnNames.map((columnName) => ({
          name: columnName,
          getValue: (u: any) => u.where[columnName],
        })),
        ...setColumnNames.map((columnName) => ({
          name: columnName,
          getValue: (u: any) => u.set[columnName],
        })),
      ],
      updates,
      options,
    )} AS bulk_query(${sql.join(
      [
        ...whereColumnNames.map((columnName) => sql.ident(columnName)),
        ...setColumnNames.map((columnName) =>
          sql.ident(`updated_value_of_${columnName}`),
        ),
      ],
      `,`,
    )})) AS bulk_query WHERE ${sql.join(
      whereColumnNames.map(
        (columnName) =>
          sql`${sql.ident(tableName, columnName)} = ${sql.ident(
            `bulk_query`,
            columnName,
          )}`,
      ),
      ` AND `,
    )}${returning ? sql` RETURNING ${returning}` : sql``}`,
  );
}

export async function bulkDelete<TWhereColumn extends ColumnName>(
  options: BulkDeleteOptions<TWhereColumn>,
): Promise<void> {
  const {database} = options;
  const {sql} = database;
  await database.query(
    sql`DELETE FROM ${tableId(options)} WHERE ${bulkCondition(options)}`,
  );
}
