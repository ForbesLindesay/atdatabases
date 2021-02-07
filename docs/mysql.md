---
id: mysql
title: Getting started with MySQL and Node.js
sidebar_label: Getting Started
---

The `@databases/mysql` library provides a safe and convenient API for querying MySQL databases in node.js.

Top tip: If you haven't done so already, you may want to [set up syntax highighting in your editor](syntax-highlighting.md) then resume this guide when you've done that.

## Getting Started

If you're new to `@databases`, the best way to start is by following our guide in order:

1. [Installation & Setup](mysql-guide-setup.md) - install `@databases/mysql` and run your first query
1. [Managing Connections](mysql-guide-connections.md) - manage the connection pool and connection configuration securely
1. [Querying Postgres](mysql-guide-query.md) - perform CRUD (create, read, update, delete) operations in Postgres
1. [Using Transactions](mysql-guide-transactions.md) - issolate concurrent queries using transactions

> ## TypeScript vs. JavaScript
>
> If you're using TypeScript or babel, you can use the modern `import createConnectionPool from '@databases/mysql'` syntax. If your environment doesn't support this syntax, you should select "JavaScript" to view code samples with the legacy CommonJS `require` style:
>
> ```typescript
> import createConnectionPool from '@databases/mysql';
> ```
>
> ```javascript
> const createConnectionPool = require('@databases/mysql');
> ```
