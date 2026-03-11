/* tslint:disable:no-void-expression */

import {escapeMySqlIdentifier} from '@databases/escape-identifier';
import {type SQLQuery, FormatConfig} from '@databases/sql';
import {Driver} from '@databases/shared';
import {Connection as MySqlClient} from 'mysql2/promise';
import TransactionOptions from './types/TransactionOptions';
import EventHandlers from './types/EventHandlers';
import {CoreConnection} from './raw';
import {codeFrameColumns} from '@babel/code-frame';

const mysqlFormat: FormatConfig = {
  escapeIdentifier: (str) => escapeMySqlIdentifier(str),
  formatValue: (value) => ({placeholder: '?', value}),
};

export default class MySqlDriver implements Driver<TransactionOptions> {
  public readonly acquireLockTimeoutMilliseconds: number;
  public readonly client: MySqlClient;
  private readonly _handlers: EventHandlers;
  private _endCalled = false;
  constructor(
    client: MySqlClient,
    handlers: EventHandlers,
    acquireLockTimeoutMilliseconds: number,
  ) {
    this.acquireLockTimeoutMilliseconds = acquireLockTimeoutMilliseconds;
    this.client = client;
    this._handlers = handlers;
  }
  private _removeFromPool: undefined | (() => void);
  private _idleErrorEventHandler: undefined | ((err: Error) => void);
  private readonly _onIdleError = (err: Error) => {
    if (this._endCalled) {
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
  ): void {
    this._removeFromPool = removeFromPool;
    this._idleErrorEventHandler = idleErrorEventHandler;
  }
  onActive(): void {
    this.client.removeListener('error', this._onIdleError);
  }
  onIdle(): void {
    this.client.on('error', this._onIdleError);
  }

  async dispose(): Promise<void> {
    if (!this._endCalled) {
      this._endCalled = true;
      this.client.on('error', this._onIdleError);
      this.client.destroy();
    }
  }

  async canRecycleConnectionAfterError(_err: Error): Promise<boolean> {
    try {
      let timeout: any | undefined;
      const result: undefined | {1?: {rows?: {0?: {result?: number}}}} =
        await Promise.race([
          this.client.query(
            'BEGIN TRANSACTION READ ONLY;SELECT 1 AS result;COMMIT;',
          ) as any,
          new Promise((r) => {
            timeout = setTimeout(r, 100);
          }),
        ]);
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      return result?.[1]?.rows?.[0]?.result === 1;
    } catch (ex) {
      return false;
    }
  }

  async beginTransaction(options?: TransactionOptions): Promise<void> {
    const parameters = [];
    if (options) {
      if (options.readOnly) {
        parameters.push('READ ONLY');
      } else if (options.readOnly === false) {
        parameters.push('READ WRITE');
      }
      if (options.withConsistentSnapshot) {
        parameters.push('WITH CONSISTENT SNAPSHOT');
      }
    }
    if (parameters.length) {
      await execute(this.client, `START TRANSACTION ${parameters.join(', ')}`);
    } else {
      await execute(this.client, `BEGIN`);
    }
  }
  async commitTransaction(): Promise<void> {
    await execute(this.client, `COMMIT`);
  }
  async rollbackTransaction(): Promise<void> {
    await execute(this.client, `ROLLBACK`);
  }
  async shouldRetryTransactionFailure(
    _transactionOptions: TransactionOptions | undefined,
    _ex: Error,
    _failureCount: number,
  ): Promise<boolean> {
    return false;
  }

  async createSavepoint(savepointName: string): Promise<void> {
    await execute(this.client, `SAVEPOINT ${savepointName}`);
  }
  async releaseSavepoint(savepointName: string): Promise<void> {
    await execute(this.client, `RELEASE SAVEPOINT ${savepointName}`);
  }
  async rollbackToSavepoint(savepointName: string): Promise<void> {
    await execute(this.client, `ROLLBACK TO SAVEPOINT ${savepointName}`);
  }

  private async _executeQuery(query: SQLQuery): Promise<any[]> {
    const q = query.format(mysqlFormat);
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
      enforceUndefined(this._handlers.onQueryResults(query, q, results));
    }
    return results;
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

  queryStream(query: SQLQuery): ReadableStream<any> {
    // TODO: handle backpressure via a high-water-mark
    const {text, values} = query.format(mysqlFormat);
    const connection: CoreConnection = (this.client as any).connection;
    return new ReadableStream({
      start(controller) {
        const stream = connection.query(text, values);
        stream.on('result', (data) => controller.enqueue(data));
        stream.on('error', (err) => controller.error(err));
        stream.on('end', () => controller.close());
      },
    });
  }
}

async function execute(client: MySqlClient, query: string): Promise<void> {
  try {
    await client.query(query);
  } catch (ex: any) {
    throw Object.assign(new Error(ex.message), ex);
  }
}
async function executeQueryInternal(
  client: MySqlClient,
  query: SQLQuery,
  q: {text: string; values: unknown[]},
  handlers: EventHandlers,
): Promise<any[]> {
  try {
    // const result: [RowDataPacket[] | RowDataPacket[][] | OkPacket | OkPacket[] | ResultSetHeader, FieldPacket[]]
    const [result] = await client.query(q.text, q.values);
    return result as any[];
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
  const mySqlError = parseMySqlError(ex, q.text);
  if (mySqlError) {
    const {start, end, message: oldMessage} = mySqlError;
    const message = oldMessage.replace(
      / near \'((?:.|\n)+)\' at line (\d+)$/,
      ` near:\n\n${codeFrameColumns(q.text, {start, end})}\n`,
    );
    err = Object.assign(new Error(message), ex, {message});
  } else {
    err = Object.assign(new Error(isError(ex) ? ex.message : `${ex}`), ex);
  }
  if (handlers.onQueryError) {
    enforceUndefined(handlers.onQueryError(query, q, err));
  }
  throw err;
}

function parseMySqlError(ex: unknown, queryText: string) {
  if (isMySqlError(ex)) {
    const match = / near \'((?:.|\n)+)\' at line (\d+)$/.exec(ex.sqlMessage);
    if (match) {
      const index = queryText.indexOf(match[1]);
      if (index === queryText.lastIndexOf(match[1])) {
        const linesUptoStart = queryText.substr(0, index).split('\n');
        const line = linesUptoStart.length;
        const start = {
          line,
          column: linesUptoStart[linesUptoStart.length - 1].length + 1,
        };
        const linesUptoEnd = queryText
          .substr(0, index + match[1].length)
          .split('\n');
        const end = {
          line: linesUptoEnd.length,
          column: linesUptoEnd[linesUptoEnd.length - 1].length + 1,
        };
        return {start, end, message: ex.message};
      }
    }
  }
  return null;
}
function isError(ex: unknown): ex is {message: string} {
  return (
    typeof ex === 'object' &&
    ex !== null &&
    'message' in ex &&
    typeof (ex as any).message === 'string'
  );
}
function isMySqlError(
  ex: unknown,
): ex is {message: string; sqlMessage: string} {
  return (
    typeof ex === 'object' &&
    ex !== null &&
    (ex as any).code === 'ER_PARSE_ERROR' &&
    (ex as any).sqlState === '42000' &&
    typeof (ex as any).sqlMessage === 'string' &&
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
