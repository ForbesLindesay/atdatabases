import {sql, SQLQuery, Queryable} from '@databases/mysql';

export interface SelectQuery<TRecord> {
  all(): Promise<TRecord[]>;
  orderByAsc(key: keyof TRecord): OrderedSelectQuery<TRecord>;
  orderByDesc(key: keyof TRecord): OrderedSelectQuery<TRecord>;
  select<
    TKeys extends readonly [keyof TRecord, ...(readonly (keyof TRecord)[])],
  >(
    ...fields: TKeys
  ): SelectQuery<Pick<TRecord, TKeys[number]>>;
}
export interface OrderedSelectQueryWithOffset<TRecord>
  extends SelectQuery<TRecord> {
  first(): Promise<TRecord | null>;
  limit(count: number): Promise<TRecord[]>;
}
export interface OrderedSelectQuery<TRecord>
  extends OrderedSelectQueryWithOffset<TRecord> {
  offset(count: number): Promise<OrderedSelectQueryWithOffset<TRecord>>;
}

class FieldQuery<T> {
  protected readonly __query: (
    columnName: string,
    sql: Queryable['sql'],
    toValue: (columnName: string, value: unknown) => unknown,
  ) => SQLQuery;
  constructor(
    query: (
      columnName: string,
      sql: Queryable['sql'],
      toValue: (columnName: string, value: unknown) => unknown,
    ) => SQLQuery,
  ) {
    this.__query = query;
  }
  protected __checkFieldType(): T {
    throw new Error(
      'This method is only there to help TypeScript interpret the type',
    );
  }
  static query<T>(
    columnName: string,
    q: FieldQuery<T> | unknown,
    sql: Queryable['sql'],
    toValue: (columnName: string, value: unknown) => unknown,
  ): SQLQuery {
    if (q === null) {
      return sql`${sql.ident(columnName)} IS NULL`;
    }
    if (q && q instanceof FieldQuery) {
      return q.__query(columnName, sql, toValue);
    }

    return sql`${sql.ident(columnName)} = ${toValue(columnName, q)}`;
  }
}

export type {FieldQuery};

export type WhereCondition<TRecord> = Partial<{
  [key in keyof TRecord]: TRecord[key] | FieldQuery<TRecord[key]>;
}>;

