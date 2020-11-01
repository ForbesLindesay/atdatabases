import parseConnectionString, {
  Configuration as ParsedConnectionString,
} from '@databases/pg-connection-string';
import {isSQLError, SQLError, SQLErrorCode} from '@databases/pg-errors';
import sql, {SQLQuery, isSqlQuery} from '@databases/sql';
import type {ConnectionOptions} from 'tls';
import DataTypeID from '@databases/pg-data-type-id';
import {getPgConfigSync} from '@databases/pg-config';
import ConnectionPool from './ConnectionPool';
import {readFileSync} from 'fs';
import TransactionIsolationLevel from './types/TransactionIsolationLevel';
import TypeOverrides from './TypeOverrides';

const {connectionStringEnvironmentVariable} = getPgConfigSync();

export type {SQLQuery, SQLError};
export {sql, isSqlQuery, isSQLError, SQLErrorCode, DataTypeID};

// TODO: not all of these options really make sense
export interface ClientConfig {
  bigIntMode?: 'string' | 'number' | 'bigint';
  /**
   * @deprecated use bigIntMode
   */
  bigIntAsString?: boolean;

  /**
   * Defaults to process.env.DATABASE_URL
   */
  connectionString?: string;

  /**
   * Application name to provide to postgres when connecting.
   * This can be useful when diagnosing performance issues on
   * the Postgres database server.
   *
   * Can also be specified via the connection string, or using
   * the "PGAPPNAME" environment variable.
   */
  applicationName?: string;

  /**
   * Fallback value to use as "applicationName" if no "applicationName"
   * was provided via the connection string or environment variables.
   */
  fallbackApplicationName?: string;

  user?: string;
  password?: string;
  host?: string | string[];
  database?: string;
  port?: number | (number | null)[];

  /**
   * SSL Mode, defaults to "prefer"
   *
   * false is equivalent to "disable"
   * true is equivalent to "require"
   */
  ssl?:
    | false
    | true
    | 'disable'
    | 'prefer'
    | 'require'
    | 'no-verify'
    | ConnectionOptions;

  // TODO: types

  /**
   * number of milliseconds before a statement in query will time out,
   *
   * default is no timeout
   */
  statementTimeoutMilliseconds?: number;

  /**
   * number of milliseconds before a query call will timeout,
   *
   * default is no timeout
   */
  queryTimeoutMilliseconds?: number;

  /**
   * number of milliseconds before terminating any session with
   * an open idle transaction,
   *
   * default is no timeout
   */
  idleInTransactionSessionTimeoutMilliseconds?: number;

  /**
   * Passed to `new Connection(...)`,
   * defaults to false
   */
  keepAlive?: boolean;

  /**
   * Passed to `new Connection(...)`,
   * defaults to 0
   */
  keepAliveInitialDelayMilliseconds?: number;

  /**
   * Maximum times to use a single connection from a connection pool before
   * discarding it and requesting a fresh connection.
   * defaults to Infinity
   */
  maxUses?: number;
}

export interface ConnectionPoolConfig extends ClientConfig {
  /**
   * maximum number of clients the pool should contain
   * by default this is set to 10.
   */
  poolSize?: number;

  /**
   * number of milliseconds a client must sit idle in the pool and not be checked out
   * before it is disconnected from the backend and discarded
   *
   * default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients
   */
  idleTimeoutMilliseconds?: number;

  /**
   * Number of milliseconds to wait before timing out when connecting a new client
   * by default this is 15 seconds. Set this to 0 to disable the timeout altogether.
   */
  connectionTimeoutMilliseconds?: number;
}

export default function createConnectionPool(
  connectionConfig: string | ConnectionPoolConfig | undefined = process.env[
    connectionStringEnvironmentVariable
  ],
) {
  if (!connectionConfig) {
    throw new Error(
      'You must provide a connection string for @databases/pg. You can ' +
        'either pass one directly to the createConnection call or set ' +
        `the ${connectionStringEnvironmentVariable} environment variable.`,
    );
  }
  const {connectionString = process.env[connectionStringEnvironmentVariable]} =
    typeof connectionConfig === 'object'
      ? connectionConfig
      : {connectionString: connectionConfig};
  const parsedConnectionString = parseConnectionString(connectionString);
  const {
    user = parsedConnectionString.user,
    password = parsedConnectionString.password,
    host = parsedConnectionString.host,
    database = parsedConnectionString.dbname,
    port = parsedConnectionString.port,
    connectionTimeoutMilliseconds = 15_000,
    idleTimeoutMilliseconds = 10_000,
    poolSize = 10,
    statementTimeoutMilliseconds = 0,
    queryTimeoutMilliseconds = 0,
    idleInTransactionSessionTimeoutMilliseconds = 0,
    applicationName = parsedConnectionString.application_name,
    keepAlive = false,
    keepAliveInitialDelayMilliseconds = 0,
    maxUses = Infinity,
    bigIntMode = null,
    // tslint:disable-next-line:deprecation
    bigIntAsString = false,
  } = typeof connectionConfig === 'object' ? connectionConfig : {};

  if (bigIntAsString) {
    console.warn(
      'bigIntAsString is deprecated and will be removed in the next major version of @databases/pg, use `bigIntMode: "string"` instead',
    );
  } else if (bigIntMode === null) {
    console.warn(
      'bigIntMode currently deafults to "number" but will default to "bigint" in the next major version of @databases/pg. Set it explicitly to disable this warning.',
    );
  }
  const types = new TypeOverrides({
    bigIntMode: bigIntMode ?? (bigIntAsString ? 'string' : 'number'),
  });
  const sslConfig = getSSLConfig(
    typeof connectionConfig === 'object' ? connectionConfig : {},
    parsedConnectionString,
  );

  const hostList = Array.isArray(host) ? host : [host];
  const portList = Array.isArray(port) ? port : [port];

  if (portList.length > 1 && hostList.length !== portList.length) {
    throw new Error(
      'If you provide more than port, you must provide exactly the same number of hosts and port',
    );
  }

  const pgOptions = {
    user,
    password,
    database,
    connectionTimeoutMillis: connectionTimeoutMilliseconds,
    idleTimeoutMillis: idleTimeoutMilliseconds,
    max: poolSize,
    ...(statementTimeoutMilliseconds
      ? {statement_timeout: statementTimeoutMilliseconds}
      : {}),
    ...(queryTimeoutMilliseconds
      ? {query_timeout: queryTimeoutMilliseconds}
      : {}),
    ...(idleInTransactionSessionTimeoutMilliseconds
      ? {
          idle_in_transaction_session_timeout: idleInTransactionSessionTimeoutMilliseconds,
        }
      : {}),
    application_name:
      applicationName ||
      (typeof connectionConfig === 'object' ? connectionConfig : {})
        .fallbackApplicationName ||
      parsedConnectionString.fallback_application_name,
    keepAlive,
    keepAliveInitialDelayMillis: keepAliveInitialDelayMilliseconds,
    maxUses,
    types,
  };

  return new ConnectionPool(
    pgOptions,
    (hostList.length === 0 ? ['localhost'] : hostList).map((host, i) => {
      const port =
        portList.length === 0
          ? undefined
          : portList.length === 1
          ? portList[0]
          : portList[i];
      return {
        host,
        port: port ?? undefined,
      };
    }),
    sslConfig,
  );
}

