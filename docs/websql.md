---
id: websql
title: Expo / WebSQL
sidebar_label: API
---

The `@databases/websql` and `@databases/expo` libraries provides a safe and convenient API for querying WebSQL/Expo/SQLite databases in node.js.

- `@databases/websql` - uses WebSQL in the browser, and SQLite in node.js
- `@databases/expo` - uses Expo's WebSQL APIs, but otherwise provides the exact same API as `@databases/websql`

## Usage

```ts
import connect, {sql} from '@databases/websql';

const db = connect();

db.query(sql`SELECT * FROM users;`).then(
  results => console.log(results),
  err => console.error(err),
);
```

> For details on how to build queries, see [Building SQL Queries](sql.md)

## API

### ``` connect(connection) ```

Create a `Database` connection for a given database. You should only create one connection per database for your entire applicaiton. Normally this means having one module that creates and exports the connection pool.

It is generally a good idea to combine multiple queries into a transaction using `Database.tx` since all queries are implicitly wrapped in a transaction anyway.

#### `@databases/websql`

In memory node.js:

```ts
import connect from '@databases/websql';
const db = connect();
```

File system node.js:

```ts
import connect from '@databases/websql';
const db = connect(FILE_NAME);
```

> N.B. We provide the WebSQL implementation for node.js primarily for testing/compatibility with Expo apps. It is generally better to directly use SQLite, which better designed APIs, unless you specifically need to match the behaviour of Expo/WebSQL.

Web:

```ts
import connect from '@databases/websql';
const db = connect(NAME, OPTIONS);

export {sql};
export const IN_MEMORY = ':memory:';
export interface Options {
  version?: string;
  displayName?: string;
  estimatedSize?: number;
}
export default function connect(
  name: string = IN_MEMORY,
  options: Options = {},
)
```

On node.js the options are ignored. On the web you can suply the following options:

Name | Type | <abbr title="Optional">Opt</abbr>
-----|-------|---------
`version` | `string` | ✓
`displayName` | `string` | ✓
`estimatedSize` | `number` | ✓

> N.B. WebSQL is not well supported in modern browsers, and we do not polyfill it. You should use IndexDB instead where possible.

#### `@databases/expo`

```ts
import connect from '@databases/expo';

const db = connect(NAME);
```

The expo `connect` function just takes the `name` of the database you would like to connect to as the only parameter, and returns a database connection.

### ``` Database.query(SQLQuery, options?): Promise<any[]> ```

Run an SQL Query and get a promise for an array of results. If your query does not update any records, you can pass `{readOnly: true}` as the options so that only a read lock is taken out for the transaction.

### ``` Database.tx(fn, options?): Promise<T> ```

Executes a callback function as a transaction.

```ts
const result = await db.tx(function* (transaction) {
  const resultA = yield transaction.query(sql`SELECT 1 + 1 AS a`);
  const resultB = yield transaction.query(sql`SELECT 1 + 1 AS b`);
  return resultA[0].a + resultB[0].b;
});
// => 4
```

N.B. the function passed to `db.tx` must be a generator function that only yields the results of calls to `transaction.query`. Calls to `transaction.query` do not return `Promise` objects, instead they return `QueryTask`s. This is because a design flaw in WebSQL that makes it difficult to use Promises.

This means you cannot perform any async operations whithin a transaction, other than querying the database.

If your transaction does not update any records, you can pass `{readOnly: true}` as the options so that only a read lock is taken out for the transaction.