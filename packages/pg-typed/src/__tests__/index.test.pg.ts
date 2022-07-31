import connect, {pgFormat, sql} from '@databases/pg';

import Schema from './__generated__';
import defineTables from '..';

const {users, photos} = defineTables<Schema>({
  schemaName: 'typed_queries_tests',
});

const db = connect({bigIntMode: 'number'});

afterAll(async () => {
  await db.dispose();
});

test('create schema', async () => {
  await db.query(sql`CREATE SCHEMA typed_queries_tests`);
  await db.query(
    sql`
      CREATE TABLE typed_queries_tests.users (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT UNIQUE NOT NULL,
        bio TEXT,
        age INT,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
      CREATE TABLE typed_queries_tests.photos (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        owner_user_id BIGINT NOT NULL REFERENCES typed_queries_tests.users(id),
        cdn_url TEXT NOT NULL,
        caption TEXT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ
      );
    `,
  );
});

test('attributes', () => {
  expect(users(db).tableName).toBe('users');
  expect(users(db).tableId.format(pgFormat).text).toBe(
    '"typed_queries_tests"."users"',
  );

  expect(photos(db).tableName).toBe('photos');
  expect(photos(db).tableId.format(pgFormat).text).toBe(
    '"typed_queries_tests"."photos"',
  );
});

