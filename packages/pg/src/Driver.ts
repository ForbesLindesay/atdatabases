/* tslint:disable:no-void-expression */

import {Readable} from 'stream';
import {isSQLError, SQLErrorCode} from '@databases/pg-errors';
import {SQLQuery, isSqlQuery} from '@databases/sql';
import {Driver} from '@databases/shared';
import PgClient from './types/PgClient';
import {isolationLevelToString} from './types/IsolationLevel';
import TransactionOptions from './types/TransactionOptions';
import EventHandlers from './types/EventHandlers';
import QueryStreamOptions from './types/QueryStreamOptions';
import pgFormat from './format';
const {codeFrameColumns} = require('@babel/code-frame');
const Cursor = require('pg-cursor');

type QueryResult = {rows: any[]};

const RECOVERABLE_ERRORS: ReadonlySet<SQLErrorCode> = new Set<SQLErrorCode>([
  SQLErrorCode.INTEGRITY_CONSTRAINT_VIOLATION,
  SQLErrorCode.RESTRICT_VIOLATION,
  SQLErrorCode.NOT_NULL_VIOLATION,
  SQLErrorCode.FOREIGN_KEY_VIOLATION,
  SQLErrorCode.UNIQUE_VIOLATION,
  SQLErrorCode.CHECK_VIOLATION,
  SQLErrorCode.EXCLUSION_VIOLATION,
]);
function isRecoverableError(err: unknown) {
  return isSQLError(err) && RECOVERABLE_ERRORS.has(err.code);
}

