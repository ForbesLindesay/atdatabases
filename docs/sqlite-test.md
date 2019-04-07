---
id: sqlite-test
title: SQLite Testing
sidebar_label: Testing
---

The `@databases/sqlite` module defaults to an in-memory database in node.js, meaning you can get an issolated database for every test run.

## Jest

Assuming you have a file that looks like:

```ts
// db.js
import connect, {sql} from '@databases/sqlite';

export {sql};

const db = connect('./data');
export default db;
```

You can add a mock:

```ts
// db.mock.js
import connect, {sql} from '@databases/sqlite';

export {sql};

const db = connect(); // in memory db
export default db;
```

Then in you test, you can tell jest to use your mock:

```ts
jest.setMock('../db', require('../db.mock'));
import db, {sql} from '../db';

test('createUser', async () => {
  await createUser('Joe Blogs', 'joe.blogs@example.com');
  expect(
    await db.query(sql`SELECT name, email FROM users`),
  ).toEqual(
    [{name: 'Joe Blogs', email: 'joe.blogs@example.com'}],
  );
});
```

The nice thing about this is every test gets its own issolated copy of the database.