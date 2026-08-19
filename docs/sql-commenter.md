---
id: sql-commenter
title: '@databases/sql-commenter'
sidebar_label: SQL Commenter
---

The `@databases/sql-commenter` package adds structured metadata to your SQL queries as a trailing SQL comment, following the [sqlcommenter](https://google.github.io/sqlcommenter/) convention:

```sql
SELECT * FROM users WHERE id = $1 /*action='show',application='my-app',controller='users'*/
```

This makes it possible to trace a slow or unexpected query, seen in a database log or an APM tool like Google Cloud SQL Insights, back to the application, route or controller that issued it — without having to correlate timestamps.

It is normally used together with the `prepareQuery` hook in [`@databases/pg`](pg-guide-logging.md) or [`@databases/mysql`](mysql-guide-logging.md), which lets you transform every query before it is run.

## Installation

```yarn
yarn add @databases/sql-commenter
```

```npm
npm install @databases/sql-commenter
```

## Adding an `application` tag to every query

The most common use case is tagging every query with the name of the application/service that sent it, so you can see per-application query volume/latency in your database's monitoring tools even when many services share one database.

Combine `addContext` with the `prepareQuery` option:

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/pg';
import {addContext} from '@databases/sql-commenter';

export {sql};

const db = createConnectionPool({
  prepareQuery: (query) => addContext(query, {application: 'my-app'}),
});

export default db;
```

> The exact same option is available in `@databases/mysql`

Every query run via `db.query` will now have `/*application='my-app'*/` appended, e.g.:

```sql
SELECT * FROM users WHERE id = $1 /*application='my-app'*/
```

## Adding request context to every query

You can also add request specific context to every query by making use of the built in node.js package `async_hooks`. For example, here's a simple express app that attaches some context to each request for the purposes of logging:

```typescript
import createConnectionPool, {sql} from '@databases/pg';
import {addContext} from '@databases/sql-commenter';
import {AsyncLocalStorage} from 'async_hooks';
import express from 'express';

type LogContext = {action?: string; controller?: string};
const logContext = new AsyncLocalStorage<LogContext>();
function addLogContext(context: LogContext) {
  const store = logContext.getStore();
  if (!store) {
    console.warn('Unable to set log context outside of a request');
    return;
  }
  Object.assign(store, context);
}

const db = createConnectionPool({
  prepareQuery: (query) =>
    addContext(query, {
      application: 'my-app',
      ...(logContext.getStore() ?? {}),
    }),
});
async function getUser(id: number) {
  const users = await db.query(sql`SELECT * FROM users WHERE id=${id}`);
  return users.at(0);
}

const app = express();

// This creates a separate store for each request so
// context can be remembered throughout the lifecycle
// of the request
app.use((req, res, next) => logContext.run({}, next));

app.get(`/users/:id`, (req, res, next) => {
  addLogContext({action: 'get', controller: 'users'});
  getUser(req.params.id).then((user) => {
    if (!user) res.send(404);
    else res.json(user);
  }, next);
});

app.listen(process.env.PORT ?? 3000);
```

When the `GET /users/:id` endpoint is hit, the log context means that any query run by `getUser` will have `/*action='get',application='my-app',controller='users'*/` appended to it.

## Parsing the context back out of a query

Once you find an interesting query in a database log, slow query report, or a tool like `pg_stat_activity`, you can use `extractContext` to turn its trailing comment back into the original key/value pairs. It returns both the parsed `comment` and the original `query` with the comment stripped off:

```typescript
import {extractContext} from '@databases/sql-commenter';

extractContext(
  `SELECT * FROM users WHERE id = $1 /*action='get',application='my-app',controller='users'*/`,
);
// => {
//   query: `SELECT * FROM users WHERE id = $1`,
//   comment: {action: 'get', application: 'my-app', controller: 'users'},
// }
```

If the query does not end with a valid, non-empty sqlcommenter style comment, `comment` is `null` and `query` is returned completely unchanged - including any trailing text that looked like a comment but failed to parse. `extractContext` never throws, however malformed the input.

If you already have just the comment on its own (without the rest of the query), you can use `parseComment` instead, which has the same never-throws behaviour:

```typescript
import {parseComment} from '@databases/sql-commenter';

parseComment(`/*action='get',application='my-app',controller='users'*/`);
// => {action: 'get', application: 'my-app', controller: 'users'}
```
