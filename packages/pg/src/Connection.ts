import {Readable} from 'stream';
import sql, {SQLQuery} from '@databases/sql';
import {isSQLError, SQLErrorCode} from '@databases/pg-errors';
import throttle from 'throat';
import Transaction from './Transaction';
import {
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
} from './operations/transaction';
import TransactionOptions from './types/TransactionOptions';
import {
  executeMultipleStatements,
  executeOneStatement,
} from './operations/queries';
import {queryNodeStream, queryStream} from './operations/queryStream';
import AbortSignal from './types/AbortSignal';
import PgClient from './types/PgClient';
import {Connection as IConnection, QueryableType} from './types/Queryable';

export default class Connection implements IConnection {
  public readonly type = QueryableType.Connection;
  public readonly sql = sql;

  private readonly _client: PgClient;
  private _disposed: boolean = false;
  // TODO: lock with timetout!!
  private readonly _lock = throttle(1);
  constructor(client: PgClient) {
    this._client = client;
  }
  private _throwIfDisposed() {
    if (this._disposed) {
      throw new Error(
        'You cannot run any operations on a connection after it has been returned to the connection pool.',
      );
    }
  }

  async task<T>(fn: (connection: IConnection) => Promise<T>): Promise<T> {
    return await fn(this);
  }

  async tx<T>(
    fn: (connection: Transaction) => Promise<T>,
    transactionOptions: TransactionOptions = {},
  ): Promise<T> {
    let retrySerializationFailuresCount =
      transactionOptions.retrySerializationFailures === true
        ? 10
        : typeof transactionOptions.retrySerializationFailures === 'number'
        ? transactionOptions.retrySerializationFailures
        : 0;
    while (true) {
      try {
        return await this._lock(async () => {
          this._throwIfDisposed();
          await beginTransaction(this._client, transactionOptions);
          const transaction = new Transaction(this._client);
          try {
            const result = await fn(transaction);
            await commitTransaction(this._client);
            transaction.dispose();
            return result;
          } catch (ex) {
            transaction.dispose();
            await rollbackTransaction(this._client);
            throw ex;
          }
        });
      } catch (ex) {
        if (isSQLError(ex) && ex.code === SQLErrorCode.SERIALIZATION_FAILURE) {
          if (retrySerializationFailuresCount--) {
            continue;
          }
        }
        throw ex;
      }
    }
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    if (Array.isArray(query) && query.length === 0) return [];
    return await this._lock(async () => {
      this._throwIfDisposed();
      if (Array.isArray(query)) {
        await beginTransaction(this._client, {});
        try {
          const result = await executeMultipleStatements(this._client, query);
          await commitTransaction(this._client);
          return result;
        } catch (ex) {
          await rollbackTransaction(this._client);
          throw ex;
        }
      } else {
        return executeOneStatement(this._client, query);
      }
    });
  }

  queryNodeStream(
    query: SQLQuery,
    options: {highWaterMark?: number} = {},
  ): Readable {
    return queryNodeStream(this._client, query, options);
  }

  queryStream(
    query: SQLQuery,
    options: {
      batchSize?: number;
      signal?: AbortSignal | undefined;
    } = {},
  ): AsyncGenerator<any, void, unknown> {
    return queryStream(this._client, query, options);
  }

  dispose() {
    this._disposed = true;
  }
}