test('create users', async () => {
  const [forbes, ellie] = await users(db).insert(
    {screen_name: 'Forbes'},
    {screen_name: 'Ellie'},
  );
  await photos(db).insert(
    {
      cdn_url: 'http://example.com/1',
      metadata: {},
      owner_user_id: forbes.id,
    },
    {
      cdn_url: 'http://example.com/2',
      metadata: {},
      owner_user_id: forbes.id,
    },
    {
      cdn_url: 'http://example.com/3',
      metadata: {},
      owner_user_id: forbes.id,
    },
    {
      cdn_url: 'http://example.com/4',
      metadata: {},
      owner_user_id: ellie.id,
      caption: null,
    },
  );
  const photoRecords = await photos(db)
    .find({owner_user_id: forbes.id})
    .orderByAsc('cdn_url')
    .limit(2);
  expect(photoRecords.map((p) => p.cdn_url)).toMatchInlineSnapshot(`
    Array [
      "http://example.com/1",
      "http://example.com/2",
    ]
  `);
  const photoRecordsOffset = await photos(db)
    .find({owner_user_id: forbes.id})
    .orderByAsc('cdn_url')
    .limitOffset(2, 1);
  expect(photoRecordsOffset.map((p) => p.cdn_url)).toMatchInlineSnapshot(`
    Array [
      "http://example.com/2",
      "http://example.com/3",
    ]
  `);

  const photoRecordsDesc = await photos(db)
    .find({owner_user_id: forbes.id})
    .orderByDesc('cdn_url')
    .limit(2);
  expect(photoRecordsDesc.map((p) => p.cdn_url)).toMatchInlineSnapshot(`
    Array [
      "http://example.com/3",
      "http://example.com/2",
    ]
  `);
  expect(await users(db).findOne({id: ellie.id})).toEqual(ellie);

  const updated = await photos(db).update(
    {cdn_url: 'http://example.com/1'},
    {
      metadata: {rating: 5},
    },
  );
  expect(updated.map((u) => [u.cdn_url, u.metadata])).toMatchInlineSnapshot(`
    Array [
      Array [
        "http://example.com/1",
        Object {
          "rating": 5,
        },
      ],
    ]
  `);

  const [forbes2, john] = await users(db).insertOrUpdate(
    ['screen_name'],
    {screen_name: 'Forbes', bio: 'Author of @databases'},
    {screen_name: 'John', bio: 'Just a random name'},
  );
  expect(forbes2.id).toBe(forbes.id);
  expect([forbes2.bio, john.bio]).toMatchInlineSnapshot(`
    Array [
      "Author of @databases",
      "Just a random name",
    ]
  `);

  await photos(db).delete({cdn_url: 'http://example.com/2'});

  expect(
    (await photos(db).find().orderByAsc('cdn_url').all()).map((u) => u.cdn_url),
  ).toMatchInlineSnapshot(`
    Array [
      "http://example.com/1",
      "http://example.com/3",
      "http://example.com/4",
    ]
  `);

  const insertOrIgnoreResults = await users(db).insertOrIgnore(
    {screen_name: 'John', bio: 'Updated bio'},
    {screen_name: 'Martin', bio: 'Updated bio'},
  );
  expect(insertOrIgnoreResults.length).toBe(1);
  const [martin] = insertOrIgnoreResults;
  expect(martin.screen_name).toBe('Martin');
  expect(martin.bio).toBe('Updated bio');

  expect(
    (await users(db).find().orderByAsc('screen_name').first())?.screen_name,
  ).toMatchInlineSnapshot(`"Ellie"`);
  expect(
    (await users(db).find().orderByDesc('screen_name').first())?.screen_name,
  ).toMatchInlineSnapshot(`"Martin"`);

  expect(
    (await users(db).find().orderByAsc('screen_name').all()).map((u) => [
      u.screen_name,
      u.bio,
    ]),
  ).toMatchInlineSnapshot(`
    Array [
      Array [
        "Ellie",
        null,
      ],
      Array [
        "Forbes",
        "Author of @databases",
      ],
      Array [
        "John",
        "Just a random name",
      ],
      Array [
        "Martin",
        "Updated bio",
      ],
    ]
  `);

  await photos(db).update(
    {cdn_url: 'http://example.com/3'},
    {caption: 'Hello World'},
  );
  expect(await photos(db).find({caption: null}).orderByAsc('id').all()).toEqual(
    (await photos(db).find().orderByAsc('id').all()).filter(
      (p) => p.caption === null,
    ),
  );
  expect(
    (await photos(db).find({caption: null}).orderByAsc('id').all()).map(
      (p) => ({
        caption: p.caption,
        cdn_url: p.cdn_url,
      }),
    ),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "caption": null,
        "cdn_url": "http://example.com/1",
      },
      Object {
        "caption": null,
        "cdn_url": "http://example.com/4",
      },
    ]
  `);
});

test('uses tableId in custom queries', async () => {
  const result = await db.query(sql`
    SELECT p.cdn_url, u.screen_name FROM ${photos(db).tableId} AS p
    JOIN ${users(db).tableId} AS u
    ON p.owner_user_id = u.id
  `);

  // Based on the data inserted in the previous test
  expect(result).toHaveLength(3);
  expect(result).toContainEqual({
    cdn_url: 'http://example.com/1',
    screen_name: 'Forbes',
  });
});

test('use a default connection', async () => {
  const {users} = defineTables<Schema>({
    schemaName: 'typed_queries_tests',
    defaultConnection: db,
  });
  const [inserted] = await users().insert({
    screen_name: 'Inserted with default connection',
  });
  expect(inserted.screen_name).toBe('Inserted with default connection');
  const defaultConnectionQuery = jest.fn().mockResolvedValue([]);
  const transactionQuery = jest.fn().mockResolvedValue([]);
  const {users: mockUsers} = defineTables<Schema>({
    schemaName: 'typed_queries_tests',
    defaultConnection: {
      query: defaultConnectionQuery,
      sql,
    } as any,
  });
  await mockUsers().findOne({id: 10});
  expect(defaultConnectionQuery).toBeCalledTimes(1);
  expect(transactionQuery).toBeCalledTimes(0);

  await mockUsers({
    query: transactionQuery,
    sql,
  } as any).findOne({id: 10});
  expect(defaultConnectionQuery).toBeCalledTimes(1);
  expect(transactionQuery).toBeCalledTimes(1);

  const {users: unconnectedUsers} = defineTables<Schema>({
    schemaName: 'typed_queries_tests',
  });

  expect(() =>
    unconnectedUsers(undefined as any),
  ).toThrowErrorMatchingInlineSnapshot(
    `"You must either provide a \\"defaultConnection\\" to pg-typed, or specify a connection when accessing the table."`,
  );
});

test('insert or update', async () => {
  const time1 = new Date('2021-01-10T11:00:00.000Z');
  const time2 = new Date('2021-01-10T20:00:00.000Z');
  const time3 = new Date('2021-01-10T23:00:00.000Z');

  const USER_A = 'insert_or_update_a';
  const USER_B = 'insert_or_update_b';

  function exp(user: any, {created, updated}: {created: Date; updated: Date}) {
    expect({
      created: user.created_at.toISOString(),
      updated: user.updated_at.toISOString(),
    }).toEqual({
      created: created.toISOString(),
      updated: updated.toISOString(),
    });
  }

  const [userA1] = await users(db).insert({
    screen_name: USER_A,
    created_at: time1,
    updated_at: time1,
  });
  exp(userA1, {created: time1, updated: time1});
  const [userA2, userB2] = await users(db).insertOrUpdate(
    {onConflict: [`screen_name`], set: ['screen_name', 'updated_at']},
    {
      screen_name: USER_A,
      created_at: time2,
      updated_at: time2,
    },
    {
      screen_name: USER_B,
      created_at: time2,
      updated_at: time2,
    },
  );
  exp(userA2, {created: time1, updated: time2});
  exp(userB2, {created: time2, updated: time2});

  const [userA3, userB3] = await users(db).insertOrUpdate(
    {onConflict: [`screen_name`], doNotSet: ['created_at']},
    {
      screen_name: USER_A,
      created_at: time3,
      updated_at: time3,
    },
    {
      screen_name: USER_B,
      created_at: time3,
      updated_at: time3,
    },
  );
  exp(userA3, {created: time1, updated: time3});
  exp(userB3, {created: time2, updated: time3});
});
