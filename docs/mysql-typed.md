---
id: mysql-typed
title: '@databases/mysql-typed'
sidebar_label: MySQL Typed
---

mysql-typed provides APIs to query MySQL databases with genuine type safety via TypeScript.

## Setup

For detailed instructions on how to generate the types you need for mysql-typed, start by reading the [MySQL with TypeScript Guide](mysql-guide-typescript.md).

The `tables` function returns an object for each database table, allowing you to insert, query, update & delete records in that table. To use each table, you pass in the database connection or transaction, and then call the relevant method. Taking the connection at this late stage allows you to use mysql-typed within transactions that span multiple tables.

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/mysql';
import tables from '@databases/mysql-typed';
import DatabaseSchema, {serializeValue} from './__generated__';

export {sql};

const db = createConnectionPool({serializeValue});
export default db;

const {users, posts} = tables<DatabaseSchema>();
export {users, posts};
```

```javascript
// Using mysql-typed with JavaScript is not recommended, but in theory it will still work.

const tables = require('@databases/mysql-typed');
const db = require('./database');

const {users, posts} = tables();
module.exports = {users, posts};
```

## Table

### insert(...records)

Inserts records into the database table. If you pass multiple records to `insert`, they will all be added "atomically", i.e. either all of the records will be added, or none of them will be added.

```typescript
import db, {users} from './database';

export async function createUsers() {
  await users(db).insert(
    {email: `alice@example.com`, favorite_color: `blue`},
    {email: `ben@example.com`, favorite_color: `blue`},
    {email: `cathy@example.com`, favorite_color: `blue`},
  );
}
```

You can also use the `...spread` syntax if you want to insert an unknown number of records:

```typescript
import db, {users} from './database';

export async function createUsers(emails: string[]) {
  await users(db).insert(
    ...emails.map((email) => ({
      email,
      favorite_color: `blue`,
    })),
  );
}
```

### findOne(whereValues)

Find a single record that matches `whereValues`. If multiple records in the table match `whereValues`, an error is thrown. If no records match `whereValues`, `null` is returned.

```typescript
import db, {users} from './database';

export async function getFavoriteColor(email: string) {
  const user = await users(db).findOne({email});
  return user?.favorite_color ?? `Unknown`;
}
```

### find(whereValues)

Start building a query for multiple database records.

### count(whereValues)

Count the records matching the `whereValues` condition.

```typescript
import db, {users} from './database';

export async function getNumberOfUsers(): Promise<number> {
  return await users(db).count();
}
export async function getNumberOfUsersWhoLike(color: string): Promise<number> {
  return await users(db).count({favorite_color: color});
}
```

### update(whereValues, updateValues)

Finds all the records that match the `whereValues` condition and sets all the properties specified in `updateValues`. Any properties you do not include in `updateValues` will not be modified.

```typescript
import db, {users} from './database';

export async function updateFavoriteColor(
  email: string,
  favoriteColor: string,
) {
  await users(db).update({email}, {favorite_color: favoriteColor});
}
```

You can use more complex queries to update many records in one go:

```typescript
import {anyOf} from '@databases/mysql-typed';
import db, {users} from './database';

export async function updateFavoriteColor(
  emails: string[],
  favoriteColor: string,
) {
  await users(db).update(
    {email: anyOf(emails)},
    {favorite_color: favoriteColor},
  );
}
```

### delete(whereValues)

Finds all the records that match the `whereValues` condition and deletes them.

```typescript
import db, {users} from './database';

export async function deleteUser(email: string) {
  await users(db).delete({email});
}
```

You can use more complex queries to delete many records in one go:

```typescript
import {anyOf} from '@databases/mysql-typed';
import db, {users} from './database';

export async function deleteUsers(emails: string[]) {
  await users(db).delete({email: anyOf(emails)});
}
```

### tableId

Returns the table name of the table, including the schema if provided, as a `SQLQuery`.

Useful to build complex SQL queries using JOINs, which currently can't be expressed using the `Table` methods.

```typescript
import db, {users} from './database';

export async function selectWithJoin() {
  const result = await db.query(sql`
    SELECT *
    FROM ${photos(db).tableId} AS p
    JOIN ${users(db).tableId} AS u
    ON p.owner_user_id = u.id
  `);
}
```

### tableName

Returns only the table name of the table, without any schema, as a string.

Useful to build complex SQL queries using JOINs, which currently can't be expressed using the `Table` methods.

```typescript
import db, {users} from './database';

users(db).tableName; // 'users'
```

## SelectQuery

A `SelectQuery` is a query for records within a table. The actual query is sent when you call one of the methods that returns a `Promise`, i.e. `all()`, `first()` or `limit(count)`.

### select(...fields)

Only return the provided fields. This can be useful if you have database records with many fields or where some fields are very large, and you typically only care about a small subset of the fields. The default is to return all fields, i.e. `*`.

```typescript
import db, {users} from './database';

