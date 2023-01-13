---
id: sqlite
title: SQLite
sidebar_label: Asynchronous API
---

The `@databases/sqlite` library provides an asynchronous, safe and convenient
API for querying SQLite databases in node.js. Built on top of
[sqlite3](https://www.npmjs.com/package/sqlite3).

N.B. you should only have one process connected to a given SQLite database at a time.

## Usage

```typescript
import connect, {value sql} from '@databases/sqlite';
// or in CommonJS:
// const connect = require('@databases/sqlite');
// const {sql} = require('@databases/sqlite');

const db = connect();

db.query(sql`SELECT * FROM users;`).then(
  (results) => console.log(results),
  (err) => console.error(err),
);
```

```javascript
const connect = require('@databases/sqlite');
const {sql} = require('@databases/sqlite');

const db = connect();

db.query(sql`SELECT * FROM users;`).then(
  (results) => console.log(results),
  (err) => console.error(err),
);
```

> For details on how to build queries, see [Building SQL Queries](sql.md)

## API

### `connect(fileName)`

Create a database connection for a given database. You should only create one connection per database for your entire applicaiton. Normally this means having one module that creates and exports the connection pool.

In memory:

```ts
import connect from '@databases/sqlite';

const db = connect();
```

File system:

```ts
import connect from '@databases/sqlite';

const db = connect(FILE_NAME);
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

Executes a callback function as a transaction, with automatically managed connection.

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
