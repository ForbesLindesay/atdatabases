---
id: mysql-guide-transactions
title: Using Transactions in MySQL with Node.js
sidebar_label: Using Transactions
---

Calling `.query` on a connection pool implicitly allocates a connection and creates a transaction. To run multiple queries in a single transaction, you can call `.tx`:

```typescript
import db, {sql} from './database';

async function run() {
  const total = await db.tx(async (db) => {
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
const {sql} = require('@databases/mysql');
const db = require('./database');

async function run() {
  const total = await db.tx(async (db) => {
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

## Nested Transactions

Transactions can also be nested. Nothing is actually committed until the top-most transaction ends, but nested transactions allow you to atomically attempt (and then optionally rollback) sequences of operations within a transaction.

## Read Only Transactions

If you know a transaction will only ever read data, you may be able to improve performance by marking it as read only.

```typescript
import db, {sql} from './database';

async function run() {
  await db.tx(
    async (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      return sum;
    },
    {
      readOnly: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```javascript
const {sql} = require('@databases/mysql');
const db = require('./database');

async function run() {
  await db.tx(
    async (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      return sum;
    },
    {
      readOnly: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## With Consistent Snapshot

For slow queries that are read only, it can be helpful to request they run with a consistent snapshot.

```typescript
import db, {sql} from './database';

async function run() {
  await db.tx(
    async (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      return sum;
    },
    {
      readOnly: true,
      withConsistentSnapshot: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```javascript
const {sql} = require('@databases/mysql');
const db = require('./database');

async function run() {
  await db.tx(
    async (db) => {
      const [{sum}] = await db.query(sql`
        SELECT SUM(value) as sum FROM my_table WHERE class=1
      `);
      return sum;
    },
    {
      readOnly: true,
      withConsistentSnapshot: true,
    },
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```
