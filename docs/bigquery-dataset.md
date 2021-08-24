---
id: bigquery-dataset
title: BigQuery Node.js DataSet
sidebar_label: DataSet
---

A BigQueryDataSet is a client for BigQuery that's scoped to a single data set.

### `BigQueryDataSet.query(SQLQuery): Promise<any[]>`

This is equivalent to `.query` on the BigQueryClient, except the query is automatically scoped to the dataset. See [`BigQueryClient.queryStream`](bigquery-client.md) for details.

### `BigQueryDataSet.queryStream(SQLQuery): AsyncIterable<any>`

This is equivalent to `.queryStream` on the BigQueryClient, except the query is automatically scoped to the dataset. See [`BigQueryClient.queryStream`](bigquery-client.md) for details.

### `BigQueryDataSet.queryNodeStream(SQLQuery): ReadableStream`

This is equivalent to `.queryNodeStream` on the BigQueryClient, except the query is automatically scoped to the dataset. See [`BigQueryClient.queryStream`](bigquery-client.md) for details.

### `BigQueryDataSet.createTable(name, options): Promise<BigQueryTable>`

Create a table and get a BigQuery Table API for inserting records into the table.

### `BigQueryDataSet.table(name): BigQueryTable`

Get a BigQuery Table API for inserting records into the table.
