---
id: pg-bulk
title: 'Bulk Operations in Postgres using UNNEST'
sidebar_label: Bulk Operations
---

If you are dealing with large numbers of rows at a time, queries can be slow. There is also a limit on the total number of parameters you can have in a Postgres query. To avoid these limitations, you can use the `UNNEST` function in Postgres to ensure that you have just one parameter per column, rather than having `columns x rows` parameters.

`@databases/pg-bulk` makes it much easier to use `UNNEST` in Node.js. You will still need to know the postgres data type for each column you want to insert into/query using pg-bulk. This is a limitation of Postgres' `UNNEST` utility.

If you're using TypeScript, the [@databases/pg-typed](pg-typed.md) library can offer an even easier to use, type safe API for bulk operations. You can then use pg-schema-cli to generate the schema for you, so you don't have to define an object with the field types each time.

## Getting Started

There are some common options needed for every bulk operation. You may find it easiest to define these once for each table, and then re-use them throughout your project:

```typescript
// database.ts
import connect, {sql} from '@databases/pg';
import {BulkOperationOptions} from '@database/pg-bulk';

const database = connect({bigIntMode: 'number'});
export default database;

export const usersOptions: BulkOperationOptions<
  'id' | 'screen_name' | 'bio' | 'age'
> = {
  database,
  tableName: `users`,
  columnTypes: {
    id: sql`BIGINT`,
    email: sql`TEXT`,
    favorite_color: sql`TEXT`,
  },
};
```

```javascript
// database.js
const connect = require('@databases/pg');
const {sql} = connect;

const database = connect({bigIntMode: 'number'});

const usersOptions = {
  database,
  tableName: `users`,
  columnTypes: {
    id: sql`BIGINT`,
    email: sql`TEXT`,
    favorite_color: sql`TEXT`,
    date_of_birth: sql`DATE`,
  },
};
module.exports = {database, usersOptions};
```

### bulkInsert(options)

To insert thousands of records at a time, you can call `bulkInsert`. You will need to know the column types for your table:

```typescript
import {bulkInsert} from '@databases/pg-bulk';
import {usersOptions} from './database';

export async function insertUsers(
  users: {email: string; favorite_color: string}[],
) {
  await bulkInsert({
    ...usersOptions,
    columnsToInsert: [`email`, `favorite_color`],
    records: users,
  });
}
```

```javascript
const {bulkInsert} = require('@databases/pg-bulk');
const {usersOptions} = require('./database');

async function insertUsers(users) {
  await bulkInsert({
    ...usersOptions,
    columnsToInsert: [`email`, `favorite_color`],
    records: users,
  });
}
```

This is equivalent to:

```javascript
async function insertUsers(users) {
  await database.query(sql`
    INSERT INTO users (email, favorite_color)
    SELECT * FROM
      UNNEST(
        ${users.map((u) => u.email)}::TEXT[],
        ${users.map((u) => u.favorite_color)}::TEXT[]
      )
  `);
}
```

### bulkSelect(options)

`bulkSelect` lets you specify multiple distinct conditions that are efficiently or'ed together:

```typescript
import {bulkSelect} from '@databases/pg-bulk';
import {usersOptions} from './database';

export async function getUsers() {
  return await bulkSelect({
    ...usersOptions,
    whereColumnNames: [`email`, `favorite_color`],
    whereConditions: [
      {email: `joe@example.com`, favorite_color: `red`},
      {email: `ben@example.com`, favorite_color: `blue`},
    ],
    // the following 3 parameters are optional
    selectColumnNames: [`email`, `date_of_birth`],
    orderBy: [{columnName: `email`, direction: `ASC`}],
    limit: 100,
  });
}
```

```javascript
const {bulkSelect} = require('@databases/pg-bulk');
const {usersOptions} = require('./database');

async function getUsers() {
  return await bulkSelect({
    ...usersOptions,
    whereColumnNames: [`email`, `favorite_color`],
    whereConditions: [
      {email: `joe@example.com`, favorite_color: `red`},
      {email: `ben@example.com`, favorite_color: `blue`},
    ],
    // the following 3 parameters are optional
    selectColumnNames: [`email`, `date_of_birth`],
    orderBy: [{columnName: `email`, direction: `ASC`}],
    limit: 100,
  });
}
```

