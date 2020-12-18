<div align="center">
  <a href="https://www.atdatabases.org/">
    <img alt="@databases - SQL Libraries for Node.js that protect you from SQL Injection with support for Postgres, MySQL, SQLite and Expo/WebSQL" src="logo/README.svg">
  </a>
</div>

## Safe From HTML Injection

Using tagged template literals for queries, e.g.

```ts
db.query(sql`SELECT * FROM users WHERE id=${userID}`);
```

makes it virtually impossible for SQL Injection attacks to slip in un-noticed. All the @databases libraries enforce the use of the sql tagged template literals, so you can't accidentally miss them.

The query is then passed to your database engine as a separate string and values:

```js
{text: 'SELECT * FROM users WHERE id=?', values: [userID]}
```

## Promises

All the @databases APIs are designed with promises in mind from the get go.

## TypeScript

Written in TypeScript, so every module has type safety and type definitions built in.

## Modular

Each database driver is published to npm as a separate module, so you don't need to install the ones you don't need.

<!-- VERSION_TABLE -->
Package Name | Version | Docs
-------------|---------|------
@databases/expo | [![NPM version](https://img.shields.io/npm/v/@databases/expo?style=for-the-badge)](https://www.npmjs.com/package/@databases/expo) | [https://www.atdatabases.org/docs/websql](https://www.atdatabases.org/docs/websql)
@databases/mysql | [![NPM version](https://img.shields.io/npm/v/@databases/mysql?style=for-the-badge)](https://www.npmjs.com/package/@databases/mysql) | [https://www.atdatabases.org/docs/mysql](https://www.atdatabases.org/docs/mysql)
@databases/mysql-test | [![NPM version](https://img.shields.io/npm/v/@databases/mysql-test?style=for-the-badge)](https://www.npmjs.com/package/@databases/mysql-test) | [https://www.atdatabases.org/docs/mysql-test](https://www.atdatabases.org/docs/mysql-test)
@databases/pg | [![NPM version](https://img.shields.io/npm/v/@databases/pg?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg) | [https://www.atdatabases.org/docs/pg](https://www.atdatabases.org/docs/pg)
@databases/pg-migrations | [![NPM version](https://img.shields.io/npm/v/@databases/pg-migrations?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-migrations) | [https://www.atdatabases.org/docs/pg-migrations](https://www.atdatabases.org/docs/pg-migrations)
@databases/pg-test | [![NPM version](https://img.shields.io/npm/v/@databases/pg-test?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-test) | [https://www.atdatabases.org/docs/pg-test](https://www.atdatabases.org/docs/pg-test)
@databases/sql | [![NPM version](https://img.shields.io/npm/v/@databases/sql?style=for-the-badge)](https://www.npmjs.com/package/@databases/sql) | [https://www.atdatabases.org/docs/sql](https://www.atdatabases.org/docs/sql)
@databases/sqlite | [![NPM version](https://img.shields.io/npm/v/@databases/sqlite?style=for-the-badge)](https://www.npmjs.com/package/@databases/sqlite) | [https://www.atdatabases.org/docs/sqlite](https://www.atdatabases.org/docs/sqlite)
@databases/websql | [![NPM version](https://img.shields.io/npm/v/@databases/websql?style=for-the-badge)](https://www.npmjs.com/package/@databases/websql) | [https://www.atdatabases.org/docs/websql](https://www.atdatabases.org/docs/websql)
@databases/escape-identifier | [![NPM version](https://img.shields.io/npm/v/@databases/escape-identifier?style=for-the-badge)](https://www.npmjs.com/package/@databases/escape-identifier) | Not documented yet
@databases/migrations-base | [![NPM version](https://img.shields.io/npm/v/@databases/migrations-base?style=for-the-badge)](https://www.npmjs.com/package/@databases/migrations-base) | Not documented yet
@databases/mysql-config | [![NPM version](https://img.shields.io/npm/v/@databases/mysql-config?style=for-the-badge)](https://www.npmjs.com/package/@databases/mysql-config) | Not documented yet
@databases/pg-config | [![NPM version](https://img.shields.io/npm/v/@databases/pg-config?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-config) | Not documented yet
@databases/pg-connection-string | [![NPM version](https://img.shields.io/npm/v/@databases/pg-connection-string?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-connection-string) | Not documented yet
@databases/pg-create | [![NPM version](https://img.shields.io/npm/v/@databases/pg-create?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-create) | Not documented yet
@databases/pg-data-type-id | [![NPM version](https://img.shields.io/npm/v/@databases/pg-data-type-id?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-data-type-id) | Not documented yet
@databases/pg-errors | [![NPM version](https://img.shields.io/npm/v/@databases/pg-errors?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-errors) | Not documented yet
@databases/pg-schema-cli | [![NPM version](https://img.shields.io/npm/v/@databases/pg-schema-cli?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-schema-cli) | Not documented yet
@databases/pg-schema-introspect | [![NPM version](https://img.shields.io/npm/v/@databases/pg-schema-introspect?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-schema-introspect) | Not documented yet
@databases/pg-schema-print-types | [![NPM version](https://img.shields.io/npm/v/@databases/pg-schema-print-types?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-schema-print-types) | Not documented yet
@databases/pg-typed | [![NPM version](https://img.shields.io/npm/v/@databases/pg-typed?style=for-the-badge)](https://www.npmjs.com/package/@databases/pg-typed) | Not documented yet
@databases/push-to-async-iterable | [![NPM version](https://img.shields.io/npm/v/@databases/push-to-async-iterable?style=for-the-badge)](https://www.npmjs.com/package/@databases/push-to-async-iterable) | Not documented yet
@databases/split-sql-query | [![NPM version](https://img.shields.io/npm/v/@databases/split-sql-query?style=for-the-badge)](https://www.npmjs.com/package/@databases/split-sql-query) | Not documented yet
@databases/validate-unicode | [![NPM version](https://img.shields.io/npm/v/@databases/validate-unicode?style=for-the-badge)](https://www.npmjs.com/package/@databases/validate-unicode) | Not documented yet
@databases/websql-core | [![NPM version](https://img.shields.io/npm/v/@databases/websql-core?style=for-the-badge)](https://www.npmjs.com/package/@databases/websql-core) | Not documented yet
@databases/with-container | [![NPM version](https://img.shields.io/npm/v/@databases/with-container?style=for-the-badge)](https://www.npmjs.com/package/@databases/with-container) | Not documented yet
<!-- VERSION_TABLE -->

> Check out the website to learn more: https://www.atdatabases.org/
