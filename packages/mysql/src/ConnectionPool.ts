import {PassThrough, Readable} from 'stream';
import {BaseConnectionPool, Factory, PoolOptions} from '@databases/shared';
import {SQLQuery} from '@databases/sql';
import {createConnection} from 'mysql2/promise';
import Connection from './Connection';
import Transaction from './Transaction';
import {ConnectionPool as IConnectionPool} from './types/Queryable';
import EventHandlers from './types/EventHandlers';
import MySqlDriver from './MySqlDriver';

const factories: Factory<MySqlDriver, Connection, Transaction> = {
  createTransaction(driver) {
    return new Transaction(driver, factories);
  },
  createConnection(driver) {
    return new Connection(driver, factories);
  },
};

interface MySqlConnectionOptions {
  uri: string;
  multipleStatements?: boolean;
  timezone: 'Z' | 'local';
  typeCast?: (
    field: {
      type: string;
      length: number;
      db: string;
      table: string;
      name: string;
      string(): string;
      buffer(): Buffer;
      geometry(): unknown;
    },
    next: () => any,
  ) => any;
}
const getConnectionPoolOptions = (
  srcConfig: MySqlConnectionOptions,
  poolOptions: Omit<
    PoolOptions<MySqlDriver>,
    'openConnection' | 'closeConnection'
  >,
  handlers: EventHandlers,
  onError: (err: Error) => void,
  aquireLockTimeoutMilliseconds: number,
  serverTimeZone: 'local' | 'utc' | undefined,
): PoolOptions<MySqlDriver> => {
  return {
    ...poolOptions,
    openConnection: async (removeFromPool) => {
      const client = await createConnection(srcConfig);
      const driver = new MySqlDriver(
        client,
        handlers,
        aquireLockTimeoutMilliseconds,
      );
      try {
        if (serverTimeZone === 'utc') {
          await driver.client.query(`SET time_zone = "+00:00";`);
        } else if (serverTimeZone === 'local') {
          await driver.client.query(`SET time_zone = ?;`, [
            Intl.DateTimeFormat().resolvedOptions().timeZone,
          ]);
        }
      } catch (ex) {
        void driver.dispose();
        throw ex;
      }

      driver.onAddingToPool(removeFromPool, onError);
      if (handlers.onConnectionOpened) {
        handlers.onConnectionOpened();
      }
      return driver;
    },
    closeConnection: async (driver) => {
      try {
        await driver.dispose();
        if (handlers.onConnectionClosed) {
          handlers.onConnectionClosed();
        }
      } catch (ex) {
        console.warn(ex.message);
      }
    },
    onActive(driver) {
      driver.onActive();
    },
    onIdle(driver) {
      driver.onIdle();
    },
  };
};

export default class ConnectionPool
  extends BaseConnectionPool<Connection, Transaction, MySqlDriver>
  implements IConnectionPool {
  constructor(
    srcConfig: MySqlConnectionOptions,
    poolOptions: Omit<
      PoolOptions<MySqlDriver>,
      'openConnection' | 'closeConnection'
    >,
    handlers: EventHandlers,
    onError: (err: Error) => void,
    aquireLockTimeoutMilliseconds: number,
    serverTimeZone: 'local' | 'utc' | undefined,
  ) {
    super(
      getConnectionPoolOptions(
        srcConfig,
        poolOptions,
        handlers,
        onError,
        aquireLockTimeoutMilliseconds,
        serverTimeZone,
      ),
      factories,
    );
  }

  queryNodeStream(
    query: SQLQuery,
    options: {highWaterMark?: number} = {},
  ): Readable {
    this._throwIfDisposed();
    const stream = new PassThrough({
      objectMode: true,
    });
    this._pool
      .getConnection()
      .then(async (driver) => {
        let released = false;
        const connectionStream = driver.connection.queryNodeStream(
          query,
          options,
        );
        return connectionStream
          .on('fields', (fields) => {
            stream.emit('fields', fields);
          })
          .on('error', (err) => {
            if (!released) {
              released = true;
              driver.dispose();
            }
            stream.emit('error', err);
          })
          .on('end', () => {
            if (!released) {
              released = true;
              driver.release();
            }
            stream.emit('end');
          })
          .pipe(stream);
      })
      .catch((ex) => stream.emit('error', ex));
    return stream;
  }
}
