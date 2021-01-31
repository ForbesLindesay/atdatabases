import createConnectionPool, {
  ConnectionPool,
  PoolOptions,
} from '@databases/connection-pool';
import splitSqlQuery from '@databases/split-sql-query';
import sql, {isSqlQuery, SQLQuery} from '@databases/sql';
import cuid = require('cuid');
import throttle from 'throat';

export type {SQLQuery};
export {sql};

export enum QueryableType {
  Transaction = 'transaction',
  Connection = 'connection',
  ConnectionPool = 'connection_pool',
}

export interface Driver<TTransactionOptions> {
  beginTransaction(options: TTransactionOptions | undefined): Promise<void>;
  commitTransaction(): Promise<void>;
  rollbackTransaction(): Promise<void>;

  createSavepoint(savepointName: string): Promise<void>;
  releaseSavepoint(savepointName: string): Promise<void>;
  rollbackToSavepoint(savepointName: string): Promise<void>;

  executeAndReturnAll(queries: SQLQuery[]): Promise<any[][]>;
  executeAndReturnLast(queries: SQLQuery[]): Promise<any[]>;
}
export interface TransactionFactory<TDriver, TTransaction extends Disposable> {
  createTransaction(driver: TDriver): TTransaction;
}
export interface ConnectionFactory<TDriver, TConnection extends Disposable> {
  createConnection(driver: TDriver): TConnection;
  canRecycleConnection(client: TDriver, err: Error): Promise<boolean>;
}
export interface Factory<
  TDriver,
  TConnection extends Disposable,
  TTransaction extends Disposable
>
  extends ConnectionFactory<TDriver, TConnection>,
    TransactionFactory<TDriver, TTransaction> {}

type TransactionOptions<TDriver extends Driver<any>> = TDriver extends Driver<
  infer TTransactionOptions
>
  ? TTransactionOptions
  : unknown;

export interface Disposable {
  dispose(): Promise<void>;
}

const resolvedPromise = Promise.resolve();
function asyncNoop() {
  return resolvedPromise;
}
export class BaseTransaction<
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

function executeAndReturnAll<TTransactionOptions>(
  driver: Driver<TTransactionOptions>,
  queries: SQLQuery[],
): Promise<any[][]> {
  return driver.executeAndReturnAll(queries);
}
function executeAndReturnLast<TTransactionOptions>(
  driver: Driver<TTransactionOptions>,
  queries: SQLQuery[],
): Promise<any[]> {
  return driver.executeAndReturnLast(queries);
}

async function queryInternal<TTransactionOptions, TResult>(
  driver: Driver<TTransactionOptions>,
  queries: SQLQuery[],
  fn: <TTransactionOptions>(
    driver: Driver<TTransactionOptions>,
    queries: SQLQuery[],
  ) => Promise<TResult>,
): Promise<TResult> {
  const hasTransaction = queries.length > 1;
  try {
    if (hasTransaction) {
      await driver.beginTransaction(undefined);
    }
    const results = await fn(driver, queries);
    if (hasTransaction) {
      await driver.commitTransaction();
    }
    return results;
  } catch (ex) {
    if (hasTransaction) {
      await driver.rollbackTransaction();
    }
    throw ex;
  }
}
async function taskInternal<
  TConnection extends Disposable,
  TDriver extends Driver<any>,
  TResult
>(
  driver: TDriver,
  factories: ConnectionFactory<TDriver, TConnection>,
  fn: (connection: TConnection) => Promise<TResult>,
): Promise<TResult> {
  const connection = factories.createConnection(driver);
  try {
    return await fn(connection);
  } finally {
    await connection.dispose();
  }
}
async function txInternal<
  TTransaction extends Disposable,
  TDriver extends Driver<any>,
  TResult
>(
  driver: TDriver,
  factories: TransactionFactory<TDriver, TTransaction>,
  fn: (connection: TTransaction) => Promise<TResult>,
  options: TransactionOptions<TDriver> | undefined,
): Promise<TResult> {
  await driver.beginTransaction(options);
  const tx = factories.createTransaction(driver);
  try {
    const result = await fn(tx);
    await tx.dispose();
    await driver.commitTransaction();
    return result;
  } catch (ex) {
    await tx.dispose();
    await driver.rollbackTransaction();
    throw ex;
  }
}

export class BaseConnection<
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

export class BaseConnectionPool<
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
    const driver = await this._pool.getConnection();
    try {
      const result = await fn(driver.connection, ...args);
      driver.release();
      return result;
    } catch (ex) {
      if (await this._factories.canRecycleConnection(driver.connection, ex)) {
        driver.release();
      } else {
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

// export interface IBaseQueryable<TTransaction, TTransactionOptions> {
//   readonly type: QueryableType;
//   readonly sql: typeof sql;
//   task<T>(
//     fn: (
//       connection: IBaseQueryable<TTransaction, TTransactionOptions>,
//     ) => Promise<T>,
//   ): Promise<T>;
//   tx<T>(
//     fn: (connection: TTransaction) => Promise<T>,
//     options?: TTransactionOptions,
//   ): Promise<T>;

//   query(query: SQLQuery): Promise<any[]>;
//   query(query: SQLQuery[]): Promise<any[][]>;
// }

// export interface IBaseTransaction<TTransaction, TTransactionOptions>
//   extends IBaseQueryable<TTransaction, TTransactionOptions> {
//   readonly type: QueryableType.Transaction;
//   task<T>(fn: (connection: this) => Promise<T>): Promise<T>;
//   tx<T>(fn: (connection: TTransaction) => Promise<T>): Promise<T>;
// }

// export interface IBaseConnection<TTransaction, TTransactionOptions>
//   extends IBaseQueryable<TTransaction, TTransactionOptions> {
//   readonly type: QueryableType.Connection;
//   task<T>(fn: (connection: this) => Promise<T>): Promise<T>;
// }

// export interface IBaseConnectionPool<
//   TConnection extends IBaseConnection<TTransaction, TTransactionOptions>,
//   TTransaction,
//   TTransactionOptions
// > extends IBaseQueryable<TTransaction, TTransactionOptions> {
//   readonly type: QueryableType.ConnectionPool;
//   task<T>(fn: (connection: TConnection) => Promise<T>): Promise<T>;
//   dispose(): Promise<void>;
// }