export function anyOf<T>(values: {
  [Symbol.iterator](): IterableIterator<T | FieldQuery<T>>;
}) {
  const valuesArray: any[] = [];
  const parts: FieldQuery<T>[] = [];
  for (const value of values) {
    if (value === null) {
      parts.push(
        new FieldQuery((columnName, sql, toValue) =>
          FieldQuery.query(columnName, null, sql, toValue),
        ),
      );
    } else if (value instanceof FieldQuery) {
      parts.push(value);
    } else {
      valuesArray.push(value);
    }
  }
  if (valuesArray.length) {
    parts.push(
      new FieldQuery<T>(
        (columnName, sql, toValue) =>
          sql`${sql.ident(columnName)} IN (${valuesArray.map((v) =>
            toValue(columnName, v),
          )})`,
      ),
    );
  }
  if (parts.length === 0) {
    return new FieldQuery<T>((_columnName, sql) => sql`FALSE`);
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return new FieldQuery<T>(
    (columnName, sql, toValue) =>
      sql`(${sql.join(
        parts.map((p) => FieldQuery.query(columnName, p, sql, toValue)),
        ' OR ',
      )})`,
  );
}

export function not<T>(value: T | FieldQuery<T>) {
  return new FieldQuery<T>(
    (columnName, sql, toValue) =>
      sql`NOT (${FieldQuery.query(columnName, value, sql, toValue)})`,
  );
}

export function inQueryResults(query: SQLQuery) {
  return new FieldQuery<any>(
    (columnName, sql) => sql`${sql.ident(columnName)} IN (${query})`,
  );
}

export function lessThan<T>(value: T) {
  return new FieldQuery<T>(
    (columnName, sql, toValue) =>
      sql`${sql.ident(columnName)} < ${toValue(columnName, value)}`,
  );
}

export function greaterThan<T>(value: T) {
  return new FieldQuery<T>(
    (columnName, sql, toValue) =>
      sql`${sql.ident(columnName)} > ${toValue(columnName, value)}`,
  );
}

class SelectQueryImplementation<TRecord>
  implements OrderedSelectQuery<TRecord>
{
  public readonly orderByQueries: SQLQuery[] = [];
  public limitCount: number | undefined;
  public offsetCount: number | undefined;
  private _selectFields: SQLQuery | undefined;

  constructor(
    private readonly _sql: typeof sql,
    private readonly _tableID: SQLQuery,
    private readonly _where: SQLQuery,
    public readonly _executeQuery: (query: SQLQuery) => Promise<TRecord[]>,
  ) {}

  private _methodCalled: string | undefined;
  private async _getResults(mode: string) {
    if (this._methodCalled) {
      throw new Error(
        `You cannot use the same query multiple times. ${this._methodCalled} has already been called on this query.`,
      );
    }
    this._methodCalled = mode;

    const sql = this._sql;
    const parts = [
      this._selectFields
        ? sql`SELECT ${this._selectFields} FROM ${this._tableID} ${this._where}`
        : sql`SELECT * FROM ${this._tableID} ${this._where}`,
    ];
    if (this.orderByQueries.length) {
      parts.push(sql`ORDER BY ${sql.join(this.orderByQueries, sql`, `)}`);
    }
    if (this.limitCount) {
      parts.push(sql`LIMIT ${this.limitCount}`);
    }
    if (this.offsetCount) {
      parts.push(sql`OFFSET ${this.offsetCount}`);
    }
    return this._executeQuery(
      parts.length === 1 ? parts[0] : sql.join(parts, sql` `),
    );
  }

  public orderByAsc(key: keyof TRecord): OrderedSelectQuery<TRecord> {
    const sql = this._sql;
    this.orderByQueries.push(sql`${sql.ident(key)} ASC`);
    return this;
  }
  public orderByDesc(key: keyof TRecord): OrderedSelectQuery<TRecord> {
    const sql = this._sql;
    this.orderByQueries.push(sql`${sql.ident(key)} DESC`);
    return this;
  }

  public select<
    TKeys extends readonly [keyof TRecord, ...(readonly (keyof TRecord)[])],
  >(...fields: TKeys) {
    if (this._selectFields) {
      throw new Error('Cannot call select fields multiple times on one query');
    }
    this._selectFields = this._sql.join(
      fields.map((f) => this._sql.ident(f)),
      ',',
    );
    return this;
  }

  public async all() {
    return await this._getResults('all');
  }
  public async limit(count: number) {
    if (!this.orderByQueries.length) {
      throw new Error(
        'You cannot call "limit" until after you call "orderByAsc" or "orderByDesc".',
      );
    }
    this.limitCount = count;
    return await this._getResults('limit');
  }
  public offset(offset: number) {
    if (!this.orderByQueries.length) {
      throw new Error(
        'You cannot call "offset" until after you call "orderByAsc" or "orderByDesc".',
      );
    }
    if (this.offsetCount !== undefined) {
      throw new Error('You cannot call "offset" multiple times');
    }
    this.offsetCount = offset;
    return this;
  }
  public async first() {
    if (!this.orderByQueries.length) {
      throw new Error(
        'You cannot call "first" until after you call "orderByAsc" or "orderByDesc".',
      );
    }
    this.limitCount = 1;
    const results = await this._getResults('first');
    return results.length ? results[0] : null;
  }
}

class Table<TRecord, TInsertParameters> {
  private readonly _value: (columnName: string, value: any) => unknown;
  constructor(
    private readonly _underlyingDb: Queryable,
    public readonly tableId: SQLQuery,
    public readonly tableName: string,
    serializeValue: (columnName: string, value: unknown) => unknown,
  ) {
    this._value = (c, v) => serializeValue(c, v);
  }

  private _rowToWhere(row: WhereCondition<TRecord>) {
    const {sql} = this._underlyingDb;
    const entries = Object.entries(row).filter((row) => row[1] !== undefined);
    if (entries.length === 0) {
      return sql``;
    }
    return sql`WHERE ${sql.join(
      entries.map(([columnName, value]) =>
        FieldQuery.query(columnName, value, sql, this._value),
      ),
      sql` AND `,
    )}`;
  }

  async insert<TRecordsToInsert extends readonly TInsertParameters[]>(
    ...rows: keyof TRecordsToInsert[number] extends keyof TInsertParameters
      ? TRecordsToInsert
      : readonly ({[key in keyof TInsertParameters]: TInsertParameters[key]} & {
          [key in Exclude<
            keyof TRecordsToInsert[number],
            keyof TInsertParameters
          >]: never;
        })[]
  ): Promise<void> {
    if (rows.length === 0) return;
    const {sql} = this._underlyingDb;

    const columnNamesSet = new Set<keyof TRecordsToInsert[number]>();
    for (const row of rows) {
      for (const columnName of Object.keys(row as any)) {
        columnNamesSet.add(columnName as keyof typeof row);
      }
    }
    const columnNames = [...columnNamesSet].sort();
    const columnNamesSql = sql.join(
      columnNames.map((columnName) => sql.ident(columnName)),
      sql`, `,
    );
    const values = rows.map(
      (row) =>
        sql`(${sql.join(
          columnNames.map((columnName) =>
            columnName in (row as any)
              ? sql.value(this._value(columnName as string, row[columnName]))
              : sql`DEFAULT`,
          ),
          `,`,
        )})`,
    );

    await this._underlyingDb.query(
      sql`INSERT INTO ${this.tableId} (${columnNamesSql}) VALUES ${sql.join(
        values,
        `,`,
      )}`,
    );
  }

  async update(
    whereValues: WhereCondition<TRecord>,
    updateValues: Partial<TRecord>,
  ): Promise<void> {
    const {sql} = this._underlyingDb;
    const where = this._rowToWhere(whereValues);
    const setClause = sql.join(
      Object.entries(updateValues).map(([columnName, value]) => {
        return sql`${sql.ident(columnName)} = ${this._value(
          columnName,
          value,
        )}`;
      }),
      sql`, `,
    );
    await this._underlyingDb.query(
      sql`UPDATE ${this.tableId} SET ${setClause} ${where}`,
    );
  }

  async delete(whereValues: WhereCondition<TRecord>): Promise<void> {
    const {sql} = this._underlyingDb;
    const where = this._rowToWhere(whereValues);
    await this._underlyingDb.query(sql`DELETE FROM ${this.tableId} ${where}`);
  }

  find(whereValues: WhereCondition<TRecord> = {}): SelectQuery<TRecord> {
    const {sql} = this._underlyingDb;
    const where = this._rowToWhere(whereValues);
    return new SelectQueryImplementation(
      sql,
      this.tableId,
      where,
      async (query) => await this._underlyingDb.query(query),
    );
  }

  // throws if > 1 row matches
  async findOne(whereValues: WhereCondition<TRecord>): Promise<TRecord | null> {
    const rows = await this.find(whereValues).all();
    if (rows.length >= 2) {
      throw new Error(
        'More than one row matched this query but you used `.findOne`.',
      );
    }
    if (rows.length !== 1) {
      return null;
    }
    return rows[0];
  }

  async count(whereValues: WhereCondition<TRecord> = {}): Promise<number> {
    const {sql} = this._underlyingDb;
    const where = this._rowToWhere(whereValues);
    const [result] = await this._underlyingDb.query(
      sql`SELECT count(*) AS count FROM ${this.tableId} ${where}`,
    );
    return parseInt(`${result.count}`, 10);
  }

  async untypedQuery(query: SQLQuery): Promise<TRecord[]> {
    return await this._underlyingDb.query(query);
  }
}

function getTable<TRecord, TInsertParameters>(
  tableName: string,
  defaultConnection: Queryable | undefined,
  serializeValue: (columnName: string, value: unknown) => unknown,
) {
  return (
    queryable: Queryable | undefined = defaultConnection,
  ): Table<TRecord, TInsertParameters> => {
    if (!queryable) {
      throw new Error(
        'You must either provide a "defaultConnection" to mysql-typed, or specify a connection when accessing the table.',
      );
    }
    return new Table<TRecord, TInsertParameters>(
      queryable,
      queryable.sql.ident(tableName),
      tableName,
      serializeValue,
    );
  };
}
export type {Table};

export interface MySqlTypedOptions {
  serializeValue?: (
    tableName: string,
    columnName: string,
    value: unknown,
  ) => unknown;

  // TODO: easy aliasing of fields and easy parsing of fields using a similar API to the serializeValue?
}
export interface MySqlTypedOptionsWithDefaultConnection
  extends MySqlTypedOptions {
  defaultConnection: Queryable;
}

export default function tables<TTables>(
  options: MySqlTypedOptionsWithDefaultConnection,
): {
  [TTableName in keyof TTables]: (
    connectionOrTransaction?: Queryable,
  ) => Table<
    PropertyOf<TTables[TTableName], 'record'>,
    PropertyOf<TTables[TTableName], 'insert'>
  >;
};
export default function tables<TTables>(options?: MySqlTypedOptions): {
  [TTableName in keyof TTables]: (
    connectionOrTransaction: Queryable,
  ) => Table<
    PropertyOf<TTables[TTableName], 'record'>,
    PropertyOf<TTables[TTableName], 'insert'>
  >;
};
export default function tables<TTables>(
  options: Partial<MySqlTypedOptionsWithDefaultConnection> = {},
): {
  [TTableName in keyof TTables]: (
    connectionOrTransaction?: Queryable,
  ) => Table<
    PropertyOf<TTables[TTableName], 'record'>,
    PropertyOf<TTables[TTableName], 'insert'>
  >;
} {
  return new Proxy(
    {},
    {
      get: (_target, prop, _receiver) => {
        if (prop === 'then') {
          return undefined;
        }
        const tableName = String(prop);
        return getTable(
          tableName,
          options.defaultConnection,
          getTableSerializeValue(tableName, options.serializeValue),
        );
      },
    },
  ) as any;
}

type PropertyOf<T, TProp extends string> = T extends {
  [k in TProp]: infer TValue;
}
  ? TValue
  : never;

function getTableSerializeValue(
  tableName: string,
  serializeValue?: (
    tableName: string,
    columnName: string,
    value: unknown,
  ) => unknown,
): (columnName: string, value: unknown) => unknown {
  return serializeValue
    ? (columnName, value) => serializeValue(tableName, columnName, value)
    : (_, value) => value;
}

module.exports = Object.assign(tables, {
  default: tables,
  anyOf,
  not,
  inQueryResults,
  lessThan,
  greaterThan,
});
