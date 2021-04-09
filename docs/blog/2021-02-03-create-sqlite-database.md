---
title: How to create an SQLite database in node.js
author: Forbes Lindesay
authorURL: http://twitter.com/ForbesLindesay
authorTwitter: ForbesLindesay
---

SQLite is a great database for embedded use cases. e.g. if you are using node.js in IOT, or an Electron app.

<!--truncate-->

To get started, install `@databases/sqlite` using either yarn or npm:

```yarn
yarn install @databases/sqlite
```

```npm
npm install @databases/sqlite
```

Then you can `import` it (if you are using TypeScript/Babel/some other environment that supports ESModules) or `require` it (if you are using plain JavaScript), and call `connect` to create the database file if it does not exist, and open it if it already exists.

Here is an example of using SQLite as a basic key value store of strings (here `VARCHAR` is the SQLite data type that is equivalent to `string` in JavaScript).

```typescript
import connect, {sql} from '@databases/sqlite';

const db = connect('temp.db');

async function prepare() {
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS app_data (
      id VARCHAR NOT NULL PRIMARY KEY,
      value VARCHAR NOT NULL
    );
  `);
}
const prepared = prepare();

async function set(id: string, value: string) {
  await prepared;
  await db.query(sql`
    INSERT INTO app_data (id, value)
      VALUES (${id}, ${value})
    ON CONFLICT (id) DO UPDATE
      SET value=excluded.value;
  `);
}

async function get(id: string): string | undefined {
  await prepared;
  const results = await db.query(sql`
    SELECT value FROM app_data WHERE id=${id};
  `);
  if (results.length) {
    return results[0].value;
  } else {
    return undefined;
  }
}

async function remove(id: string) {
  await prepared;
  await db.query(sql`
    DELETE FROM app_data WHERE id=${id};
  `);
}

async function run() {
  const runCount = JSON.parse((await get('run_count')) || '0');
  console.log('run count =', runCount);
  await set('run_count', JSON.stringify(runCount + 1));
  console.log(await get('name'));
  await set('name', 'Forbes');
  console.log(await get('name'));
  await set('name', 'Forbes Lindesay');
  console.log(await get('name'));
  remove('name');
}
run().catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
});
```

```javascript
const connect = require('@databases/sqlite');
const {sql} = require('@databases/sqlite');

const db = connect('temp.db');

async function prepare() {
  await db.query(sql`
    CREATE TABLE IF NOT EXISTS app_data (
      id VARCHAR NOT NULL PRIMARY KEY,
      value VARCHAR NOT NULL
    );
  `);
}
const prepared = prepare();

async function set(id, value) {
  await prepared;
  await db.query(sql`
    INSERT INTO app_data (id, value)
      VALUES (${id}, ${value})
    ON CONFLICT (id) DO UPDATE
      SET value=excluded.value;
  `);
}

async function get(id) {
  await prepared;
  const results = await db.query(sql`
    SELECT value FROM app_data WHERE id=${id};
  `);
  if (results.length) {
    return results[0].value;
  } else {
    return undefined;
  }
}

async function remove(id) {
  await prepared;
  await db.query(sql`
    DELETE FROM app_data WHERE id=${id};
  `);
}

async function run() {
  const runCount = JSON.parse((await get('run_count')) || '0');
  console.log('run count =', runCount);
  await set('run_count', JSON.stringify(runCount + 1));
  console.log(await get('name'));
  await set('name', 'Forbes');
  console.log(await get('name'));
  await set('name', 'Forbes Lindesay');
  console.log(await get('name'));
  remove('name');
}
run().catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
});
```

For more information, check out [the API docs for @databases/sqlite](https://www.atdatabases.org/docs/sqlite) and [the SQLite Language Docs](https://sqlite.org/lang.html).
