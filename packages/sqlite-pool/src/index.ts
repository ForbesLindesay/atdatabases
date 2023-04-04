import sql, {SQLQuery, isSqlQuery} from '@databases/sql';
import connect, { DatabaseOptions, DatabaseConnection as SyncDatabaseConnection } from '@databases/sqlite-sync';
import createBaseConnectionPool, { ConnectionPool, PoolOptions } from '@databases/connection-pool';

export type {SQLQuery};
export {sql, isSqlQuery};

export interface DatabaseTransaction {
  query(query: SQLQuery): Promise<any[]>;

  queryStream(query: SQLQuery): AsyncIterableIterator<any>;
}

export interface DatabaseConnection extends DatabaseTransaction {
  tx<T>(fn: (db: DatabaseTransaction) => Promise<T>): Promise<T>;
  dispose(): Promise<void>;
}

class TransactionImplementation implements DatabaseTransaction {
  #connection: SyncDatabaseConnection;

  constructor(connection: SyncDatabaseConnection) {
    this.#connection = connection;
  }

  async query (query: SQLQuery) : Promise<any[]> {
    return this.#connection.query(query)
  }

  queryStream(query: SQLQuery): AsyncIterableIterator<any> {
    const connection = this.#connection;
    return (async function* () {
      for (const row of connection.queryStream(query)) {
        yield row;
      }
    })();
  }
}

type PartialPoolOptions = Omit<PoolOptions<SyncDatabaseConnection>, 'openConnection' | 'closeConnection'>;

class DatabaseConnectionImplementation implements DatabaseConnection {
  #pool: ConnectionPool<SyncDatabaseConnection>

  constructor(filename?: string, options?: DatabaseOptions, poolOptions?: PartialPoolOptions) {
    this.#pool = createBaseConnectionPool({
      async openConnection() {
        return connect(filename, options);
      },
      async closeConnection(connection) {
        connection.dispose();
        return
      },
      async onReleaseTimeout(connection) {
        connection.dispose();
        throw new Error('kaboom');
        return
      },
      ...poolOptions
    });
  }

  async query (query: SQLQuery) : Promise<any[]> {
    const poolConnection = await this.#pool.getConnection();
    try {
      const res = poolConnection.connection.query(query);
      return res;
    } finally {
      poolConnection.release();
    }
  }

  queryStream(query: SQLQuery): AsyncIterableIterator<any> {
    const that = this;
    return (async function* () {
      const poolConnection = await that.#pool.getConnection();
      try {
        for (const row of poolConnection.connection.queryStream(query)) {
          yield row;
        }
      } finally {
        poolConnection.release();
      }
    })();
  }

  async tx<T>(fn: (db: DatabaseTransaction) => Promise<T>): Promise<T> {
    const poolConnection = await this.#pool.getConnection();
    const connection = poolConnection.connection;
    try {
      connection.query(sql`BEGIN`);
      const res = await fn(new TransactionImplementation(connection));
      connection.query(sql`COMMIT`);
      return res
    } catch (e) {
      connection.query(sql`ROLLBACK`);
      throw e;
    } finally {
      poolConnection.release();
    }
  }

  async dispose(): Promise<void> {
    await this.#pool.drain();
  }
}

function createConnectionPool(filename?: string, options?: DatabaseOptions, poolOptions?: PartialPoolOptions): DatabaseConnection {
  return new DatabaseConnectionImplementation(filename, options, poolOptions);
}

export default createConnectionPool;
