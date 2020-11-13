---
id: pg-queryable
title: Postgres Queryable
sidebar_label: Queryable
---

There are three types of `Queryable` in postgres:

- `ConnectionPool` - represents a set of automatically managed connections to the database
- `Connection` - represents a single physical connection to the database
- `Transaction` - represents a transaction (or nested transaction) on a single physical connection to the database

All three share a common API, allowing you to write methods that can be used both inside and outside a transaction. e.g.

```ts
import {Queryable} from '@databases/pg';

async function getUser(id: number, db: Queryable) {
  const users = await db.query(sql`SELECT * FROM users WHERE id=${id}`);
  return users[0];
}

const user = await getUser(id, connectionPool);
// or
connectionPool.tx(async (transaction) => {
  const user = await getUser(id, transaction);
});
```

### `Queryable.query(SQLQuery): Promise<any[]>`

Run an SQL Query and get a promise for an array of results. If your query contains multiple statements, only the results of the final statement are returned.

```ts
const result = await task.query(sql`SELECT 1 + 1 AS a`);
result[0].a;
// => 2
```

### `Queryable.query(SQLQuery[]): Promise<any[]>`

If you pass an array of SQLQueries, they will be run as a single transaction and you will get an array in response where each element of the array is the results of one of the queries.

```ts
const [resultA, resultB] = await task.query([
  sql`SELECT 1 + 1 AS a`,
  sql`SELECT 1 + 1 AS b`,
]);
resultA[0].a + resultB[0].b;
// => 4
```

### `Queryable.queryStream(SQLQuery): AsyncIterable<any>`

Run an SQL Query and get an async iterable of the results. e.g.

```js
for await (const record of db.queryStream(sql`SELECT * FROM massive_table`)) {
  console.log(result);
}
```

### `Queryable.queryNodeStream(SQLQuery): ReadableStream`

Run an SQL Query and get a node.js readable stream of the results. e.g.

```js
const Stringifier = require('newline-json').Stringifier;

db.queryNodeStream(sql`SELECT * FROM massive_table`)
  .pipe(new Stringifier())
  .pipe(process.stdout);
```

### `Queryable.tx<T>(fn: (tx: Transaction) => Promise<T>, options?): Promise<T>`

Executes the callback `fn` within a transaction on that connection.

If the `Queryable` is already a `Transaction`, this will use "savepoints" to create a nested transaction (and any options will be ignored).

If the `Queryable` is a `Connection` or `ConnectionPool`, this will create a true transaction, with the requested isolation level.

### `Queryable.task(fn): Promise<T>`

If the `Queryable` is a `ConnectionPool`, this will allocate a connection for the duration of the callback function.

If the `Queryable` is already a `Connection` or `Transaction`, this will simply call the callaback with the existing connection.
