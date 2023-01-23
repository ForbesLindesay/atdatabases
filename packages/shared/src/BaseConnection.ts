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
import IdleConnectionTracker from './types/IdleConnectionTracker';

type TransactionOptions<TDriver extends Driver<any, any>> =
  TDriver extends Driver<infer TTransactionOptions, any>
    ? TTransactionOptions
    : unknown;
type QueryStreamOptions<TDriver extends Driver<any, any>> =
  TDriver extends Driver<any, infer TQueryStreamOptions>
    ? TQueryStreamOptions
    : unknown;

export default class BaseConnection<
  TTransaction extends Disposable,
  TDriver extends Driver<any, any>,
> {
  public readonly type = QueryableType.Connection;

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
  private readonly _idleConnectionTracker: IdleConnectionTracker | undefined;
  constructor(
    driver: TDriver,
    factories: TransactionFactory<TDriver, TTransaction>,
    idleConnectionTracker?: IdleConnectionTracker,
  ) {
    this._driver = driver;
    this._factories = factories;
    this._lock = createLock(driver.acquireLockTimeoutMilliseconds);
    this._idleConnectionTracker = idleConnectionTracker;
    if (this._idleConnectionTracker) {
      this._idleConnectionTracker.markIdle();
    }
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
    if (this._idleConnectionTracker) {
      this._idleConnectionTracker.markInUse();
    }
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
      if (this._idleConnectionTracker) {
        this._idleConnectionTracker.markIdle();
      }
    }
    for (const step of postCommitSteps) {
      await step();
    }
    return result;
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    assertSql(query);
    this._throwIfDisposed();
    if (Array.isArray(query)) {
      if (query.length === 0) return [];
      if (this._idleConnectionTracker) {
        this._idleConnectionTracker.markInUse();
      }
      await this._lock.acquireLock();
      try {
        return await queryInternal(this._driver, query, executeAndReturnAll);
      } finally {
        this._lock.releaseLock();
        if (this._idleConnectionTracker) {
          this._idleConnectionTracker.markIdle();
        }
      }
    } else {
      if (this._idleConnectionTracker) {
        this._idleConnectionTracker.markInUse();
      }
      await this._lock.acquireLock();
      try {
        return await queryInternal(
          this._driver,
          splitSqlQuery(query),
          executeAndReturnLast,
        );
      } finally {
        this._lock.releaseLock();
        if (this._idleConnectionTracker) {
          this._idleConnectionTracker.markIdle();
        }
      }
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
    if (this._idleConnectionTracker) {
      this._idleConnectionTracker.markInUse();
    }
    await this._lock.acquireLock();
    try {
      for await (const record of this._driver.queryStream(query, options)) {
        yield record;
      }
    } finally {
      this._lock.releaseLock();
      if (this._idleConnectionTracker) {
        this._idleConnectionTracker.markIdle();
      }
    }
  }

  async dispose() {
    if (this._idleConnectionTracker) {
      this._idleConnectionTracker.markInUse();
    }
    return this._disposed || (this._disposed = this._lock.pool());
  }
}
