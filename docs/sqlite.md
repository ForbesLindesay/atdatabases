---
id: sqlite
title: SQLite
sidebar_label: API
---

The `@databases/sqlite` library provides a safe and convenient API for querying SQLite databases in node.js.

N.B. you should only have one process connected to a given SQLite database at a time.

## Usage

```ts
import connect, {sql} from '@databases/sqlite';

const db = connect();

db.query(sql`SELECT * FROM users;`).then(
  results => console.log(results),
  err => console.error(err),
);
```

> For details on how to build queries, see [Building SQL Queries](sql.md)

## API

### ``` connect(fileName) ```

Create a database connection for a given database. You should only create one connection per database for your entire applicaiton. Normally this means having one module that creates and exports the connection pool.


In memory:

```ts
import connect from '@databases/websql';
const db = connect();
```

File system:

```ts
import connect from '@databases/websql';
const db = connect(FILE_NAME);
```

The `Database` inherits from `DatabaseTransaction`, so you call `Database.query` directly instead of having to create a transaction for every query.  Since SQLite has very limited support for actual transactions, we only support running one transaction at a time, but multiple queries can be run in parallel. You should therefore only use transactions when you actually need them.

### ``` Conneciton.query(SQLQuery): Promise<any[]> ```

Run an SQL Query and get a promise for an array of results.

### ``` Connection.tx(fn): Promise<T> ```

Executes a callback function as a transaction, with automatically managed connection.

When invoked on the ConnectionPool object, the method allocates the Connection from the pool, executes the callback, and once finished - releases the connection back to the pool. However, when invoked inside another task or transaction, the method reuses the parent Connection.

A transaction wraps a regular task with additional queries:

1. it executes `BEGIN` just before invoking the callback function
2. it executes `COMMIT`, if the callback didn't throw any error or return a rejected promise
3. it executes `ROLLBACK`, if the callback did throw an error or return a rejected promise

```ts
const result = await db.tx(async transaction => {
  const resultA = await transaction.query(sql`SELECT 1 + 1 AS a`);
  const resultB = await transaction.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

### ``` ConnectionPool.dispose(): Promise<void> ```

Dispose the connection pool. Once this is called, any subsequent queries will fail.