function getSSLConfig(
  config: ClientConfig,
  parsedConnectionString: ParsedConnectionString,
) {
  if (
    config.ssl === false ||
    config.ssl === 'disable' ||
    (!config.ssl && parsedConnectionString.sslmode === 'disable')
  ) {
    return null;
  }
  if (config.ssl && typeof config.ssl === 'object') {
    return {allowFallback: false, ssl: config.ssl};
  }

  const ssl: ConnectionOptions = {};
  if (parsedConnectionString.sslcert) {
    ssl.cert = readFileSync(parsedConnectionString.sslcert, 'utf8');
  }
  if (parsedConnectionString.sslkey) {
    ssl.key = readFileSync(parsedConnectionString.sslkey, 'utf8');
  }
  if (parsedConnectionString.sslrootcert) {
    ssl.ca = readFileSync(parsedConnectionString.sslrootcert, 'utf8');
  }
  if (
    config.ssl === 'no-verify' ||
    (parsedConnectionString.sslmode === 'no-verify' && !config.ssl)
  ) {
    ssl.rejectUnauthorized = false;
  }

  const mode = config.ssl || parsedConnectionString.sslmode;
  if (mode === 'prefer' || mode === undefined) {
    ssl.rejectUnauthorized = false;
    return {allowFallback: true, ssl};
  } else {
    return {allowFallback: false, ssl};
  }
}

module.exports = Object.assign(createConnectionPool, {
  default: createConnectionPool,
  sql,
  isSqlQuery,
  isSQLError,
  SQLErrorCode,
  DataTypeID,
  TransactionIsolationLevel,
  // isConnectionPool,
});

// interface UndocumentedPgOptions {
//   /**
//    * Use binary mode for pg communication,
//    * defaults to false
//    */
//   binary: boolean;
//   /**
//    * Override the "Promise" used within pg
//    */
//   Promise: typeof Promise;

//   /**
//    * Passed to `new ConnectionParameters(...)` and used in Client.getStartupConf()
//    * Defaults to fallback_application_name
//    */
//   application_name: string;
//   /**
//    * Passed to `new ConnectionParameters(...)` and used in Client.getStartupConf()
//    */
//   fallback_application_name: string;
//   /**
//    * Passed to `new ConnectionParameters(...)` and used in Client.getStartupConf()
//    *
//    * This changes the protocol that's used, which would almost certainly just break the library
//    */
//   replication: string;
//   /**
//    * Passed to `new ConnectionParameters(...)` and used in Client.getStartupConf()
//    *
//    * There's probably always a better option for how to set these options
//    */
//   options: string;

//   /**
//    * Passed to `new TypeOverrides(...)`
//    */
//   types: unknown;

//   /**
//    * Passed to `new Connection(...)`
//    */
//   stream: unknown;
//   /**
//    * Passed to `new Connection(...)` as "encoding",
//    * defaults to 'utf8'
//    */
//   client_encoding: boolean;
//   /**
//    * Passed to `new Connection(...)`,
//    * defaults to false
//    */
//   keepAlive: boolean;
//   /**
//    * Passed to `new Connection(...)`,
//    * defaults to 0
//    */
//   keepAliveInitialDelayMillis: number;

//   /**
//    * Passed to `new Pool(...)`,
//    * defaults to Infinity
//    */
//   maxUses: number;
//   /**
//    * Passed to `new Pool(...)`,
//    * defaults to Infinity
//    */
//   log: () => void;
//   /**
//    * Passed to `new Pool(...)`,
//    * Called on newly acquired clients to test that they are working before adding them to the pool.
//    */
//   verify: (client: Client, cb: (err?: Error | null) => void) => void;
// }
