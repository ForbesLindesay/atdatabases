import {URL} from 'url';
import {escapeMySqlIdentifier} from '@databases/escape-identifier';
import {getMySqlConfigSync} from '@databases/mysql-config';
import pushToAsyncIterable from '@databases/push-to-async-iterable';
import sql, {SQLQuery, FormatConfig, isSqlQuery} from '@databases/sql';
import createPool, {Pool, PoolConnection} from './raw';
import {PassThrough} from 'stream';
const {codeFrameColumns} = require('@babel/code-frame');

export type {SQLQuery};
export {sql, isSqlQuery};

const {connectionStringEnvironmentVariable} = getMySqlConfigSync();

const mysqlFormat: FormatConfig = {
  escapeIdentifier: (str) => escapeMySqlIdentifier(str),
  formatValue: (value) => ({placeholder: '?', value}),
};

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

export interface Connection {
  query(query: SQLQuery): Promise<any[]>;

  queryStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
    },
  ): AsyncIterableIterator<any>;

  queryNodeStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
    },
  ): NodeJS.ReadableStream;
}

export interface ConnectionPool extends Connection {
  task<T>(fn: (connection: Connection) => Promise<T>): Promise<T>;

  tx<T>(fn: (connection: Connection) => Promise<T>): Promise<T>;

  dispose(): Promise<void>;
}

class ConnectionImplementation implements Connection {
  private readonly conn: Pick<PoolConnection, 'query' | 'connection'>;
  constructor(conn: Pick<PoolConnection, 'query' | 'connection'>) {
    this.conn = conn;
  }

  async query(query: SQLQuery): Promise<any[]> {
    if (!isSqlQuery(query)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.format(mysqlFormat);
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
    if (!isSqlQuery(query)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.format(mysqlFormat);
    const highWaterMark = (options && options.highWaterMark) || 5;

    return pushToAsyncIterable<any>((handlers) => {
      const stream = this.conn.connection.query(text, values);
      stream.on('result', handlers.onData);
      stream.on('error', handlers.onError);
      stream.on('end', handlers.onEnd);
      return {
        dispose: () => {
          this.conn.connection.resume();
        },
        pause: () => {
          this.conn.connection.pause();
        },
        resume: () => {
          this.conn.connection.resume();
        },
        highWaterMark,
      };
    });
  }

  queryNodeStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
    },
  ): NodeJS.ReadableStream {
    if (!isSqlQuery(query)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.format(mysqlFormat);
    const result = this.conn.connection.query(text, values).stream(options);
    // tslint:disable-next-line:no-unbound-method
    const on = result.on;
    const transformedExceptions = new Set();
    return Object.assign(result, {
      on(event: string, cb: (...args: any[]) => void) {
        if (event !== 'error') return on.call(this, event, cb);
        return on.call(this, event, (ex) => {
          // TODO: consider using https://github.com/Vincit/db-errors
          if (!transformedExceptions.has(ex)) {
            transformedExceptions.add(ex);
            transformError(text, ex);
          }
          cb(ex);
        });
      },
    });
  }
}

class ConnectionPoolImplemenation implements ConnectionPool {
  private readonly pool: Pool;
  constructor(pool: Pool) {
    this.pool = pool;
  }

  async query(query: SQLQuery): Promise<any[]> {
    if (!isSqlQuery(query)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.format(mysqlFormat);
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
    const c = new ConnectionImplementation(connection);
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
  ) {
    const stream = new PassThrough({objectMode: true, highWaterMark: 2});
    this.pool
      .getConnection()
      .then((connection) => {
        const c = new ConnectionImplementation(connection);
        let released = false;
        return c
          .queryNodeStream(query, options)
          .on('fields', (fields) => {
            stream.emit('fields', fields);
          })
          .on('error', (err) => {
            if (!released) {
              released = true;
              connection.release();
            }
            stream.emit('error', err);
          })
          .on('end', () => {
            if (!released) {
              released = true;
              connection.release();
            }
            stream.emit('end');
          })
          .pipe(stream);
      })
      .catch((ex) => stream.emit('error', ex));
    return stream;
  }

  async task<T>(fn: (connection: Connection) => Promise<T>) {
    const connection = await this.pool.getConnection();
    try {
      const result = await fn(new ConnectionImplementation(connection));
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
        result = await fn(new ConnectionImplementation(connection));
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
): ConnectionPool {
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
    multipleStatements: true,
  });
  return new ConnectionPoolImplemenation(pool);
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

module.exports = Object.assign(connect, {
  default: connect,
  sql,
  isSqlQuery,
});
