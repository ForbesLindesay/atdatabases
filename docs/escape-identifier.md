---
id: escape-identifier
title: @databases/escape-identifier
sidebar_label: escape-identifier
---

The `@databases/escape-identifier` package escapes identifiers for use in SQL strings. Pass `{extended: true}` to enable unicode support. By default, identifiers are restricted to ASCII chracters

## API

```typescript
/**
 * Escapes a Postgres identifier.
 *
 * https://www.postgresql.org/docs/9.1/sql-syntax-lexical.html
 */
export function escapePostgresIdentifier(
  str: string,
  {
    extended,
  }?: {
    extended?: boolean;
  },
): string;

/**
 * Escapes a MySQL identifier.
 *
 * https://dev.mysql.com/doc/refman/5.7/en/identifiers.html
 */
export function escapeMySqlIdentifier(
  str: string,
  {
    extended,
  }?: {
    extended?: boolean;
  },
): string;

/**
 * Escapes an SQLite identifier.
 *
 * https://sqlite.org/lang_keywords.html
 */
export function escapeSQLiteIdentifier(str: string): string;
```
