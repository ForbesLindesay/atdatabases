---
id: mysql-guide-logging
title: MySQL Logging & Debugging with Node.js
sidebar_label: Logging & Debugging
---

Sometimes it is useful to know about every query that is run on your database. This can help you track down unexpected behaviour, and debug why some of your MySQL queries are running slowly. The following examples assume you have your database configuration stored in an environment variable called `DATABASE_URL`. If this is not the case, you may want to read [Managing Connections](mysql-guide-connections.md) first.

To simply log when each query starts and ends:

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/mysql';

export {sql};

const db = createConnectionPool({
  onQueryStart: (_query, {text, values}) => {
    console.log(
      `${new Date().toISOString()} START QUERY ${text} - ${JSON.stringify(
        values,
      )}`,
    );
  },
  onQueryResults: (_query, {text}, results) => {
    console.log(
      `${new Date().toISOString()} END QUERY   ${text} - ${
        results.length
      } results`,
    );
  },
  onQueryError: (_query, {text}, err) => {
    console.log(
      `${new Date().toISOString()} ERROR QUERY ${text} - ${err.message}`,
    );
  },
});

export default db;
```

```javascript
// database.js

const createConnectionPool = require('@databases/mysql');

const db = createConnectionPool({
  onQueryStart: (_query, {text, values}) => {
    console.log(
      `${new Date().toISOString()} START QUERY ${text} - ${JSON.stringify(
        values,
      )}`,
    );
  },
  onQueryResults: (_query, {text}, results) => {
    console.log(
      `${new Date().toISOString()} END QUERY   ${text} - ${
        results.length
      } results`,
    );
  },
  onQueryError: (_query, {text}, err) => {
    console.log(
      `${new Date().toISOString()} ERROR QUERY ${text} - ${err.message}`,
    );
  },
});

module.exports = db;
```

## Capturing Duration

If you want to track the query duration, one option is to use a tool that can process your logs and find the matching start & end events in the log stream. An alternative is to use a Map to store the start time for each query:

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/mysql';

export {sql};

const startTimes = new Map<SQLQuery, number>();
const db = createConnectionPool({
  onQueryStart: (query) => {
    startTimes.set(query, Date.now());
  },
  onQueryResults: (query, {text}, results) => {
    const start = startTimes.get(query);
    startTimes.delete(query);

    if (start) {
      console.log(`${text} - ${Date.now() - start}ms`);
    } else {
      console.log(`${text} - uknown duration`);
    }
  },
  onQueryError: (query, {text}, err) => {
    startTimes.delete(query);
    console.log(`${text} - ${err.message}`);
  },
});

export default db;
```

```javascript
// database.js

const createConnectionPool = require('@databases/mysql');

const startTimes = new Map();
const db = createConnectionPool({
  onQueryStart: (query) => {
    startTimes.set(query, Date.now());
  },
  onQueryResults: (query, {text}, results) => {
    const start = startTimes.get(query);
    startTimes.delete(query);

    if (start) {
      console.log(`${text} - ${Date.now() - start}ms`);
    } else {
      console.log(`${text} - uknown duration`);
    }
  },
  onQueryError: (query, {text}, err) => {
    startTimes.delete(query);
    console.log(`${text} - ${err.message}`);
  },
});

module.exports = db;
```

## Tracking Open Connections

You can also use the `onConnectionOpened` and `onConnectionClosed` events to track the number of open connections:

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/mysql';

export {sql};

let connectionsCount = 0;
const db = createConnectionPool({
  onConnectionOpened: () => {
    console.log(
      `Opened connection. Active connections = ${++connectionsCount}`,
    );
  },
  onConnectionClosed: () => {
    console.log(
      `Closed connection. Active connections = ${--connectionsCount}`,
    );
  },
});

export default db;
```

```javascript
// database.js

const createConnectionPool = require('@databases/mysql');

let connectionsCount = 0;
const db = createConnectionPool({
  onConnectionOpened: () => {
    console.log(
      `Opened connection. Active connections = ${++connectionsCount}`,
    );
  },
  onConnectionClosed: () => {
    console.log(
      `Closed connection. Active connections = ${--connectionsCount}`,
    );
  },
});

module.exports = db;
```

## Preparing Queries

The `prepareQuery` hook is called immediately before a query is formatted & sent to MySQL, and lets you return a new query to actually run in its place. The returned query is what gets executed, and is also what is passed to `onQueryStart`, `onQueryResults` and `onQueryError`.

A common use for `prepareQuery` is adding a [sqlcommenter](https://google.github.io/sqlcommenter/) style comment to every query, using [`@databases/sql-commenter`](sql-commenter.md), so that you can trace a slow or unexpected query in your database logs/monitoring tools back to the application (and optionally route/controller) that issued it:

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/mysql';
import {addContext} from '@databases/sql-commenter';

export {sql};

const db = createConnectionPool({
  prepareQuery: (query) => addContext(query, {application: 'my-app'}),
});

export default db;
```

```javascript
// database.js

const createConnectionPool = require('@databases/mysql');
const {addContext} = require('@databases/sql-commenter');

const db = createConnectionPool({
  prepareQuery: (query) => addContext(query, {application: 'my-app'}),
});

module.exports = db;
```

Every query run via `db.query`, `db.tx` or `db.task` will now have `/*application='my-app'*/` appended, e.g.:

```sql
SELECT * FROM users WHERE id = ? /*application='my-app'*/
```

See [`@databases/sql-commenter`](sql-commenter.md) for more details, including how to add request context.

`prepareQuery` is **not** currently applied to `queryStream`/`queryNodeStream`.

## Logging in production

Although the overhead of calling these methods is negligible, serializing your queries & parameters to a string in order to log them can be costly. This shouldn't be a problem until you have very high query volume.

If you find that logging is a bottleneck, you may want to consider only logging queries if they are slower than some threshold, or only logging a random sample of the events. You may also find a tool like [pino](https://getpino.io) helpful. It allows you to log structured JSON, and then use a separate process to either format those logs or send them somewhere for processing and filtering.
