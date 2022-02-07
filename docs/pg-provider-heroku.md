---
id: pg-provider-heroku
title: Connecting to Postgres in Heroku
sidebar_label: Heroku
---

By default, if you attach a single Postgres database to a Heroku app, Heroku will automatically set `DATABASE_URL` to the connection string. This means you can simply do:

```typescript
import createConnectionPool from '@databases/pg';

const db = createConnectionPool();
```

```javascript
const createConnectionPool = require('@databases/pg');

const db = createConnectionPool();
```

## Multiple Databases

If you connect a second database to your app, Heroku will assign it a different environment variable. In this case you can specify the connection string manually using either:

```typescript
import createConnectionPool from '@databases/pg';

const db = createConnectionPool(process.env.HEROKU_POSTGRESQL_ROSE);
```

```javascript
const createConnectionPool = require('@databases/pg');

const db = createConnectionPool(process.env.HEROKU_POSTGRESQL_ROSE);
```

or

```typescript
import createConnectionPool from '@databases/pg';

const db = createConnectionPool({
  connectionString: process.env.HEROKU_POSTGRESQL_ROSE,
});
```

```javascript
const createConnectionPool = require('@databases/pg');

const db = createConnectionPool({
  connectionString: process.env.HEROKU_POSTGRESQL_ROSE,
});
```

## Connecting from your local machine

Assuming you have [installed the Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli), and authenticated (by running `heroku login`) you can connect to your Heroku database for one off scripts and debugging from your local machine using:

```typescript
import {spawnSync} from 'child_process';
import createConnectionPool from '@databases/pg';

function getConnectionString(
  herokuInstanceID: string,
  environmentVariable: string = `DATABASE_URL`,
) {
  const result = spawnSync(
    `heroku`,
    [`config:get`, environmentVariable, `-a`, herokuInstanceID],
    {
      stdio: [`inherit`, `pipe`, `inherit`],
      encoding: `utf8`,
    },
  );
  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    return process.exit(result.status);
  }
  return result.stdout.trim();
}

const db = createConnectionPool({
  connectionString: getConnectionString(`my-app-name`),
});
```

```javascript
const {spawnSync} = require('child_process');
const createConnectionPool = require('@databases/pg');

function getConnectionString(
  herokuInstanceID,
  environmentVariable = `DATABASE_URL`,
) {
  const result = spawnSync(
    `heroku`,
    [`config:get`, environmentVariable, `-a`, herokuInstanceID],
    {
      stdio: [`inherit`, `pipe`, `inherit`],
      encoding: `utf8`,
    },
  );
  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    return process.exit(result.status);
  }
  return result.stdout.trim();
}

const db = createConnectionPool({
  connectionString: getConnectionString(`my-app-name`),
});
```
