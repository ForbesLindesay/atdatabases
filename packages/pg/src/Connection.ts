import {Readable} from 'stream';
import {SQLQuery} from '@databases/sql';
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

export default class Connection {
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
  async tx<T>(
    fn: (connection: Transaction) => Promise<T>,
    transactionOptions: TransactionOptions = {},
  ): Promise<T> {
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
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
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
