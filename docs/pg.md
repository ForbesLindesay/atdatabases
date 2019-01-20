---
id: pg
title: Postgres
sidebar_label: Postgres
---

The `@databases/pg` library provides a safe and convenient API for querying postgres databases in node.js.

## Usage

```ts
import connect, {sql} from '@databases/pg';

const db = connect();

db.query(sql`SELECT * FROM users;`).then(
  results => console.log(results),
  err => console.error(err),
);
```

> For details on how to build queries, see [Building SQL Queries](sql.md)

## API

### ``` connect(connection, options) ```

Create a `ConnectionPool` for a given database. You should only create one ConnectionPool per database for your entire applicaiton. Normally this means having one module that creates and exports the connection pool.

You can pass two parameters to the `connect` function. The first is the connection string/details. It can be one of:

 * a connection string, e.g. `postgresql://my-user:my-password@localhost/my-db`
 * an object with `{database?: string, user?: string, password?: string, port?: number, host?: string, ssl?: boolean}`
 * if you don't provide a value, the `DATABASE_URL` environment variable is treated as a postgres connection string.

The second, `options` allows you to perform advanced customisation of the database connection. See [Postgres Options](pg-options.md)

The `ConnectionPool` inherits from `Connection`, so you call `ConnectionPool.query` directly instead of having to manually aquire a connection to run the query. If you intend to run a sequence of queries, it is generally better for performance to aquire a single connection for them, using `connectionPool.task` even if you do not want a transaction.

### ``` Conneciton.query(SQLQuery): Promise<any[]> ```

Run an SQL Query and get a promise for an array of results.

### ``` Connection.task(fn, options?): Promise<T> ```

Executes a callback function with automatically managed connection.

When invoked on the ConnectionPool, the method allocates the Connection from the pool, executes the callback, and once finished - releases the Connection back to the pool. However, when invoked inside another task or transaction, the method reuses the parent Connection.

This method should be used whenever executing more than one query at once, so the allocated connection is reused between all queries, and released only after the task has finished.

The callback is called with a single parameter, that is the database connection. The value returned by the function is then returned from the task call as a Promise.

```ts
const result = await db.task(async task => {
  const resultA = await task.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await task.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

> N.B. this is not a transaction. If later statements fail, the earlier queries will already have taken effect. You can manulaly execute `BEGIN` and `COMMIT`/`ROLLBACK` SQL on the connection though, to impelement the transaction yourself.

Options:

Name | Type | Optional | Description
-----|-------|---------|------------
`tag` | <code>string &#124; number</code> | ✓ | Traceable context for the task

### ``` Connection.tx(fn, options?): Promise<T> ```

Executes a callback function as a transaction, with automatically managed connection.

When invoked on the ConnectionPool object, the method allocates the Connection from the pool, executes the callback, and once finished - releases the connection back to the pool. However, when invoked inside another task or transaction, the method reuses the parent Connection.

A transaction wraps a regular task with additional queries:

1. it executes `BEGIN` just before invoking the callback function
2. it executes `COMMIT`, if the callback didn't throw any error or return a rejected promise
3. it executes `ROLLBACK`, if the callback did throw an error or return a rejected promise
4. it executes corresponding `SAVEPOINT` commands when the method is called recursively.

```ts
const result = await db.task(async task => {
  const resultA = await task.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await task.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

Options:

Name | Type | <abbr title="Optional">Opt</abbr> | Description
-----|-------|---------|------------
`tag` | <code>string &#124; number</code> | ✓ | Traceable context for the task
`isolationLevel` | `IsolationLevel` | ✓ | Transaction Isolation Level
`readOnly` | `boolean` | ✓ | Sets transaction access mode
`deferrable` | `boolean` | ✓ | Sets the transaction deferrable mode. It is only used when `isolationLevel` is `IsolationLevel.serializable` and `readOnly=true`

### IsolationLevel

```ts
import {IsolationLevel} from '@databases/pg';
```

The Isolation Level can be passed to `Connection.tx` as an option. It should be one of:

* `IsolationLeve.none`
* `IsolationLevel.serializable`
* `IsolationLevel.repeatableRead`
* `IsolationLevel.readCommitted`

### ``` ConnectionPool.dispose(): Promise<void> ```

Dispose the connection pool. Once this is called, any subsequent queries will fail.

### ``` ConnectionPool.registerTypeParser(type, parser) ``` / ``` ConnectionPool.getTypeParser(type) ``` / ``` ConnectionPool.parseArray(string, entryParser) ``` / ``` ConnectionPool.parseComposite(string) ```

See: [Custom Types](pg-custom-types.md)
