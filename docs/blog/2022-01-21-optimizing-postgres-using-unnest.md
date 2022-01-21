---
title: 'Postgres UNNEST cheat sheet for bulk operations'
author: Forbes Lindesay
authorURL: http://twitter.com/ForbesLindesay
authorTwitter: ForbesLindesay
googleSummary: UNNEST is the only way to make Postgres queries fast and reliable, if you want to interact thousands of rows at a time.
ogSummary: UNNEST is the only way to make Postgres queries fast and reliable, if you want to interact thousands of rows at a time.
---

Postgres is normally very fast, but it can become slow (or even fail completely), if you hae too many parameters in your queries. When it comes to operating on data in bulk, `UNNEST` is the only way to achieve fast, reliable queries. This post has examples for using `UNNEST` to do all types of bulk transactions.

<!--truncate-->

## INSERT thousands of records in one go

To insert many records into a Postgres table in one go, the most efficient method is to provide each column as a separate array and then use `UNNEST` to construct the rows to insert.

You can run the following query:

```sql
INSERT INTO users (email, favorite_color)
SELECT
  UNNEST(?::TEXT[]),
  UNNEST(?::TEXT[])
```

With parameters like:

```json
[
  ["joe@example.com", "ben@example.com", "mary@example.com"],
  ["red", "green", "indigo"]
]
```

Notice that you're only passing 2 parameters, no matter how many rows you want to insert. You're also using the same query text no matter how many rows you want to insert. This is what keeps the query so efficient.

The resulting table would look like:

| email            | favorite_color |
| ---------------- | -------------- |
| joe@example.com  | red            |
| ben@example.com  | green          |
| mary@example.com | indigo         |

## UPDATE multiple records to different values in a single query

One of the most powerful use cases of `UNNEST` is to update multiple records in a single query. The normal `UPDATE` statement only really lets you update multiple records in one go if you want to set them all to the same value, but this approach is way more flexible.

You can run the following query:

```sql
UPDATE users
SET
  favorite_color=bulk_query.updated_favorite_color
FROM
  (
    SELECT
      UNNEST(?::TEXT[])
        AS email,
      UNNEST(?::TEXT[])
        AS updated_favorite_color
  ) AS bulk_query
WHERE
  users.email=bulk_query.email
```

```json
[
  ["joe@example.com", "ben@example.com", "mary@example.com"],
  ["purple", "violet", "orange"]
]
```

The resulting table would then look like:

| email            | favorite_color |
| ---------------- | -------------- |
| joe@example.com  | purple         |
| ben@example.com  | violet         |
| mary@example.com | orange         |

Not only does this let you update all these records in one statement, but the number of parameters remains fixed at 2 now matter how many rows you want to update.

## SELECT with thousands of different conditions in one go

You can always build a very large query by combining `OR` and `AND`, but eventually, if you have enough parameters, this may start to become slow.

You can run the following query:

```sql
SELECT * FROM users
WHERE (email, favorite_color) IN (
  SELECT
    UNNEST(?::TEXT[]),
    UNNEST(?::TEXT[])
)
```

With parameters like:

```json
[
  ["joe@example.com", "ben@example.com", "mary@example.com"],
  ["purple", "violet", "orange"]
]
```

and it will be equivalent to running:

```sql
SELECT * FROM users
WHERE
  (email='joe@example.com' AND favorite_color='purple')
  OR (email='ben@example.com' AND favorite_color='violet')
  OR (email='mary@example.com' AND favorite_color='orange')
```

Using `UNNEST` here lets us keep the query constant, and use only 2 parameters, regardless of how many conditions we want to add.

An alternative if you need more control can be to use an INNER JOIN instead of the `IN` part of the query. For example, if you needed the tests to be case insensitive you could do:

```sql
SELECT users.* FROM users
INNER JOIN (
  SELECT
    UNNEST(?::TEXT[]) AS email,
    UNNEST(?::TEXT[]) AS favorite_color
) AS unnest_query
ON (LOWER(users.email) = LOWER(unnest_query.email) AND LOWER(user.favorite_color) = LOWER(unnest_query.favorite_color))
```

## DELETE with thousands of different conditions in one go

Just like `SELECT`, `DELETE` queries can become slow if the complexity of your conditions grows too extreme.

You can run the following query:

```sql
DELETE FROM users
WHERE (email, favorite_color) IN (
  SELECT
    UNNEST(?::TEXT[]),
    UNNEST(?::TEXT[])
)
```

With parameters like:

```json
[
  ["joe@example.com", "ben@example.com", "mary@example.com"],
  ["purple", "violet", "orange"]
]
```

and it will be equivalent to running:

```sql
DELETE FROM users
WHERE
  (email='joe@example.com' AND favorite_color='purple')
  OR (email='ben@example.com' AND favorite_color='violet')
  OR (email='mary@example.com' AND favorite_color='orange')
```

Just like with using `UNNEST` here lets us keep the query constant, and use only 2 parameters, regardless of how many conditions we want to add.

An alternative if you need more control can be to use an INNER JOIN instead of the `IN` part of the query. For example, if you needed the tests to be case insensitive you could do:

```sql
SELECT users.* FROM users
INNER JOIN (
  SELECT
    UNNEST(?::TEXT[]) AS email,
    UNNEST(?::TEXT[]) AS favorite_color
) AS unnest_query
ON (LOWER(users.email) = LOWER(unnest_query.email) AND LOWER(user.favorite_color) = LOWER(unnest_query.favorite_color))
```

> If you're using node.js, you can do all these operations without having to memorize the syntax by using [`@database/pg-typed`](https://www.atdatabases.org/docs/pg-guide-typescript) or [`@database/pg-bulk`](https://www.atdatabases.org/docs/pg-bulk).
