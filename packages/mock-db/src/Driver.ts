/* tslint:disable:no-void-expression */

import {Readable} from 'stream';
import {SQLQuery, FormatConfig} from '@databases/sql/web';
import {Driver} from '@databases/shared';
import TransactionOptions from './types/TransactionOptions';
import EventHandlers from './types/EventHandlers';
import QueryStreamOptions from './types/QueryStreamOptions';

const mockFormat: FormatConfig = {
  escapeIdentifier: (str) => {
    if (!/^[a-z0-9_]+$/.test(str)) {
      throw new Error(
        `The mock db only supports letters, numbers and "_" in identifiers.`,
      );
    }
    return str;
  },
  formatValue: (value) => ({placeholder: `?`, value}),
};

interface MockDatabase {
  exec(str: string, params: any[]): any[];
}

export default class MockDbDriver
  implements Driver<TransactionOptions, QueryStreamOptions> {
  public readonly acquireLockTimeoutMilliseconds: number;
  public readonly client: MockDatabase;
  private readonly _handlers: EventHandlers;
  constructor(
    client: MockDatabase,
    handlers: EventHandlers,
    acquireLockTimeoutMilliseconds: number,
  ) {
    this.acquireLockTimeoutMilliseconds = acquireLockTimeoutMilliseconds;
    this.client = client;
    this._handlers = handlers;
  }
  onAddingToPool() {}
  onActive() {}
  onIdle() {}

  async dispose(): Promise<void> {}

  async canRecycleConnectionAfterError(_err: Error) {
    return true;
  }

  async beginTransaction(_options?: TransactionOptions) {
    await execute(this.client, `BEGIN TRANSACTION`);
  }
  async commitTransaction() {
    await execute(this.client, `COMMIT TRANSACTION`);
  }
  async rollbackTransaction() {
    await execute(this.client, `ROLLBACK TRANSACTION`);
  }
  async shouldRetryTransactionFailure(
    _transactionOptions: TransactionOptions | undefined,
    _ex: Error,
    _failureCount: number,
  ) {
    return false;
  }

  async createSavepoint(_savepointName: string) {}
  async releaseSavepoint(_savepointName: string) {}
  async rollbackToSavepoint(_savepointName: string) {
    throw new Error(`Savepoints are not supported by mock-db`);
  }

  private async _executeQuery(query: SQLQuery): Promise<any[]> {
    const q = query.format(mockFormat);
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

  queryNodeStream(
    _query: SQLQuery,
    _options: {highWaterMark?: number},
  ): Readable {
    throw new Error(`Not implemented by mock-db`);
  }

  async *queryStream(
    _query: SQLQuery,
    _options: QueryStreamOptions = {},
  ): AsyncGenerator<any, void, unknown> {
    throw new Error(`Not implemented by mock-db`);
  }
}

async function execute(client: MockDatabase, query: string): Promise<void> {
  try {
    client.exec(query, []);
  } catch (ex) {
    throw Object.assign(new Error(ex.message), ex);
  }
}
async function executeQueryInternal(
  client: MockDatabase,
  query: SQLQuery,
  q: {text: string; values: unknown[]},
  handlers: EventHandlers,
): Promise<any[]> {
  try {
    const result = client.exec(q.text, q.values);
    return result;
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
  const err = Object.assign(new Error(isError(ex) ? ex.message : `${ex}`), ex);
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
