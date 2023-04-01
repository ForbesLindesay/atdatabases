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
import DatabaseSchema from './__generated__';

export {sql};

const db = createConnectionPool();
export default db;

const {users, posts} = tables<DatabaseSchema>({
  databaseSchema: require('./__generated__/schema.json'),
});
export {users, posts};
```

```javascript
// Using pg-typed with JavaScript is not recommended, but in theory it will still work.

const tables = require('@databases/pg-typed');
const db = require('./database');

const {users, posts} = tables({
  databaseSchema: require('./__generated__/schema.json'),
});
module.exports = {users, posts};
```

## Table

### initializer

The objects returned by the `tables` function are initialized with an optional argument represeting the connection(s) for the queries.

The initializer argument is a single `Queryable` (i.e. `ConnectionPool`, `Connection`, `Transaction` or `Cluster`).

```typescript
import db, {users} from './database';

export async function initialize() {
  // These 2 queries are not run in a transaction
  await users(db).find().all();
  await users(db).insert({
    email: `alice@example.com`,
    favorite_color: `blue`,
  });

  await db.tx(async (db) => {
    // These 2 queries are run in the same transaction
    await users(db).find().all();
    await users(db).insert({
      email: `alice@example.com`,
      favorite_color: `blue`,
    });
  });
}
```

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

By default, all the columns will be updated when a conflict is encountered. You can alternatively specify exactly which columns to update. For example:

```typescript
import db, {users} from './database';

