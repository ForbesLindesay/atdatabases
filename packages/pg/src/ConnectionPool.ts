import {BaseConnectionPool, Factory, PoolOptions} from '@databases/shared';
import {SQLQuery} from '@databases/sql';
import {escapePostgresIdentifier} from '@databases/escape-identifier';
import Connection from './Connection';
import Transaction from './Transaction';
import AbortSignal from './types/AbortSignal';
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
  async canRecycleConnection() {
    // never recycle connections on error
    return false;
  },
};

function timeout<T>(promise: Promise<T>): Promise<T> {
  let err = new Error('Operation timed out');
  try {
    throw err;
  } catch (ex) {
    err = ex;
  }
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(err);
    }, 1000);
    promise.then(
      (v) => {
        clearTimeout(timeout);
        resolve(v);
      },
      (v) => {
        clearTimeout(timeout);
        reject(v);
      },
    );
  });
}

const getConnectionPoolOptions = (
  srcConfig: PgOptions,
  schema: string | string[] | undefined,
  poolOptions: Omit<PoolOptions<PgDriver>, 'getConnection' | 'closeConnection'>,
  handlers: EventHandlers,
  onError: (err: Error) => void,
): PoolOptions<PgDriver> => {
  const src = createConnectionSource(srcConfig, handlers);

  // setting up types requires a connection, but doesn't have to be done separately for each connection,
  // doing it once is sufficient
  const typesSetup = definePrecondition(async (client: PgClient) => {
    return srcConfig.types.prepareOverrides(getTypeResolver(client));
  });

  // function makeIdleListener(pool, client) {
  //   return function idleListener(err) {
  //     err.client = client

  //     client.removeListener('error', idleListener)
  //     client.on('error', () => {
  //       pool.log('additional client error after disconnection due to error', err)
  //     })
  //     pool._remove(client)
  //     // TODO - document that once the pool emits an error
  //     // the client has already been closed & purged and is unusable
  //     pool.emit('error', err, client)
  //   }
  // }
  return {
    ...poolOptions,
    getConnection: async (removeFromPool) => {
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
        driver.dispose();
        throw ex;
      }

      driver.onAddingToPool(removeFromPool, onError);
      return driver;
    },
    closeConnection: async (driver) => {
      try {
        await timeout(driver.dispose());
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
    }: {
      poolOptions?: Omit<
        PoolOptions<PgDriver>,
        'getConnection' | 'closeConnection'
      >;
      schema?: string | string[];
      handlers: EventHandlers & {
        onError: (err: Error) => void;
      };
    },
  ) {
    super(
      getConnectionPoolOptions(options, schema, poolOptions, handlers, onError),
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

  async *queryStream(
    query: SQLQuery,
    options: {
      batchSize?: number;
      signal?: AbortSignal | undefined;
    } = {},
  ): AsyncGenerator<any, void, unknown> {
    const driver = await this._pool.getConnection();
    let finished = false;
    try {
      for await (const row of driver.connection.queryStream(query, options)) {
        yield row;
      }
      finished = true;
    } finally {
      if (finished) {
        driver.release();
      } else {
        driver.dispose();
      }
    }
  }
}
