import {URL} from 'url';
import {getMySqlConfigSync} from '@databases/mysql-config';
import sql, {SQLQuery, isSqlQuery} from '@databases/sql';
import Queryable, {
  Connection,
  ConnectionPool,
  Transaction,
} from './types/Queryable';
import ConnectionPoolImplemenation from './ConnectionPool';
import EventHandlers from './types/EventHandlers';

export type {SQLQuery};
export {sql, isSqlQuery};

export type {Queryable, Transaction, Connection, ConnectionPool};

const {connectionStringEnvironmentVariable} = getMySqlConfigSync();

export interface ConnectionPoolConfig extends EventHandlers {
  /**
   * Should the `TINYINT` type be treated as a boolean or a number?
   *
   * MySQL doesn't have a true boolean type, so when you create a column
   * of type `BOOLEAN` or `BOOL` you actually get a column of type
   * `TINYINT(1)`. It is possible to use this to store other numbers
   * (in the range 0-255).
   *
   * If you use `boolean` mode, all values other than "0" are interpreted
   * as `true`, and "0" is interpreted as `false`. This matches the behaviour
   * of MySQL queries that use `value IS TRUE` or `value IS NOT TRUE`.
   *
   * See https://www.mysqltutorial.org/mysql-boolean/ for details.
   */
  tinyIntMode?: 'boolean' | 'number';

  /**
   * How would you like bigints to be returned from the database?
   *
   * If you choose `number` you may get inexact values for numbers greater than Number.MAX_SAFE_INTEGER
   *
   * Currently defaults to 'number', but this may change in a future version
   */
  bigIntMode?: 'string' | 'number' | 'bigint';

  /**
   * How would you like `DATE` types to be returned from the database?
   *
   * If you choose 'date-object' it will be a JavaScript `Date` that is
   * midnight in the client `timeZone`.
   *
   * Currently this defaults to `'date-object'` but the default will
   * change to `'string'` in a future version.
   */
  dateMode?: 'string' | 'date-object';

  /**
   * How would you like `DATETIME` types to be returned from the database?
   *
   * If you choose 'date-object' it will be a JavaScript `Date`.
   * If you choose 'string' it will be a string in the MySQL format, i.e. "yyyy-mm-dd HH:MM:SS[.nnnnnn]" with no time zone
   *
   * Currently this defaults to `'date-object'`.
   */
  dateTimeMode?: 'string' | 'date-object';
  /**
   * How would you like `TIMESTAMP` types to be returned from the database?
   *
   * If you choose 'date-object' it will be a JavaScript `Date`.
   * If you choose 'string' it will be a string in the MySQL format, i.e. "yyyy-mm-dd HH:MM:SS[.nnnnnn]" with no time zone
   *
   * Currently this defaults to `'date-object'`.
   */
  timeStampMode?: 'string' | 'date-object';

  /**
   * Time zone to use when serializing and parsing
   */
  timeZone?:
    | 'local'
    | 'utc'
    | {
        server?: 'local' | 'utc';
        client: 'local' | 'utc';
      };

  /**
   * Defaults to process.env.DATABASE_URL
   */
  connectionString?: string;

  /**
   * maximum number of clients the pool should contain
   * by default this is set to 10.
   */
  poolSize?: number;

  /**
   * Maximum times to use a single connection from a connection pool before
   * discarding it and requesting a fresh connection.
   * defaults to Infinity
   */
  maxUses?: number;

  /**
   * number of milliseconds a client must sit idle in the pool and not be checked out
   * before it is disconnected from the backend and discarded
   *
   * default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients
   */
  idleTimeoutMilliseconds?: number;

  /**
   * Number of milliseconds to wait for a connection from the connection pool.
   *
   * Defaults to 60 seconds
   */
  queueTimeoutMilliseconds?: number;

  /**
   * Number of milliseconds to wait for a lock on a connection/transaction. This is
   * helpful for catching cases where you have accidentally attempted to query a connection
   * within a transaction that is on that connection, or attempted to query an outer transaction
   * within a nested transaction.
   *
   * Defaults to 60 seconds
   */
  aquireLockTimeoutMilliseconds?: number;