export async function setFavoriteColor(
  emails: string[],
  favoriteColor: string,
) {
  const insertedOrUpdatedUsers = await users(db).insertOrUpdate(
    {onConflict: [`email`], set: [`updated_at`, `favorite_color`]},
    ...emails.map((email) => ({
      created_at: new Date(),
      updated_at: new Date(),
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

You can use SQL or the ComputedValue helpers to do more complex updates:

```typescript
import {anyOf, add, currentTimestamp} from '@databases/pg-typed';
import db, {users} from './database';

export async function updateLoginCount(emails: string[]) {
  const updatedUsers = await users(db).update(
    {email: anyOf(emails)},
    {login_count: add(1), updated_at: currentTimestamp()},
  );
  console.log(updatedUsers);
}

export async function toggleIsActive(emails: string[]) {
  const updatedUsers = await users(db).update(
    {email: anyOf(emails)},
    {is_active: sql`NOT(is_active)`},
  );
  console.log(updatedUsers);
}
```

If you don't want to return the updated records, or you only want to return a subset of fields, you can pass the `columnsToReturn` option:

```typescript
import {anyOf, add, currentTimestamp} from '@databases/pg-typed';
import db, {users} from './database';

export async function updateLoginCount(emails: string[]) {
  await users(db).update(
    {email: anyOf(emails)},
    {login_count: add(1), updated_at: currentTimestamp()},
    {columnsToReturn: []},
  );
}

export async function toggleIsActive(emails: string[]) {
  const updatedUsers = await users(db).update(
    {email: anyOf(emails)},
    {is_active: sql`NOT(is_active)`},
    {columnsToReturn: [`email`, `is_active`]},
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

### conditionToSql(whereValues, tableAlias)

If you want to build parts of the query yourself, you can still use pg-typed to help you construct the condition in your where clause. This can be useful for join statements. In the following example the condition is very simple, so it might have been easier to simply write that SQL by hand, but in more complex conditions the type safety can still be helpful.

```typescript
import db, {users, blog_posts, DbUser, DbBlogPost} from './database';

interface ActiveUserBlogPost {
  username: DbUser['username'];
  title: DbBlogPost['title'];
}
async function activeUserBlogPosts(): Promise<ActiveUserBlogPost[]> {
  return await db.query(sql`
    SELECT u.username, b.title
    FROM users AS u
    INNER JOIN blog_posts AS b ON u.id=b.created_by_id
    WHERE ${users(db).conditionToSql({active: true}, `u`)}
  `);
}
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

To insert thousands of records at a time, you can use the bulk insert API. This requires you to specify any optional columns that you want to pass in. Any required (i.e. `NOT NULL` and no default value) columns are automatically expected. You can find more details on how this API works in [@databases/pg-bulk](pg-bulk.md). `bulkInsert` also returns the inserted records.

```typescript
async function insertUsers() {
  // This example assumes that `email` is a non-nullable column
  await tables.users(db).bulkInsert({
    columnsToInsert: [`favorite_color`],
    records: [
      {email: `joe@example.com`, favorite_color: `red`},
      {email: `ben@example.com`, favorite_color: `green`},
      {email: `tom@example.com`, favorite_color: `blue`},
      {email: `mary@example.com`, favorite_color: `indigo`},
    ],
  });
}
```

### bulkInsertOrIgnore(options)

Like `bulkInsert` except it will ignore conflicting inserts.

### bulkInsertOrUpdate(options)

Like `bulkInsert` except it will update records where insert would conflict.

```typescript
async function setUserFavoriteColors(
  users: {
    email: string;
    favorite_color: string;
  }[],
) {
  await tables.users(db).bulkInsertOrUpdate({
    columnsToInsert: [`email`, `favorite_color`],
    columnsThatConflict: [`email`],
    columnsToUpdate: [`favorite_color`],
    records: users,
  });
}
```

### bulkUpdate(options)

Updating multiple records in one go, where each record needs to be updated to a different value can be tricky to do efficiently. If there is a unique constraint, it may be possible to use `insertOrUpdate`, but failing that you'll want to use this bulk API. You can find more details on how this API works in [@databases/pg-bulk](pg-bulk.md). `bulkUpdate` also returns the updated records.

```typescript
async function updateUsers() {
  // This example assumes that `email` is a non-nullable column
  await tables.users(db).bulkUpdate({
    whereColumnNames: [`email`],
    setColumnNames: [`favorite_color`],
    updates: [
      {where: {email: `joe@example.com`}, set: {favorite_color: `green`}},
      {where: {email: `ben@example.com`}, set: {favorite_color: `blue`}},
      {where: {email: `tom@example.com`}, set: {favorite_color: `indigo`}},
      {where: {email: `mary@example.com`}, set: {favorite_color: `green`}},
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

A `SelectQuery` is a query for records within a table. The actual query is sent when you call one of the methods that returns a `Promise`, i.e. `all()`, `one()`, `oneRequired()`, `first()` or `limit(count)`.

### andWhere(condition)

This lets you add extra conditions to a `.bulkFind` query. e.g.

```typescript
import {gt} from '@databases/pg-typed';
import db, {users} from './database';

export async function getPostsSince(since: Date) {
  await tables
    .posts(db)
    .bulkFind({
      whereColumnNames: [`org_id`, `user_id`],
      whereConditions: [
        {org_id: 1, user_id: 10},
        {org_id: 2, user_id: 20},
      ],
    })
    .andWhere({created_at: gt(since)})
    .all();
}
```

### distinct(...columns)

Only return distinct results for the given columns. If you call `.distinct()` without passing any column names, the entire row is checked. You cannot specify a sort order using `.orderByAsc`/`.orderByDesc` if you are using `.distinct` and you cannot rely on the data being returned in any particular order. If you need to only return distinct rows and sort your data, you should use `.orderByAscDistinct` or `.orderByDescDistinct` instead.

### select(...columns)

Only return the provided columns. This can be useful if you have database records with many columns or where some columns are very large, and you typically only care about a small subset of the columns. The default is to return all columns, i.e. `*`.

```typescript
import db, {users} from './database';

export async function getEmails() {
  const records = await users(db).find().select(`email`).all();
  return records.map((record) => record.email);
}
```

### toSql()

If you want to run the query yourself, or perhaps use it as part of another more complex query, you can use the `toSql` method to return the SQLQuery

Example:

```typescript
import db, {users} from './database';

export async function getDistinctUserFirstNamesCount(): Promise<number> {
  const distinctFirstNameQuery = users(db)
    .find()
    .distinct(`first_name`)
    .toSql();
  const records = await db.query(sql`
    SELECT COUNT(*) AS row_count FROM (${distinctFirstNameQuery}) AS u
  `);
  return parseInt(`${records[0].row_count}`, 10);
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

### orderByAscDistinct(key) / orderByDescDistinct(key)

Sort the records by the provided key and only return the first occurrence of each key. You can chain multiple calls to `orderByAscDistinct` or `orderByDescDistinct` with different keys to require more columns to have distinct value.

```typescript
import db, {users} from './database';

export async function getLatestPostVersions() {
  return await post_versions(db)
    .find()
    .orderByAscDistinct(`id`)
    .orderByDesc(`version`)
    .all();
}
export async function getOldestPostVersions() {
  return await post_versions(db)
    .find()
    .orderByAscDistinct(`id`)
    .orderByAsc(`version`)
    .all();
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

Return a single record (or null). If multiple records in the table match `whereValues`, an error is thrown. If no records match `whereValues`, `null` is returned. This is useful if you want to do `.findOne` but only need a sub-set of the columns.

```typescript
import db, {users} from './database';

export async function getFavoriteColor(email: string) {
  const user = await users(db).find({email}).select(`favorite_color`).one();
  return user?.favorite_color ?? `Unknown`;
}
```

### oneRequired()

If you know a record exists, you can use `oneRequired` instead of `one`. This will throw an error if the record does not exist.

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

### allOf(valuesOrFieldQueries)

Match all of the supplied values. For example, to get posts within a time range:

```typescript
import {allOf, anyOf} from '@databases/pg-typed';
import db, {posts} from './database';

/**
 * Get posts where:
 *
 *   timestamp >= start AND timestamp < end
 */
async function getPostsBetween(start: Date, end: Date) {
  return await posts(db)
    .find({
      timestamp: allOf([anyOf([greaterThan(start), start]), lessThan(end)]),
    })
    .all();
}
```

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

### caseInsensitive(valueOrFieldQuery)

Match the supplied string while ignoring case.

```typescript
import {caseInsensitive} from '@databases/pg-typed';
import db, {users} from './database';

/**
 * Return true if there is a user with this username, ignoring
 * the case of the user, so ForbesLindesay would be equivalent
 * to forbeslindesay
 */
async function userExists(username: string) {
  return (
    0 !==
    (await users(db).count({
      username: caseInsensitive(username),
    }))
  );
}
```

### jsonPath(path, value)

Match the supplied value against the given path in a `JSON`/`JSONB` column.

```typescript
import {jsonPath} from '@databases/pg-typed';
import db, {events} from './database';

/**
 * return events where:
 *
 *   event_data.type = 'FEEDBACK'
 */
async function getFeedbackEvents() {
  return await events(db)
    .find({
      event_data: jsonPath(['type'], 'feedback'),
    })
    .all();
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

### key(columnName, whereClause)

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

## or(conditions) / and(conditions)

To `or`/`and` values/conditions for a single column, you can use `anyOf`/`allOf`, but the `or` utility helps if you want to have multiple distinct queries. If you anticipate many conditions in an or, you may be get better performance by using `.bulkFind`/`.bulkDelete` instead of `or`.

```typescript
import {or, and, greaterThan} from '@databases/pg-typed';
import db, {posts, User} from './database';

/**
 * return posts where:
 *
 *   user_id=${authorId}
 *   AND (
 *     (is_public IS TRUE AND view_count > 1000)
 *     OR (is_public IS FALSE AND view_count > 100)
 *   )
 */
async function getPopularPostsByAuthor(authorId: User['id']) {
  return await posts(db)
    .find(
      and(
        {user_id: authorId},
        or(
          {
            is_public: true,
            view_count: greaterThan(1_000),
          },
          {
            is_public: false,
            view_count: greaterThan(100),
          },
        ),
      ),
    )
    .all();
}
```

You can often avoid using the `and` helper by simply duplicating some columns in the query:

```typescript
import {or, greaterThan} from '@databases/pg-typed';
import db, {posts, User} from './database';

/**
 * return posts where:
 *
 *   (user_id=${authorId} AND is_public IS TRUE AND view_count > 1000)
 *   OR (user_id=${authorId} AND is_public IS FALSE AND view_count > 100)
 */
async function getPopularPostsByAuthor(authorId: User['id']) {
  return await posts(db)
    .find(
      or(
        {
          user_id: authorId,
          is_public: true,
          view_count: greaterThan(1_000),
        },
        {
          user_id: authorId,
          is_public: false,
          view_count: greaterThan(100),
        },
      ),
    )
    .all();
}
```

## Computed Values

In many places it is possible to use a computed value that will be resolved by Postgres.

### currentTimestamp()

This is equivalent to the SQL query `CURRENT_TIMESTAMP` it can often be used in places where you might otherwise use a `Date`.

### add(a, b)

`add(a, b?)` returns a `Value<number>` that can be used in many places where you would otherwise use a `number`.

This adds two numbers together within Postgres. It is primarily useful when one of the two values is not a simple `number`. If you are using it in an `update` statement, the second value is optional and defaults to the current value of the column being updated. The values can be any positive or negative integer, or even an SQL query that returns an integer.

```typescript
import {add, currentTimestamp} from '@databases/pg-typed';
import db, {users} from './database';

export async function updateLoginCount(email: string) {
  return await users(db).update(
    {email},
    {login_count: add(1), updated_at: currentTimestamp()},
  );
}
```

### add(timestamp, interval) / add(interval)

`add(timestamp, interval)` returns a `Value<Date>` that can be used in many places where you would otherwise use a `Date`.

This adds `interval` to `timestamp` within Postgres. It is primarily useful when `timestamp` is not a simple `Date`. If you are using it in an `update` statement, the `timestamp` is optional and defaults to the current value of the column being updated.

The `interval` should be an interval string that will be understood by Postgres, such as `"1 HOUR"` or `"-1 DAY"`.

```typescript
import {gt, increment, currentTimestamp} from '@databases/pg-typed';
import db, {users} from './database';

export async function getUsersUpdatedInPast24Hours() {
  return await users(db)
    .find({updated_at: gt(add(currentTimestamp(), '-24 HOUR'))})
    .all();
}
```
