---
id: escape-identifier
title: '@databases/escape-identifier'
sidebar_label: escape-identifier
---

The `@databases/escape-identifier` package escapes identifiers for use in SQL strings. Pass `{extended: true}` to enable unicode support. By default, identifiers are restricted to ASCII chracters

## API

### escapePostgresIdentifier(str: string, options: {extended: boolean}): string

Escapes a Postgres identifier.

See: https://www.postgresql.org/docs/9.1/sql-syntax-lexical.html

### escapeMySqlIdentifier(str: string, options: {extended: boolean}): string

Escapes a MySQL identifier.

See: https://dev.mysql.com/doc/refman/5.7/en/identifiers.html

### escapeSQLiteIdentifier(str: string, options: {extended: boolean}): string

Escapes a SQLite identifier.

See: https://sqlite.org/lang_keywords.html
