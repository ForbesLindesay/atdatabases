---
id: sqlite
title: SQLite Sync
sidebar_label: API
---

The `@databases/sqlite-sync` library provides a _synchronous_, safe and convenient API
for querying SQLite databases in node.js. Built on top of
[better-sqlite3](https://www.npmjs.com/package/better-sqlite3).

N.B. you should only have one process connected to a given SQLite database at a time.

## Usage

```typescript
import connect, {sql} from '@databases/sqlite-sync';
// or in CommonJS:
// const connect = require('@databases/sqlite-sync');
// const {sql} = require('@databases/sqlite-sync');

const db = connect();

console.log(db.query(sql`SELECT * FROM users;`));
```

```javascript
const connect = require('@databases/sqlite-sync');
const {sql} = require('@databases/sqlite-sync');

const db = connect();

console.log(db.query(sql`SELECT * FROM users;`))
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

The `Database` inherits from `DatabaseTransaction`, so you call `Database.query` directly instead of having to create a transaction for every query.

### `Connection.query(SQLQuery): any[]`

Run an SQL Query and get a promise for an array of results.

### `Connection.queryStream(SQLQuery): Iterable<any>`

Run an SQL Query and get an async iterable of the results. e.g.

```js
for (const record of db.queryStream(sql`SELECT * FROM massive_table`)) {
  console.log(result);
}
```

### `Connection.tx(fn): T`

Executes a callback function as a transaction, with automatically managed connection.

When invoked on the ConnectionPool object, the method allocates the Connection from the pool, executes the callback, and once finished - releases the connection back to the pool. However, when invoked inside another task or transaction, the method reuses the parent Connection.

A transaction wraps a regular task with additional queries:

1. it executes `BEGIN` just before invoking the callback function
2. it executes `COMMIT`, if the callback didn't throw any error or return a rejected promise
3. it executes `ROLLBACK`, if the callback did throw an error or return a rejected promise

```ts
const result = await db.tx(async (transaction) => {
  const resultA = transaction.query(sql`SELECT 1 + 1 AS a`);
  // Simulate calling an external endpoint
  await new Promise((res) => res());
  const resultB = transaction.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

### `ConnectionPool.dispose(): Promise<void>`

Dispose the connection pool. Once this is called, any subsequent queries will fail.
