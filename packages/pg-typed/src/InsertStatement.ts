/**
 * InsertStatement should be returned by:
 *
 *   Table.bulkInsert(...)
 *   Table.insert(...)
 *   Table.insertOne(...)
 *
 * We can remove:
 *
 *   Table.bulkInsertOrIgnore(...)
 *   Table.bulkInsertOrUpdate(...)
 *   Table.insertOrIgnore(...)
 *   Table.insertOrUpdate(...)
 *
 */
import type {Queryable, SQLQuery} from '@databases/pg';
import {
  ExecutableStatement,
  ExecutableStatementImplementation,
} from './ExecutableStatement';
import {
  FieldUpdate,
  ExcludedValue,
  isExcludedValue,
  ComputedFieldUpdate,
} from './Utilities';

export type InsertStatementMethods =
  | 'execute'
  | 'then'
  | 'catch'
  | 'finally'
  | 'onConflictDoNothing'
  | 'onConflict'
  | 'returning';

type ConflictUpdate<TRecord> =
  | keyof TRecord
  | {
      readonly [TColumn in keyof TRecord]?:
        | FieldUpdate<TRecord[TColumn]>
        | ExcludedValue;
    };
export interface InsertStatement<
  TRecord,
  TOne extends boolean,
  TOptional extends boolean,
  TReturning,
  TMethods extends InsertStatementMethods,
> extends ExecutableStatement<
    void extends TReturning
      ? void
      : TOne extends true
      ? TOptional extends true
        ? TReturning | undefined
        : TReturning
      : TReturning[]
  > {
  onConflictDoNothing(): PartialInsertStatement<
    TRecord,
    TOne,
    true,
    TReturning,
    Exclude<TMethods, 'onConflictDoNothing' | 'onConflict'>
  >;
  onConflict(
    ...columnsThatConflict: readonly [
      keyof TRecord,
      ...(readonly (keyof TRecord)[]),
    ]
  ): {
    doUpdate(
      ...columnsToUpdate: readonly [
        ConflictUpdate<TRecord>,
        ...(readonly ConflictUpdate<TRecord>[]),
      ]
    ): PartialInsertStatement<
      TRecord,
      TOne,
      TOptional,
      TReturning,
      Exclude<TMethods, 'onConflictDoNothing' | 'onConflict'>
    >;
  };

  returning(
    columns: '*',
  ): PartialInsertStatement<
    TRecord,
    TOne,
    TOptional,
    TRecord,
    Exclude<TMethods, 'returning'>
  >;
  returning<
    TColumnNames extends readonly [
      keyof TRecord,
      ...(readonly (keyof TRecord)[]),
    ],
  >(
    ...columns: TColumnNames
  ): PartialInsertStatement<
    TRecord,
    TOne,
    TOptional,
    Pick<TRecord, TColumnNames[number]>,
    Exclude<TMethods, 'returning'>
  >;
}

export type PartialInsertStatement<
  TRecord,
  TOne extends boolean,
  TOptional extends boolean,
  TReturning,
  TMethods extends InsertStatementMethods,
> = Pick<
  InsertStatement<TRecord, TOne, TOptional, TReturning, TMethods>,
  TMethods
>;

export interface InsertStatementInit<TOne extends boolean> {
  readonly isOne: TOne;
  readonly tableId: SQLQuery;
  readonly insertStatement: SQLQuery;
  readonly database: Queryable;
  readonly serializeValue: (columnName: string, value: unknown) => unknown;
}
class InsertStatementImplementation<TRecord>
  extends ExecutableStatementImplementation<any>
  implements
    InsertStatement<TRecord, true, false, any, InsertStatementMethods>,
    InsertStatement<TRecord, false, false, any, InsertStatementMethods>
{
  private readonly _init: InsertStatementInit<boolean>;
  private _onConflict: SQLQuery | null = null;
  private _returning: SQLQuery | null = null;
  constructor(init: InsertStatementInit<boolean>) {
    super();
    this._init = init;
  }

  protected async _execute(): Promise<any> {
    const {database, insertStatement} = this._init;
    const {sql} = database;
    const results = await database.query(
      sql.join(
        [insertStatement, this._onConflict, this._returning].filter(isNotNull),
        sql` `,
      ),
    );
    if (this._init.isOne) {
      if (results.length > 1) {
        throw new Error(
          `Expected to only insert one record but inserted ${results.length} records.`,
        );
      }
      return results.length ? results[0] : undefined;
    }
    return results;
  }

  onConflictDoNothing() {
    this._assertNotExecuted('onConflictDoNothing');
    const {sql} = this._init.database;
    this._onConflict = sql`ON CONFLICT DO NOTHING`;
    return this;
  }

  onConflict(
    ...columnsThatConflict: readonly [
      keyof TRecord,
      ...(readonly (keyof TRecord)[]),
    ]
  ) {
    return {
      doUpdate: (
        ...columnsToUpdate: readonly [
          ConflictUpdate<TRecord>,
          ...(readonly ConflictUpdate<TRecord>[]),
        ]
      ) => {
        this._assertNotExecuted('onConflict -> doUpdate');
        const {sql} = this._init.database;
        this._onConflict = sql`ON CONFLICT (${sql.join(
          columnsThatConflict.map((c) => sql.ident(c)),
        )}) DO UPDATE SET ${sql.join(
          Array.isArray(columnsToUpdate)
            ? columnsToUpdate
                .map((c) => sql.ident(c))
                .map((c) => sql`${c}=EXCLUDED.${c}`)
            : Object.entries(columnsToUpdate).map(([columnName, value]) => {
                const columnId = sql.ident(columnName);
                if (isExcludedValue(value)) {
                  return sql`${columnId}=EXCLUDED.${columnId}`;
                }
                return sql`${columnId}=${ComputedFieldUpdate.query(
                  sql`${this._init.tableId}.${columnId}`,
                  value,
                  sql,
                  (v) => this._init.serializeValue(columnName, v),
                )}`;
              }),
          `, `,
        )}`;
        return this;
      },
    };
  }

  returning(...columnNames: (string | number | symbol)[]) {
    this._assertNotExecuted('returning');
    const {sql} = this._init.database;
    if (columnNames.length === 1 && columnNames[0] === '*') {
      this._returning = sql`RETURNING *`;
    } else {
      this._returning = sql`RETURNING ${sql.join(
        columnNames.map((c) => sql`${this._init.tableId}.${sql.ident(c)}`),
        ', ',
      )}`;
    }
    return this as any;
  }
}

export function createInsertStatement<TRecord>(
  init: InsertStatementInit<false>,
): InsertStatement<TRecord, false, false, void, InsertStatementMethods>;
export function createInsertStatement<TRecord>(
  init: InsertStatementInit<true>,
): InsertStatement<TRecord, true, false, void, InsertStatementMethods>;
export function createInsertStatement<TRecord, TIsOne extends boolean>(
  init: InsertStatementInit<TIsOne>,
): InsertStatement<TRecord, TIsOne, false, void, InsertStatementMethods> {
  return new InsertStatementImplementation<TRecord>(init);
}

function isNotNull<T>(value: T): value is NonNullable<T> {
  return value != null;
}
