---
id: pg-guide-transactions
title: Using Transactions in Postgres
sidebar_label: Using Transactions
---

Calling `.query` on a connection pool implicitly allocates a connectio transaction and creates a transaction. To run multiple queries in a single transaction, you can call `.tx`:

```typescript
import db, {sql} from './database';

async function run() {
  const total = await db.tx((db) => {
    const resultA = await db.query(sql`
      SELECT 1 + 1 as result;
    `);
    const resultB = await db.query(sql`
      SELECT 20 + 20 as result;
    `);
    return resultA[0].result + resultB[0].result;
  });

  console.log(total);
  // => 42
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```javascript
const db = require('./database');
const {sql} = require('./database');

async function run() {
  const total = await db.tx((db) => {
    const resultA = await db.query(sql`
      SELECT 1 + 1 as result;
    `);
    const resultB = await db.query(sql`
      SELECT 20 + 20 as result;
    `);
    return resultA[0].result + resultB[0].result;
  });

  console.log(total);
  // => 42
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

The function you pass to `db.tx` is given a single parameter that represents the transaction. You can use that value exactly like you would use the connection pool, in fact I recommend giving it the same name.

If you give them different names, and refer to the outer connection pool, instead of the transaction, your query will not run as part of the transaction.

## Isolation Levels

Postgres databases can run multiple queries in parallel, this can lead to surprising phenomena if your application assumes that statements are run one at a time. Transactions attempt to prevent the following phenomena:

- **dirty read** - A transaction reads data written by a concurrent uncommitted transaction.
- **nonrepeatable read** - A transaction re-reads data it has previously read and finds that data has been modified by another transaction (that committed since the initial read).
- **phantom read** - A transaction re-executes a query returning a set of rows that satisfy a search condition and finds that the set of rows satisfying the condition has changed due to another recently-committed transaction.
- **serialization anomaly** - The result of successfully committing a group of transactions is inconsistent with all possible orderings of running those transactions one at a time.

The default isolation level is `READ_COMMITTED`, but you can choose from:

| Isolation Level | Dirty Read   | Nonrepeatable Read | Phantom Read | Serialization Anomaly |
| --------------- | ------------ | ------------------ | ------------ | --------------------- |
| READ_COMMITTED  | 💚 Prevented | 🚨 possible        | 🚨 possible  | 🚨 possible           |
| REPEATABLE_READ | 💚 Prevented | 💚 Prevented       | 💚 Prevented | 🚨 possible           |
| SERIALIZABLE    | 💚 Prevented | 💚 Prevented       | 💚 Prevented | 💚 Prevented          |

Choosing a higher level of isolation reduces the risk of bugs and race conditions, but can lead to worse performance, and may lead to transactions throwing an error if they cannot be committed without violating one of the rules above.

If parallel transactions cannot be safely commmitted (at the requested Isolation Level), you may see the error:

> "could not serialize access due to read/write dependencies among transactions"

If you use an isolation level greater than `READ_COMMITTED`, it is a good idea to also pass `retrySerializationFailures`, which will retry the transaction up to 10 times if it fails due to a serialization error:

```typescript
import {IsolationLevel} from '@databases/pg';
import db, {sql} from './database';

async function run() {
  await db.tx(
    (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      const resultB = await db.query(sql`
        INSERT INTO my_table (class, value) VALUES (2, ${sum})
      `);
    },
    {
      isolationLevel: IsolationLevel.SERIALIZABLE,
      retrySerializationFailures: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```javascript
const {IsolationLevel, sql} = require('@databases/pg');
const db = require('./database');

async function run() {
  await db.tx(
    (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      const resultB = await db.query(sql`
        INSERT INTO my_table (class, value) VALUES (2, ${sum})
      `);
    },
    {
      isolationLevel: IsolationLevel.SERIALIZABLE,
      retrySerializationFailures: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Read Only Transactions

If you know a transaction will only ever read data, you may be able to improve performance by marking it as read only.

```typescript
import {IsolationLevel} from '@databases/pg';
import db, {sql} from './database';

async function run() {
  await db.tx(
    (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      return sum;
    },
    {
      readOnly: true,
      isolationLevel: IsolationLevel.SERIALIZABLE,
      retrySerializationFailures: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```javascript
const {IsolationLevel, sql} = require('@databases/pg');
const db = require('./database');

async function run() {
  await db.tx(
    (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      return sum;
    },
    {
      readOnly: true,
      isolationLevel: IsolationLevel.SERIALIZABLE,
      retrySerializationFailures: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Deferrable

For slow queries that are read only, it can be helpful to mark them as deferrable. This causes Postgres to wait until it can safely run the query on a snapshot of the database, rather than risking serialization errors that would require a retry.

```typescript
import {IsolationLevel} from '@databases/pg';
import db, {sql} from './database';

async function run() {
  await db.tx(
    (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      return sum;
    },
    {
      readOnly: true,
      deferrable: true,
      isolationLevel: IsolationLevel.SERIALIZABLE,
      retrySerializationFailures: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```javascript
const {IsolationLevel, sql} = require('@databases/pg');
const db = require('./database');

async function run() {
  await db.tx(
    (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      return sum;
    },
    {
      readOnly: true,
      deferrable: true,
      isolationLevel: IsolationLevel.SERIALIZABLE,
      retrySerializationFailures: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

> Deferrable has no affect unless the transaction is read only
