---
id: pg
title: Postgres
sidebar_label: Getting Started
---

The `@databases/pg` library provides a safe and convenient API for querying postgres databases in node.js.

## Getting Started

If you're new to `@databases`, the best way to start is by following our guide in order:

1. [Installation & Setup](pg-guide-setup.md) - install `@databases/pg` and run your first query
1. [Managing Connections](pg-guide-connections.md) - manage the connection pool and connection configuration securely
1. [Querying Postgres](pg-guide-query.md) - perform CRUD (create, read, update, delete) operations in Postgres
1. [Using Transactions](pg-guide-transactions.md) - issolate concurrent queries using transactions
1. [Migrations](pg-migrations.md) - use "migrations" to keep your database schema consistent between environments

> ## TypeScript vs. JavaScript
>
> If you're using TypeScript or babel, you can use the modern `import createConnectionPool from '@databases/pg'` syntax. If your environment doesn't support this syntax, you should select "JavaScript" to view code samples with the legacy CommonJS `require` style:
>
> ```typescript
> import createConnectionPool from '@databases/pg';
> ```
>
> ```javascript
> const createConnectionPool = require('@databases/pg');
> ```