This is equivalent to:

```javascript
async function getUsers() {
  await database.query(sql`
    SELECT email, date_of_birth FROM users
    WHERE (email, favorite_color) IN (
      SELECT * FROM
        UNNEST(
          ${['joe@example.com', 'ben@example.com']}::TEXT[],
          ${['red', 'blue']}::TEXT[]
        )
    )
    ORDER BY email ASC
    LIMIT 100
  `);
}
```

This will return results that match: `(email='joe@example.com' AND favorite_color='red') OR (email='ben@example.com' AND favorite_color='blue'`, but unlike combining conditions in that way, it remains efficient even once you are selecting with thousands of possible conditions.

### bulkUpdate(options)

The `bulkUpdate` function is especially helpful as it's pretty much the only way to update multiple different records to different values in one go:

```typescript
import {bulkUpdate} from '@databases/pg-bulk';
import {usersOptions} from './database';

export async function updateFavoriteColors() {
  return await bulkUpdate({
    ...usersOptions,
    whereColumnNames: [`email`],
    setColumnNames: [`favorite_color`],
    updates: [
      {where: {email: `joe@example.com`}, set: {favorite_color: `indigo`}},
      {where: {email: `ben@example.com`}, set: {favorite_color: `orange`}},
    ],
  });
}
```

```javascript
const {bulkUpdate} = require('@databases/pg-bulk');
const {usersOptions} = require('./database');

async function updateFavoriteColors() {
  return await bulkUpdate({
    ...usersOptions,
    whereColumnNames: [`email`],
    setColumnNames: [`favorite_color`],
    updates: [
      {where: {email: `joe@example.com`}, set: {favorite_color: `indigo`}},
      {where: {email: `ben@example.com`}, set: {favorite_color: `orange`}},
    ],
  });
}
```

This is equivalent to:

```javascript
async function updateFavoriteColors() {
  await database.query(sql`
    UPDATE users
    SET
      favorite_color=bulk_query.updated_value_of_favorite_color
    FROM
      (
        SELECT * FROM
          UNNEST(
            ${['joe@example.com', 'ben@example.com']}::TEXT[],
            ${['indigo', 'orange']}::TEXT[]
          )
          AS t(email, updated_value_of_favorite_color)
      ) AS bulk_query
    WHERE
      users.email=bulk_query.email
  `);
}
```

This will efficiently update all records in a single statement.

### bulkDelete(options)

The bulk delete API lets you delete multiple records using different conditions in one go:

```typescript
import {bulkDelete} from '@databases/pg-bulk';
import {usersOptions} from './database';

export async function deleteUsers() {
  return await bulkDelete({
    ...usersOptions,
    whereColumnNames: [`email`, `favorite_color`],
    whereConditions: [
      {email: `joe@example.com`, favorite_color: `red`},
      {email: `ben@example.com`, favorite_color: `blue`},
    ],
  });
}
```

```javascript
const {bulkDelete} = require('@databases/pg-bulk');
const {usersOptions} = require('./database');

async function deleteUsers() {
  return await bulkDelete({
    ...usersOptions,
    whereColumnNames: [`email`, `favorite_color`],
    whereConditions: [
      {email: `joe@example.com`, favorite_color: `red`},
      {email: `ben@example.com`, favorite_color: `blue`},
    ],
  });
}
```

This is equivalent to:

```javascript
async function getUsers() {
  await database.query(sql`
    DELETE FROM users
    WHERE (email, favorite_color) IN (
      SELECT * FROM
        UNNEST(
          ${['joe@example.com', 'ben@example.com']}::TEXT[],
          ${['red', 'blue']}::TEXT[]
        )
    )
  `);
}
```

This will delete records that match: `(email='joe@example.com' AND favorite_color='red') OR (email='ben@example.com' AND favorite_color='blue'`, but unlike combining conditions in that way, it remains efficient even once you are deleting with thousands of possible conditions.
