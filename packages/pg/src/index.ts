import {URL} from 'url';
import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {isSQLError, SQLError, SQLErrorCode} from '@databases/pg-errors';
import sql, {SQLQuery, SQL, isSqlQuery, FormatConfig} from '@databases/sql';
import pg = require('pg-promise');
import {TConfig, IOptions} from 'pg-promise';
import DataTypeID from '@databases/pg-data-type-id';
import {getPgConfigSync} from '@databases/pg-config';
import pushToAsyncIterable from '@databases/push-to-async-iterable';
import QueryStream = require('pg-query-stream');
import {PassThrough, Readable} from 'stream';
const {codeFrameColumns} = require('@babel/code-frame');

const {connectionStringEnvironmentVariable} = getPgConfigSync();

export type {SQLQuery, SQLError};
export {sql, isSqlQuery, isSQLError, SQLErrorCode, DataTypeID};

const pgFormat: FormatConfig = {
  escapeIdentifier: (str) => escapePostgresIdentifier(str),
  formatValue: (value, index) => ({placeholder: `$${index + 1}`, value}),
};

export type IsolationLevel = pg.isolationLevel;
export const IsolationLevel = pg.isolationLevel;
export interface TransactionOptions {
  tag?: string | number;
  isolationLevel?: IsolationLevel;
  readOnly?: boolean;
  deferrable?: boolean;
}

export enum QueryableType {
  Transaction = 'transaction',
  Connection = 'connection',
  ConnectionPool = 'connection_pool',
}

/**
 * A Queryable can represent any of:
 *
 *  - a Transaction
 *  - a single Connection to the database (aka a "Task")
 *  - a ConnectionPool
 *
 * All share a similar API, allowing you to write methods that can
 * easily be used both inside and outside of transactions.
 */
export interface Queryable {
  readonly sql: SQL;
  query(query: SQLQuery): Promise<any[]>;
  query(query: SQLQuery[]): Promise<any[][]>;
  queryStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
      batchSize?: number;
    },
  ): AsyncIterable<any>;
  /**
   * @deprecated use queryNodeStream
   */
  stream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
      batchSize?: number;
    },
  ): Readable;
  queryNodeStream(
    query: SQLQuery,
    options?: {
      highWaterMark?: number;
      batchSize?: number;
    },
  ): Readable;
  task<T>(
    fn: (connection: Task | Transaction) => Promise<T>,
    options?: {tag?: string | number},
  ): Promise<T>;
  tx<T>(
    fn: (connection: Transaction) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>;
}

/**
 * Will be deprecated in the next major version, use the "Queryable" type instead, eventually Connection will become an alias for "Task"
 */
export type Connection = Queryable;

/**
 * A "Transaction" on the database will be committed once
 * the async function returns, and will be aborted if any
 * queries fail or if the function throws an exception.
 */
export interface Transaction extends Queryable {
  readonly type: QueryableType.Transaction;
}

/**
 * A "Task" represents a single connection to the database,
 * although you can send queries in parallel, if they share
 * one "Task" they will actually be run one at a time on the
 * underlying database.
 *
 * Most of the time you can ignore these and just focus on
 * Transactions and ConnectionPools.
 */
export interface Task extends Queryable {
  readonly type: QueryableType.Connection;
}

/**
 * A "ConnectionPool" represents a collection of database
 * connections that are managed for you automatically. You can
 * query this directly without worrying about allocating connections.
 * You can also use a Transaction to provide better guarantees about
 * behaviour when running many operations in parallel.
 */
export interface ConnectionPool extends Queryable {
  readonly type: QueryableType.ConnectionPool;
  dispose(): Promise<void>;
  registerTypeParser<T>(
    type: number | string,
    parser: (value: string) => T,
  ): Promise<(value: string) => T>;
  getTypeParser(type: number | string): Promise<(value: string) => any>;
  /**
   * Parses an n-dimensional array
   *
   * @param value The string value from the database
   * @param entryParser A transform function to apply to each string
   */
  parseArray(value: string, entryParser?: (entry: string | null) => any): any[];
  /**
   * Parse a composite value and get a tuple of strings where
   * each string represents one attribute.
   *
   * @param value The raw string.
   */
  parseComposite(value: string): string[];
}

