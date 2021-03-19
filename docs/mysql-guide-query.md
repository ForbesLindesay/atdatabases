---
id: mysql-guide-query
title: Querying MySQL Databases in Node.js
sidebar_label: Querying MySQL
---

This guide will cover creating a table and performing basic CRUD (create, read, update, delete) operations on it. You should make sure you read [Setup & Installation](mysql-guide-setup.md) and [Managing Connections](mysql-guide-connections.md) first.

## Creating a table

In a production app this isn't a great way to manage your schema, but to get started, you can create a table directly using the `@databases/mysql` API:

```typescript
import db, {sql} from './database';

async function run() {
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL NOT NULL PRIMARY KEY,
      email TEXT NOT NULL
      UNIQUE(email)
    )
  `);

  await db.dispose();
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
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL NOT NULL PRIMARY KEY,
      email TEXT NOT NULL,
      favorite_color TEXT NOT NULL,
      UNIQUE(email)
    )
  `);

  await db.dispose();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Insert, Select, Update, Delete

You can include values in your queries using the `${}` syntax for tagged template literals

```typescript
import db, {sql} from './database';

async function insertUser(email, favoriteColor) {
  await db.query(sql`
    INSERT INTO users (email, favorite_color)
    VALUES (${email}, ${favoriteColor})
  `);
}

async function updateUser(email, favoriteColor) {
  await db.query(sql`
    UPDATE users
    SET favorite_color=${favoriteColor}
    WHERE email=${email}
  `);
}

async function deleteUser(email) {
  await db.query(sql`
    DELETE FROM users
    WHERE email=${email}
  `);
}

async function getUser(email) {
  const users = await db.query(sql`
    SELET * FROM users
    WHERE email=${email}
  `);
  if (users.length === 0) {
    return null;
  }
  return users[0];
}
async function run() {
  await insertUser('me@example.com', 'red');
  await updateUser('me@example.com', 'blue');

  const user = await getUser('me@example.com');
  console.log('user =', user);

  await deleteUser('me@example.com');

  await db.dispose();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

```javascript
const {sql} = require('@databases/mysql');
const db = require('./database');

async function insertUser(email, favoriteColor) {
  await db.query(sql`
    INSERT INTO users (email, favorite_color)
    VALUES (${email}, ${favoriteColor})
  `);
}

async function updateUser(email, favoriteColor) {
  await db.query(sql`
    UPDATE users
    SET favorite_color=${favoriteColor}
    WHERE email=${email}
  `);
}

async function deleteUser(email) {
  await db.query(sql`
    DELETE FROM users
    WHERE email=${email}
  `);
}

async function getUser(email) {
  const users = await db.query(sql`
    SELET * FROM users
    WHERE email=${email}
  `);
  if (users.length === 0) {
    return null;
  }
  return users[0];
}
async function run() {
  await insertUser('me@example.com', 'red');
  await updateUser('me@example.com', 'blue');

  const user = await getUser('me@example.com');
  console.log('user =', user);

  await deleteUser('me@example.com');

  await db.dispose();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

For full documentation on how to construct complex queries, read [Building SQL Queries](sql.md).
