---
id: pg-transaction
title: Postgres Transaction
sidebar_label: Transaction
---

The `Transaction` object represents a transaction happening on a single physical connection to the underlying database. You can use it to execute queries, or start "nested transactions". Depending on the `isolationLevel` you specified when creating the `Transaction`, you can get varying levels of guarantee about how well issolated your transactions are, but you can always guarantee that all your changes will either be "committed" or "rolled back" at the end. Your database will never be left in an inconsistent state.

### `Transaction.query(SQLQuery): Promise<any[]>`

Run an SQL Query and get a promise for an array of results. If your query contains multiple statements, only the results of the final statement are returned.

```ts
const result = await task.query(sql`SELECT 1 + 1 AS a`);
result[0].a;
// => 2
```

> N.B. if a query throws an error, that transaction will become unusable. If you need to run a query that might error (e.g. selecting from a table that may or may not exist), you can wrap the query in a nested transaction to keep the error localised.

### `Transaction.query(SQLQuery[]): Promise<any[]>`

If you pass an array of SQLQueries, they will be run as a single transaction and you will get an array in response where each element of the array is the results of one of the queries.

```ts
const [resultA, resultB] = await task.query([
  sql`SELECT 1 + 1 AS a`,
  sql`SELECT 1 + 1 AS b`,
]);
resultA[0].a + resultB[0].b;
// => 4
```

### `Transaction.queryStream(SQLQuery): AsyncIterable<any>`

Run an SQL Query and get an async iterable of the results. e.g.

```js
for await (const record of db.queryStream(sql`SELECT * FROM massive_table`)) {
  console.log(result);
}
```

### `Transaction.queryNodeStream(SQLQuery): ReadableStream`

Run an SQL Query and get a node.js readable stream of the results. e.g.

```js
const Stringifier = require('newline-json').Stringifier;

db.queryNodeStream(sql`SELECT * FROM massive_table`)
  .pipe(new Stringifier())
  .pipe(process.stdout);
```

### `Transaction.tx<T>(fn: (tx: Transaction) => Promise<T>, options?): Promise<T>`

Executes the callback `fn` within a "nested transaction" on that connection.

A nested transaction wraps a regular transaction with 3 additional queries:

1. it executes `SAVEPOINT unique_id` just before invoking the callback function
2. it executes `ROLLBACK TO SAVEPOINT unique_id`, if the callback throws an error or returns a rejected promise
3. it executes `RELEASE SAVEPOINT unique_id`, if the callback does throw any error and does not return a rejected promise

```ts
const result = await db.task(async (db) => {
  const resultA = await db.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await db.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

### `Transaction.task(fn): Promise<T>`

This method exists to mimic the API in `ConnectionPool.task`. It does not allocate a fresh connection or transaction, and simply returns `fn(this)`.
