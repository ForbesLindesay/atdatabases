import sql, {SQLQuery, isSqlQuery} from '@databases/sql';
import connect, {
  DatabaseOptions,
  DatabaseConnection as SyncDatabaseConnection,
} from '@databases/sqlite-sync';
import createBaseConnectionPool, {
  ConnectionPool,
  PoolConnection,
  PoolOptions,
} from '@databases/connection-pool';
import {once} from 'events';

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

async function* transactionalQueryStream(
  transaction: TransactionImplementation,
  query: SQLQuery,
): AsyncIterableIterator<any> {
  const connection = transaction.connection;
  for (const row of connection.queryStream(query)) {
    if (transaction.aborted) {
      throw new Error('Transaction aborted');
    }
    yield row;
  }
}

class TransactionImplementation implements DatabaseTransaction {
  connection: SyncDatabaseConnection;
  aborted: boolean = false;

  constructor(connection: SyncDatabaseConnection) {
    this.connection = connection;
  }

  async query(query: SQLQuery): Promise<any[]> {
    if (this.aborted) {
      throw new Error('Transaction aborted');
    }
    return this.connection.query(query);
  }

  queryStream(query: SQLQuery): AsyncIterableIterator<any> {
    return transactionalQueryStream(this, query);
  }
}

async function* queryStream(maybePoolConnection: Promise<PoolConnection<SyncDatabaseConnectionWithController>>, query: SQLQuery) {
  const poolConnection = await maybePoolConnection;
  try {
    for (const row of poolConnection.connection.queryStream(query)) {
      yield row;
    }
  } finally {
    poolConnection.release();
  }
};

type PartialPoolOptions = Omit<
  PoolOptions<SyncDatabaseConnection>,
  'openConnection' | 'closeConnection'
>;

interface SyncDatabaseConnectionWithController extends SyncDatabaseConnection {
  controller?: AbortController;
}

class DatabaseConnectionImplementation implements DatabaseConnection {
  #pool: ConnectionPool<SyncDatabaseConnectionWithController>;

  constructor(
    filename?: string,
    options?: DatabaseOptions,
    poolOptions?: PartialPoolOptions,
  ) {
    this.#pool = createBaseConnectionPool({
      async openConnection() {
        return connect(filename, options);
      },
      async closeConnection(connection) {
        connection.dispose();
        return;
      },
      async onReleaseTimeout(connection: SyncDatabaseConnectionWithController) {
        const controller = connection.controller;
        if (controller) {
          controller.abort();
        }
        connection.dispose();
        return;
      },
      ...poolOptions,
    });
  }

  async query(query: SQLQuery): Promise<any[]> {
    const poolConnection = await this.#pool.getConnection();
    try {
      const res = poolConnection.connection.query(query);
      return res;
    } finally {
      poolConnection.release();
    }
  }

  queryStream(query: SQLQuery): AsyncIterableIterator<any> {
    return queryStream(this.#pool.getConnection(), query);
  }

  async tx<T>(fn: (db: DatabaseTransaction) => Promise<T>): Promise<T> {
    const poolConnection = await this.#pool.getConnection();
    const connection = poolConnection.connection;
    try {
      connection.query(sql`BEGIN`);
      const controller = new AbortController();
      const tx = new TransactionImplementation(connection);
      connection.controller = controller;
      const res = await Promise.race([
        fn(tx),
        once(controller.signal, 'abort').then(() => {
          throw new Error('Transaction aborted');
        }),
      ]);
      connection.query(sql`COMMIT`);
      return res;
    } catch (e) {
      try {
        connection.query(sql`ROLLBACK`);
      } catch {
        // Deliberately swallow this error
      }
      throw e;
    } finally {
      poolConnection.release();
    }
  }

  async dispose(): Promise<void> {
    await this.#pool.drain();
  }
}

function createConnectionPool(
  filename?: string,
  options?: DatabaseOptions,
  poolOptions?: PartialPoolOptions,
): DatabaseConnection {
  return new DatabaseConnectionImplementation(filename, options, poolOptions);
}

export default createConnectionPool;
