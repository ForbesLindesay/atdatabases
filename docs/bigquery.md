---
id: bigquery
title: BigQuery
sidebar_label: API
---

The `@databases/bigquery` library provides a safe and convenient API for querying Google's BigQuery in node.js.

## `connect(options)`

Creates a client for BigQuery. You can specify a `projectId` and `keyFilename` to authenticate, or you can authenticate using the gcloud CLI before initializing this library.

For all methods, see [BigQueryClient](bigquery-client.md)

## Creating BigQuery tables in Node.js

You can create BigQuery tables from the cloud console. If you need to create tables dynamically, you can use @databases:

```typescript
import connect, {
  sql,
  BigQueryTableType,
  BigQueryPartitionType,
} from '@databases/bigquery';

const db = connect();

db.dataset(`my_dataset`)
  .createTable(`my_table`, {
    type: BigQueryTableType.Table,
    fields: [
      {name: `id`, type: `INT64`},
      {name: `value`, type: `STRING`},
    ],
    partition: {
      type: BigQueryPartitionType.Time,
      granularity: 'HOUR',
    },
  })
  .catch((err) => console.error(err));
```

```javascript
const connect = require('@databases/bigquery');
const {
  sql,
  BigQueryTableType,
  BigQueryPartitionType,
} = require('@databases/bigquery');

const db = connect();

db.dataset(`my_dataset`)
  .createTable(`my_table`, {
    type: BigQueryTableType.Table,
    fields: [
      {name: `id`, type: `INT64`},
      {name: `value`, type: `STRING`},
    ],
    partition: {
      type: BigQueryPartitionType.Time,
      granularity: 'HOUR',
    },
  })
  .catch((err) => console.error(err));
```

## Inserting Records into BigQuery tables in Node.js

You can use `INSERT` statements to insert data into BigQuery tables, but it's often more efficient & convenient to use the `.insert` API

```typescript
import connect, {
  sql,
  BigQueryTableType,
  BigQueryPartitionType,
} from '@databases/bigquery';

const db = connect();

db.dataset(`my_dataset`)
  .table(`my_table`)
  .insert([
    {id: 1, value: 'hello'},
    {id: 2, value: 'world'},
  ])
  .catch((err) => console.error(err));
```

```javascript
const connect = require('@databases/bigquery');
const {
  sql,
  BigQueryTableType,
  BigQueryPartitionType,
} = require('@databases/bigquery');

const db = connect();

db.dataset(`my_dataset`)
  .table(`my_table`)
  .insert([
    {id: 1, value: 'hello'},
    {id: 2, value: 'world'},
  ])
  .catch((err) => console.error(err));
```

## Querying BigQuery in Node.js

```typescript
import connect, {sql} from '@databases/bigquery';

const db = connect();

db.query(sql`SELECT * FROM my_dataset.my_table;`).then(
  (results) => console.log(results),
  (err) => console.error(err),
);
```

```javascript
const connect = require('@databases/bigquery');
const {sql} = require('@databases/bigquery');

const db = connect();

db.query(sql`SELECT * FROM my_dataset.my_table;`).then(
  (results) => console.log(results),
  (err) => console.error(err),
);
```

For details on how to build queries, see [Building SQL Queries](sql.md)

> N.B. BigQuery is billed based on the bytes scanned by your query. The lack of indexes can make seemingly simple queries very expensive if your tables are sufficiently large.
