---
id: pg-guide-logging
title: Postgres Logging & Debugging
sidebar_label: Logging & Debugging
---

Sometimes it is useful to know about every query that is run on your database. This can help you track down unexpected behaviour, and debug why some of your postgres queries are running slowly. The following examples assume you have your database configuration stored in an environment variable called `DATABASE_URL`. If this is not the case, you may want to read [Managing Connections](pg-guide-connections.md) first.

To simply log when each query starts and ends:

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/pg';

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

const createConnectionPool = require('@databases/pg');

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

import createConnectionPool, {sql} from '@databases/pg';

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

const createConnectionPool = require('@databases/pg');

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

## Logging in production

Although the overhead of calling these methods is negligable, serializing your queries & parameters to a string in order to log them can be costly. This shouldn't be a problem until you have very high query volume.

If you find that logging is a bottleneck, you may want to consider only logging queries if they are slower than some threshold, or only logging a random sample of the events. You may also find a tool like [pino](https://getpino.io) helpful. It allows you to log structured JSON, and then use a separate process to either format those logs or send them somewhere for processing and filtering.
