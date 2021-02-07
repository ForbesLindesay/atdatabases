---
id: pg-options
title: Postgres Connection Options
sidebar_label: Connection Options
---

- `connectionString` (`string | false`, default: `process.env.DATABASE_URL`) - Set this to `false` to disable all connection string & environment variable handling
- `user` (`string`, default: from connection string or `process.env.PGUSER`)
- `password` (`string`, default: from connection string or `process.env.PGPASSWORD`)
- `host` (`string | string[]`, default: from connection string or `process.env.PGHOST`) - if multiple hosts are specified, we will attempt to connect to each one in turn until a successful connection is made.
- `port` (`number | number[]`, default: from connection string or `process.env.PGPORT`) - if multiple ports are specified, there must be exactly the same number of ports as hosts, as each will be treated as a pair.
- `database` (`string`, default: from connection string or `process.env.PGDATABASE`)
- `ssl` (`boolean | 'disable' | 'prefer' | 'require' | 'no-verify' | ConnectionOptions`, default: from connection string or `process.env.PGSSL*`) - If this is not specified at all, this will default to 'prefer', which attempts to make a connection over SSL (without verifying certificates) and then retries without SSL if that fails.
- `schema` (`string | string[]`) - Forces change of the default database schema(s) for every fresh connection, i.e. the library will execute `SET search_path TO schema_1, schema_2, ...` in the background whenever a fresh physical connection is allocated.
- `bigIntMode` (`'string' | 'number' | 'bigint'`, default: `false`) - This option specifies how BigInts should be returned from postgres. All types are supported when writing to BigInt fields. `'string'` and `'bigint'` both support any value that can be contained in a postgres `BigInt` field. `'number'` is simpler to use, but will result in inaccurate values for very large numbers (greater than `Number.MAX_SAFE_INTEGER`). `'bigint'`s cannot be passed to `JSON.stringify`.
- `applicationName`/`fallbackApplicationName` (`string`) - useful for debugging/analytics on the database usage
- `poolSize` (`number`, default: `10`) - the maximum number of connections in the connection pool
- `maxUses` (`number`, default: `Infinity`) - the maximum number of times a connection can be returned from the connection pool before being closed and replaced with a fresh connection
- `statementTimeoutMilliseconds` (default: no timeout) - number of milliseconds before a statement in query will time out
- `queryTimeoutMilliseconds` (default: no timeout) - number of milliseconds before a query call will timeout
- `idleInTransactionSessionTimeoutMilliseconds` (`number`, default: no timeout) - number of milliseconds before terminating any session with an open idle transaction
- `idleTimeoutMilliseconds` (`number`, default: `30_000`ms) - max milliseconds a client can go unused before it is removed from the pool and destroyed
- `queueTimeoutMilliseconds` (`number`, default: `60_000`ms) - number of milliseconds to wait for a connection from the connection pool before throwing a timeout error
- `aquireLockTimeoutMilliseconds` (`number`, default: `60_000`ms) - Number of milliseconds to wait for a lock on a connection/transaction. This is helpful for catching cases where you have accidentally attempted to query a connection within a transaction that is on that connection, or attempted to query an outer transaction within a nested transaction

## Event Handlers

For more detail on how to use event handlers, see [Logging & Debugging](pg-guide-logging.md) - install `@databases/pg` and run your first query

- `onError(err: Error)` - called for global connection errors. e.g. when Postgres terminates a connection that is not currently in use
- `onQueryStart(query: SQLQuery, formatted: {text: string, values: unknown[]})` - called before executing a query
- `onQueryResults(query: SQLQuery, formatted: {text: string, values: unknown[]}, results: unknown[])` - called after a query succeeds
- `onQueryError(query: SQLQuery, formatted: {text: string, values: unknown[]}, err: Error)` - called when a query results in an Error
- `onConnectionOpened()` - called after a new connection is openned in the pool
- `onConnectionClosed()` - called after a connection is closed in the pool
