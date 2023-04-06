---
id: sqlite-pool
title: SQLite Pool
sidebar_label: Asynchronous API (based on better-sqlite3)
---

The `@databases/sqlite-pool` library provides an asynchronous, safe and convenient
API for querying SQLite databases in node.js. Built on top of
[better-sqlite3](https://www.npmjs.com/package/better-sqlite3).

N.B. you should only have one process createConnectionPooled to a given SQLite database at a time.

## Usage

```typescript
import createConnectionPool, {sql} from '@databases/sqlite-pool';
// or in CommonJS:
// const createConnectionPool = require('@databases/sqlite-pool');
// const {sql} = require('@databases/sqlite-pool');

const db = createConnectionPool();

db.query(sql`SELECT * FROM users;`).then(
  (results) => console.log(results),
  (err) => console.error(err),
);
```

```javascript
const createConnectionPool = require('@databases/sqlite-pool');
const {sql} = require('@databases/sqlite-pool');

const db = createConnectionPool();

db.query(sql`SELECT * FROM users;`).then(
  (results) => console.log(results),
  (err) => console.error(err),
);
```

> For details on how to build queries, see [Building SQL Queries](sql.md)

## API

### `createConnectionPool(fileName)`

Create a database createConnectionPoolion for a given database. You should only create one createConnectionPoolion per database for your entire applicaiton. Normally this means having one module that creates and exports the createConnectionPoolion pool.

In memory:

```ts
import createConnectionPool from '@databases/sqlite-pool';

const db = createConnectionPool();
```

File system:

```ts
import createConnectionPool from '@databases/sqlite-pool';

const db = createConnectionPool(FILE_NAME);
```

The `DatabaseConnection` inherits from `DatabaseTransaction`, so you call `DatabaseConnection.query` directly instead of having to create a transaction for every query. Since SQLite has very limited support for actual transactions, we only support running one transaction at a time, but multiple queries can be run in parallel. You should therefore only use transactions when you actually need them.

### `DatabaseConnection.query(SQLQuery): Promise<any[]>`

Run an SQL Query and get a promise for an array of results.

### `DatabaseConnection.queryStream(SQLQuery): AsyncIterable<any>`

Run an SQL Query and get an async iterable of the results. e.g.

```js
for await (const record of db.queryStream(sql`SELECT * FROM massive_table`)) {
  console.log(result);
}
```

### `DatabaseConnection.tx(fn): Promise<T>`

Executes a callback function as a transaction, with automatically managed createConnectionPoolion.

A transaction wraps a regular task with additional queries:

1. it executes `BEGIN` just before invoking the callback function
2. it executes `COMMIT`, if the callback didn't throw any error or return a rejected promise
3. it executes `ROLLBACK`, if the callback did throw an error or return a rejected promise

```ts
const result = await db.tx(async (transaction) => {
  const resultA = await transaction.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await transaction.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

### `DatabaseConnection.dispose(): Promise<void>`

Dispose the DatabaseConnection. Once this is called, any subsequent queries will fail.
