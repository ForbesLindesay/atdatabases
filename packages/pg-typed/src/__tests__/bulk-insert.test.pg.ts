import connect, {sql} from '@databases/pg';
import Schema from './__generated__';
import tables from '..';

const {users} = tables<Schema>({schemaName: 'typed_queries_bulk_insert'});

const db = connect({bigIntMode: 'number'});

afterAll(async () => {
  await db.dispose();
});

test('create schema', async () => {
  await db.query(sql`CREATE SCHEMA typed_queries_bulk_insert`);
  await db.query(
    sql`
      CREATE TABLE typed_queries_bulk_insert.users (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT UNIQUE NOT NULL,
        bio TEXT,
        age INT DEFAULT 42
      );
    `,
  );
});

test('create users', async () => {
  const [forbes, ellie, john] = await users(db).insert(
    {screen_name: 'Forbes'},
    {screen_name: 'Ellie', age: 10},
    {screen_name: 'John', bio: 'Hello world'},
  );
  expect([forbes, ellie, john]).toMatchInlineSnapshot(`
    Array [
      Object {
        "age": 42,
        "bio": null,
        "id": 1,
        "screen_name": "Forbes",
      },
      Object {
        "age": 10,
        "bio": null,
        "id": 2,
        "screen_name": "Ellie",
      },
      Object {
        "age": 42,
        "bio": "Hello world",
        "id": 3,
        "screen_name": "John",
      },
    ]
  `);
  const [forbes2, martin, ellie2, john2] = await users(db).insertOrIgnore(
    {screen_name: 'Forbes'},
    {screen_name: 'Martin'},
    {screen_name: 'Ellie', age: 10},
    {screen_name: 'John', bio: 'Hello world'},
  );
  expect([forbes2, martin, ellie2, john2]).toMatchInlineSnapshot(`
    Array [
      Object {
        "age": 42,
        "bio": null,
        "id": 5,
        "screen_name": "Martin",
      },
      undefined,
      undefined,
      undefined,
    ]
  `);
  const [forbes3, martin2, ellie3, john3] = await users(db).insertOrUpdate(
    ['screen_name'],
    {screen_name: 'Forbes', age: 20},
    {screen_name: 'Martin'},
    {screen_name: 'Ellie', age: 5},
    {screen_name: 'John', bio: 'Whatever world'},
  );
  expect([forbes3, martin2, ellie3, john3]).toMatchInlineSnapshot(`
    Array [
      Object {
        "age": 20,
        "bio": null,
        "id": 1,
        "screen_name": "Forbes",
      },
      Object {
        "age": 42,
        "bio": null,
        "id": 5,
        "screen_name": "Martin",
      },
      Object {
        "age": 5,
        "bio": null,
        "id": 2,
        "screen_name": "Ellie",
      },
      Object {
        "age": 42,
        "bio": "Whatever world",
        "id": 3,
        "screen_name": "John",
      },
    ]
  `);
});
