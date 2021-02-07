---
id: pg-guide-setup
title: Postgres Installation & Setup
sidebar_label: Installation & Setup
---

## Installation

To install the postgress client library, open a new Terminal and run:

```sh
yarn add @databases/pg
```

```sh
npm install @databases/pg
```

## Creating a database

If you don't already have a database to connect to, you can create one using pg-test:

```sh
yarn add @databases/pg-test
yarn pg-test start
```

```sh
npx pg-test start
```

This will print a connection string as the last line of it's output, it will look something like:

```
postgres://test-user@localhost:5432/test-db
```

> N.B. This database does not have any persistence, it should only be used for testing things out/getting started. Please do not store anything even vaguely important in it.

When you're done testing out your app, you can shut the database down using:

```sh
yarn pg-test stop
```

```sh
npx pg-test stop
```

## Running your first query

Database queries are always asynchronous, and return Promises, so you will need to `await` them to get the actual resulting vaules.

```typescript
import createConnectionPool, {sql} from '@databases/pg';

async function run() {
  // N.B. you will need to replace this connection
  // string with the correct string for your database.
  const db = createConnectionPool(
    'postgres://test-user@localhost:5432/test-db',
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
const createConnectionPool = require('@databases/pg');
const {sql} = require('@databases/pg');

async function run() {
  // N.B. you will need to replace this connection
  // string with the correct string for your database.
  const db = createConnectionPool(
    'postgres://test-user@localhost:5432/test-db',
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
> slower as more conection pools are created.
>
> It is also bad practice to store your connection string in the actual code. You should use an environment
> variable instead.
>
> You can read more about this in [Managing Connections](pg-guide-connections.md) (which is the next section of this guide)
