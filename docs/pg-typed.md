---
id: pg-typed
title: '@databases/pg-typed'
sidebar_label: PG Typed
---

pg-typed provides APIs to query Postgres databases with genuine type safety via TypeScript.

## Setup

For detailed instructions on how to generate the types you need for pg-typed, start by reading the [Postgres with TypeScript Guide](pg-guide-typescript.md).

The `tables` function returns an object for each database table, allowing you to insert, query, update & delete records in that table. To use each table, you pass in the database connection or transaction, and then call the relevant method. Taking the connection at this late stage allows you to use pg-typed within transactions that span multiple tables.

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/pg';
import tables from '@databases/pg-typed';
import DatabaseSchema, {databaseSchema} from './__generated__';

export {sql};

const db = createConnectionPool();
export default db;

const {users, posts} = tables<DatabaseSchema>();
export {users, posts};
```

```javascript
// Using pg-typed with JavaScript is not recommended, but in theory it will still work.

const tables = require('@databases/pg-typed');
const db = require('./database');

const {users, posts} = tables({databaseSchema});
module.exports = {users, posts};
```

## Table

### insert(...records)

Inserts records into the database table. If you pass multiple records to `insert`, they will all be added "atomically", i.e. either all of the records will be added, or none of them will be added.

```typescript
import db, {users} from './database';

export async function createUsers() {
  const [alice, ben, cathy] = await users(db).insert(
    {email: `alice@example.com`, favorite_color: `blue`},
    {email: `ben@example.com`, favorite_color: `blue`},
    {email: `cathy@example.com`, favorite_color: `blue`},
  );
  console.log(alice, ben, cathy);
}
```

You can also use the `...spread` syntax if you want to insert an unknown number of records:

```typescript
import db, {users} from './database';

export async function createUsers(emails: string[]) {
  const users = await users(db).insert(
    ...emails.map((email) => ({
      email,
      favorite_color: `blue`,
    })),
  );
  console.log(users);
}
```

### insertOrUpdate(keys, ...records)

This method is sometimes called **"upsert"**, we call it **"insertOrUpdate"** because we think that is easier to understand.

If you have a unique constraint on certain columns within your table, e.g. the `email` column in our `users` table, you can use `insertOrUpdate` to create a record if it does not exist, and update it if it does. You must pass the list of columns you want to check for conflicts on as the first parameter.

```typescript
import db, {users} from './database';

export async function setFavoriteColor(email: string, favoriteColor: string) {
  const [insertedOrUpdatedUser] = await users(db).insertOrUpdate([`email`], {
    email,
    favorite_color: favoriteColor,
  });
  console.log(insertedOrUpdatedUser);
}
```

Just like with `insert`, you can use spread to insert/update many records at once.

```typescript
import db, {users} from './database';

export async function setFavoriteColor(
  emails: string[],
  favoriteColor: string,
) {
  const insertedOrUpdatedUsers = await users(db).insertOrUpdate(
    [`email`],
    ...emails.map((email) => ({
      email,
      favorite_color: favoriteColor,
    })),
  );
  console.log(insertedOrUpdatedUsers);
}
```

### insertOrIgnore(...records)

This is similar to `insertOrUpdate`, except that when a conflict is encountered, it simply ignores the record. Only the records that were successfully inserted are returned.

```typescript
import db, {users} from './database';

