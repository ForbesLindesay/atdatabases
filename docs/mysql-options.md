---
id: mysql-options
title: MySQL Connection Options
sidebar_label: Connection Options
---

- `connectionString` (`string | false`, default: `process.env.DATABASE_URL`)
- `bigIntMode` (`'string' | 'number' | 'bigint'`, default: `'number'`) - This option specifies how BigInts should be returned from MySQL. All types are supported when writing to BigInt fields. `'string'` and `'bigint'` both support any value that can be contained in a MySQL `BigInt` field. `'number'` is simpler to use, but will result in inaccurate values for very large numbers (greater than `Number.MAX_SAFE_INTEGER`). `'bigint'`s cannot be passed to `JSON.stringify`.
- `poolSize` (`number`, default: `10`) - the maximum number of connections in the connection pool
- `maxUses` (`number`, default: `Infinity`) - the maximum number of times a connection can be returned from the connection pool before being closed and replaced with a fresh connection
- `idleTimeoutMilliseconds` (`number`, default: `30_000`ms) - max milliseconds a client can go unused before it is removed from the pool and destroyed
- `queueTimeoutMilliseconds` (`number`, default: `60_000`ms) - number of milliseconds to wait for a connection from the connection pool before throwing a timeout error
- `acquireLockTimeoutMilliseconds` (`number`, default: `60_000`ms) - Number of milliseconds to wait for a lock on a connection/transaction. This is helpful for catching cases where you have accidentally attempted to query a connection within a transaction that is on that connection, or attempted to query an outer transaction within a nested transaction

## Event Handlers

For more detail on how to use event handlers, see [Logging & Debugging](pg-guide-logging.md) - install `@databases/pg` and run your first query

- `onError(err: Error)` - called for global connection errors. e.g. when MySQL terminates a connection that is not currently in use
- `onQueryStart(query: SQLQuery, formatted: {text: string, values: unknown[]})` - called before executing a query
- `onQueryResults(query: SQLQuery, formatted: {text: string, values: unknown[]}, results: unknown[])` - called after a query succeeds
- `onQueryError(query: SQLQuery, formatted: {text: string, values: unknown[]}, err: Error)` - called when a query results in an Error
- `onConnectionOpened()` - called after a new connection is openned in the pool
- `onConnectionClosed()` - called after a connection is closed in the pool
