import {Readable} from 'stream';
import sql, {SQLQuery} from '@databases/sql';
import throttle from 'throat';
import cuid = require('cuid');
import {
  createSavepoint,
  rollbackSavepoint,
  commitSavepoint,
} from './operations/savepoint';
import {
  executeOneStatement,
  executeMultipleStatements,
} from './operations/queries';
import {queryNodeStream, queryStream} from './operations/queryStream';
import AbortSignal from './types/AbortSignal';
import PgClient from './types/PgClient';
import {Transaction as ITransaction, QueryableType} from './types/Queryable';

export default class Transaction implements ITransaction {
  public readonly type = QueryableType.Transaction;
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
        'You cannot run any operations on a transaction after it has been committed or rolled back.',
      );
    }
  }
  async task<T>(fn: (connection: ITransaction) => Promise<T>): Promise<T> {
    return await fn(this);
  }
  async tx<T>(fn: (connection: ITransaction) => Promise<T>): Promise<T> {
    return await this._lock(async () => {
      this._throwIfDisposed();
      const savepointName = cuid();
      await createSavepoint(this._client, savepointName);
      const subTransaction = new Transaction(this._client);
      try {
        const result = await fn(subTransaction);
        await commitSavepoint(this._client, savepointName);
        subTransaction.dispose();
        return result;
      } catch (ex) {
        subTransaction.dispose();
        await rollbackSavepoint(this._client, savepointName);
        throw ex;
      }
    });
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    if (Array.isArray(query) && query.length === 0) return [];
    return await this._lock(async () => {
      this._throwIfDisposed();
      if (Array.isArray(query)) {
        const savepointName = cuid();
        await createSavepoint(this._client, savepointName);
        try {
          const result = await executeMultipleStatements(this._client, query);
          await commitSavepoint(this._client, savepointName);
          return result;
        } catch (ex) {
          await rollbackSavepoint(this._client, savepointName);
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