export async function checkUsersExist(emails: string[]) {
  const insertedUsers = await users(db).insertOrIgnore(
    ...emails.map((email) => ({
      email,
      favorite_color: `blue`,
    })),
  );
  console.log(insertedUsers);
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

### findOneRequired(whereValues)

If you know a record exists, you can use `findOneRequired` instead of `findOne`. This will throw an error if the record does not exist.

```typescript
import db, {users} from './database';

export async function getFavoriteColor(email: string) {
  const user = await users(db).findOneRequired({email});
  return user.favorite_color;
}
```

You can use `isNoResultFoundError` to test a caught exception to see if it is the result of a `findOneRequired` call failing to return any results.

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

Finds all the records that match the `whereValues` condition and sets all the properties specified in `updateValues`. Any properties you do not include in `updateValues` will not be modified. The updated records are returned.

```typescript
import db, {users} from './database';

export async function updateFavoriteColor(
  email: string,
  favoriteColor: string,
) {
  const updatedUsers = await users(db).update(
    {email},
    {favorite_color: favoriteColor},
  );
  console.log(updatedUsers);
}
```

You can use more complex queries to update many records in one go:

```typescript
import {anyOf} from '@databases/pg-typed';
import db, {users} from './database';

export async function updateFavoriteColor(
  emails: string[],
  favoriteColor: string,
) {
  const updatedUsers = await users(db).update(
    {email: anyOf(emails)},
    {favorite_color: favoriteColor},
  );
  console.log(updatedUsers);
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
import {anyOf} from '@databases/pg-typed';
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

### bulkFind(options)

This is like the regular `.find(condition)` API, but it lets you specify multiple distinct conditions that are efficiently or'ed together. Once you've started a query using `bulkFind` you can call `.orderByAsc`/`.orderByDesc`/`.select`/etc. just like you could if you started a query with a call to `find`. You can find more details on how this API works in [@databases/pg-bulk](pg-bulk.md).

```typescript
async function getPosts() {
  await tables
    .posts(db)
    .bulkFind({
      whereColumnNames: [`org_id`, `user_id`],
      whereConditions: [
        {org_id: 1, user_id: 10},
        {org_id: 2, user_id: 20},
      ],
    })
    .all();
}
```

### bulkInsert(options)

To insert thousands of records at a time, you can use the bulk insert API. This requires you to specify any optional fields that you want to pass in. Any required (i.e. `NOT NULL` and no default value) fields are automatically expected. You can find more details on how this API works in [@databases/pg-bulk](pg-bulk.md).

```typescript
async function insertUsers() {
  // This example assumes that `email` is a non-nullable field
  await tables.users(db).bulkInsert({
    columnsToInsert: [`favorite_color`],
    records: [
      {email: `joe@example.com`, favorite_color: `red`},
      {email: `ben@example.com`, favorite_color: `green`},
      {email: `tom@example.com`, favorite_color: `blue`},
      {email: `clare@example.com`, favorite_color: `indigo`},
    ],
  });
}
```

### bulkUpdate(options)

Updating multiple records in one go, where each record needs to be updated to a different value can be tricky to do efficiently. If there is a unique constraint, it may be possible to use `insertOrUpdate`, but failing that you'll want to use this bulk API. You can find more details on how this API works in [@databases/pg-bulk](pg-bulk.md).

```typescript
async function updateUsers() {
  // This example assumes that `email` is a non-nullable field
  await tables.users(db).bulkUpdate({
    whereColumnNames: [`email`],
    setColumnNames: [`favorite_color`],
    updates: [
      {where: {email: `joe@example.com`}, set: {favorite_color: `green`}},
      {where: {email: `ben@example.com`}, set: {favorite_color: `blue`}},
      {where: {email: `tom@example.com`}, set: {favorite_color: `indigo`}},
      {where: {email: `clare@example.com`}, set: {favorite_color: `green`}},
    ],
  });
}
```

This will efficiently update all records in a single statement.

### bulkDelete(options)

The bulk delete API lets you delete multiple records using different conditions in one go. You can find more details on how this API works in [@databases/pg-bulk](pg-bulk.md).

```typescript
async function deletePosts() {
  await tables.posts(db).bulkDelete({
    whereColumnNames: [`org_id`, `user_id`],
    whereConditions: [
      {org_id: 1, user_id: 10},
      {org_id: 2, user_id: 20},
    ],
  });
}
```

This will delete results that match: `(org_id=1 AND user_id=10) OR (org_id=2 AND user_id=20)`. Unlike combining conditions in that way, it remains efficient even once you are deleting with thousands of possible conditions.

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

### one()

Return a single record (or null). If multiple records in the table match `whereValues`, an error is thrown. If no records match `whereValues`, `null` is returned. This is useful if you want to do `.findOne` but only need a sub-set of the fields.

```typescript
import db, {users} from './database';

export async function getFavoriteColor(email: string) {
  const user = await users(db).find({email}).select(`favorite_color`).one();
  return user?.favorite_color ?? `Unknown`;
}
```

### oneRequired()

If you know a record exists, you can use `onlyRequired` instead of `only`. This will throw an error if the record does not exist.

```typescript
import db, {users} from './database';

export async function getFavoriteColor(email: string) {
  const user = await users(db)
    .find({email})
    .select(`favorite_color`)
    .oneRequired();
  return user.favorite_color;
}
```

You can use `isNoResultFoundError` to test a caught exception to see if it is the result of a `.oneRequired()` call failing to return any results.

## FieldQuery

### anyOf(valuesOrFieldQueries)

Match any of the supplied values. For example, to get users who like blue or green:

```typescript
import {anyOf} from '@databases/pg-typed';
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
import {anyOf, not} from '@databases/pg-typed';
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
import {lt} from '@databases/pg-typed';
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
import {gt} from '@databases/pg-typed';
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
import {inQueryResults} from '@databases/pg-typed';
import db, {users, sql} from './database';

export async function getUsersWithValidPreference() {
  return await users(db)
    .find({
      favorite_color: inQueryResults(sql`SELECT color FROM valid_colors;`),
    })
    .all();
}
```

### key(fieldName, whereClause)

There is also a helper on the table itself to allow you to do `inQueryResults`, but in a type safe way:

```typescript
import {inQueryResults} from '@databases/pg-typed';
import db, {users, valid_colors, posts} from './database';

export async function getUsersWithValidPreference() {
  return await users(db)
    .find({
      favorite_color: valid_colors.key(`color`),
    })
    .all();
}
export async function getPostsByUserEmail(email: string) {
  return await posts(db)
    .find({
      created_by_id: users.key(`id`, {email}),
    })
    .all();
}
```
