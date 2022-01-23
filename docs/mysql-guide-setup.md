---
id: mysql-guide-setup
title: MySQL Installation & Setup
sidebar_label: Installation & Setup
---

## Installation

To install the MySQL client library, open a new Terminal and run:

```yarn
yarn add @databases/mysql
```

```npm
npm install @databases/mysql
```

## Creating a database

If you don't already have a database to connect to, you can create one using pg-test:

```yarn
yarn add @databases/mysql-test
yarn mysql-test start
```

```npm
npx @databases/mysql-test start
```

This will print a connection string as the last line of it's output, it will look something like:

```
mysql://test-user:password@localhost:3306/test-db
```

> N.B. This database does not have any persistence, it should only be used for testing things out/getting started. Please do not store anything even vaguely important in it.

When you're done testing out your app, you can shut the database down using:

```yarn
yarn mysql-test stop
```

```npm
npx @databases/mysql-test stop
```

## Running your first query

Database queries are always asynchronous, and return Promises, so you will need to `await` them to get the actual resulting vaules.

```typescript
import createConnectionPool, {sql} from '@databases/mysql';

async function run() {
  // N.B. you will need to replace this connection
  // string with the correct string for your database.
  const db = createConnectionPool(
    'mysql://test-user:password@localhost:3306/test-db',
  );

  const results = await db.query(sql`
    SELECT 1 + 1 as result;
  `);

  console.log(results);
  // => [{result: 2}]

  await db.dispose();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```javascript
const createConnectionPool = require('@databases/mysql');
const {sql} = require('@databases/mysql');

async function run() {
  // N.B. you will need to replace this connection
  // string with the correct string for your database.
  const db = createConnectionPool(
    'mysql://test-user:password@localhost:3306/test-db',
  );

  const results = await db.query(sql`
    SELECT 1 + 1 as result;
  `);

  console.log(results);
  // => [{result: 2}]

  await db.dispose();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

> ## Connection Pools & Connection Strings
>
> You should only create one connection pool for your application, otherwise your server will get slower and
> slower as more connection pools are created.
>
> It is also bad practice to store your connection string in the actual code. You should use an environment
> variable instead.
>
> You can read more about this in [Managing Connections](mysql-guide-connections.md) (which is the next section of this guide)