class ConnectionImplementation<TQueryableType extends QueryableType> {
  public readonly type: TQueryableType;
  public readonly sql = sql;
  protected connection: pg.IBaseProtocol<unknown>;
  constructor(connection: pg.IBaseProtocol<unknown>, type: TQueryableType) {
    this.connection = connection;
    this.type = type;
  }
  async query(query: SQLQuery): Promise<any[]>;
  async query(query: SQLQuery[]): Promise<any[][]>;
  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    if (Array.isArray(query)) {
      for (const el of query) {
        if (!isSqlQuery(el)) {
          throw new Error(
            'Invalid query, you must use @databases/sql to create your queries.',
          );
        }
      }
    } else if (!isSqlQuery(query)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const q = (Array.isArray(query) ? sql.join(query, sql`;`) : query).format(
      pgFormat,
    );
    try {
      return await (Array.isArray(query)
        ? this.connection.multi(q.text, q.values)
        : this.connection.query(q));
    } catch (ex) {
      if (isSQLError(ex) && ex.position) {
        const position = parseInt(ex.position, 10);
        const match =
          /syntax error at or near \"([^\"\n]+)\"/.exec(ex.message) ||
          /relation \"([^\"\n]+)\" does not exist/.exec(ex.message);
        let column = 0;
        let line = 1;
        for (let i = 0; i < position; i++) {
          if (q.text[i] === '\n') {
            line++;
            column = 0;
          } else {
            column++;
          }
        }

        const start = {line, column};
        let end: undefined | {line: number; column: number};
        if (match) {
          end = {line, column: column + match[1].length};
        }

        ex.message += `\n\n${codeFrameColumns(q.text, {start, end})}\n`;
      }
      throw ex;
    }
  }