export async function getEmails() {
  const records = await users(db).find().select(`email`).all();
  return records.map((record) => record.email);
}
```

### orderByAsc(key) / orderByDesc(key)

Sort the records by the provided key. You can chain multiple calls to `orderByAsc` or `orderByDesc` with different keys to further sort records that have the same value for the provided key.

```typescript
import db, {users} from './database';

export async function getEmailsAlphabetical() {
  const records = await users(db).find().orderByAsc(`email`).all();
  return records.map((record) => record.email);
}
```

### limit(count)

Return the first `count` rows. N.B. you can only use this method if you have first called `orderByAsc` or `orderByDesc` at least once.

```typescript
import db, {users} from './database';

// Example for an endless pagination. Expects an email to be passed in, from where it returns 10 more rows.
export async function paginatedEmails(nextPageToken?: string) {
  const records = await users(db)
    .find({
      ...(nextPageToken ? {email: gt(nextPageToken)} : {}),
    })
    .orderByAsc(`email`)
    .limit(10);
  return {
    records: records.map((record) => record.email),
    nextPageToken: records.length ? records[records.length - 1].email : null,
  };
}

export async function printAllEmails() {
  let page = await paginatedEmails();
  while (page.records.length) {
    for (const email of page.records) {
      console.log(email);
    }
    if (!page.nextPageToken) {
      break;
    }
    page = await paginatedEmails(page.nextPageToken);
  }
}
```

### limitOffset(count, offset)

Return the first `count` rows offset by `offset` number of rows.  N.B. you can only use this method if you have first called `orderByAsc` or `orderByDesc` at least once.

If you have a large number of rows (more than some thousands), using an offset is inefficient as it will scan through the results. For larger sets, see the endless pagination example above.

```typescript
import db, {users} from './database';

// Example for simple offset-based pagination
export async function offsetPaginatedEmails(offset?: number = 0) {
  const records = await users(db)
    .find()
    .orderByAsc(`email`)
    .limitOffset(10, offset);
  return {
    records: records.map((record) => record.email),
  };
}
```

### first()

Return the first record. If there are no records, `null` is returned. N.B. you can only use this method if you have first called `orderByAsc` or `orderByDesc` at least once.

```typescript
import db, {users} from './database';

export async function firstAlphabeticalUser() {
  const userOrNull = await users(db).find().orderByAsc(`email`).first();
  return userOrNull;
}
```

### all()

Return all matching records as an Array.

```typescript
import db, {users} from './database';

export async function getEmails() {
  const records = await users(db).find().all();
  return records.map((record) => record.email);
}
```

## FieldQuery

### anyOf(valuesOrFieldQueries)

Match any of the supplied values. For example, to get users who like blue or green:

```typescript
import {anyOf} from '@databases/mysql-typed';
import db, {users} from './database';

export async function getUsersWhoLikeBlueOrGreen() {
  const users = await users(db)
    .find({
      favorite_color: anyOf([`blue`, `green`]),
    })
    .all();
  return users;
}
```

### not(valueOrFieldQuery)

Match any value except the supplied value. You can combine this with any of the other FieldQuery utilities.

```typescript
import {anyOf, not} from '@databases/mysql-typed';
import db, {users} from './database';

export async function getCountOfUsersWhoDoNotLike(color: string) {
  const numberOfUsers = await users(db).count({
    favorite_color: not(color),
  });
  return numberOfUsers;
}
export async function getCountOfUsersWhoDoNotLikeAnyOf(colors: string[]) {
  const numberOfUsers = await users(db).count({
    favorite_color: not(anyOf(colors)),
  });
  return numberOfUsers;
}
```

### lt(value)

Match values less than the supplied value.

```typescript
import {lt} from '@databases/mysql-typed';
import db, {users} from './database';

const HOUR = 60 * 60 * 1000;
export async function getInactiveUsers(color: string) {
  return await users(db)
    .find({
      updated_at: lt(new Date(Date.now() - 24 * HOUR)),
    })
    .all();
}
```

### gt(value)

Match values greater than the supplied value.

```typescript
import {gt} from '@databases/mysql-typed';
import db, {users} from './database';

const HOUR = 60 * 60 * 1000;
export async function getActiveUsers(color: string) {
  return await users(db)
    .find({
      updated_at: gt(new Date(Date.now() - 24 * HOUR)),
    })
    .all();
}
```

### inQueryResults(query)

This is sometimes useful as an escape hatch. Normally there is a better way to handle these, but sometimes you just need a complex join on the database to figure out which records you want to return.

```typescript
import {inQueryResults} from '@databases/mysql-typed';
import db, {users, sql} from './database';

export async function getUsersWithValidPreference() {
  return await users(db)
    .find({
      favorite_color: inQueryResults(sql`SELECT color FROM valid_colors;`),
    })
    .all();
}
```
