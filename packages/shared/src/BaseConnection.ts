import splitSqlQuery from '@databases/split-sql-query';
import sql, {SQLQuery} from '@databases/sql';
import throttle from 'throat';
import {Disposable, TransactionFactory} from './Factory';
import Driver from './Driver';
import QueryableType from './QueryableType';
import {
  asyncNoop,
  executeAndReturnAll,
  executeAndReturnLast,
  queryInternal,
  txInternal,
} from './utils';

type TransactionOptions<TDriver extends Driver<any>> = TDriver extends Driver<
  infer TTransactionOptions
>
  ? TTransactionOptions
  : unknown;

export default class BaseConnection<
  TTransaction extends Disposable,
  TDriver extends Driver<any>
> {
  public readonly type = QueryableType.Connection;
  public readonly sql = sql;

  private _disposed: boolean = false;
  // TODO: lock with timetout!!
  protected readonly _lock = throttle(1);
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
  }

  async task<T>(fn: (connection: this) => Promise<T>): Promise<T> {
    this._throwIfDisposed();
    return await fn(this);
  }

  tx<TResult>(
    fn: (connection: TTransaction) => Promise<TResult>,
    options?: TransactionOptions<TDriver>,
  ): Promise<TResult> {
    this._throwIfDisposed();
    return this._lock(txInternal, this._driver, this._factories, fn, options);
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    this._throwIfDisposed();
    if (Array.isArray(query)) {
      if (query.length === 0) return [];
      return await this._lock(
        queryInternal,
        this._driver,
        query,
        executeAndReturnAll,
      );
    } else {
      return await this._lock(
        queryInternal,
        this._driver,
        splitSqlQuery(query),
        executeAndReturnLast,
      );
    }
  }

  async dispose() {
    this._disposed = true;
    await this._lock(asyncNoop);
  }
}
