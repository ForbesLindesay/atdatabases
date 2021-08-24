---
id: bigquery-client
title: BigQuery Node.js Client
sidebar_label: Client
---

To access BigQuery, you will need to create a BigQueryClient.

### `BigQueryClient.query(SQLQuery): Promise<any[]>`

Run an SQL Query and get a promise for an array of results.

### `BigQueryClient.queryStream(SQLQuery): AsyncIterable<any>`

Run an SQL Query and get an async iterable of the results. e.g.

```js
for await (const record of db.queryStream(sql`SELECT * FROM massive_table`)) {
  console.log(result);
}
```

### `BigQueryClient.queryNodeStream(SQLQuery): ReadableStream`

Run an SQL Query and get a node.js readable stream of the results. e.g.

```js
const Stringifier = require('newline-json').Stringifier;

db.queryNodeStream(sql`SELECT * FROM massive_table`)
  .pipe(new Stringifier())
  .pipe(process.stdout);
```

### `BigQueryClient.dataset(name): BigQueryDataSet`

Get a BigQuery API that's scoped to a dataset.
