/* tslint:disable:no-void-expression */

import {Readable} from 'stream';
import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {isSQLError, SQLErrorCode} from '@databases/pg-errors';
import {SQLQuery, FormatConfig, isSqlQuery} from '@databases/sql';
import {Driver} from '@databases/shared';
import PgClient from './types/PgClient';
import {isolationLevelToString} from './types/IsolationLevel';
import TransactionOptions from './types/TransactionOptions';
import EventHandlers from './types/EventHandlers';
import QueryStreamOptions from './types/QueryStreamOptions';
const {codeFrameColumns} = require('@babel/code-frame');
const Cursor = require('pg-cursor');

const pgFormat: FormatConfig = {
  escapeIdentifier: (str) => escapePostgresIdentifier(str),
  formatValue: (value, index) => ({placeholder: `$${index + 1}`, value}),
};

type QueryResult = {rows: any[]};

export default class PgDriver
  implements Driver<TransactionOptions, QueryStreamOptions> {
  public readonly lockTimeoutMilliseconds = 60_000;
  public readonly client: PgClient;
  private readonly _handlers: EventHandlers;
  private _endCalled = false;
  private readonly _disposed: Promise<void>;
  constructor(client: PgClient, handlers: EventHandlers) {
    // client.on('error', () => {
    //   // do not crash on random errors
    // });
    this._disposed = new Promise<void>((resolve) => {
      client.on('end', resolve);
    });
    this.client = client;
    this._handlers = handlers;
  }
  private _removeFromPool: undefined | (() => void);
  private _idleErrorEventHandler: undefined | ((err: Error) => void);
  private readonly _onIdleError = (err: Error) => {
    if (this._disposed) {
      return;
    }
    this.client.removeListener('error', this._onIdleError);
    if (this._removeFromPool) {
      this._removeFromPool();
    }
    if (this._idleErrorEventHandler) {
      this._idleErrorEventHandler(err);
    }
  };
  onAddingToPool(
    removeFromPool: undefined | (() => void),
    idleErrorEventHandler: undefined | ((err: Error) => void),
  ) {
    this._removeFromPool = removeFromPool;
    this._idleErrorEventHandler = idleErrorEventHandler;
  }
  onActive() {
    this.client.removeListener('error', this._onIdleError);
  }
  onIdle() {
    this.client.on('error', this._onIdleError);
  }

  async connect(): Promise<void> {
    return await this.client.connect();
  }
  async dispose(): Promise<void> {
    this.client.on('error', this._onIdleError);
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

  async beginTransaction(options?: TransactionOptions) {
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
  }
  async commitTransaction() {
    await execute(this.client, `COMMIT`);
  }
  async rollbackTransaction() {
    await execute(this.client, `ROLLBACK`);
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
    await execute(this.client, `SAVEPOINT ${savepointName}`);
  }
  async releaseSavepoint(savepointName: string) {
    await execute(this.client, `RELEASE SAVEPOINT ${savepointName}`);
  }
  async rollbackToSavepoint(savepointName: string) {
    await execute(this.client, `ROLLBACK TO SAVEPOINT ${savepointName}`);
  }

  private async _executeQuery(query: SQLQuery): Promise<any[]> {
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
  } catch (ex) {
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