export default class PgDriver
  implements Driver<TransactionOptions, QueryStreamOptions>
{
  public readonly acquireLockTimeoutMilliseconds: number;
  public readonly client: PgClient;
  private readonly _handlers: EventHandlers;
  private _endCalled = false;
  private readonly _disposed: Promise<void>;
  private _canRecycleConnection: boolean = true;
  constructor(
    client: PgClient,
    handlers: EventHandlers,
    acquireLockTimeoutMilliseconds: number,
  ) {
    this.acquireLockTimeoutMilliseconds = acquireLockTimeoutMilliseconds;
    client.on('error', this._onIdleError);
    this._disposed = new Promise<void>((resolve) => {
      client.on('end', resolve);
    });
    this.client = client;
    this._handlers = handlers;
  }

  private _isIdle: boolean = false;
  private _idleError: null | Error = null;
  private _removeFromPool: undefined | (() => void);
  private _idleErrorEventHandler: undefined | ((err: Error) => void);

  private readonly _onIdleError = (err: Error) => {
    if (this._endCalled) return;
    this._canRecycleConnection = false;

    if (this._isIdle) {
      if (this._idleErrorEventHandler) {
        this._idleErrorEventHandler(err);
      }
    } else {
      this._idleError = err;
    }

    if (this._removeFromPool) {
      this._removeFromPool();
    }
  };
  private _throwPendingIdleError() {
    if (this._idleError) {
      const err = this._idleError;
      this._idleError = null;
      throw err;
    }
  }

  onAddingToPool(
    removeFromPool: undefined | (() => void),
    idleErrorEventHandler: undefined | ((err: Error) => void),
  ) {
    this._removeFromPool = removeFromPool;
    this._idleErrorEventHandler = idleErrorEventHandler;
  }

  onActive() {
    this._isIdle = false;
  }
  onIdle() {
    this._isIdle = true;
  }

  async connect(): Promise<void> {
    return await this.client.connect();
  }
  async dispose(): Promise<void> {
    if (!this._endCalled) {
      this._endCalled = true;
      if (this.client.connection?.stream?.destroy) {
        this.client.connection.stream.destroy();
      } else {
        void this.client.end();
      }
    }
    return await this._disposed;
  }

  async canRecycleConnectionAfterError(_err: Error) {
    return this._canRecycleConnection;
  }

  async beginTransaction(options?: TransactionOptions) {
    try {
      this._throwPendingIdleError();
      const parameters = [];
      if (options) {
        if (options.isolationLevel) {
          parameters.push(isolationLevelToString(options.isolationLevel));
        }
        if (options.readOnly) {
          parameters.push('READ ONLY');
        } else if (options.readOnly === false) {
          parameters.push('READ WRITE');
        }
        if (options.deferrable) {
          parameters.push('DEFERRABLE');
        } else if (options.deferrable === false) {
          parameters.push('NOT DEFERRABLE');
        }
      }
      if (parameters.length) {
        await execute(this.client, `BEGIN ${parameters.join(', ')}`);
      } else {
        await execute(this.client, `BEGIN`);
      }
    } catch (ex) {
      this._canRecycleConnection = false;
      throw ex;
    }
  }
  async commitTransaction() {
    try {
      this._throwPendingIdleError();
      await execute(this.client, `COMMIT`);
    } catch (ex) {
      if (!isRecoverableError(ex)) {
        this._canRecycleConnection = false;
      }

      // Make sure we report a decent stack trace
      const err = Object.assign(
        new Error(isError(ex) ? ex.message : `${ex}`),
        ex,
      );
      throw err;
    }
  }
  async rollbackTransaction() {
    try {
      this._throwPendingIdleError();
      await execute(this.client, `ROLLBACK`);
    } catch (ex) {
      this._canRecycleConnection = false;
      throw ex;
    }
  }
  async shouldRetryTransactionFailure(
    transactionOptions: TransactionOptions | undefined,
    ex: Error,
    failureCount: number,
  ) {
    const retrySerializationFailuresCount = !transactionOptions
      ? 0
      : transactionOptions.retrySerializationFailures === true
      ? 10
      : typeof transactionOptions.retrySerializationFailures === 'number'
      ? transactionOptions.retrySerializationFailures
      : 0;
    if (isSQLError(ex) && ex.code === SQLErrorCode.SERIALIZATION_FAILURE) {
      if (retrySerializationFailuresCount > failureCount) {
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.max(10, Math.floor(Math.random() * 100 * failureCount)),
          ),
        );
        return true;
      }
    }
    return false;
  }

  async createSavepoint(savepointName: string) {
    try {
      this._throwPendingIdleError();
      await execute(this.client, `SAVEPOINT ${savepointName}`);
    } catch (ex) {
      this._canRecycleConnection = false;
      throw ex;
    }
  }
  async releaseSavepoint(savepointName: string) {
    try {
      this._throwPendingIdleError();
      await execute(this.client, `RELEASE SAVEPOINT ${savepointName}`);
    } catch (ex) {
      this._canRecycleConnection = false;
      throw ex;
    }
  }
  async rollbackToSavepoint(savepointName: string) {
    try {
      this._throwPendingIdleError();
      await execute(this.client, `ROLLBACK TO SAVEPOINT ${savepointName}`);
    } catch (ex) {
      this._canRecycleConnection = false;
      throw ex;
    }
  }

  private async _executeQuery(query: SQLQuery): Promise<any[]> {
    try {
      this._throwPendingIdleError();
      const q = query.format(pgFormat);
      if (this._handlers.onQueryStart) {
        enforceUndefined(this._handlers.onQueryStart(query, q));
      }

      const results = await executeQueryInternal(
        this.client,
        query,
        q,
        this._handlers,
      );

      if (this._handlers.onQueryResults) {
        enforceUndefined(this._handlers.onQueryResults(query, q, results.rows));
      }
      return results.rows;
    } catch (ex) {
      if (!isRecoverableError(ex)) {
        this._canRecycleConnection = false;
      }
      throw ex;
    }
  }
  async executeAndReturnAll(queries: SQLQuery[]): Promise<any[][]> {
    const results = new Array(queries.length);
    for (let i = 0; i < queries.length; i++) {
      results[i] = await this._executeQuery(queries[i]);
    }
    return results;
  }
  async executeAndReturnLast(queries: SQLQuery[]): Promise<any[]> {
    if (queries.length === 0) {
      return [];
    }
    for (let i = 0; i < queries.length - 1; i++) {
      await this._executeQuery(queries[i]);
    }
    return await this._executeQuery(queries[queries.length - 1]);
  }

  queryNodeStream(
    query: SQLQuery,
    options: {highWaterMark?: number},
  ): Readable {
    this._throwPendingIdleError();
    this._canRecycleConnection = false;
    if (!isSqlQuery(query)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const q = query.format(pgFormat);
    const c = new Cursor(q.text, q.values);
    let closed = false;
    let reading = false;
    const stream = new Readable({
      ...options,
      // defau† to `false` in node 12 but true in node 14
      autoDestroy: true,
      objectMode: true,
      read(this: Readable, count: number) {
        if (reading) return;
        reading = true;
        const read = () => {
          c.read(count, (err: Error | null, rows: any[]) => {
            if (err) {
              this.emit('error', err);
              return;
            }
            if (!rows.length) {
              closed = true;
              this.push(null);
              return;
            }
            let keepReading = true;
            for (const row of rows) {
              keepReading = keepReading && this.push(row);
            }
            if (keepReading) {
              read();
            } else {
              reading = false;
            }
          });
        };
        read();
      },
      destroy(err, callback) {
        if (closed) {
          callback(err);
          return;
        }
        closed = true;
        c.close((err2: Error | null) => {
          callback(err ?? err2);
        });
      },
    });
    void this.client.query(c);
    return stream;
  }

  async *queryStream(
    query: SQLQuery,
    {batchSize = 16, signal}: QueryStreamOptions = {},
  ): AsyncGenerator<any, void, unknown> {
    this._throwPendingIdleError();
    this._canRecycleConnection = false;
    if (!isSqlQuery(query)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    if (signal?.aborted) {
      throw new Error('Aborted');
    }
    const q = query.format(pgFormat);
    const c = new Cursor(q.text, q.values);
    void this.client.query(c);

    const read = async () => {
      return await new Promise<any[]>((resolve, reject) => {
        c.read(batchSize, (err: Error | null, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
    };

    let aborted = false;
    const abort = () => {
      if (aborted) return;
      aborted = true;
      c.close(() => {
        // ignore
      });
    };
    signal?.addEventListener('abort', abort);

    try {
      let nextPagePromise;
      let ended = false;
      while (!ended) {
        const page = await (nextPagePromise ?? read());
        if (page.length !== 0) {
          nextPagePromise = read();
          nextPagePromise.catch((ex) => {
            // this error gets picked up later, so don't report the unhandled rejection
          });
          ended = false;
        } else {
          nextPagePromise = undefined;
          ended = true;
        }
        for (const row of page) {
          if (signal?.aborted) {
            throw new Error('Aborted');
          }
          yield row;
        }
      }
      aborted = true;
    } finally {
      signal?.removeEventListener('abort', abort);
      abort();
    }
  }
}

async function execute(client: PgClient, query: unknown): Promise<void> {
  try {
    await client.query(query);
  } catch (ex: any) {
    throw Object.assign(new Error(ex.message), ex);
  }
}
async function executeQueryInternal(
  client: PgClient,
  query: SQLQuery,
  q: {text: string; values: unknown[]},
  handlers: EventHandlers,
): Promise<QueryResult> {
  try {
    const result = (await client.query(q)) as QueryResult | QueryResult[];
    if (Array.isArray(result)) {
      return result[result.length - 1];
    } else {
      return result;
    }
  } catch (ex) {
    handleError(ex, query, q, handlers);
  }
}

function handleError(
  ex: unknown,
  query: SQLQuery,
  q: {text: string; values: unknown[]},
  handlers: EventHandlers,
): never {
  let err;
  if (isSQLError(ex) && ex.position) {
    const position = parseInt(ex.position, 10);
    const match =
      /syntax error at or near \"([^\"\n]+)\"/.exec(ex.message) ||
      /relation \"([^\"\n]+)\" does not exist/.exec(ex.message);
    let column = 0;
    let line = 1;
    for (let i = 0; i < position; i++) {
      if (q.text[i] === '\n') {
        line++;
        column = 0;
      } else {
        column++;
      }
    }

    const start = {line, column};
    let end: undefined | {line: number; column: number};
    if (match) {
      end = {line, column: column + match[1].length};
    }

    err = Object.assign(
      new Error(`${ex.message}\n\n${codeFrameColumns(q.text, {start, end})}\n`),
      ex,
    );
  } else {
    err = Object.assign(new Error(isError(ex) ? ex.message : `${ex}`), ex);
  }
  if (handlers.onQueryError) {
    enforceUndefined(handlers.onQueryError(query, q, err));
  }
  throw err;
}

function isError(ex: unknown): ex is {message: string} {
  return (
    typeof ex === 'object' &&
    ex !== null &&
    'message' in ex &&
    typeof (ex as any).message === 'string'
  );
}

function enforceUndefined(value: void) {
  if (value !== undefined) {
    throw new Error(
      `Your event handlers must return "undefined". This is to allow for the possibility of event handlers being used as hooks with more advanced functionality in the future.`,
    );
  }
}
