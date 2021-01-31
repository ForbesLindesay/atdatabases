import splitSqlQuery from '@databases/split-sql-query';
import sql, {isSqlQuery, SQLQuery} from '@databases/sql';
import cuid = require('cuid');
import throttle from 'throat';
import {Disposable, TransactionFactory} from './Factory';
import Driver from './Driver';
import QueryableType from './QueryableType';
import {asyncNoop} from './utils';

export default class BaseTransaction<
  TTransaction extends Disposable,
  TDriver extends Driver<any>
> {
  public readonly type = QueryableType.Transaction;
  public readonly sql = sql;

  private readonly _lock = throttle(1);

  private _disposed: boolean = false;
  private _throwIfDisposed() {
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
  }

  async task<T>(fn: (connection: this) => Promise<T>): Promise<T> {
    this._throwIfDisposed();
    return await fn(this);
  }
  private static async _tx<
    TTransaction extends Disposable,
    TDriver extends Driver<any>,
    TResult
  >(
    tx: BaseTransaction<TTransaction, TDriver>,
    fn: (connection: TTransaction) => Promise<TResult>,
  ): Promise<TResult> {
    const savepointName = cuid();
    await tx._driver.createSavepoint(savepointName);
    const subTransaction = tx._factories.createTransaction(tx._driver);
    try {
      const result = await fn(subTransaction);
      subTransaction.dispose();
      await tx._driver.releaseSavepoint(savepointName);
      return result;
    } catch (ex) {
      subTransaction.dispose();
      await tx._driver.rollbackToSavepoint(savepointName);
      throw ex;
    }
  }
  async tx<T>(fn: (connection: TTransaction) => Promise<T>): Promise<T> {
    this._throwIfDisposed();
    return await this._lock(BaseTransaction._tx, this, fn);
  }

  private static async _query<
    TTransaction extends Disposable,
    TDriver extends Driver<any>
  >(
    tx: BaseTransaction<TTransaction, TDriver>,
    query: SQLQuery | SQLQuery[],
  ): Promise<any[]> {
    if (Array.isArray(query)) {
      if (query.length === 0) return [];
      for (const el of query) {
        if (!isSqlQuery(el)) {
          throw new Error(
            'Invalid query, you must use @databases/sql to create your queries.',
          );
        }
      }
      return await tx._driver.executeAndReturnAll(query);
    } else {
      if (!isSqlQuery(query)) {
        throw new Error(
          'Invalid query, you must use @databases/sql to create your queries.',
        );
      }
      return await tx._driver.executeAndReturnLast(splitSqlQuery(query));
    }
  }
  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    this._throwIfDisposed();
    return await this._lock(BaseTransaction._query, this, query);
  }

  async dispose() {
    this._disposed = true;
    await this._lock(asyncNoop);
  }
}
