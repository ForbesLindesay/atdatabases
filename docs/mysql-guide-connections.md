---
id: mysql-guide-connections
title: Managing MySQL Connections
sidebar_label: Managing Connections
---

## Connection Strings

It is not a good idea to store your MySQL connection details in your source code:

1. It is often different between environments. Storing it inline as part of the code will make it harder to deploy & manage your application.
1. It often contains secret values such passwords. Even if your code is never intentionally made public, there is a risk that someone gains access.

Instead, you should store your connection details in an environment variable. If you put your connection string in an environment variable called `DATABASE_URL`, it will be automatically detected by `@databases/mysql`, but you can also manually pass in your connection string from an environment variable to use a custom name:

```typescript
import createConnectionPool from '@databases/mysql';

createConnectionPool(process.env.MY_CUSTOM_DATABASE_ENV_VAR);
```

```javascript
const createConnectionPool = require('@databases/mysql');

createConnectionPool(process.env.MY_CUSTOM_DATABASE_ENV_VAR);
```

There are many other ways you can configure your connection. You can find the full list of options is in [Connection Options](mysql-options.md).

## Connection Pools

`createConnectionPool` creates a "pool" of connections to the database. Creating a connection to a MySQL database takes time, so to ensure your application remains fast, we keep a "pool" of connections (10 connections by default), and when you run a query or transaction, we allocate one of these connections to run your query.

This means that it is very important to only create a single connection pool for your database for the entire lifetime of your application. The best way to do this is to create a single file for your connection:

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/mysql';

export {sql};

const db = createConnectionPool();
export default db;
```

```javascript
// database.js

const createConnectionPool = require('@databases/mysql');

const db = createConnectionPool();
module.exports = db;
```

Then instead of referencing `'@database/mysql'` in other files you can use:

```typescript
import db, {sql} from './database';
```

```javascript
const {sql} = require('@databases/mysql');
const db = require('./database');
```

## Disposing of connections

In a typical server application that is intended to run continuously, you can normally leave this connection pool running. If you are building a CLI or short lived process, you should make sure you disconnect. If you don't do this you will have two problems:

1. The node process will not exit automatically if there is an active connection pool.
2. If you forcibly kill the process, it will still use up a connection on your MySQL database until the connection times out.

To disconnect, you can add something like:

```typescript
process.once('SIGTERM', () => {
  db.dispose().catch((ex) => {
    console.error(ex);
  });
});
```
