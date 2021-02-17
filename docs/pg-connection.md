---
id: pg-connection
title: Postgres Node.js Connection
sidebar_label: Connection
---

The `Connection` object represents a single physical connection to the underlying database. You can use it to execute queries, or start transactions. Only one query or transaction at a time can run on a single connection. If you need to run multiple queries in parallel, you will need to get multiple connections from the ConnectionPool.

### `Connection.query(SQLQuery): Promise<any[]>`

Run an SQL Query and get a promise for an array of results. If your query contains multiple statements, only the results of the final statement are returned.

```ts
const result = await task.query(sql`SELECT 1 + 1 AS a`);
result[0].a;
// => 2
```

### `Connection.query(SQLQuery[]): Promise<any[]>`

If you pass an array of SQLQueries, you will get an array in response where each element of the array is the results of one of the queries.

```ts
const [resultA, resultB] = await task.query([
  sql`SELECT 1 + 1 AS a`,
  sql`SELECT 1 + 1 AS b`,
]);
resultA[0].a + resultB[0].b;
// => 4
```

### `Connection.queryStream(SQLQuery): AsyncIterable<any>`

Run an SQL Query and get an async iterable of the results. e.g.

```js
for await (const record of db.queryStream(sql`SELECT * FROM massive_table`)) {
  console.log(result);
}
```

### `Connection.queryNodeStream(SQLQuery): ReadableStream`

Run an SQL Query and get a node.js readable stream of the results. e.g.

```js
const Stringifier = require('newline-json').Stringifier;

db.queryNodeStream(sql`SELECT * FROM massive_table`)
  .pipe(new Stringifier())
  .pipe(process.stdout);
```

### `Connection.tx<T>(fn: (tx: Transaction) => Promise<T>, options?): Promise<T>`

Executes the callback `fn` within a transaction on that connection.

A transaction wraps a regular task with 3 additional queries:

1. it executes `BEGIN` just before invoking the callback function
2. it executes `ROLLBACK`, if the callback throws an error or returns a rejected promise
3. it executes `COMMIT`, if the callback does throw any error and does not return a rejected promise

```ts
const result = await db.task(async (task) => {
  const resultA = await task.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await task.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

Options:

| Name             | Type             | <abbr title="Optional">Opt</abbr> | Description                                                                                                                      |
| ---------------- | ---------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `isolationLevel` | `IsolationLevel` | ✓                                 | Transaction Isolation Level                                                                                                      |
| `readOnly`       | `boolean`        | ✓                                 | Sets transaction access mode                                                                                                     |
| `deferrable`     | `boolean`        | ✓                                 | Sets the transaction deferrable mode. It is only used when `isolationLevel` is `IsolationLevel.serializable` and `readOnly=true` |

### `Connection.task(fn): Promise<T>`

This method exists to mimic the API in `ConnectionPool.task`. It does not allocate a fresh connection, and simply returns `fn(this)`.

### IsolationLevel

```ts
import {IsolationLevel} from '@databases/pg';
```

The Isolation Level can be passed to `Connection.tx` as an option. It should be one of:

- `IsolationLeve.none`
- `IsolationLevel.serializable`
- `IsolationLevel.repeatableRead`
- `IsolationLevel.readCommitted`
