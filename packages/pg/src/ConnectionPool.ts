import {BaseConnectionPool, Factory, PoolOptions} from '@databases/shared';
import {SQLQuery} from '@databases/sql';
import {escapePostgresIdentifier} from '@databases/escape-identifier';
import Connection from './Connection';
import Transaction from './Transaction';
import {PassThrough, Readable} from 'stream';
import PgClient from './types/PgClient';
import {ConnectionPool as IConnectionPool} from './types/Queryable';
import TypeOverrides, {
  parseComposite,
  parseArray,
  getTypeResolver,
} from './TypeOverrides';
import EventHandlers from './types/EventHandlers';
import PgDriver from './Driver';
import createConnectionSource, {PgOptions} from './ConnectionSource';
import definePrecondition from './definePrecondition';

const factories: Factory<PgDriver, Connection, Transaction> = {
  createTransaction(driver) {
    return new Transaction(driver, factories);
  },
  createConnection(driver) {
    return new Connection(driver, factories);
  },
};

const getConnectionPoolOptions = (
  srcConfig: PgOptions,
  schema: string | string[] | undefined,
  poolOptions: Omit<
    PoolOptions<PgDriver>,
    'openConnection' | 'closeConnection'
  >,
  handlers: EventHandlers,
  onError: (err: Error) => void,
  acquireLockTimeoutMilliseconds: number,
): PoolOptions<PgDriver> => {
  const src = createConnectionSource(
    srcConfig,
    handlers,
    acquireLockTimeoutMilliseconds,
  );

  // setting up types requires a connection, but doesn't have to be done separately for each connection,
  // doing it once is sufficient
  const typesSetup = definePrecondition(async (client: PgClient) => {
    return srcConfig.types.prepareOverrides(getTypeResolver(client));
  });

  return {
    ...poolOptions,
    openConnection: async (removeFromPool) => {
      const driver = await src();
      try {
        await typesSetup.callPrecondition(driver.client);

        if (schema) {
          // the schema (i.e. the search_path) must be set on each connection before it is used
          if (typeof schema === 'string') {
            await driver.client.query(
              `SET search_path TO ${escapePostgresIdentifier(schema)}`,
            );
          } else if (Array.isArray(schema)) {
            await driver.client.query(
              `SET search_path TO ${schema
                .map((s) => escapePostgresIdentifier(s))
                .join(', ')}`,
            );
          }
        }
      } catch (ex) {
        await driver.dispose().catch(() => {
          // ignore error within error
        });
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
  extends BaseConnectionPool<Connection, Transaction, PgDriver>
  implements IConnectionPool {
  private readonly _types: TypeOverrides;
  constructor(
    options: PgOptions,
    {
      poolOptions = {},
      schema,
      handlers: {onError, ...handlers},
      acquireLockTimeoutMilliseconds,
    }: {
      poolOptions?: Omit<
        PoolOptions<PgDriver>,
        'openConnection' | 'closeConnection'
      >;
      schema?: string | string[];
      handlers: EventHandlers & {
        onError: (err: Error) => void;
      };
      acquireLockTimeoutMilliseconds: number;
    },
  ) {
    super(
      getConnectionPoolOptions(
        options,
        schema,
        poolOptions,
        handlers,
        onError,
        acquireLockTimeoutMilliseconds,
      ),
      factories,
    );
    this._types = options.types;
  }

  async registerTypeParser<T>(
    type: number | string,
    parser: (value: string) => T,
  ): Promise<(value: string) => T> {
    if (typeof type === 'number') {
      this._types.setTypeParser(type, parser);
    } else {
      const driver = await this._pool.getConnection();
      let released = false;
      try {
        const id = await getTypeResolver(driver.connection.client)(type);
        driver.release();
        released = true;
        this._types.setTypeParser(id, parser);
      } finally {
        if (!released) {
          driver.dispose();
        }
      }
    }
    return parser;
  }
  async getTypeParser(type: number | string): Promise<(value: string) => any> {
    if (typeof type === 'number') {
      return this._types.getTypeParser(type);
    } else {
      const driver = await this._pool.getConnection();
      let released = false;
      try {
        const id = await getTypeResolver(driver.connection.client)(type);
        driver.release();
        released = true;
        return this._types.getTypeParser(id);
      } finally {
        if (!released) {
          driver.dispose();
        }
      }
    }
  }
  public readonly parseComposite = parseComposite;
  public readonly parseArray = parseArray;

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
        connectionStream.pipe(stream);
        connectionStream.on('error', () => {
          if (!released) {
            released = true;
            driver.dispose();
          }
          stream.emit('error', stream);
        });
        connectionStream.on('close', () => {
          if (!released) {
            released = true;
            driver.release();
          }
          stream.emit('close');
        });
        stream.on('close', () => {
          connectionStream.destroy();
        });
      })
      .catch((ex) => stream.emit('error', ex));
    return stream;
  }
}
