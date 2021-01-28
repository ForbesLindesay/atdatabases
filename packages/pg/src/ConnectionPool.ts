import {ConnectionOptions} from 'tls';
import throat from 'throat';
import sql, {SQLQuery} from '@databases/sql';
import {escapePostgresIdentifier} from '@databases/escape-identifier';
import TransactionOptions from './types/TransactionOptions';
import Connection from './Connection';
import Transaction from './Transaction';
import AbortSignal from './types/AbortSignal';
import {PassThrough, Readable} from 'stream';
import PgClient from './types/PgClient';
import {
  ConnectionPool as IConnectionPool,
  QueryableType,
} from './types/Queryable';
import TypeOverrides, {parseComposite, parseArray} from './TypeOverrides';
import EventHandlers from './types/EventHandlers';
const {Pool} = require('pg');
interface Pool {
  readonly options: {
    types: TypeOverrides;
    [key: string]: any;
  };
  connect(): Promise<PoolClient>;
  end(): Promise<void>;

  on(
    event: 'connect' | 'acquire' | 'remove',
    listener: (client: PoolClient) => void,
  ): void;
  on(event: 'error', listener: (err: Error, client?: PoolClient) => void): void;
}
interface PoolClient extends PgClient {
  release(dispose?: boolean): void;
  _atdatabases_has_set_schema?: boolean;
}

const sslProperty = Symbol('_ssl');
type SSLConfig = null | {
  allowFallback: boolean;
  ssl: ConnectionOptions;
};
interface ConnectionPoolConfig {
  readonly options: {
    types: TypeOverrides;
    [key: string]: any;
  };
  readonly hosts: {host: string; port?: number | undefined}[];
  readonly [sslProperty]: SSLConfig;
}
export default class ConnectionPool implements IConnectionPool {
  public readonly type = QueryableType.ConnectionPool;
  public readonly sql = sql;

  private readonly _schema: string | string[] | undefined;
  private readonly _config: ConnectionPoolConfig;
  private readonly _pool: Pool;
  private _hadSuccessfulConnection: boolean = false;
  private _disposed: boolean = false;
  private readonly _preparingOverrides: Promise<void>;
  private readonly _handlers: EventHandlers;
  constructor(
    options: {types: TypeOverrides; [key: string]: any},
    {
      schema,
      hosts,
      ssl,
      handlers: {onError, ...handlers},
    }: {
      schema?: string | string[];
      hosts: {host: string; port?: number | undefined}[];
      ssl: null | {
        allowFallback: boolean;
        ssl: ConnectionOptions;
      };
      handlers: EventHandlers & {
        onError: (err: Error) => void;
      };
    },
  ) {
    this._config = {options, hosts, [sslProperty]: ssl};
    this._pool = new Pool({...options, ssl: ssl?.ssl, ...hosts[0]});
    this._schema = schema;
    this._pool.on('error', (err) => onError(err));
    this._preparingOverrides = this._withTypeResolver((getTypeID) =>
      this._pool.options.types.prepareOverrides(getTypeID),
    );
    this._preparingOverrides.catch((_ex) => {
      // this error will be surfaced later, we do not want it to be treated
      // as an unhandled rejection yet
    });
    this._handlers = handlers;
  }
  private _throwIfDisposed() {
    if (this._disposed) {
      throw new Error(
        'You cannot run any operations on a connection pool after it has been disposed.',
      );
    }
  }

  private readonly _repairConnectionPool: () => Promise<PoolClient | null> = throat(
    1,
    async () => {
      if (this._hadSuccessfulConnection) return null;

      const start = Date.now();
      let error: {message: string} | undefined;
      let attemptCount = 0;
      do {
        attemptCount++;
        if (attemptCount) {
          await new Promise((resolve) =>
            setTimeout(resolve, attemptCount * 100),
          );
        }

        for (const {host, port} of this._config.hosts) {
          this._pool.options.host = host;
          this._pool.options.port = port;
          this._pool.options.ssl = this._config[sslProperty]?.ssl;

          try {
            const connection = await this._pool.connect();
            this._hadSuccessfulConnection = true;
            return connection;
          } catch (ex) {
            error = ex;
            if (
              this._config[sslProperty]?.allowFallback &&
              /the server does not support ssl connections/i.test(
                error!.message,
              )
            ) {
              // The Postgres server does not support SSL and our sslmode is "prefer"
              // (which is the default). In this case we immediately retry without
              // ssl.
              try {
                (this._pool as any).options.ssl = false;
                const connection = await this._pool.connect();
                this._hadSuccessfulConnection = true;
                return connection;
              } catch (ex) {
                error = ex;
              }
            }
          }
        }

        // If you try to connect very quickly after postgres boots (e.g. intesting environments)
        // you can get an error of "Connection terminated unexpectedly". For this reason, we retry
        // all possible connections for up to 2 seconds
      } while (Date.now() - start < 2000);
      throw error;
    },
  );
  private async _getClient() {
    this._throwIfDisposed();
    let client: PoolClient | undefined | null;
    if (!this._hadSuccessfulConnection) {
      client = await this._repairConnectionPool();
    }
    if (!client) {
      try {
        client = await this._pool.connect();
      } catch (ex) {
        this._hadSuccessfulConnection = false;
        client = await this._repairConnectionPool();
      }
    }
    if (!client) {
      client = await this._pool.connect();
    }
    if (!client._atdatabases_has_set_schema && this._schema) {
      if (typeof this._schema === 'string') {
        await client.query(
          `SET search_path TO ${escapePostgresIdentifier(this._schema)}`,
        );
      } else if (Array.isArray(this._schema)) {
        await client.query(
          `SET search_path TO ${this._schema
            .map((s) => escapePostgresIdentifier(s))
            .join(', ')}`,
        );
      }
      client._atdatabases_has_set_schema = true;
    }
    return client;
  }

