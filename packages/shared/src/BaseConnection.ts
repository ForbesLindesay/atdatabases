import splitSqlQuery from '@databases/split-sql-query';
import sql, {SQLQuery} from '@databases/sql';
import {Disposable, TransactionFactory} from './Factory';
import Driver from './Driver';
import QueryableType from './QueryableType';
import {
  executeAndReturnAll,
  executeAndReturnLast,
  queryInternal,
  txInternal,
} from './utils';
import {Lock, getLock} from '@databases/lock';

type TransactionOptions<
  TDriver extends Driver<any, any>
> = TDriver extends Driver<infer TTransactionOptions, any>
  ? TTransactionOptions
  : unknown;
type QueryStreamOptions<
  TDriver extends Driver<any, any>
> = TDriver extends Driver<any, infer TQueryStreamOptions>
  ? TQueryStreamOptions
  : unknown;

export default class BaseConnection<
  TTransaction extends Disposable,
  TDriver extends Driver<any, any>
> {
  public readonly type = QueryableType.Connection;
  public readonly sql = sql;

  protected readonly _lock: Lock;

  private _disposed: undefined | Promise<void>;
  protected _throwIfDisposed() {
    if (this._disposed) {
      throw new Error(
        'You cannot run any operations on a Connection after it has been returned to the pool.',
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
    this._lock = getLock(driver.aquireLockTimeoutMilliseconds);
  }

  async task<T>(fn: (connection: this) => Promise<T>): Promise<T> {
    this._throwIfDisposed();
    return await fn(this);
  }

  async tx<TResult>(
    fn: (connection: TTransaction) => Promise<TResult>,
    options?: TransactionOptions<TDriver>,
  ): Promise<TResult> {
    this._throwIfDisposed();
    await this._lock.aquireLock();
    try {
      return await txInternal(this._driver, this._factories, fn, options);
    } finally {
      this._lock.releaseLock();
    }
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    this._throwIfDisposed();
    if (Array.isArray(query)) {
      if (query.length === 0) return [];
      await this._lock.aquireLock();
      try {
        return await queryInternal(this._driver, query, executeAndReturnAll);
      } finally {
        this._lock.releaseLock();
      }
    } else {
      await this._lock.aquireLock();
      try {
        return await queryInternal(
          this._driver,
          splitSqlQuery(query),
          executeAndReturnLast,
        );
      } finally {
        this._lock.releaseLock();
      }
    }
  }

  async *queryStream(
    query: SQLQuery,
    options?: QueryStreamOptions<TDriver>,
  ): AsyncGenerator<any, void, unknown> {
    this._throwIfDisposed();
    await this._lock.aquireLock();
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
