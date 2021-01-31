---
id: split-sql-query
title: @databases/split-sql-query
sidebar_label: split-sql-query
---

The `@databases/split-sql-query` package allows you to automatically split an `SQLQuery` into an array of `SQLQuery`s where each query contains one statement.

## API

```typescript
/**
 * Test whether the query has any parameters, or whether it is just a static
 * string. Returns `true` if there are parameters.
 */
export function hasValues(query: SQLQuery): boolean;

/**
 * A faster test for whether an SQLQuery is likely to contain multiple statements
 *
 * It is possible for a single query to return `true` if it has a `;` in a comment
 * or in a string literal/identifier name. If `hasSemicolonBeforeEnd` returns `false`
 * you can trust that the query is a single statement.
 */
export function hasSemicolonBeforeEnd(query: SQLQuery): boolean;

/**
 * Split an SQLQuery into an array of statements
 */
export default function splitSqlQuery(query: SQLQuery): SQLQuery[];
```