  onError?: (err: Error) => void;
}
export default function createConnectionPool(
  connectionConfig: string | ConnectionPoolConfig | undefined = process.env[
    connectionStringEnvironmentVariable
  ],
): ConnectionPool {
  const connectionConfigObject: ConnectionPoolConfig =
    typeof connectionConfig === 'object'
      ? connectionConfig
      : {connectionString: connectionConfig};

  const {
    connectionString = process.env[connectionStringEnvironmentVariable],
  } = connectionConfigObject;

  if (!connectionString) {
    throw new Error(
      'You must provide a connection string for @databases/mysql. You can ' +
        'either pass one directly to the createConnection call or set ' +
        `the ${connectionStringEnvironmentVariable} environment variable.`,
    );
  }
  validateMySqlUrl(connectionString);

  const {
    tinyIntMode = 'number',
    bigIntMode = 'number',
    dateMode = 'date-object',
    dateTimeMode = 'date-object',
    timeStampMode = 'date-object',
    timeZone = {client: 'local'},
    poolSize = 10,
    maxUses = Infinity,
    idleTimeoutMilliseconds = 10_000,
    queueTimeoutMilliseconds = 60_000,
    aquireLockTimeoutMilliseconds = 60_000,
    onConnectionClosed,
    onConnectionOpened,
    onQueryStart,
    onQueryResults,
    onQueryError,
    onError = (err: Error) => {
      console.warn(`Error in MySQL ConnectionPool: ${err.message}`);
    },
  } = connectionConfigObject;

  const serverTimeZone =
    typeof timeZone === 'string' ? timeZone : timeZone.server;
  const clientTimeZone =
    typeof timeZone === 'string' ? timeZone : timeZone.client;

  const tinyIntParser = getTinyIntParser(tinyIntMode);
  const bigIntParser = getBigIntParser(bigIntMode);
  const dateParer = getDateParser(dateMode, clientTimeZone);
  const dateTimeParser = getDateTimeParser(dateTimeMode, clientTimeZone);
  const timeStampParser = getDateTimeParser(timeStampMode, clientTimeZone);
  return new ConnectionPoolImplemenation(
    {
      uri: connectionString,
      multipleStatements: true,
      timezone: clientTimeZone === 'utc' ? 'Z' : clientTimeZone,
      typeCast: (field, next) => {
        switch (field.type) {
          case 'TINY':
            return tinyIntParser(field);
          case 'LONGLONG':
            return bigIntParser(field);
          case 'DATE':
            return dateParer(field);
          case 'DATETIME':
            return dateTimeParser(field);
          case 'TIMESTAMP':
            return timeStampParser(field);
        }
        return next();
      },
    },
    {
      maxSize: poolSize,
      maxUses,
      idleTimeoutMilliseconds,
      queueTimeoutMilliseconds,
    },
    {
      onConnectionClosed,
      onConnectionOpened,
      onQueryStart,
      onQueryResults,
      onQueryError,
    },
    onError,
    aquireLockTimeoutMilliseconds,
    serverTimeZone,
  );
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

function getTinyIntParser(
  mode: 'boolean' | 'number',
): (f: {string(): string}) => any {
  switch (mode) {
    case 'number':
      return (f) => parseInt(f.string(), 10);
    case 'boolean':
      return (f) => f.string() !== '0';
  }
}
function getBigIntParser(
  mode: 'string' | 'number' | 'bigint',
): (f: {string(): string}) => any {
  switch (mode) {
    case 'number':
      return (f) => parseInt(f.string(), 10);
    case 'string':
      return (f) => f.string();
    case 'bigint':
      return (f) => BigInt(f.string());
  }
}
function getDateParser(
  mode: 'string' | 'date-object',
  timeZone: 'local' | 'utc',
): (f: {string(): string}) => any {
  switch (mode) {
    case 'string':
      return (f) => f.string();
    case 'date-object':
      return (f) => {
        const match = /^(\d{4})\-(\d{2})\-(\d{2})$/.exec(f.string());
        if (!match) {
          throw new Error('Expected yyyy-mm-dd');
        }
        if (timeZone === 'utc') {
          return new Date(
            Date.UTC(
              parseInt(match[1], 10),
              parseInt(match[2], 10) - 1,
              parseInt(match[3], 10),
              0,
              0,
              0,
              0,
            ),
          );
        } else {
          return new Date(
            parseInt(match[1], 10),
            parseInt(match[2], 10) - 1,
            parseInt(match[3], 10),
            0,
            0,
            0,
            0,
          );
        }
      };
  }
}
function getDateTimeParser(
  mode: 'string' | 'date-object',
  timeZone: 'local' | 'utc',
): (f: {string(): string}) => any {
  switch (mode) {
    case 'string':
      return (f) => f.string();
    case 'date-object':
      return (f) => {
        const match = /^(\d{4})\-(\d{2})\-(\d{2}) (\d{2})\:(\d{2})\:(\d{2})(?:\.(\d+))?$/.exec(
          f.string(),
        );
        if (!match) {
          throw new Error('Expected yyyy-mm-dd HH:MM:SS');
        }
        let ms = match[7]
          ? parseInt(match[7].length > 3 ? match[7].substr(0, 3) : match[7], 10)
          : 0;
        if (match[7]?.length === 2) {
          ms = ms * 10;
        }
        if (match[7]?.length === 1) {
          ms = ms * 100;
        }
        if (timeZone === 'utc') {
          return new Date(
            Date.UTC(
              parseInt(match[1], 10),
              parseInt(match[2], 10) - 1,
              parseInt(match[3], 10),
              parseInt(match[4], 10), // hours
              parseInt(match[5], 10), // minutes
              parseInt(match[6], 10), // seconds
              ms,
            ),
          );
        } else {
          return new Date(
            parseInt(match[1], 10),
            parseInt(match[2], 10) - 1,
            parseInt(match[3], 10),
            parseInt(match[4], 10), // hours
            parseInt(match[5], 10), // minutes
            parseInt(match[6], 10), // seconds
            ms,
          );
        }
      };
  }
}

module.exports = Object.assign(createConnectionPool, {
  default: createConnectionPool,
  sql,
  isSqlQuery,
});
