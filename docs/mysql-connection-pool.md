---
id: mysql-connection-pool
title: MySQL Node.js Connection Pool
sidebar_label: Connection Pool
---

A ConnectionPool represents a set of automatically managed physical connections to a database. All the methods on `Connection` are duplicated here for convenience, but they will each ultimately allocate a connection from the pool and then call the relevant method on that connection.

### `ConnectionPool.task<T>(fn: (db: Connection) => Promise<T>): Promise<T>`

Acquires a connection from the pool. If the pool is 'full' and all connections are currently checked out, this will wait in a FIFO queue until a connection becomes available by it being released back to the pool.

Once a connetion has been acquired, `fn` is called with that connection.

When `fn` returns, the connection is returned to the pool.

```ts
const result = await db.task(async (db) => {
  const resultA = await db.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await db.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

> N.B. this is not a transaction. If later statements fail, the earlier queries will already have taken effect. You can manulaly execute `BEGIN` and `COMMIT`/`ROLLBACK` SQL on the connection though, to impelement the transaction yourself.

### `ConnectionPool.tx(fn, options?): Promise<T>`

Acquires a connection from the pool (see `ConnectionPool.task`) and then executes the callback `fn` within a transaction on that connection.

A transaction wraps a regular task with 3 additional queries:

1. it executes `BEGIN` just before invoking the callback function
2. it executes `ROLLBACK`, if the callback throws an error or returns a rejected promise
3. it executes `COMMIT`, if the callback does throw any error and does not return a rejected promise

```ts
const result = await db.tx(async (db) => {
  const resultA = await db.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await db.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

Options:

| Name                     | Type      | <abbr title="Optional">Opt</abbr> | Description                                                      |
| ------------------------ | --------- | --------------------------------- | ---------------------------------------------------------------- |
| `readOnly`               | `boolean` | ✓                                 | Sets transaction access mode                                     |
| `withConsistentSnapshot` | `boolean` | ✓                                 | Causes readonly transactions to acquire a snapshot before running |

### `ConnectionPool.dispose(): Promise<void>`

Dispose the connection pool. Once this is called, any subsequent queries will fail.

### `ConnectionPool.query(SQLQuery | SQLQuery[]): Promise<any[]>`

This is a shorthand for getting a connection, and then calling `.query` on the connection. See [`Connection.query`](mysql-connection.md) for details.

### `ConnectionPool.queryStream(SQLQuery): AsyncIterable<any>`

This is a shorthand for getting a connection, and then calling `.queryStream` on the connection. See [`Connection.queryStream`](mysql-connection.md) for details.

### `ConnectionPool.queryNodeStream(SQLQuery): ReadableStream`

This is a shorthand for getting a connection, and then calling `.queryNodeStream` on the connection. See [`Connection.queryNodeStream`](mysql-connection.md) for details.
