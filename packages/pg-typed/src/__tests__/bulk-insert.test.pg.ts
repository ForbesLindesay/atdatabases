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

test('create users in bulk', async () => {
  await users(db).delete({});
  // the default value won't work with bulk insert, but otherwise it should all function fine
  const [forbes, ellie, john] = await users(db).bulkInsert(
    {
      screen_name: sql`TEXT`,
      age: sql`INT`,
      bio: sql`TEXT`,
    },
    [
      {screen_name: 'Forbes'},
      {screen_name: 'Ellie', age: 10},
      {screen_name: 'John', bio: 'Hello world'},
    ],
  );
  expect([forbes, ellie, john]).toEqual([
    {
      age: null,
      bio: null,
      id: expect.any(Number),
      screen_name: 'Forbes',
    },
    {
      age: 10,
      bio: null,
      id: expect.any(Number),
      screen_name: 'Ellie',
    },
    {
      age: null,
      bio: 'Hello world',
      id: expect.any(Number),
      screen_name: 'John',
    },
  ]);
});

test('benchamark', async () => {
  await users(db).delete({});
  const usersToInsert = Array.from({length: 1_000}).map((_, i) => ({
    screen_name: `User${i}`,
    age: 10,
  }));
  const bulk = await testBulk();
  const normal = await testNormal();

  async function testBulk() {
    const start = Date.now();
    const insertedUsers = await users(db).bulkInsert(
      {
        screen_name: sql`TEXT`,
        age: sql`INT`,
      },
      usersToInsert,
    );
    const end = Date.now();
    expect(
      insertedUsers.map((u) => ({screen_name: u.screen_name, age: u.age})),
    ).toEqual(usersToInsert);

    await users(db).delete({});

    return end - start;
  }

  async function testNormal() {
    const start = Date.now();
    const insertedUsers = await users(db).insert(...usersToInsert);
    const end = Date.now();
    expect(
      insertedUsers.map((u) => ({screen_name: u.screen_name, age: u.age})),
    ).toEqual(usersToInsert);

    await users(db).delete({});
    return end - start;
  }

  console.info(`bulk insert = ${bulk}ms`);
  console.info(`normal insert = ${normal}ms`);
});
