---
id: mysql-guide-typescript
title: MySQL with TypeScript
sidebar_label: TypeScript
---

All the APIs in @databases support TypeScript out of the box. @databases is written in TypeScript after all!

Unfortunately TypeScript doesn't have any built in knowledge of your database schema. This means you will need to do a little bit of extra setup work if you want your database queries to be truly type safe.

In this guide we will be setting up `@databases/mysql-typed`. Everything in `@databases/mysql-typed` is built on top of `@databases/mysql`, so you always have that escape hatch if you ever need to write SQL without type safety but with all the other guarantees and assistance `@databases/mysql` provides.

## Installing dependencies

In addition to the packages you've already installed, you will need to install 2 more:

```yarn
yarn add @databases/mysql-typed @databases/mysql-schema-cli
```

```npm
npm install @databases/mysql-typed @databases/mysql-schema-cli
```

- `@databases/mysql-typed` provides type safe methods for querying database tables
- `@databases/mysql-schema-cli` generates type definitions from your database schema

## Generating your schema

To generate the types, you will need your database connection string from [Installation & Setup](mysql-guide-setup.md). You also need to have created the database tables you intend to query. Don't worry, if you change the schema later you can just re-run this CLI to update the types.

You can then generate types by running:

```npm
npx @databases/mysql-schema-cli \
  --database mysql://test-user:password@localhost:3306/ \
  --schemaName test-db \
  --directory src/__generated__
```

You will need to replace the connection string in this example with your actual connection string.

## Setting up mysql-typed

You should now have a folder called `__generated__` containing all the generated types. You can look through this and should see the types for each of your database tables. You can now update your `database.ts` file to also export a set of type safe APIs for your database.

```typescript
// database.ts

import createConnectionPool, {sql} from '@databases/mysql';
import tables from '@databases/mysql-typed';
import DatabaseSchema, {serializeValue} from './__generated__';

export {sql};

const db = createConnectionPool();
export default db;

// You can list whatever tables you actually have here:
const {users, posts} = tables<DatabaseSchema>({
  serializeValue,
});
export {users, posts};
```

## Insert, Select, Update, Delete

```typescript
import db, {users} from './database';

async function insertUser(email: string, favoriteColor: string) {
  await users(db).insert({email, favorite_color: favoriteColor});
}

async function updateUser(email: string, favoriteColor: string) {
  await users(db).update({email}, {favorite_color: favoriteColor});
}

async function deleteUser(email: string) {
  await users(db).delete({email});
}

async function getUser(email: string) {
  return await users(db).findOne({email});
}

async function run() {
  await insertUser('me@example.com', 'red');
  await updateUser('me@example.com', 'blue');

  const user = await getUser('me@example.com');
  console.log('user =', user);

  await deleteUser('me@example.com');

  await db.dispose();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## Transactions

Because the connection is passed to the table on each usage of the API, you can use all these type safe APIs in transactions:

```typescript
import db, {users} from './database';

async function run() {
  await db.tx(async (db) => {
    await users(db).update({email: `a@example.com`}, {favorite_color: `green`});
    await users(db).update({email: `b@example.com`}, {favorite_color: `blue`});
  });

  await db.dispose();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## More Info

For more details on all the types of queries supported by `@databases/mysql-typed`, you can read the [mysql-typed API Docs](mysql-typed.md)
