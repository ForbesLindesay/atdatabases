import {Readable} from 'stream';
import {
  Connection,
  pgFormat,
  Queryable,
  QueryableType,
  Transaction,
  sql,
  SQLQuery,
} from '@databases/pg';
import AbortSignal from '@databases/pg/lib/types/AbortSignal';
import TransactionOptions from '@databases/pg/lib/types/TransactionOptions';

export default class Cluster implements Queryable {
  public readonly type: QueryableType = QueryableType.Cluster;
  public readonly sql = sql;

  private readonly _primary: Queryable;
  private readonly _replicas: Queryable[];

  constructor(primary: Queryable, replicas: Queryable[]) {
    if (!replicas.length) {
      throw new Error(
        'You must provide at least one replica when using pg-cluster',
      );
    }
    this._primary = primary;
    this._replicas = replicas;
  }

  private _getReplica(): Queryable {
    return this._replicas[Math.floor(Math.random() * this._replicas.length)];
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    if (Array.isArray(query)) {
      if (query.length === 0) {
        return [];
      }
      const hasWriteableQueries = query.some(isQueryWriteable);
      if (hasWriteableQueries) {
        return this._primary.query(query);
      } else {
        return this._getReplica().query(query);
      }
    } else {
      if (isQueryWriteable(query)) {
        return this._primary.query(query);
      } else {
        return this._getReplica().query(query);
      }
    }
  }

  queryStream(
    query: SQLQuery,
    options: {batchSize?: number | undefined; signal?: AbortSignal | undefined},
  ): AsyncIterable<any> {
    if (isQueryWriteable(query)) {
      return this._primary.queryStream(query, options);
    } else {
      return this._getReplica().queryStream(query, options);
    }
  }

  queryNodeStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number | undefined;
      batchSize?: number | undefined;
    },
  ): Readable {
    if (isQueryWriteable(query)) {
      return this._primary.queryNodeStream(query, options);
    } else {
      return this._getReplica().queryNodeStream(query, options);
    }
  }

  async task<T>(
    fn: (connection: Connection | Transaction) => Promise<T>,
  ): Promise<T> {
    return this._primary.task(fn);
  }

  async tx<T>(
    fn: (connection: Transaction) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    if (options?.readOnly) {
      return this._getReplica().tx(fn, options);
    } else {
      return this._primary.tx(fn, options);
    }
  }

  async addPostCommitStep(fn: () => Promise<void>): Promise<void> {
    await fn();
  }
}

const WRITEABLE_REGEX =
  /\b(alter|create|delete|drop|insert|reindex|truncate|update|vacuum)\b/i;

function isQueryWriteable(query: SQLQuery): boolean {
  const formatted = query.format(pgFormat);
  return WRITEABLE_REGEX.test(formatted.text);
}
