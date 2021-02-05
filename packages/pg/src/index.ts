/* tslint:disable:no-unnecessary-initializer */

import {readFileSync} from 'fs';
import type {ConnectionOptions} from 'tls';
import {QueryableType} from '@databases/shared';
import parseConnectionString, {
  Configuration as ParsedConnectionString,
} from '@databases/pg-connection-string';
import DataTypeID from '@databases/pg-data-type-id';
import {isSQLError, SQLError, SQLErrorCode} from '@databases/pg-errors';
import sql, {SQLQuery, isSqlQuery} from '@databases/sql';
import {getPgConfigSync} from '@databases/pg-config';
import ConnectionPoolImplementation from './ConnectionPool';
import IsolationLevel from './types/IsolationLevel';
import Queryable, {
  Transaction,
  Connection,
  ConnectionPool,
  isTransaction,
  isConnection,
  isConnectionPool,
} from './types/Queryable';
import TypeOverrides, {TypeOverridesConfig} from './TypeOverrides';
import EventHandlers from './types/EventHandlers';
import {PgOptions} from './ConnectionSource';

const {connectionStringEnvironmentVariable} = getPgConfigSync();

export type {
  SQLQuery,
  SQLError,
  Queryable,
  Transaction,
  Connection,
  ConnectionPool,
};
export {
  sql,
  isSqlQuery,
  isSQLError,
  SQLErrorCode,
  DataTypeID,
  QueryableType,
  IsolationLevel,
  isTransaction,
  isConnection,
  isConnectionPool,
};

export interface ClientConfig {
  /**
   * How would you like bigints to be returned from the database?
   *
   * If you choose `number` you may get inexact values for numbers greater than Number.MAX_SAFE_INTEGER
   */
  bigIntMode?: 'string' | 'number' | 'bigint';
  /**
   * @deprecated use bigIntMode
   */
  bigIntAsString?: boolean;

  types?: TypeOverridesConfig['overrides'];

  /**
   * Defaults to process.env.DATABASE_URL
   */
  connectionString?: string | false;

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
   * Forces change of the default database schema(s) for every fresh
   * connection, i.e. the library will execute SET search_path TO schema_1, schema_2, ...
   * in the background whenever a fresh physical connection is allocated.
   */
  schema?: string | string[];

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

export interface ConnectionPoolConfig extends ClientConfig, EventHandlers {
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
   * by default this is 10 seconds. Set this to 0 to disable the timeout altogether.
   *
   * N.B. if you have multiple hosts, or an SSL mode of "prefer" (which is the default),
   * this will be the timeout per attempt, meaning the total timeout is this value,
   * multiplied by the number of possible connetion details to attempt.
   */
  connectionTimeoutMilliseconds?: number;

  onError?: (err: Error) => void;
}

export default function createConnectionPool(
  connectionConfig: string | ConnectionPoolConfig | undefined = process.env[
    connectionStringEnvironmentVariable
  ],
): ConnectionPool {
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
  const parsedConnectionString = parseConnectionString(
    connectionString || undefined,
  );
  const {
    user = parsedConnectionString.user,
    password = parsedConnectionString.password,
    host = parsedConnectionString.host,
    database = parsedConnectionString.dbname,
    port = parsedConnectionString.port,
    connectionTimeoutMilliseconds = 10_000,
    idleTimeoutMilliseconds = 30_000,
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
    schema = null,
    types: typeOverrides = null,
    onError = (err: Error) => {
      // It's common for connections to be terminated "unexpectedly"
      // If it happens on a connection that is actively in use, you'll get the error
      // anyway when you attempt to query it. If it happens on a connection that is
      // idle in the pool, a fresh connection will be allocated without you needing
      // to do anything.
      if (!/connection\s*terminated\s*unexpectedly/i.test(err.message)) {
        console.warn(`Error in Postgres ConnectionPool: ${err.message}`);
      }
    },
    onQueryError = undefined,
    onQueryResults = undefined,
    onQueryStart = undefined,
    onConnectionOpened = undefined,
    onConnectionClosed = undefined,
  } = typeof connectionConfig === 'object' ? connectionConfig : {};

  if (bigIntAsString) {
    console.warn(
      'bigIntAsString is deprecated and will be removed in the next major version of @databases/pg, use `bigIntMode: "string"` instead',
    );
  } else if (bigIntMode === null) {
    console.warn(
      'bigIntMode currently defaults to "number" but will default to "bigint" in the next major version of @databases/pg. Set it explicitly to disable this warning.',
    );
  }
  const types = new TypeOverrides({
    bigIntMode: bigIntMode ?? (bigIntAsString ? 'string' : 'number'),
    overrides: typeOverrides ?? undefined,
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

  const pgOptions: PgOptions = {
    user,
    password,
    database,
    connectionTimeoutMillis: connectionTimeoutMilliseconds,
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
    types,

    hosts: (hostList.length === 0 ? ['localhost'] : hostList).map((host, i) => {
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
    ssl: sslConfig,
  };

  return new ConnectionPoolImplementation(pgOptions, {
    poolOptions: {
      maxSize: poolSize,
      maxUses,
      idleTimeoutMilliseconds,
      // queueTimeoutMilliseconds: 1000, //connectionTimeoutMilliseconds,
      // releaseTimeoutMilliseconds: 1000,
    },
    schema: schema ?? undefined,
    handlers: {
      onError,
      onQueryStart,
      onQueryResults,
      onQueryError,
      onConnectionOpened,
      onConnectionClosed,
    },
  });
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
    return {allowFallback: false, connectionOptions: config.ssl};
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
    (!config.ssl && parsedConnectionString.sslmode === 'no-verify') ||
    !(
      parsedConnectionString.sslcert ||
      parsedConnectionString.sslkey ||
      parsedConnectionString.sslrootcert
    )
  ) {
    ssl.rejectUnauthorized = false;
  }

  const mode = config.ssl || parsedConnectionString.sslmode;
  if (mode === 'prefer' || mode === undefined) {
    ssl.rejectUnauthorized = false;
    return {allowFallback: true, connectionOptions: ssl};
  } else {
    return {allowFallback: false, connectionOptions: ssl};
  }
}

module.exports = Object.assign(createConnectionPool, {
  default: createConnectionPool,
  sql,
  isSqlQuery,
  isSQLError,
  SQLErrorCode,
  DataTypeID,
  IsolationLevel,
  QueryableType,
  isTransaction,
  isConnection,
  isConnectionPool,
});
