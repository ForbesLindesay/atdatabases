---
id: sql
title: Building SQL Queries
---

All SQL Databases in @databases use the same approach for building SQL Queries. Using tagged template literals gives you a powerful and flexible way of creating queries without opening yourself to SQL Injection attacks.

We do not do the escaping of SQL ourselves, instead we pass the query and parameters separately to the underlying database engine. This is both more secure and more performant.

## API

```ts
import sql from '@databases/sql';
```

### ``` sql`...` ```

Builds part of, or the whole of, an SQL query, safely interpreting the embedded expressions. You can use it for a basic SQL query with no parameters:

```ts
db.query(sql`SELECT * FROM users;`);
// => {text: 'SELECT * FROM users;', values: []}
```

You can interpolate values:

```ts
const id = 10;
db.query(sql`SELECT * FROM users WHERE id=${id};`);
// => {text: 'SELECT * FROM users WHERE id=$1;', values: [10]}
```

You can also interpolate other queries:

```ts
const FIELD_SET = sql`id, name`;
const id = 10;
db.query(sql`SELECT ${FIELD_SET} FROM users WHERE id=${id};`);
// => {text: 'SELECT id, name FROM users WHERE id=$1;', values: [10]}
```

### ``` sql.ident(...names) ```

If you want to dynamically include an identifier in a query, you can use `sql.identifier`. e.g.

```ts
const fieldName = 'id';
db.query(sql`SELECT ${sql.ident(fieldName)} FROM users;`);
// => {text: 'SELECT "id" FROM users;', values: []}
```

You can also specify identifiers with a schema/namespace using this approach.

```ts
const fieldName = sql.ident('u', 'id');
db.query(sql`SELECT ${fieldName} FROM users AS u;`);
// => {text: 'SELECT "u"."id" FROM users AS u;', values: []}
```

### ``` sql.value(val) ```

`sql.value(val)` acts as a shorthand for ``` sql`${val}` ```. It takes a value, and represents it with a placeholder in the resulting query.

```ts
const id = sql.value(10);
db.query(sql`SELECT * FROM users WHERE id=${id};`);
// => {text: 'SELECT * FROM users WHERE id=$1;', values: [10]}
```

### ``` sql.join(arrayOfFragments, delimiter) ```

Joins an array of SQLQuery values using the delimiter (which is treated as a raw SQL string). It properly handles joining the array of values and ensuring that the placeholders match up.

```ts
const arrayOfSqlFields = ["a", "b", "c", "d"].map(
  n => sql.identifier(n),
);

sql`SELECT ${sql.join(arrayOfSqlFields, sql`, `)}`;
// => {text: 'SELECT "a", "b", "c", "d";', values: []}

const arrayOfSqlConditions = [
  sql.query`a = ${1}`,
  sql.query`b = ${2}`,
  sql.query`c = ${3}`
];
sql`WHERE (${sql.join(arrayOfSqlConditions, sql`) AND (`)})`;
// => {text: 'WHERE (a = $1) AND (b = $2) AND (c = $3)', values: [1, 2, 3]}
```

> N.B. the delimiter should always be a string literal, never allow user input to be passed as the delimiter. If you allow user specified delimiters, it will lead to an SQL Injection Vulnerability.

### ``` sql.file(filename) ```

This reads a file containing an SQL query in utf8 text, and returns it as an SQLQuery. It's generally most useful for large blocks of SQL, like database migrations.

```ts
const migration = sql.file(`${__dirname}/my-migration.sql`);
db.query(migration);
```

> N.B. if you allow users to write to the files that you later read in as queries via this method, your code will be vulnerable to SQL Injeciton. Only read in trusted files created by your own team of developers.

### ``` sql.__dangerous__rawValue(str) ```

This is an escape hatch to allow you to take a string from a source you trust and treat it as an SQL query. There is almost always a better way.

```ts
const idSet = sql.__dangerous__rawValue('(1, 2, 3)');
db.query(sql`SELECT * FROM users WHERE id in ${idSet};`);
// => {text: 'SELECT * FROM users WHERE id in (1, 2, 3);', values: []}
```

> N.B. if you pass user input to this function, it will result in an SQL Injection Vulnerability. That is why it has such an odd name.

### ``` sql.registerFormatter(class, format) ```

The `registerFormatter` function allows you to add custom handling for a given class. Instead of just directly adding the value to the "values" array, this lets you write your own function that takes the value and returns an `SQLQuery`.

```ts
function padNumber(value, length) {
  let str = `${value}`;
  while (str.length < length) {
    str = '0' + str;
  }
  return str;
}

class DayDate {
  constructor(year: number, month: number, day: number) {
    this.year = year;
    this.month = month;
    this.day = day;
  }
}

sql.registerFormatter(DayDate, (date) => sql.value(
  `${padNumber(date.year, 4)}-${padNumber(date.month, 2)}-${padNumber(date.day, 2)}`,
));


db.query(sql`SELECT * FROM users WHERE dob = ${new DayDate(2018, 1, 20)};`);
// => {text: 'SELECT * FROM users WHERE dob = $1;', values: ['2018-01-20']}
```

### ``` SQLQuery.compile() ```

This returns an object with `{text: string, values: any[]}` where the `text` field contains the SQL query formatted for postgres. It also minifies the query using `pg-minify` by default. You can pass `SQLQuery.compile({minify: false})` to disable minifying.

### ``` SQLQuery.compileMySql() ```

This returns an object with `{text: string, values: any[]}` where the `text` field contains the SQL query formatted for MySQL. We also use this function to generate queries for SQLite as it has a very similar format.