  queryStream(
    query: SQLQuery,
    options: {
      highWaterMark?: number;
      batchSize?: number;
    } = {},
  ): AsyncIterableIterator<any> {
    const stream = this.queryNodeStream(query, options);
    return pushToAsyncIterable<any>({
      onData(fn) {
        stream.on('data', fn);
      },
      onError(fn) {
        stream.on('error', fn);
      },
      onEnd(fn) {
        stream.on('end', fn);
      },
      pause() {
        stream.pause();
      },
      resume() {
        stream.resume();
      },
      /**
       * Rely mainly on high water mark of the underlying node stream
       */
      highWaterMark: 2,
    });
  }
  /**
   * @deprecated use queryNodeStream
   */
  stream(
    query: SQLQuery,
    options: {
      highWaterMark?: number;
      batchSize?: number;
    } = {},
  ) {
    return this.queryNodeStream(query, options);
  }
  queryNodeStream(
    query: SQLQuery,
    options: {
      highWaterMark?: number;
      batchSize?: number;
    } = {},
  ): Readable {
    if (!isSqlQuery(query)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    const {text, values} = query.format(pgFormat);
    const qs = new QueryStream(text, values, options);
    const stream = new PassThrough({objectMode: true});
    this.connection
      .stream(qs, (results) => {
        results.pipe(stream);
        results.on('error', (err) => stream.emit('error', err));
      })
      .catch((err) => stream.emit('error', err));
    return stream;
  }
  async task<T>(
    fn: (connection: Task | Transaction) => Promise<T>,
    options?: {tag?: string | number},
  ): Promise<T> {
    const type =
      this.type === QueryableType.Transaction
        ? QueryableType.Transaction
        : QueryableType.Connection;
    if (options) {
      return await this.connection.task(options, (t) => {
        return fn(new ConnectionImplementation(t, type)) as any;
      });
    }
    return await this.connection.task((t) => {
      return fn(new ConnectionImplementation(t, type)) as any;
    });
  }
  async tx<T>(
    fn: (connection: Transaction) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    if (options) {
      const {tag, ...txMode} = options;
      const opts: {tag?: any; mode?: pg.TransactionMode} = {};
      if (tag) {
        opts.tag = tag;
      }
      if (Object.keys(txMode).length) {
        opts.mode = new pg.TransactionMode(
          txMode.isolationLevel,
          txMode.readOnly,
          txMode.deferrable,
        );
      }
      return await this.connection.tx(opts, (t) => {
        return fn(
          new ConnectionImplementation(t, QueryableType.Transaction),
        ) as any;
      });
    }
    return await this.connection.tx((t) => {
      return fn(
        new ConnectionImplementation(t, QueryableType.Transaction),
      ) as any;
    });
  }
}

class ConnectionPoolImplementation extends ConnectionImplementation<
  QueryableType.ConnectionPool
> {
  public readonly sql = sql;
  public readonly dispose: () => Promise<void>;
  private readonly pgp: pg.IMain;
  constructor(connection: pg.IDatabase<unknown>, pgp: pg.IMain) {
    super(connection, QueryableType.ConnectionPool);
    this.dispose = () => connection.$pool.end();
    this.pgp = pgp;
  }
  private async _getTypeID(type: number | string): Promise<number> {
    if (typeof type === 'number') {
      return type;
    }
    const ts = type.split('.');
    let results;
    if (ts.length === 1) {
      results = await this.query(sql`
        SELECT
          ty.oid as "typeID",
          ns.nspname AS "schemaName",
          ty.typname AS "typeName"
        FROM pg_catalog.pg_type ty
        INNER JOIN pg_catalog.pg_namespace ns
          ON (ty.typnamespace = ns.oid)
        WHERE lower(ty.typname) = ${type.toLowerCase()};
      `);
    } else if (ts.length === 2) {
      results = await this.query(sql`
        SELECT
          ty.oid as "typeID",
          ns.nspname AS "schemaName",
          ty.typname AS "typeName"
        FROM pg_catalog.pg_type ty
        INNER JOIN pg_catalog.pg_namespace ns
          ON (ty.typnamespace = ns.oid)
        WHERE lower(ty.typname) = ${ts[1].toLowerCase()} AND lower(ns.nspname) = ${ts[0].toLowerCase()};
      `);
    } else {
      throw new Error('Type Name should only have one "." in it');
    }
    if (results.length === 0) {
      throw new Error('Could not find the type ' + type);
    }
    if (results.length > 1) {
      throw new Error(
        'The type name ' +
          type +
          ' was found in multiple schemas: ' +
          results.map((r) => r.schemaName).join(', '),
      );
    }
    return results[0].typeID;
  }
  async registerTypeParser<T>(
    type: number | string,
    parser: (value: string) => T,
  ): Promise<(value: string) => T> {
    const typeID = await this._getTypeID(type);
    this.pgp.pg.types.setTypeParser(typeID, parser);
    return parser;
  }
  async getTypeParser(type: number | string): Promise<(value: string) => any> {
    const typeID = await this._getTypeID(type);
    return this.pgp.pg.types.getTypeParser(typeID);
  }
  /**
   * Parses an n-dimensional array
   *
   * @param value The string value from the database
   * @param entryParser A transform function to apply to each string
   */
  parseArray(
    value: string,
    entryParser?: (entry: string | null) => any,
  ): any[] {
    return (this.pgp.pg.types.arrayParser as any)
      .create(value, entryParser)
      .parse();
  }

  /**
   * Parse a composite value and get a tuple of strings where
   * each string represents one attribute.
   *
   * @param value The raw string.
   */
  parseComposite(value: string): string[] {
    if (value[0] !== '(') {
      throw new Error('composite values should start with (');
    }
    const values = [];
    let currentValue = '';
    let quoted = false;
    for (let i = 1; i < value.length; i++) {
      if (!quoted && value[i] === ',') {
        values.push(currentValue);
        currentValue = '';
        continue;
      } else if (!quoted && value[i] === ')') {
        values.push(currentValue);
        currentValue = '';
        if (i !== value.length - 1) {
          throw new Error('Got ")" before end of value');
        }
        continue;
      } else if (quoted && value[i] === '"') {
        if (value[i + 1] === '"') {
          // if the next value is also a quote, that means we
          // are looking at an escaped quote. Skip this char
          // and insert the quote
          i++;
        } else {
          quoted = false;
          continue;
        }
      } else if (value[i] === '"') {
        quoted = true;
        continue;
      }
      currentValue += value[i];
    }
    if (currentValue) {
      throw new Error('Got to end of value with no ")"');
    }
    return values;
  }
}

export function isConnectionPool(
  c: Queryable | Transaction | Task | ConnectionPool,
): c is ConnectionPool {
  return c instanceof ConnectionPoolImplementation;
}

export type ConnectionParamNames =
  | 'database'
  | 'user'
  | 'password'
  | 'port'
  | 'host'
  | 'ssl';
export const ConnectionParamNames = [
  'database',
  'user',
  'password',
  'port',
  'host',
  'ssl',
];

export type ConnectionParams = Pick<TConfig, ConnectionParamNames>;

export interface ConnectionOptions
  extends Pick<
    TConfig,
    Exclude<
      keyof TConfig,
      | ConnectionParamNames
      | 'connectionString'
      | 'poolSize'
      | 'max'
      | 'min'
      | 'reapIntervalMillis'
      | 'returnToHead'
      | 'poolLog'
    >
  > {
  /**
   * Disable the warning:
   *
   * Creating a duplicate database object for the same connection.
   */
  noDuplicateDatabaseObjectsWarning?: boolean;

  /**
   * By default, @databases/pg represents big ints as numbers,
   * and throws an error for numbers greater than Number.MAX_SAFE_INTEGER.
   *
   * Setting this option to `true` allows you to use strings,
   * which work for much larger numbers.
   */
  bigIntAsString?: boolean;

  /**
   * The maximum number of connections in the connection pool.
   * Defaults to 10.
   */
  poolSize?: number;

  /**
   * Redirects all query formatting to the pg driver.
   */
  pgFormatting?: boolean;

  /**
   * Use Native Bindings. Library pg-native must be
   * included and installed independently, or else
   * there will be an error thrown:
   * Failed to initialize Native Bindings.
   */
  pgNative?: boolean;

  /**
   * Overrides the default (ES6 Promise) promise library
   * for its internal use.
   */
  promiseLib?: any;

  /**
   * Prevents protocol locking.
   */
  noLocking?: boolean;

  /**
   * Capitalizes any SQL generated by pg-promise
   */
  capSQL?: boolean;

  /**
   * Forces change of the default database schema(s)
   * for every fresh connection, i.e. the library will
   * execute SET search_path TO schema_1, schema_2, ...
   * in the background whenever a fresh physical connection
   * is allocated.
   */
  schema?: string | ReadonlyArray<string>;

  /**
   * Disables all diagnostic warnings in the library (it is ill-advised).
   */
  noWarnings?: boolean;

  /**
   * [connect](http://vitaly-t.github.io/pg-promise/global.html#event:connect)
   * event handler.
   */
  connect?: IOptions<{}>['connect'];

  /**
   * [disconnect](http://vitaly-t.github.io/pg-promise/global.html#event:disconnect)
   * event handler.
   */
  disconnect?: IOptions<{}>['disconnect'];

  /**
   * [query](http://vitaly-t.github.io/pg-promise/global.html#event:query)
   * event handler.
   */
  query?: IOptions<{}>['query'];

  /**
   * [receive](http://vitaly-t.github.io/pg-promise/global.html#event:receive)
   * event handler.
   */
  receive?: IOptions<{}>['receive'];

  /**
   * [task](http://vitaly-t.github.io/pg-promise/global.html#event:task)
   * event handler.
   */
  task?: IOptions<{}>['task'];

  /**
   * [transact](http://vitaly-t.github.io/pg-promise/global.html#event:transact)
   * event handler.
   */
  transact?: IOptions<{}>['transact'];

  /**
   * [error](http://vitaly-t.github.io/pg-promise/global.html#event:error)
   * event handler.
   */
  error?: IOptions<{}>['error'];

  /**
   * [extend](http://vitaly-t.github.io/pg-promise/global.html#event:extend)
   * event handler.
   */
  extend?: IOptions<{}>['extend'];
}

const INIT_OPTIONS = new Set<keyof IOptions<{}>>([
  'pgFormatting',
  'pgNative',
  'promiseLib',
  'noLocking',
  'capSQL',
  'schema',
  'noWarnings',
  'connect',
  'disconnect',
  'query',
  'receive',
  'task',
  'transact',
  'error',
  'extend',
]);
function splitOptions(
  raw: ConnectionOptions,
): {
  noDuplicateDatabaseObjectsWarning: boolean;
  bigIntAsString: boolean;
  connectOptions: TConfig;
  initOptions: IOptions<{}>;
} {
  let noDuplicateDatabaseObjectsWarning = false;
  let bigIntAsString = false;
  const connectOptions: TConfig = {};
  const initOptions: IOptions<{}> = {};

  Object.keys(raw).forEach((key) => {
    if (key === 'noDuplicateDatabaseObjectsWarning') {
      noDuplicateDatabaseObjectsWarning =
        raw.noDuplicateDatabaseObjectsWarning || false;
    } else if (key === 'bigIntAsString') {
      bigIntAsString = raw.bigIntAsString || false;
    } else if (key === 'poolSize') {
      connectOptions.max = raw.poolSize;
    } else if (INIT_OPTIONS.has(key as keyof IOptions<{}>)) {
      initOptions[key as keyof IOptions<{}>] =
        raw[key as keyof ConnectionOptions];
    } else {
      connectOptions[key as keyof TConfig] =
        raw[key as keyof ConnectionOptions];
    }
  });

  return {
    noDuplicateDatabaseObjectsWarning,
    bigIntAsString,
    connectOptions,
    initOptions,
  };
}

export default function createConnection(
  connectionConfig: string | ConnectionParams | undefined = process.env[
    connectionStringEnvironmentVariable
  ],
  options: ConnectionOptions = {},
): ConnectionPool {
  if (!connectionConfig) {
    throw new Error(
      'You must provide a connection string for @databases/pg. You can ' +
        'either pass one directly to the createConnection call or set ' +
        `the ${connectionStringEnvironmentVariable} environment variable.`,
    );
  }

  let requireSslForConnectionString = false;
  if (typeof connectionConfig === 'string') {
    let url;
    try {
      url = new URL(connectionConfig);
      if (url.searchParams.get('sslmode') === 'require') {
        requireSslForConnectionString = true;
      }
    } catch (ex) {
      throw new Error(
        'Invalid Postgres connection string, expected a URI: ' +
          connectionConfig,
      );
    }
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
      throw new Error(
        'Invalid Postgres connection string, expected protocol to be "postgres": ' +
          connectionConfig,
      );
    }
  }

