// import sql, {SQLQuery} from '@databases/sql';
import {URL} from 'url';
import {getMySqlConfigSync} from '@databases/mysql-config';
import createPool, {Pool, PoolConnection} from './raw';

const {connectionStringEnvironmentVariable} = getMySqlConfigSync();

export class Connection {
  public readonly conn: PoolConnection;
  constructor(conn: PoolConnection) {
    this.conn = conn;
  }
}

export class ConnectionPool {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async task<T>(fn: (connection: Connection) => Promise<T>) {
    const connection = await this.pool.getConnection();
    try {
      const result = fn(new Connection(connection));
      return result;
    } finally {
      connection.release();
    }
  }

  async tx<T>(fn: (connection: Connection) => Promise<T>) {
    const connection = await this.pool.getConnection();
    let completed = false;
    try {
      await connection.beginTransaction();
      let result: T;
      try {
        result = await fn(new Connection(connection));
      } catch (ex) {
        await connection.rollback();
        completed = true;
        throw ex;
      }
      await connection.commit();
      completed = true;
      return result;
    } finally {
      if (completed) {
        connection.release();
      } else {
        connection.destroy();
      }
    }
  }

  async dispose() {
    await this.pool.end();
  }
}
export default function connect(
  connectionConfig: string | undefined = process.env[
    connectionStringEnvironmentVariable
  ],
) {
  if (!connectionConfig) {
    throw new Error(
      'You must provide a connection string for @databases/mysql. You can ' +
        'either pass one directly to the createConnection call or set ' +
        `the ${connectionStringEnvironmentVariable} environment variable.`,
    );
  }

  parseUrl(connectionConfig);

  const pool = createPool({
    uri: connectionConfig,
    authSwitchHandler({pluginName, pluginData}: any, cb: any) {
      const err = new Error(
        `Unknown AuthSwitchRequest plugin name ${pluginName}`,
      );
      (err as any).fatal = true;
      cb(err);
    },
    multipleStatements: true,
  });
  return new ConnectionPool(pool);
}

function parseUrl(urlString: string) {
  let url;
  try {
    url = new URL(urlString);
  } catch (ex) {
    throw new Error(
      'Invalid MySQL connection string, expected a URI: ' + urlString,
    );
  }
  if (url.protocol !== 'mysqlx:' && url.protocol !== 'mysql:') {
    throw new Error(
      'Invalid MySQL connection string, expected protocol to be "mysql" or "mysqlx": ' +
        urlString,
    );
  }

  // const options: any = {
  //   host: url.hostname,
  //   port: url.port,
  //   database: url.pathname.substr(1),
  // };
  // if (url.username) {
  //   options.user = url.username;
  //   options.password = url.password;
  // }

  // for (const key of url.searchParams.keys()) {
  //   const value = url.searchParams.get(key)!;
  //   try {
  //     // Try to parse this as a JSON expression first
  //     options[key] = JSON.parse(value);
  //   } catch (err) {
  //     // Otherwise assume it is a plain string
  //     options[key] = value;
  //   }
  // }

  // return options;
}
