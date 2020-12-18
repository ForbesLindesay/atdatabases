import type {sql, SQLQuery, Queryable} from '@databases/pg';
import invariant from 'tiny-invariant';

export interface SelectQuery<TRecord> {
  all(): Promise<TRecord[]>;
  orderByAsc(key: keyof TRecord): OrderedSelectQuery<TRecord>;
  orderByDesc(key: keyof TRecord): OrderedSelectQuery<TRecord>;
}

export interface OrderedSelectQuery<TRecord> extends SelectQuery<TRecord> {
  first(): Promise<TRecord | null>;
  limit(count: number): Promise<TRecord[]>;
}

class FieldQuery<T> {
  protected readonly __query: (
    columnName: string,
    sql: Queryable['sql'],
    toValue: (columnName: string, value: any) => SQLQuery,
  ) => SQLQuery;
  constructor(
    query: (
      columnName: string,
      sql: Queryable['sql'],
      toValue: (columnName: string, value: any) => SQLQuery,
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
    toValue: (columnName: string, value: any) => SQLQuery,
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

export type WhereCondition<TRecord> = Partial<
  {[key in keyof TRecord]: TRecord[key] | FieldQuery<TRecord[key]>}
>;

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
          sql`${sql.ident(columnName)} = ANY(${valuesArray.map((v) =>
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
  implements OrderedSelectQuery<TRecord> {
  public readonly orderByQueries: SQLQuery[] = [];
  public limitCount: number | undefined;

  constructor(
    private readonly _sql: typeof sql,
    private readonly _tableID: SQLQuery,
    private readonly _where: SQLQuery,
    public readonly _executeQuery: (query: SQLQuery) => Promise<TRecord[]>,
  ) {}

  private _methodCalled: string | undefined;
  private async _getResults(mode: string) {
    invariant(
      !this._methodCalled,
      `You cannot use the same query multiple times. ${this._methodCalled} has alread been called on this query.`,
    );
    this._methodCalled = mode;

    const sql = this._sql;
    const parts = [sql`SELECT * FROM ${this._tableID} ${this._where}`];
    if (this.orderByQueries.length) {
      parts.push(sql`ORDER BY ${sql.join(this.orderByQueries, sql`, `)}`);
    }
    if (this.limitCount) {
      parts.push(sql`LIMIT ${this.limitCount}`);
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
  private readonly _tableID: SQLQuery;
  private readonly _value: (columnName: string, value: any) => SQLQuery;
  constructor(
    private readonly _underlyingDb: Queryable,
    tableName: SQLQuery,
    serializer: (columnName: string, value: unknown) => unknown,
  ) {
    const {sql} = _underlyingDb;

    this._tableID = tableName;
    this._value = (c, v) => sql.value(serializer(c, v));
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

  private async _insert<TRecordsToInsert extends readonly TInsertParameters[]>(
    onConflict: null | ((row: TInsertParameters) => SQLQuery),
    ...rows: TRecordsToInsert
  ): Promise<TRecord[]> {
    const {sql} = this._underlyingDb;
    const results = await this._underlyingDb.query(
      rows.map((row) => {
        const entries = Object.entries(row);
        const columnNames = sql.join(
          entries.map(([columnName, _value]) => sql.ident(columnName)),
          sql`, `,
        );
        const values = sql.join(
          entries.map(([columnName, value]) => this._value(columnName, value)),
          sql`, `,
        );
        const query = sql`INSERT INTO ${this._tableID} (${columnNames}) VALUES (${values})`;
        if (onConflict) {
          return sql`${query} ${onConflict(row)} RETURNING *`;
        } else {
          return sql`${query} RETURNING *`;
        }
      }),
    );
    return results.map((r) => r[0]);
  }

  async insert<TRecordsToInsert extends readonly TInsertParameters[]>(
    ...rows: TRecordsToInsert
  ): Promise<{[key in keyof TRecordsToInsert]: TRecord}> {
    return this._insert(null, ...rows) as any;
  }

  async insertOrUpdate<TRecordsToInsert extends readonly TInsertParameters[]>(
    conflictKeys: [keyof TRecord, ...(keyof TRecord)[]],
    ...rows: TRecordsToInsert
  ): Promise<{[key in keyof TRecordsToInsert]: TRecord}> {
    const {sql} = this._underlyingDb;
    return this._insert(
      (row) =>
        sql`ON CONFLICT (${sql.join(
          conflictKeys.map((k) => sql.ident(k)),
          sql`, `,
        )}) DO UPDATE SET ${sql.join(
          Object.keys(row).map(
            (key) => sql`${sql.ident(key)}=EXCLUDED.${sql.ident(key)}`,
          ),
          sql`, `,
        )}`,
      ...rows,
    ) as any;
  }

  async insertOrIgnore<TRecordsToInsert extends readonly TInsertParameters[]>(
    ...rows: TRecordsToInsert
  ): Promise<{[key in keyof TRecordsToInsert]: TRecord | null}> {
    const {sql} = this._underlyingDb;
    return (await this._insert(() => sql`ON CONFLICT DO NOTHING`, ...rows)).map(
      (row) => row ?? null,
    ) as any;
  }

  async update(
    whereValues: WhereCondition<TRecord>,
    updateValues: Partial<TRecord>,
  ): Promise<TRecord[]> {
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
    return await this.untypedQuery(
      sql`UPDATE ${this._tableID} SET ${setClause} ${where} RETURNING *`,
    );
  }

  async delete(whereValues: WhereCondition<TRecord>): Promise<void> {
    const {sql} = this._underlyingDb;
    const where = this._rowToWhere(whereValues);
    await this.untypedQuery(sql`DELETE FROM ${this._tableID} ${where}`);
  }

  /**
   * @deprecated use .find instead of .select
   */
  select(whereValues: WhereCondition<TRecord> = {}): SelectQuery<TRecord> {
    return this.find(whereValues);
  }
  find(whereValues: WhereCondition<TRecord> = {}): SelectQuery<TRecord> {
    const {sql} = this._underlyingDb;
    const where = this._rowToWhere(whereValues);
    return new SelectQueryImplementation(
      sql,
      this._tableID,
      where,
      async (query) => await this._underlyingDb.query(query),
    );
  }

  /**
   * @deprecated use .findOne instead of .selectOne
   */
  async selectOne(
    whereValues: WhereCondition<TRecord>,
  ): Promise<TRecord | null> {
    return this.findOne(whereValues);
  }
  // throws if > 1 row matches
  async findOne(whereValues: WhereCondition<TRecord>): Promise<TRecord | null> {
    const rows = await this.find(whereValues).all();
    invariant(rows.length < 2, 'more than one row matched this query');
    if (rows.length !== 1) {
      return null;
    }
    return rows[0];
  }

  async untypedQuery(query: SQLQuery): Promise<TRecord[]> {
    return await this._underlyingDb.query(query);
  }
}

function getTable<TRecord, TInsertParameters>(
  tableName: string,
  defaultConnection: Queryable | undefined,
  schemaName: string | undefined,
  serializer: (columnName: string, value: unknown) => unknown,
) {
  return (
    queryable: Queryable | undefined = defaultConnection,
  ): Table<TRecord, TInsertParameters> => {
    if (!queryable) {
      throw new Error(
        'You must either provide a "defaultConnection" to pg-typed, or specify a connection when accessing the table.',
      );
    }
    return new Table<TRecord, TInsertParameters>(
      queryable,
      schemaName
        ? queryable.sql.ident(schemaName, tableName)
        : queryable.sql.ident(tableName),
      serializer,
    );
  };
}
export type {Table};

export interface PgTypedOptions {
  schemaName?: string;
  serializer?: (
    tableName: string,
    columnName: string,
    value: unknown,
  ) => unknown;

  // TODO: easy aliasing of fields and easy parsing of fields using a similar API to the serializer?
}
export interface PgTypedOptionsWithDefaultConnection extends PgTypedOptions {
  defaultConnection: Queryable;
}

export default function tables<TTables>(
  options: PgTypedOptionsWithDefaultConnection,
): {
  [TTableName in keyof TTables]: (
    connectionOrTransaction?: Queryable,
  ) => Table<
    PropertyOf<TTables[TTableName], 'record'>,
    PropertyOf<TTables[TTableName], 'insert'>
  >;
};
export default function tables<TTables>(
  options?: PgTypedOptions,
): {
  [TTableName in keyof TTables]: (
    connectionOrTransaction: Queryable,
  ) => Table<
    PropertyOf<TTables[TTableName], 'record'>,
    PropertyOf<TTables[TTableName], 'insert'>
  >;
};
export default function tables<TTables>(
  options: Partial<PgTypedOptionsWithDefaultConnection> = {},
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
          options.schemaName,
          getTableSerializer(tableName, options.serializer),
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

function getTableSerializer(
  tableName: string,
  serializer?: (
    tableName: string,
    columnName: string,
    value: unknown,
  ) => unknown,
): (columnName: string, value: unknown) => unknown {
  return serializer
    ? (columnName, value) => serializer(tableName, columnName, value)
    : (_, value) => value;
}
