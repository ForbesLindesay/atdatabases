---
id: pg-cluster
title: Postgres Node.js Cluster Connection
sidebar_label: Cluster
---

The `Cluster` object represents group of physical connections or connection pools to the underlying database in a primary & replicas setup.

### `Cluster.query(SQLQuery): Promise<any[]>`

Run an SQL Query and get a promise for an array of results. If your query contains multiple statements, only the results of the final statement are returned.

Write queries are executed in the primary connection, and read-only queries are executed in the replica connections.

```ts
// query executed on the primary connection
const result = await cluster.query(sql`SELECT 1 + 1 AS a`);
result[0].a;
// => 2

// query executed on the replica connection
await cluster.query(sql`UPDATE users SET active = true`);
```

### `Cluster.query(SQLQuery[]): Promise<any[]>`

If you pass an array of SQLQueries, you will get an array in response where each element of the array is the results of one of the queries.

If there is at least one write query in the argument list, then the queries are executed in the primary connection, otherwise in the replica connections.

```ts
// query executed on the replica connection
const [resultA, resultB] = await cluster.query([
  sql`SELECT 1 + 1 AS a`,
  sql`SELECT 1 + 1 AS b`,
]);
resultA[0].a + resultB[0].b;
// => 4
```

### `Cluster.queryStream(SQLQuery): AsyncIterable<any>`

Run an SQL Query and get an async iterable of the results. e.g.

```js
for await (const record of cluster.queryStream(
  sql`SELECT * FROM massive_table`,
)) {
  console.log(result);
}
```

Write queries are executed in the primary connection, and read-only queries are executed in the replica connections.

### `Cluster.queryNodeStream(SQLQuery): ReadableStream`

Run an SQL Query and get a node.js readable stream of the results. e.g.

```js
const Stringifier = require('newline-json').Stringifier;

cluster
  .queryNodeStream(sql`SELECT * FROM massive_table`)
  .pipe(new Stringifier())
  .pipe(process.stdout);
```

Write queries are executed in the primary connection, and read-only queries are executed in the replica connections.

### `Cluster.tx<T>(fn: (tx: Transaction) => Promise<T>, options?): Promise<T>`

Executes the callback `fn` within a transaction on the primary connection or replica connections (depending on `options.readOnly`).

A transaction wraps a regular task with 3 additional queries:

1. it executes `BEGIN` just before invoking the callback function
2. it executes `ROLLBACK`, if the callback throws an error or returns a rejected promise
3. it executes `COMMIT`, if the callback does throw any error and does not return a rejected promise

```ts
// transaction executed on the replica connection
const result = await cluster.tx(async (tx) => {
  const resultA = await tx.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await tx.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
}, {readOnly: true});

// transaction executed on the primary connection
const resultPrimary = await cluster.tx(async (tx) => {
  const resultA = await tx.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await tx.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

### `Cluster.task(fn): Promise<T>`

This method exists to mimic the API in `ConnectionPool.task`. It executes the `task` method on the primary connection.
