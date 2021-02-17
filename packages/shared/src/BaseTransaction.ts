import splitSqlQuery from '@databases/split-sql-query';
import sql, {isSqlQuery, SQLQuery} from '@databases/sql';
import cuid = require('cuid');
import {Disposable, TransactionFactory} from './Factory';
import Driver from './Driver';
import QueryableType from './QueryableType';
import {Lock, getLock} from '@databases/lock';

type QueryStreamOptions<
  TDriver extends Driver<any, any>
> = TDriver extends Driver<any, infer TQueryStreamOptions>
  ? TQueryStreamOptions
  : unknown;

export default class BaseTransaction<
  TTransaction extends Disposable,
  TDriver extends Driver<any, any>
> {
  public readonly type = QueryableType.Transaction;
  public readonly sql = sql;

  protected readonly _lock: Lock;

  private _disposed: undefined | Promise<void>;
  protected _throwIfDisposed() {
    if (this._disposed) {
      throw new Error(
        'You cannot run any operations on a Transaction after it has been committed or rolled back.',
      );
    }
  }

  protected readonly _driver: TDriver;
  private readonly _factories: TransactionFactory<TDriver, TTransaction>;
  constructor(
    driver: TDriver,
    factories: TransactionFactory<TDriver, TTransaction>,
  ) {
    this._driver = driver;
    this._factories = factories;
    this._lock = getLock(driver.acquireLockTimeoutMilliseconds);
  }

  async task<T>(fn: (connection: this) => Promise<T>): Promise<T> {
    this._throwIfDisposed();
    return await fn(this);
  }
  async tx<T>(fn: (connection: TTransaction) => Promise<T>): Promise<T> {
    this._throwIfDisposed();
    await this._lock.acquireLock();
    try {
      const savepointName = cuid();
      await this._driver.createSavepoint(savepointName);
      const subTransaction = this._factories.createTransaction(this._driver);
      try {
        const result = await fn(subTransaction);
        await subTransaction.dispose();
        await this._driver.releaseSavepoint(savepointName);
        return result;
      } catch (ex) {
        await subTransaction.dispose();
        await this._driver.rollbackToSavepoint(savepointName);
        throw ex;
      }
    } finally {
      this._lock.releaseLock();
    }
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    this._throwIfDisposed();
    await this._lock.acquireLock();
    try {
      if (Array.isArray(query)) {
        if (query.length === 0) return [];
        for (const el of query) {
          if (!isSqlQuery(el)) {
            throw new Error(
              'Invalid query, you must use @databases/sql to create your queries.',
            );
          }
        }
        return await this._driver.executeAndReturnAll(query);
      } else {
        if (!isSqlQuery(query)) {
          throw new Error(
            'Invalid query, you must use @databases/sql to create your queries.',
          );
        }
        return await this._driver.executeAndReturnLast(splitSqlQuery(query));
      }
    } finally {
      this._lock.releaseLock();
    }
  }

  async *queryStream(
    query: SQLQuery,
    options?: QueryStreamOptions<TDriver>,
  ): AsyncGenerator<any, void, unknown> {
    this._throwIfDisposed();
    await this._lock.acquireLock();
    try {
      for await (const record of this._driver.queryStream(query, options)) {
        yield record;
      }
    } finally {
      this._lock.releaseLock();
    }
  }

  async dispose() {
    return this._disposed || (this._disposed = this._lock.pool());
  }
}
