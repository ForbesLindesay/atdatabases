import connect, {sql} from '@databases/pg';

const SCHEMA_NAME = `unnest_blog_post`;
const TABLE_NAME = `users`;
const table = sql.ident(SCHEMA_NAME, TABLE_NAME);

const db = connect({bigIntMode: 'number'});

afterAll(async () => {
  await db.dispose();
});

test('create schema', async () => {
  await db.query(sql`CREATE SCHEMA ${sql.ident(SCHEMA_NAME)}`);
  await db.query(sql`
    CREATE TABLE ${table} (
      email TEXT NOT NULL PRIMARY KEY,
      favorite_color TEXT NOT NULL
    );
  `);
});

test('insert', async () => {
  const p = [
    ['joe@example.com', 'ben@example.com', 'mary@example.com'],
    ['red', 'green', 'indigo'],
  ];
  await db.query(sql`
    INSERT INTO ${table} (email, favorite_color)
    SELECT * FROM UNNEST(${p[0]}::TEXT[], ${p[1]}::TEXT[])
  `);
  expect(await db.query(sql`SELECT * FROM ${table}`)).toMatchInlineSnapshot(`
    Array [
      Object {
        "email": "joe@example.com",
        "favorite_color": "red",
      },
      Object {
        "email": "ben@example.com",
        "favorite_color": "green",
      },
      Object {
        "email": "mary@example.com",
        "favorite_color": "indigo",
      },
    ]
  `);
});

test('update', async () => {
  const p = [
    ['joe@example.com', 'ben@example.com', 'mary@example.com'],
    ['purple', 'violet', 'orange'],
  ];
  await db.query(sql`
    UPDATE ${table}
    SET
      favorite_color=bulk_query.updated_favorite_color
    FROM
      (
        SELECT *
        FROM
          UNNEST(${p[0]}::TEXT[], ${p[1]}::TEXT[])
          AS t(email, updated_favorite_color)
      ) AS bulk_query
    WHERE
      users.email=bulk_query.email
  `);
  expect(await db.query(sql`SELECT * FROM ${table}`)).toMatchInlineSnapshot(`
    Array [
      Object {
        "email": "joe@example.com",
        "favorite_color": "purple",
      },
      Object {
        "email": "ben@example.com",
        "favorite_color": "violet",
      },
      Object {
        "email": "mary@example.com",
        "favorite_color": "orange",
      },
    ]
  `);
});

test('select', async () => {
  const p = [
    ['joe@example.com', 'ben@example.com', 'mary@example.com'],
    ['purple', 'violet', 'orange'],
  ];
  expect(
    await db.query(sql`
      SELECT * FROM ${table}
      WHERE (email, favorite_color) IN (
        SELECT *
        FROM UNNEST(${p[0]}::TEXT[], ${p[1]}::TEXT[])
      )
    `),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "email": "joe@example.com",
        "favorite_color": "purple",
      },
      Object {
        "email": "ben@example.com",
        "favorite_color": "violet",
      },
      Object {
        "email": "mary@example.com",
        "favorite_color": "orange",
      },
    ]
  `);
  expect(
    await db.query(sql`
      SELECT users.* FROM ${table}
      INNER JOIN (
        SELECT *
        FROM
          UNNEST(${p[0]}::TEXT[], ${p[1]}::TEXT[])
          AS t(email, favorite_color)
      ) AS unnest_query
      ON (
        LOWER(users.email) = LOWER(unnest_query.email)
        AND LOWER(users.favorite_color) = LOWER(unnest_query.favorite_color)
      )
    `),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "email": "joe@example.com",
        "favorite_color": "purple",
      },
      Object {
        "email": "ben@example.com",
        "favorite_color": "violet",
      },
      Object {
        "email": "mary@example.com",
        "favorite_color": "orange",
      },
    ]
  `);
});

test('update', async () => {
  const p = [
    ['joe@example.com', 'ben@example.com', 'mary@example.com'],
    ['purple', 'violet', 'orange'],
  ];
  await db.query(sql`
    DELETE FROM ${table}
    WHERE (email, favorite_color) IN (
      SELECT *
      FROM UNNEST(${p[0]}::TEXT[], ${p[1]}::TEXT[])
    )
  `);
  expect(await db.query(sql`SELECT * FROM ${table}`)).toMatchInlineSnapshot(
    `Array []`,
  );
});
