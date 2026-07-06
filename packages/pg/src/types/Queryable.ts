import {Readable} from 'stream';
import {QueryableType} from '@databases/shared';
import {SQL, SQLQuery} from '@databases/sql';
import AbortSignal from './AbortSignal';
import TransactionOptions from './TransactionOptions';
import AdvisoryLockKey from './AdvisoryLockKey';

export default interface Queryable {
  readonly type: QueryableType;
  readonly sql: SQL;
  query(query: SQLQuery): Promise<any[]>;
  query(query: SQLQuery[]): Promise<any[][]>;
  queryStream(
    query: SQLQuery,
    {batchSize, signal}: {batchSize?: number; signal?: AbortSignal},
  ): AsyncIterable<any>;
  queryNodeStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
      batchSize?: number;
    },
  ): Readable;
  task<T>(fn: (connection: Connection | Transaction) => Promise<T>): Promise<T>;
  tx<T>(
    fn: (connection: Transaction) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>;
  addPostCommitStep(fn: () => Promise<void>): Promise<void>;
}

/**
 * A "Transaction" on the database will be committed once
 * the async function returns, and will be aborted if any
 * queries fail or if the function throws an exception.
 */
export interface Transaction extends Queryable {
  readonly type: QueryableType.Transaction;

  /**
   * Obtain exclusive transaction level advisory lock for
   * the given key. The lock is automatically released at
   * the end of the current transaction and cannot be
   * released explicitly.
   */
  advisoryTxLock(key: AdvisoryLockKey): Promise<void>;
  /**
   * Obtain shared transaction level advisory lock for the
   * given key. The lock is automatically released at the
   * end of the current transaction and cannot be released
   * explicitly. An exclusive lock cannot be obtained for
   * a given key while at least one transaction has a shared
   * lock for that key.
   */
  advisoryTxLockShared(key: AdvisoryLockKey): Promise<void>;
  /**
   * Equivalent to `advisoryTxLock` except that it will not
   * wait if the lock is not immediately available. It will
   * return `true` if a lock was acquired, and `false` if
   * the lock is currently held by a different transaction.
   */
  tryAdvisoryTxLock(key: AdvisoryLockKey): Promise<boolean>;
  /**
   * Equivalent to `advisoryTxLockShared` except that it will not
   * wait if the lock is not immediately available. It will
   * return `true` if a lock was acquired, and `false` if
   * the lock is currently held by a different transaction.
   */
  tryAdvisoryTxLockShared(key: AdvisoryLockKey): Promise<boolean>;

  task<T>(fn: (connection: Transaction) => Promise<T>): Promise<T>;
  tx<T>(fn: (connection: Transaction) => Promise<T>): Promise<T>;
}

/**
 * A "Connection" represents a single connection to the database,
 * although you can send queries in parallel, if they share
 * one "Connection" they will actually be run one at a time on the
 * underlying database.
 *
 * Most of the time you can ignore these and just focus on
 * Transactions and ConnectionPools, or the more general
 * "Queryable".
 */
export interface Connection extends Queryable {
  readonly type: QueryableType.Connection;
  task<T>(fn: (connection: Connection) => Promise<T>): Promise<T>;
}

/**
 * A "ConnectionPool" represents a collection of database
 * connections that are managed for you automatically. You can
 * query this directly without worrying about allocating connections.
 * You can also use a Transaction to provide better guarantees about
 * behaviour when running many operations in parallel.
 */
export interface ConnectionPool extends Queryable {
  readonly type: QueryableType.ConnectionPool;
  task<T>(fn: (connection: Connection) => Promise<T>): Promise<T>;

  dispose(): Promise<void>;
  registerTypeParser<T>(
    type: number | string,
    parser: (value: string) => T,
  ): Promise<(value: string) => T>;
  getTypeParser(type: number | string): Promise<(value: string) => any>;
  /**
   * Parses an n-dimensional array
   *
   * @param value The string value from the database
   * @param entryParser A transform function to apply to each string
   */
  parseArray(value: string, entryParser?: (entry: string | null) => any): any[];
  /**
   * Parse a composite value and get a tuple of strings where
   * each string represents one attribute.
   *
   * @param value The raw string.
   */
  parseComposite(value: string): string[];
}

export function isConnectionPool(
  queryable: Queryable,
): queryable is ConnectionPool {
  return queryable.type === QueryableType.ConnectionPool;
}
export function isConnection(queryable: Queryable): queryable is Connection {
  return queryable.type === QueryableType.Connection;
}
export function isTransaction(queryable: Queryable): queryable is Transaction {
  return queryable.type === QueryableType.Transaction;
}
