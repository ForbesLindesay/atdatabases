---
title: 'A new utility for really big Postgres operations'
author: Forbes Lindesay
authorURL: http://twitter.com/ForbesLindesay
authorTwitter: ForbesLindesay
---

Postgres is very fast, but one limitation you may run into when dealing with big quantities of data is that Postgres fails if you have more than about 90,000 parameters in your query. It is also extremely fiddly to update multiple different records to different values in the same statement. People often resort to using hacks like intentionally triggering a conflict so you can use `ON CONFLICT DO UPDATE`.

<!--truncate-->

That all changes today. The newly released [`@databases/pg-bulk`](/docs/pg-bulk) lets you use the powerful `UNNEST` utility to write very high performance queries without all the difficult parts. For example, you can update multiple users in a single statement:

```typescript
await bulkUpdate({
  database,
  tableName: `users`,
  columnTypes: {
    email: sql`TEXT`,
    favorite_color: sql`TEXT`,
  },
  whereColumnNames: [`email`],
  setColumnNames: [`favorite_color`],
  updates: [
    {where: {email: `joe@example.com`}, set: {favorite_color: `Burgundy`}},
    {where: {email: `clare@example.com`}, set: {favorite_color: `Cream`}},
    {where: {email: `eleanor@example.com`}, set: {favorite_color: `Fuchsia`}},
  ],
});
```

To do this without `bulkUpdate` you'd either have to do 3 separate SQL statements, or hand code SQL while trying to remember how `UNNEST` works.

> If you'd like all the details of how `@databases/pg-bulk` uses `UNNEST` to make these statements work, you can find examples with the SQL statements that they would run in [the documentation for `@databases/pg-bulk`](/docs/pg-bulk)

## pg-typed

If you're using TypeScript, you can make this even easier by using [`@databases/pg-typed`](/docs/pg-typed). `pg-typed` exposes all the same APIs as `bulkUpdate` but with the added bonus of type safety and being able to auto-generate the `columnTypes` using `pg-schema-cli`. If you use that, the above example simplifies to just:

```typescript
await users(database).bulkUpdate({
  whereColumnNames: [`email`],
  setColumnNames: [`favorite_color`],
  updates: [
    {where: {email: `joe@example.com`}, set: {favorite_color: `Burgundy`}},
    {where: {email: `clare@example.com`}, set: {favorite_color: `Cream`}},
    {where: {email: `eleanor@example.com`}, set: {favorite_color: `Fuchsia`}},
  ],
});
```

## Other new pg-typed features

In addition to the new `bulkOperation` methods, [`@databases/pg-typed`](/docs/pg-typed) gained a few other small features.

You can now use `.findOneRequired` in place of `.findOne` to throw an error instead of returning `null` when a record is missing. This can simplify/clean up your app code for cases where you can be sure that the record does exist.

```typescript
function getPostWithAuthor(id: DbPost['id']) {
  const post = await posts(database).findOne({id});
  if (!post) return null;
  const author = await users(database).findOneRequired({id: post.author_id});
  return {post, author};
}
```

You can append `.one()` or `.oneRequired()` onto `SelectQuery`s. This lets you more easily load a subset of a single record. e.g.

```typescript
function getPostWithAuthorName(id: DbPost['id']) {
  const post = await posts(database).findOne({id});
  if (!post) return null;
  const author = await users(database)
    .select(`name`)
    .findOneRequired({id: post.author_id});
  return {post, author: author.name};
}
```

There's also a new type safe alternative to `inQueryResults`, making it easier to load related records in a single database round trip . e.g.

```typescript
function getPostAuthor(postId: DbPost['id']) {
  return await users(database).findOne({
    // find users where the id matches the
    // author_id field in posts where the post's
    // id is postId
    id: posts.key(`author_id`, {id: postId}),
  });
}
```

> P.S. did you know that all these utilities can be used in transactions. Just wrap any of the examples in `await database.tx(async database => {/* ... */})`. Passing the `database` in the callback ensures that all queries are run on that transaction.
