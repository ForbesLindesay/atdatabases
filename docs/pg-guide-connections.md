---
id: pg-guide-connections
title: Managing Postgres Connections
sidebar_label: Managing Connections
---

## Connection Strings

It is not a good idea to store your postgres connection details in your source code:

1. It is often different between environments. Storing it inline as part of the code will make it harder to deploy & manage your application.
1. It often contains secret values such passwords. Even if your code is never intentionally made public, there is a risk that someone gains access.

Instead, you should store your connection details in an environment variable. If you put your connection string in an environment variable called `DATABASE_URL`, it will be automatically detected by `@databases/pg`, but you can also manually pass in your connection string from an environment variable to use a custom name:

```typescript
import createConnectionPool from '@databases/pg';

createConnectionPool(process.env.MY_CUSTOM_DATABASE_ENV_VAR);
```

```javascript
const createConnectionPool = require('@databases/pg');

createConnectionPool(process.env.MY_CUSTOM_DATABASE_ENV_VAR);
```

There are many other ways you can configure your connection. You can find the full list of options is in [Connection Options](pg-options.md).

## Connection Pools

`createConnectionPool` creates a "pool" of connections to the database. Creating a connection to a postgres database takes time, so to ensure your application remains fast, we keep a "pool" of connections (10 connections by default), and when you run a query or transaction, we allocate one of these connections to run your query.

This means that it is very important to only create a single connection pool for your database for the entire lifetime of your application. The best way to do this is to create a single file for your connection:

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/pg';

export {sql};

const db = createConnectionPool();
export default db;
```

```javascript
// database.js

const createConnectionPool = require('@databases/pg');

const db = createConnectionPool();
module.exports = db;
```

Then instead of referencing `'@database/pg'` in other files you can use:

```typescript
import db, {sql} from './database';
```

```javascript
const {sql} = require('@databases/pg');
const db = require('./database');
```

## Disposing of connections

In a typical server application that is intended to run continuously, you can normally leave this connection pool running. If you are building a CLI or short lived process, you should make sure you disconnect. If you don't do this you will have two problems:

1. The node process will not exit automatically if there is an active connection pool.
2. If you forcibly kill the process, it will still use up a connection on your postgres database until the connection times out.

To disconnect, you can add something like:

```typescript
process.once('SIGTERM', () => {
  db.dispose().catch((ex) => {
    console.error(ex);
  });
});
```

## Cluster connections

In a highly available Postgres cluster with a primary node & multiple replicas nodes (e.g. AWS RDS Aurora), write queries should be sent to the primary node, while read queries should be distributed equally to the read replicas nodes.

To connect to such a cluster you can use the `@databases/pg-cluster` package like this:

```typescript
// database.ts

import createConnectionPool from '@databases/pg';
import createCluster from '@databases/pg-cluster';

const primary = createConnectionPool(process.env.MY_CUSTOM_PRIMARY_ENV_VAR);
const replica = createConnectionPool(process.env.MY_CUSTOM_REPLICA_ENV_VAR);

const db = createCluster(primary, replica);
export default db;
```

## Connecting to/from cloud providers

You can normally follow the instructions from the cloud providers, but we have prepared the following guides to make things easier for these common platforms:

- [Google Cloud](pg-provider-google-cloud.md)
- [Heroku](pg-provider-heroku.md)
