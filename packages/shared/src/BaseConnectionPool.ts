import createConnectionPool, {
  ConnectionPool,
  PoolOptions,
} from '@databases/connection-pool';
import splitSqlQuery from '@databases/split-sql-query';
import type {SQLQuery} from '@databases/sql';
import Factory, {Disposable} from './Factory';
import Driver from './Driver';
import QueryableType from './QueryableType';
import {
  assertSql,
  executeAndReturnAll,
  executeAndReturnLast,
  queryInternal,
  taskInternal,
  txInternal,
} from './utils';

type TransactionOptions<TDriver extends Driver<any, any>> =
  TDriver extends Driver<infer TTransactionOptions, any>
    ? TTransactionOptions
    : unknown;
type QueryStreamOptions<TDriver extends Driver<any, any>> =
  TDriver extends Driver<any, infer TQueryStreamOptions>
    ? TQueryStreamOptions
    : unknown;

const returnFalse = () => false;

export {PoolOptions};
export default class BaseConnectionPool<
  TConnection extends Disposable,
  TTransaction extends Disposable,
  TDriver extends Driver<any, any>,
> {
  public readonly type = QueryableType.ConnectionPool;

  protected readonly _pool: ConnectionPool<TDriver>;
  private readonly _factories: Factory<TDriver, TConnection, TTransaction>;
  private _disposed: boolean = false;
  constructor(
    options: PoolOptions<TDriver>,
    factories: Factory<TDriver, TConnection, TTransaction>,
  ) {
    this._pool = createConnectionPool<TDriver>(options);
    this._factories = factories;
  }

  protected async _withDriverFromPool<TArgs extends any[], TResult>(
    fn: (driver: TDriver, ...args: TArgs) => Promise<TResult>,
    ...args: TArgs
  ) {
    let releasing = false;
    const driver = await this._pool.getConnection();
    try {
      const result = await fn(driver.connection, ...args);
      releasing = true;
      driver.release();
      return result;
    } catch (ex) {
      if (releasing) {
        throw ex;
      }
      if (
        await driver.connection
          .canRecycleConnectionAfterError(ex)
          .catch(returnFalse)
      ) {
        releasing = true;
        driver.release();
      } else {
        releasing = true;
        driver.dispose();
      }
      throw ex;
    }
  }

  protected _throwIfDisposed() {
    if (this._disposed) {
      throw new Error(
        'You cannot run any operations on a ConnectionPool after it has been disposed.',
      );
    }
  }

  async task<T>(fn: (connection: TConnection) => Promise<T>): Promise<T> {
    this._throwIfDisposed();
    return this._withDriverFromPool(taskInternal, this._factories, fn);
  }

  async tx<TResult>(
    fn: (connection: TTransaction) => Promise<TResult>,
    options?: TransactionOptions<TDriver>,
  ): Promise<TResult> {
    this._throwIfDisposed();
    return this._withDriverFromPool(txInternal, this._factories, fn, options);
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    assertSql(query);
    this._throwIfDisposed();
    if (Array.isArray(query)) {
      if (query.length === 0) return [];
      return this._withDriverFromPool(
        queryInternal,
        query,
        executeAndReturnAll,
      );
    } else {
      return this._withDriverFromPool(
        queryInternal,
        splitSqlQuery(query),
        executeAndReturnLast,
      );
    }
  }

  async addPostCommitStep(fn: () => Promise<void>): Promise<void> {
    await fn();
  }

  async *queryStream(
    query: SQLQuery,
    options?: QueryStreamOptions<TDriver>,
  ): AsyncGenerator<any, void, unknown> {
    assertSql(query);
    this._throwIfDisposed();
    const poolRecord = await this._pool.getConnection();
    try {
      for await (const record of poolRecord.connection.queryStream(
        query,
        options,
      )) {
        yield record;
      }
    } finally {
      poolRecord.dispose();
    }
  }

  async dispose() {
    this._disposed = true;
    await this._pool.drain();
  }
}