  private async _withTypeResolver<T>(
    fn: (getTypeID: (typeName: string) => Promise<number>) => Promise<T>,
  ): Promise<T> {
    const client = await this._getClient();

    try {
      const result = await fn(async (typeName: string) => {
        const ts = typeName.split('.');
        let results;
        if (ts.length === 1) {
          results = await this.query(sql`
            SELECT
              ty.oid as "typeID",
              ns.nspname AS "schemaName"
            FROM pg_catalog.pg_type ty
            INNER JOIN pg_catalog.pg_namespace ns
              ON (ty.typnamespace = ns.oid)
            WHERE lower(ty.typname) = ${typeName.toLowerCase()};
          `);
        } else if (ts.length === 2) {
          results = await this.query(sql`
            SELECT
              ty.oid as "typeID",
              ns.nspname AS "schemaName"
            FROM pg_catalog.pg_type ty
            INNER JOIN pg_catalog.pg_namespace ns
              ON (ty.typnamespace = ns.oid)
            WHERE lower(ty.typname) = ${ts[1].toLowerCase()} AND lower(ns.nspname) = ${ts[0].toLowerCase()};
          `);
        } else {
          throw new Error('Type Name should only have one "." in it');
        }
        if (results.length === 0) {
          throw new Error('Could not find the type ' + typeName);
        }
        if (results.length > 1) {
          throw new Error(
            'The type name ' +
              typeName +
              ' was found in multiple schemas: ' +
              results.map((r) => r.schemaName).join(', '),
          );
        }
        return results[0].typeID;
      });
      client.release();
      return result;
    } catch (ex) {
      client.release(true);
      throw ex;
    }
  }

  async registerTypeParser<T>(
    type: number | string,
    parser: (value: string) => T,
  ): Promise<(value: string) => T> {
    if (typeof type === 'number') {
      this._pool.options.types.setTypeParser(type, parser);
    } else {
      await this._withTypeResolver(async (getTypeID) => {
        this._pool.options.types.setTypeParser(await getTypeID(type), parser);
      });
    }
    return parser;
  }
  async getTypeParser(type: number | string): Promise<(value: string) => any> {
    if (typeof type === 'number') {
      return this._pool.options.types.getTypeParser(type);
    } else {
      return await this._withTypeResolver(async (getTypeID) =>
        this._pool.options.types.getTypeParser(await getTypeID(type)),
      );
    }
  }
  public readonly parseComposite = parseComposite;
  public readonly parseArray = parseArray;

  async task<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
    await this._preparingOverrides;
    const client = await this._getClient();
    const connection = new Connection(client, this._handlers);
    try {
      const result = await fn(connection);
      connection.dispose();
      client.release();
      return result;
    } catch (ex) {
      connection.dispose();
      client.release(true);
      throw ex;
    }
  }
  async tx<T>(
    fn: (connection: Transaction) => Promise<T>,
    transactionOptions: TransactionOptions = {},
  ): Promise<T> {
    this._throwIfDisposed();
    return await this.task(
      async (connection) => await connection.tx(fn, transactionOptions),
    );
  }

  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    this._throwIfDisposed();
    if (Array.isArray(query) && query.length === 0) return [];
    return await this.task(async (connection) => {
      if (Array.isArray(query)) {
        return await connection.query(query);
      } else {
        return await connection.query(query);
      }
    });
  }

  queryNodeStream(
    query: SQLQuery,
    options: {highWaterMark?: number} = {},
  ): Readable {
    const stream = new PassThrough({
      objectMode: true,
    });
    Promise.resolve(null)
      .then(async () => {
        await this._preparingOverrides;
        const client = await this._getClient();
        const connection = new Connection(client, this._handlers);
        const connectionStream = connection.queryNodeStream(query, options);
        connectionStream.pipe(stream);
        connectionStream.on('error', () => {
          client?.release(true);
          stream.emit('error', stream);
        });
        connectionStream.on('close', () => {
          client?.release();
          stream.emit('close');
        });
        stream.on('close', () => {
          connectionStream.destroy();
        });
      })
      .catch((ex) => stream.emit('error', ex));
    return stream;
  }

  async *queryStream(
    query: SQLQuery,
    options: {
      batchSize?: number;
      signal?: AbortSignal | undefined;
    } = {},
  ): AsyncGenerator<any, void, unknown> {
    await this._preparingOverrides;
    const client = await this._getClient();
    const connection = new Connection(client, this._handlers);
    try {
      for await (const row of connection.queryStream(query, options)) {
        yield row;
      }
      connection.dispose();
      client.release();
    } catch (ex) {
      connection.dispose();
      client.release(true);
      throw ex;
    }
  }

  async dispose() {
    if (!this._disposed) {
      this._disposed = true;
      await this._pool.end();
    }
  }
}
