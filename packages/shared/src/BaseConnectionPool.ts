import createConnectionPool, {
  ConnectionPool,
  PoolOptions,
} from '@databases/connection-pool';
import splitSqlQuery from '@databases/split-sql-query';
import sql, {SQLQuery} from '@databases/sql';
import Factory, {Disposable} from './Factory';
import Driver from './Driver';
import QueryableType from './QueryableType';
import {
  executeAndReturnAll,
  executeAndReturnLast,
  queryInternal,
  taskInternal,
  txInternal,
} from './utils';

type TransactionOptions<TDriver extends Driver<any>> = TDriver extends Driver<
  infer TTransactionOptions
>
  ? TTransactionOptions
  : unknown;

export {PoolOptions};
export default class BaseConnectionPool<
  TConnection extends Disposable,
  TTransaction extends Disposable,
  TDriver extends Driver<any>
> {
  public readonly type = QueryableType.ConnectionPool;
  public readonly sql = sql;

  protected readonly _pool: ConnectionPool<TDriver>;
  private _disposed: boolean = false;
  private _factories: Factory<TDriver, TConnection, TTransaction>;
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
      if (await this._factories.canRecycleConnection(driver.connection, ex)) {
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

  tx<TResult>(
    fn: (connection: TTransaction) => Promise<TResult>,
    options?: TransactionOptions<TDriver>,
  ): Promise<TResult> {
    this._throwIfDisposed();
    return this._withDriverFromPool(txInternal, this._factories, fn, options);
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
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

  async dispose() {
    this._disposed = true;
    await this._pool.drain();
  }
}
