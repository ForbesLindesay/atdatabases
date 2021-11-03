import connect, {sql} from '@databases/pg';
import Schema from './__generated__';
import tables from '..';

const {users, photos} = tables<Schema>({schemaName: 'typed_queries_tests'});

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
        age INT
      );
      CREATE TABLE typed_queries_tests.photos (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        owner_user_id BIGINT NOT NULL REFERENCES typed_queries_tests.users(id),
        cdn_url TEXT NOT NULL,
        caption TEXT NULL,
        metadata JSONB NOT NULL
      );
    `,
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

test('use a default connection', async () => {
  const {users} = tables<Schema>({
    schemaName: 'typed_queries_tests',
    defaultConnection: db,
  });
  const [inserted] = await users().insert({
    screen_name: 'Inserted with default connection',
  });
  expect(inserted.screen_name).toBe('Inserted with default connection');
  const defaultConnectionQuery = jest.fn().mockResolvedValue([]);
  const transactionQuery = jest.fn().mockResolvedValue([]);
  const {users: mockUsers} = tables<Schema>({
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

  const {users: unconnectedUsers} = tables<Schema>({
    schemaName: 'typed_queries_tests',
  });

  expect(() =>
    unconnectedUsers(undefined as any),
  ).toThrowErrorMatchingInlineSnapshot(
    `"You must either provide a \\"defaultConnection\\" to pg-typed, or specify a list of connections when accessing the table."`,
  );
});
