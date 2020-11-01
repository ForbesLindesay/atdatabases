import {ConnectionOptions} from 'tls';
import throat from 'throat';
import {SQLQuery} from '@databases/sql';
import {Pool, PoolClient} from 'pg';
import TransactionOptions from './types/TransactionOptions';
import Connection from './Connection';
import Transaction from './Transaction';

const sslProperty = Symbol('_ssl');
type SSLConfig = null | {
  allowFallback: boolean;
  ssl: ConnectionOptions;
};
interface ConnectionPoolConfig {
  readonly options: any;
  readonly hosts: {host: string; port?: number | undefined}[];
  readonly [sslProperty]: SSLConfig;
}
export default class ConnectionPool {
  private readonly _config: ConnectionPoolConfig;
  private readonly _pool: Pool;
  private _hadSuccessfulConnection: boolean = false;
  private _disposed: boolean = false;
  constructor(
    options: any,
    hosts: {host: string; port?: number | undefined}[],
    ssl: null | {
      allowFallback: boolean;
      ssl: ConnectionOptions;
    },
  ) {
    this._config = {options, hosts, [sslProperty]: ssl};
    this._pool = new Pool({...options, ssl: ssl?.ssl, ...hosts[0]});
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
          (this._pool as any).options.host = host;
          (this._pool as any).options.port = port;
          (this._pool as any).options.ssl = this._config[sslProperty]?.ssl;

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

  async task<T>(fn: (connection: Connection) => Promise<T>): Promise<T> {
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
    const connection = new Connection(client);
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
    return await this.task(async (connection) => {
      if (Array.isArray(query)) {
        return await connection.query(query);
      } else {
        return await connection.query(query);
      }
    });
  }

  async dispose() {
    if (!this._disposed) {
      this._disposed = true;
      await this._pool.end();
    }
  }
}
