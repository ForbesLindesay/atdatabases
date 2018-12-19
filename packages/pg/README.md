# DB Postgres

This module provides a method for accessing postgres databases from node.js that is as safe as it possibly can be from SQL injection. It is part of the databases suite of utilities for creating composable configs for building node.js and react apps.

This module is designed to be used in conjunction with `@databases/sql`.

## Installation

```
yarn add @databases/pg @databases/sql
```

## Usage

```js
const connect = require('@databases/pg');

// to use the DATABASE_URL environment variable:
module.exports = connect();

// to pass a database connection inline:
module.exports = connect('my database connection');
```

The connection has three methods:

### query

The query method takes an `SQLQuery` (see `@databases/sql`) and returns a Promise for an array of users.  e.g.

```js
connection.query(
  sql`SELECT * FROM users WHERE name=${'ForbesLindesay'}`
).then(users => users.forEach(user => console.log(user)));
```

If you pass a string, number, or anything else that's not an `SQLQuery` object, we will assume you made a mistake, and return an error to prevent SQL injection.

### task

Task lets you allocate a single connection to multiple queries. In a web application you generally want to allocate one task to each request.

```js
connection.task(async (task) => {
  // you can use `task` here exactly like you used `connection` before
  const users = await task.query(
    sql`SELECT * FROM users WHERE name=${'ForbesLindesay'}`
  );
  users.forEach(user => console.log(user));
});
```

Once the function given to `task` has finished executing (and any returned promise has been resolved) the connection is released back into the pool.

### tx

Transactions are just like tasks, except that they enforce strong transactional consistency between multiple database users.  This comes at a significant cost to performance, but it's by far the easiest way of doing things like ensuring that "the number of tickets people have booked does not exceed the number of available tickets" in a ticketing system (for example).

```js
connection.tx(async (transaction) => {
  // you can use `transaction` here exactly like you used `connection` before
  const users = await transaction.query(
    sql`SELECT * FROM users WHERE name=${'ForbesLindesay'}`
  );
  users.forEach(user => console.log(user));
});
```

## Licence

MIT