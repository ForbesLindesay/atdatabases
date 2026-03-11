import splitSqlQuery from '@databases/split-sql-query';
import type {SQLQuery} from '@databases/sql';
import {Disposable, TransactionFactory} from './Factory';
import Driver from './Driver';
import QueryableType from './QueryableType';
import {
  assertSql,
  executeAndReturnAll,
  executeAndReturnLast,
  queryInternal,
  txInternal,
} from './utils';
import {Lock, createLock} from '@databases/lock';

type TransactionOptions<TDriver extends Driver<any, any>> =
  TDriver extends Driver<infer TTransactionOptions, any>
    ? TTransactionOptions
    : unknown;

export default class BaseConnection<
  TTransaction extends Disposable,
  TDriver extends Driver<any, any>,
> {
  public readonly type: QueryableType.Connection = QueryableType.Connection;

  protected readonly _lock: Lock;

  private _disposed: undefined | Promise<void>;
  protected _throwIfDisposed(): void {
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
    this._lock = createLock(driver.acquireLockTimeoutMilliseconds);
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
    const postCommitSteps: (() => Promise<void>)[] = [];
    await this._lock.acquireLock();
    let result: TResult;
    try {
      result = await txInternal(
        this._driver,
        this._factories,
        fn,
        options,
        (fn) => {
          postCommitSteps.push(fn);
        },
      );
    } finally {
      this._lock.releaseLock();
    }
    for (const step of postCommitSteps) {
      await step();
    }
    return result;
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    this._throwIfDisposed();
    if (Array.isArray(query)) {
      if (query.length === 0) return [];
      for (const q of query) assertSql(q);
      await this._lock.acquireLock();
      try {
        return await queryInternal(this._driver, query, executeAndReturnAll);
      } finally {
        this._lock.releaseLock();
      }
    } else {
      assertSql(query);
      await this._lock.acquireLock();
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

  async addPostCommitStep(fn: () => Promise<void>): Promise<void> {
    await fn();
  }

  async dispose(): Promise<void> {
    return this._disposed || (this._disposed = this._lock.pool());
  }
}
