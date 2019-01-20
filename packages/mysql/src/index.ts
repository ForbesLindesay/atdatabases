import {URL} from 'url';
import {getMySqlConfigSync} from '@databases/mysql-config';
import sql, {SQLQuery} from '@databases/sql';
import createPool, {Pool, PoolConnection} from './raw';
const {codeFrameColumns} = require('@babel/code-frame');

const {connectionStringEnvironmentVariable} = getMySqlConfigSync();

export {sql};
export class Connection {
  private readonly conn: Pick<PoolConnection, 'query'>;
  constructor(conn: Pick<PoolConnection, 'query'>) {
    this.conn = conn;
  }

  async query(query: SQLQuery): Promise<any[]> {
    if (!(query instanceof SQLQuery)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.compileMySQL();
    try {
      return (await this.conn.query(text, values))[0] as any[];
    } catch (ex) {
      // TODO: consider using https://github.com/Vincit/db-errors
      if (
        ex.code === 'ER_PARSE_ERROR' &&
        ex.sqlState === '42000' &&
        typeof ex.sqlMessage === 'string'
      ) {
        const match = / near \'((?:.|\n)+)\' at line (\d+)$/.exec(
          ex.sqlMessage,
        );
        if (match) {
          const index = text.indexOf(match[1]);
          if (index === text.lastIndexOf(match[1])) {
            const linesUptoStart = text.substr(0, index).split('\n');
            const line = linesUptoStart.length;
            const start = {
              line,
              column: linesUptoStart[linesUptoStart.length - 1].length + 1,
            };
            const linesUptoEnd = text
              .substr(0, index + match[1].length)
              .split('\n');
            const end = {
              line: linesUptoEnd.length,
              column: linesUptoEnd[linesUptoEnd.length - 1].length + 1,
            };

            ex.message = ex.message.replace(
              / near \'((?:.|\n)+)\' at line (\d+)$/,
              ` near:\n\n${codeFrameColumns(text, {start, end})}\n`,
            );
          }
        }
      }
      throw ex;
    }
  }
}

export class ConnectionPool extends Connection {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    super(pool);
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

  validateMySqlUrl(connectionConfig);

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

function validateMySqlUrl(urlString: string) {
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
}
