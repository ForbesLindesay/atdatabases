# sql

This module provides a method for writing sql queries that is as safe as it possibly can be from SQL injection. It is part of the moped suite of utilities for creating composable configs for building node.js and react apps.

This module is designed to be used in conjunction with `@moped/db-pg`, but I intend to make it portable to any other SQL databases supported by moped.

## Installation

```
yarn add @moped/sql
```

## Usage

```js
import { sql } from 'pg-sql'
 
const tableName = 'user'
const id = 10
const query = sql`select * from ${sql.ident(tableName)} where id = ${id}`
```

### ``sql`...` ``

A template string tag which interpolates all values as placeholders unless they are escaped with a function from this package such as `sql.ident` or `sql.__dangerous__rawValue`.

Example:

```js
sql`select * from user where id = ${id}`
```

### `sql.ident(...names)`

Creates a Postgres identifier. A qualified identifier will be created if more than one name is passed. If a non-string value is used for a name, such as a symbol, a local identifier will be generated.

Examples:

```js
sql`select * from ${sql.ident('user')}`
// -> 'select * from "user"'

sql`select * from ${sql.ident('schema', 'user')}`
// -> 'select * from "schema"."user"'

const fromIdent = Symbol()

sql`select * from user as ${sql.ident(fromIdent)}`
// -> 'select * from user as __local_0__'
```

### `sql.__dangerous__rawValue(text)`

Use a string of text directly in the SQL. Helpful if you need to escape the constraints of this library.

> **Warning:** If you use arbitrary user generated input anywhere inside the text you pass to `sql.__dangerous__rawValue`, you will have a SQL injection vulnerability. Try not to use `sql.__dangerous__rawValue` unless absolutely necessary.

Example:

```js
sql`select * from user where id ${sql.__dangerous__rawValue('=')} 5`
// -> 'select * from user where id = 5'
```

### `sql.join(queries, seperator?)`

Joins an array of SQL queries together with an optional seperator. Works similarly to `Array#join`.

Example:

```js
sql`select ${sql.join([sql.query`id`, sql.query`name`], ', ')} from user`
// -> 'select id, name from user'
```

## Thanks

## Licence

MIT