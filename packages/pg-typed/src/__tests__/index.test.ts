import connect, {sql} from '@databases/pg';
import Schema from './__generated__';
import tables from '../';

const {users, photos} = tables<Schema>({schemaName: 'typed_queries_tests'});

const db = connect();

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
    },
  );
  const photoRecords = await photos(db)
    .select({owner_user_id: forbes.id})
    .orderByAsc('cdn_url')
    .limit(2);
  expect(photoRecords.map((p) => p.cdn_url)).toMatchInlineSnapshot(`
    Array [
      "http://example.com/1",
      "http://example.com/2",
    ]
  `);

  const photoRecordsDesc = await photos(db)
    .select({owner_user_id: forbes.id})
    .orderByDesc('cdn_url')
    .limit(2);
  expect(photoRecordsDesc.map((p) => p.cdn_url)).toMatchInlineSnapshot(`
    Array [
      "http://example.com/3",
      "http://example.com/2",
    ]
  `);
  expect(await users(db).selectOne({id: ellie.id})).toEqual(ellie);
});