  if (typeof connectionConfig === 'object') {
    Object.keys(connectionConfig).forEach((key) => {
      if (!ConnectionParamNames.includes(key)) {
        throw new Error(`${key} is not a supported key for ConnectionConfig`);
      }
    });
  }

  const {
    noDuplicateDatabaseObjectsWarning,
    bigIntAsString,
    connectOptions,
    initOptions,
  } = splitOptions(options);

  const pgp = pg(initOptions);

  // By default we force BIG_INTEGER to return as a JavaScript number because
  // we never expect to handle integers larger than 2^52, but want to allow
  // numbers greater than 2^32 in the database

  if (!bigIntAsString) {
    // BIGINT -> INT
    const parseInteger = pgp.pg.types.getTypeParser(DataTypeID.int4);
    const MAX_SAFE_INTEGER = `${Number.MAX_SAFE_INTEGER}`;
    pgp.pg.types.setTypeParser(DataTypeID.int8, (str) => {
      if (
        (str && str.length > MAX_SAFE_INTEGER.length) ||
        (str.length === MAX_SAFE_INTEGER.length && str > MAX_SAFE_INTEGER)
      ) {
        throw new Error(
          `JavaScript cannot handle integers great than: ${Number.MAX_SAFE_INTEGER}`,
        );
      }
      return parseInteger(str);
    });

    // BIGINT ARRAY -> INT ARRAY
    const parseIntegerArray = pgp.pg.types.getTypeParser(DataTypeID.int4);
    pgp.pg.types.setTypeParser(DataTypeID._int8, (str) => {
      const result = parseIntegerArray(str);
      if (
        result &&
        result.some((val: number) => val && val > Number.MAX_SAFE_INTEGER)
      ) {
        throw new Error(
          `JavaScript cannot handle integers great than: ${Number.MAX_SAFE_INTEGER}`,
        );
      }
    });
  }

  const c =
    typeof connectionConfig === 'object'
      ? {...connectionConfig, ...connectOptions}
      : {
          connectionString: connectionConfig,
          ...(requireSslForConnectionString ? {ssl: true} : {}),
          ...connectOptions,
        };
  const connection = pgp(
    c,
    noDuplicateDatabaseObjectsWarning ? {v: Math.random()} : undefined,
  );

  return new ConnectionPoolImplementation(connection, pgp);
}

module.exports = Object.assign(createConnection, {
  sql,
  isSqlQuery,
  isSQLError,
  SQLErrorCode,
  DataTypeID,
  IsolationLevel,
  isConnectionPool,
});
