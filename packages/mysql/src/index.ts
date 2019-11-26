import {URL} from 'url';
import {getMySqlConfigSync} from '@databases/mysql-config';
import pushToAsyncIterable from '@databases/push-to-async-iterable';
import sql, {SQLQuery} from '@databases/sql';
import createPool, {Pool, PoolConnection} from './raw';
import {PassThrough, ReadableStream} from 'barrage';
const {codeFrameColumns} = require('@babel/code-frame');

const {connectionStringEnvironmentVariable} = getMySqlConfigSync();

function transformError(text: string, ex: any) {
  // TODO: consider using https://github.com/Vincit/db-errors
  if (
    ex.code === 'ER_PARSE_ERROR' &&
    ex.sqlState === '42000' &&
    typeof ex.sqlMessage === 'string'
  ) {
    const match = / near \'((?:.|\n)+)\' at line (\d+)$/.exec(ex.sqlMessage);
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
}

export {sql};
export class Connection {
  private readonly conn: Pick<PoolConnection, 'query' | 'connection'>;
  constructor(conn: Pick<PoolConnection, 'query' | 'connection'>) {
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
      transformError(text, ex);
      throw ex;
    }
  }

  queryStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
    },
  ) {
    if (!(query instanceof SQLQuery)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.compileMySQL();
    const highWaterMark = (options && options.highWaterMark) || 5;
    const stream = this.conn.connection.query(text, values);

    return pushToAsyncIterable<any>({
      onData(fn) {
        stream.on('result', fn);
      },
      onError(fn) {
        stream.on('error', fn);
      },
      onEnd(fn) {
        stream.on('end', fn);
      },
      pause: () => {
        this.conn.connection.pause();
      },
      resume: () => {
        this.conn.connection.resume();
      },
      highWaterMark,
    });
  }

  queryNodeStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
    },
  ): ReadableStream<any> {
    if (!(query instanceof SQLQuery)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.compileMySQL();
    const result = this.conn.connection.query(text, values).stream(options);
    const resultStream = new PassThrough({objectMode: true, highWaterMark: 2});
    result.on('error', err => {
      transformError(text, err);
      resultStream.emit('error', err);
    });
    result.on('fields', f => resultStream.emit('fields', f));
    result.pipe(resultStream);
    return resultStream;
  }
}

export class ConnectionPool {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async query(query: SQLQuery): Promise<any[]> {
    if (!(query instanceof SQLQuery)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.compileMySQL();
    try {
      return (await this.pool.query(text, values))[0] as any[];
    } catch (ex) {
      transformError(text, ex);
      throw ex;
    }
  }

  async *queryStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
    },
  ) {
    const connection = await this.pool.getConnection();
    const c = new Connection(connection);
    try {
      for await (const record of c.queryStream(query, options)) {
        yield record;
      }
    } finally {
      connection.release();
    }
  }
  queryNodeStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
    },
  ): ReadableStream<any> {
    const stream = new PassThrough<any>({objectMode: true, highWaterMark: 2});
    this.pool
      .getConnection()
      .then(connection => {
        const c = new Connection(connection);
        let released = false;
        return (c
          .queryNodeStream(query, options)
          .on('error', err => {
            if (!released) {
              released = true;
              connection.release();
            }
          })
          .on('end', () => {
            if (!released) {
              released = true;
              connection.release();
            }
          })
          .syphon(stream) as any).on('fields', (fields: any) => {
          stream.emit('fields', fields);
        });
      })
      .catch(ex => stream.emit('error', ex));
    return stream;
  }

  async task<T>(fn: (connection: Connection) => Promise<T>) {
    const connection = await this.pool.getConnection();
    try {
      const result = await fn(new Connection(connection));
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
