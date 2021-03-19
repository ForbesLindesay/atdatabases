---
id: pg
title: Getting started with Postgres and Node.js
sidebar_label: Getting Started
---

The `@databases/pg` library provides a safe and convenient API for querying postgres databases in node.js.

Top tip: If you haven't done so already, you may want to [set up syntax highighting in your editor](syntax-highlighting.md) then resume this guide when you've done that.

## Getting Started

If you're new to `@databases`, the best way to start is by following our guide in order:

1. [Installation & Setup](pg-guide-setup.md) - install `@databases/pg` and run your first query
1. [Managing Connections](pg-guide-connections.md) - manage the connection pool and connection configuration securely
1. [Querying Postgres](pg-guide-query.md) - perform CRUD (create, read, update, delete) operations in Postgres
1. [Using Transactions](pg-guide-transactions.md) - isolate concurrent queries using transactions
1. [TypeScript](pg-guide-typescript.md) - generate TypeScript types for your database tables
1. [Logging & Debugging](pg-guide-logging.md) - log queries for easier debugging, and to help find performance bottlenecks
1. [Migrations](pg-migrations.md) - use "migrations" to keep your database schema consistent between environments
1. [Testing](pg-test.md) - use docker to create temporary databases for integration tests

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
