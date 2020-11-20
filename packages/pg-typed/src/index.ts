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
  constructor(private readonly _underlyingDb: Queryable, tableName: SQLQuery) {
    this._tableID = tableName;
  }

  private _rowToWhere(row: Partial<TRecord>) {
    const {sql} = this._underlyingDb;
    const entries = Object.entries(row);
    if (entries.length === 0) {
      return sql``;
    }
    return sql`WHERE ${sql.join(
      entries.map(([columnName, value]) =>
        value === null
          ? sql`${sql.ident(columnName)} IS NULL`
          : sql`${sql.ident(columnName)} = ${value}`,
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
          entries.map(([key, _value]) => sql.ident(key)),
          sql`, `,
        );
        const values = sql.join(
          entries.map(([_key, value]) => sql.value(value)),
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
    whereValues: Partial<TRecord>,
    updateValues: Partial<TRecord>,
  ): Promise<TRecord[]> {
    const {sql} = this._underlyingDb;
    const where = this._rowToWhere(whereValues);
    const setClause = sql.join(
      Object.entries(updateValues).map(([columnName, value]) => {
        return sql`${sql.ident(columnName)} = ${value}`;
      }),
      sql`, `,
    );
    return await this.untypedQuery(
      sql`UPDATE ${this._tableID} SET ${setClause} ${where} RETURNING *`,
    );
  }

  async delete(whereValues: Partial<TRecord>): Promise<void> {
    const {sql} = this._underlyingDb;
    const where = this._rowToWhere(whereValues);
    await this.untypedQuery(sql`DELETE FROM ${this._tableID} ${where}`);
  }

  /**
   * @deprecated use .find instead of .select
   */
  select(whereValues: Partial<TRecord> = {}): SelectQuery<TRecord> {
    return this.find(whereValues);
  }
  find(whereValues: Partial<TRecord> = {}): SelectQuery<TRecord> {
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
  async selectOne(whereValues: Partial<TRecord>): Promise<TRecord | null> {
    return this.findOne(whereValues);
  }
  // throws if > 1 row matches
  async findOne(whereValues: Partial<TRecord>): Promise<TRecord | null> {
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
  {schemaName, defaultConnection}: Partial<PgTypedOptionsWithDefaultConnection>,
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
    );
  };
}
export type {Table};

export interface PgTypedOptions {
  schemaName?: string;
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
        return getTable(String(prop), options);
      },
    },
  ) as any;
}

type PropertyOf<T, TProp extends string> = T extends {
  [k in TProp]: infer TValue;
}
  ? TValue
  : never;
